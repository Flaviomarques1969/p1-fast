// trecho-detector.js — detector ao vivo dos quatro momentos canônicos de
// cada trecho (curva) da pista: cruzou linha de entrada, começou a frear,
// cruzou ponto de ápice, cruzou linha de saída.
//
// Spec: PLANO_FASE_1.md §6 MS-13.5
// Decisões de produto:
//   - reference_p1fast_cockpit_piloto_v1_aprovado
//   - project_p1fast_freio_referencia_linha_entrada (Freio mede da linha de
//     entrada até o ponto de freada — NÃO até o ápice)
//   - project_p1fast_apice_bolinha_aponta_para_referencia (Ápice mede
//     distância e direção até o ponto ideal de referência)
//
// Consumo:
//   import { TrechoDetector, TrechoFase } from './trecho-detector.js';
//   const det = new TrechoDetector({ segments, onEvent: (ev) => {...} });
//   // pra cada amostra GPS do iPhone:
//   det.ingestGps({ lat, lng, kmh, t });
//
// Eventos emitidos via onEvent (ordem temporal natural por trecho):
//   { type: 'entrada-cruzou', segmentId, t, kmh }
//   { type: 'freada-iniciou', segmentId, t, kmh, distFromEntradaM }
//   { type: 'apice-cruzou',   segmentId, t, kmh, distFromIdealM, angleFromIdealDeg }
//   { type: 'saida-cruzou',   segmentId, t, kmh, completed:true }
//
// Notas de implementação:
//   - Detecção de cruzamento de linha = sinal do produto vetorial muda entre
//     amostras consecutivas (pontos de um lado vs do outro da linha).
//   - Detecção de freada = média móvel de desaceleração longitudinal cruza
//     limiar (default -0.5 g). Robusto sem sensor de pedal do T4000.
//   - Distância em metros entre dois pontos GPS = haversine; aproximação
//     equirectangular pra pequenas distâncias (<1 km) é suficiente e mais barata.
//   - Ângulo do erro de ápice = ângulo entre vetor "carro→ápice ideal" e
//     vetor de direção atual do carro (heading). Convertido em graus 0-360.

// ── Geometria — utilitárias puras (testáveis isoladamente) ──

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_R_M = 6_378_137;

/**
 * Distância aproximada em metros entre dois pontos GPS (equirectangular).
 * Boa pra <2 km. Para distâncias maiores, trocar pra haversine.
 */
export function distMeters(a, b) {
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const dLat = lat2 - lat1;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const x = dLng * Math.cos((lat1 + lat2) / 2);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * EARTH_R_M;
}

/**
 * Lado da linha em que o ponto p está, em relação à linha definida pelos
 * pontos a, b (sentido a→b). Retorna o sinal do produto vetorial:
 *   > 0 → ponto está à ESQUERDA da linha (sentido a→b)
 *   < 0 → ponto está à DIREITA
 *   = 0 → ponto está SOBRE a linha
 * Usado pra detectar cruzamento: sinal muda entre amostra n-1 e n.
 */
/** O caminho p0→p1 cruza o SEGMENTO a–b? (projeção local; folga de 50% nas
 *  pontas da linha). Trava dos cruzamentos: sem ela o prolongamento infinito
 *  da linha corta a pista inteira (achado com replay de voltas reais, 10/06). */
// Sanidade física: mínimo de distância ao ápice acima disso NÃO é passagem de
// ápice (observação Flávio 10/06: ápice real fica a ≤ ~10 m da linha do carro;
// 60 m dá folga pra semente + ruído sem aceitar absurdo).
const APICE_DIST_MAX_M = 60;

export function caminhoCruzaLinha(p0, p1, a, b) {
  const kLat = 110540;
  const kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const X = q => (q.lng - a.lng) * kLng;
  const Y = q => (q.lat - a.lat) * kLat;
  const r = { x: X(p1) - X(p0), y: Y(p1) - Y(p0) };
  const d = { x: X(b), y: Y(b) };
  const den = r.x * d.y - r.y * d.x;
  if (Math.abs(den) < 1e-9) return false;
  const qp = { x: -X(p0), y: -Y(p0) };
  const v = (qp.x * d.y - qp.y * d.x) / den;
  const u = (qp.x * r.y - qp.y * r.x) / den;
  return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
}

export function sideOfLine(p, a, b) {
  // produto vetorial 2D ((b-a) × (p-a)) no plano lat-lng
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/**
 * Heading em graus (0=norte, 90=leste) entre dois pontos GPS — direção
 * que o carro está apontando assumindo que foi de "from" pra "to".
 */
export function bearingDeg(from, to) {
  const lat1 = from.lat * DEG2RAD;
  const lat2 = to.lat * DEG2RAD;
  const dLng = (to.lng - from.lng) * DEG2RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360;
}

/**
 * Ângulo (em graus, 0..360) do vetor erro do carro em relação ao ápice ideal,
 * no referencial do CARRO (heading do carro é o "para cima" = 0°).
 *
 *  - 0°   → ápice está à FRENTE do carro (antecipou — carro ainda não chegou)
 *  - 90°  → ápice está à DIREITA do carro (carro abriu pra esquerda)
 *  - 180° → ápice está ATRÁS do carro (atrasou — carro já passou)
 *  - 270° → ápice está à ESQUERDA do carro (carro abriu pra direita)
 */
export function apexErrorAngleDeg(carPos, carHeadingDeg, apexIdealPos) {
  const bearingToApex = bearingDeg(carPos, apexIdealPos);
  return (bearingToApex - carHeadingDeg + 360) % 360;
}

// ── Constantes do detector ──

/** Faixa de desaceleração que conta como freada (g). */
const FREADA_LIMIAR_G = 0.5;
/** Tamanho da janela móvel pra suavizar desaceleração (amostras). */
const FREADA_JANELA = 5;
/** Distância mínima entre amostras GPS pra calcular heading confiável (metros). */
const HEADING_MIN_DIST_M = 1.0;

// ── Enum de fase ──

export const TrechoFase = Object.freeze({
  ANTES_ENTRADA: 'antes-entrada',
  ENTRADA_FREIO: 'entrada-freio',
  FREIO_APICE:   'freio-apice',
  APICE_SAIDA:   'apice-saida',
  POS_SAIDA:     'pos-saida',
});

// ── Detector ──

/**
 * Detector que processa amostras GPS contínuas e dispara eventos quando
 * o carro cruza os quatro momentos canônicos de cada trecho.
 *
 * Layout esperado de cada segmento:
 *   {
 *     id: 'curva-3',
 *     nome: 'Curva 3',
 *     entradaLine: { a: {lat,lng}, b: {lat,lng} },  // linha que abre o trecho
 *     apicePoint:  { lat, lng },                     // ponto ideal de ápice
 *     saidaLine:   { a: {lat,lng}, b: {lat,lng} },  // linha que fecha o trecho
 *   }
 *
 * Estado interno:
 *   - currentSegmentIdx — índice do segmento que está sendo "monitorado".
 *     Avança quando o carro completa o trecho atual.
 *   - phase — fase atual (TrechoFase).
 *   - lastSample, lastEntradaSide, lastSaidaSide — pra detectar cruzamento.
 *   - decelWindow — janela móvel de deceleração pra detectar freada.
 *   - entradaPos — posição GPS exata onde o carro cruzou a linha de entrada.
 */
export class TrechoDetector {
  constructor({ segments, onEvent = () => {} } = {}) {
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error('TrechoDetector: segments é obrigatório (array não-vazio)');
    }
    this._segments = segments;
    this._onEvent = onEvent;
    this._reset();
  }

  _reset() {
    this._currentIdx = 0;
    this._phase = TrechoFase.ANTES_ENTRADA;
    this._last = null;            // última amostra GPS
    this._lastEntradaSide = null; // sinal do lado em relação à linha de entrada
    this._lastSaidaSide   = null; // sinal do lado em relação à linha de saída
    this._entradaSides = new Array(this._segments.length).fill(null); // lados de TODAS as entradas (resync)
    this._entradaPos = null;      // ponto GPS de cruzamento da entrada
    this._entradaT   = null;      // timestamp do cruzamento da entrada
    this._lastApiceDist = Infinity; // pra detectar mínimo local
    this._apiceCrossed = false;
    this._decelWindow = [];       // últimas N amostras de deceleração (g)
  }

  /** Posiciona o detector num segmento específico (pra retomar). */
  setSegment(index) {
    if (index < 0 || index >= this._segments.length) {
      throw new Error(`TrechoDetector: índice fora dos segmentos`);
    }
    this._currentIdx = index;
    this._phase = TrechoFase.ANTES_ENTRADA;
    this._last = null;
    this._lastEntradaSide = null;
    this._lastSaidaSide = null;
    this._entradaPos = null;
    this._lastApiceDist = Infinity;
    this._apiceCrossed = false;
    this._decelWindow = [];
  }

  /** Avança para o próximo trecho (chamado internamente após saída). */
  _advance() {
    this._currentIdx = (this._currentIdx + 1) % this._segments.length;
    this._phase = TrechoFase.ANTES_ENTRADA;
    this._lastEntradaSide = null;
    this._lastSaidaSide = null;
    this._entradaPos = null;
    this._lastApiceDist = Infinity;
    this._apiceCrossed = false;
    this._decelWindow = [];
  }

  /**
   * Ingere uma amostra GPS do iPhone. Formato esperado:
   *   { lat, lng, kmh, t }       // t = timestamp em ms
   * Opcionalmente:
   *   { ..., headingDeg }        // se vier do CLLocation course
   *
   * Dispara onEvent conforme cruzamentos detectados.
   */
  ingestGps(sample) {
    if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') {
      return;
    }
    const seg = this._segments[this._currentIdx];
    if (!seg) return;

    const t   = typeof sample.t === 'number' ? sample.t : Date.now();
    const kmh = typeof sample.kmh === 'number' ? sample.kmh : 0;

    // heading: usa o do GPS se vier, senão calcula entre amostras
    let headingDeg = sample.headingDeg;
    if ((headingDeg == null || !Number.isFinite(headingDeg)) && this._last) {
      if (distMeters(this._last, sample) >= HEADING_MIN_DIST_M) {
        headingDeg = bearingDeg(this._last, sample);
      }
    }

    // calcula deceleração desde a última amostra (g)
    if (this._last && this._last.t != null) {
      const dt = Math.max(0.001, (t - this._last.t) / 1000);
      const dv = (kmh - (this._last.kmh || 0)) / 3.6; // m/s
      const a_g = (dv / dt) / 9.80665;
      this._decelWindow.push(a_g);
      if (this._decelWindow.length > FREADA_JANELA) this._decelWindow.shift();
    }
    const avgDecel = this._decelWindow.length
      ? this._decelWindow.reduce((s, x) => s + x, 0) / this._decelWindow.length
      : 0;

    // ── Detecção de cruzamento da linha de entrada ──
    // Usa o vigia paralelo (_entradaSides) como memória do lado anterior: ele
    // sobrevive ao avanço de trecho — sem o "tick cego" que perdia a curva
    // seguinte quando a reta entre elas era curta (achado nos testes 10/06).
    const entradaSide = sideOfLine(sample, seg.entradaLine.a, seg.entradaLine.b);
    const ladoAnteriorEntrada = this._entradaSides[this._currentIdx] != null
      ? this._entradaSides[this._currentIdx] : this._lastEntradaSide;
    if (ladoAnteriorEntrada != null
        && Math.sign(entradaSide) !== Math.sign(ladoAnteriorEntrada)
        && (!this._last || caminhoCruzaLinha(this._last, sample, seg.entradaLine.a, seg.entradaLine.b))
        && this._phase === TrechoFase.ANTES_ENTRADA) {
      this._phase = TrechoFase.ENTRADA_FREIO;
      this._entradaPos = { lat: sample.lat, lng: sample.lng };
      this._entradaT = t;
      this._onEvent({
        type: 'entrada-cruzou',
        segmentId: seg.id,
        t, kmh,
      });
    }
    this._lastEntradaSide = entradaSide;

    // ── Detecção de início da freada ──
    if (this._phase === TrechoFase.ENTRADA_FREIO && avgDecel <= -FREADA_LIMIAR_G) {
      const distFromEntradaM = this._entradaPos
        ? distMeters(this._entradaPos, sample) : 0;
      this._phase = TrechoFase.FREIO_APICE;
      this._onEvent({
        type: 'freada-iniciou',
        segmentId: seg.id,
        t, kmh, distFromEntradaM,
      });
    }

    // ── Detecção do ápice (mínimo de distância ao ponto ideal) ──
    if ((this._phase === TrechoFase.FREIO_APICE || this._phase === TrechoFase.ENTRADA_FREIO)
        && seg.apicePoint) {
      const distToApex = distMeters(sample, seg.apicePoint);
      if (distToApex < this._lastApiceDist) {
        this._lastApiceDist = distToApex;
      } else if (!this._apiceCrossed && this._lastApiceDist < APICE_DIST_MAX_M) {
        // distância começou a aumentar → cruzou o ponto mais próximo
        this._apiceCrossed = true;
        this._phase = TrechoFase.APICE_SAIDA;
        const angleDeg = (headingDeg != null && Number.isFinite(headingDeg))
          ? apexErrorAngleDeg(this._last || sample, headingDeg, seg.apicePoint)
          : null;
        this._onEvent({
          type: 'apice-cruzou',
          segmentId: seg.id,
          t, kmh,
          distFromIdealM:    this._lastApiceDist,
          angleFromIdealDeg: angleDeg,
        });
      }
    }

    // ── Detecção de cruzamento da linha de saída ──
    // Aceita fechar a partir de qualquer fase INTERNA do trecho. Se o ápice
    // ainda não tinha sido reconhecido (ponto-semente impreciso, ruído), fecha
    // com o melhor que viu — distFromIdealM = mínimo observado, ou null se
    // nunca chegou perto (NUNCA inventa valor). Sem isso, ápice perdido
    // travava a curva e a fila inteira (defeito 2-3 de 8, replay 10/06).
    const saidaSide = sideOfLine(sample, seg.saidaLine.a, seg.saidaLine.b);
    const dentroDoTrecho = this._phase === TrechoFase.ENTRADA_FREIO
      || this._phase === TrechoFase.FREIO_APICE
      || this._phase === TrechoFase.APICE_SAIDA;
    if (this._lastSaidaSide != null
        && Math.sign(saidaSide) !== Math.sign(this._lastSaidaSide)
        && (!this._last || caminhoCruzaLinha(this._last, sample, seg.saidaLine.a, seg.saidaLine.b))
        && dentroDoTrecho) {
      if (!this._apiceCrossed) {
        this._onEvent({
          type: 'apice-cruzou',
          segmentId: seg.id,
          t, kmh,
          distFromIdealM: this._lastApiceDist < Infinity ? this._lastApiceDist : null,
          angleFromIdealDeg: null,
          fechamentoDeEmergencia: true,
        });
      }
      this._phase = TrechoFase.POS_SAIDA;
      this._onEvent({
        type: 'saida-cruzou',
        segmentId: seg.id,
        t, kmh, completed: true,
      });
      this._advance();
      this._last = { lat: sample.lat, lng: sample.lng, kmh, t };
      this._atualizarLadosEntradas(sample);
      return;
    }
    this._lastSaidaSide = saidaSide;

    // ── RESSINCRONIZAÇÃO: vigia paralelo das entradas de TODOS os trechos ──
    // Se o carro cruzar a entrada de OUTRO trecho (porque o atual foi perdido),
    // o vigia abandona o atual (sem inventar medição) e engata no trecho onde
    // o carro REALMENTE está. Sem isso, 1 curva perdida cegava o resto da volta.
    const cruzouOutra = this._detectarEntradaDeOutro(sample);
    if (cruzouOutra !== null && cruzouOutra !== this._currentIdx) {
      const de = seg.id;
      this._currentIdx = cruzouOutra;
      const novo = this._segments[this._currentIdx];
      this._phase = TrechoFase.ENTRADA_FREIO;
      this._entradaPos = { lat: sample.lat, lng: sample.lng };
      this._entradaT = t;
      this._lastSaidaSide = null;
      this._lastApiceDist = Infinity;
      this._apiceCrossed = false;
      this._decelWindow = [];
      this._onEvent({ type: 'resync', deSegmentId: de, paraSegmentId: novo.id, t });
      this._onEvent({ type: 'entrada-cruzou', segmentId: novo.id, t, kmh });
    }
    this._atualizarLadosEntradas(sample);

    this._last = { lat: sample.lat, lng: sample.lng, kmh, t };
  }

  /** Atualiza o lado de cada linha de entrada (estado do vigia paralelo). */
  _atualizarLadosEntradas(sample) {
    for (let j = 0; j < this._segments.length; j++) {
      const sj = this._segments[j];
      this._entradaSides[j] = sideOfLine(sample, sj.entradaLine.a, sj.entradaLine.b);
    }
  }

  /** Algum OUTRO trecho teve a entrada cruzada nesta amostra? Devolve o índice ou null. */
  _detectarEntradaDeOutro(sample) {
    if (!this._last) return null;
    const n = this._segments.length;
    // varre na ordem da volta a partir do trecho atual (o mais provável primeiro)
    for (let passo = 1; passo < n; passo++) {
      const j = (this._currentIdx + passo) % n;
      const sj = this._segments[j];
      const lado = sideOfLine(sample, sj.entradaLine.a, sj.entradaLine.b);
      const anterior = this._entradaSides[j];
      if (anterior != null
          && Math.sign(lado) !== Math.sign(anterior)
          && caminhoCruzaLinha(this._last, sample, sj.entradaLine.a, sj.entradaLine.b)) {
        return j;
      }
    }
    return null;
  }

  /** Estado público pra debug / UI. */
  getState() {
    return {
      currentSegmentIdx: this._currentIdx,
      currentSegmentId:  this._segments[this._currentIdx]?.id,
      phase: this._phase,
    };
  }
}
