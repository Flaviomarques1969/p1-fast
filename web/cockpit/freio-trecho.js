// freio-trecho.js — curva de FRENAGEM e ACELERAÇÃO do trecho (lógica de produção).
//
// Decisão Flávio 11/06/2026 (literal): "a função, a lógica, é a de produção.
// Você só vai preencher com dados, simulando como se tivesse funcionando o
// controle da pressão do freio. Nós vamos instalar isso agora, segunda ou
// terça-feira (...) o dado é o dado de informação de pressão de freio."
//
// Contrato de honestidade (regras já aprovadas do produto):
//   - Sensor de mentira não engana: canal chegando zerado/chapado NÃO é sensor
//     instalado — detecção de presença antes de tratar como real.
//   - Dado simulado é SEMPRE rotulado (fonteFreio) e inconfundível na tela.
//   - Sem sensor, a intensidade vem da FÍSICA REAL da passagem (desaceleração
//     medida pelo GPS) — é o efeito verdadeiro no carro, não invenção; vira
//     "simulado-fisica" até a pressão real chegar por cima.
//
// Onde o sensor real entra (instalação seg/ter): t3000-usb-parser.js já expõe
//   pedalFreioPct (offset 54, ÷10 → %) · pressaoFreioBar (offset 268, ÷100)
//   pedalAceleradorPct (offset 52, ÷10 → %).
// O caminho ao vivo casa amostra T4000 → ponto GPS por timestamp (mesma
// estratégia decidida pro PAce TPS×GPS).

// ── Geometria básica ──────────────────────────────────────────

const R_TERRA = 6378137;
const D2R = Math.PI / 180;

function distM(a, b) {
  const x = (b.lng - a.lng) * D2R * Math.cos(((a.lat + b.lat) / 2) * D2R);
  const y = (b.lat - a.lat) * D2R;
  return Math.hypot(x, y) * R_TERRA;
}

/** Distância acumulada (m) ao longo da passagem — eixo X de todos os gráficos. */
export function comDistanciaAcumulada(pontos) {
  let acc = 0;
  return pontos.map((p, i) => {
    if (i > 0) acc += distM(pontos[i - 1], p);
    return { ...p, distM: acc };
  });
}

function suavizar(valores, janela = 3) {
  const meia = Math.floor(janela / 2);
  return valores.map((_, i) => {
    let soma = 0, n = 0;
    for (let j = i - meia; j <= i + meia; j++) {
      if (j >= 0 && j < valores.length && Number.isFinite(valores[j])) { soma += valores[j]; n++; }
    }
    return n ? soma / n : valores[i];
  });
}

// ── Intensidade pela física real (até o sensor chegar) ────────

/**
 * Deriva freioPct / aceleradorPct (0–100) da física REAL da passagem:
 * aceleração longitudinal por v²=v₀²+2aΔs entre pontos vizinhos (não depende
 * de relógio), suavizada, normalizada pelo pico de desaceleração da própria
 * passagem. freioPct=100 = a freada mais forte QUE O CARRO FEZ nesta passagem.
 * Rótulo: fonteFreio 'simulado-fisica'. NÃO é pressão de pedal — é o efeito.
 */
export function simularFreioPelaFisica(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 3) {
    return { pontos: pontos ?? [], fonteFreio: 'simulado-fisica', picoDesacelMs2: null };
  }
  const pts = pontos[0].distM == null ? comDistanciaAcumulada(pontos) : pontos.map(p => ({ ...p }));
  // aceleração no ponto i pelo intervalo [i-1, i+1] (centrada)
  const acel = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const ds = b.distM - a.distM;
    if (!(ds > 0.5)) return 0;
    const v1 = (a.kmh ?? 0) / 3.6, v2 = (b.kmh ?? 0) / 3.6;
    return (v2 * v2 - v1 * v1) / (2 * ds); // m/s² (negativo = freando)
  });
  const acelSuave = suavizar(acel, 3);
  const picoFreio = Math.max(...acelSuave.map(a => -a), 0);
  const picoAcel  = Math.max(...acelSuave.map(a => a), 0);
  // piso de 1,5 m/s²: passagem sem freada de verdade não ganha curva de 100%
  const refFreio = Math.max(picoFreio, 1.5);
  const refAcel  = Math.max(picoAcel, 1.0);
  const RUIDO = 0.35; // m/s² — abaixo disso é deriva de GPS, não pedal
  for (let i = 0; i < pts.length; i++) {
    const a = acelSuave[i];
    pts[i].freioPct      = a < -RUIDO ? Math.min(100, (-a / refFreio) * 100) : 0;
    pts[i].aceleradorPct = a >  RUIDO ? Math.min(100, (a / refAcel) * 100) : 0;
  }
  return { pontos: pts, fonteFreio: 'simulado-fisica', picoDesacelMs2: picoFreio };
}

// ── Sensor real (instalação seg/ter) ──────────────────────────

/**
 * Sensor presente = canal NÃO-nulo que VARIA de verdade.
 * Zero chapado, null ou variação < 3 unidades = sensor ausente (regra dura:
 * offset chegando 0 ≠ sensor instalado).
 * amostras: [{ t, pedalFreioPct?, pressaoFreioBar? }]
 */
export function detectarPresencaSensorFreio(amostras, { minAmostras = 20 } = {}) {
  if (!Array.isArray(amostras) || amostras.length < minAmostras) return null;
  for (const canal of ['pressaoFreioBar', 'pedalFreioPct']) {
    const vs = amostras.map(s => s?.[canal]).filter(v => Number.isFinite(v));
    if (vs.length < minAmostras) continue;
    const min = Math.min(...vs), max = Math.max(...vs);
    if (max - min >= 3) return canal === 'pressaoFreioBar' ? 'sensor-pressao' : 'sensor-pedal';
  }
  return null;
}

/**
 * Funde o canal real do sensor nos pontos GPS por timestamp (tolerância
 * 250 ms). Pressão (bar) vira % do pico da própria sessão (declarado).
 * Ponto sem amostra casável fica freioPct=null — NUNCA inventa.
 * Retorna null se a presença do sensor não for confirmada.
 */
export function fundirFreioNosPontos(pontos, amostras, { toleranciaMs = 250 } = {}) {
  const fonte = detectarPresencaSensorFreio(amostras);
  if (!fonte) return null;
  const canal = fonte === 'sensor-pressao' ? 'pressaoFreioBar' : 'pedalFreioPct';
  const ordenadas = amostras.filter(s => Number.isFinite(s?.t) && Number.isFinite(s?.[canal]))
    .sort((a, b) => a.t - b.t);
  const pico = fonte === 'sensor-pressao'
    ? Math.max(...ordenadas.map(s => s[canal]), 0.01)
    : 100;
  const pts = (pontos[0]?.distM == null ? comDistanciaAcumulada(pontos) : pontos.map(p => ({ ...p })));
  let j = 0;
  for (const p of pts) {
    while (j < ordenadas.length - 1 && Math.abs(ordenadas[j + 1].t - p.t) <= Math.abs(ordenadas[j].t - p.t)) j++;
    const s = ordenadas[j];
    p.freioPct = (s && Math.abs(s.t - p.t) <= toleranciaMs)
      ? Math.min(100, (s[canal] / pico) * 100)
      : null;
    if (s && Number.isFinite(s.pedalAceleradorPct) && Math.abs(s.t - p.t) <= toleranciaMs) {
      p.aceleradorPct = Math.min(100, s.pedalAceleradorPct);
    }
  }
  return { pontos: pts, fonteFreio: fonte, picoPressaoBar: fonte === 'sensor-pressao' ? pico : null };
}

// ── Métricas do trail braking ─────────────────────────────────

const LIMIAR_FREANDO = 15;  // % — abaixo disso não conta como "no freio"
const LIMIAR_SOLTO   = 10;  // % — fim da soltura

/**
 * Lê a assinatura do trail braking numa passagem com freioPct:
 *   onde freou (m), pico (%), comprimento da soltura (m do pico até <10%),
 *   forma da soltura ('degrau' = largou de uma vez | 'progressiva' = trail),
 *   onde ficou a velocidade mínima (m) e quanto freio ainda havia nela (%).
 */
export function metricasTrail(pontos) {
  if (!Array.isArray(pontos) || !pontos.length || pontos[0].freioPct === undefined) return null;
  const pts = pontos;
  let iFreada = -1, iPico = -1, pico = 0;
  for (let i = 0; i < pts.length; i++) {
    const f = pts[i].freioPct ?? 0;
    if (iFreada < 0 && f >= LIMIAR_FREANDO) iFreada = i;
    if (f > pico) { pico = f; iPico = i; }
  }
  if (iFreada < 0 || pico < LIMIAR_FREANDO) return null; // passagem sem freada real
  // A soltura começa quando a pressão COMEÇA A CAIR — patamar segurado no
  // máximo (freada de limite) não conta como soltura.
  while (iPico < pts.length - 1 && (pts[iPico + 1].freioPct ?? 0) >= pico * 0.95) iPico++;
  let iSolto = pts.length - 1;
  for (let i = iPico; i < pts.length; i++) {
    if ((pts[i].freioPct ?? 0) <= LIMIAR_SOLTO) { iSolto = i; break; }
  }
  let iVmin = 0;
  for (let i = 1; i < pts.length; i++) if ((pts[i].kmh ?? 1e9) < (pts[iVmin].kmh ?? 1e9)) iVmin = i;
  const solturaM = Math.max(0, pts[iSolto].distM - pts[iPico].distM);
  return {
    freadaM: pts[iFreada].distM,
    picoPct: pico,
    picoM: pts[iPico].distM,
    solturaM,
    forma: solturaM < 6 ? 'degrau' : 'progressiva',
    vminKmh: pts[iVmin].kmh ?? null,
    vminM: pts[iVmin].distM,
    freioNaVminPct: pts[iVmin].freioPct ?? 0,
  };
}

/**
 * Leitura da IA em linguagem do painel (verbo no pretérito, sem floreio).
 * Compara a passagem em revisão com a melhor histórica do trecho.
 */
export function leituraIA(minha, melhor) {
  if (!minha) return 'Sem freada medida nesta passagem — trecho de aceleração ou dado insuficiente.';
  const frases = [];
  if (melhor) {
    const dif = minha.freadaM - melhor.freadaM;
    if (Math.abs(dif) >= 3) {
      frases.push(`FREOU ${Math.abs(dif).toFixed(0)} m ${dif < 0 ? 'ANTES' : 'DEPOIS'} da melhor`);
    } else {
      frases.push('FREOU no ponto da melhor');
    }
  }
  if (minha.forma === 'degrau') {
    frases.push(`SOLTOU DE UMA VEZ (${minha.solturaM.toFixed(0)} m do pico ao solto)`);
  } else {
    frases.push(`soltura progressiva por ${minha.solturaM.toFixed(0)} m`);
  }
  if (melhor && melhor.forma === 'progressiva' && minha.forma === 'degrau') {
    frases.push(`a melhor arrasta ${melhor.freioNaVminPct.toFixed(0)}% de freio até a mínima — é o trail`);
  } else if (minha.freioNaVminPct >= 8) {
    frases.push(`chegou na mínima ainda com ${minha.freioNaVminPct.toFixed(0)}% de freio`);
  }
  return frases.join(' · ') + '.';
}
