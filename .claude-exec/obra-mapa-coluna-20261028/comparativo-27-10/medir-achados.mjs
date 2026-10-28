// Mede, na página de comparação, os pontos que o revisor pediu: letras de hoje, cobertura por grupo, selo "ao vivo" e C com uma linha de contagens.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=hoje'); await pg.waitForTimeout(30000);
const medir = (extraCss) => pg.frames().find(x => x.url().includes('vista-piloto')).evaluate((extraCss) => {
  let st = document.getElementById('med-extra'); if (!st) { st = document.createElement('style'); st.id = 'med-extra'; document.head.appendChild(st); } st.textContent = extraCss || '';
  const blk = document.querySelector('[data-block-id="mapa"]'), B = blk.getBoundingClientRect(), svg = blk.querySelector(':scope > svg');
  const use = svg.querySelector('g.track-transformed use'), trk = svg.querySelector('#track'), M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 600; i++) { const p = trk.getPointAtLength(L*i/600); pts.push({ x: M.a*p.x + M.c*p.y + M.e, y: M.b*p.x + M.d*p.y + M.f }); }
  const meia = 15 * Math.hypot(M.a, M.b);
  const cx = [Math.min(...pts.map(p=>p.x))-meia, Math.max(...pts.map(p=>p.x))+meia], cy = [Math.min(...pts.map(p=>p.y))-meia, Math.max(...pts.map(p=>p.y))+meia];
  const visivel = e => { let el = e; while (el && el !== blk) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; el = el.parentElement; } return true; };
  const cobre = R => { const s = new Set(); pts.forEach((p, i) => { if (p.x > R.left - meia && p.x < R.right + meia && p.y > R.top - meia && p.y < R.bottom + meia) s.add(i); }); return s; };
  const textos = [], grupos = { consist: new Set(), g: new Set(), legenda: new Set() };
  for (const e of blk.querySelectorAll('*')) {
    if (svg.contains(e) || !visivel(e)) continue;
    const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!(txt || e.tagName === 'svg')) continue;
    const R = e.getBoundingClientRect(); if (R.width < 2) continue; const c = cobre(R);
    if (e.closest('.tv-consist')) c.forEach(i => grupos.consist.add(i));
    if (e.closest('.tv-g')) c.forEach(i => grupos.g.add(i));
    if (e.closest('.tv-legenda')) c.forEach(i => grupos.legenda.add(i));
    if (txt) textos.push({ cls: (e.className && e.className.baseVal == null ? e.className : '') || e.tagName, px: +(parseFloat(getComputedStyle(e).fontSize) * 1.5).toFixed(1), emCima: c.size > 0, t: e.textContent.trim().slice(0, 24) });
  }
  // selo "ao vivo": caixa do ::after (resolvida pelo navegador) × peças da faixa de tempos
  const k = B.width / blk.offsetWidth, a = getComputedStyle(blk, '::after');
  let selo = null;
  if (a.content && a.content !== 'none') { const w = parseFloat(a.width), h = parseFloat(a.height), pl = parseFloat(a.paddingLeft), pr = parseFloat(a.paddingRight), pt = parseFloat(a.paddingTop), pb = parseFloat(a.paddingBottom);
    const top = parseFloat(a.top), right = parseFloat(a.right), left = a.left !== 'auto' ? parseFloat(a.left) : null;
    const W = (w + pl + pr) * k, H = (h + pt + pb) * k, x0 = left != null && !isNaN(left) && a.right === 'auto' ? B.left + left * k : B.right - right * k - W;
    selo = { caixa: [Math.round(x0 - B.left), Math.round(top * k), Math.round(W), Math.round(H)], cobre: [] };
    for (const e of blk.querySelectorAll('.mo-lap .lk, .mo-lap .lv, .tv-setores *')) { if (!visivel(e)) continue; const R = e.getBoundingClientRect();
      const ix = Math.max(0, Math.min(R.right, x0 + W) - Math.max(R.left, x0)), iy = Math.max(0, Math.min(R.bottom, B.top + top * k + H) - Math.max(R.top, B.top + top * k));
      if (ix * iy > 0) selo.cobre.push({ peca: (e.closest('.mo-lap') ? e.closest('.mo-lap').className : e.className) + ' ' + e.className, txt: e.textContent.trim().slice(0, 12), fracDaPeca: +(ix * iy / (R.width * R.height)).toFixed(2) }); } }
  const de9 = textos.filter(t => t.px <= 9.05);
  return { pista: [Math.round(cx[1]-cx[0]), Math.round(cy[1]-cy[0])], area: Math.round((cx[1]-cx[0])*(cy[1]-cy[0])),
    textos: textos.length, de9: de9.length, de9EmCima: de9.filter(t => t.emCima).length,
    letras: Object.entries(textos.reduce((o, t) => (o[t.px] = (o[t.px] || 0) + 1, o), {})).sort((a,b) => a[0]-b[0]),
    tempos: textos.filter(t => /mo-lap|lv|lk/.test(t.cls) || /^(lv|lk)$/.test(t.cls)).map(t => t.cls + ' ' + t.px).slice(0, 12),
    setores: textos.filter(t => /^(k|v)$/.test(t.cls)).map(t => t.cls + ' ' + t.px + ' ' + t.t).slice(0, 8),
    grupos: Object.fromEntries(Object.entries(grupos).map(([n, s]) => [n, s.size])), selo };
}, extraCss);
for (const m of ['hoje', 'faixas', 'grande']) { await pg.click(`#modo [data-mapa="${m}"]`); await pg.waitForTimeout(1500); console.log(m, JSON.stringify(await medir(''))); }
// C com uma linha só de contagens embaixo (a altura de uma linha da faixa da A: 13 px de linha + 3 de margem + 1 de borda = 17 no quadro)
await pg.click('#modo [data-mapa="grande"]'); await pg.waitForTimeout(800);
const comLinha = await medir('.b-map.est > svg{height:305px!important}');
console.log('grande+linha', JSON.stringify({ pista: comLinha.pista, area: comLinha.area }));
console.log('erros', erros.length, erros.slice(0, 3)); await nav.close();
