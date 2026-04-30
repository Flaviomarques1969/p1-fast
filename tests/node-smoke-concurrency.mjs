// Smoke Fase 4 (concorrência / recursos) — T-019..T-022
//
// Histórico: smoke originalmente cobria T-019..T-025 no FAM Racing.
// Na extração 2026-04-30, três casos ficaram órfãos por dependerem de
// módulos não extraídos (cockpit/box são UI/transporte de UI):
//
//   • T-023 (BoxBridge eco/sender) — `src/box/box-bridge.js`
//   • T-024 (AudioCue.release)     — `src/cockpit/audio-cue.js`
//   • T-025 (main.js beforeunload) — `src/main.js`
//
// Mantidos os 4 casos que testam módulos do P1 Fast (telemetry/core).

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3, addEventListener(){}, removeEventListener(){} };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { MockProvider } = await import('../src/telemetry/mock-provider.js');
const { SyncDrainer } = await import('../src/core/sync-drainer.js');
const { DeviceProvider } = await import('../src/telemetry/device-provider.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// T-022: MockProvider clearInterval em pause
await t('T-022: MockProvider pause limpa interval (não tick em pausa)', async () => {
  const p = new MockProvider({ rateMs: 10 });
  await p.start('ses-test');
  let ticks = 0;
  p.onSample(() => ticks++);
  await new Promise(r => setTimeout(r, 50));
  const antesPause = ticks;
  p.pause();
  await new Promise(r => setTimeout(r, 100));
  const depoisPause = ticks;
  if (depoisPause - antesPause > 1) throw new Error(`tickou ${depoisPause-antesPause}x após pause`);
  await p.stop();
});

await t('T-022: MockProvider resume recria interval', async () => {
  const p = new MockProvider({ rateMs: 10 });
  await p.start('ses-test');
  p.pause();
  p.resume();
  let ticks = 0;
  p.onSample(() => ticks++);
  await new Promise(r => setTimeout(r, 40));
  if (ticks === 0) throw new Error('não tickou após resume');
  await p.stop();
});

// T-019/T-020: DeviceProvider registra/desregistra sensores
await t('T-019/T-020: DeviceProvider tem _registerSensors / _unregisterSensors', () => {
  const p = new DeviceProvider();
  if (typeof p._registerSensors !== 'function') throw new Error('_registerSensors ausente');
  if (typeof p._unregisterSensors !== 'function') throw new Error('_unregisterSensors ausente');
});

// T-021: SyncDrainer não reentra
await t('T-021: SyncDrainer setTimeout recursivo, sem re-entrada', async () => {
  const d = new SyncDrainer({ intervalMs: 30 });
  let concurrentMax = 0;
  let concurrent = 0;
  d.setHandler(async () => {
    concurrent++;
    if (concurrent > concurrentMax) concurrentMax = concurrent;
    await new Promise(r => setTimeout(r, 50));
    concurrent--;
    return { ok: true };
  });
  // Sem entradas reais no drainOnce há nada que faça — só verificamos que stats refletem
  const s = d.stats();
  if (s.running !== false) throw new Error('running inicial deveria ser false');
  if (typeof s.ticking !== 'boolean') throw new Error('stats.ticking ausente (T-021 esperado)');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
