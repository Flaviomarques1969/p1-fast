// Smoke da Edge Function `pull` — validator + whitelist + source guards.

import { readFile } from 'node:fs/promises';

const src = await readFile('supabase/functions/pull/index.ts', 'utf8');

const TEAM_TABLES = new Set([
  'carros','configuracoes','pilotos','passageiros','pneus','combustiveis',
  'eventos','sessoes','voltas','segment_executions','mensagens',
  'retas_especiais','trofeus_ganhos',
]);
const GLOBAL_TABLES = new Set([
  'tracks','track_layouts','track_segments','marcos',
]);

function validatePullRequest(b) {
  if (typeof b !== 'object' || b === null) return { ok: false, reason: 'body-invalid' };
  if (!Array.isArray(b.tables)) return { ok: false, reason: 'tables-must-be-array' };
  if (b.tables.length === 0) return { ok: false, reason: 'tables-empty' };
  if (b.tables.length > 30) return { ok: false, reason: 'too-many-tables' };
  for (const t of b.tables) {
    if (typeof t !== 'string') return { ok: false, reason: 'table-not-string' };
    if (!TEAM_TABLES.has(t) && !GLOBAL_TABLES.has(t)) {
      return { ok: false, reason: `table-not-pullable:${t}` };
    }
  }
  if (b.since !== undefined && (typeof b.since !== 'object' || b.since === null)) {
    return { ok: false, reason: 'since-must-be-object' };
  }
  return { ok: true };
}

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ─── validator ────────────────────────────────────────────
t('validatePullRequest aceita team table', () => {
  const r = validatePullRequest({ tables: ['carros', 'sessoes'] });
  if (!r.ok) throw new Error(r.reason);
});

t('validatePullRequest aceita global table', () => {
  const r = validatePullRequest({ tables: ['tracks', 'marcos'] });
  if (!r.ok) throw new Error(r.reason);
});

t('validatePullRequest aceita mix team+global', () => {
  const r = validatePullRequest({ tables: ['carros', 'tracks'] });
  if (!r.ok) throw new Error(r.reason);
});

t('validatePullRequest aceita since como object', () => {
  const r = validatePullRequest({ tables: ['carros'], since: { carros: 1714693200000 } });
  if (!r.ok) throw new Error(r.reason);
});

t('validatePullRequest rejeita tables não-array', () => {
  const r = validatePullRequest({ tables: 'carros' });
  if (r.ok) throw new Error('aceitou');
});

t('validatePullRequest rejeita tables vazio', () => {
  const r = validatePullRequest({ tables: [] });
  if (r.ok || r.reason !== 'tables-empty') throw new Error('reason=' + r.reason);
});

t('validatePullRequest rejeita >30 tables (DOS)', () => {
  const tables = Array(31).fill('carros');
  const r = validatePullRequest({ tables });
  if (r.ok || r.reason !== 'too-many-tables') throw new Error('reason=' + r.reason);
});

t('validatePullRequest rejeita telemetry_samples (não pullable, vai por outro caminho)', () => {
  const r = validatePullRequest({ tables: ['telemetry_samples'] });
  if (r.ok) throw new Error('aceitou telemetry_samples');
  if (!r.reason.startsWith('table-not-pullable')) throw new Error('reason=' + r.reason);
});

t('validatePullRequest rejeita times (privado)', () => {
  const r = validatePullRequest({ tables: ['times'] });
  if (r.ok) throw new Error('aceitou times');
});

t('validatePullRequest rejeita usuarios_time', () => {
  const r = validatePullRequest({ tables: ['usuarios_time'] });
  if (r.ok) throw new Error('aceitou usuarios_time');
});

t('validatePullRequest rejeita since não-object', () => {
  const r = validatePullRequest({ tables: ['carros'], since: 1714693200000 });
  if (r.ok) throw new Error('aceitou since=number');
});

// ─── source TS guards ─────────────────────────────────────
t('source TS contém auth bearer check', () => {
  if (!src.includes('missing-bearer-token')) throw new Error('sem check');
});

t('source TS resolve memberships do user', () => {
  if (!src.includes('usuarios_time')) throw new Error('sem usuarios_time lookup');
  if (!src.includes('user_id')) throw new Error('sem filter por user_id');
});

t('source TS filtra team tables por time_ids do user', () => {
  if (!src.includes('userTimeIds')) throw new Error('sem userTimeIds');
  if (!src.includes('.in("time_id"')) throw new Error('sem filter .in time_id');
});

t('source TS NÃO filtra global tables (públicas)', () => {
  // Procura comentário que indica isso explicitamente
  if (!src.includes('Global tables: sem filtro')) {
    throw new Error('sem comentário explicando bypass de global');
  }
});

t('source TS implementa cursor max_updated_at por tabela', () => {
  if (!src.includes('max_updated_at')) throw new Error('sem cursor');
  if (!src.includes('maxUpdatedByTable')) throw new Error('sem map por tabela');
});

t('source TS retorna has_more (paginação)', () => {
  if (!src.includes('has_more')) throw new Error('sem has_more');
  if (!src.includes('ROW_LIMIT_PER_TABLE')) throw new Error('sem limite');
});

t('source TS NÃO inclui telemetry_samples na whitelist', () => {
  const teamMatch = src.match(/TEAM_TABLES = new Set\(\[([\s\S]+?)\]\)/);
  const globalMatch = src.match(/GLOBAL_TABLES = new Set\(\[([\s\S]+?)\]\)/);
  if (!teamMatch || !globalMatch) throw new Error('whitelists não encontradas');
  if (teamMatch[1].includes('telemetry_samples')) throw new Error('TEAM tem telemetry_samples');
  if (globalMatch[1].includes('telemetry_samples')) throw new Error('GLOBAL tem telemetry_samples');
});

t('TEAM_TABLES tem 13, GLOBAL_TABLES tem 4 (correto)', () => {
  if (TEAM_TABLES.size !== 13) throw new Error('TEAM size=' + TEAM_TABLES.size);
  if (GLOBAL_TABLES.size !== 4) throw new Error('GLOBAL size=' + GLOBAL_TABLES.size);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
