// tolerance-from-dyno — calcula tolerance_rpm automática baseada na janela
// útil da curva (RPMs onde potência ≥ 95% do pico).
//
// tolerance_rpm = janela_util_largura × (percent / 100), clamp [80, 250].

const PEAK_THRESHOLD_PCT = 0.95;
const TOL_MIN = 80;
const TOL_MAX = 250;

export function computeTolerance(curve, percent = 5) {
  if (!Array.isArray(curve) || curve.length < 3) {
    throw new Error('curva inválida (mínimo 3 pontos)');
  }
  const sorted = curve.slice().sort((a, b) => a.rpm - b.rpm);
  let peakP = -Infinity;
  for (const p of sorted) if (Number.isFinite(p.power_kw) && p.power_kw > peakP) peakP = p.power_kw;
  if (!Number.isFinite(peakP) || peakP <= 0) {
    return TOL_MIN;
  }
  const thr = peakP * PEAK_THRESHOLD_PCT;
  const inside = sorted.filter(p => Number.isFinite(p.power_kw) && p.power_kw >= thr);
  if (inside.length < 2) {
    // Janela útil indeterminada — devolve o mínimo
    return TOL_MIN;
  }
  const lo = inside[0].rpm;
  const hi = inside[inside.length - 1].rpm;
  const window = Math.max(0, hi - lo);
  const tol = Math.round(window * (percent / 100));
  return Math.max(TOL_MIN, Math.min(TOL_MAX, tol));
}
