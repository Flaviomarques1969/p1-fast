// Sincroniza o canônico com cockpit.css (<style>) E cockpit.js (<script>) e
// re-extrai ambos pra garantir byte-identidade. DOM (17 LEDs) já está no canônico.
import { readFileSync, writeFileSync } from 'fs';

const CANON = '/Users/imac/Projetos/P1 Fast/_design-reference/mockup-cockpit-piloto.html';
const CSS = '/Users/imac/Projetos/P1 Fast/web/cockpit/cockpit.css';
const JS = '/Users/imac/Projetos/P1 Fast/web/cockpit/cockpit.js';

function replaceBlock(lines, openTag, closeTag, file) {
  const iO = lines.indexOf(openTag);
  const iC = lines.indexOf(closeTag);
  if (iO < 0 || iC < 0) throw new Error(`marcadores ${openTag}/${closeTag} não achados`);
  const body = readFileSync(file, 'utf8').replace(/\n$/, '').split('\n');
  return [...lines.slice(0, iO + 1), ...body, ...lines.slice(iC)];
}

let lines = readFileSync(CANON, 'utf8').split('\n');
lines = replaceBlock(lines, '<style>', '</style>', CSS);
lines = replaceBlock(lines, '<script>', '</script>', JS);
writeFileSync(CANON, lines.join('\n'));

// re-detectar fronteiras
const idx = (s, from = 0) => { for (let i = from; i < lines.length; i++) if (lines[i] === s) return i + 1; return -1; };
const so = idx('<style>'), sc = idx('</style>', so), po = idx('<script>', sc), pc = idx('</script>', po);
console.log(`FRONTEIRAS → <style>=${so} </style>=${sc} <script>=${po} </script>=${pc}`);

// re-extrair derivados do canônico (garante paridade exata)
const css = lines.slice(so, sc - 1).join('\n') + '\n';
const js = lines.slice(po, pc - 1).join('\n') + '\n';
writeFileSync(CSS, css);
writeFileSync(JS, js);
console.log(`cockpit.css=${Buffer.byteLength(css)}B  cockpit.js=${Buffer.byteLength(js)}B`);
