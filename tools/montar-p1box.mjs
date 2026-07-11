// montar-p1box.mjs — monta o PACOTE PUBLICÁVEL do MENU do Command Box + telas ativas, pra p1box.vercel.app.
//
// Diferença pro montar-tv-publi.mjs (que publica SÓ a Vista Piloto): aqui a HOME é o MENU
// (menu-command-box.html), e dele se chega às telas ATIVAS (Piloto e Frenagem & Aceleração).
// O Engenheiro está "em construção" no menu (sem link) — não entra no pacote.
//
// Segue as dependências (/web/...) recursivamente, copia SÓ o necessário, e CONFERE que nada faltou.
// Rodar: node tools/montar-p1box.mjs
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist', 'p1box');
const DREF = '_design-reference';

// Telas que entram. O MENU é a home (index.html) e também menu-command-box.html (alvo do "Voltar").
const ENTRADAS = [
  { fonte: `${DREF}/menu-command-box.html`,                 nomes: ['index.html', 'menu-command-box.html'] },
  { fonte: `${DREF}/mockup-command-box-vista-piloto.html`,  nomes: ['mockup-command-box-vista-piloto.html'] },
  { fonte: `${DREF}/mockup-command-box-comparar-voltas.html`, nomes: ['mockup-command-box-comparar-voltas.html'] },
];
const ESTATICOS = [ { fonte: `${DREF}/bubi.jpg`, nome: 'bubi.jpg' } ];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const linhaAutor = '<script src="../web/_atelier/salvar-versao.js"></script>';
const limpar = (html) => html.includes(linhaAutor)
  ? html.replace(linhaAutor, '<!-- ferramenta de autor removida da publicação -->')
  : html;

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

// 1) Escreve cada tela (limpa) e enfileira as dependências dela.
const visitados = new Set();
const fila = [];
for (const ent of ENTRADAS) {
  const html = limpar(readFileSync(join(ROOT, ent.fonte), 'utf8'));
  for (const nome of ent.nomes) writeFileSync(join(DIST, nome), html);
  for (const ref of refsDe(html)) { const r = resolverRef(ref, ent.fonte); if (r) fila.push(r); }
}
// 2) Estáticos diretos (a foto do fundo do menu).
for (const e of ESTATICOS) {
  const destino = join(DIST, e.nome);
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(join(ROOT, e.fonte), destino);
}

// 3) CRAWLER: segue /web/... e relativos até fechar.
const faltando = [];
while (fila.length) {
  const rel = fila.shift();
  if (visitados.has(rel)) continue;
  visitados.add(rel);
  const origem = join(ROOT, rel);
  if (!existsSync(origem)) {
    if (rel.includes('volta-real-gps-')) {
      const alt = 'web/command-box/fixtures/volta-real-gps-23-05.json';
      if (existsSync(join(ROOT, alt)) && !visitados.has(alt)) fila.push(alt);
      continue;
    }
    faltando.push(rel); continue;
  }
  const destino = join(DIST, rel);
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(origem, destino);
  if (rel.endsWith('.js')) for (const ref of refsDe(readFileSync(origem, 'utf8'))) { const r = resolverRef(ref, rel); if (r) fila.push(r); }
}

const copiados = [...visitados].filter((r) => !faltando.includes(r));
console.log(`[p1box] menu (home) + 2 telas + foto + ${copiados.length} dependências -> ${relative(ROOT, DIST)}`);
console.log(`[p1box] faltando na origem: ${faltando.length}`);
if (faltando.length) { console.error('[p1box] FALTANDO:', faltando); process.exit(1); }
console.log('[p1box] OK — pacote completo e fechado. Home = menu; telas ativas: Piloto e Frenagem & Aceleração.');
