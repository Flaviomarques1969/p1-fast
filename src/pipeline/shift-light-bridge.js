// shift-light-bridge — adapta o stream do MobileTelemetry (Sample canônico)
// para o input do shift-event-detector (rpm, speed em km/h, tps, accel, ts).
//
// MobileTelemetry hoje só publica GPS+IMU; rpm/tps vêm de outra fonte (ECU
// Bluetooth, Injepro, simulador). A bridge aceita getters síncronos que o
// caller mantém atualizados por outro canal — sem acoplar este módulo à
// fonte de RPM. Sample sem RPM é descartado (não fabricar dados).

import { msParaKmh } from '../domain/velocidade.js';

export function createShiftLightBridge({ shiftDetector, getRpm, getTps = () => null } = {}) {
  if (!shiftDetector || typeof shiftDetector.pushSample !== 'function') {
    throw new Error('shift-light-bridge: shiftDetector com pushSample obrigatório');
  }
  if (typeof getRpm !== 'function') {
    throw new Error('shift-light-bridge: getRpm() síncrono obrigatório');
  }

  let lastTs = -1;

  function onTelemetrySample(sample) {
    if (!sample) return;
    const ts = Number.isFinite(sample.tMono) ? sample.tMono : sample.t;
    if (!Number.isFinite(ts) || ts <= lastTs) return;
    lastTs = ts;
    const rpm = getRpm(sample);
    if (!Number.isFinite(rpm) || rpm <= 0) return; // sem RPM real → não emite
    const speed = Number.isFinite(sample.kmh)
      ? sample.kmh
      : (Number.isFinite(sample.speed) ? msParaKmh(sample.speed) : null);
    if (!Number.isFinite(speed)) return;
    const tps = (() => {
      const v = getTps(sample);
      return Number.isFinite(v) ? v : null;
    })();
    const accel = {
      x: Number.isFinite(sample.accX) ? sample.accX : 0,
      y: Number.isFinite(sample.accY) ? sample.accY : 0,
      z: Number.isFinite(sample.accZ) ? sample.accZ : 0
    };
    shiftDetector.pushSample({ rpm, speed, tps, accel, timestamp: ts });
  }

  function reset() { lastTs = -1; }

  return { onTelemetrySample, reset };
}
