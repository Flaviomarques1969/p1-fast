// Smoke spec: shift-target + safe-mode + cars schema

import { computeShiftTarget } from '../../src/domain/shift-target.js';
import { safeTarget } from '../../src/domain/safe-mode.js';
import { withShiftDefaults, validateShiftCar, hasDyno, hasLearnedTarget } from '../../src/data/cars.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const baseCar = Object.freeze({
  id: 'car-1',
  redline_rpm: 7000,
  safety_margin_rpm: 300,
  tolerance_rpm: 150
});

// ─── safe-mode ───────────────────────────────────────────────────────────

t('safeTarget = redline - safety_margin', () => {
  assert(safeTarget(baseCar) === 6700, 'esperado 6700, foi ' + safeTarget(baseCar));
});

t('safeTarget usa default 300 quando safety_margin_rpm ausente', () => {
  const car = { redline_rpm: 8000 };
  assert(safeTarget(car) === 7700);
});

t('safeTarget: redline_rpm ausente → erro explícito', () => {
  let threw = false;
  try { safeTarget({}); } catch (e) { threw = true; assert(e.message.includes('redline'), 'mensagem deveria mencionar redline'); }
  assert(threw, 'deveria lançar');
});

// ─── computeShiftTarget ──────────────────────────────────────────────────

t('sem dyno + confiança 0.9 → safe', () => {
  const r = computeShiftTarget({ car: baseCar, gear: 3, gearConfidence: 0.9 });
  assert(r.source === 'safe', 'source: ' + r.source);
  assert(r.optimalRpm === 6700, 'optimalRpm: ' + r.optimalRpm);
});

t('sem dyno + confiança 0.5 → safe (confidence below floor)', () => {
  const r = computeShiftTarget({ car: baseCar, gear: 3, gearConfidence: 0.5 });
  assert(r.source === 'safe', 'source: ' + r.source);
  assert(r.reason && r.reason.includes('confidence'), 'reason: ' + r.reason);
});

t('com learned target marcha 3 + confiança 0.9 + gear=3 → learned', () => {
  const car = { ...baseCar, learned_targets: { 3: { optimal_rpm: 6500 } } };
  const r = computeShiftTarget({ car, gear: 3, gearConfidence: 0.9 });
  assert(r.source === 'learned', 'source: ' + r.source);
  assert(r.optimalRpm === 6500, 'optimalRpm: ' + r.optimalRpm);
});

t('learned target apenas para outra marcha → safe na marcha sem alvo', () => {
  const car = { ...baseCar, learned_targets: { 3: { optimal_rpm: 6500 } } };
  const r = computeShiftTarget({ car, gear: 2, gearConfidence: 0.9 });
  assert(r.source === 'safe', 'source: ' + r.source);
});

t('learnedTargets como argumento (não no car) → learned', () => {
  const r = computeShiftTarget({
    car: baseCar, gear: 4, gearConfidence: 0.85,
    learnedTargets: { 4: { optimal_rpm: 6400 } }
  });
  assert(r.source === 'learned', 'source: ' + r.source);
  assert(r.optimalRpm === 6400);
});

t('redline_rpm ausente → erro explícito', () => {
  let threw = false;
  try { computeShiftTarget({ car: { redline_rpm: null }, gear: 1, gearConfidence: 0.9 }); }
  catch (e) { threw = true; assert(e.message.includes('redline')); }
  assert(threw, 'deveria lançar');
});

t('car ausente → unavailable', () => {
  const r = computeShiftTarget({ car: null, gear: 1, gearConfidence: 0.9 });
  assert(r.source === 'unavailable');
  assert(r.optimalRpm === null);
});

t('dyno presente (placeholder Bloco 2) → ainda safe com reason explícita', () => {
  const car = { ...baseCar, dyno_curve: [{ rpm: 4000, torque_nm: 280, power_kw: 117 }] };
  const r = computeShiftTarget({ car, gear: 3, gearConfidence: 0.9 });
  assert(r.source === 'safe', 'placeholder Bloco 2 deve cair em safe');
  assert(r.reason && r.reason.includes('dyno'), 'reason deve mencionar dyno: ' + r.reason);
});

t('computeShiftTarget é função pura — não muta inputs', () => {
  const car = Object.freeze({ ...baseCar });
  const r = computeShiftTarget({ car, gear: 3, gearConfidence: 0.9 });
  assert(r.source === 'safe');
});

// ─── cars schema helpers ─────────────────────────────────────────────────

t('withShiftDefaults aplica defaults sem mutar input', () => {
  const car = { id: 'x', redline_rpm: 7000 };
  const out = withShiftDefaults(car);
  assert(out.safety_margin_rpm === 300);
  assert(out.tolerance_rpm === 150);
  assert(out.dyno_curve === null);
  assert(car.safety_margin_rpm === undefined, 'input não deveria ter sido mutado');
});

t('validateShiftCar exige redline_rpm', () => {
  let threw = false;
  try { validateShiftCar({ id: 'x' }); } catch { threw = true; }
  assert(threw, 'deveria lançar sem redline');
  assert(validateShiftCar({ redline_rpm: 7000 }) === true);
});

t('hasDyno true só com array não-vazio', () => {
  assert(hasDyno({ dyno_curve: null }) === false);
  assert(hasDyno({ dyno_curve: [] }) === false);
  assert(hasDyno({ dyno_curve: [{ rpm: 1000 }] }) === true);
});

t('hasLearnedTarget verifica marcha específica', () => {
  const car = { learned_targets: { 2: { optimal_rpm: 6400 } } };
  assert(hasLearnedTarget(car, 2) === true);
  assert(hasLearnedTarget(car, 3) === false);
  assert(hasLearnedTarget({}, 2) === false);
});

console.log(`\n[shift-target.spec] ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
