// ════════════════════════════════════════════════════════════════════
// ler-dados-notebook.mjs — lê os dados que o NOTEBOOK depositou via git
// e prova que 100% do colhido (GPS/RaceBox + T4000 + Osmo 6) foi enviado.
// ════════════════════════════════════════════════════════════════════
// POR QUE git e não Supabase: a sessão do Claude na nuvem não alcança o
// Supabase (política de rede nega a saída — 403, verificado 2026-06-27).
// O canal entre o notebook e a nuvem é o git (ver dados-notebook/README.md
// e .claude-exec/RUNBOOK-NOTEBOOK-P1-FAST.md).
//
// Uso:
//   node tools/ler-dados-notebook.mjs                  # branch atual (origin)
//   node tools/ler-dados-notebook.mjs --ref=origin/main
//   node tools/ler-dados-notebook.mjs --sessao=<id>    # filtra uma sessão
//   node tools/ler-dados-notebook.mjs --no-fetch       # não faz git fetch
//
// Saída: tabela por sessão × fonte com % de completude + buracos.
// Código de saída ≠ 0 se alguma fonte ficar < 100% (serve de gate).

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dados-notebook/manifests';
const TOLERANCIA_OSMO_S = 2; // soma de vídeo pode ficar 2s aquém da sessão

// ── args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const noFetch = args.includes('--no-fetch');
const sessaoFiltro = getArg('sessao', null);

function git(cmdArgs) {
  return execFileSync('git', cmdArgs, { encoding: 'utf8' }).trim();
}

// ref padrão = origin/<branch-atual>
let ref = getArg('ref', null);
if (!ref) {
  let branch = 'HEAD';
  try { branch = git(['rev-parse', '--abbrev-ref', 'HEAD']); } catch {}
  ref = `origin/${branch}`;
}
const branchDoRef = ref.replace(/^origin\//, '');

// ── fetch ─────────────────────────────────────────────────────────────
if (!noFetch) {
  try {
    git(['fetch', 'origin', branchDoRef]);
  } catch (e) {
    console.warn(`! git fetch origin ${branchDoRef} falhou — leio o que já tenho local.\n  (${String(e.message).split('\n')[0]})`);
  }
}

// ── lista + lê manifestos: tenta o ref do git; cai pro working tree ────
function lerDoRef() {
  let lista;
  try {
    lista = git(['ls-tree', '-r', '--name-only', ref, '--', DIR]);
  } catch { return null; }
  const arquivos = lista.split('\n').filter((p) => p.endsWith('.json') && !p.endsWith('_exemplo.json'));
  if (arquivos.length === 0) return [];
  return arquivos.map((p) => ({ path: p, json: git(['show', `${ref}:${p}`]) }));
}
function lerLocal() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json') && f !== '_exemplo.json')
    .map((f) => ({ path: join(DIR, f), json: readFileSync(join(DIR, f), 'utf8') }));
}

let fonte = lerDoRef();
let origem = `git (${ref})`;
if (fonte === null || fonte.length === 0) {
  const local = lerLocal();
  if (local.length > 0) { fonte = local; origem = 'working tree local'; }
  else fonte = fonte || [];
}

// ── parse ─────────────────────────────────────────────────────────────
let manifestos = [];
for (const { path, json } of fonte) {
  try {
    const m = JSON.parse(json);
    if (sessaoFiltro && m.sessaoId !== sessaoFiltro) continue;
    manifestos.push(m);
  } catch (e) {
    console.error(`! manifesto inválido (${path}): ${e.message}`);
    process.exitCode = 2;
  }
}

console.log(`\n📡 Fonte de leitura: ${origem}`);
console.log(`   Manifestos encontrados: ${manifestos.length}${sessaoFiltro ? ` (filtro sessao=${sessaoFiltro})` : ''}\n`);

if (manifestos.length === 0) {
  console.log('Nada pra ler ainda. O notebook não depositou manifesto em',
    `${DIR}/ na ref ${ref}.`);
  console.log('Quando ele empurrar (git push), rode de novo.');
  process.exit(process.exitCode || 0);
}

// ── verificação por fonte ─────────────────────────────────────────────
const pct = (e, c) => (c > 0 ? (e / c) * 100 : (e === 0 ? 100 : 0));
const barra = (p) => {
  const n = Math.round(Math.max(0, Math.min(100, p)) / 10);
  return '█'.repeat(n) + '░'.repeat(10 - n);
};

let tudoOk = true;

function checaAmostral(nome, f) {
  if (!f) return null;
  const c = Number(f.colhidas ?? 0), e = Number(f.enviadas ?? 0);
  const p = pct(e, c);
  const gaps = Array.isArray(f.gaps) ? f.gaps.length : 0;
  const ok = e === c && gaps === 0 && c > 0;
  if (!ok) tudoOk = false;
  return { nome, linha:
    `  ${nome.padEnd(7)} ${barra(p)} ${p.toFixed(2).padStart(6)}%  ` +
    `colhidas=${c}  enviadas=${e}  faltam=${c - e}  gaps=${gaps}  ${ok ? '✅' : '❌'}` };
}

function checaOsmo(f, inicio, fim) {
  if (!f) return null;
  const arqs = Array.isArray(f.arquivos) ? f.arquivos : [];
  const durTotal = arqs.reduce((s, a) => s + Number(a.duracaoS ?? 0), 0);
  const semHash = arqs.filter((a) => !a.sha256 || /^0+$/.test(a.sha256)).length;
  let janelaS = null;
  if (inicio && fim) janelaS = (new Date(fim) - new Date(inicio)) / 1000;
  const cobre = janelaS == null ? null : durTotal >= janelaS - TOLERANCIA_OSMO_S;
  const ok = arqs.length > 0 && semHash === 0 && (cobre !== false);
  if (!ok) tudoOk = false;
  const cobreTxt = janelaS == null ? 's/janela'
    : `cobre ${durTotal}s de ${Math.round(janelaS)}s ${cobre ? '✓' : '✗'}`;
  return { nome: 'osmo6', linha:
    `  ${'osmo6'.padEnd(7)} arquivos=${arqs.length}  ${cobreTxt}  ` +
    `sem-sha256=${semHash}  ${ok ? '✅' : '❌'}` };
}

for (const m of manifestos) {
  console.log(`── ${m.sessaoId}  (${m.evento ?? '?'} · ${m.carro ?? '?'} · ${m.geradoPor ?? '?'})`);
  if (m.inicioWall || m.fimWall) console.log(`   janela: ${m.inicioWall ?? '?'} → ${m.fimWall ?? '?'}`);
  const fts = m.fontes ?? {};
  const linhas = [
    checaAmostral('gps', fts.gps),
    checaAmostral('t4000', fts.t4000),
    checaOsmo(fts.osmo6, m.inicioWall, m.fimWall),
  ].filter(Boolean);
  for (const l of linhas) console.log(l.linha);
  const faltando = ['gps', 't4000', 'osmo6'].filter((k) => !fts[k]);
  if (faltando.length) { console.log(`  ⚠️  fontes ausentes no manifesto: ${faltando.join(', ')}`); tudoOk = false; }
  console.log('');
}

console.log('─'.repeat(60));
if (tudoOk) {
  console.log('✅ 100% — todo dado colhido consta como enviado/gravado, sem buracos.');
  process.exit(0);
} else {
  console.log('❌ INCOMPLETO — há fonte abaixo de 100%, buraco, vídeo sem hash, ou fonte ausente.');
  console.log('   Veja as linhas com ❌ acima. (código de saída 1)');
  process.exit(1);
}
