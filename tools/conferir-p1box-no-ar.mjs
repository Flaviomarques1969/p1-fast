// conferir-p1box-no-ar.mjs — confere, arquivo a arquivo, uma publicação do p1box na Vercel contra uma pasta local
// (E5 da TV do box ao vivo, 27/10/2026).
//
// SÓ LEITURA: GET na API da Vercel (árvore da publicação; o "uid" de cada arquivo = sha1 do conteúdo). Não publica nada.
// A conferência única da skill de migração (conferir_publicacao.py) é presa ao CDAI (≥ 1000 arquivos, src/main.jsx)
// e para no p1box — esta faz o mesmo papel para este site.
//
// Aprova só quando a publicação e a pasta são IDÊNTICAS: mesmo conjunto de arquivos e mesmo sha1 em cada um.
// Falha fechada: árvore ilegível, pasta vazia ou controle que não reprova = REPROVADO.
// Controles a cada rodada (TÊM de reprovar): pasta com um arquivo fingido a mais; pasta sem um arquivo.
//
// Uso: node tools/conferir-p1box-no-ar.mjs <dpl_...> <pasta-local>
//   antes de publicar:  dpl_FNKZphaSJqLyB7bTtC2qz2242V73 × .claude-exec/p1box-ar-20261027/arquivos  → APROVADO
//   depois de publicar: <dpl novo> × dist/p1box-tv                                                  → APROVADO
// Saída: 0 aprovado · 1 reprovado · 2 não conseguiu ler.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const TEAM = 'team_v8bzBpeGglwgy67eZGGIPhoM';
const [dpl, pastaArg] = process.argv.slice(2);
if (!/^dpl_[A-Za-z0-9]+$/.test(dpl || '') || !pastaArg) { console.error('uso: conferir-p1box-no-ar.mjs <dpl_...> <pasta-local>'); process.exit(2); }
const PASTA = resolve(pastaArg);
const parar = (m) => { console.error('PAROU: ' + m + '\nRESULTADO: NÃO CONFERIDO'); process.exit(2); };

const arquivos = (d, pre = '') => readdirSync(d).flatMap((n) => {
  const p = join(d, n), r = pre ? `${pre}/${n}` : n;
  if (n === '.vercel' || n === '.DS_Store') return [];
  return statSync(p).isDirectory() ? arquivos(p, r) : [r];
});
if (!existsSync(PASTA)) parar(`pasta local não existe: ${PASTA}`);
const local = new Map(arquivos(PASTA).map((p) => [p, createHash('sha1').update(readFileSync(join(PASTA, p))).digest('hex')]));
if (!local.size) parar('pasta local vazia');

let token;
try { token = JSON.parse(readFileSync(join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'), 'utf8')).token; }
catch (e) { parar('chave do CLI da Vercel ilegível: ' + e.message); }
const r = await fetch(`https://api.vercel.com/v6/deployments/${dpl}/files?teamId=${TEAM}`, { headers: { Authorization: `Bearer ${token}` } });
if (!r.ok) parar(`API da Vercel respondeu ${r.status} para ${dpl}`);
const arvore = await r.json();
const noAr = new Map();
(function andar(nos, pre) {
  for (const n of nos || []) {
    const c = pre ? `${pre}/${n.name}` : n.name;
    if (n.type === 'directory') andar(n.children, c);
    else if (n.type === 'file') noAr.set(c, n.uid);
  }
})(arvore, '');
// a CLI sobe a pasta inteira sob "src/" — o prefixo sai da própria árvore (todo arquivo começa com ele, ou nenhum)
const comSrc = [...noAr.keys()].filter((p) => p.startsWith('src/')).length;
if (comSrc && comSrc !== noAr.size) parar(`prefixo indefinido: ${comSrc} de ${noAr.size} arquivos sob src/`);
const ar = new Map([...noAr].map(([p, h]) => [comSrc ? p.slice(4) : p, h]));
if (!ar.size) parar(`árvore de ${dpl} sem arquivos`);

function comparar(loc) {
  const dif = [];
  for (const [p, h] of loc) if (!ar.has(p)) dif.push(`falta no ar: ${p}`); else if (ar.get(p) !== h) dif.push(`conteúdo diferente: ${p}`);
  for (const p of ar.keys()) if (!loc.has(p)) dif.push(`a mais no ar: ${p}`);
  return dif;
}
const dif = comparar(local);
const fingido = new Map(local); fingido.set('controle-fingido.html', '0'.repeat(40));
const semUm = new Map(local); semUm.delete([...local.keys()][0]);
const ctl = [['pasta com arquivo fingido a mais', comparar(fingido)], ['pasta sem um arquivo', comparar(semUm)]];

console.log(`publicação ${dpl}: ${ar.size} arquivos · pasta ${pastaArg}: ${local.size} arquivos`);
console.log(`idênticos (sha1): ${[...local].filter(([p, h]) => ar.get(p) === h).length}`);
for (const d of dif.slice(0, 30)) console.log('  ' + d);
if (dif.length > 30) console.log(`  ... (+${dif.length - 30})`);
let cega = false;
for (const [nome, d] of ctl) { console.log(`controle "${nome}": ${d.length ? 'reprovou (certo)' : 'NÃO reprovou — régua cega'}`); if (!d.length) cega = true; }
const aprovado = !dif.length && !cega;
console.log('RESULTADO: ' + (aprovado ? 'APROVADO' : 'REPROVADO'));
process.exit(aprovado ? 0 : 1);
