import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const dir = process.argv[2];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=4');
const vistos = {}; let foto = 0, amostras = 0, comVermelho = 0, comAmarelo = 0, mudou = 0;
for (let i = 0; i < 300; i++) { await pg.waitForTimeout(250);
  const r = await pg.evaluate(() => { const l = document.querySelector('.qc-lin.qc-agora'); if (!l) return null;
    const p = l.querySelector('.qc-prog'); return { nome: l.querySelector('.qc-nome b').textContent, bg: p.style.background, w: p.getBoundingClientRect().width, larg: l.getBoundingClientRect().width }; });
  if (!r || !r.bg) continue; amostras++;
  // cores por posição ABSOLUTA na linha (px): o pedaço já pintado não pode trocar de cor
  const segs = [...r.bg.matchAll(/var\(--qc-(vermelho|ambar)\) ([\d.]+)% ([\d.]+)%/g)].map(m => [m[1], +m[2]*r.w/100, +m[3]*r.w/100]);
  if (segs.some(s => s[0]==='vermelho')) comVermelho++; if (segs.some(s => s[0]==='ambar')) comAmarelo++;
  const ant = vistos[r.nome];
  if (ant) for (const [cor,a,b] of ant) { const meio = (a+b)/2; if (b - a < 4) continue; const agora = segs.find(s => s[1] <= meio && meio <= s[2]); if (agora && agora[0] !== cor) mudou++; }
  vistos[r.nome] = segs;
  if (foto < 2 && segs.filter(s=>s[0]==='vermelho').length && segs.length >= 2 && r.w > 300) { foto++; await pg.locator('.qc-lin.qc-agora').screenshot({ path:`${dir}/trilha-${foto}.png` }); console.log('foto', foto, r.nome, JSON.stringify(segs.map(s=>[s[0],Math.round(s[1]),Math.round(s[2])]))); }
}
console.log({ amostras, comVermelho, comAmarelo, pedacoQueMudouDeCor: mudou, erros: erros.length });
await nav.close();
