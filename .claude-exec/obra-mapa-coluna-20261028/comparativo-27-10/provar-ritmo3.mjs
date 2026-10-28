import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
// 10× até o carro andar, depois 1× (tempo real) e coleta a cada quadro, por dentro da página
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=hoje'); await pg.waitForTimeout(15000);
await pg.click('#ctrl [data-vel="1"]');
await pg.evaluate(() => { window.__am = []; const f = () => { const l = document.querySelector('.qc-lin.qc-agora .qc-prog');
  if (l) window.__am.push([l.parentElement.querySelector('.qc-nome b').textContent, parseFloat(l.style.width), window.__estado().v, performance.now()]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
await pg.waitForTimeout(150000);
const am = await pg.evaluate(() => window.__am); await nav.close();
require('fs').writeFileSync(process.argv[2] + '/ritmo3-bruto.json', JSON.stringify(am));
// janelas de 0,5 s dentro da mesma curva: % da curva por segundo × km/h
const por = {}; for (const a of am) (por[a[0]] = por[a[0]] || []).push(a);
let todas = [];
for (const [n, l] of Object.entries(por)) { const x = []; let i = 0;
  for (let j = 0; j < l.length; j++) { while (l[j][3] - l[i][3] > 500) i++; if (l[j][3] - l[i][3] < 400 || l[j][1] >= 99.9) continue; if (j % 15) continue;
    x.push([(l[i][2] + l[j][2]) / 2, (l[j][1] - l[i][1]) / ((l[j][3] - l[i][3]) / 1000)]); }
  if (x.length < 4) continue; todas = todas.concat(x.map(q => [n, ...q]));
  const m = a => a.reduce((s, v) => s + v, 0) / a.length, mv = m(x.map(q => q[0])), mt = m(x.map(q => q[1]));
  const r = x.reduce((s, q) => s + (q[0]-mv)*(q[1]-mt), 0) / Math.sqrt(x.reduce((s, q) => s + (q[0]-mv)**2, 0) * x.reduce((s, q) => s + (q[1]-mt)**2, 0));
  const s = [...x].sort((a, b) => a[0] - b[0]), k = Math.ceil(s.length / 3), lo = s.slice(0, k), hi = s.slice(-k);
  console.log(`${n}: ${x.length} janelas | ${m(lo.map(q=>q[0])).toFixed(0)} km/h → ${m(lo.map(q=>q[1])).toFixed(1)} %/s | ${m(hi.map(q=>q[0])).toFixed(0)} km/h → ${m(hi.map(q=>q[1])).toFixed(1)} %/s | correlação ${r.toFixed(2)}`);
}
console.log('quadros coletados', am.length);
