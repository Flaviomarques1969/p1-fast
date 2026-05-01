// Smoke spec: pilot-reaction (learnFromEvent + computeCompensation)
// + reaction-profiles Dexie store
// + hook em shift-target.js (visualRpm)

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { learnFromEvent, computeCompensation, tupleKey, REACTION_CONSTANTS } =
  await import('../../src/domain/pilot-reaction.js');
const { saveProfile, loadProfile, loadAllProfiles, clearProfiles } =
  await import('../../src/data/reaction-profiles.js');
const { computeShiftTarget } =
  await import('../../src/domain/shift-target.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const car = Object.freeze({
  id: 'car-1', redline_rpm: 7000, safety_margin_rpm: 300, tolerance_rpm: 150
});

function makeEvent(overrides = {}) {
  // observed_rt_ms = (rpm_at_shift - target_visual_rpm) * 1000 / rpm_rise_rate
  // Defaults: 6750 - 6500 = 250rpm, rate=5000rpm/s → 50ms (clampeado para 50)
  // Use 6700 - 6500 = 200, rate=4000rpm/s → 50ms — ainda clampeia
  // Para variar: rpm_at_shift=6800, target_visual_rpm=6500, rate=2000rpm/s → 150ms
  return {
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's1',
    trecho_id: 't-reta', gear_after: 4, gear_before: 3,
    rpm_at_shift: 6800, rpm_before: 6400, target_visual_rpm: 6500, target_optimal_rpm: 6500,
    delta_rpm: 300, rpm_rise_rate: 2000,
    gear_confidence: 0.9, data_inconsistent_flag: false,
    status: 'red', timestamp: 1000,
    ...overrides
  };
}

// ─── learnFromEvent ──────────────────────────────────────────────────────

t('learnFromEvent ignora eventos com gear_confidence < 0.8', () => {
  const ev = makeEvent({ gear_confidence: 0.7 });
  const next = learnFromEvent(ev, {});
  assert(Object.keys(next).length === 0, 'não deveria aprender');
});

t('learnFromEvent ignora eventos com data_inconsistent_flag=true', () => {
  const ev = makeEvent({ data_inconsistent_flag: true });
  const next = learnFromEvent(ev, {});
  assert(Object.keys(next).length === 0);
});

t('learnFromEvent ignora eventos early (delta_rpm < 0)', () => {
  const ev = makeEvent({ delta_rpm: -200 });
  const next = learnFromEvent(ev, {});
  assert(Object.keys(next).length === 0, 'early não aprende');
});

t('learnFromEvent: primeira amostra inicializa rt com observed', () => {
  const ev = makeEvent();
  const next = learnFromEvent(ev, {});
  const key = tupleKey('p1', 'car-1', 4, 't-reta');
  assert(next[key], 'profile criado');
  assert(next[key].sample_count === 1);
  assert(next[key].reaction_time_ms === 150, 'rt observed esperado 150, foi ' + next[key].reaction_time_ms);
});

t('learnFromEvent acumula 10 amostras → tupla aprendida com rt estabilizado', () => {
  let profiles = {};
  for (let i = 0; i < 10; i++) {
    profiles = learnFromEvent(makeEvent({ timestamp: 1000 + i * 100 }), profiles);
  }
  const key = tupleKey('p1', 'car-1', 4, 't-reta');
  assert(profiles[key].sample_count === 10);
  assert(Math.abs(profiles[key].reaction_time_ms - 150) < 5, 'rt deveria convergir pra 150, foi ' + profiles[key].reaction_time_ms);
});

t('learnFromEvent: alpha suave — mudança bounded entre eventos consecutivos', () => {
  // Usar rate alto pra que delta_rpm seja sensível
  let profiles = {};
  // Sequência de observações entre 140ms e 160ms (variação ±10ms)
  const observations = [
    { rpm_at_shift: 6790, target_visual_rpm: 6500, rpm_rise_rate: 2000 }, // 145ms
    { rpm_at_shift: 6810, target_visual_rpm: 6500, rpm_rise_rate: 2000 }, // 155ms
    { rpm_at_shift: 6800, target_visual_rpm: 6500, rpm_rise_rate: 2000 }, // 150ms
  ];
  let prevComp = null;
  for (const o of observations) {
    profiles = learnFromEvent(makeEvent(o), profiles);
    const key = tupleKey('p1', 'car-1', 4, 't-reta');
    const rt = profiles[key].reaction_time_ms;
    const comp = rt * 2000 / 1000; // rpm
    if (prevComp != null) {
      assert(Math.abs(comp - prevComp) <= 50, 'mudança em compensação_rpm: ' + Math.abs(comp - prevComp));
    }
    prevComp = comp;
  }
});

t('learnFromEvent: eventos em tuplas distintas não interferem', () => {
  let profiles = {};
  profiles = learnFromEvent(makeEvent({ trecho_id: 't-A' }), profiles);
  profiles = learnFromEvent(makeEvent({ trecho_id: 't-B' }), profiles);
  assert(profiles[tupleKey('p1', 'car-1', 4, 't-A')]);
  assert(profiles[tupleKey('p1', 'car-1', 4, 't-B')]);
  assert(profiles[tupleKey('p1', 'car-1', 4, 't-A')].sample_count === 1);
  assert(profiles[tupleKey('p1', 'car-1', 4, 't-B')].sample_count === 1);
});

// ─── computeCompensation ─────────────────────────────────────────────────

t('computeCompensation: tupla com <10 samples → default', () => {
  const profiles = {
    [tupleKey('p1','car-1',4,'t-reta')]: { reaction_time_ms: 200, sample_count: 5 }
  };
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 4, trecho_id: 't-reta', rpmRiseRate: 4000, profiles });
  assert(r.source === 'default', 'source: ' + r.source);
  assert(r.rt_ms === REACTION_CONSTANTS.DEFAULT_RT_MS);
});

t('computeCompensation: tupla exata com ≥10 samples → exact', () => {
  const profiles = {
    [tupleKey('p1','car-1',4,'t-reta')]: { reaction_time_ms: 180, sample_count: 12 }
  };
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 4, trecho_id: 't-reta', rpmRiseRate: 4000, profiles });
  assert(r.source === 'exact');
  assert(r.rt_ms === 180);
  assert(Math.abs(r.compensation_rpm - 720) < 0.01, 'comp_rpm esperado 720, foi ' + r.compensation_rpm);
});

t('computeCompensation: fallback piloto-carro-gear quando trecho não tem dados', () => {
  const profiles = {
    [tupleKey('p1','car-1',4,null)]: { reaction_time_ms: 220, sample_count: 15 }
  };
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 4, trecho_id: 't-novo', rpmRiseRate: 4000, profiles });
  assert(r.source === 'piloto-carro-gear', 'source: ' + r.source);
  assert(r.rt_ms === 220);
});

t('computeCompensation: fallback piloto-carro quando gear/trecho ausentes', () => {
  const profiles = {
    [tupleKey('p1','car-1',null,null)]: { reaction_time_ms: 260, sample_count: 11 }
  };
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 5, trecho_id: 't-x', rpmRiseRate: 4000, profiles });
  assert(r.source === 'piloto-carro');
  assert(r.rt_ms === 260);
});

t('computeCompensation: modo learning → 0', () => {
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 4, trecho_id: 't', rpmRiseRate: 4000, profiles: {}, mode: 'learning' });
  assert(r.source === 'learning_mode');
  assert(r.compensation_rpm === 0);
});

t('computeCompensation: rate inválido → 0', () => {
  const r = computeCompensation({ piloto_id: 'p1', carro_id: 'car-1', gear: 4, trecho_id: 't', rpmRiseRate: NaN, profiles: {}, mode: 'assisted' });
  assert(r.source === 'invalid_rate');
});

// ─── Hook em shift-target.js ─────────────────────────────────────────────

t('shift-target: sem reactionCtx → visualRpm == optimalRpm', () => {
  const r = computeShiftTarget({ car, gear: 3, gearConfidence: 0.9 });
  assert(r.visualRpm === r.optimalRpm);
});

t('shift-target: com reactionCtx + tupla com ≥10 samples → visualRpm < optimalRpm', () => {
  const profiles = {
    [tupleKey('p1','car-1',3,'t-reta')]: { reaction_time_ms: 200, sample_count: 12 }
  };
  const r = computeShiftTarget({
    car: { ...car, learned_targets: { 3: { optimal_rpm: 6700 } } },
    gear: 3, gearConfidence: 0.9,
    reactionCtx: { piloto_id: 'p1', carro_id: 'car-1', trecho_id: 't-reta', rpmRiseRate: 4000, profiles }
  });
  assert(r.optimalRpm === 6700);
  assert(r.visualRpm < r.optimalRpm, 'visual deveria ser menor que optimal: ' + r.visualRpm);
  assert(r.reactionSource === 'exact');
});

t('shift-target: reactionCtx mas tupla sem samples → visualRpm == optimalRpm (default não aplica)', () => {
  const r = computeShiftTarget({
    car: { ...car, learned_targets: { 3: { optimal_rpm: 6700 } } },
    gear: 3, gearConfidence: 0.9,
    reactionCtx: { piloto_id: 'p1', carro_id: 'car-1', trecho_id: 't-novo', rpmRiseRate: 4000, profiles: {} }
  });
  assert(r.visualRpm === r.optimalRpm, 'sem samples não aplica compensação');
  assert(r.reactionSource === 'default');
});

// ─── reaction-profiles Dexie ─────────────────────────────────────────────

t('reaction-profiles: save/load/all/clear', async () => {
  await clearProfiles();
  const key = tupleKey('p1', 'car-1', 4, 't-reta');
  await saveProfile({ key, reaction_time_ms: 230, sample_count: 12 });
  const loaded = await loadProfile(key);
  assert(loaded && loaded.reaction_time_ms === 230);
  assert(loaded.sample_count === 12);

  // Update (mesma key) não duplica
  await saveProfile({ key, reaction_time_ms: 240, sample_count: 13 });
  const all = await loadAllProfiles();
  assert(Object.keys(all).length === 1);
  assert(all[key].reaction_time_ms === 240);
  await clearProfiles();
  assert(Object.keys(await loadAllProfiles()).length === 0);
});

// ─── Runner ──────────────────────────────────────────────────────────────

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[pilot-reaction.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
