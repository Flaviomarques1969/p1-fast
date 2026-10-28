import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const dir = process.argv[2];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=hoje'); await pg.waitForTimeout(25000);
// 1) barrinha: largura por segundo × velocidade do carro (deve andar junto)
const am = [];
for (let i = 0; i < 600; i++) { await pg.waitForTimeout(100);
  const r = await pg.evaluate(() => { const l = document.querySelector('.qc-lin.qc-agora .qc-prog'); return l ? { n: l.parentElement.querySelector('.qc-nome b').textContent, w: l.getBoundingClientRect().width, v: window.__estado().v, t: performance.now() } : null; });
  if (r) am.push(r); }
const taxas = [];
for (let i = 3; i < am.length; i++) { const a = am[i-3], b = am[i]; if (a.n !== b.n || b.w <= a.w) continue; taxas.push([ (a.v + b.v) / 2, (b.w - a.w) / ((b.t - a.t) / 1000) ]); }
const lentas = taxas.filter(x => x[0] < 90), rapidas = taxas.filter(x => x[0] >= 110), med = a => a.length ? a.reduce((s, x) => s + x[1], 0) / a.length : null;
console.log('barrinha: amostras', taxas.length, '| abaixo de 90 km/h:', lentas.length, 'média', med(lentas)?.toFixed(0), 'px/s | acima de 110 km/h:', rapidas.length, 'média', med(rapidas)?.toFixed(0), 'px/s');
// 2) mapa: pontos da pista embaixo de texto, letra mínima, foto — nos 3 modos
for (const m of ['hoje', 'faixas', 'grande']) {
  await pg.click(`#modo [data-mapa="${m}"]`); await pg.waitForTimeout(1500);
  const f = pg.frames().find(x => x.url().includes('vista-piloto'));
  const r = await f.evaluate(() => {
    const blk = document.querySelector('[data-block-id="mapa"]'), B = blk.getBoundingClientRect(), svg = blk.querySelector(':scope > svg');
    const use = svg.querySelector('g.track-transformed use'), trk = svg.querySelector('#track'), M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
    for (let i = 0; i < 600; i++) { const p = trk.getPointAtLength(L*i/600); pts.push({ x: M.a*p.x + M.c*p.y + M.e, y: M.b*p.x + M.d*p.y + M.f }); }
    const meia = 15 * Math.hypot(M.a, M.b);
    const cx = [Math.min(...pts.map(p=>p.x))-meia, Math.max(...pts.map(p=>p.x))+meia], cy = [Math.min(...pts.map(p=>p.y))-meia, Math.max(...pts.map(p=>p.y))+meia];
    let cobertos = new Set(), menor = 99, fora = 0, pecas = 0;
    for (const e of blk.querySelectorAll('*')) {
      if (svg.contains(e)) continue; const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || e.closest('[style*="display: none"]')) continue;
      let el = e, oculto = false; while (el && el !== blk) { if (getComputedStyle(el).display === 'none') { oculto = true; break; } el = el.parentElement; } if (oculto) continue;
      const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!(txt || e.tagName === 'svg')) continue;
      const R = e.getBoundingClientRect(); if (R.width < 2) continue; pecas++;
      if (txt) menor = Math.min(menor, parseFloat(cs.fontSize) * 1.5);
      if (R.right > B.right + 1 || R.left < B.left - 1 || R.bottom > B.bottom + 1) fora++;
      pts.forEach((p, i) => { if (p.x > R.left - meia && p.x < R.right + meia && p.y > R.top - meia && p.y < R.bottom + meia) cobertos.add(i); });
    }
    const vivo = getComputedStyle(blk, '::after'); 
    return { bloco:[Math.round(B.width), Math.round(B.height)], pista:[Math.round(cx[1]-cx[0]), Math.round(cy[1]-cy[0])], pistaDentro: cx[0] >= B.left-1 && cx[1] <= B.right+1 && cy[0] >= B.top-1 && cy[1] <= B.bottom+1,
      pecas, pontosCobertos: cobertos.size, menorLetraTela: +menor.toFixed(1), pecasForaDoBloco: fora };
  });
  console.log(m, JSON.stringify(r));
  const b = await pg.evaluate(() => { const r = document.getElementById('tv').contentDocument.querySelector('[data-block-id="mapa"]').getBoundingClientRect(); const k = document.getElementById('palco').getBoundingClientRect().width / 1920; return [r.left, r.top, r.width, r.height]; });
  await pg.screenshot({ path: `${dir}/mapa-${m}.png`, clip: { x: 70, y: 560, width: 610, height: 516 } });
}
await pg.screenshot({ path: `${dir}/tela-faixas.png` });
console.log('erros', erros.length, erros.slice(0, 3)); await nav.close();
