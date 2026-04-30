// ═══════════════════════════════════════════════════════════
// Smoke Detector via snapshot — AdaptiveTick + SessionRecorder mode=snapshot
// ═══════════════════════════════════════════════════════════
// Cobre achado #4 da auditoria 2026-04-28 (Flavio aprovou D1 adaptativo +
// D2 routing por severidade em 2026-04-29):
//   - createAdaptiveTick: high quando há fast healthy source, low caso contrário
//   - SessionRecorder mode='snapshot': consumeSnapshot + extraConsumers
//   - SessionRecorder mode='sample' (legacy) preservado — não regride
//   - extraConsumer com erro não derruba detector

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen: { width: 390, height: 844 }, devicePixelRatio: 3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s: new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { createAdaptiveTick } = await import('../src/telemetry/adaptive-tick.js');
const { SessionRecorder }    = await import('../src/telemetry/session-recorder.js');
const { Detector }           = await import('../src/telemetry/detector.js');
const { buildSnapshot }      = await import('../src/telemetry/snapshot.js');
const { Quality }            = await import('../src/domain/data-quality.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert failed'); };

// ─── Fake Timebase pra controlar tick manualmente ─────────────
function makeFakeTimebase({ status = {} } = {}) {
  const tickers = [];   // [{ rate, cbs: Set<Fn> }]
  return {
    sourceStatus: () => status,
    onTick(rate, cb) {
      let entry = tickers.find(e => e.rate === rate);
      if (!entry) { entry = { rate, cbs: new Set() }; tickers.push(entry); }
      entry.cbs.add(cb);
      return () => entry.cbs.delete(cb);
    },
    // Util de teste — dispara tick manualmente na taxa atual.
    fireTick(rate, snap) {
      const entry = tickers.find(e => e.rate === rate);
      if (!entry) return 0;
      let n = 0;
      for (const cb of entry.cbs) { cb(snap); n++; }
      return n;
    },
    activeRates: () => tickers.filter(e => e.cbs.size > 0).map(e => e.rate),
  };
}

function makeFastHealthyStatus() {
  return {
    'iphone-imu': { source: 'iphone-imu', expectedRateHz: 60, ratePerSec: 55, quality: Quality.OK, ageMs: 5 },
    'cockpit-mobile': { source: 'cockpit-mobile', expectedRateHz: 1, ratePerSec: 1, quality: Quality.OK, ageMs: 50 },
  };
}
function makeDegradedStatus() {
  return {
    'iphone-imu': { source: 'iphone-imu', expectedRateHz: 60, ratePerSec: 12, quality: Quality.LATE, ageMs: 250 },
    'cockpit-mobile': { source: 'cockpit-mobile', expectedRateHz: 1, ratePerSec: 1, quality: Quality.OK, ageMs: 50 },
  };
}

// ─── AdaptiveTick ──────────────────────────────────────────────

await t('AT-01: começa em low e sobe pra high quando há fast healthy source', () => {
  const tb = makeFakeTimebase({ status: makeFastHealthyStatus() });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });   // não auto-roda
  ctl.start();
  // start() já chama evaluateNow() internamente — deve subir pra 60
  assert(ctl.currentRate() === 60, `esperava 60, foi ${ctl.currentRate()}`);
  ctl.stop();
});

await t('AT-02: fica em low quando IMU está LATE/degradado', () => {
  const tb = makeFakeTimebase({ status: makeDegradedStatus() });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  ctl.start();
  assert(ctl.currentRate() === 10, `esperava 10, foi ${ctl.currentRate()}`);
  ctl.stop();
});

await t('AT-03: troca dinâmica via evaluateNow após status mudar', () => {
  const status = makeDegradedStatus();
  const tb = makeFakeTimebase({ status });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  ctl.start();
  assert(ctl.currentRate() === 10);
  // Status melhora → fast healthy
  Object.assign(status, makeFastHealthyStatus());
  ctl.evaluateNow();
  assert(ctl.currentRate() === 60, `esperava 60 após upgrade, foi ${ctl.currentRate()}`);
  // Status piora de novo
  Object.assign(status, makeDegradedStatus());
  ctl.evaluateNow();
  assert(ctl.currentRate() === 10, `esperava 10 após downgrade, foi ${ctl.currentRate()}`);
  ctl.stop();
});

await t('AT-04: subscribers recebem snapshots redistribuídos', () => {
  const tb = makeFakeTimebase({ status: makeFastHealthyStatus() });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  let recv = [];
  ctl.onTick(s => recv.push(s));
  ctl.start();   // sobe pra 60
  const fakeSnap = { tMono: 1000, marker: 'A' };
  tb.fireTick(60, fakeSnap);
  assert(recv.length === 1 && recv[0].marker === 'A', `recv=${recv.length}`);
  ctl.stop();
});

await t('AT-05: stop limpa subscribers e remove inscrição do timebase', () => {
  const tb = makeFakeTimebase({ status: makeFastHealthyStatus() });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  ctl.onTick(() => {});
  ctl.start();
  assert(tb.activeRates().length === 1);
  ctl.stop();
  assert(tb.activeRates().length === 0, `ainda ativo: ${tb.activeRates()}`);
});

await t('AT-06: fonte com Quality.MISSING não conta como rápida saudável', () => {
  const tb = makeFakeTimebase({
    status: {
      'iphone-imu': { source: 'iphone-imu', expectedRateHz: 60, ratePerSec: 0, quality: Quality.MISSING, ageMs: 5000 },
    },
  });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  ctl.start();
  assert(ctl.currentRate() === 10, `MISSING deveria forçar low; foi ${ctl.currentRate()}`);
  ctl.stop();
});

await t('AT-07: fonte com quality=OK mas ratePerSec abaixo do floor cai pra low', () => {
  const tb = makeFakeTimebase({
    status: {
      'iphone-imu': { source: 'iphone-imu', expectedRateHz: 60, ratePerSec: 35, quality: Quality.OK, ageMs: 5 },
      // 35 < 60 × 0.7 = 42 → não conta como saudável
    },
  });
  const ctl = createAdaptiveTick(tb, { evalIntervalMs: 999_999 });
  ctl.start();
  assert(ctl.currentRate() === 10, `ratePerSec abaixo do floor deveria forçar low; foi ${ctl.currentRate()}`);
  ctl.stop();
});

// ─── SessionRecorder mode=snapshot ─────────────────────────────

function makeMockDetector() {
  let consumeSnapCount = 0;
  let consumeCount = 0;
  return {
    consumeSnapshot: (s) => { consumeSnapCount++; return s; },
    consume: (s) => { consumeCount++; return s; },
    onLap: (cb) => { /* noop */ return () => {}; },
    onSegmentEnd: (cb) => { return () => {}; },
    counts: () => ({ snap: consumeSnapCount, sample: consumeCount }),
  };
}

await t('SR-01: mode=snapshot chama detector.consumeSnapshot a cada tick', () => {
  const tb = makeFakeTimebase({ status: makeDegradedStatus() });   // → 10Hz
  const det = makeMockDetector();
  const rec = new SessionRecorder({
    mode: 'snapshot', sessionId: 's1', detector: det, timebase: tb,
    tickOpts: { evalIntervalMs: 999_999 },
  });
  rec.start();
  const snap = { tMono: 1000, position: { local_x: 10, local_y: 20 } };
  tb.fireTick(10, snap);
  tb.fireTick(10, snap);
  assert(det.counts().snap === 2, `snap=${det.counts().snap}`);
  assert(det.counts().sample === 0, 'sample mode não deveria ser usado');
  rec.stop();
});

await t('SR-02: extraConsumers recebem o mesmo snapshot', () => {
  const tb = makeFakeTimebase({ status: makeDegradedStatus() });
  const det = makeMockDetector();
  let xvCount = 0;
  let xvCount2 = 0;
  const rec = new SessionRecorder({
    mode: 'snapshot', sessionId: 's2', detector: det, timebase: tb,
    extraConsumers: [(s) => xvCount++, (s) => xvCount2++],
    tickOpts: { evalIntervalMs: 999_999 },
  });
  rec.start();
  tb.fireTick(10, { tMono: 1000, position: { local_x: 0, local_y: 0 } });
  assert(det.counts().snap === 1);
  assert(xvCount === 1, `xvCount=${xvCount}`);
  assert(xvCount2 === 1);
  rec.stop();
});

await t('SR-03: extraConsumer com erro não derruba detector nem outros consumers', () => {
  const tb = makeFakeTimebase({ status: makeDegradedStatus() });
  const det = makeMockDetector();
  let goodConsumerHits = 0;
  const rec = new SessionRecorder({
    mode: 'snapshot', sessionId: 's3', detector: det, timebase: tb,
    extraConsumers: [
      () => { throw new Error('boom'); },
      () => { goodConsumerHits++; },
    ],
    tickOpts: { evalIntervalMs: 999_999 },
  });
  rec.start();
  tb.fireTick(10, { tMono: 1000, position: { local_x: 0, local_y: 0 } });
  assert(det.counts().snap === 1, 'detector deveria ter sido chamado mesmo com extraConsumer falhando');
  assert(goodConsumerHits === 1, 'consumer bom deveria continuar rodando');
  rec.stop();
});

await t('SR-04: mode=snapshot sem timebase rejeita', () => {
  const det = makeMockDetector();
  let threw = false;
  try {
    new SessionRecorder({ mode: 'snapshot', sessionId: 's4', detector: det });
  } catch { threw = true; }
  assert(threw, 'deveria ter lançado');
});

await t('SR-05: mode inválido rejeita', () => {
  const det = makeMockDetector();
  let threw = false;
  try {
    new SessionRecorder({ mode: 'foo', sessionId: 's5', detector: det });
  } catch { threw = true; }
  assert(threw);
});

// ─── SessionRecorder mode=sample (legacy preservado) ─────────────

await t('SR-06: mode=sample (default) preserva comportamento legacy', () => {
  // Mock provider tipo sampleBus
  const listeners = new Set();
  const provider = {
    onSample: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    emit: (s) => { for (const cb of listeners) cb(s); },
  };
  const det = makeMockDetector();
  const rec = new SessionRecorder({ provider, detector: det, sessionId: 's6' });
  // sem mode → default 'sample'
  assert(rec.mode === 'sample', `mode=${rec.mode}`);
  rec.start();
  provider.emit({ x: 1, y: 2, t: 100 });
  provider.emit({ x: 3, y: 4, t: 200 });
  assert(det.counts().sample === 2, `sample=${det.counts().sample}`);
  assert(det.counts().snap === 0, 'snapshot não deveria ter sido chamado');
  rec.stop();
});

await t('SR-07: stop fecha tick controller e libera referência', () => {
  const tb = makeFakeTimebase({ status: makeDegradedStatus() });
  const det = makeMockDetector();
  const rec = new SessionRecorder({
    mode: 'snapshot', sessionId: 's7', detector: det, timebase: tb,
    tickOpts: { evalIntervalMs: 999_999 },
  });
  rec.start();
  assert(tb.activeRates().length === 1);
  const result = rec.stop();
  assert(result.ok === true);
  assert(tb.activeRates().length === 0, 'tick deveria ter sido removido');
  assert(rec.stats().state === 'stopped');
});

// ─── Integração: AdaptiveTick + SessionRecorder + Detector real + xVal ─────

await t('SR-08: integração — adapt sobe pra 60 e detector + xv recebem snap', async () => {
  const { Detector: RealDetector } = await import('../src/telemetry/detector.js');
  const { CrossValidationEngine } = await import('../src/telemetry/cross-validation.js');
  const tb = makeFakeTimebase({ status: makeFastHealthyStatus() });
  const det = new RealDetector({
    svgPath: 'M0 0 L100 0 L100 100 L0 100 Z',
    linhaChegada: { x1: 0, y1: 0, x2: 100, y2: 0 },
    segments: [],
  });
  let xvEvents = [];
  const xv = new CrossValidationEngine({ onEvent: ev => xvEvents.push(ev) });
  const rec = new SessionRecorder({
    mode: 'snapshot', sessionId: 's8', detector: det, timebase: tb,
    extraConsumers: [(s) => xv.consume(s)],
    tickOpts: { evalIntervalMs: 999_999 },
  });
  rec.start();
  // Status fast → adapter subiu pra 60Hz
  assert(rec.stats().currentTickRate === 60, `tick=${rec.stats().currentTickRate}`);

  // Snapshot benigno (sem divergência) — não deve emitir xv events
  const snapOk = buildSnapshot({
    tMono: 1000,
    sourcesData: {
      'racebox-gnss': { sample: { lat: -15, lng: -47, x: 50, y: 50, speed: 30 }, quality: Quality.OK, ageMs: 5 },
    },
  });
  tb.fireTick(60, snapOk);
  assert(xvEvents.length === 0, `inesperado xv=${xvEvents.length}`);

  rec.stop();
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
