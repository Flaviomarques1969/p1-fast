// ═══════════════════════════════════════════════════════════
// path-mapper (Deno port) — geometria sobre o pistaPath
// ═══════════════════════════════════════════════════════════
// Transcrição direta de src/telemetry/path-mapper.js. Sem mudança
// de algoritmo: parse SVG (M/L/Z), pré-amostra em N pontos
// equidistantes, snap O(N) com janela incremental.
//
// Saída do snap:
//   { offset, dist, x, y } — offset = comprimento acumulado até o
//   ponto mais próximo no path; dist = euclidiana ao path.

export interface Point {
  x: number;
  y: number;
}

interface LookupPoint {
  x: number;
  y: number;
  offset: number;
}

export interface PathLookup {
  points: LookupPoint[];
  totalLength: number;
  /** índice usado pela busca incremental — set após cada snap. */
  _lastIdx?: number;
}

/** Parse simplificado de path d="M x y L x y L x y ... Z". */
export function parsePath(d: string): Point[] {
  const tokens = d.match(/[MLZ][^MLZ]*/gi) || [];
  const pts: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  for (const t of tokens) {
    const cmd = t[0].toUpperCase();
    const nums = t.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        cur = { x: nums[i], y: nums[i + 1] };
        pts.push(cur);
      }
    } else if (cmd === "Z") {
      if (pts.length) pts.push({ ...pts[0] });
    }
  }
  return pts;
}

export function pathLength(pts: Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

export function buildLookup(d: string, samples = 2000): PathLookup {
  const pts = parsePath(d);
  const totalLen = pathLength(pts);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const step = totalLen / samples;
  const out: LookupPoint[] = [];
  let vi = 0;
  for (let s = 0; s <= samples; s++) {
    const targetLen = s * step;
    while (vi < cum.length - 1 && cum[vi + 1] < targetLen) vi++;
    const segStart = cum[vi];
    const segEnd = cum[vi + 1] ?? segStart;
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetLen - segStart) / segLen : 0;
    const p0 = pts[vi];
    const p1 = pts[vi + 1] ?? p0;
    out.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      offset: targetLen,
    });
  }
  return { points: out, totalLength: totalLen };
}

const SNAP_WINDOW = 60;
const SNAP_GOOD_DIST = 30;

export interface SnapResult {
  offset: number;
  dist: number;
  x: number;
  y: number;
}

export function snap(lookup: PathLookup, x: number, y: number): SnapResult {
  const pts = lookup.points;
  const n = pts.length;
  if (typeof lookup._lastIdx === "number") {
    const start = Math.max(0, lookup._lastIdx - SNAP_WINDOW);
    const end = Math.min(n, lookup._lastIdx + SNAP_WINDOW);
    let best: { d2: number; offset: number; x: number; y: number; idx: number } | null = null;
    for (let i = start; i < end; i++) {
      const p = pts[i];
      const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (best === null || d2 < best.d2) {
        best = { d2, offset: p.offset, x: p.x, y: p.y, idx: i };
      }
    }
    if (best && Math.sqrt(best.d2) < SNAP_GOOD_DIST) {
      lookup._lastIdx = best.idx;
      return { offset: best.offset, dist: Math.sqrt(best.d2), x: best.x, y: best.y };
    }
  }
  let best: { d2: number; offset: number; x: number; y: number; idx: number } | null = null;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (best === null || d2 < best.d2) {
      best = { d2, offset: p.offset, x: p.x, y: p.y, idx: i };
    }
  }
  lookup._lastIdx = best!.idx;
  return { offset: best!.offset, dist: Math.sqrt(best!.d2), x: best!.x, y: best!.y };
}

/** Intersecção de segmentos AB × CD — orient test. */
export function segmentsIntersect(A: Point, B: Point, C: Point, D: Point): boolean {
  function ccw(P: Point, Q: Point, R: Point): boolean {
    return (R.y - P.y) * (Q.x - P.x) > (Q.y - P.y) * (R.x - P.x);
  }
  return (
    ccw(A, C, D) !== ccw(B, C, D) &&
    ccw(A, B, C) !== ccw(A, B, D)
  );
}
