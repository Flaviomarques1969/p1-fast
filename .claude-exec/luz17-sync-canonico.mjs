// Sincroniza o mockup canônico do cockpit piloto com a luz de 17.
// Fonte do <style> = cockpit.css (já corrigido). DOM = 17 LEDs (1..9..1).
// Mantém o canônico como contrato: cockpit.css volta a ser byte-idêntico ao <style>.
import { readFileSync, writeFileSync } from 'fs';

const CANON = '/Users/imac/Projetos/P1 Fast/_design-reference/mockup-cockpit-piloto.html';
const CSS = '/Users/imac/Projetos/P1 Fast/web/cockpit/cockpit.css';

let lines = readFileSync(CANON, 'utf8').split('\n');
const iSO = lines.indexOf('<style>');
const iSC = lines.indexOf('</style>');
if (iSO < 0 || iSC < 0) throw new Error('marcadores <style>/</style> não achados');

// 1. troca o miolo do <style> pelo cockpit.css atual (sem o \n final)
const cssLines = readFileSync(CSS, 'utf8').replace(/\n$/, '').split('\n');
lines = [...lines.slice(0, iSO + 1), ...cssLines, ...lines.slice(iSC)];

// 2. troca os LEDs do DOM por 17 (1..9..1)
let txt = lines.join('\n');
const TIERS = [1,2,3,4,5,6,7,8,9,8,7,6,5,4,3,2,1];
const re = /(<div class="shift-light"[^>]*>)([\s\S]*?)(<\/div>)/;
const m = txt.match(re);
if (!m) throw new Error('bloco shift-light DOM não achado');
const meio = m[2];
const ind = (meio.match(/\n([ \t]*)<span/) || [, '      '])[1];
const closeInd = (meio.match(/\n([ \t]*)$/) || [, '    '])[1];
const spans = TIERS.map(t => `${ind}<span class="shift-light__dot" data-tier="${t}"></span>`).join('\n');
txt = txt.replace(re, () => m[1] + '\n' + spans + '\n' + closeInd + m[3]);

writeFileSync(CANON, txt);

// 3. re-detecta as fronteiras (números novos pro smoke CKW-01/02)
const L = txt.split('\n');
const idx = (s, from = 0) => { for (let i = from; i < L.length; i++) if (L[i] === s) return i + 1; return -1; };
const so = idx('<style>'), sc = idx('</style>', so), po = idx('<script>', sc), pc = idx('</script>', po);
console.log(`NOVAS FRONTEIRAS → <style>=${so} </style>=${sc} <script>=${po} </script>=${pc}`);
console.log('dots no canônico:', (txt.match(/shift-light__dot/g) || []).length);
