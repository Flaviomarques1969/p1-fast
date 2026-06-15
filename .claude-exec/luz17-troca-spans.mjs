// Substitui os 12 LEDs do shift-light por 17 (data-tier 1..9..1) nas telas do
// cockpit. Espelhado com luz central (tier 9). Preserva a indentação de cada arquivo.
import { readFileSync, writeFileSync } from 'fs';

const TIERS = [1,2,3,4,5,6,7,8,9,8,7,6,5,4,3,2,1]; // 17 luzes, central = 9
const base = '/Users/imac/Projetos/P1 Fast/web/cockpit/';
const files = ['index-t3000.html','index-live.html','index.html','simulacao-ia-100.html','cockpit-demo.html']
  .map(f => base + f);

const re = /(<div class="shift-light"[^>]*>)([\s\S]*?)(<\/div>)/;

for (const f of files) {
  const s = readFileSync(f, 'utf8');
  const m = s.match(re);
  if (!m) { console.log('NAO ACHOU bloco shift-light em', f); continue; }
  const meio = m[2];
  const ind = (meio.match(/\n([ \t]*)<span/) || [,'      '])[1];        // indent dos spans
  const closeInd = (meio.match(/\n([ \t]*)$/) || [,'    '])[1];          // indent do </div>
  const spans = TIERS.map(t => `${ind}<span class="shift-light__dot" data-tier="${t}"></span>`).join('\n');
  const novo = m[1] + '\n' + spans + '\n' + closeInd + m[3];
  const out = s.replace(re, () => novo);
  writeFileSync(f, out);
  const n = (out.match(/shift-light__dot/g) || []).length;
  console.log('OK', f.split('/').pop(), '→', n, 'luzes');
}
