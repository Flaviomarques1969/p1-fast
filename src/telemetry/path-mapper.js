// ═══════════════════════════════════════════════════════════
// path-mapper — utilitários de geometria sobre o pistaPath
// ═══════════════════════════════════════════════════════════
// Parse de SVG path (apenas M/L/Z — suficiente pro path calibrado Brasília).
// Pré-amostra o path em N pontos igualmente espaçados → snap rápido.
//
// snap(lookup, x, y) → { offset, dist }
//   offset = comprimento acumulado desde o start do path até o ponto mais próximo
//   dist   = distância do ponto GPS ao path
//
// Usado pra:
//   - converter posição → qual setor macro (S1/S2/S3)
//   - converter posição → qual trackSegment
//   - detectar "estou no ponto de frenagem" (offset vs segment.pontoFrenagem)

/** Parse simplificado de path d="M x y L x y L x y ... Z". */
export function parsePath(d) {
  const tokens = d.match(/[MLZ][^MLZ]*/gi) || [];
  const pts = [];
  let cur = { x: 0, y: 0 };
  for (const t of tokens) {
    const cmd = t[0].toUpperCase();
    const nums = t.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i < nums.length; i += 2) {
        cur = { x: nums[i], y: nums[i + 1] };
        pts.push(cur);
      }
    } else if (cmd === 'Z') {
      if (pts.length) pts.push({ ...pts[0] });
    }
  }
  return pts;
}

/** Soma de distâncias entre vértices sequenciais (perímetro). */
export function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

/** Pré-amostra o path em N pontos igualmente espaçados (lookup table). */
export function buildLookup(d, samples = 2000) {
  const pts = parsePath(d);
  const totalLen = pathLength(pts);
  // cumulative length ao longo dos vértices
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  // amostras equidistantes
  const step = totalLen / samples;
  const out = [];
  let vi = 0;
  for (let s = 0; s <= samples; s++) {
    const targetLen = s * step;
    while (vi < cum.length - 1 && cum[vi + 1] < targetLen) vi++;
    const segStart = cum[vi];
    const segEnd = cum[vi + 1] || segStart;
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetLen - segStart) / segLen : 0;
    const p0 = pts[vi];
    const p1 = pts[vi + 1] || p0;
    out.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      offset: targetLen,
    });
  }
  return { points: out, totalLength: totalLen };
}

/**
 * T-032 / A-037: busca incremental.
 * Se `lookup._lastIdx` existir (set no último snap), busca primeiro nos ±W pontos
 * ao redor e, se encontrar match suficientemente bom (dist < threshold),
 * retorna sem varrer o resto. Fallback O(N) permanece pra pontos novos.
 *
 * Reduz ~10x o tempo em streams GPS contíguos (sample N+1 é vizinho de N).
 */
const SNAP_WINDOW = 60;
const SNAP_GOOD_DIST = 30;     // unidades viewBox — se < isso, aceita sem fallback

export function snap(lookup, x, y) {
  const pts = lookup.points;
  const n = pts.length;
  // Busca incremental em volta do último
  if (typeof lookup._lastIdx === 'number') {
    const start = Math.max(0, lookup._lastIdx - SNAP_WINDOW);
    const end = Math.min(n, lookup._lastIdx + SNAP_WINDOW);
    let best = null;
    for (let i = start; i < end; i++) {
      const p = pts[i];
      const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (best === null || d2 < best.d2) best = { d2, offset: p.offset, x: p.x, y: p.y, idx: i };
    }
    if (best && Math.sqrt(best.d2) < SNAP_GOOD_DIST) {
      lookup._lastIdx = best.idx;
      return { offset: best.offset, dist: Math.sqrt(best.d2), x: best.x, y: best.y };
    }
  }
  // Fallback O(N)
  let best = null;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (best === null || d2 < best.d2) best = { d2, offset: p.offset, x: p.x, y: p.y, idx: i };
  }
  lookup._lastIdx = best.idx;
  return { offset: best.offset, dist: Math.sqrt(best.d2), x: best.x, y: best.y };
}

/**
 * Descobre qual parcial (id dinâmico, ex: 'P1') contém um offset do path,
 * olhando o segmento correspondente. Segmentos precisam ter `parcialId`,
 * `pathStart` e `pathEnd` (% do path total).
 *
 * @param {number} offset        em unidades de path
 * @param {number} totalLength   do path
 * @param {Array}  segments      todos os trackSegments do layout
 * @returns {string|null}
 */
export function parcialFromOffset(offset, totalLength, segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const pct = totalLength ? (offset / totalLength) * 100 : 0;
  const hit = segments.find(s =>
    s.pathStart != null && s.pathEnd != null && pct >= s.pathStart && pct < s.pathEnd
  );
  return hit?.parcialId ?? null;
}

/**
 * Verifica se 2 segmentos AB e CD se cruzam.
 * Usado pra detectar cruzamento de linha de chegada.
 */
export function segmentsIntersect(A, B, C, D) {
  function ccw(P, Q, R) {
    return (R.y - P.y) * (Q.x - P.x) > (Q.y - P.y) * (R.x - P.x);
  }
  return (
    ccw(A, C, D) !== ccw(B, C, D) &&
    ccw(A, B, C) !== ccw(A, B, D)
  );
}
