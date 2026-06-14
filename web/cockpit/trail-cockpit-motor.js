// trail-cockpit-motor.js — motor PURO do cockpit em modo treino TRAIL BRAKING.
//
// Ditado Flávio 11-12/06/2026 (18 rodadas, registro canônico:
// p1-fast-ditado-cockpit-treino-por-disciplina-2026-06-11.md). Spec visual =
// mockup VIVO _design-reference/mockup-cockpit-treino-trail-braking-VIVO-2026-06-11.html.
//
// O que este motor decide (zero DOM, roda igual em Node e navegador):
//   - alvo por trecho: a curva de freio REAL da melhor passagem daquele trecho
//     (régua canônica — cada curva tem seu próprio trail, rodada 16);
//   - contagem regressiva em metros até o ponto de freada da melhor, com
//     ZERO ADIANTADO PELA REAÇÃO aprendida por passagem (rodada 10);
//   - nível das colunas de luz do freio (mesma régua da contagem);
//   - pintura ao vivo da freada: VERDE na banda do alvo / VERMELHO fora;
//   - veredito TRAIL CERTO/ERRADO: 2 de 2 — formato + mínima ainda freando
//     (D1, Flávio 14/06); o ponto de freada é AVISO (FREOU CEDO/TARDE), não
//     reprova. Volta a 3 de 3 (ponto de freada reprova) quando a pressão real
//     entrar (A3), só virando opts.pontoFreadaReprova=true — a tela não muda;
//   - trilho por trecho: só ÚLTIMA + ANTERIOR (decisão rodada 11).
//
// Quem desenha é trail-cockpit-tela.js (camada DOM, criada só com treino armado).

import {
  comDistanciaAcumulada, simularFreioPelaFisica, metricasTrail,
  fundirFreioNosPontos, detectarPresencaSensorFreio,
} from './freio-trecho.js';

// ── Defaults assumidos (Flávio não bateu martelo — declarados na entrega) ──
export const TRAIL_DEFAULTS = Object.freeze({
  // critério do CERTO (D1, Flávio 14/06): 2 de 2 = formato + mínima ainda
  // freando. O ponto de freada é AVISO (FREOU CEDO/TARDE), não reprova — a
  // 1 Hz por GPS exigir o ponto cravado reprovaria passagem boa. Sobe pra
  // 3 de 3 (ponto de freada volta a reprovar) quando a pressão real entrar
  // (A3), só virando pontoFreadaReprova=true — a tela não muda.
  pontoFreadaReprova: false, // false = 2 de 2 (ponto = aviso) · true = 3 de 3
  tolFreadaM: 3,          // ponto de freada: |minha freada − melhor| ≤ 3 m (aviso / cond do 3 de 3)
  bandaPct: 8,            // (1) banda de aceite ±8% de freio em volta do alvo
  formatoMinFrac: 0.8,    // (1) seguiu o formato: ≥80% dos pontos dentro da banda
  freioVminMinPct: 8,     // (2) mínima ainda freando: ≥8% de freio na Vmin
  apiceTolPct: 12,        // régua .apex: % de freio no ápice vs alvo (±12)
  velTolKmh: 2,           // régua .apex: entrada/saída vs melhor (−2 km/h ainda verde)
  // colunas de luz do freio — mesma régua do mockup (metros até o ZERO adiantado)
  thrLuzM: [130, 105, 80, 55, 35, 18],
  // reação zero→pé (rodada 10): aprendida por passagem, EMA, com piso/teto
  reacaoDefaultS: 0.25,
  reacaoMinS: 0.10,
  reacaoMaxS: 0.60,
  reacaoAlpha: 0.25,
  reacaoAmostraMaxS: 1.2, // acima disso a amostra é descartada (não foi reação)
  limiarPisouPct: 15,     // mesmo LIMIAR_FREANDO do freio-trecho.js
  contagemPassouM: 2,     // contagem vira vermelha 2 m depois do ponto REAL
  fusaoTolMs: 250,        // A3: casa amostra do sensor → ponto GPS por tempo (±250 ms)
});

const LS_REACAO = 'p1fast-trail-reacao-v1';
const AMOSTRAS_FREIO_JANELA_MS = 60000; // buffer rolante das amostras do sensor de freio (A2)

// ── Geometria (mesma régua dos módulos vizinhos) ───────────────
const R_TERRA = 6378137;
const D2R = Math.PI / 180;
function distM(a, b) {
  const x = (b.lng - a.lng) * D2R * Math.cos(((a.lat + b.lat) / 2) * D2R);
  const y = (b.lat - a.lat) * D2R;
  return Math.hypot(x, y) * R_TERRA;
}
function centroLinha(l) { return { lat: (l.a.lat + l.b.lat) / 2, lng: (l.a.lng + l.b.lng) / 2 }; }

// ── Alvo por trecho ────────────────────────────────────────────

/**
 * Constrói o alvo de frenagem do trecho a partir da SÉRIE REAL da melhor
 * passagem (pontos_json: {lat,lng,kmh,t,fracao,sub}, começa na linha de
 * entrada). Sem freada real na melhor (reta/SF) OU série rala demais pra
 * cravar ponto de freada → null (trecho sem alvo — nada de régua inventada;
 * guard da rodada 18 + regra dura "sensor de mentira não engana").
 *
 * Abaixo, primeiro o utilitário da mínima:
 *
 * Freio % "perto da mínima": maior valor na janela [vminM−10, vminM−1].
 * Duas sutilezas físicas:
 *   - na mínima EXATA a desaceleração por GPS é zero por definição
 *     (dv/ds = 0 no mínimo) — o trail se mede CHEGANDO nela;
 *   - a mínima robusta é o ÚLTIMO ponto a 0,3 km/h da mínima — em velocidade
 *     constante a amostragem discreta jogaria a "mínima" no primeiro ponto
 *     do patamar e a janela pegaria o fim da pancada, não a chegada na mínima.
 */
export function freioPertoDaVmin(pontosFis, escala = 1) {
  if (!Array.isArray(pontosFis) || !pontosFis.length) return 0;
  let vminKmh = Infinity;
  for (const p of pontosFis) if (Number.isFinite(p.kmh) && p.kmh < vminKmh) vminKmh = p.kmh;
  if (!Number.isFinite(vminKmh)) return 0;
  let vminM = null;
  for (const p of pontosFis) if (Number.isFinite(p.kmh) && p.kmh <= vminKmh + 0.3) vminM = p.distM;
  if (!Number.isFinite(vminM)) return 0;
  let max = 0, achou = false;
  for (const p of pontosFis) {
    if (p.distM >= vminM - 10 && p.distM <= vminM - 1) {
      achou = true;
      const v = Math.min(100, (p.freioPct ?? 0) * escala);
      if (v > max) max = v;
    }
  }
  if (!achou) { // freada curtíssima: cai pro valor na própria mínima
    const pv = pontosFis.find(p => p.distM === vminM) ?? pontosFis[pontosFis.length - 1];
    return Math.min(100, (pv.freioPct ?? 0) * escala);
  }
  return max;
}

// Trava de densidade da referência: ponto de freada só é régua HONESTA com
// série densa. As voltas de maio no banco têm 4-19 pontos por trecho (1 Hz =
// 30-43 m entre pontos) — régua nessa resolução seria inventada (conferido
// 12/06 contra o banco real). Referência rala → trecho fica calibrando até
// uma passagem densa virar melhor (atualizarReferencia no passagem-salva).
const REF_MIN_PONTOS = 15;
const REF_ESPACAMENTO_MAX_M = 8;
// Pico mínimo de desaceleração pra existir ZONA DE FREADA de verdade: abaixo
// de 2,5 m/s² é tirada de pé/deriva de GPS, não freada — sem alvo de treino.
const ALVO_PICO_MIN_MS2 = 2.5;

export function construirAlvoTrecho(refPontos) {
  if (!Array.isArray(refPontos) || refPontos.length < REF_MIN_PONTOS) return null;
  const acc = comDistanciaAcumulada(refPontos);
  const compM = acc[acc.length - 1].distM;
  if (compM / (refPontos.length - 1) > REF_ESPACAMENTO_MAX_M) return null;
  const fis = simularFreioPelaFisica(acc);
  const met = metricasTrail(fis.pontos);
  if (!met || !(fis.picoDesacelMs2 >= ALVO_PICO_MIN_MS2)) return null;
  // mínima ANTES da freada (geometria degenerada) = veredito impossível — sem alvo
  if (!(met.vminM > met.freadaM)) return null;
  return {
    freioPertoVminPct: freioPertoDaVmin(fis.pontos),
    curva: fis.pontos.map(p => ({ distM: p.distM, freioPct: p.freioPct ?? 0, kmh: p.kmh ?? null })),
    freadaM: met.freadaM,
    vminM: met.vminM,
    // fim honesto do desenho/julgamento: perto da mínima a física por GPS
    // despenca pra zero por definição (dv/ds = 0) — corta 6 m antes
    fimM: Math.max(met.freadaM + 4, met.vminM - 6),
    picoDesacelMs2: fis.picoDesacelMs2,
    metricas: met,
    entradaKmh: Number.isFinite(refPontos[0]?.kmh) ? refPontos[0].kmh : null,
    saidaKmh: Number.isFinite(refPontos[refPontos.length - 1]?.kmh) ? refPontos[refPontos.length - 1].kmh : null,
  };
}

/** Freio % do alvo na posição distM (interpolação linear; antes da curva = 0). */
export function alvoPctEm(alvo, x) {
  const c = alvo?.curva;
  if (!Array.isArray(c) || !c.length) return 0;
  if (x <= c[0].distM) return c[0].freioPct;
  if (x >= c[c.length - 1].distM) return c[c.length - 1].freioPct;
  for (let i = 1; i < c.length; i++) {
    if (c[i].distM >= x) {
      const a = c[i - 1], b = c[i];
      const f = (x - a.distM) / Math.max(1e-9, b.distM - a.distM);
      return a.freioPct + (b.freioPct - a.freioPct) * f;
    }
  }
  return 0;
}

/** Nível 0..6 das colunas de luz pela distância ao zero adiantado. */
export function nivelLuzFreio(distZM, thr = TRAIL_DEFAULTS.thrLuzM) {
  if (!Number.isFinite(distZM)) return 0;
  let n = 0;
  for (const t of thr) if (distZM <= t) n++;
  return n;
}

/**
 * Rótulo curto do trecho pro trilho (sigla do mockup: C1 RO C2 JU BR PL S VI).
 * Regra: derruba "CURVA" e conectivos; número vira C+número; duas palavras
 * viram iniciais; uma palavra vira as 2 primeiras letras.
 */
export function rotuloTrilho(nome) {
  if (typeof nome !== 'string' || !nome.trim()) return '·';
  const CONECTIVOS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'CURVA']);
  const palavras = nome.toUpperCase().replace(/[^A-ZÀ-Ü0-9 ]/g, ' ').split(/\s+/)
    .filter(p => p && !CONECTIVOS.has(p));
  if (!palavras.length) return nome.trim().slice(0, 2).toUpperCase();
  if (/^\d+$/.test(palavras[0])) return 'C' + String(Number(palavras[0]));
  if (palavras.length >= 2) return palavras[0][0] + palavras[1][0];
  return palavras[0].slice(0, 2);
}

// ── Veredito TRAIL CERTO/ERRADO (2 de 2 — D1, Flávio 14/06) ──

/**
 * Compara a passagem fechada com o alvo do trecho.
 * Critério (D1, Flávio 14/06 — ponto de freada vira AVISO, não reprova):
 *   CERTO = seguiu o FORMATO + chegou na mínima ainda freando (2 de 2).
 *   1. seguiu o FORMATO da melhor DESTE trecho (rodada 16): ≥ formatoMinFrac
 *      dos pontos entre a freada e a Vmin dentro da banda ±bandaPct
 *      (curvas comparadas na MESMA escala: % do pico da melhor)
 *   2. chegou na mínima ainda freando: ≥ freioVminMinPct na Vmin
 *   AVISO (não reprova): ponto de freada fora da banda (|freadaM − melhor| >
 *      tolFreadaM) → 'FREOU CEDO' / 'FREOU TARDE' em .aviso, mesmo no CERTO.
 *   Com opts.pontoFreadaReprova=true (A3, quando a pressão real entrar) o
 *   ponto de freada VOLTA a reprovar (3 de 3) — sem mudar a tela.
 */
export function computarVeredito(pontosPassagem, alvo, opts = {}, amostrasFreio = null) {
  const o = { ...TRAIL_DEFAULTS, ...opts };
  if (!alvo) return null; // trecho sem alvo de freada — não há veredito de trail
  if (!Array.isArray(pontosPassagem) || pontosPassagem.length < 3) {
    return { certo: false, erro: 'SEM DADO', condicoes: null, metricas: null, fonteFreio: null };
  }
  // A3: FUSÃO. Com o sensor presente (canal varia de verdade), a curva de freio
  // vem da PRESSÃO medida (fundida por tempo, ±250 ms); senão, da física do GPS
  // (proxy). A desaceleração real (picoDesacelMs2) vem sempre da física — é o
  // que reescala a minha curva pra régua da melhor. (A conversão pressão→% e a
  // reconciliação de escala definitiva ficam pra A7, com o sensor real.)
  const acc = comDistanciaAcumulada(pontosPassagem);
  let fis = null, fonteFreio = 'simulado-fisica';
  if (Array.isArray(amostrasFreio) && amostrasFreio.length) {
    const fundido = fundirFreioNosPontos(acc, amostrasFreio, { toleranciaMs: o.fusaoTolMs });
    if (fundido) {
      const fisica = simularFreioPelaFisica(acc);
      fis = { pontos: fundido.pontos, picoDesacelMs2: fisica.picoDesacelMs2 };
      fonteFreio = fundido.fonteFreio;
    }
  }
  if (!fis) fis = simularFreioPelaFisica(acc);
  const met = metricasTrail(fis.pontos);
  if (!met) return { certo: false, erro: 'NAO FREOU', condicoes: null, metricas: null, fonteFreio };

  // reescala a minha curva pra régua da melhor (% do pico de desaceleração DELA).
  // O numerador respeita o MESMO piso de 1,5 m/s² que a normalização da física
  // usou (freio-trecho.js) — senão freada leve reescala errado.
  const fator = (fis.picoDesacelMs2 > 0 && alvo.picoDesacelMs2 > 0)
    ? Math.max(fis.picoDesacelMs2, 1.5) / alvo.picoDesacelMs2 : 1;
  const pctRe = (p) => Math.min(100, (p.freioPct ?? 0) * fator);

  // ponto de freada: condição do 3 de 3, AVISO no 2 de 2 (default D1)
  const freouNaBanda = Math.abs(met.freadaM - alvo.metricas.freadaM) <= o.tolFreadaM;

  const x0 = Math.min(met.freadaM, alvo.metricas.freadaM);
  const x1 = alvo.fimM ?? alvo.vminM; // exclui a zona do artefato da mínima
  let dentro = 0, total = 0;
  for (const p of fis.pontos) {
    if (p.distM < x0 || p.distM > x1) continue;
    total++;
    if (Math.abs(pctRe(p) - alvoPctEm(alvo, p.distM)) <= o.bandaPct) dentro++;
  }
  const fracDentro = total ? dentro / total : 0;
  const seguiuFormato = total > 0 && fracDentro >= o.formatoMinFrac;

  // mínima ainda freando, na régua da melhor — medida CHEGANDO na mínima
  // (na mínima exata a física por GPS zera por definição: dv/ds = 0)
  const freioNaVminRe = freioPertoDaVmin(fis.pontos, fator);
  const minimaFreando = freioNaVminRe >= o.freioVminMinPct;

  // D1: CERTO = 2 de 2 (formato + mínima). O ponto de freada só volta a entrar
  // no gate quando pontoFreadaReprova=true (3 de 3, com a pressão real — A3).
  const certo = (o.pontoFreadaReprova ? freouNaBanda : true) && seguiuFormato && minimaFreando;

  // AVISO do ponto de freada: aparece SEMPRE que ele saiu da banda, mesmo no
  // veredito CERTO (é orientação, não reprovação) — alimenta o letreiro FREOU
  // CEDO/TARDE na faixa de status (rodada 14: saiu da tela do piloto).
  const aviso = !freouNaBanda
    ? (met.freadaM < alvo.metricas.freadaM ? 'FREOU CEDO' : 'FREOU TARDE')
    : null;

  let erro = null;
  if (!certo) {
    // "soltou de uma vez" é RELATIVO ao trail da melhor deste trecho: soltura
    // medida menor que 15% do comprimento da freada dela (a física por GPS
    // espalha um degrau seco por ~2 passos de amostra — limiar fixo não serve)
    const degrauVsMelhor = alvo.metricas.forma === 'progressiva'
      && (met.forma === 'degrau'
          || met.solturaM < 0.15 * Math.max(1, alvo.vminM - alvo.metricas.freadaM));
    // no 3 de 3 o ponto de freada reprova primeiro; no 2 de 2 o motivo é
    // sempre formato ou mínima (o ponto de freada já saiu no .aviso)
    if (o.pontoFreadaReprova && !freouNaBanda) erro = aviso;
    else if (degrauVsMelhor) erro = 'SOLTOU DE UMA VEZ';
    else if (!seguiuFormato) erro = 'FORA DO FORMATO';
    else erro = 'SOLTOU ANTES DA MINIMA';
  }
  return {
    certo, erro, aviso, fonteFreio,
    condicoes: { freouNaBanda, seguiuFormato, minimaFreando, fracDentro },
    metricas: met,
  };
}

// ── Motor (máquina de estados da volta, evento + GPS) ─────────

export class TrailCockpitMotor {
  /**
   * @param {Object} o
   * @param {Array}  o.segments — trechos NA ORDEM da volta ({id,nome,ordem,entradaLine,saidaLine})
   * @param {Map}    o.refs — melhores passagens (segId → ref com .pontos)
   * @param {Object} o.storage — localStorage-like (injetável pra teste)
   * @param {Object} o.opts — sobrescreve TRAIL_DEFAULTS
   */
  constructor({ segments, refs, storage = null, opts = {}, origemSimulador = null } = {}) {
    this.o = { ...TRAIL_DEFAULTS, ...opts };
    this._segs = Array.isArray(segments) ? segments.slice() : [];
    this._storage = storage;
    // par da blindagem __P1_ORIGEM_SIM__ (mesmo padrão do LiveDataBridge):
    // replay/simulador NUNCA ensina a reação nem grava no armazenamento
    this._origemSimulador = (typeof origemSimulador === 'function') ? origemSimulador : () => false;
    this._alvos = new Map();
    this._refsKmh = new Map();
    for (const seg of this._segs) {
      const ref = refs?.get ? refs.get(seg.id) : null;
      const alvo = ref?.pontos ? construirAlvoTrecho(ref.pontos) : null;
      this._alvos.set(seg.id, alvo);
    }
    // próximo trecho de cada trecho (mesma régua da coreografia: saída i → entrada i+1)
    this._proximoDe = new Map();
    for (let i = 0; i < this._segs.length; i++) {
      this._proximoDe.set(this._segs[i].id, this._segs[(i + 1) % this._segs.length]);
    }

    // trilho POR VOLTA (rodada 19): célula preenche quando o trecho é passado
    // NA VOLTA EM CURSO; tudo limpa na virada da volta — trecho à frente fica
    // livre ("é só dali para trás que a gente olha, no máximo uma volta atrás")
    this._celulasVolta = new Map(); // segId → 'certo'|'errado' (volta atual)
    this._voltaAtual = null;
    this._passagens = new Map(); // segId → n passagens fechadas (calibração)
    this._segAtualId = null;     // dentro de qual trecho estou (entrada→saída)

    // reação zero→pé aprendida (por trecho), com persistência local
    this._reacao = this._carregarReacao();

    // amostras do sensor de freio (T4000) bufferizadas pra fusão por tempo (A3).
    this._amostrasFreio = [];
    this._nAmostrasFreio = 0;
    // A3: fonte atual do freio — 'simulado-fisica' (GPS) até o sensor variar de
    // verdade; vira 'sensor-pressao'/'sensor-pedal' quando o canal está vivo.
    this._fonteFreioUlt = 'simulado-fisica';

    // estado da janela de frenagem em curso
    this._resetJanela();
    this._fase = 'fora'; // fora | veredito | aproxima | freia | pos-freada

    this._onRender = null;
    this._onEfeito = null;
  }

  onRender(cb) { this._onRender = cb; }
  onEfeito(cb) { this._onEfeito = cb; }

  _resetJanela() {
    this._alvoSeg = null;        // trecho-alvo da aproximação/freada
    this._alvo = null;
    this._entrouNoAlvo = false;
    this._distDesdeEntradaM = 0;
    this._zeroT = null;          // timestamp do disparo do zero
    this._pisouT = null;
    this._pisou = false;
    this._traco = [];            // [{xM, pct, ok}]
    this._foraDaBanda = false;
    this._foraSeq = 0;           // pontos seguidos fora da banda (anti falso-positivo)
    this._ultimoDesvio = null;   // sinal da última medição (aperta/solta)
    this._puloEntrada = false;
    this._velMsUlt = null;
    this._distAoPontoM = null;
    this._gpsAnt = null;
    this._bufFis = [];           // últimos pontos {distAccM, kmh, t} pra física ao vivo
    this._aRaw = [];             // derivadas centradas recentes (média móvel de 3)
    this._distAccM = 0;
    this._apex = { entrada: null, freio: null, apice: null, saida: null };
    this._nivelLuz = 0;
    this._contagem = null;       // {n, modo:'antes'|'depois'|'passou'}
  }

  // ── Reação aprendida ─────────────────────────────────────────
  _carregarReacao() {
    try {
      const raw = this._storage?.getItem?.(LS_REACAO);
      if (raw) { const d = JSON.parse(raw); if (d && typeof d === 'object') return new Map(Object.entries(d)); }
    } catch {}
    return new Map();
  }
  _salvarReacao() {
    if (this._origemSimulador()) return; // replay não grava nada, nunca
    try { this._storage?.setItem?.(LS_REACAO, JSON.stringify(Object.fromEntries(this._reacao))); } catch {}
  }
  /** Tempo de reação (s) usado pro zero adiantado deste trecho. */
  reacaoS(segId) {
    const r = this._reacao.get(segId);
    return Number.isFinite(r?.reacaoS) ? r.reacaoS : this.o.reacaoDefaultS;
  }
  /** Amostra zero→pé medida; aprende por EMA. Pisar ANTES do zero não vira amostra. */
  registrarAmostraReacao(segId, amostraS) {
    if (this._origemSimulador()) return null; // reação de simulador não é reação
    if (!Number.isFinite(amostraS) || amostraS <= 0 || amostraS > this.o.reacaoAmostraMaxS) return null;
    const clamp = Math.min(this.o.reacaoMaxS, Math.max(this.o.reacaoMinS, amostraS));
    const cur = this._reacao.get(segId);
    const novo = cur && Number.isFinite(cur.reacaoS)
      ? { reacaoS: cur.reacaoS + this.o.reacaoAlpha * (clamp - cur.reacaoS), n: (cur.n ?? 0) + 1 }
      : { reacaoS: clamp, n: 1 };
    this._reacao.set(segId, novo);
    this._salvarReacao();
    return novo;
  }

  // ── Amostras do sensor de freio (T4000) — transporte A2 ──────
  /**
   * Recebe uma amostra do sensor de freio (T4000), bufferizada por tempo (tMono)
   * pra fusão em A3. A2 só TRANSPORTA — não muda a fonte do veredito nem da
   * pintura (proxy GPS segue até a fusão real ligar em A3). Amostra sem nenhum
   * canal de freio finito é ignorada. Devolve a contagem total (prova de
   * transporte) ou null se foi ignorada.
   */
  amostraFreio(s) {
    if (!s || !Number.isFinite(s.t)) return null;
    const temFreio = Number.isFinite(s.pressaoFreioBar) || Number.isFinite(s.pedalFreioPct);
    if (!temFreio) return null;
    const a = { t: s.t };
    if (Number.isFinite(s.pressaoFreioBar)) a.pressaoFreioBar = s.pressaoFreioBar;
    if (Number.isFinite(s.pedalFreioPct)) a.pedalFreioPct = s.pedalFreioPct;
    if (Number.isFinite(s.pedalAceleradorPct)) a.pedalAceleradorPct = s.pedalAceleradorPct;
    this._amostrasFreio.push(a);
    this._nAmostrasFreio++;
    const corte = s.t - AMOSTRAS_FREIO_JANELA_MS; // janela rolante (memória limitada)
    while (this._amostrasFreio.length && this._amostrasFreio[0].t < corte) this._amostrasFreio.shift();
    this._reavaliarFonteFreio(); // A3: acende sozinho quando o sensor começa a variar
    return this._nAmostrasFreio;
  }
  /** Amostras de freio bufferizadas dentro de [t0, t1] (com margem pra fusão A3). */
  amostrasFreioNaJanela(t0, t1, margemMs = 300) {
    return this._amostrasFreio.filter(s => s.t >= t0 - margemMs && s.t <= t1 + margemMs);
  }
  /** Total de amostras de freio recebidas (prova do transporte A2). */
  contagemAmostrasFreio() { return this._nAmostrasFreio; }
  /** Fonte do freio em uso agora (A3) — pro rótulo de honestidade na tela. */
  fonteFreio() { return this._fonteFreioUlt; }

  // A3: presença do sensor detectada no buffer rolante; muda a fonte e avisa a
  // tela (efeito 'fonte-freio') só quando troca de estado. Regra dura: canal
  // chegando 0/chapado NÃO é sensor (detectarPresencaSensorFreio cuida disso).
  _reavaliarFonteFreio() {
    const f = detectarPresencaSensorFreio(this._amostrasFreio) ?? 'simulado-fisica';
    if (f !== this._fonteFreioUlt) {
      this._fonteFreioUlt = f;
      this._efeito({ tipo: 'fonte-freio', fonteFreio: f });
    }
  }
  /** Amostras de freio na janela de tempo de uma passagem (pra fusão do veredito). */
  _amostrasFreioDaPassagem(pontos) {
    const ts = pontos.map(p => p.t).filter(Number.isFinite);
    if (!ts.length || !this._amostrasFreio.length) return null;
    return this.amostrasFreioNaJanela(Math.min(...ts), Math.max(...ts));
  }

  /**
   * Nova melhor passagem do trecho (evento passagem-salva do painel): o alvo
   * passa a ser ELA — é assim que a régua nasce no dia de pista (as voltas de
   * calibração, densas, viram referência). Alvo só troca se o novo for válido.
   */
  atualizarReferencia(segId, refPontos) {
    const novo = construirAlvoTrecho(refPontos);
    if (novo) this._alvos.set(segId, novo);
    return novo;
  }

  // ── Consultas ────────────────────────────────────────────────
  alvoDoTrecho(segId) { return this._alvos.get(segId) ?? null; }
  passagensDoTrecho(segId) { return this._passagens.get(segId) ?? 0; }
  /**
   * Calibrando = SEM referência digna, só isso (rodada 20): a base nasce na
   * PRIMEIRA volta com a configuração e fica guardada — sessão nova com base
   * existente arma direto, sem esperar volta nenhuma.
   */
  calibrando(segId) {
    return !this._alvos.get(segId);
  }
  trilho() {
    return this._segs.map(seg => ({
      segId: seg.id,
      rotulo: rotuloTrilho(seg.nome),
      celulas: this._celulasVolta.has(seg.id) ? [this._celulasVolta.get(seg.id)] : [],
      calibrando: this.calibrando(seg.id),
      atual: seg.id === this._segAtualId,
    }));
  }

  /** Virada de volta (linha de chegada): o trilho da volta nova nasce limpo. */
  setVoltaAtual(n) {
    if (n === this._voltaAtual) return;
    this._voltaAtual = n;
    this._celulasVolta.clear();
    this._render();
  }

  // ── Eventos do detector/bridge ───────────────────────────────
  evento(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'entrada-cruzou') {
      this._segAtualId = ev.segmentId;
      // reta curta/GPS ralo: a entrada chegou antes da metade da reta — arma já
      if (this._proxArmado && ev.segmentId === this._proxArmado.id) this._iniciaAproximacao();
      // entrei no trecho-alvo da aproximação: o eixo X passa a ser o caminho
      // rodado desde a linha de entrada (mesma régua dos pontos da melhor)
      if (this._alvoSeg && ev.segmentId === this._alvoSeg.id) {
        this._entrouNoAlvo = true;
        this._distDesdeEntradaM = 0;
        this._puloEntrada = true; // o passo de GPS que cruzou a linha não conta duas vezes
        const alvo = this._alvo;
        if (alvo && Number.isFinite(ev.kmh)) {
          const okE = alvo.entradaKmh == null || ev.kmh >= alvo.entradaKmh - this.o.velTolKmh;
          this._apex.entrada = { valor: String(Math.round(ev.kmh)), estado: okE ? 'ok-melhor' : 'ok-pior' };
        }
      } else if (this._fase !== 'fora') {
        // entrou em OUTRO trecho com janela aberta (veredito antigo, aproximação
        // órfã por desvio/box/resync): abandona a janela — painel padrão volta
        this._resetJanela();
        this._fase = 'fora';
      }
      this._render();
      return;
    }
    if (ev.type === 'freada-iniciou') {
      // sinal de reserva (−0,5 g do detector) caso a física ao vivo ainda não
      // tenha visto o pé; também preenche o .apex FREIO (m desde a entrada)
      if (this._alvoSeg && ev.segmentId === this._alvoSeg.id) {
        if (!this._pisou) this._marcaPisou(ev.t ?? null);
        if (Number.isFinite(ev.distFromEntradaM) && this._alvo) {
          const dif = ev.distFromEntradaM - this._alvo.metricas.freadaM;
          this._apex.freio = {
            valor: `${Math.round(ev.distFromEntradaM)} m`,
            estado: Math.abs(dif) <= this.o.tolFreadaM ? 'ok-melhor' : 'ok-pior',
          };
        }
        this._render();
      }
      return;
    }
    if (ev.type === 'apice-cruzou') {
      if (this._alvoSeg && ev.segmentId === this._alvoSeg.id && this._alvo) {
        const ult = this._traco.length ? this._traco[this._traco.length - 1].pct : 0;
        const alvoPct = this._alvo.freioPertoVminPct;
        this._apex.apice = {
          valor: `${Math.round(ult)}%`,
          estado: Math.abs(ult - alvoPct) <= this.o.apiceTolPct ? 'ok-melhor' : 'ok-pior',
        };
        // NÃO encerra a pintura aqui: trail residual segue freando além do
        // ápice — quem fecha a janela é o fim do alvo (xM > fimM)
        this._render();
      }
      return;
    }
    if (ev.type === 'saida-cruzou') {
      if (this._segAtualId === ev.segmentId) this._segAtualId = null;
      const alvo = this._alvos.get(ev.segmentId);
      if (alvo && Number.isFinite(ev.kmh) && this._alvoSeg && ev.segmentId === this._alvoSeg.id) {
        const okS = alvo.saidaKmh == null || ev.kmh >= alvo.saidaKmh - this.o.velTolKmh;
        this._apex.saida = { valor: String(Math.round(ev.kmh)), estado: okS ? 'ok-melhor' : 'ok-pior' };
      }
      // pós-trecho: veredito na tela (gráfico pintado fica), marcha volta;
      // contagem/luzes que sobraram de uma aproximação sem pisada saem juntas
      if (this._alvoSeg && ev.segmentId === this._alvoSeg.id) {
        this._fase = 'veredito';
        this._contagem = null;
        this._nivelLuz = 0;
        this._efeito({ tipo: 'pos-trecho', segmentId: ev.segmentId });
      }
      // referência da reta que começa aqui (régua do veredito→painel e da
      // virada na metade) + arma a aproximação do PRÓXIMO trecho com alvo
      const prox = this._proximoDe.get(ev.segmentId) ?? null;
      this._proxArmado = (prox && this._alvos.get(prox.id) && !this.calibrando(prox.id)) ? prox : null;
      this._retaDe = null;
      const segSaida = this._segs.find(s => s.id === ev.segmentId);
      if (prox && segSaida?.saidaLine) {
        this._retaDe = centroLinha(segSaida.saidaLine);
        this._retaCompM = distM(this._retaDe, centroLinha(prox.entradaLine));
      }
      this._render();
      return;
    }
    if (ev.type === 'passagem-fechada') {
      // passagem rala não conta calibração nem vira célula: sem dado, sem juízo
      const densa = Array.isArray(ev.pontos) && ev.pontos.length >= 15;
      if (densa) this._passagens.set(ev.segmentId, (this._passagens.get(ev.segmentId) ?? 0) + 1);
      const alvo = this._alvos.get(ev.segmentId);
      if (alvo && densa) {
        // A3: funde a pressão real do sensor (na janela de tempo da passagem)
        // quando houver; senão, computarVeredito cai pra física do GPS
        const amostras = this._amostrasFreioDaPassagem(ev.pontos);
        const v = computarVeredito(ev.pontos, alvo, this.o, amostras);
        if (v && v.erro !== 'SEM DADO') {
          this._celulasVolta.set(ev.segmentId, v.certo ? 'certo' : 'errado');
          this._efeito({ tipo: 'veredito', segmentId: ev.segmentId, veredito: v });
        }
      }
      this._render();
      return;
    }
  }

  // ── GPS ao vivo ──────────────────────────────────────────────
  gps(p) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    const t = Number.isFinite(p.t) ? p.t : null;
    const kmh = Number.isFinite(p.kmh) ? p.kmh : null;

    // distância rodada (caminho real, não linha reta até um marco)
    if (this._gpsAnt) {
      const ds = distM(this._gpsAnt, p);
      if (ds > 0 && ds < 80) { // salto >80 m entre amostras = ruído/teleporte
        this._distAccM += ds;
        if (this._entrouNoAlvo) {
          // o passo que CONTÉM o cruzamento da linha não soma inteiro: a régua
          // do alvo começa NA linha, não na amostra anterior a ela
          if (this._puloEntrada) this._puloEntrada = false;
          else this._distDesdeEntradaM += ds;
        }
      }
    }
    this._gpsAnt = { lat: p.lat, lng: p.lng };
    if (kmh != null) this._velMsUlt = kmh / 3.6;
    if (kmh != null && t != null) {
      this._bufFis.push({ distAccM: this._distAccM, kmh, t });
      while (this._bufFis.length > 5) this._bufFis.shift();
    }

    // régua da reta atual (saída do trecho anterior → entrada do próximo)
    const progReta = (this._retaDe && this._retaCompM > 0)
      ? distM(this._retaDe, p) / this._retaCompM : null;

    // veredito tem FIM: a 40% da reta o painel padrão volta (delta gigante) —
    // o gráfico pintado não fica a volta inteira na tela
    if (this._fase === 'veredito' && progReta != null && progReta >= 0.4) this._fase = 'fora';

    // virada → aproxima na METADE da reta (coreografia canônica: metade da
    // reta = "como fazer"; rodada 12: gráfico nunca sobreposto)
    if (this._proxArmado && this._fase !== 'aproxima' && this._fase !== 'freia'
        && progReta != null && progReta >= 0.5) {
      this._iniciaAproximacao();
    }

    if (this._fase === 'aproxima' || this._fase === 'freia') this._tickJanela(p, kmh, t);
    this._render();
  }

  _iniciaAproximacao() {
    const prox = this._proxArmado;
    this._proxArmado = null;
    this._resetJanela();
    this._alvoSeg = prox;
    this._alvo = this._alvos.get(prox.id);
    this._fase = 'aproxima';
    // previsão do adianto pro desenho da linha tracejada do zero (reação ×
    // velocidade da melhor chegando na freada) — o disparo real usa a vel atual
    const kmhRef = this._alvo?.curva?.find(p => p.distM >= this._alvo.metricas.freadaM)?.kmh;
    this._adiantoPrevM = this.reacaoS(prox.id) * ((Number.isFinite(kmhRef) ? kmhRef : 100) / 3.6);
    this._efeito({ tipo: 'aproximacao', segmentId: prox.id, adiantoPrevM: this._adiantoPrevM });
  }

  _tickJanela(p, kmh, t) {
    const alvo = this._alvo;
    if (!alvo) return;

    // distância até o ponto de freada da melhor (régua: linha de entrada)
    let distAoPonto;
    if (this._entrouNoAlvo) {
      distAoPonto = alvo.metricas.freadaM - this._distDesdeEntradaM;
    } else {
      distAoPonto = distM(p, centroLinha(this._alvoSeg.entradaLine)) + alvo.metricas.freadaM;
    }
    this._distAoPontoM = distAoPonto;

    // amostra sem velocidade não zera o adianto: usa a última válida
    const velMs = kmh != null ? kmh / 3.6 : (this._velMsUlt ?? 0);
    const adiantoM = this.reacaoS(this._alvoSeg.id) * velMs;
    const distZ = distAoPonto - adiantoM;
    this._nivelLuz = this._pisou ? 0 : nivelLuzFreio(distZ, this.o.thrLuzM);

    // zero adiantado: dispara UMA vez, no cruzamento — MESMO se já pisou
    // (freou cedo): a coluna de luz no ponto REAL é a marca pedagógica de
    // onde era o certo (mockup VIVO dispara igual). Não vira amostra de
    // reação: a pisada já aconteceu com o zero ainda nulo.
    if (this._zeroT == null && distZ <= 0) {
      this._zeroT = t;
      this._efeito({
        tipo: 'zero', segmentId: this._alvoSeg.id, adiantoM,
        reacaoS: this.reacaoS(this._alvoSeg.id), jaPisou: this._pisou,
      });
    }

    // contagem: antes do zero conta pra baixo; depois conta pra cima (branca)
    // e vira vermelha quando passa do ponto REAL (rodada 10); some quando pisa
    if (this._pisou) {
      this._contagem = null;
    } else if (distZ > 0) {
      this._contagem = { n: Math.ceil(distZ), modo: 'antes' };
    } else {
      const depois = -distZ;
      this._contagem = {
        n: Math.floor(depois),
        modo: depois <= adiantoM + this.o.contagemPassouM ? 'depois' : 'passou',
      };
    }

    // física ao vivo na régua da MELHOR: desaceleração medida ÷ pico da melhor
    const med = this._medirFreioAoVivo(alvo.picoDesacelMs2);
    const xAgora = this._entrouNoAlvo
      ? this._distDesdeEntradaM
      : alvo.metricas.freadaM - distAoPonto; // antes da linha: x negativo (freou cedo)
    if (!this._pisou && med.rapidoPct >= this.o.limiarPisouPct) {
      // o gatilho rápido é centrado 1 amostra atrás — o instante e a posição
      // do pé são os da amostra central, não os da detecção (senão a reação
      // aprendida ganha viés sistemático de atraso)
      const central = this._bufFis[this._bufFis.length - 2];
      const dsAtras = central ? (this._distAccM - central.distAccM) : 0;
      this._marcaPisou(central?.t ?? t, xAgora - dsAtras);
    }

    if (this._pisou) {
      // a medição suave é CENTRADA atrás do carro — pinta no x correspondente,
      // senão o traço compara o freio de uma posição com o alvo de outra
      const xM = xAgora - med.lagM;
      const pct = med.suavePct;
      const desvio = pct - alvoPctEm(alvo, xM); // <0 = freio de menos · >0 = de mais
      const ok = Math.abs(desvio) <= this.o.bandaPct;
      this._ultimoDesvio = desvio;
      this._traco.push({ xM, pct, ok });
      // pisca só com 3 pontos seguidos fora (transições de janela não são erro)
      this._foraSeq = ok ? 0 : this._foraSeq + 1;
      if (!ok && !this._foraDaBanda && this._foraSeq >= 3) {
        this._foraDaBanda = true;
        this._efeito({ tipo: 'fora-da-banda' });
      }
      if (ok && this._foraDaBanda) { this._foraDaBanda = false; this._efeito({ tipo: 'voltou-pra-banda' }); }
      if (this._fase === 'freia' && xM > (alvo.fimM ?? alvo.vminM)) this._fase = 'pos-freada';
    }
  }

  _marcaPisou(t, xPisadaM = null) {
    this._pisou = true;
    this._pisouT = t;
    this._fase = 'freia';
    this._contagem = null;
    this._nivelLuz = 0;
    // FREIO da régua: também pela física (freada suave não dispara o evento
    // de −0,5 g do detector e a régua ficava em traço)
    if (!this._apex.freio && Number.isFinite(xPisadaM) && this._alvo) {
      const dif = xPisadaM - this._alvo.metricas.freadaM;
      this._apex.freio = {
        valor: `${Math.round(xPisadaM)} m`,
        estado: Math.abs(dif) <= this.o.tolFreadaM ? 'ok-melhor' : 'ok-pior',
      };
    }
    if (this._zeroT != null && t != null && t > this._zeroT) {
      const amostra = (t - this._zeroT) / 1000;
      const aprendeu = this.registrarAmostraReacao(this._alvoSeg.id, amostra);
      this._efeito({ tipo: 'pisou', amostraReacaoS: amostra, aprendeu });
    } else {
      // pisou antes do zero (freou cedo) — reação não vira amostra (rodada 10)
      this._efeito({ tipo: 'pisou', amostraReacaoS: null, aprendeu: null });
    }
  }

  /**
   * Desaceleração ao vivo (v²=v₀²+2aΔs) na régua da melhor — MESMO pipeline
   * da curva-alvo (derivada centrada em ±1 amostra + média móvel de 3), pra
   * um piloto seguindo a melhor pintar VERDE de verdade. Duas medidas:
   *   rapidoPct — derivada centrada mais recente (gatilho do PISOU);
   *   suavePct  — média móvel de 3 derivadas centradas (pintura);
   *   lagM      — quanto a medida suave está centrada ATRÁS da posição atual.
   */
  _medirFreioAoVivo(picoRefMs2) {
    const b = this._bufFis;
    if (b.length < 3 || !(picoRefMs2 > 0)) return { rapidoPct: 0, suavePct: 0, lagM: 0 };
    // derivada centrada no penúltimo ponto, sobre [antepenúltimo, último]
    const p0 = b[b.length - 3], pc = b[b.length - 2], p1 = b[b.length - 1];
    const ds = p1.distAccM - p0.distAccM;
    if (ds > 0.5) {
      const v1 = p0.kmh / 3.6, v2 = p1.kmh / 3.6;
      const a = (v2 * v2 - v1 * v1) / (2 * ds);
      const ult = this._aRaw[this._aRaw.length - 1];
      if (!ult || ult.distAccM !== pc.distAccM) {
        this._aRaw.push({ a, distAccM: pc.distAccM });
        while (this._aRaw.length > 3) this._aRaw.shift();
      }
    }
    if (!this._aRaw.length) return { rapidoPct: 0, suavePct: 0, lagM: 0 };
    // mesmo gate de ruído GPS do freio-trecho.js (0,35 m/s²)
    const pct = (a) => (a == null || a >= -0.35) ? 0 : Math.min(100, (-a / picoRefMs2) * 100);
    const fim = b[b.length - 1];
    const aRapido = this._aRaw[this._aRaw.length - 1];
    const aSuave = this._aRaw.reduce((s, e) => s + e.a, 0) / this._aRaw.length;
    const centro = this._aRaw[Math.floor((this._aRaw.length - 1) / 2)];
    return { rapidoPct: pct(aRapido.a), suavePct: pct(aSuave), lagM: fim.distAccM - centro.distAccM };
  }

  // ── Snapshot pro desenho ─────────────────────────────────────
  snapshot() {
    // freando: a tela inteira responde — verde piscando na margem, vermelha
    // fora; e o indicador manda a correção (rodada 19)
    const freando = this._fase === 'freia' && this._pisou && this._traco.length > 0;
    return {
      fase: this._fase,
      segAlvoId: this._alvoSeg?.id ?? null,
      alvo: this._alvo,
      contagem: this._contagem,
      nivelLuz: this._nivelLuz,
      traco: this._traco,
      foraDaBanda: this._foraDaBanda,
      bandaEstado: freando ? (this._foraDaBanda ? 'fora' : 'dentro') : null,
      freioCorrecao: (freando && this._foraDaBanda && Number.isFinite(this._ultimoDesvio))
        ? (this._ultimoDesvio < 0 ? 'aperta' : 'solta') : null,
      apex: this._apex,
      trilho: this.trilho(),
      distAoPontoM: this._distAoPontoM ?? null,
      adiantoPrevM: this._adiantoPrevM ?? null,
      fonteFreio: this._fonteFreioUlt, // A3: 'simulado-fisica' | 'sensor-pressao' | 'sensor-pedal'
    };
  }

  _render() { if (this._onRender) { try { this._onRender(this.snapshot()); } catch {} } }
  _efeito(e) { if (this._onEfeito) { try { this._onEfeito(e); } catch {} } }
}
