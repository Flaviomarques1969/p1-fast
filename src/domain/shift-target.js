// shift-target — computa o RPM alvo para a próxima troca.
// Função pura. Decide entre: dyno (Bloco 6), learned (telemetria), safe.
//
// computeShiftTarget({ car, gear, gearConfidence, mode, learnedTargets, reactionCtx })
//   → { optimalRpm, visualRpm, source, reason, reactionSource }
//
// reactionCtx (opcional, Bloco 5):
//   { piloto_id, carro_id, trecho_id, rpmRiseRate, profiles }
// Quando presente + modo assistido + tupla com ≥10 samples, calcula
// visualRpm = optimalRpm - reaction_compensation. Caso contrário, visualRpm = optimalRpm.

import { safeTarget } from './safe-mode.js';
import { hasDyno, getLearnedTarget } from '../data/cars.js';
import { computeCompensation } from './pilot-reaction.js';
import { computeOptimalRpmPerGear } from './dyno-target-calculator.js';

const CONFIDENCE_FLOOR = 0.7;

export function computeShiftTarget({ car, gear, gearConfidence, mode = 'assisted', learnedTargets = null, reactionCtx = null } = {}) {
  if (!car || typeof car !== 'object') {
    return { optimalRpm: null, visualRpm: null, source: 'unavailable', reason: 'no car', reactionSource: null };
  }
  if (!Number.isFinite(car.redline_rpm) || car.redline_rpm <= 0) {
    throw new Error('shift-target: redline_rpm ausente ou inválido');
  }

  let optimalRpm;
  let source;
  let reason = null;

  if (!Number.isFinite(gearConfidence) || gearConfidence < CONFIDENCE_FLOOR) {
    optimalRpm = safeTarget(car);
    source = 'safe';
    reason = 'gear_confidence below floor';
  } else if (hasDyno(car)) {
    // Bloco 6 implementa a lógica completa.
    optimalRpm = safeTarget(car);
    source = 'safe';
    reason = 'dyno present but calculator not implemented (Bloco 6)';
  } else {
    const learnedFromCar = getLearnedTarget(car, gear);
    const learnedFromArg = learnedTargets && learnedTargets[gear] && Number.isFinite(learnedTargets[gear].optimal_rpm)
      ? learnedTargets[gear]
      : null;
    const learned = learnedFromCar || learnedFromArg;
    if (learned) {
      optimalRpm = learned.optimal_rpm;
      source = 'learned';
    } else {
      optimalRpm = safeTarget(car);
      source = 'safe';
      reason = 'no dyno, no learned target';
    }
  }

  // Visual RPM = optimal - reaction_compensation (Bloco 5)
  let visualRpm = optimalRpm;
  let reactionSource = null;
  if (reactionCtx && Number.isFinite(optimalRpm)) {
    const comp = computeCompensation({
      piloto_id: reactionCtx.piloto_id,
      carro_id: reactionCtx.carro_id,
      gear,
      trecho_id: reactionCtx.trecho_id,
      rpmRiseRate: reactionCtx.rpmRiseRate,
      profiles: reactionCtx.profiles || {},
      mode
    });
    reactionSource = comp.source;
    if (comp.source !== 'default' && comp.source !== 'invalid_rate' && comp.source !== 'learning_mode') {
      visualRpm = optimalRpm - comp.compensation_rpm;
    }
  }

  return { optimalRpm, visualRpm, source, reason, reactionSource };
}
