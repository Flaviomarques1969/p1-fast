// Smoke spec: integração shift-event-detector ↔ Detector via trecho-resolver
// Verifica que o trecho_id do shift_event reflete o segmentoAtual do Detector
// no instante da troca.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { Detector } = await import('../../src/telemetry/detector.js');
const { createShiftEventDetector } = await import('../../src/pipeline/shift-event-detector.js');
const {
  setTrechoSource, clearTrechoSource, getCurrentTrechoIdSync
} = await import('../../src/data/trecho-resolver.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Setup do Detector (path 100×100 com 1 segment cobrindo offset 25%–75%)
const svgPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
const linhaChegada = { x1: -5, y1: 0, x2: 5, y2: 0 };
const segments = [
  { id: 'seg-curva-A', nome: 'Curva A', pathStart: 25, pathEnd: 75 }
];

const car = Object.freeze({
  id: 'car-1',
  redline_rpm: 7000,
  safety_margin_rpm: 300,
  tolerance_rpm: 150,
  gear_signatures: { 1: { rpm_speed_ratio: 250 }, 2: { rpm_speed_ratio: 150 } }
});

t('Detector.getCurrentSegmentId() — null fora de segment, segmentId dentro', () => {
  const d = new Detector({ svgPath, linhaChegada, segments });
  d.consume({ x: 0, y: 0, t: 1000, speed: 25 }); // offset 0 — fora
  assert(d.getCurrentSegmentId() === null, 'fora do segment');
  d.consume({ x: 100, y: 0, t: 1100, speed: 25 }); // offset ~100 — dentro do segment-A
  assert(d.getCurrentSegmentId() === 'seg-curva-A', 'dentro: ' + d.getCurrentSegmentId());
});

t('trecho-resolver: setTrechoSource → getCurrentTrechoIdSync devolve o atual', () => {
  const d = new Detector({ svgPath, linhaChegada, segments });
  setTrechoSource(d);
  assert(getCurrentTrechoIdSync() === null);
  d.consume({ x: 0, y: 0, t: 1000, speed: 25 });
  d.consume({ x: 100, y: 0, t: 1100, speed: 25 });
  assert(getCurrentTrechoIdSync() === 'seg-curva-A');
  clearTrechoSource();
  assert(getCurrentTrechoIdSync() === null, 'após clear, retorna null');
});

t('trecho-resolver: source sem getCurrentSegmentId é ignorado', () => {
  setTrechoSource({ foo: 'bar' });
  assert(getCurrentTrechoIdSync() === null);
  clearTrechoSource();
});

t('shift-event-detector usa Detector ao vivo via trecho-resolver síncrono', () => {
  const detector = new Detector({ svgPath, linhaChegada, segments });
  setTrechoSource(detector);

  const events = [];
  const shiftDet = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-int', car,
    onEvent: (ev) => events.push(ev),
    resolveTrecho: () => getCurrentTrechoIdSync()
  });

  // Trajetória: começa fora do segment (gear 1) e entra no segment durante a troca
  let t0 = 1000;

  // Fora do segment, gear 1 (rpm/speed = 250)
  for (let s = 12; s <= 22; s += 0.5) {
    detector.consume({ x: 0, y: 0, t: t0, speed: s * 0.2778 }); // m/s
    shiftDet.pushSample({ rpm: Math.round(s * 250), speed: s, tps: 80, accel: { x: 1.5, y: 0, z: 0 }, timestamp: t0 });
    t0 += 50;
  }

  // Entra no segment ANTES do shift (offset ~100 = dentro)
  detector.consume({ x: 100, y: 0, t: t0, speed: 22 * 0.2778 });
  shiftDet.pushSample({ rpm: Math.round(22 * 250), speed: 22, tps: 80, accel: { x: 1.5, y: 0, z: 0 }, timestamp: t0 });
  assert(detector.getCurrentSegmentId() === 'seg-curva-A', 'detector deveria estar dentro do segment');
  t0 += 50;

  // Shift 1→2 (rpm cai de 250×22 pra 150×22)
  shiftDet.pushSample({ rpm: Math.round(22 * 150), speed: 22, tps: 70, accel: { x: 0.8, y: 0, z: 0 }, timestamp: t0 });
  detector.consume({ x: 100, y: 22, t: t0, speed: 22 * 0.2778 });
  t0 += 50;

  // Janela após (gear 2)
  for (let s = 22.5; s <= 30; s += 0.5) {
    detector.consume({ x: 100, y: (s - 22) * 4, t: t0, speed: s * 0.2778 });
    shiftDet.pushSample({ rpm: Math.round(s * 150), speed: s, tps: 80, accel: { x: 1.2, y: 0, z: 0 }, timestamp: t0 });
    t0 += 50;
  }

  assert(events.length === 1, 'esperava 1 evento, foi ' + events.length);
  assert(events[0].trecho_id === 'seg-curva-A', 'trecho_id esperado seg-curva-A, foi ' + events[0].trecho_id);
  clearTrechoSource();
});

t('shift-event-detector: sem source registrada → trecho_id null no evento', () => {
  clearTrechoSource();
  const events = [];
  const shiftDet = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-no-src', car,
    onEvent: (ev) => events.push(ev),
    resolveTrecho: () => getCurrentTrechoIdSync()
  });

  let t0 = 1000;
  for (let s = 12; s <= 22; s += 0.5) {
    shiftDet.pushSample({ rpm: Math.round(s * 250), speed: s, tps: 80, accel: { x: 1.5, y: 0, z: 0 }, timestamp: t0 });
    t0 += 50;
  }
  shiftDet.pushSample({ rpm: Math.round(22 * 150), speed: 22, tps: 70, accel: { x: 0.8, y: 0, z: 0 }, timestamp: t0 });
  t0 += 50;
  for (let s = 22.5; s <= 30; s += 0.5) {
    shiftDet.pushSample({ rpm: Math.round(s * 150), speed: s, tps: 80, accel: { x: 1.2, y: 0, z: 0 }, timestamp: t0 });
    t0 += 50;
  }
  assert(events.length === 1);
  assert(events[0].trecho_id === null, 'sem source, trecho_id deveria ser null, foi ' + events[0].trecho_id);
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-event-trecho-integration.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
