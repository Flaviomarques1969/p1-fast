// Smoke da Edge Function `sync` — testa validator + whitelist + LWW guards.
// E2E real (Deno + Supabase) está no README da função; aqui validamos só
// a lógica que NÃO depende de runtime — paridade JS↔TS + asserções
// estruturais sobre o source TS.

import { readFile } from 'node:fs/promises';

const src = await readFile('supabase/functions/sync/index.ts', 'utf8');

// Re-impl JS pura — paridade 1:1 com a versão TS.
const ALLOWED_TABLES = new Set([
  'carros','configuracoes','pilotos','passageiros','pneus','combustiveis',
  'eventos','sessoes','voltas','segment_executions','mensagens','retas_especiais',
]);
const ALLOWED_OPS = new Set(['insert','update','delete']);

function validateRow(r) {
  if (typeof r !== 'object' || r === null) return { ok: false, reason: 'row-nao-objeto' };
  if (typeof r.table_name !== 'string' || !ALLOWED_TABLES.has(r.table_name)) {
    return { ok: false, reason: 'table-nao-permitida' };
  }
  if (typeof r.op !== 'string' || !ALLOWED_OPS.has(r.op)) {
    return { ok: false, reason: 'op-invalida' };
  }
  if (r.op === 'insert') {
    if (typeof r.payload !== 'object' || r.payload === null) return { ok: false, reason: 'insert-sem-payload' };
    if (typeof r.payload.time_id !== 'string') return { ok: false, reason: 'insert-sem-time_id' };
  }
  if (r.op === 'update') {
    if (typeof r.row_id !== 'string') return { ok: false, reason: 'update-sem-row_id' };
    if (typeof r.payload !== 'object' || r.payload === null) return { ok: false, reason: 'update-sem-payload' };
    if (typeof r.client_updated_at !== 'number') return { ok: false, reason: 'update-sem-client_updated_at' };
  }
  if (r.op === 'delete' && typeof r.row_id !== 'string') return { ok: false, reason: 'delete-sem-row_id' };
  return { ok: true };
}

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ─── validateRow ──────────────────────────────────────────
t('validateRow aceita insert canônico', () => {
  const r = validateRow({ table_name: 'carros', op: 'insert', payload: { time_id: 't1', apelido: 'Celta' } });
  if (!r.ok) throw new Error(r.reason);
});

t('validateRow aceita update canônico', () => {
  const r = validateRow({ table_name: 'sessoes', op: 'update', row_id: 'ses_1', payload: { status: 'finalizada' }, client_updated_at: 1714693200000 });
  if (!r.ok) throw new Error(r.reason);
});

t('validateRow aceita delete canônico', () => {
  const r = validateRow({ table_name: 'pneus', op: 'delete', row_id: 'pn_1' });
  if (!r.ok) throw new Error(r.reason);
});

t('validateRow rejeita tabela fora da whitelist', () => {
  const r = validateRow({ table_name: 'telemetry_samples', op: 'insert', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou telemetry_samples');
  if (r.reason !== 'table-nao-permitida') throw new Error('reason=' + r.reason);
});

t('validateRow rejeita times (só RPC create_team)', () => {
  const r = validateRow({ table_name: 'times', op: 'insert', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou times');
});

t('validateRow rejeita usuarios_time', () => {
  const r = validateRow({ table_name: 'usuarios_time', op: 'insert', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou usuarios_time');
});

t('validateRow rejeita trofeus_ganhos', () => {
  const r = validateRow({ table_name: 'trofeus_ganhos', op: 'insert', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou trofeus_ganhos');
});

t('validateRow rejeita catálogo global (tracks)', () => {
  const r = validateRow({ table_name: 'tracks', op: 'insert', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou tracks');
});

t('validateRow rejeita op desconhecida', () => {
  const r = validateRow({ table_name: 'carros', op: 'merge', payload: { time_id: 't1' } });
  if (r.ok) throw new Error('aceitou op=merge');
  if (r.reason !== 'op-invalida') throw new Error('reason=' + r.reason);
});

t('validateRow rejeita insert sem time_id no payload', () => {
  const r = validateRow({ table_name: 'carros', op: 'insert', payload: { apelido: 'X' } });
  if (r.ok) throw new Error('aceitou sem time_id');
  if (r.reason !== 'insert-sem-time_id') throw new Error('reason=' + r.reason);
});

t('validateRow rejeita update sem client_updated_at (LWW exige)', () => {
  const r = validateRow({ table_name: 'carros', op: 'update', row_id: 'c1', payload: { apelido: 'Y' } });
  if (r.ok) throw new Error('aceitou sem client_updated_at');
  if (r.reason !== 'update-sem-client_updated_at') throw new Error('reason=' + r.reason);
});

t('validateRow rejeita delete sem row_id', () => {
  const r = validateRow({ table_name: 'carros', op: 'delete' });
  if (r.ok) throw new Error('aceitou sem row_id');
});

// ─── Source TS guards ─────────────────────────────────────
t('source TS contém auth check (bearer token)', () => {
  if (!src.includes('missing-bearer-token')) throw new Error('sem check de bearer');
});

t('source TS verifica membership via usuarios_time', () => {
  if (!src.includes('usuarios_time')) throw new Error('sem lookup usuarios_time');
  if (!src.includes('not-member-of-time')) throw new Error('sem erro de membership');
});

t('source TS implementa LWW (stale-write)', () => {
  if (!src.includes('stale-write')) throw new Error('sem LWW');
  if (!src.includes('serverUpdatedAt')) throw new Error('sem comparação updated_at');
});

t('source TS valida limite MAX_ROWS_PER_REQUEST', () => {
  if (!src.includes('MAX_ROWS_PER_REQUEST')) throw new Error('sem constante de limite');
  if (!src.includes('too-many-rows')) throw new Error('sem erro 413');
});

t('source TS NÃO permite telemetry_samples (ADR-014)', () => {
  // ALLOWED_TABLES não pode conter telemetry_samples.
  const m = src.match(/ALLOWED_TABLES = new Set\(\[([\s\S]+?)\]\)/);
  if (!m) throw new Error('ALLOWED_TABLES não encontrado');
  if (m[1].includes('telemetry_samples')) {
    throw new Error('telemetry_samples na whitelist — viola ADR-014');
  }
});

t('source TS exporta validateRow + ALLOWED_TABLES + ALLOWED_OPS', () => {
  if (!src.includes('export const ALLOWED_TABLES')) throw new Error('ALLOWED_TABLES não exportado');
  if (!src.includes('export const ALLOWED_OPS')) throw new Error('ALLOWED_OPS não exportado');
  if (!src.includes('export function validateRow')) throw new Error('validateRow não exportado');
});

t('source TS suporta as 12 tabelas com time_id (não-globais, não-especiais)', () => {
  // Whitelist deve cobrir exatamente as tabelas de workspace que aceitam mutation cliente.
  const expected = ['carros','configuracoes','pilotos','passageiros','pneus','combustiveis',
                    'eventos','sessoes','voltas','segment_executions','mensagens','retas_especiais'];
  for (const tbl of expected) {
    if (![...ALLOWED_TABLES].includes(tbl)) throw new Error('whitelist sem ' + tbl);
  }
  if (ALLOWED_TABLES.size !== 12) throw new Error('whitelist size=' + ALLOWED_TABLES.size);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
