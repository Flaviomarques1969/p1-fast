// ═══════════════════════════════════════════════════════════
// corredor — Traçado consolidado + corredor de tolerância (C1)
// ═══════════════════════════════════════════════════════════
// Decisão de domínio (2026-04-23): match de SegmentExecution × TrackSegment
// NÃO usa % de sobreposição nem offset médio. Usa:
//   1. Traçado consolidado (média ponderada das últimas M voltas válidas + variância)
//   2. Corredor de tolerância (σ configurável por carro + pista)
//
// Se o sample sai do corredor → desvio/anomalia, NÃO cria novo match.
// Zebras, buracos, sobressaltos verticais NÃO são "suspeitos" — são pista.

const LAPS_CONSOLIDADAS_DEFAULT = 20;
const SIGMA_DEFAULT = 2.0;    // desvios-padrão antes de considerar "fora do corredor"
const MIN_PONTOS = 5;         // mínimo de pontos em uma volta pra contar

/**
 * Calcula traçado consolidado a partir de samples de múltiplas voltas.
 * Assume samples resampleados pelo "t normalizado na volta" (0..1).
 *
 * @param {Array<Array<{tN:number,x:number,y:number}>>} voltasSamples
 * @param {number} resolucao — número de pontos na saída (default 200)
 * @returns {{ pontos: [{tN,x,y,varX,varY,desvPad}], nVoltas }}
 */
export function consolidarTracado(voltasSamples, resolucao = 200) {
  const voltas = (voltasSamples || []).filter(v => v.length >= MIN_PONTOS);
  if (!voltas.length) return { pontos: [], nVoltas: 0 };

  const pontos = [];
  for (let i = 0; i < resolucao; i++) {
    const tN = i / (resolucao - 1);
    let sx = 0, sy = 0, n = 0;
    const xs = [], ys = [];
    for (const volta of voltas) {
      const s = interpolarPorTN(volta, tN);
      if (!s) continue;
      xs.push(s.x); ys.push(s.y);
      sx += s.x; sy += s.y; n++;
    }
    if (!n) continue;
    const mx = sx / n, my = sy / n;
    let vx = 0, vy = 0;
    for (let k = 0; k < xs.length; k++) {
      vx += (xs[k] - mx) ** 2;
      vy += (ys[k] - my) ** 2;
    }
    vx /= n; vy /= n;
    const desvPad = Math.sqrt(vx + vy);
    pontos.push({ tN, x: mx, y: my, varX: vx, varY: vy, desvPad });
  }
  return { pontos, nVoltas: voltas.length };
}

function interpolarPorTN(samples, tN) {
  // assume samples ordenados por t; renormaliza com t[0]=0, t[last]=1
  if (samples.length < 2) return null;
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const total = t1 - t0;
  if (total <= 0) return null;
  const alvoT = t0 + tN * total;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    if (a.t <= alvoT && b.t >= alvoT) {
      const f = (alvoT - a.t) / (b.t - a.t || 1);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tN };
    }
  }
  return samples[samples.length - 1];
}

/**
 * Verifica se um ponto {x,y} no instante tN está DENTRO do corredor
 * do traçado consolidado.
 * @returns {{ dentro:boolean, distancia:number, sigma:number }}
 */
export function dentroCorredor(ponto, consolidado, sigma = SIGMA_DEFAULT) {
  if (!consolidado?.pontos?.length) return { dentro: true, distancia: 0, sigma: 0 };
  const centro = nearestByTN(consolidado.pontos, ponto.tN ?? 0);
  if (!centro) return { dentro: true, distancia: 0, sigma: 0 };
  const dx = ponto.x - centro.x;
  const dy = ponto.y - centro.y;
  const distancia = Math.sqrt(dx * dx + dy * dy);
  const raio = Math.max(5, (centro.desvPad || 1) * sigma);
  return { dentro: distancia <= raio, distancia, sigma, raio };
}

function nearestByTN(pontos, tN) {
  let best = null, bestD = Infinity;
  for (const p of pontos) {
    const d = Math.abs(p.tN - tN);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Match SegmentExecution × TrackSegment.
 * Usa o traçado consolidado + corredor. Se a execução fica majoritariamente
 * dentro do corredor do segmento esperado (baseado no tNaVolta), confirma.
 * Se foge → retorna desvio (NÃO cria novo match — decisão de domínio 2026-04-23).
 */
export function matchSegmento(execSamples, trackSegment, consolidado, opts = {}) {
  const sigma = opts.sigma ?? SIGMA_DEFAULT;
  const pctMinimo = opts.pctMinimo ?? 0.7;
  if (!execSamples?.length || !trackSegment || !consolidado?.pontos?.length) {
    return { match: false, razao: 'inputs-invalidos' };
  }
  let dentro = 0;
  for (const s of execSamples) {
    const r = dentroCorredor(s, consolidado, sigma);
    if (r.dentro) dentro++;
  }
  const pct = dentro / execSamples.length;
  if (pct >= pctMinimo) return { match: true, pct, trechoId: trackSegment.id };
  return { match: false, razao: 'fora-do-corredor', pct };
}

export const CORREDOR_CONFIG = Object.freeze({
  LAPS_CONSOLIDADAS: LAPS_CONSOLIDADAS_DEFAULT,
  SIGMA: SIGMA_DEFAULT,
  MIN_PONTOS,
});
