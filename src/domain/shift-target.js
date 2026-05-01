// shift-target — computa o RPM alvo para a próxima troca.
// Função pura. Decide entre: dyno (Bloco 6), learned (telemetria), safe.
//
// computeShiftTarget({ car, gear, gearConfidence, mode, learnedTargets })
//   → { optimalRpm, source: 'dyno' | 'learned' | 'safe' | 'unavailable', reason }

import { safeTarget } from './safe-mode.js';
import { hasDyno, getLearnedTarget } from '../data/cars.js';

const CONFIDENCE_FLOOR = 0.7;

export function computeShiftTarget({ car, gear, gearConfidence, mode = 'assisted', learnedTargets = null } = {}) {
  if (!car || typeof car !== 'object') {
    return { optimalRpm: null, source: 'unavailable', reason: 'no car' };
  }
  if (!Number.isFinite(car.redline_rpm) || car.redline_rpm <= 0) {
    throw new Error('shift-target: redline_rpm ausente ou inválido');
  }

  // Confiança baixa → cair no safe target
  if (!Number.isFinite(gearConfidence) || gearConfidence < CONFIDENCE_FLOOR) {
    return {
      optimalRpm: safeTarget(car),
      source: 'safe',
      reason: 'gear_confidence below floor'
    };
  }

  // Dyno calibrado (lógica completa só no Bloco 6) — placeholder retorna safe
  // por ora, mas marcamos a fonte como 'safe' com razão explícita pra não
  // mentir que veio de dyno.
  if (hasDyno(car)) {
    return {
      optimalRpm: safeTarget(car),
      source: 'safe',
      reason: 'dyno present but calculator not implemented (Bloco 6)'
    };
  }

  // Alvo aprendido por telemetria, com fallback em learnedTargets externo.
  // Aceita o alvo armazenado no carro OU passado como parâmetro (tests, etc).
  const learnedFromCar = getLearnedTarget(car, gear);
  const learnedFromArg = learnedTargets && learnedTargets[gear] && Number.isFinite(learnedTargets[gear].optimal_rpm)
    ? learnedTargets[gear]
    : null;
  const learned = learnedFromCar || learnedFromArg;
  if (learned) {
    return {
      optimalRpm: learned.optimal_rpm,
      source: 'learned',
      reason: null
    };
  }

  // Sem dyno, sem learned → safe
  return {
    optimalRpm: safeTarget(car),
    source: 'safe',
    reason: 'no dyno, no learned target'
  };
}
