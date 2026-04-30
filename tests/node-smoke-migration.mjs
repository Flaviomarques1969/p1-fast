// Teste de migração v7→v8 (T-007/T-009).
// Valida:
//  1. Upgrade v7→v8 é aditivo (preserva dados em ++id, adiciona índice uid)
//  2. Campo uid gerado pelo domínio é indexável e estável
//  3. Round-trip v8→close→open preserva contagens

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

await t('Migration v7→v8 aditiva: dados ++id preservados + índice uid disponível', async () => {
  const dbName = 'migration-test-' + Math.random().toString(36).slice(2);
  // 1. Cria DB v7 com dados
  const dbV7 = new Dexie(dbName);
  dbV7.version(7).stores({
    lapValidityEvents: '++id, lapId, tipo, timestamp',
    segmentExecutions: '++id, sessionId, lapId, segmentId',
    deviceHandovers:   '++id, sessionId, toDeviceId, timestamp',
  });
  await dbV7.open();
  await dbV7.lapValidityEvents.bulkAdd([
    { lapId: 'lap_1', tipo: 'created', timestamp: 1000 },
    { lapId: 'lap_1', tipo: 'invalidated', timestamp: 2000, meta: { motivo: 'manual' } },
  ]);
  await dbV7.segmentExecutions.bulkAdd([
    { sessionId: 'ses_1', lapId: 'lap_1', segmentId: 'seg_A', tempoMs: 5000 },
  ]);
  await dbV7.deviceHandovers.bulkAdd([
    { sessionId: 'ses_1', fromDeviceId: null, toDeviceId: 'dev_1', timestamp: 500 },
  ]);
  dbV7.close();

  // 2. Abre com v8 (adiciona índice `uid`) — sem transformação, só schema aditivo
  const dbV8 = new Dexie(dbName);
  dbV8.version(7).stores({
    lapValidityEvents: '++id, lapId, tipo, timestamp',
    segmentExecutions: '++id, sessionId, lapId, segmentId',
    deviceHandovers:   '++id, sessionId, toDeviceId, timestamp',
  });
  dbV8.version(8).stores({
    lapValidityEvents: '++id, uid, lapId, tipo, timestamp',
    segmentExecutions: '++id, uid, sessionId, lapId, segmentId',
    deviceHandovers:   '++id, uid, sessionId, toDeviceId, timestamp',
  });
  await dbV8.open();

  // 3. Contagens preservadas
  if (await dbV8.lapValidityEvents.count() !== 2) throw new Error('lve count mudou');
  if (await dbV8.segmentExecutions.count() !== 1) throw new Error('sex count mudou');
  if (await dbV8.deviceHandovers.count() !== 1) throw new Error('ho count mudou');

  // 4. Adiciona row nova com uid field preenchido e confirma busca
  await dbV8.lapValidityEvents.add({
    uid: 'lve_test_123',
    lapId: 'lap_1',
    tipo: 'revalidated',
    timestamp: 3000,
  });
  const byUid = await dbV8.lapValidityEvents.where('uid').equals('lve_test_123').first();
  if (!byUid) throw new Error('busca por uid falhou');
  if (byUid.tipo !== 'revalidated') throw new Error('row corrompida');

  dbV8.close();
  await Dexie.delete(dbName);
});

await t('Round-trip v8 preserva contagens e uid', async () => {
  const dbName = 'roundtrip-v8-' + Math.random().toString(36).slice(2);
  const { uid } = await import('../src/core/id.js');
  const db = new Dexie(dbName);
  db.version(8).stores({
    lapValidityEvents: '++id, uid, lapId, tipo, timestamp',
  });
  await db.open();
  const uids = [uid('lve'), uid('lve'), uid('lve')];
  await db.lapValidityEvents.bulkAdd(uids.map((u, i) => ({ uid: u, lapId: 'lap_a', tipo: 'created', timestamp: i })));
  const antes = await db.lapValidityEvents.count();
  db.close();

  const db2 = new Dexie(dbName);
  db2.version(8).stores({
    lapValidityEvents: '++id, uid, lapId, tipo, timestamp',
  });
  await db2.open();
  const depois = await db2.lapValidityEvents.count();
  if (antes !== 3) throw new Error('antes=' + antes);
  if (depois !== 3) throw new Error('depois=' + depois);
  for (const u of uids) {
    const row = await db2.lapValidityEvents.where('uid').equals(u).first();
    if (!row) throw new Error('uid perdido: ' + u);
  }
  db2.close();
  await Dexie.delete(dbName);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
