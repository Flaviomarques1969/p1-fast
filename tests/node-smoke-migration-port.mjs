// T-042 / A-039 — amostras portadas de manual-tests.html para smoke Node
// Cobre fases 0, 1, 5, 6, 10, 11 (as mais acionáveis em Node sem DOM).

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3, addEventListener(){}, removeEventListener(){} };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { db } = await import('../src/core/db.js');
const { Users } = await import('../src/domain/user.js');
const { Cars } = await import('../src/domain/car.js');
const { Sessions, SessionStatus, SessionTipo } = await import('../src/domain/session.js');
const { Laps, InvalidationReason } = await import('../src/domain/lap.js');
const { Scores } = await import('../src/domain/score.js');
const { Repeatability } = await import('../src/domain/repeatability.js');
const { ErrorClassifier, ErroTipo } = await import('../src/domain/error-classifier.js');
const { uid } = await import('../src/core/id.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Fase 0: uid único com prefixo
await t('F0: uid(prefix) gera unicos + prefixo correto', () => {
  const a = uid('tst'); const b = uid('tst');
  if (a === b) throw new Error('colisão');
  if (!a.startsWith('tst_')) throw new Error('prefixo errado');
});

// Fase 0: user primary idempotente
await t('F0: Users.getOrCreatePrimary idempotente', async () => {
  const a = await Users.getOrCreatePrimary();
  const b = await Users.getOrCreatePrimary();
  if (a.id !== b.id) throw new Error('não idempotente');
});

// Fase 1: Cars.create + Sessions.create + Sessions.start
await t('F3: Session ciclo cria→start→finish', async () => {
  const u = await Users.getOrCreatePrimary();
  const c = await Cars.create({ userId: u.id, nome: 'T', marca: 'A', modelo: 'B' });
  const s = await Sessions.create({ userId: u.id, carId: c.id, trackId: 'trk-x', tipo: SessionTipo.TREINO });
  await Sessions.start(s.id);
  await new Promise(r => setTimeout(r, 10));
  const finalizada = await Sessions.finish(s.id);
  if (finalizada.status !== SessionStatus.FINALIZADA) throw new Error('status ≠ FINALIZADA');
  if (!(finalizada.duracaoMs > 0)) throw new Error('duracaoMs inválido');
});

// Fase 5: Laps.invalidar + revalidar gera ValidityEvents
await t('F5: Laps.invalidar + revalidar atualiza valida + grava eventos', async () => {
  const u = await Users.getOrCreatePrimary();
  const c = await Cars.create({ userId: u.id, nome: 'x', marca: 'a', modelo: 'b' });
  const s = await Sessions.create({ userId: u.id, carId: c.id, trackId: 'trk-x', tipo: SessionTipo.TREINO });
  await Sessions.start(s.id);
  const lap = await Laps.create({ sessionId: s.id, numero: 1, tempoMs: 60000, temposPorParcial: { P1: 20000, P2: 20000, P3: 20000 } });
  await Laps.invalidar(lap.id, { motivo: InvalidationReason.SAIU_PISTA });
  const after = await Laps.get(lap.id);
  if (after.valida !== false) throw new Error('não invalidou');
  await Laps.revalidar(lap.id);
  const after2 = await Laps.get(lap.id);
  if (after2.valida !== true) throw new Error('não revalidou');
});

// Fase 6: Scores.trecho retorna 0..100
await t('F6: Scores.trecho dentro de 0..100', () => {
  const s1 = Scores.trecho(30000, 30000);
  const s2 = Scores.trecho(31000, 30000);
  const s3 = Scores.trecho(45000, 30000);
  if (s1 !== 100) throw new Error('igual ≠ 100: ' + s1);
  if (s2 >= 100 || s2 <= 80) throw new Error('pior esperado <100: ' + s2);
  if (s3 < 0 || s3 > 100) throw new Error('extremo fora: ' + s3);
});

// Fase 9: Scores.compensado com 3 parciais
await t('F9: Scores.compensado devolve breakdown por parcial', () => {
  const lap = { temposPorParcial: { P1: 30000, P2: 35000, P3: 28000 } };
  const bench = {
    parciais: [{ id: 'P1', nome: 'P1' }, { id: 'P2', nome: 'P2' }, { id: 'P3', nome: 'P3' }],
    melhorPorParcial: { P1:{tempoMs:30000}, P2:{tempoMs:35000}, P3:{tempoMs:28000} },
  };
  const s = Scores.compensado(lap, bench);
  if (!s?.breakdown?.P1 || !s?.breakdown?.P2 || !s?.breakdown?.P3) throw new Error('breakdown faltando');
});

// Fase 10: Repeatability.fromSeries retorna 0..1
await t('F10: Repeatability.fromSeries entre 0 e 1', () => {
  const r = Repeatability.fromSeries([60000, 60100, 59900, 60050], 0.05);
  if (r.index < 0 || r.index > 1) throw new Error('index fora: ' + r.index);
  if (r.n !== 4) throw new Error('n errado');
});

// Fase 11: ErrorClassifier.classify retorna principal + evidencias
await t('F11: ErrorClassifier.classify emite principal válido', () => {
  const r = ErrorClassifier.classify({
    execution: { tempoMs: 35000, velEntrada: 150, velMinima: 75, velSaida: 120 },
    reference: { tempoMs: 30000, velEntradaMedia: 150, velMinimaMedia: 80, velSaidaMedia: 130 },
  });
  if (!r.principal) throw new Error('sem principal');
  if (!Object.values(ErroTipo).includes(r.principal)) throw new Error('principal fora do enum: ' + r.principal);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
