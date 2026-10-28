// prova de tela do TOPO FIXO do quadro de curvas (Flávio 28/10: "a tela não pode mover. tem de ser fixa"):
// gravação real 21/06 inteira, foto a cada 150 ms: as 7 casas do topo (volta, tempo, Δ, velocidade, última, melhor,
// referência) com a MESMA caixa em todas as fotos; nenhum texto do topo cortado (scrollWidth/scrollHeight) nem fora do
// quadro. Controle: argv[2] = a TV antes do conserto tem de REPROVAR.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const erros = [], errosPg = [];
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: (([w, h]) => ({ width: +w, height: +h }))((process.env.VP || '1920x1080').split('x')) }); await pg.route('**/api/room', r => r.abort());
pg.on('pageerror', e => errosPg.push(e.message));
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=10&fim=parar');
const am = []; let parado = 0, ult = null, andou = 0;
for(let k = 0; k < 2500 && parado < 15; k++){
  await pg.waitForTimeout(150);
  const a = await pg.evaluate(() => {
    const q = document.querySelector('[data-tv-quadro]'), t = q && q.querySelector('.qc-topo'); if(!t || t.children.length !== 7) return null;
    const Q = q.getBoundingClientRect();
    return { caixas: [...t.children].map(c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }),
      textos: [...t.children].map(c => c.textContent),
      corte: [...t.querySelectorAll('span')].filter(e => e.scrollWidth > e.clientWidth + 1 || (e.closest('.qc-ref') && e.scrollHeight > e.clientHeight + 1)).map(e => e.textContent),
      fora: [...t.children].filter(c => { const r = c.getBoundingClientRect(); return r.left < Q.left - 1 || r.right > Q.right + 1; }).map(c => c.textContent) };
  });
  if(!a) continue; am.push(a);
  const ch = a.textos.join('|'); if(ult != null && ch !== ult) andou++; parado = ch === ult && andou > 50 ? parado + 1 : 0; ult = ch;
}
await nav.close();
console.log(am.length + ' fotos do topo; textos distintos ' + new Set(am.map(a => a.textos.join('|'))).size);
if(am.length < 200 || new Set(am.map(a => a.textos[1])).size < 50) erros.push('poucas fotos ou o tempo não andou — régua cega');
for(let c = 0; c < 7; c++){ const v = [...new Set(am.map(a => a.caixas[c]))];
  if(v.length !== 1) erros.push('casa ' + (c + 1) + ' («' + am[0].textos[c].slice(0, 12) + '») mudou ' + v.length + ' vezes: ' + v.slice(0, 3).join(' / ')); }
const cortes = new Set(am.flatMap(a => a.corte)), foras = new Set(am.flatMap(a => a.fora));
if(cortes.size) erros.push('texto cortado: ' + [...cortes].slice(0, 4).join(' / '));
if(foras.size) erros.push('casa fora do quadro: ' + [...foras].slice(0, 3).join(' / '));
if(errosPg.length) erros.push('erro na página: ' + errosPg.slice(0, 2).join(' | '));
console.log(erros.length ? 'REPROVADO\n - ' + erros.join('\n - ') : 'APROVADO — 7 casas fixas, nenhum corte');
process.exit(erros.length ? 1 : 0);
