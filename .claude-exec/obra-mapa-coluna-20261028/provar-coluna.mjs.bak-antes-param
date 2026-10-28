// Prova da coluna "Dados da volta" na TV real (modo TV, tocando a gravação de 21/06 pela própria TV):
// pista sem texto em cima, coluna sem nada cortado/vazando, nenhum bloco encavalando outro, consistência no stint.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const dir = process.argv[2];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=10'); await pg.waitForTimeout(40000);
const r = await pg.evaluate(() => {
  const blk = document.querySelector('[data-block-id="mapa"]'), col = document.querySelector('[data-tv-mapa-dados]'); if (!col) return { erro: 'sem coluna' };
  const B = blk.getBoundingClientRect(), C = col.getBoundingClientRect(), svg = blk.querySelector(':scope > svg');
  const use = svg.querySelector('g.track-transformed use'), trk = svg.querySelector('#track'), M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 600; i++) { const p = trk.getPointAtLength(L*i/600); pts.push({ x: M.a*p.x + M.c*p.y + M.e, y: M.b*p.x + M.d*p.y + M.f }); }
  const meia = 15 * Math.hypot(M.a, M.b);
  const cx = [Math.min(...pts.map(p=>p.x))-meia, Math.max(...pts.map(p=>p.x))+meia], cy = [Math.min(...pts.map(p=>p.y))-meia, Math.max(...pts.map(p=>p.y))+meia];
  const visivel = e => { let el = e; while (el && el !== document.body) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; el = el.parentElement; } return true; };
  const cob = new Set();
  for (const e of blk.querySelectorAll('*')) { if (svg.contains(e) || !visivel(e)) continue;
    const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!(txt || e.tagName === 'svg')) continue;
    const R = e.getBoundingClientRect(); if (R.width < 2) continue;
    pts.forEach((p, i) => { if (p.x > R.left - meia && p.x < R.right + meia && p.y > R.top - meia && p.y < R.bottom + meia) cob.add(i); }); }
  // coluna: cada peça visível dentro da coluna e sem texto cortado
  const cortes = [], fora = [];
  for (const e of col.querySelectorAll('*')) { if (!visivel(e)) continue; const R = e.getBoundingClientRect(); if (R.width < 1) continue;
    if (R.right > C.right + 0.5 || R.bottom > C.bottom + 0.5 || R.left < C.left - 0.5) fora.push((e.className.baseVal ?? e.className) + ' ' + e.textContent.trim().slice(0, 20));
    if (getComputedStyle(e).overflow === 'hidden' && e.scrollWidth > e.clientWidth + 1) cortes.push((e.className.baseVal ?? e.className) + ' ' + e.textContent.trim().slice(0, 30)); }
  const letras = [...col.querySelectorAll('*')].filter(e => visivel(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(e => parseFloat(getComputedStyle(e).fontSize) * (C.width / col.offsetWidth));
  // blocos encavalados (modo TV: só os visíveis)
  const blocos = [...document.querySelectorAll('[data-block-id]')].filter(b => visivel(b)).map(b => [b.dataset.blockId, b.getBoundingClientRect()]).filter(x => x[1].width > 2);
  const enc = [];
  for (let i = 0; i < blocos.length; i++) for (let j = i + 1; j < blocos.length; j++) { const a = blocos[i][1], b = blocos[j][1];
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 2 && iy > 2) enc.push(blocos[i][0] + '×' + blocos[j][0] + ' ' + Math.round(ix) + 'x' + Math.round(iy)); }
  const stint = document.querySelector('[data-block-id="stint"]');
  return { mapa: [Math.round(B.width), Math.round(B.height)], pista: [Math.round(cx[1]-cx[0]), Math.round(cy[1]-cy[0])], pontosCobertos: cob.size,
    coluna: [Math.round(C.left), Math.round(C.top), Math.round(C.width), Math.round(C.height)], colunaAtiva: col.classList.contains('tv-on'),
    alturaUsada: Math.round(col.scrollHeight * C.height / col.offsetHeight), cortes, fora, menorLetra: +Math.min(...letras).toFixed(1),
    encavalados: enc, stintTemConsistencia: /consist/i.test(stint ? stint.innerText : ''), texto: col.innerText.replace(/\s+/g, ' ').slice(0, 400) };
});
console.log(JSON.stringify(r, null, 1));
await pg.screenshot({ path: `${dir}/coluna-tv.png`, clip: { x: 0, y: 540, width: 1300, height: 540 } });
console.log('erros da página', erros.length, erros.slice(0, 3)); await nav.close();
