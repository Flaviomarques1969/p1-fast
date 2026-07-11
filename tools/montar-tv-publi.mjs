// montar-tv-publi.mjs — monta o PACOTE PUBLICÁVEL da TV do box (Vista Piloto do Command Box).
//
// Por quê: a tela aprovada (_design-reference/mockup-command-box-vista-piloto.html) puxa arquivos de
// /web/... que por sua vez puxam outros (o "cérebro", módulos de curvas, domínio...). Publicar só a
// pasta dela quebraria; publicar o projeto todo exporia o código. Este script SEGUE as dependências
// recursivamente a partir do index, copia SÓ o necessário pra uma pasta enxuta e fechada
// (dist/command-box-tv/) preservando os caminhos, e CONFERE que nada ficou pra trás.
//
// A TV só ESCUTA o canal ao vivo (nunca publica). Em demonstração, abrir com ?replay=23-05.
// Rodar: node tools/montar-tv-publi.mjs
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist', 'command-box-tv');
const HTML_FONTE = '_design-reference/mockup-command-box-vista-piloto.html';

// Limpa e recria a pasta de publicação (gerada — nada de fonte da verdade aqui).
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1) index.html = a tela aprovada, SEM a ferramenta de autor (salvar-versao.js não vai pra TV).
let html = readFileSync(join(ROOT, HTML_FONTE), 'utf8');
const linhaAutor = '<script src="../web/_atelier/salvar-versao.js"></script>';
if (html.includes(linhaAutor)) html = html.replace(linhaAutor, '<!-- ferramenta de autor removida da publicação -->');
writeFileSync(join(DIST, 'index.html'), html);

// Extrai referências de UM texto: imports/fetch/src. Devolve caminhos crus (relativos ou /web/...).
function refsDe(texto) {
  const out = [];
  const padroes = [
    /import\s+[^'"]*from\s*['"]([^'"]+)['"]/g,   // import x from '...'
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,        // import('...')
    /export\s+[^'"]*from\s*['"]([^'"]+)['"]/g,     // export ... from '...'
    /\bfrom\s*['"](\.[^'"]+)['"]/g,                // from './...'
    /fetch\(\s*['"]([^'"?]+)/g,                    // fetch('/web/...')
    /<script[^>]*src=['"]([^'"]+)['"]/g,           // <script src=...>
  ];
  for (const p of padroes) for (const m of texto.matchAll(p)) out.push(m[1]);
  return out;
}

// Resolve uma referência (do arquivo `deRel`, relativo à ROOT) num caminho relativo à ROOT, ou null
// se for externo (http) ou caminho dinâmico que não dá pra resolver estático.
function resolverRef(ref, deRel) {
  if (/^https?:/i.test(ref) || ref.startsWith('data:')) return null;        // externo (esm.sh etc.)
  if (ref.includes('${') || ref.endsWith('/')) return null;                  // dinâmico
  let abs;
  if (ref.startsWith('/web/')) abs = join(ROOT, ref.slice(1));               // absoluto do site
  else if (ref.startsWith('.')) abs = resolve(join(ROOT, dirname(deRel)), ref); // relativo ao arquivo
  else return null;                                                          // bare/CDN
  return relative(ROOT, abs);
}

// 2) CRAWLER: começa no index e segue as dependências até fechar.
const visitados = new Set();          // caminhos relativos à ROOT já copiados
const fila = [];
for (const ref of refsDe(html)) { const r = resolverRef(ref, HTML_FONTE); if (r) fila.push(r); }
const faltando = [];

while (fila.length) {
  const rel = fila.shift();
  if (visitados.has(rel)) continue;
  visitados.add(rel);
  const origem = join(ROOT, rel);
  if (!existsSync(origem)) {
    // caminho de fixture com id (volta-real-gps-<id>): garante o 23-05 da demonstração.
    if (rel.includes('volta-real-gps-')) { const alt = 'web/command-box/fixtures/volta-real-gps-23-05.json'; if (existsSync(join(ROOT, alt)) && !visitados.has(alt)) fila.push(alt); continue; }
    faltando.push(rel); continue;
  }
  const destino = join(DIST, rel);
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(origem, destino);
  if (rel.endsWith('.js')) for (const ref of refsDe(readFileSync(origem, 'utf8'))) { const r = resolverRef(ref, rel); if (r) fila.push(r); }
}

const copiados = [...visitados].filter((r) => !faltando.includes(r));
console.log(`[tv] index.html + ${copiados.length} dependências (resolvidas recursivamente) -> ${relative(ROOT, DIST)}`);
console.log(`[tv] faltando na origem: ${faltando.length}`);
if (faltando.length) { console.error('[tv] FALTANDO:', faltando); process.exit(1); }
console.log('[tv] OK — pacote completo e fechado. TV só ESCUTA o canal; demonstração: ?replay=23-05');
