// montar-p1box-tv.mjs — monta o PACOTE da TV do box ao vivo para p1box.vercel.app (E5, 27/10/2026).
//
// Regra do pacote: o que JÁ está no ar fica BYTE A BYTE como está; a TV nova entra ao lado.
//  - BASE = cópia fiel da publicação atual do p1box (baixada e conferida pelo sha1 que a Vercel guarda),
//    com o MANIFESTO-AR.sha256 ao lado. Arquivo da base diferente do manifesto = pacote RECUSADO.
//  - TV nova em /tv/ (index.html = Vista Piloto em modo TV) com CÓPIA PRÓPRIA das peças em /tv/web/...:
//    a Vista do ar usa /web/cockpit/cloud-bridge.js de julho; a TV usa a ponte nova — se dividissem o
//    arquivo, publicar a TV mudaria a tela antiga. Toda referência "/web/..." da TV vira "/tv/web/...".
//  - Ponte da sala de vídeo em /api/room (web/teste-aparelhos/api/room.js — a TV não pode chamar o
//    fam-racing direto, a trava de origem barra) + package.json {"type":"module"} (mesmo arranjo do p1tv).
// Fail-closed: peça faltando, referência da TV saindo de /tv/, colisão com a base ou base alterada = saída 1.
//
// Rodar: node tools/montar-p1box-tv.mjs [--base <pasta com os arquivos do ar>] [--saida <pasta>]
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = resolve(ROOT, arg('--base', '.claude-exec/p1box-ar-20261027/arquivos'));
const MANIFESTO = join(dirname(BASE), 'MANIFESTO-AR.sha256');
const DIST = resolve(ROOT, arg('--saida', 'dist/p1box-tv'));
const TV = 'tv';
const FONTE_TV = '_design-reference/mockup-command-box-vista-piloto.html';
const PONTE = 'web/teste-aparelhos/api/room.js';

const erros = [];
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const arquivos = (d, pre = '') => readdirSync(d).flatMap((n) => {
  const p = join(d, n), r = pre ? `${pre}/${n}` : n;
  return statSync(p).isDirectory() ? arquivos(p, r) : [r];
});

// 1) BASE conferida contra o manifesto do ar (nada a mais, nada a menos, nenhum byte diferente).
if (!existsSync(BASE) || !existsSync(MANIFESTO)) { console.error(`[p1box-tv] base ou manifesto ausente: ${BASE}`); process.exit(1); }
const manifesto = new Map(readFileSync(MANIFESTO, 'utf8').trim().split('\n').map((l) => {
  const [h, p] = l.split(/\s+/); return [p.replace(/^\.\//, ''), h];
}));
const naBase = arquivos(BASE);
for (const [p, h] of manifesto) if (!naBase.includes(p)) erros.push(`base sem ${p}`); else if (sha(join(BASE, p)) !== h) erros.push(`base alterada: ${p}`);
for (const p of naBase) if (!manifesto.has(p)) erros.push(`base com arquivo fora do manifesto: ${p}`);
for (const p of naBase) if (p.startsWith(`${TV}/`) || p.startsWith('api/') || p === 'package.json') erros.push(`colisão: o ar já tem ${p}`);
if (erros.length) { console.error('[p1box-tv] RECUSADO:\n  ' + erros.join('\n  ')); process.exit(1); }

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const p of naBase) { mkdirSync(dirname(join(DIST, p)), { recursive: true }); copyFileSync(join(BASE, p), join(DIST, p)); }

// 2) TV em /tv/: mesmas regras do montar-p1box.mjs (ferramenta de autor fora, segue dependências).
const linhaAutor = '<script src="../web/_atelier/salvar-versao.js"></script>';
const limpar = (html) => html.replace(linhaAutor, '<!-- ferramenta de autor removida da publicação -->');
// "/web/..." entre aspas/crase (inclusive começo de template) e "../web/..." do HTML → /tv/web/...
const isolar = (txt) => txt.replace(/(['"`])\/web\//g, `$1/${TV}/web/`).replace(/(['"`])\.\.\/web\//g, `$1/${TV}/web/`);

function refsDe(texto) {
  const out = [];
  const padroes = [
    /import\s+[^'"]*from\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[^'"]*from\s*['"]([^'"]+)['"]/g,
    /\bfrom\s*['"](\.[^'"]+)['"]/g,
    /fetch\(\s*['"]([^'"?]+)/g,
    /<script[^>]*src=['"]([^'"]+)['"]/g,
  ];
  for (const p of padroes) for (const m of texto.matchAll(p)) out.push(m[1]);
  return out;
}
function resolverRef(ref, deRel) {
  if (/^https?:/i.test(ref) || ref.startsWith('data:')) return null;
  if (ref.includes('${') || ref.endsWith('/')) return null;
  let abs;
  if (ref.startsWith('/web/')) abs = join(ROOT, ref.slice(1));
  else if (ref.startsWith('.')) abs = resolve(join(ROOT, dirname(deRel)), ref);
  else return null;
  return relative(ROOT, abs);
}

const htmlTv = limpar(readFileSync(join(ROOT, FONTE_TV), 'utf8'));
mkdirSync(join(DIST, TV), { recursive: true });
writeFileSync(join(DIST, TV, 'index.html'), isolar(htmlTv));
const fila = refsDe(htmlTv).map((r) => resolverRef(r, FONTE_TV)).filter(Boolean);
const visitados = new Set(), faltando = [], foraDeProposito = [];
while (fila.length) {
  const rel = fila.shift();
  if (visitados.has(rel)) continue;
  visitados.add(rel);
  const origem = join(ROOT, rel);
  if (!existsSync(origem)) {
    if (rel.includes('volta-real-gps-')) {     // mesmo atalho do montar-p1box.mjs (nome montado na hora)
      const alt = 'web/command-box/fixtures/volta-real-gps-23-05.json';
      if (existsSync(join(ROOT, alt)) && !visitados.has(alt)) fila.push(alt);
      continue;
    }
    // Prefixo de nome montado na hora ('.../replay-hoje-' + data): gravação do modo DEV ?replay-gps=,
    // não vai ao ar. Fica fora e sai no relatório.
    if (rel.endsWith('-')) { foraDeProposito.push(rel); continue; }
    faltando.push(rel); continue;
  }
  if (!rel.startsWith('web/') && !rel.startsWith('src/')) { erros.push(`peça fora de web/ e src/: ${rel}`); continue; }
  const destino = join(DIST, TV, rel);
  mkdirSync(dirname(destino), { recursive: true });
  if (rel.endsWith('.js')) {
    const txt = readFileSync(origem, 'utf8');
    writeFileSync(destino, isolar(txt));
    for (const r of refsDe(txt)) { const x = resolverRef(r, rel); if (x) fila.push(x); }
  } else copyFileSync(origem, destino);
}
if (faltando.length) erros.push(...faltando.map((f) => `peça da TV faltando na origem: ${f}`));

// 3) Ponte da sala + package.json (só para a função; páginas estáticas não mudam).
mkdirSync(join(DIST, 'api'), { recursive: true });
copyFileSync(join(ROOT, PONTE), join(DIST, 'api', 'room.js'));
writeFileSync(join(DIST, 'package.json'), '{\n  "type": "module"\n}\n');

// 4) Conferências do pacote pronto.
for (const [p, h] of manifesto) if (sha(join(DIST, p)) !== h) erros.push(`arquivo do ar mudou no pacote: ${p}`);
const daTv = arquivos(join(DIST, TV));
for (const p of daTv.filter((x) => /\.(js|html)$/.test(x))) {
  const txt = readFileSync(join(DIST, TV, p), 'utf8');
  if (/(['"`])\/web\//.test(txt) || /(['"`])\.\.\/web\//.test(txt)) erros.push(`TV aponta para /web/ fora de /tv/: tv/${p}`);
}
const novos = arquivos(DIST).filter((p) => !manifesto.has(p));
if (erros.length) { console.error('[p1box-tv] RECUSADO:\n  ' + erros.join('\n  ')); process.exit(1); }

const lista = arquivos(DIST).sort().map((p) => `${sha(join(DIST, p))}  ${p}`).join('\n') + '\n';
writeFileSync(join(dirname(DIST), 'p1box-tv-LISTA.sha256'), lista);
console.log(`[p1box-tv] base do ar: ${manifesto.size} arquivos, idênticos (sha256) -> ${relative(ROOT, DIST)}`);
console.log(`[p1box-tv] novos: ${novos.length} (tv/index.html + ${daTv.length - 1} peças da TV em /tv/, api/room.js, package.json)`);
for (const f of foraDeProposito) console.log(`[p1box-tv] fora de propósito (nome montado na hora, só DEV): ${f}*`);
console.log(`[p1box-tv] lista do pacote: ${relative(ROOT, join(dirname(DIST), 'p1box-tv-LISTA.sha256'))}`);
console.log('[p1box-tv] OK — telas do ar intocadas; TV em /tv/?tv=1 (ensaio: /tv/?canal=cockpit-bubi-dev-teste).');
