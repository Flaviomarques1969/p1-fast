// cars — extensão do schema do carro para o Smart Shift Light.
// Camada pura, sem IO. A persistência continua via src/domain/car.js (Dexie).
// Este módulo apenas define os campos novos, defaults e validações que o
// shift-light usa para computar o alvo de troca.

export const CAR_SHIFT_DEFAULTS = Object.freeze({
  safety_margin_rpm: 300,
  tolerance_rpm: 150,
  dyno_curve: null,
  gear_signatures: null,
  learned_targets: null,
  gear_ratios: null,
  final_drive: null
});

// Campos obrigatórios para o shift-light operar com qualquer alvo
const REQUIRED_FIELDS = ['redline_rpm'];

export function validateShiftCar(car) {
  if (!car || typeof car !== 'object') {
    throw new Error('shift-car: car inválido');
  }
  for (const f of REQUIRED_FIELDS) {
    if (!Number.isFinite(car[f])) {
      throw new Error(`shift-car: campo obrigatório ausente ou inválido: ${f}`);
    }
  }
  if (car.redline_rpm <= 0) {
    throw new Error('shift-car: redline_rpm deve ser positivo');
  }
  return true;
}

// withShiftDefaults(car) — devolve um objeto com os defaults aplicados onde
// os valores não estão presentes. Não muta o input.
export function withShiftDefaults(car) {
  if (!car || typeof car !== 'object') return null;
  const out = { ...car };
  for (const k of Object.keys(CAR_SHIFT_DEFAULTS)) {
    if (out[k] === undefined) out[k] = CAR_SHIFT_DEFAULTS[k];
  }
  return out;
}

// hasDyno(car) — true se o carro tem curva de dyno calibrada
export function hasDyno(car) {
  return !!(car && Array.isArray(car.dyno_curve) && car.dyno_curve.length > 0);
}

// hasLearnedTarget(car, gear) — true se há alvo aprendido para a marcha dada
export function hasLearnedTarget(car, gear) {
  if (!car || !car.learned_targets) return false;
  const lt = car.learned_targets[gear];
  return !!(lt && Number.isFinite(lt.optimal_rpm));
}

export function getLearnedTarget(car, gear) {
  if (!hasLearnedTarget(car, gear)) return null;
  return car.learned_targets[gear];
}
