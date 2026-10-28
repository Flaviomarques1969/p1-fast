import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const dir = process.argv[2];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10');
await pg.waitForTimeout(45000);
const f = pg.frames().find(x => x.url().includes('vista-piloto'));
const r = await f.evaluate(() => {
  const blk = document.querySelector('[data-block-id="mapa"]'), B = blk.getBoundingClientRect();
  const svg = blk.querySelector('svg'), trk = svg.querySelector('#track'), use = svg.querySelector('g.track-transformed use');
  const M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 600; i++) { const p = trk.getPointAtLength(L*i/600); pts.push({ x: M.a*p.x + M.c*p.y + M.e, y: M.b*p.x + M.d*p.y + M.f }); }
  const meia = 15 * Math.abs(M.a);   // meia largura do escape (30 u)
  const tb = { x0:Math.min(...pts.map(p=>p.x))-meia, x1:Math.max(...pts.map(p=>p.x))+meia, y0:Math.min(...pts.map(p=>p.y))-meia, y1:Math.max(...pts.map(p=>p.y))+meia };
  // peças: todo elemento visível do bloco que tem texto próprio, canvas ou svg fora do traçado
  const pecas = [];
  for (const e of blk.querySelectorAll('*')) {
    if (svg.contains(e) && e !== svg) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const temTexto = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!(temTexto || e.tagName === 'CANVAS' || (e.tagName === 'svg' && e !== svg))) continue;
    const R = e.getBoundingClientRect(); if (R.width < 2 || R.height < 2) continue;
    const dentro = pts.filter(p => p.x > R.left - meia && p.x < R.right + meia && p.y > R.top - meia && p.y < R.bottom + meia).length;
    pecas.push({ tag:e.tagName, cls:(e.className && e.className.baseVal != null ? e.className.baseVal : e.className || '').toString().slice(0,40), txt:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,50),
      x:Math.round(R.left-B.left), y:Math.round(R.top-B.top), w:Math.round(R.width), h:Math.round(R.height), fonte: cs.fontSize, cor: cs.color, pontosDaPistaEmbaixo: dentro,
      foraDoBloco: R.right > B.right+1 || R.bottom > B.bottom+1 || R.left < B.left-1 || R.top < B.top-1 });
  }
  return { bloco:{ x:Math.round(B.left), y:Math.round(B.top), w:Math.round(B.width), h:Math.round(B.height) },
    pista:{ x0:Math.round(tb.x0-B.left), x1:Math.round(tb.x1-B.left), y0:Math.round(tb.y0-B.top), y1:Math.round(tb.y1-B.top) },
    areaPistaPct: Math.round((tb.x1-tb.x0)*(tb.y1-tb.y0)/(B.width*B.height)*100), pecas };
});
console.log(JSON.stringify(r, null, 0).replace(/\{"tag"/g, '\n{"tag"'));
await pg.screenshot({ path:`${dir}/mapa-hoje.png`, clip:{ x:r.bloco.x, y:r.bloco.y, width:r.bloco.w, height:r.bloco.h } });
await nav.close();
