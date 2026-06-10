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

export class OportunidadeTrecho {
  constructor() {
    this._porSegmento = new Map(); // segmentId → { deltas:[], ultimaPassagem, apiceDistM, ref, refComprimentoM }
  }

  _seg(id) {
    if (!this._porSegmento.has(id)) {
      this._porSegmento.set(id, { deltas: [], ultimaPassagem: null, apiceDistM: null, ref: null, refComprimentoM: null });
    }
    return this._porSegmento.get(id);
  }

  setReferencia(segmentId, ref) {
    if (!segmentId || !ref) return;
    const s = this._seg(segmentId);
    s.ref = ref;
    const pontos = ref.pontos || ref.pontos_json || null;
    s.refComprimentoM = Array.isArray(pontos) && pontos.length > 1 ? comprimentoM(pontos) : null;
  }

  registrarDelta(resultado) {
    if (!resultado || !resultado.segmentId) return;
    const s = this._seg(resultado.segmentId);
    s.deltas.push(resultado);
    while (s.deltas.length > JANELA_PASSAGENS) s.deltas.shift();
  }

  registrarPassagem({ segmentId, pontos }) {
    if (!segmentId || !Array.isArray(pontos)) return;
    this._seg(segmentId).ultimaPassagem = pontos;
  }

  registrarApice(ev) {
    if (!ev || !ev.segmentId) return;
    if (typeof ev.distFromIdealM === 'number') this._seg(ev.segmentId).apiceDistM = ev.distFromIdealM;
  }

  /** Pior componente médio das últimas passagens. */
  _piorComponente(s) {
    const acum = {}; // sub → { soma, n }
    for (const d of s.deltas) {
      const por = d.porSubTrecho || {};
      for (const sub of Object.keys(por)) {
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

  getOrientacao(segmentId) {
    const s = this._porSegmento.get(segmentId);
    if (!s || s.deltas.length < MIN_PASSAGENS) return null;
    const pior = this._piorComponente(s);
    if (!pior) return null;

    const refPontos = s.ref && (s.ref.pontos || s.ref.pontos_json) || null;
    const compM = s.refComprimentoM;

    if (pior.sub === 'freio' || pior.sub === 'entrada') {
      const fracVoce = s.ultimaPassagem ? fracaoInicioSub(s.ultimaPassagem, 'freio') : null;
      const fracOuro = refPontos ? fracaoInicioSub(refPontos, 'freio') : null;
      if (fracVoce !== null && fracOuro !== null && compM) {
        const difM = (fracOuro - fracVoce) * compM; // >0: melhor freia DEPOIS de você
        if (Math.abs(difM) <= LIMIAR_MESMO_PONTO_M) {
          return { disciplina: 'FREIO', verbo: 'FREIA', destaque: 'MENOS',
                   quanto: null, un: null, grafico: 'freio',
                   voceFrac: fracVoce, ouroFrac: fracVoce,
                   zona: [Math.max(0, fracVoce - 0.05), Math.min(1, fracVoce + 0.2)] };
        }
        const depois = difM > 0;
        return { disciplina: 'FREIO', verbo: 'FREIA', destaque: depois ? 'DEPOIS' : 'ANTES',
                 quanto: `${depois ? '+' : '−'}${Math.round(Math.abs(difM))}`, un: 'm',
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
}
