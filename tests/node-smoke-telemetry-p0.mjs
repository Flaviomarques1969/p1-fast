// ═══════════════════════════════════════════════════════════
// Smoke P0/P1 telemetria — TelemetryTimebase + SnapshotBuilder
//   + DataQuality 11 cat + CrossValidationEngine + CriticalRules
// ═══════════════════════════════════════════════════════════
// Cobre os 5 módulos novos da rodada 2026-04-26 (PENDENCIAS_GATE P0/P1).
// Cada validação tem fixture mínima + caso de regressão.
// Testes obrigatórios das Regras 9 das TELEMETRY_ENGINEERING_RULES.md.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen: { width: 390, height: 844 }, devicePixelRatio: 3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s: new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { TelemetryTimebase, DEFAULT_FRESHNESS_MS } = await import('../src/telemetry/timebase.js');
const { buildSnapshot, emptySnapshot } = await import('../src/telemetry/snapshot.js');
const { Quality, fromSignalQuality, fromGpsAccuracy, fromRangeCheck, worstOf, isOk, permitsCritical } = await import('../src/domain/data-quality.js');
const { CrossValidationEngine } = await import('../src/telemetry/cross-validation.js');
const { CriticalRulesEngine, CRITICAL_RULES, MANUAL_RULES, AlertLevel } = await import('../src/pipeline/critical-rules.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message, e.stack ? '\n' + e.stack.split('\n').slice(0, 4).join('\n') : ''); fail++; }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert failed'); };

// ─── DATA QUALITY (11 categorias) ──────────────────────────

await t('DQ-01: Quality tem 11 categorias canônicas (LOST aliasa MISSING)', () => {
  const expected = ['OK', 'SUSPECT', 'MISSING', 'LATE', 'OUT_OF_ORDER', 'INVALID_CHECKSUM',
                    'OUT_OF_RANGE', 'DUPLICATE', 'INTERPOLATED', 'ESTIMATED', 'LOW_CONFIDENCE'];
  for (const k of expected) {
    assert(Quality[k] != null, `Quality.${k} ausente`);
  }
  assert(Quality.LOST === Quality.MISSING, 'LOST deve aliasar MISSING');
});

await t('DQ-02: fromSignalQuality mapeia 4 → 11 corretamente', () => {
  assert(fromSignalQuality('good') === Quality.OK);
  assert(fromSignalQuality('degraded') === Quality.LOW_CONFIDENCE);
  assert(fromSignalQuality('bad') === Quality.SUSPECT);
  assert(fromSignalQuality('lost') === Quality.MISSING);
  assert(fromSignalQuality(null) === Quality.MISSING);
});

await t('DQ-03: fromGpsAccuracy aplica thresholds 5/20/50', () => {
  assert(fromGpsAccuracy(3) === Quality.OK);
  assert(fromGpsAccuracy(10) === Quality.LOW_CONFIDENCE);
  assert(fromGpsAccuracy(30) === Quality.SUSPECT);
  assert(fromGpsAccuracy(80) === Quality.MISSING);
  assert(fromGpsAccuracy(null) === Quality.MISSING);
});

await t('DQ-04: fromRangeCheck rotula OUT_OF_RANGE', () => {
  assert(fromRangeCheck(50, { min: 0, max: 100 }) === Quality.OK);
  assert(fromRangeCheck(150, { min: 0, max: 100 }) === Quality.OUT_OF_RANGE);
  assert(fromRangeCheck(-5, { min: 0, max: 100 }) === Quality.OUT_OF_RANGE);
  assert(fromRangeCheck(null, { min: 0, max: 100 }) === Quality.MISSING);
});

await t('DQ-05: worstOf devolve pior categoria por severidade', () => {
  assert(worstOf([Quality.OK, Quality.LATE, Quality.MISSING]) === Quality.MISSING);
  assert(worstOf([Quality.OK]) === Quality.OK);
  // LATE e LOW_CONFIDENCE têm mesma severidade (2) — basta retornar uma das duas
  const tied = worstOf([Quality.OK, Quality.LATE, Quality.LOW_CONFIDENCE]);
  assert(tied === Quality.LATE || tied === Quality.LOW_CONFIDENCE, `esperado LATE ou LOW_CONFIDENCE, veio ${tied}`);
  // INVALID_CHECKSUM mais grave que SUSPECT
  assert(worstOf([Quality.SUSPECT, Quality.INVALID_CHECKSUM]) === Quality.INVALID_CHECKSUM);
});

await t('DQ-06: isOk + permitsCritical respeitam Regra 4 (CRÍTICO precisa OK)', () => {
  assert(isOk(Quality.OK));
  assert(!isOk(Quality.LATE));
  assert(permitsCritical(Quality.OK));
  assert(!permitsCritical(Quality.LATE));
  assert(!permitsCritical(Quality.SUSPECT));
});

// ─── TELEMETRY TIMEBASE ────────────────────────────────────

await t('TB-01: attachSource registra fonte com freshness default', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'cockpit-mobile' });
  const status = tb.sourceStatus();
  assert(status['cockpit-mobile'] != null);
  assert(DEFAULT_FRESHNESS_MS['cockpit-mobile'] === 1500);
  tb.reset();
});

await t('TB-02: ingest aceita amostra e disponibiliza no snapshot', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'cockpit-mobile' });
  const tMono = 1000;
  tb.ingest({ source: 'cockpit-mobile', tMono, t: tMono, lat: -15.77, lng: -47.89, speed: 25, signalQuality: 'GOOD' });
  const snap = tb.snapshotAt(tMono);
  assert(snap.position.lat === -15.77, 'lat não bateu');
  assert(snap.position.lon === -47.89, 'lon não bateu');
  tb.reset();
});

await t('TB-03: 2 fontes em fase produzem snapshot consistente', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'racebox-gnss' });
  tb.attachSource({ source: 't4000' });
  tb.ingest({ source: 'racebox-gnss', tMono: 1000, t: 1000, lat: -15.77, lng: -47.89, speed: 30, signalQuality: 'GOOD' });
  tb.ingest({ source: 't4000', tMono: 1010, t: 1010, rpm: 6500, tps: 80, water_temp: 92, signalQuality: 'GOOD' });
  const snap = tb.snapshotAt(1015);
  assert(snap.position.lat === -15.77, 'gnss não populou position');
  assert(snap.engine.rpm === 6500, 't4000 não populou engine');
  assert(snap.vehicle.speed_gnss === 30);
  tb.reset();
});

await t('TB-04: fonte caída → canais MISSING, demais seguem', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'racebox-gnss', freshness: 100 });
  tb.attachSource({ source: 't4000', freshness: 100 });
  tb.ingest({ source: 't4000', tMono: 1000, t: 1000, rpm: 5000 });
  // racebox-gnss nunca recebeu — canais devem ser null/MISSING
  const snap = tb.snapshotAt(1010);
  assert(snap.engine.rpm === 5000);
  assert(snap.position.lat === null, 'lat deveria ser null');
  assert(snap.quality.missing_channels.includes('position.lat'));
  tb.reset();
});

await t('TB-05: fora de ordem é detectado e marcado', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'mock' });
  tb.ingest({ source: 'mock', tMono: 1000, t: 1000, speed: 10 });
  const r = tb.ingest({ source: 'mock', tMono: 950, t: 950, speed: 9 });
  assert(r.quality === Quality.OUT_OF_ORDER, 'esperado OUT_OF_ORDER');
  const status = tb.sourceStatus();
  assert(status['mock'].discardedOutOfOrder === 1);
  tb.reset();
});

await t('TB-06: duplicado é descartado', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'mock' });
  tb.ingest({ source: 'mock', tMono: 1000, t: 1000, speed: 10 });
  const r = tb.ingest({ source: 'mock', tMono: 1000, t: 1000, speed: 10 });
  assert(r.quality === Quality.DUPLICATE);
  assert(r.accepted === false);
  const status = tb.sourceStatus();
  assert(status['mock'].discardedDuplicate === 1);
  tb.reset();
});

await t('TB-07: latência alta marca canal como LATE no snapshot', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'mock', freshness: 100 });
  tb.ingest({ source: 'mock', tMono: 1000, t: 1000, speed: 10 });
  // Pede snapshot 250ms depois (2.5× freshness, ainda dentro de 3×)
  const snap = tb.snapshotAt(1250);
  assert(snap.quality.sync_quality === Quality.LATE, `esperado LATE, veio ${snap.quality.sync_quality}`);
  tb.reset();
});

await t('TB-08: gap longo (> 3× freshness) marca MISSING', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'mock', freshness: 100 });
  tb.ingest({ source: 'mock', tMono: 1000, t: 1000, speed: 10 });
  const snap = tb.snapshotAt(1500); // 5× freshness
  assert(snap.quality.sync_quality === Quality.MISSING, `esperado MISSING, veio ${snap.quality.sync_quality}`);
  tb.reset();
});

// ─── SNAPSHOT BUILDER ──────────────────────────────────────

await t('SB-01: snapshot é imutável (Object.freeze)', () => {
  const snap = emptySnapshot(0);
  let threw = false;
  try {
    snap.engine.rpm = 9999;
  } catch { threw = true; }
  // Em strict mode, throws; sem strict, falha silenciosa. Em qualquer caso, valor não muda.
  assert(snap.engine.rpm == null, 'rpm não deveria ter sido alterado');
  assert(Object.isFrozen(snap), 'snapshot deveria ser frozen');
  assert(Object.isFrozen(snap.engine), 'engine deveria ser frozen');
});

await t('SB-02: campo não-disponível é null (nunca 0, nunca "—")', () => {
  const snap = buildSnapshot({ tMono: 1000, sourcesData: {} });
  assert(snap.engine.rpm === null);
  assert(snap.position.lat === null);
  assert(snap.dynamics.accel_lateral === null);
});

await t('SB-03: speed_fused = média ponderada quando 2 fontes OK', () => {
  const snap = buildSnapshot({
    tMono: 1000,
    sourcesData: {
      't4000':         { sample: { speed_can: 30 }, quality: Quality.OK, ageMs: 5 },
      'racebox-gnss':  { sample: { speed: 32 },     quality: Quality.OK, ageMs: 5 },
    }
  });
  // 30 * 0.55 + 32 * 0.45 = 30.9
  assert(Math.abs(snap.vehicle.speed_fused - 30.9) < 0.01, `esperado 30.9, veio ${snap.vehicle.speed_fused}`);
});

await t('SB-04: confidence reflete pior qualidade ativa', () => {
  const snap = buildSnapshot({
    tMono: 1000,
    sourcesData: {
      'cockpit-mobile': { sample: { lat: -15, lng: -47 }, quality: Quality.OK, ageMs: 5 },
      't4000':          { sample: { rpm: 5000 },          quality: Quality.SUSPECT, ageMs: 5 },
    }
  });
  assert(snap.quality.confidence === 'Baixa', `esperado Baixa, veio ${snap.quality.confidence}`);
});

// ─── CROSS VALIDATION ──────────────────────────────────────

await t('XV-V001: divergência speed_can vs gnss > 5 km/h por > 2s emite evento', () => {
  const events = [];
  const engine = new CrossValidationEngine({ onEvent: e => events.push(e) });
  // Snapshot com divergência de 10 km/h ≈ 2.78 m/s
  const mkSnap = (tMono) => ({
    t: tMono, tMono,
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
    engine: {}, dynamics: {}, position: {},
    quality: { t4000_quality: Quality.OK, racebox_quality: Quality.OK, iphone_quality: null, sync_quality: Quality.OK }
  });
  for (let t = 1000; t < 4000; t += 100) engine.consume(mkSnap(t));
  assert(events.some(e => e.validation === 'V-001'), 'V-001 não disparou');
});

await t('XV-V006: pressão óleo baixa com RPM alto emite alerta CRÍTICO', () => {
  const events = [];
  const engine = new CrossValidationEngine({ onEvent: e => events.push(e) });
  for (let t = 1000; t < 4000; t += 100) {
    engine.consume({
      t, tMono: t,
      engine: { oil_pressure: 1.0, rpm: 5000, oil_temp: 90 },
      vehicle: {}, dynamics: {}, position: {},
      quality: { t4000_quality: Quality.OK, sync_quality: Quality.OK }
    });
  }
  const v6 = events.find(e => e.validation === 'V-006');
  assert(v6, 'V-006 não disparou');
  assert(v6.severity === 'critico', 'V-006 deveria ser crítico (press < 1.5 bar)');
});

await t('XV-cooldown: validação não dispara duas vezes dentro do cooldown', () => {
  const events = [];
  const engine = new CrossValidationEngine({ onEvent: e => events.push(e), cooldownMs: 30000 });
  const mkSnap = (tMono) => ({
    t: tMono, tMono,
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
    engine: {}, dynamics: {}, position: {},
    quality: { t4000_quality: Quality.OK, racebox_quality: Quality.OK, sync_quality: Quality.OK }
  });
  for (let t = 1000; t < 10000; t += 100) engine.consume(mkSnap(t));
  const v1Count = events.filter(e => e.validation === 'V-001').length;
  assert(v1Count <= 1, `cooldown 30s dentro de 9s deveria limitar a 1, veio ${v1Count}`);
});

// ─── CRITICAL RULES ────────────────────────────────────────

await t('CR-01: catálogo tem regras canônicas obrigatórias', () => {
  const ids = CRITICAL_RULES.map(r => r.id);
  for (const required of ['press-oleo-baixa', 'temp-motor-extrema', 'lambda-pobre-prolongado', 'bateria-baixa', 'falha-canal-telemetria']) {
    assert(ids.includes(required), `regra ${required} ausente`);
  }
});

await t('CR-02: pressão óleo < 1.0 bar dispara BOX_AGORA', () => {
  const alerts = [];
  const engine = new CriticalRulesEngine({ onAlert: a => alerts.push(a) });
  engine.consume({
    t: 1000, tMono: 1000,
    engine: { oil_pressure: 0.8, rpm: 5000 },
    quality: { t4000_quality: Quality.OK }
  });
  const a = alerts.find(x => x.id === 'press-oleo-baixa');
  assert(a, 'alerta não disparou');
  assert(a.nivel === AlertLevel.BOX_AGORA);
  assert(a.confianca === 'Alta');
  // 7 campos obrigatórios
  for (const f of ['nivel', 'descricao', 'causa_provavel', 'acao_imediata', 'quem_age', 'urgencia', 'confianca']) {
    assert(a[f] != null && a[f] !== '', `${f} ausente`);
  }
});

await t('CR-03: temp motor escalando de ATENCAO → CRITICO → BOX_AGORA', () => {
  const alerts = [];
  const engine = new CriticalRulesEngine({ onAlert: a => alerts.push(a) });
  // 100°C → ATENCAO
  engine.consume({ t: 1000, tMono: 1000, engine: { water_temp: 102 }, quality: { t4000_quality: Quality.OK } });
  // Avança cooldown (default 30s)
  engine.consume({ t: 31000, tMono: 31000, engine: { water_temp: 108 }, quality: { t4000_quality: Quality.OK } });
  engine.consume({ t: 61000, tMono: 61000, engine: { water_temp: 118 }, quality: { t4000_quality: Quality.OK } });
  const niveis = alerts.filter(a => a.id === 'temp-motor-extrema').map(a => a.nivel);
  assert(niveis.includes(AlertLevel.ATENCAO), 'ATENCAO ausente');
  assert(niveis.includes(AlertLevel.CRITICO), 'CRITICO ausente');
  assert(niveis.includes(AlertLevel.BOX_AGORA), 'BOX_AGORA ausente');
});

await t('CR-04: cooldown bloqueia repetição imediata', () => {
  const alerts = [];
  const engine = new CriticalRulesEngine({ onAlert: a => alerts.push(a) });
  // Mesma condição, 100ms apart
  for (let t = 1000; t < 5000; t += 100) {
    engine.consume({ t, tMono: t, engine: { oil_pressure: 0.5, rpm: 5000 }, quality: { t4000_quality: Quality.OK } });
  }
  const c = alerts.filter(a => a.id === 'press-oleo-baixa').length;
  assert(c === 1, `cooldown 10s dentro de 4s deveria limitar a 1, veio ${c}`);
});

await t('CR-05: regra ignorada se quality não-OK (Regra 4 ALERT_HIERARCHY)', () => {
  const alerts = [];
  const engine = new CriticalRulesEngine({ onAlert: a => alerts.push(a) });
  // pressão crítica MAS canal SUSPECT — não dispara
  engine.consume({
    t: 1000, tMono: 1000,
    engine: { oil_pressure: 0.5, rpm: 5000 },
    quality: { t4000_quality: Quality.SUSPECT }
  });
  assert(alerts.length === 0, 'CRÍTICO disparou com canal não-OK — quebra Regra 4');
});

await t('CR-06: fireManual dispara bandeira vermelha como BOX_AGORA', () => {
  const alerts = [];
  const engine = new CriticalRulesEngine({ onAlert: a => alerts.push(a) });
  engine.fireManual('bandeira-vermelha');
  assert(alerts.length === 1);
  assert(alerts[0].nivel === AlertLevel.BOX_AGORA);
});

await t('CR-07: regras manuais existem (3 mínimo)', () => {
  assert(MANUAL_RULES.length >= 3);
  for (const r of MANUAL_RULES) {
    for (const f of ['nivel', 'descricao', 'causa_provavel', 'acao_imediata', 'quem_age', 'urgencia', 'confianca']) {
      assert(r[f] != null, `manual rule ${r.id} sem ${f}`);
    }
  }
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
