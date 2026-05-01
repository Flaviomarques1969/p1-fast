// safe-mode — alvo de troca conservador, usado quando não há dyno nem
// alvo aprendido suficiente, OU quando a confiança da marcha está baixa.
//
// Função pura. Lança erro explícito se redline_rpm não estiver presente
// (evita default mágico que esconde carro mal-cadastrado).

import { CAR_SHIFT_DEFAULTS } from '../data/cars.js';

export function safeTarget(car) {
  if (!car || typeof car !== 'object') {
    throw new Error('safe-mode: car inválido');
  }
  if (!Number.isFinite(car.redline_rpm) || car.redline_rpm <= 0) {
    throw new Error('safe-mode: redline_rpm ausente ou inválido');
  }
  const margin = Number.isFinite(car.safety_margin_rpm)
    ? car.safety_margin_rpm
    : CAR_SHIFT_DEFAULTS.safety_margin_rpm;
  return car.redline_rpm - margin;
}
