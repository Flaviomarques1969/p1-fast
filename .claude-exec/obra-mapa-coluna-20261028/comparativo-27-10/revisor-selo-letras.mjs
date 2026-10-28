// Revisor (só leitura): selo ::after × pontos da pista; tamanho REAL desenhado dos textos SVG do círculo G; peças vazando.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=hoje'); await pg.waitForTimeout(25000);
const medir = (aoVivo) => pg.frames().find(x => x.url().includes('vista-piloto')).evaluate((aoVivo) => {
  let st = document.getElementById('rev-extra'); if (!st) { st = document.createElement('style'); st.id = 'rev-extra'; document.head.appendChild(st); }
  st.textContent = aoVivo ? '[data-block-id="mapa"].cb-vivo::after{content:"ao vivo"!important}' : '';
  const blk = document.querySelector('[data-block-id="mapa"]'), B = blk.getBoundingClientRect(), svg = blk.querySelector(':scope > svg');
  const use = svg.querySelector('g.track-transformed use'), trk = svg.querySelector('#track'), M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 600; i++) { const p = trk.getPointAtLength(L*i/600); pts.push({ x: M.a*p.x + M.c*p.y + M.e, y: M.b*p.x + M.d*p.y + M.f }); }
  const meia = 15 * Math.hypot(M.a, M.b);
  const k = B.width / blk.offsetWidth, a = getComputedStyle(blk, '::after');
  let selo = null;
  if (a.content && a.content !== 'none') { const w = parseFloat(a.width), h = parseFloat(a.height), pl = parseFloat(a.paddingLeft), pr = parseFloat(a.paddingRight), pt = parseFloat(a.paddingTop), pb = parseFloat(a.paddingBottom);
    const top = parseFloat(a.top), right = parseFloat(a.right), left = a.left !== 'auto' ? parseFloat(a.left) : null;
    const W = (w + pl + pr) * k, H = (h + pt + pb) * k, x0 = left != null && !isNaN(left) && a.right === 'auto' ? B.left + left * k : B.right - right * k - W, y0 = B.top + top*k;
    let cob = 0, cob0 = 0; pts.forEach(p => { if (p.x > x0 - meia && p.x < x0 + W + meia && p.y > y0 - meia && p.y < y0 + H + meia) cob++; if (p.x > x0 && p.x < x0 + W && p.y > y0 && p.y < y0 + H) cob0++; });
    const cobre = [];
    for (const e of blk.querySelectorAll('.mo-lap .lk, .mo-lap .lv')) { const cs = getComputedStyle(e.closest('.mo-lap')); if (cs.display==='none') continue; const R = e.getBoundingClientRect();
      const ix = Math.max(0, Math.min(R.right, x0 + W) - Math.max(R.left, x0)), iy = Math.max(0, Math.min(R.bottom, y0 + H) - Math.max(R.top, y0));
      if (ix * iy > 0) cobre.push(e.closest('.mo-lap').className + '/' + e.className + ' ' + (ix*iy/(R.width*R.height)).toFixed(2)); }
    selo = { texto: a.content, caixa:[Math.round(x0-B.left), Math.round(y0-B.top), Math.round(W), Math.round(H)], pontosDaPistaComFolga: cob, pontosDaPistaSemFolga: cob0, cobre };
  }
  const gtxt = [...blk.querySelectorAll('.tv-g svg text')].map(t => { const R = t.getBoundingClientRect(); return t.textContent + ' alturaCaixa ' + R.height.toFixed(1) + ' fontePx ' + (parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a).toFixed(2); });
  const gsvg = blk.querySelector('.tv-g svg'); const gR = gsvg && getComputedStyle(blk.querySelector('.tv-g')).display !== 'none' ? gsvg.getBoundingClientRect() : null;
  const fora = [];
  for (const e of blk.querySelectorAll('*')) { if (svg.contains(e)) continue; let el=e, oc=false; while (el && el!==blk){ const c=getComputedStyle(el); if (c.display==='none'||c.visibility==='hidden'||+c.opacity===0){oc=true;break;} el=el.parentElement;} if (oc) continue;
    const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!(txt || e.tagName === 'svg')) continue; const R = e.getBoundingClientRect(); if (R.width < 2) continue;
    if (R.right > B.right + 1 || R.left < B.left - 1 || R.bottom > B.bottom + 1) fora.push((e.className.baseVal ?? e.className) + ' "' + e.textContent.trim().slice(0,20) + '" dir+' + Math.round(R.right-B.right)); }
  return { selo, circuloG: gR ? [Math.round(gR.width), Math.round(gR.height)] : 'oculto', gtxt, fora };
}, aoVivo);
for (const m of ['hoje', 'faixas', 'grande']) { await pg.click(`#modo [data-mapa="${m}"]`); await pg.waitForTimeout(1500);
  console.log(m, 'GRAVAÇÃO', JSON.stringify(await medir(false)));
  console.log(m, 'AO VIVO ', JSON.stringify(await medir(true))); }
await nav.close();
