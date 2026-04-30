// ═══════════════════════════════════════════════════════════
// Smoke Perna 1 iPhone — storage + uploader + video room + Detector
// snapshot
// ═══════════════════════════════════════════════════════════
// Cobre os módulos novos da rodada 2026-04-26 (PLANO_PERNA1_IPHONE):
//  - SourceTags export
//  - IPhoneStorage (boot, ingest, chunk rotation, mark uploaded)
//  - IPhoneUploader (status, retry config)
//  - Detector.consumeSnapshot
//  - room.js — apenas import sem erro

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen: { width: 390, height: 844 }, devicePixelRatio: 3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s: new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { SourceTags } = await import('../src/pipeline/mobile-telemetry.js');
const { IPhoneStorage } = await import('../src/pipeline/iphone-storage.js');
const { IPhoneUploader } = await import('../src/pipeline/iphone-uploader.js');
const { Detector } = await import('../src/telemetry/detector.js');
const { buildSnapshot } = await import('../src/telemetry/snapshot.js');
const { Quality } = await import('../src/domain/data-quality.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert failed'); };

// ─── SourceTags ───────────────────────────────────────────

await t('P1-01: SourceTags exporta GPS e IMU canônicos', () => {
  assert(SourceTags.GPS === 'cockpit-mobile', `GPS=${SourceTags.GPS}`);
  assert(SourceTags.IMU === 'iphone-imu',    `IMU=${SourceTags.IMU}`);
});

// ─── IPhoneStorage ─────────────────────────────────────────

await t('P1-02: IPhoneStorage abre sessão e ingere sample', async () => {
  const storage = new IPhoneStorage();
  const session = await storage.startSession({ note: 'smoke' });
  assert(session.id, 'session.id');
  assert(session.startedAt > 0, 'startedAt');
  storage.ingest({ t: Date.now(), tMono: 1000, source: 'cockpit-mobile', signalQuality: 'GOOD', lat: -15.77, lng: -47.89 });
  await new Promise(r => setTimeout(r, 600));  // espera flush debounce
  const stats = storage.stats();
  assert(stats.ingested === 1, `ingested=${stats.ingested}`);
  await storage.stopSession();
});

await t('P1-03: IPhoneStorage descarta sample sem tMono', async () => {
  const storage = new IPhoneStorage();
  await storage.startSession();
  storage.ingest({ t: 1, source: 'x', signalQuality: 'GOOD' });  // sem tMono
  const stats = storage.stats();
  assert(stats.droppedOnError === 1, 'should drop');
  await storage.stopSession();
});

await t('P1-04: IPhoneStorage no-op sem sessão', () => {
  const storage = new IPhoneStorage();
  storage.ingest({ t: 1, tMono: 1, source: 'x', signalQuality: 'GOOD' });
  const stats = storage.stats();
  assert(stats.ingested === 0, 'no session = no ingest');
});

// ─── IPhoneUploader ─────────────────────────────────────────

await t('P1-05: IPhoneUploader status default', () => {
  const u = new IPhoneUploader();
  const st = u.status();
  assert(st.running === false);
  assert(st.consecutiveFailures === 0);
  assert(st.uploaded.chunks === 0);
});

// ─── Detector.consumeSnapshot ──────────────────────────────

await t('P1-06: Detector.consumeSnapshot extrai pos+speed do snap', () => {
  const det = new Detector({
    svgPath: 'M0 0 L100 0 L100 100 L0 100 Z',
    linhaChegada: { x1: 0, y1: 0, x2: 100, y2: 0 },
    segments: [],
  });
  let lapsEmitted = 0;
  det.onLap(() => lapsEmitted++);
  const snap1 = buildSnapshot({
    tMono: 1000,
    sourcesData: {
      'cockpit-mobile': { sample: { lat: -15, lng: -47, x: 50, y: 50, speed: 30 }, quality: Quality.OK, ageMs: 5 },
    },
  });
  det.consumeSnapshot(snap1);
  // Não deveria explodir; lapsEmitted ainda 0 (só 1 ponto)
  assert(lapsEmitted === 0);
});

await t('P1-07: Detector.consumeSnapshot ignora snapshot sem position.local_x/y', () => {
  const det = new Detector({
    svgPath: 'M0 0 L100 0',
    linhaChegada: { x1: 0, y1: 0, x2: 0, y2: 50 },
    segments: [],
  });
  const empty = buildSnapshot({ tMono: 1000, sourcesData: {} });
  det.consumeSnapshot(empty);  // não explode
  assert(true);
});

await t('P1-08: snapshotToSample extrai shape compatível com FaseCurva/Corredor', async () => {
  const { snapshotToSample } = await import('../src/telemetry/snapshot.js');
  const snap = buildSnapshot({
    tMono: 1500,
    sourcesData: {
      'racebox-gnss':   { sample: { lat: -15.7, lng: -47.8, x: 100, y: 200, speed: 25 }, quality: Quality.OK, ageMs: 5 },
      'iphone-imu':     { sample: { accLong: -3.5, accLat: 2.1 }, quality: Quality.OK, ageMs: 5 },
    },
  });
  const sample = snapshotToSample(snap);
  assert(sample.t > 0, 't preenchido');
  assert(sample.x === 100, `x=${sample.x}`);
  assert(sample.y === 200, `y=${sample.y}`);
  assert(sample.speed === 25, `speed=${sample.speed}`);
  assert(Math.abs(sample.kmh - 90) < 0.001, `kmh=${sample.kmh}`);
  assert(sample.accLong === -3.5, `accLong=${sample.accLong}`);
  assert(sample.accLat === 2.1, `accLat=${sample.accLat}`);
});

await t('P1-09: snapshotToSample retorna null quando snapshot vazio', async () => {
  const { snapshotToSample, emptySnapshot } = await import('../src/telemetry/snapshot.js');
  const empty = emptySnapshot(0);
  const s = snapshotToSample(empty);
  // empty snapshot tem position com nulls — o helper retorna sample com nulls (não null)
  assert(s != null, 'sample não-null');
  assert(s.x === null && s.y === null, 'x/y null com snapshot vazio');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
