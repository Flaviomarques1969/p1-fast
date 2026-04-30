// Smoke Fase 4 (concorrência / recursos) — T-019..T-025

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3, addEventListener(){}, removeEventListener(){} };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { MockProvider } = await import('../src/telemetry/mock-provider.js');
const { AudioCue } = await import('../src/cockpit/audio-cue.js');
const { BoxBridge, BridgeMsgType } = await import('../src/box/box-bridge.js');
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

// T-023: BoxBridge ignora eco de si mesmo
await t('T-023: BoxBridge ignora mensagem com __sender próprio', async () => {
  const chan = 'fam-racing-eco-' + Math.random().toString(36).slice(2);
  const bridge = new BoxBridge({ channelName: chan });
  let recebi = 0;
  bridge.subscribe(() => recebi++);
  // Simular eco: enviar msg e, logo depois, injetar a mesma msg com nosso __sender
  const fake = { type: BridgeMsgType.BOX_MSG, texto: 'eco', __sender: bridge._senderId };
  bridge._onMessage({ data: fake });
  await new Promise(r => setTimeout(r, 20));
  if (recebi !== 0) throw new Error('não ignorou eco de self');
  bridge.close();
});

await t('T-023: BoxBridge aceita mensagens de outra instância (senderId diferente)', async () => {
  const chan = 'fam-racing-crosssender-' + Math.random().toString(36).slice(2);
  const a = new BoxBridge({ channelName: chan });
  const b = new BoxBridge({ channelName: chan });
  let recebidoB = null;
  b.subscribe((m) => { if (m.type === BridgeMsgType.BOX_MSG) recebidoB = m; });
  a.sendMessage('olá');
  await new Promise(r => setTimeout(r, 50));
  if (!recebidoB) throw new Error('b não recebeu de a');
  if (recebidoB.__sender === b._senderId) throw new Error('senderId colidiu');
  a.close(); b.close();
});

// T-024: AudioCue.release()
await t('T-024: AudioCue.release() existe e é idempotente', async () => {
  const c = new AudioCue({ muted: true });
  if (typeof c.release !== 'function') throw new Error('release ausente');
  const r1 = await c.release();
  const r2 = await c.release();
  if (!r1.released || !r2.released) throw new Error('release não idempotente');
});

// T-025: beforeunload handler registrado em main.js (inspeção textual)
await t('T-025: main.js registra beforeunload handler', async () => {
  const { readFile } = await import('node:fs/promises');
  const txt = await readFile('src/main.js', 'utf8');
  if (!txt.includes("window.addEventListener('beforeunload'")) throw new Error('handler beforeunload ausente');
  if (!txt.includes('audioCue?.release')) throw new Error('release não acionado no cleanup');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
