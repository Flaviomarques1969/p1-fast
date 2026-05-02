// Smoke da Edge Function `health` — validador puro (sem Deno/Supabase).

import { readFile } from 'node:fs/promises';

const src = await readFile('supabase/functions/health/index.ts', 'utf8');

const EXPECTED_TABLES = [
  'times', 'usuarios_time',
  'tracks', 'track_layouts', 'track_segments', 'marcos', 'retas_especiais',
  'carros', 'configuracoes', 'pilotos', 'passageiros', 'pneus', 'combustiveis',
  'eventos', 'sessoes', 'voltas', 'segment_executions', 'telemetry_samples',
  'mensagens', 'trofeus_ganhos',
];
const EXPECTED_RPCS = ['create_team', 'is_member', 'is_admin'];

function computeStatus(schema, rpcs) {
  if (schema.missing.length > 0) return 'drift';
  if (schema.extras.length > 0) return 'drift';
  if (schema.tables_count !== EXPECTED_TABLES.length) return 'drift';
  if (schema.rls_enabled_count !== EXPECTED_TABLES.length) return 'drift';
  for (const rpc of EXPECTED_RPCS) {
    if (!rpcs[rpc]) return 'drift';
  }
  return 'ok';
}

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

t('computeStatus retorna ok quando tudo bate', () => {
  const schema = { tables_count: 20, rls_enabled_count: 20, expected_tables: EXPECTED_TABLES, missing: [], extras: [] };
  const rpcs = { create_team: true, is_member: true, is_admin: true };
  if (computeStatus(schema, rpcs) !== 'ok') throw new Error('esperava ok');
});

t('computeStatus retorna drift se uma tabela falta', () => {
  const schema = { tables_count: 19, rls_enabled_count: 19, expected_tables: EXPECTED_TABLES, missing: ['carros'], extras: [] };
  const rpcs = { create_team: true, is_member: true, is_admin: true };
  if (computeStatus(schema, rpcs) !== 'drift') throw new Error('esperava drift');
});

t('computeStatus retorna drift se há extra inesperada', () => {
  const schema = { tables_count: 21, rls_enabled_count: 21, expected_tables: EXPECTED_TABLES, missing: [], extras: ['random'] };
  const rpcs = { create_team: true, is_member: true, is_admin: true };
  if (computeStatus(schema, rpcs) !== 'drift') throw new Error('esperava drift');
});

t('computeStatus retorna drift se RPC falta', () => {
  const schema = { tables_count: 20, rls_enabled_count: 20, expected_tables: EXPECTED_TABLES, missing: [], extras: [] };
  const rpcs = { create_team: false, is_member: true, is_admin: true };
  if (computeStatus(schema, rpcs) !== 'drift') throw new Error('esperava drift por RPC ausente');
});

t('computeStatus retorna drift se RLS count não bate', () => {
  const schema = { tables_count: 20, rls_enabled_count: 18, expected_tables: EXPECTED_TABLES, missing: [], extras: [] };
  const rpcs = { create_team: true, is_member: true, is_admin: true };
  if (computeStatus(schema, rpcs) !== 'drift') throw new Error('esperava drift por RLS gap');
});

t('EXPECTED_TABLES tem 20 tabelas (mesmo set do PG/GRDB)', () => {
  if (EXPECTED_TABLES.length !== 20) throw new Error('len=' + EXPECTED_TABLES.length);
  for (const name of ['times', 'carros', 'sessoes', 'telemetry_samples', 'marcos', 'retas_especiais']) {
    if (!EXPECTED_TABLES.includes(name)) throw new Error('faltando ' + name);
  }
});

t('EXPECTED_RPCS tem create_team, is_member, is_admin', () => {
  for (const rpc of ['create_team', 'is_member', 'is_admin']) {
    if (!EXPECTED_RPCS.includes(rpc)) throw new Error('faltando ' + rpc);
  }
});

t('source TS exporta computeStatus + EXPECTED_TABLES + EXPECTED_RPCS', () => {
  if (!src.includes('export function computeStatus')) throw new Error('computeStatus não exportado');
  if (!src.includes('export const EXPECTED_TABLES')) throw new Error('EXPECTED_TABLES não exportado');
  if (!src.includes('export const EXPECTED_RPCS')) throw new Error('EXPECTED_RPCS não exportado');
});

t('source TS aceita GET ou POST (não exige auth)', () => {
  if (!src.includes('GET') || !src.includes('POST')) throw new Error('não aceita GET/POST');
  if (src.includes('missing-bearer-token')) throw new Error('health NÃO devia exigir bearer token');
});

t('source TS conta seed canônico (5 tabelas globais)', () => {
  for (const fragment of ['tracks', 'track_layouts', 'track_segments', 'marcos', 'retas_especiais']) {
    if (!src.includes(`from("${fragment}")`)) throw new Error(`source TS não conta ${fragment}`);
  }
});

t('source TS retorna status enumerated (ok | drift | error)', () => {
  if (!src.includes('"ok"') || !src.includes('"drift"') || !src.includes('"error"')) {
    throw new Error('status enum incompleto');
  }
});

t('source TS filtra retas_especiais por time_id IS NULL (só globais)', () => {
  if (!src.includes('.is("time_id", null)')) throw new Error('não filtra retas globais');
});

t('source TS NÃO inclui sync_queue/sync_meta em EXPECTED_TABLES', () => {
  if (EXPECTED_TABLES.includes('sync_queue')) throw new Error('sync_queue é GRDB-only');
  if (EXPECTED_TABLES.includes('sync_meta')) throw new Error('sync_meta é GRDB-only');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
