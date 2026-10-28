// MEDIÇÃO (antes de mexer): o que se move na faixa da volta inteira ([data-tv-faixa]) durante a gravação real 21-06.
// Amostra a cada 200 ms: caixa do bloco e do gráfico, rótulo da escala, y do 1º e do meio da linha dourada (melhor) e
// da azul (atual) — e conta cada MUDANÇA.  argv[2] = URL da página (padrão: a TV local).
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const seg = +(process.argv[3] || 200);
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.route('**/api/room', r => r.abort());
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=8&fim=parar');
const am = [];
const t0 = Date.now();
while(Date.now() - t0 < seg * 1000){
  await pg.waitForTimeout(200);
  am.push(await pg.evaluate(() => {
    const f = document.querySelector('[data-tv-faixa]'); if(!f) return null;
    const r = f.getBoundingClientRect(), g = f.querySelector('.fx-g'), gr = g && g.getBoundingClientRect();
    const pl = (sel) => { const p = f.querySelector(sel + ' polyline'); if(!p) return null; const pts = p.getAttribute('points').split(' '); return pts[0] + '|' + pts[Math.floor(pts.length / 2)]; };
    const esc = f.querySelector('[data-fx-escala]');
    const nm = [...f.querySelectorAll('.fx-nomes span')].map(s => s.style.left).join(',');
    return { caixa: [r.x, r.y, r.width, r.height].map(Math.round).join(','), graf: gr ? [gr.x, gr.y, gr.width, gr.height].map(Math.round).join(',') : null,
      escala: esc ? esc.textContent : null, melhor: pl('.fx-melhor'), atual: pl('.fx-atual'), nomes: nm,
      grade: [...f.querySelectorAll('.fx-grade')].map(l => l.getAttribute('y1')).join(','),
      volta: (window.__tvGps && window.__tvGps.blocos && window.__tvGps.blocos.faixa && window.__tvGps.blocos.faixa.atual) ? window.__tvGps.blocos.faixa.atual.n : null };
  }));
}
await nav.close();
const ok = am.filter(Boolean);
console.log('amostras ' + am.length + ' (com faixa ' + ok.length + ')');
for(const k of ['caixa', 'graf', 'escala', 'grade', 'nomes', 'melhor', 'atual']){
  const vist = []; let mud = 0, prev;
  ok.forEach((a, i) => { if(i && a[k] !== prev) mud++; prev = a[k]; if(!vist.includes(a[k])) vist.push(a[k]); });
  console.log(k + ': ' + mud + ' mudanças, ' + vist.length + ' valores distintos' + (vist.length <= 6 ? ' → ' + JSON.stringify(vist) : ''));
}
// mesmo ponto da linha DOURADA (1º ponto) com mesmo x: y muda?
const ys = new Map(); ok.forEach(a => { if(a.melhor){ const [x, y] = a.melhor.split('|')[0].split(','); if(!ys.has(x)) ys.set(x, new Set()); ys.get(x).add(y); } });
console.log('melhor 1º ponto: ' + [...ys].map(([x, s]) => 'x=' + x + ' y∈{' + [...s].join(',') + '}').join(' ; '));
const lin = []; let pv;
ok.forEach((a, i) => { const s = a.escala + ' | graf ' + a.graf + ' | nomes ' + (a.nomes ? 'sim' : 'não') + ' | v' + a.volta; if(s !== pv) lin.push('t=' + (i * 0.2).toFixed(1) + 's ' + s); pv = s; });
console.log(lin.join('\n'));
