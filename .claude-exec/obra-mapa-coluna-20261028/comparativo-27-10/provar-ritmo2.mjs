import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=4&mapa=hoje'); await pg.waitForTimeout(20000);
const am = [];
for (let i = 0; i < 1000; i++) { await pg.waitForTimeout(120);
  const r = await pg.evaluate(() => { const l = document.querySelector('.qc-lin.qc-agora .qc-prog'); return l ? { n: l.parentElement.querySelector('.qc-nome b').textContent, w: l.getBoundingClientRect().width, v: window.__estado().v, t: performance.now() } : null; });
  if (r) am.push(r); }
require("fs").writeFileSync(process.argv[2] + "/ritmo-bruto.json", JSON.stringify(am));
const x = [];
for (let i = 4; i < am.length; i++) { const a = am[i-4], b = am[i]; if (a.n !== b.n || b.w <= a.w || b.w >= 1180) continue; x.push([(a.v + b.v) / 2, (b.w - a.w) / ((b.t - a.t) / 1000)]); }
const media = a => a.reduce((s, v) => s + v, 0) / a.length, mv = media(x.map(p => p[0])), mt = media(x.map(p => p[1]));
const r = x.reduce((s, p) => s + (p[0]-mv)*(p[1]-mt), 0) / Math.sqrt(x.reduce((s, p) => s + (p[0]-mv)**2, 0) * x.reduce((s, p) => s + (p[1]-mt)**2, 0));
for (const [a, b] of [[0, 80], [80, 100], [100, 120], [120, 999]]) { const g = x.filter(p => p[0] >= a && p[0] < b); if (g.length) console.log(`${a}–${b} km/h: ${g.length} amostras, barrinha anda ${media(g.map(p => p[1])).toFixed(0)} px/s`); }
console.log('amostras', x.length, 'correlação velocidade × ritmo da barrinha', r.toFixed(2));
await nav.close();
