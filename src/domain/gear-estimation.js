// estimateGear — função pura que estima a marcha atual a partir de um sample
// de telemetria, usando assinaturas calibradas do carro (rpm/speed por marcha).
//
// Retorno: { gear, confidence, method, reason }
//   gear:       1..N | null
//   confidence: 0.0..1.0
//   method:     'rpm_speed' | 'rpm_speed_history' | 'rpm_speed_history_accel' | 'fallback'
//   reason:     string | null

const MIN_SPEED_KMH = 5;
const RATIO_TOL_PCT = 0.08;
const HISTORY_WINDOW_MS = 200;
const DECEL_THRESHOLD_M_S2 = -0.5;

export function estimateGear(sample, history = [], carCalibration = {}) {
  const sigs = carCalibration && carCalibration.gear_signatures;
  if (!sigs || Object.keys(sigs).length === 0) {
    return { gear: null, confidence: 0, method: 'fallback', reason: 'no calibration' };
  }
  if (!sample || !Number.isFinite(sample.rpm) || !Number.isFinite(sample.speed)) {
    return { gear: null, confidence: 0, method: 'fallback', reason: 'invalid sample' };
  }
  if (sample.speed < MIN_SPEED_KMH) {
    return { gear: null, confidence: 0, method: 'fallback', reason: 'speed below threshold' };
  }

  const tps = Number.isFinite(sample.tps) ? sample.tps : null;
  const accelLong = sample && sample.accel && Number.isFinite(sample.accel.x)
    ? sample.accel.x
    : null;
  const decelerating = accelLong != null && accelLong < DECEL_THRESHOLD_M_S2;

  let useHistory = false;
  let ratio = sample.rpm / sample.speed;
  let ratioVariance = 0;
  if (Array.isArray(history) && history.length > 0 && Number.isFinite(sample.timestamp)) {
    const cutoff = sample.timestamp - HISTORY_WINDOW_MS;
    const recent = history.filter(h =>
      h && Number.isFinite(h.timestamp) && h.timestamp >= cutoff
        && Number.isFinite(h.rpm) && Number.isFinite(h.speed) && h.speed >= MIN_SPEED_KMH
    );
    if (recent.length >= 2) {
      const ratios = recent.map(h => h.rpm / h.speed);
      ratios.push(sample.rpm / sample.speed);
      const mean = ratios.reduce((a,b) => a+b, 0) / ratios.length;
      const v = ratios.reduce((a,b) => a + (b-mean)*(b-mean), 0) / ratios.length;
      ratio = mean;
      ratioVariance = v;
      useHistory = true;
    }
  }
  const useAccel = accelLong != null;

  let bestGear = null;
  let bestDist = Infinity;
  let secondDist = Infinity;
  for (const k of Object.keys(sigs)) {
    const g = Number(k);
    if (!Number.isFinite(g)) continue;
    const sig = sigs[k];
    if (!sig || !Number.isFinite(sig.rpm_speed_ratio) || sig.rpm_speed_ratio <= 0) continue;
    const dist = Math.abs(ratio - sig.rpm_speed_ratio) / sig.rpm_speed_ratio;
    if (dist < bestDist) {
      secondDist = bestDist;
      bestDist = dist;
      bestGear = g;
    } else if (dist < secondDist) {
      secondDist = dist;
    }
  }

  if (bestGear == null) {
    return { gear: null, confidence: 0, method: 'fallback', reason: 'no valid signatures' };
  }

  let conf = Math.max(0, 1 - bestDist / RATIO_TOL_PCT);

  if (Number.isFinite(secondDist)) {
    const margin = (secondDist - bestDist) / Math.max(bestDist, 1e-6);
    if (margin < 0.5) conf *= 0.7 + 0.3 * (margin / 0.5);
  }

  if (useHistory && ratioVariance > 0) {
    const cv = Math.sqrt(ratioVariance) / Math.max(ratio, 1e-6);
    if (cv > 0.03) conf *= Math.max(0.3, 1 - (cv - 0.03) * 5);
  }

  let reason = null;
  if (tps != null && tps === 0 && decelerating) {
    conf *= 0.5;
    reason = 'tps=0 + decelerating: possible clutch/neutral';
  }

  conf = Math.max(0, Math.min(1, conf));

  let method = 'rpm_speed';
  if (useHistory && useAccel) method = 'rpm_speed_history_accel';
  else if (useHistory) method = 'rpm_speed_history';

  return {
    gear: bestGear,
    confidence: Number(conf.toFixed(3)),
    method,
    reason
  };
}
