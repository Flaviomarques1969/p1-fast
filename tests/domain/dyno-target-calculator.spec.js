// Smoke spec: dyno-csv-parser + dyno-target-calculator + tolerance-from-dyno
// + integração com shift-target (source: 'dyno')

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { parseDynoCsv } = await import('../../src/domain/dyno-csv-parser.js');
const { computeOptimalRpmPerGear } = await import('../../src/domain/dyno-target-calculator.js');
const { computeTolerance } = await import('../../src/domain/tolerance-from-dyno.js');
const { computeShiftTarget } = await import('../../src/domain/shift-target.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── parseDynoCsv ────────────────────────────────────────────────────────

t('parseDynoCsv: formato Dynojet (RPM,Torque (lb-ft),HP)', () => {
  const csv = `Dynojet Run File
RPM,Torque (lb-ft),HP
3000,180,103
4000,210,160
5000,230,219
6000,225,257
7000,210,280
7500,195,278`;
  const r = parseDynoCsv(csv);
  assert(r.format === 'dynojet', 'format: ' + r.format);
  assert(r.points.length === 6, 'pontos: ' + r.points.length);
  // 180 lb-ft ≈ 244 Nm
  assert(Math.abs(r.points[0].torque_nm - 244) < 5, 'conversão torque lb-ft incorreta');
  // 103 hp ≈ 76.8 kW
  assert(Math.abs(r.points[0].power_kw - 76.8) < 1, 'conversão power hp incorreta');
});

t('parseDynoCsv: formato Mustang (RPM;Torque (Nm);Power (kW))', () => {
  const csv = `Mustang Dyno
RPM;Torque (Nm);Power (kW)
3000;240;75
4500;290;137
6000;305;192
7000;295;216
7500;270;212`;
  const r = parseDynoCsv(csv);
  assert(r.format === 'mustang', 'format: ' + r.format);
  assert(r.points.length === 5);
  assert(r.points[0].torque_nm === 240);
  assert(r.points[0].power_kw === 75);
});

t('parseDynoCsv: CSV inválido (vazio) → erro legível', () => {
  let threw = false;
  try { parseDynoCsv(''); } catch (e) { threw = true; assert(/vazio|inválido/i.test(e.message)); }
  assert(threw);
});

t('parseDynoCsv: CSV sem coluna RPM → erro legível', () => {
  const csv = `Dyno run\nTorque,Power\n100,50`;
  let threw = false;
  try { parseDynoCsv(csv); } catch (e) { threw = true; assert(/RPM/.test(e.message)); }
  assert(threw);
});

t('parseDynoCsv: CSV sem torque/potência → erro', () => {
  const csv = `Bench\nRPM,Foo\n3000,abc\n4000,xxx`;
  let threw = false;
  try { parseDynoCsv(csv); } catch (e) { threw = true; }
  assert(threw);
});

t('parseDynoCsv: completa power_kw a partir de torque_nm via P=T*RPM/9549', () => {
  const csv = `RPM,Torque (Nm)\n3000,240\n5000,300\n7000,280`;
  const r = parseDynoCsv(csv);
  // P(7000, 280Nm) = 280*7000/9549 ≈ 205 kW
  assert(Math.abs(r.points[2].power_kw - 205) < 3, 'power esperado ~205, foi ' + r.points[2].power_kw);
});

// ─── computeOptimalRpmPerGear ────────────────────────────────────────────

function makeCurve() {
  // Curva sintética com pico em ~6500rpm
  const out = [];
  for (let r = 3000; r <= 8000; r += 250) {
    // Power kW pico em 6500 (~210 kW), parabólica
    const x = (r - 6500) / 1500;
    const power_kw = 210 - x * x * 100;
    const torque_nm = power_kw * 9549 / r;
    out.push({ rpm: r, torque_nm, power_kw });
  }
  return out;
}

t('computeOptimalRpmPerGear: 5 marchas com gear_ratios → cada marcha tem alvo dyno', () => {
  const curve = makeCurve();
  const gear_ratios = [3.6, 2.1, 1.5, 1.15, 0.9]; // ratios típicos
  const r = computeOptimalRpmPerGear({ curve, gear_ratios, redline_rpm: 8000 });
  for (let g = 1; g <= 5; g++) {
    assert(r[g] && Number.isFinite(r[g].optimal_rpm), 'marcha ' + g + ' sem alvo');
    assert(r[g].source === 'dyno', 'marcha ' + g + ' source: ' + r[g].source);
  }
  // Última marcha → pico
  assert(Math.abs(r[5].optimal_rpm - 6500) < 300, 'última marcha deveria ser ~pico');
});

t('computeOptimalRpmPerGear: sem gear_ratios → fallback 90% redline em todas', () => {
  const curve = makeCurve();
  const r = computeOptimalRpmPerGear({ curve, redline_rpm: 8000 });
  for (const g of Object.keys(r)) {
    assert(r[g].source === 'fallback');
    assert(r[g].optimal_rpm === 7200, 'fallback deveria ser 7200, foi ' + r[g].optimal_rpm);
    assert(/gear_ratios ausente/.test(r[g].reason));
  }
});

t('computeOptimalRpmPerGear: 5 pontos manuais com interpolação funciona', () => {
  const curve = [
    { rpm: 3000, torque_nm: 200, power_kw: 63 },
    { rpm: 4500, torque_nm: 270, power_kw: 127 },
    { rpm: 6000, torque_nm: 290, power_kw: 182 },
    { rpm: 7000, torque_nm: 280, power_kw: 205 },
    { rpm: 7800, torque_nm: 250, power_kw: 204 }
  ];
  const r = computeOptimalRpmPerGear({ curve, gear_ratios: [3.0, 2.0, 1.4, 1.1], redline_rpm: 8000 });
  for (let g = 1; g <= 4; g++) {
    assert(r[g] && Number.isFinite(r[g].optimal_rpm), 'marcha ' + g + ' sem alvo');
  }
});

t('computeOptimalRpmPerGear: curva insuficiente (<3 pontos) → erro', () => {
  let threw = false;
  try { computeOptimalRpmPerGear({ curve: [{ rpm: 3000, power_kw: 80 }, { rpm: 4000, power_kw: 100 }], gear_ratios: [3, 2] }); }
  catch (e) { threw = true; assert(/3 pontos/.test(e.message)); }
  assert(threw);
});

// ─── computeTolerance ────────────────────────────────────────────────────

t('computeTolerance: janela útil 5% com clamp [80,250]', () => {
  const curve = makeCurve();
  const tol = computeTolerance(curve, 5);
  assert(tol >= 80 && tol <= 250, 'tolerância fora do clamp: ' + tol);
});

t('computeTolerance: curva muito estreita → clamp em mínimo 80', () => {
  const curve = [
    { rpm: 6000, torque_nm: 200, power_kw: 130 },
    { rpm: 6100, torque_nm: 200, power_kw: 130 },
    { rpm: 6200, torque_nm: 200, power_kw: 130 }
  ];
  const tol = computeTolerance(curve, 5);
  assert(tol === 80, 'esperava clamp 80, foi ' + tol);
});

t('computeTolerance: percent maior produz tolerância maior (até clamp)', () => {
  const curve = makeCurve();
  const tolLow = computeTolerance(curve, 1);
  const tolHigh = computeTolerance(curve, 20);
  assert(tolHigh >= tolLow, 'mais % deveria dar tol maior ou igual');
  assert(tolHigh <= 250, 'clamp superior deveria ser respeitado');
});

t('computeTolerance: curva inválida → erro', () => {
  let threw = false;
  try { computeTolerance([{ rpm: 3000, power_kw: 70 }, { rpm: 4000, power_kw: 100 }]); }
  catch (e) { threw = true; }
  assert(threw);
});

// ─── Integração com shift-target.js ──────────────────────────────────────

t('shift-target retorna source="dyno" com curva + gear_ratios completos', () => {
  const car = {
    redline_rpm: 8000, safety_margin_rpm: 300, tolerance_rpm: 150,
    dyno_curve: makeCurve(),
    gear_ratios: [3.6, 2.1, 1.5, 1.15, 0.9]
  };
  const r = computeShiftTarget({ car, gear: 2, gearConfidence: 0.9 });
  assert(r.source === 'dyno', 'source esperado dyno, foi ' + r.source + ' (reason: ' + r.reason + ')');
  assert(Number.isFinite(r.optimalRpm), 'optimalRpm finito');
});

t('shift-target: dyno_curve sem gear_ratios → safe com reason de fallback', () => {
  const car = {
    redline_rpm: 8000, safety_margin_rpm: 300, tolerance_rpm: 150,
    dyno_curve: makeCurve()
  };
  const r = computeShiftTarget({ car, gear: 2, gearConfidence: 0.9 });
  assert(r.source === 'safe', 'source esperado safe, foi ' + r.source);
  assert(r.reason && /gear_ratios/.test(r.reason), 'reason deveria mencionar gear_ratios: ' + r.reason);
});

// ─── Runner ──────────────────────────────────────────────────────────────

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[dyno-target-calculator.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
