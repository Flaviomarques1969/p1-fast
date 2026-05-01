// shift-event-detector — pipeline streaming que detecta eventos de troca de
// marcha e emite o evento completo (25 campos da spec).
//
// Uso:
//   const det = createShiftEventDetector({
//     piloto_id, carro_id, sessao_id, car,
//     onEvent: (ev) => saveEvent(ev),
//     resolveTrecho: (sample) => 'trecho-x' | null
//   });
//   det.pushSample(sample);
//
// O detector mantém um buffer de samples recentes. Quando vê uma queda/subida
// brusca de RPM com velocidade aproximadamente constante, marca o instante e,
// após `windowAfter` ms, emite o evento construído com os 3 pontos
// (rpm_before médio, rpm_at_shift, rpm_after médio) + estimativa de marcha
// + alvo + delta + flags.

import { estimateGear } from '../domain/gear-estimation.js';
import { computeShiftTarget } from '../domain/shift-target.js';

const DEFAULTS = Object.freeze({
  windowBefore: 200,     // ms — janela pra média rpm_before / accel_before
  windowAfter: 200,      // ms — janela pra média rpm_after / accel_after
  rpmDrop: 800,          // queda mínima pra ser upshift
  rpmRise: 600,          // subida mínima pra ser downshift
  speedTolPct: 0.05,     // velocidade não pode variar mais que 5% durante shift
  cooldownMs: 400,       // ms — bloqueia detecção dupla logo em seguida
  maxDtMs: 250,          // janela máxima entre samples consecutivos pra contar como shift
  tpsMin: 10             // ignora samples com TPS < 10 (provável neutro/embreagem)
});

export function createShiftEventDetector(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const {
    piloto_id = null, carro_id = null, sessao_id = null,
    car = null,
    onEvent = () => {},
    resolveTrecho = null
  } = cfg;

  let state = 'idle';     // 'idle' | 'pending' | 'cooldown'
  let buffer = [];
  let pending = null;
  let cooldownUntil = 0;
  const seenKeys = new Set();
  const emitted = [];

  function pushSample(sample) {
    if (!sample
      || !Number.isFinite(sample.timestamp)
      || !Number.isFinite(sample.rpm)
      || !Number.isFinite(sample.speed)) return;

    buffer.push(sample);
    const keepSince = sample.timestamp - (cfg.windowBefore + cfg.windowAfter + 500);
    while (buffer.length && buffer[0].timestamp < keepSince) buffer.shift();

    if (state === 'cooldown') {
      if (sample.timestamp >= cooldownUntil) state = 'idle';
      else return;
    }

    if (state === 'idle') {
      if (buffer.length < 2) return;
      const prev = buffer[buffer.length - 2];
      const cur = sample;
      const dt = cur.timestamp - prev.timestamp;
      if (dt <= 0 || dt > cfg.maxDtMs) return;
      const dRpm = cur.rpm - prev.rpm;
      const speedRel = Math.abs(cur.speed - prev.speed) / Math.max(prev.speed, 1);
      if (speedRel > cfg.speedTolPct) return;
      let type = null;
      if (dRpm <= -cfg.rpmDrop) type = 'up';
      else if (dRpm >= cfg.rpmRise) type = 'down';
      if (!type) return;
      pending = { type, atTimestamp: cur.timestamp, beforeSample: prev, atSample: cur };
      state = 'pending';
      return;
    }

    if (state === 'pending') {
      const elapsed = sample.timestamp - pending.atTimestamp;
      if (elapsed < cfg.windowAfter) return;
      const event = buildEvent({
        cfg, buffer, pending, finalSample: sample,
        piloto_id, carro_id, sessao_id, car, resolveTrecho
      });
      pending = null;
      cooldownUntil = sample.timestamp + cfg.cooldownMs;
      state = 'cooldown';
      if (event) {
        if (!seenKeys.has(event.dedup_key)) {
          seenKeys.add(event.dedup_key);
          emitted.push(event);
          try { onEvent(event); } catch { /* callback não derruba pipeline */ }
        }
      }
    }
  }

  return {
    pushSample,
    _state: () => state,
    _emitted: () => emitted.slice()
  };
}

function buildEvent({ cfg, buffer, pending, finalSample, piloto_id, carro_id, sessao_id, car, resolveTrecho }) {
  const before = pending.beforeSample;
  const at = pending.atSample;
  const after = finalSample;

  const tps = Number.isFinite(at.tps) ? at.tps : null;
  if (tps != null && tps < cfg.tpsMin) return null;

  const tCutBefore = at.timestamp - cfg.windowBefore;
  const beforeWindow = buffer.filter(s => s.timestamp >= tCutBefore && s.timestamp < at.timestamp);
  const afterWindow = buffer.filter(s => s.timestamp > at.timestamp && s.timestamp <= after.timestamp);

  const avg = (arr, pick) => {
    const vals = arr.map(pick).filter(v => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const rpm_before_avg = avg(beforeWindow, s => s.rpm);
  const rpm_after_avg = avg(afterWindow, s => s.rpm);
  // No upshift, rpm_at_shift é o rpm imediatamente antes da queda.
  // No downshift, é imediatamente após a subida (a estamparia da nova marcha).
  const rpm_at_shift = pending.type === 'up' ? before.rpm : at.rpm;

  const calibration = car && car.gear_signatures
    ? { gear_signatures: car.gear_signatures }
    : null;
  const gearBeforeRes = calibration
    ? estimateGear(before, beforeWindow, calibration)
    : { gear: null, confidence: 0 };
  const gearAfterRes = calibration
    ? estimateGear(after, afterWindow, calibration)
    : { gear: null, confidence: 0 };

  let target = null;
  if (car && Number.isFinite(car.redline_rpm)) {
    target = computeShiftTarget({
      car,
      gear: gearBeforeRes.gear,
      gearConfidence: gearBeforeRes.confidence
    });
  }
  const target_optimal_rpm = target ? target.optimalRpm : null;
  const target_visual_rpm = target_optimal_rpm; // Bloco 5 ajusta com reaction
  const delta_rpm = (Number.isFinite(rpm_at_shift) && Number.isFinite(target_optimal_rpm))
    ? rpm_at_shift - target_optimal_rpm
    : null;

  const tolerance = (car && Number.isFinite(car.tolerance_rpm)) ? car.tolerance_rpm : 150;
  let status = 'unknown';
  if (Number.isFinite(delta_rpm)) {
    status = Math.abs(delta_rpm) <= tolerance ? 'green' : 'red';
  }

  let mode_used = 'SAFE_MODE';
  if (Array.isArray(car?.dyno_curve) && car.dyno_curve.length > 0) mode_used = 'DYNO_CALIBRATED';
  else if (target && target.source === 'learned') mode_used = 'TELEMETRY_LEARNED';

  const overrev_flag = (Number.isFinite(rpm_at_shift) && car && Number.isFinite(car.redline_rpm))
    ? rpm_at_shift > car.redline_rpm
    : false;

  let trecho_id = null;
  if (typeof resolveTrecho === 'function') {
    try {
      const v = resolveTrecho(at);
      if (typeof v === 'string' && v.length > 0) trecho_id = v;
    } catch {
      trecho_id = null;
    }
  }

  const data_inconsistent_flag = (
    rpm_before_avg == null
    || rpm_after_avg == null
    || !Number.isFinite(rpm_at_shift)
    || tps == null
  );

  const dedup_key = [
    sessao_id || 'no-session',
    at.timestamp,
    gearBeforeRes.gear ?? 'x',
    gearAfterRes.gear ?? 'x'
  ].join(':');

  return {
    piloto_id,
    carro_id,
    sessao_id,
    volta_id: null,
    trecho_id,
    timestamp: at.timestamp,
    rpm_before: rpm_before_avg != null ? Math.round(rpm_before_avg) : null,
    rpm_at_shift: Number.isFinite(rpm_at_shift) ? Math.round(rpm_at_shift) : null,
    rpm_after: rpm_after_avg != null ? Math.round(rpm_after_avg) : null,
    speed_kmh: Number.isFinite(at.speed) ? at.speed : null,
    tps,
    gear_before: gearBeforeRes.gear,
    gear_after: gearAfterRes.gear,
    gear_confidence: gearAfterRes.confidence,
    accel_long_before: avg(beforeWindow, s => s?.accel?.x),
    accel_long_during: Number.isFinite(at?.accel?.x) ? at.accel.x : null,
    accel_long_after: avg(afterWindow, s => s?.accel?.x),
    target_optimal_rpm,
    target_visual_rpm,
    delta_rpm,
    status,
    mode_used,
    overrev_flag,
    data_inconsistent_flag,
    lesson_text: null,
    dedup_key
  };
}
