// oportunidade-trecho.js — motor do "o que fazer no trecho que vem".
//
// Conceito (Flávio, 09/06): sem ranking da volta toda. CADA trecho mostra a
// SUA maior oportunidade quando se aproxima. O sistema DIAGNOSTICA nas
// medições (delta por componente) e PRESCREVE nas 3 ações que existem:
// frear, linha/ápice, acelerar — sempre RELATIVO ao hábito do piloto.
//
// Entrada de dados (por passagem, vindos do bridge):
//   registrarDelta(resultado)      → resultado do delta-calculator
//                                    { segmentId, deltaTotalS, porSubTrecho, piorSubTrecho, piorDeltaS }
//   registrarPassagem({segmentId, pontos})  → pontos canônicos da passagem (fracao, sub, lat, lng)
//   registrarApice(ev)             → evento apice-cruzou { segmentId, distFromIdealM }
//   setReferencia(segmentId, ref)  → melhor passagem histórica (pontos canônicos)
//
// Saída:
//   getOrientacao(segmentId) → null (sem dados ainda — 1ª volta) ou
//     { disciplina, verbo, destaque, quanto, un, voceFrac, ouroFrac, zona }
//   - voceFrac/ouroFrac: posição (0..1 ao longo do trecho) das marcas
//     VERMELHA (onde ele age) e VERDE (onde a melhor age). Iguais = mesmo ponto.
//
// Regras de prescrição (contrato v3 aprovado 09/06):
//   freio pior  + ponto dele ANTES da referência  → FREIA DEPOIS (+X m)
//   freio pior  + ponto dele DEPOIS da referência → FREIA ANTES (−X m)
//   freio pior  + mesmo ponto (<LIMIAR_M)         → FREIA MENOS (pressão; gráfico
//                                                   quando houver sensor de pedal)
//   entrada pior                                  → FREIA DEPOIS (carrega velocidade)
//   ápice pior                                    → FECHA A CURVA (X m, da bolinha)
//   saída pior                                    → ACELERA ANTES (sem número até o
//                                                   PAce virar registro real)

const LIMIAR_MESMO_PONTO_M = 5;   // diferença menor que isso = "mesmo ponto"
const MIN_PASSAGENS = 1;          // orientação só depois de ao menos 1 passagem comparada
const JANELA_PASSAGENS = 2;       // média das últimas N passagens (estabilidade)
const VMIN_BANDA_KMH = 2;         // Vmin abaixo da referência além disso → FREIA MENOS (modo treino)

function distM(a, b) {
  // distância geográfica aproximada em metros (suficiente pra escala de trecho)
  const kLat = 110540;
  const kLng = 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dx = (a.lng - b.lng) * kLng;
  const dy = (a.lat - b.lat) * kLat;
  return Math.hypot(dx, dy);
}

function comprimentoM(pontos) {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distM(pontos[i - 1], pontos[i]);
  return total;
}

/** Fração (0..1) onde começa um sub-trecho na lista de pontos canônicos. */
function fracaoInicioSub(pontos, sub) {
  if (!Array.isArray(pontos)) return null;
  const p = pontos.find(pt => pt && pt.sub === sub);
  return p && Number.isFinite(p.fracao) ? p.fracao : null;
}

/** Menor velocidade finita (km/h) de uma lista de pontos canônicos. */
function vminDosPontos(pontos) {
  if (!Array.isArray(pontos)) return null;
  let min = null;
  for (const p of pontos) {
    if (p && Number.isFinite(p.kmh) && p.kmh > 0 && (min === null || p.kmh < min)) min = p.kmh;
  }
  return min;
}

export class OportunidadeTrecho {
  constructor() {
    this._porSegmento = new Map(); // segmentId → { deltas:[], ultimaPassagem, apiceDistM, ref, refComprimentoM }
    // ── Modo TREINO (Stint Revestido, aprovado 11/06) ───────────
    // foco = { subs:[...], usaVmin, degrauFn } — quando armado, a orientação
    // fala SÓ do componente em treino; foco em dia naquele trecho = null
    // (silêncio é consolidação, não buraco). Sem foco: comportamento idêntico
    // ao contrato v3 de 09/06.
    this._foco = null;
  }

  /** Arma o treino: subs prioritários + comparação de Vmin + degrau digerível. */
  setFoco(foco) {
    this._foco = (foco && Array.isArray(foco.subs) && foco.subs.length) ? foco : null;
  }
  clearFoco() { this._foco = null; }

  _seg(id) {
    if (!this._porSegmento.has(id)) {
      this._porSegmento.set(id, { deltas: [], ultimaPassagem: null, apiceDistM: null, ref: null, refComprimentoM: null, vminKmh: null, refVminKmh: null });
    }
    return this._porSegmento.get(id);
  }

  setReferencia(segmentId, ref) {
    if (!segmentId || !ref) return;
    const s = this._seg(segmentId);
    s.ref = ref;
    const pontos = ref.pontos || ref.pontos_json || null;
    s.refComprimentoM = Array.isArray(pontos) && pontos.length > 1 ? comprimentoM(pontos) : null;
    s.refVminKmh = vminDosPontos(pontos);
  }

  registrarDelta(resultado) {
    if (!resultado || !resultado.segmentId) return;
    const s = this._seg(resultado.segmentId);
    s.deltas.push(resultado);
    while (s.deltas.length > JANELA_PASSAGENS) s.deltas.shift();
  }

  registrarPassagem({ segmentId, pontos, vminKmh }) {
    if (!segmentId || !Array.isArray(pontos)) return;
    const s = this._seg(segmentId);
    s.ultimaPassagem = pontos;
    s.vminKmh = Number.isFinite(vminKmh) ? vminKmh : vminDosPontos(pontos);
  }

  registrarApice(ev) {
    if (!ev || !ev.segmentId) return;
    if (typeof ev.distFromIdealM === 'number') this._seg(ev.segmentId).apiceDistM = ev.distFromIdealM;
  }

  /** Pior componente médio das últimas passagens. Com TREINO armado, só os
   *  componentes do foco contam — foco em dia = null (a tela não aparece). */
  _piorComponente(s) {
    const acum = {}; // sub → { soma, n }
    for (const d of s.deltas) {
      const por = d.porSubTrecho || {};
      for (const sub of Object.keys(por)) {
        if (this._foco && !this._foco.subs.includes(sub)) continue;
        const v = por[sub] && Number.isFinite(por[sub].deltaS) ? por[sub].deltaS : null;
        if (v === null) continue;
        if (!acum[sub]) acum[sub] = { soma: 0, n: 0 };
        acum[sub].soma += v; acum[sub].n += 1;
      }
    }
    let pior = null, piorMedia = 0;
    for (const sub of Object.keys(acum)) {
      const media = acum[sub].soma / acum[sub].n;
      if (media > piorMedia) { piorMedia = media; pior = sub; }
    }
    // delta positivo = mais lento que a referência. Sem componente perdendo → null.
    return pior && piorMedia > 0.03 ? { sub: pior, mediaS: piorMedia } : null;
  }

  /** Vmin abaixo da referência além da banda? (modo treino com usaVmin) */
  _vminAbaixo(s) {
    if (!this._foco || !this._foco.usaVmin) return false;
    return Number.isFinite(s.vminKmh) && Number.isFinite(s.refVminKmh)
      && (s.refVminKmh - s.vminKmh) >= VMIN_BANDA_KMH;
  }

  getOrientacao(segmentId) {
    const s = this._porSegmento.get(segmentId);
    if (!s || s.deltas.length < MIN_PASSAGENS) return null;
    const pior = this._piorComponente(s);
    if (!pior) {
      // Modo treino de Vmin/trail: mesmo sem componente do delta perdendo, a
      // velocidade mínima abaixo da melhor é diagnóstico real → prescrição é
      // FREIA MENOS (verbo aprovado: mesmo ponto, menos pressão). Sem número
      // de velocidade na tela (regra Flávio 09/06: pressão não vira km/h).
      if (this._vminAbaixo(s)) return this._orientacaoFreiaMenos(s);
      return null;
    }

    const refPontos = s.ref && (s.ref.pontos || s.ref.pontos_json) || null;
    const compM = s.refComprimentoM;

    if (pior.sub === 'freio' || pior.sub === 'entrada') {
      // Treino de Vmin/trail: perda no freio COM Vmin abaixo da referência =
      // tirou velocidade demais → FREIA MENOS vence o deslocamento de ponto.
      if (this._vminAbaixo(s)) return this._orientacaoFreiaMenos(s);
      const fracVoce = s.ultimaPassagem ? fracaoInicioSub(s.ultimaPassagem, 'freio') : null;
      const fracOuro = refPontos ? fracaoInicioSub(refPontos, 'freio') : null;
      if (fracVoce !== null && fracOuro !== null && compM) {
        const difM = (fracOuro - fracVoce) * compM; // >0: melhor freia DEPOIS de você
        if (Math.abs(difM) <= LIMIAR_MESMO_PONTO_M) {
          return this._orientacaoFreiaMenos(s, fracVoce);
        }
        // Degrau digerível (decisão Flávio 11/06): o NÚMERO pedido é ~30% do
        // caminho (teto 4 m); as MARCAS continuam nas posições reais.
        const difPedidaM = this._foco?.degrauFn ? this._foco.degrauFn(difM, segmentId) : difM;
        const depois = difM > 0;
        return { disciplina: 'FREIO', verbo: 'FREIA', destaque: depois ? 'DEPOIS' : 'ANTES',
                 quanto: `${depois ? '+' : '−'}${Math.round(Math.abs(difPedidaM))}`, un: 'm',
                 voceFrac: fracVoce, ouroFrac: fracOuro,
                 zona: [Math.max(0, Math.min(fracVoce, fracOuro) - 0.04),
                        Math.min(1, Math.max(fracVoce, fracOuro) + 0.12)] };
      }
      // sem geometria fina → verbo do componente, SEM marcas inventadas (só a zona ambiente)
      return { disciplina: 'FREIO', verbo: 'FREIA', destaque: 'DEPOIS', quanto: null, un: null,
               voceFrac: null, ouroFrac: null, zona: [0.0, 0.3] };
    }

    if (pior.sub === 'apice') {
      const m = s.apiceDistM;
      return { disciplina: 'ÁPICE', verbo: 'FECHA', destaque: 'A CURVA',
               quanto: m && m >= 1 ? `${m.toFixed(m < 3 ? 1 : 0)}` : null, un: m && m >= 1 ? 'm' : null,
               apice: true, voceFrac: null, ouroFrac: null, zona: null };
    }

    // saída lenta → a causa acionável é acelerar antes. SEM marcas até o ponto de
    // aceleração (PAce) virar registro real por passagem (proposição 5) — a tela
    // nunca mostra marca inventada (regra de coerência física, Flávio 09/06).
    return { disciplina: 'ACELERAÇÃO', verbo: 'ACELERA', destaque: 'ANTES',
             quanto: null, un: null,
             voceFrac: null, ouroFrac: null, zona: [0.55, 1.0] };
  }

  /** FREIA MENOS — mesmo ponto, menos pressão. SEM gráfico de pedal: o gráfico
   *  de pressão só existe com sensor de pedal instalado (regra Flávio 09/06 —
   *  o SVG estático anterior furava a regra e foi removido em 11/06). */
  _orientacaoFreiaMenos(s, fracVoceConhecida = null) {
    const fracVoce = fracVoceConhecida != null
      ? fracVoceConhecida
      : (s.ultimaPassagem ? fracaoInicioSub(s.ultimaPassagem, 'freio') : null);
    if (fracVoce != null) {
      return { disciplina: 'FREIO', verbo: 'FREIA', destaque: 'MENOS',
               quanto: null, un: null, grafico: null,
               voceFrac: fracVoce, ouroFrac: fracVoce,
               zona: [Math.max(0, fracVoce - 0.05), Math.min(1, fracVoce + 0.2)] };
    }
    return { disciplina: 'FREIO', verbo: 'FREIA', destaque: 'MENOS',
             quanto: null, un: null, grafico: null,
             voceFrac: null, ouroFrac: null, zona: [0.1, 0.45] };
  }
}
