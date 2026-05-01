// Smoke spec: shift-light-bridge ↔ MobileTelemetry sample shape.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { createShiftLightBridge } = await import('../../src/pipeline/shift-light-bridge.js');
const { createShiftEventDetector } = await import('../../src/pipeline/shift-event-detector.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const car = Object.freeze({
  id: 'car-1', redline_rpm: 7000, safety_margin_rpm: 300, tolerance_rpm: 150,
  gear_signatures: { 1: { rpm_speed_ratio: 250 }, 2: { rpm_speed_ratio: 150 } }
});

function makeShiftDetector(events) {
  return createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-bridge', car,
    onEvent: (ev) => events.push(ev)
  });
}

function makeTelemetrySample({ tMono, kmh, accX = 1.5 }) {
  return {
    t: 1700000000000 + tMono,
    tMono,
    source: 'cockpit-mobile',
    signalQuality: 'GOOD',
    kmh,
    accX, accY: 0, accZ: 0
  };
}

t('factory exige shiftDetector + getRpm', () => {
  let threw = false;
  try { createShiftLightBridge({}); } catch { threw = true; }
  assert(threw, 'sem args deveria lançar');
  threw = false;
  try { createShiftLightBridge({ shiftDetector: { pushSample: () => {} } }); } catch { threw = true; }
  assert(threw, 'sem getRpm deveria lançar');
});

t('descarta sample sem RPM (não fabrica dado)', () => {
  const events = [];
  const shiftDet = makeShiftDetector(events);
  const bridge = createShiftLightBridge({
    shiftDetector: shiftDet,
    getRpm: () => null
  });
  for (let i = 0; i < 30; i++) {
    bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1000 + i*50, kmh: 20 }));
  }
  assert(events.length === 0, 'sem RPM, não deveria emitir nenhum evento');
});

t('descarta sample sem speed', () => {
  const events = [];
  const shiftDet = makeShiftDetector(events);
  const bridge = createShiftLightBridge({ shiftDetector: shiftDet, getRpm: () => 5000 });
  // sample sem kmh nem speed
  bridge.onTelemetrySample({ tMono: 1000, source: 'cockpit-mobile' });
  assert(events.length === 0);
});

t('mapeia speed em m/s para km/h quando kmh ausente', () => {
  const events = [];
  const shiftDet = makeShiftDetector(events);
  let rpm = 5000;
  const bridge = createShiftLightBridge({
    shiftDetector: shiftDet,
    getRpm: () => rpm
  });
  // 22 km/h = 6.111 m/s; gear 1 ratio 250 → rpm = 5500
  let ts = 1000;
  rpm = 5500;
  for (let v = 12; v <= 22; v += 0.5) {
    rpm = Math.round(v * 250);
    bridge.onTelemetrySample({ tMono: ts, source: 'cockpit-mobile', speed: v / 3.6, accX: 1.5 });
    ts += 50;
  }
  // Shift 1→2: rpm cai pra 22 * 150 = 3300
  rpm = Math.round(22 * 150);
  bridge.onTelemetrySample({ tMono: ts, source: 'cockpit-mobile', speed: 22 / 3.6, accX: 0.8 });
  ts += 50;
  for (let v = 22.5; v <= 30; v += 0.5) {
    rpm = Math.round(v * 150);
    bridge.onTelemetrySample({ tMono: ts, source: 'cockpit-mobile', speed: v / 3.6, accX: 1.2 });
    ts += 50;
  }
  assert(events.length === 1, 'esperava 1 evento, foi ' + events.length);
});

t('ignora samples com tMono retroativo (idempotência por tempo)', () => {
  const events = [];
  const shiftDet = makeShiftDetector(events);
  const calls = [];
  const fakeShift = { pushSample: (s) => calls.push(s) };
  const bridge = createShiftLightBridge({
    shiftDetector: fakeShift,
    getRpm: () => 5000
  });
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1000, kmh: 20 }));
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1100, kmh: 20 }));
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1050, kmh: 20 })); // retro
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1100, kmh: 20 })); // duplicado
  assert(calls.length === 2, 'esperava 2 samples, foi ' + calls.length);
});

t('reset() volta a aceitar tMono mais antigo', () => {
  const calls = [];
  const fakeShift = { pushSample: (s) => calls.push(s) };
  const bridge = createShiftLightBridge({
    shiftDetector: fakeShift,
    getRpm: () => 5000
  });
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 5000, kmh: 20 }));
  bridge.reset();
  bridge.onTelemetrySample(makeTelemetrySample({ tMono: 1000, kmh: 20 }));
  assert(calls.length === 2);
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-light-bridge.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
