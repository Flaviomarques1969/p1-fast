// ════════════════════════════════════════════════════════════════════
// vigia-canal-notebook.mjs — vigia o canal REAL do notebook (via git).
// ════════════════════════════════════════════════════════════════════
// O notebook não usa dados-notebook/; ele empurra a branch
// sync/notebook-dia-de-pista-2026-06-23 com:
//   - o canal de conversa .claude-exec/CONVERSA-NOTEBOOK-IMAC-DADOS-NUVEM.md
//   - sessões reais em .claude-exec/dados-pista/*.json
// Supabase está bloqueado desta sessão (403 de política), então a vigília é
// SÓ por git: detecta novo commit na branch, mudança na CONVERSA, e sessão nova.
//
// Estado entre execuções fica no scratchpad (NÃO commitado).
// Silencioso quando nada muda; imprime DELTA quando há novidade.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const BRANCH = 'sync/notebook-dia-de-pista-2026-06-23';
const REF = `origin/${BRANCH}`;
const CONVERSA = '.claude-exec/CONVERSA-NOTEBOOK-IMAC-DADOS-NUVEM.md';
const DADOS_DIR = '.claude-exec/dados-pista';
const STATE_DIR = '/tmp/claude-0/-home-user-p1-fast/82492287-34a5-55ee-b6f2-dfc999753cb9/scratchpad';
const STATE = `${STATE_DIR}/vigia-canal-state.json`;

const git = (a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const tryGit = (a) => { try { return git(a); } catch { return null; } };

// fetch silencioso
tryGit(['fetch', 'origin', BRANCH]);

const tip = tryGit(['rev-parse', REF]);
if (!tip) { console.log(`! branch ${REF} não existe ainda.`); process.exit(0); }

const conversaBlob = tryGit(['rev-parse', `${REF}:${CONVERSA}`]); // hash do arquivo (null se não existe)
const sessoes = (tryGit(['ls-tree', '-r', '--name-only', REF, '--', DADOS_DIR]) || '')
  .split('\n').filter((p) => p.endsWith('.json'));

if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

let prev = null;
if (existsSync(STATE)) { try { prev = JSON.parse(readFileSync(STATE, 'utf8')); } catch {} }

const snapshot = { tip, conversaBlob, sessoes };

// Primeira vez: fixa baseline em silêncio (não alerta com o que já existe).
if (!prev) {
  writeFileSync(STATE, JSON.stringify(snapshot, null, 2));
  console.log(`baseline fixada — vigiando ${REF}`);
  console.log(`  tip=${tip.slice(0, 8)}  conversa=${conversaBlob ? conversaBlob.slice(0, 8) : '—'}  sessões=${sessoes.length}`);
  process.exit(0);
}

// Sem mudança no tip → nada novo.
if (prev.tip === tip) { process.exit(0); }

// Houve commit novo. Apura o que mudou.
console.log(`🔔 NOVIDADE em ${REF}`);
const novos = tryGit(['log', '--oneline', `${prev.tip}..${tip}`]);
if (novos) { console.log('\nCommits novos:'); console.log(novos.split('\n').map((l) => '  ' + l).join('\n')); }

// CONVERSA mudou?
if (prev.conversaBlob !== conversaBlob) {
  console.log(`\n💬 ${CONVERSA} MUDOU — linhas acrescentadas:`);
  const diff = tryGit(['diff', `${prev.tip}`, `${tip}`, '--', CONVERSA]);
  if (diff) {
    const add = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => '  ' + l.slice(1));
    console.log(add.length ? add.join('\n') : '  (mudança sem linhas + claras — ver diff completo)');
  }
}

// Sessões novas?
const setPrev = new Set(prev.sessoes || []);
const novasSessoes = sessoes.filter((s) => !setPrev.has(s));
if (novasSessoes.length) {
  console.log(`\n📊 ${novasSessoes.length} sessão(ões) nova(s):`);
  for (const s of novasSessoes) {
    let meta = null;
    try { meta = JSON.parse(tryGit(['show', `${REF}:${s}`]) || '{}').sessao; } catch {}
    if (meta) {
      const okGps = meta.hzGpsMedia >= 20;
      console.log(`  ${s.split('/').pop()}`);
      console.log(`    dur=${meta.duracaoS}s  gps=${meta.nGps} (${meta.hzGpsMedia} Hz ${okGps ? '✅' : '⚠️'})  ` +
        `motor=${meta.nMotor} (${meta.hzMotorMedia} Hz)  status=${meta.status}`);
    } else {
      console.log(`  ${s}  (sem meta legível)`);
    }
  }
}

writeFileSync(STATE, JSON.stringify(snapshot, null, 2));
process.exit(0);
