// Smoke da Edge Function `ingest` — testa validator + chunker em isolamento.
// Roda em Node (não Deno) por compat com o resto do harness — extrai as
// funções puras do TS via parsing simples (sem transpiler).
//
// E2E real (com supabase functions serve + curl) está documentado no
// README da função; aqui validamos só a lógica que NÃO depende de Deno
// nem de Supabase client.

import { readFile } from 'node:fs/promises';

const src = await readFile('supabase/functions/ingest/index.ts', 'utf8');

// Extrai validateSample e chunkArray via Function() — funcional pra unit test.
// Não é robusto pra uso geral; é OK porque controlamos o source.
function extractFn(name) {
  const re = new RegExp(`export function ${name}[\\s\\S]+?\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`função ${name} não encontrada no source`);
  // Strip TS types pra rodar como JS puro.
  let js = m[0]
    .replace(/^export\s+/, '')
    .replace(/:\s*ValidationResult/g, '')
    .replace(/:\s*any/g, '')
    .replace(/<T>/g, '')
    .replace(/:\s*T\[\]/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*string/g, '');
  return js;
}

const code = `
${extractFn('validateSample')}
${extractFn('chunkArray')}
return { validateSample, chunkArray };
`;
const { validateSample, chunkArray } = new Function(code)();

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

t('validateSample aceita sample canônico', () => {
  const r = validateSample({ t: 1, tMono: 2, source: 'cockpit-mobile', signalQuality: 'GOOD' });
  if (!r.ok) throw new Error('rejeitou válido: ' + r.reason);
});

t('validateSample rejeita null', () => {
  const r = validateSample(null);
  if (r.ok) throw new Error('aceitou null');
  if (r.reason !== 'sample-nao-objeto') throw new Error('reason=' + r.reason);
});

t('validateSample rejeita sem t', () => {
  const r = validateSample({ tMono: 2, source: 'x', signalQuality: 'GOOD' });
  if (r.ok || r.reason !== 'sample-sem-t') throw new Error('reason=' + r.reason);
});

t('validateSample rejeita sem tMono', () => {
  const r = validateSample({ t: 1, source: 'x', signalQuality: 'GOOD' });
  if (r.ok || r.reason !== 'sample-sem-tMono') throw new Error('reason=' + r.reason);
});

t('validateSample rejeita sem source', () => {
  const r = validateSample({ t: 1, tMono: 2, signalQuality: 'GOOD' });
  if (r.ok || r.reason !== 'sample-sem-source') throw new Error('reason=' + r.reason);
});

t('validateSample rejeita sem signalQuality', () => {
  const r = validateSample({ t: 1, tMono: 2, source: 'x' });
  if (r.ok || r.reason !== 'sample-sem-signalQuality') throw new Error('reason=' + r.reason);
});

t('chunkArray divide 100 em chunks de 30 → 4 chunks (30,30,30,10)', () => {
  const arr = Array.from({ length: 100 }, (_, i) => i);
  const chunks = chunkArray(arr, 30);
  if (chunks.length !== 4) throw new Error('len=' + chunks.length);
  if (chunks[0].length !== 30 || chunks[3].length !== 10) throw new Error('shapes errados');
  if (chunks[3][0] !== 90 || chunks[3][9] !== 99) throw new Error('conteúdo errado');
});

t('chunkArray BATCH_SIZE 1000 — 2500 samples → 3 chunks', () => {
  const arr = Array.from({ length: 2500 }, (_, i) => ({ t: i, tMono: i, source: 's', signalQuality: 'GOOD' }));
  const chunks = chunkArray(arr, 1000);
  if (chunks.length !== 3) throw new Error('len=' + chunks.length);
  if (chunks[0].length !== 1000 || chunks[2].length !== 500) throw new Error('shapes errados');
});

t('source TS contém auth check (bearer token)', () => {
  if (!src.includes('missing-bearer-token')) throw new Error('sem check de bearer');
});

t('source TS contém membership check (usuarios_time)', () => {
  if (!src.includes('usuarios_time') || !src.includes('user-not-in-team')) {
    throw new Error('sem check de membership');
  }
});

t('source TS valida limite MAX_SAMPLES_PER_REQUEST', () => {
  if (!src.includes('MAX_SAMPLES_PER_REQUEST')) throw new Error('sem constante de limite');
  if (!src.includes('too-many-samples')) throw new Error('sem erro 413');
});

t('source TS insere em batches via chunkArray', () => {
  if (!src.includes('chunkArray(valid, BATCH_SIZE)')) throw new Error('insert não usa chunker');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
