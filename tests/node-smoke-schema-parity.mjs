// ═══════════════════════════════════════════════════════════
// Smoke de paridade de schema — Postgres ↔ GRDB ↔ Dexie ↔ schemas.js
// ═══════════════════════════════════════════════════════════
// Pega o conjunto de tabelas e os campos críticos do ghost-map em cada
// camada e confirma que estão sincronizados. Qualquer divergência
// silenciosa quebra este smoke — defesa contra "alterei só PG e
// esqueci do GRDB" que é fácil de cometer.
//
// Camadas auditadas:
//   • Postgres   → supabase/migrations/0001_initial.sql
//   • GRDB iOS   → ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift
//   • Dexie web  → src/core/db.js (schema strings) + src/core/entities.js (ENTITIES)
//   • Shapes JS  → src/data/schemas.js (canonical field metadata)
//
// Ghost-map (auditoria 2026-05-01) — 5 campos que precisam estar em todas:
//   sessoes.voltas_planejadas, configuracoes.temperatura_ideal_range,
//   carros.fonte_temperatura, marcos (com pit-in/pit-out), retas_especiais.

import { readFile, readdir } from 'node:fs/promises';

const PG_DIR     = 'supabase/migrations';
const GRDB_PATH  = 'ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift';
const ENTITIES_P = 'src/core/entities.js';

// Concatena TODAS as migrations Postgres em ordem — o set de tabelas é a
// soma das CREATEs de todos os arquivos. Antes lia só 0001_initial.sql,
// passou a ler tudo quando v2a/v4 entraram (Sprint 1A.4/1A.5).
async function loadAllPgMigrations() {
  const files = (await readdir(PG_DIR)).filter(f => f.endsWith('.sql')).sort();
  const parts = await Promise.all(files.map(f => readFile(`${PG_DIR}/${f}`, 'utf8')));
  return parts.join('\n');
}

const pg   = await loadAllPgMigrations();
const grdb = await readFile(GRDB_PATH, 'utf8');
const ents = await readFile(ENTITIES_P, 'utf8');

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ─── Helpers ──────────────────────────────────────────────
function pgTables(sql) {
  // aceita "if not exists" (formato das migs 0030+) e dígitos no nome
  // (t4000_live_*) — o leitor antigo contava 32 de 45 e cortava "t4000" em "t".
  const re = /^create table (?:if not exists )?public\.([a-z0-9_]+)/gim;
  const out = new Set();
  let m;
  while ((m = re.exec(sql)) !== null) out.add(m[1]);
  return out;
}

function grdbTables(swift) {
  // aceita IF NOT EXISTS (v26_pecas+ usam) e dígitos no nome
  const re = /CREATE TABLE (?:IF NOT EXISTS )?([a-z0-9_]+)/g;
  const out = new Set();
  let m;
  while ((m = re.exec(swift)) !== null) out.add(m[1]);
  return out;
}

const PG_TABLES   = pgTables(pg);
const GRDB_TABLES = grdbTables(grdb);

// ─── Tests ────────────────────────────────────────────────
// Contagem atualizada conforme migrations vão entrando.
// PG: 20 do 0001 + licoes (0004) + pendencias_template + evento_pendencias
//     (0005) + telemetry_samples_enriched (0008) + video_streams (0015)
//     + volta_video (0016) + pessoas (0018) + pessoa_papeis (0019)
//     + engineering_findings (0020) + engineering_recommendations (0021) = 30.
//     (0014 só estende sessoes; 0017 só ajusta policies RLS, sem criar tabela.)
const PG_TABLE_COUNT_ESPERADO = 30;
// MS-16.3 (Command Box Engenharia Camada 2): engineering_findings + engineering_recommendations
// vivem só em Supabase (Camada 2 emite em memória + persiste via REST direto;
// cliente lê via REST). GRDB não precisa replicar. Quando MS-16.5 entrar com
// upload local-first opcional dessas tabelas, mover daqui pra cobertura GRDB.
const PG_ONLY_TABLES = new Set(['engineering_findings', 'engineering_recommendations']);
const GRDB_REQUIRED_COUNT = PG_TABLE_COUNT_ESPERADO - PG_ONLY_TABLES.size; // 28
const GRDB_TABLE_COUNT_ESPERADO = GRDB_REQUIRED_COUNT + 2; // + sync_queue + sync_meta = 30

t(`PG tem ${PG_TABLE_COUNT_ESPERADO} tabelas em public`, () => {
  if (PG_TABLES.size !== PG_TABLE_COUNT_ESPERADO) throw new Error('size=' + PG_TABLES.size);
});

t(`GRDB tem ${GRDB_TABLE_COUNT_ESPERADO} tabelas (${GRDB_REQUIRED_COUNT} PG espelhadas + sync_queue + sync_meta local-only)`, () => {
  if (GRDB_TABLES.size !== GRDB_TABLE_COUNT_ESPERADO) throw new Error('size=' + GRDB_TABLES.size);
});

t(`GRDB cobre TODAS as ${GRDB_REQUIRED_COUNT} tabelas do PG espelhadas (excl. ${[...PG_ONLY_TABLES].join('/')})`, () => {
  const missing = [...PG_TABLES]
    .filter(x => !PG_ONLY_TABLES.has(x))
    .filter(x => !GRDB_TABLES.has(x));
  if (missing.length) throw new Error('faltam no GRDB: ' + missing.join(', '));
});

t(`GRDB tem só sync_queue + sync_meta além das ${GRDB_REQUIRED_COUNT} do PG espelhadas`, () => {
  const extras = [...GRDB_TABLES].filter(x => !PG_TABLES.has(x)).sort();
  const expected = ['sync_meta', 'sync_queue'];
  if (extras.length !== 2 || extras[0] !== expected[0] || extras[1] !== expected[1]) {
    throw new Error('extras inesperadas: ' + extras.join(', '));
  }
});

// ─── Ghost-map (5 campos) cross-layer ─────────────────────
t('sessoes.voltas_planejadas em PG e GRDB', () => {
  if (!pg.includes('voltas_planejadas')) throw new Error('PG sem');
  if (!grdb.includes('voltas_planejadas')) throw new Error('GRDB sem');
});

t('configuracoes.temperatura_ideal_range em PG e GRDB', () => {
  if (!pg.includes('temperatura_ideal_range')) throw new Error('PG sem');
  if (!grdb.includes('temperatura_ideal_range')) throw new Error('GRDB sem');
});

t('carros.fonte_temperatura com enum motor|pneu|ambos em PG e GRDB', () => {
  const enumPg   = pg.match(/fonte_temperatura.*check.*\(fonte_temperatura.*?\)/is);
  const enumGrdb = grdb.match(/fonte_temperatura.*CHECK.*\(fonte_temperatura.*?\)/is);
  if (!enumPg)   throw new Error('PG sem CHECK');
  if (!enumGrdb) throw new Error('GRDB sem CHECK');
  for (const v of ['motor','pneu','ambos']) {
    if (!enumPg[0].includes(`'${v}'`))   throw new Error('PG enum sem ' + v);
    if (!enumGrdb[0].includes(`'${v}'`)) throw new Error('GRDB enum sem ' + v);
  }
});

t('marcos.tipo enum tem pit-in e pit-out em PG e GRDB', () => {
  for (const v of ['pit-in','pit-out','largada','chegada']) {
    if (!pg.includes(`'${v}'`))   throw new Error('PG sem ' + v);
    if (!grdb.includes(`'${v}'`)) throw new Error('GRDB sem ' + v);
  }
});

t('retas_especiais com auto_detectada bool default false em PG e GRDB', () => {
  if (!/auto_detectada\s+boolean\s+not null\s+default\s+false/i.test(pg)) {
    throw new Error('PG: auto_detectada boolean default false ausente');
  }
  if (!/auto_detectada\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/.test(grdb)) {
    throw new Error('GRDB: auto_detectada INTEGER default 0 ausente');
  }
});

// ─── ENTITIES ↔ tabelas (a maioria, exceto storage interno) ──
t('ENTITIES inclui MARCO e RETA_ESPECIAL (ghost-map v13)', () => {
  for (const e of ['MARCO','RETA_ESPECIAL']) {
    if (!new RegExp(`${e}:\\s+'`).test(ents)) throw new Error('ENTITIES sem ' + e);
  }
});

// ─── ADR-014 (telemetry append-only): GRDB sem synced_at ───
t('ADR-014: GRDB telemetry_samples NÃO tem synced_at', () => {
  // Pega só o bloco da CREATE TABLE telemetry_samples
  const m = grdb.match(/CREATE TABLE telemetry_samples[\s\S]+?\)/);
  if (!m) throw new Error('telemetry_samples não encontrado');
  if (m[0].includes('synced_at')) {
    throw new Error('telemetry_samples tem synced_at — viola ADR-014');
  }
});

t('ADR-014: PG telemetry_samples NÃO tem policy UPDATE/DELETE', () => {
  // Procura policies pra telemetry_samples
  const polRe = /create policy [a-z_]+ on public\.telemetry_samples for ([a-z]+)/gi;
  const ops = [];
  let m;
  while ((m = polRe.exec(pg)) !== null) ops.push(m[1].toLowerCase());
  // Aceita: select, insert. Rejeita: update, delete, all.
  for (const op of ops) {
    if (op === 'update' || op === 'delete' || op === 'all') {
      throw new Error(`policy ${op} encontrada — viola ADR-014`);
    }
  }
});

// ─── RLS coverage ─────────────────────────────────────────
t(`RLS habilitada em todas as ${PG_TABLE_COUNT_ESPERADO} tabelas do PG`, () => {
  const rlsRe = /alter table public\.([a-z_]+)\s+enable row level security/g;
  const rlsTables = new Set();
  let m;
  while ((m = rlsRe.exec(pg)) !== null) rlsTables.add(m[1]);
  if (rlsTables.size !== PG_TABLE_COUNT_ESPERADO) throw new Error('RLS em ' + rlsTables.size + ' tabelas');
  const missing = [...PG_TABLES].filter(x => !rlsTables.has(x));
  if (missing.length) throw new Error('sem RLS: ' + missing.join(', '));
});

t('Toda tabela com RLS tem ≥1 policy (sem lockdown total acidental)', () => {
  const polRe = /create policy [a-z_]+ on public\.([a-z_]+)/gi;
  const polTables = new Set();
  let m;
  while ((m = polRe.exec(pg)) !== null) polTables.add(m[1]);
  const missing = [...PG_TABLES].filter(x => !polTables.has(x));
  if (missing.length) throw new Error('sem policy: ' + missing.join(', '));
});

// ─── ENTITIES count ──────────────────────────────────────
t('ENTITIES tem 16 entries (14 originais + MARCO + RETA_ESPECIAL)', () => {
  const m = ents.match(/[A-Z_]+:\s+'/g);
  if (!m || m.length !== 16) throw new Error('count=' + (m ? m.length : 0));
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
