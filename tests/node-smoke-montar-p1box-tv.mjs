// ═══════════════════════════════════════════════════════════
// CATRACA da E5 (TV do box ao vivo, 27/10/2026) — montador do pacote p1box com a TV em /tv/
// ═══════════════════════════════════════════════════════════
// Trava o que a E5 decidiu, para não voltar:
//  - as 41 telas do ar (publicação de 01/07) entram BYTE A BYTE (sha256 do manifesto) — publicar a
//    Vista desta linha por cima apagaria ~286 linhas que só o ar tem (regressão);
//  - a TV mora em /tv/ com cópia própria das peças: nenhuma referência da TV aponta para /web/ da raiz;
//  - só entra de novo: tv/..., api/room.js (igual à fonte) e package.json {"type":"module"};
//  - ferramenta de autor (salvar-versao.js) fora da TV publicada.
// Controles (cada um TEM de ser recusado com saída 1): base com 1 byte trocado, base com arquivo a mais,
// base que já tem tv/, montador sem isolar /web/.
// Roda com: node tests/node-smoke-montar-p1box-tv.mjs   (e dentro de npm run smoke)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, readdirSync, statSync, appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let ok = 0, fail = 0;
function t(nome, cond, det = '') { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, det ? '— ' + det : ''); } }
async function secao(nome, fn) { try { await fn(); } catch (e) { t(`seção inteira: ${nome}`, false, String(e.message).split('\n')[0]); } }

const RAIZ = new URL('../', import.meta.url).pathname;
const MONTADOR = join(RAIZ, 'tools/montar-p1box-tv.mjs');
const BASE_AR = join(RAIZ, '.claude-exec/p1box-ar-20261027/arquivos');
const MANIFESTO = join(RAIZ, '.claude-exec/p1box-ar-20261027/MANIFESTO-AR.sha256');
const TMP = mkdtempSync(join(tmpdir(), 'catraca-p1box-tv-'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const arquivos = (d, pre = '') => readdirSync(d).flatMap((n) => {
  const p = join(d, n), r = pre ? `${pre}/${n}` : n;
  return statSync(p).isDirectory() ? arquivos(p, r) : [r];
});
const montar = (script, base, saida) => spawnSync(process.execPath, [script, '--base', base, '--saida', saida], { cwd: RAIZ, encoding: 'utf8' });
// base de controle = cópia da base do ar + manifesto ao lado (o montador lê ../MANIFESTO-AR.sha256)
function copiaDaBase(nome) {
  const d = join(TMP, nome); mkdirSync(d, { recursive: true });
  cpSync(BASE_AR, join(d, 'arquivos'), { recursive: true });
  cpSync(MANIFESTO, join(d, 'MANIFESTO-AR.sha256'));
  return join(d, 'arquivos');
}

await secao('pacote de verdade', () => {
  t('peças da prova existem (montador, base do ar, manifesto)', [MONTADOR, BASE_AR, MANIFESTO].every(existsSync));
  const manifesto = new Map(readFileSync(MANIFESTO, 'utf8').trim().split('\n').map((l) => { const [h, p] = l.split(/\s+/); return [p.replace(/^\.\//, ''), h]; }));
  t('manifesto do ar tem 41 arquivos (publicação dpl_FNKZphaSJqLyB7bTtC2qz2242V73)', manifesto.size === 41, String(manifesto.size));
  const DIST = join(TMP, 'pacote');
  const r = montar(MONTADOR, BASE_AR, DIST);
  t('montador aceita a base do ar (saída 0)', r.status === 0, (r.stderr || r.stdout).slice(0, 300));
  const todos = arquivos(DIST);
  const mudados = [...manifesto].filter(([p, h]) => !existsSync(join(DIST, p)) || sha(join(DIST, p)) !== h).map(([p]) => p);
  t('as 41 telas do ar entram byte a byte (sha256 = manifesto)', mudados.length === 0, mudados.slice(0, 5).join(', '));
  const novos = todos.filter((p) => !manifesto.has(p));
  const intrusos = novos.filter((p) => !p.startsWith('tv/') && p !== 'api/room.js' && p !== 'package.json');
  t('arquivo novo só em tv/, api/room.js e package.json', intrusos.length === 0, intrusos.slice(0, 5).join(', '));
  t('TV presente: tv/index.html + peças em tv/web/', existsSync(join(DIST, 'tv/index.html')) && novos.some((p) => p.startsWith('tv/web/')));
  t('cérebro do sinal da TV vai junto (tv/web/command-box/cerebro/cerebro-tv-sinal.js)', existsSync(join(DIST, 'tv/web/command-box/cerebro/cerebro-tv-sinal.js')));
  const furos = novos.filter((p) => p.startsWith('tv/') && /\.(js|html)$/.test(p))
    .filter((p) => { const s = readFileSync(join(DIST, p), 'utf8'); return /(['"`])\/web\//.test(s) || /(['"`])\.\.\/web\//.test(s); });
  t('nenhuma peça da TV aponta para /web/ da raiz (telas do ar não mudam)', furos.length === 0, furos.slice(0, 5).join(', '));
  t('ferramenta de autor fora da TV publicada', !readFileSync(join(DIST, 'tv/index.html'), 'utf8').includes('salvar-versao.js'));
  t('api/room.js = web/teste-aparelhos/api/room.js', sha(join(DIST, 'api/room.js')) === sha(join(RAIZ, 'web/teste-aparelhos/api/room.js')));
  t('package.json só {"type":"module"}', JSON.stringify(JSON.parse(readFileSync(join(DIST, 'package.json'), 'utf8'))) === '{"type":"module"}');
  const lista = readFileSync(join(TMP, 'p1box-tv-LISTA.sha256'), 'utf8').trim().split('\n');
  t('lista do pacote cobre todos os arquivos', lista.length === todos.length, `${lista.length} × ${todos.length}`);
});

await secao('controle: base com 1 byte trocado', () => {
  const b = copiaDaBase('byte');
  const alvo = readFileSync(MANIFESTO, 'utf8').trim().split('\n')[0].split(/\s+/)[1].replace(/^\.\//, '');
  appendFileSync(join(b, alvo), ' ');
  const r = montar(MONTADOR, b, join(TMP, 'saida-byte'));
  t(`RECUSADO quando a base difere do ar (${alvo})`, r.status === 1 && /base alterada/.test(r.stderr), `saída ${r.status}`);
});

await secao('controle: base com arquivo a mais', () => {
  const b = copiaDaBase('extra');
  writeFileSync(join(b, 'intruso.html'), '<p>x</p>');
  const r = montar(MONTADOR, b, join(TMP, 'saida-extra'));
  t('RECUSADO quando a base tem arquivo fora do manifesto', r.status === 1 && /fora do manifesto/.test(r.stderr), `saída ${r.status}`);
});

await secao('controle: ar já tem tv/', () => {
  const b = copiaDaBase('colisao');
  mkdirSync(join(b, 'tv'), { recursive: true }); writeFileSync(join(b, 'tv/index.html'), 'x');
  const r = montar(MONTADOR, b, join(TMP, 'saida-colisao'));
  t('RECUSADO quando o ar já tem tv/ (colisão)', r.status === 1 && /colisão/.test(r.stderr), `saída ${r.status}`);
});

await secao('controle: montador sem isolar', () => {
  const fonte = readFileSync(MONTADOR, 'utf8');
  const linha = /const isolar = \(txt\) => .*;\n/;
  t('controle do controle: a linha do isolar existe no montador', linha.test(fonte));
  const estragado = join(RAIZ, 'tools', `.ctl-sem-isolar-${process.pid}.mjs`);
  writeFileSync(estragado, fonte.replace(linha, 'const isolar = (txt) => txt;\n'));
  try {
    const r = montar(estragado, BASE_AR, join(TMP, 'saida-sem-isolar'));
    t('RECUSADO quando a TV aponta para /web/ da raiz', r.status === 1 && /TV aponta para \/web\//.test(r.stderr), `saída ${r.status}`);
  } finally { rmSync(estragado, { force: true }); }
});

rmSync(TMP, { recursive: true, force: true });
console.log(`\nmontar-p1box-tv: ${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
