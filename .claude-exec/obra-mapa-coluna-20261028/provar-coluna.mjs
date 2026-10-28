// Prova da coluna "Dados da volta" na TV real (modo TV, tocando a gravação de 21/06 pela própria TV):
// pista sem texto em cima, coluna sem nada cortado/vazando, nenhum bloco encavalando outro, consistência no stint.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const dir = process.argv[2];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06' + (process.argv[3] || '&speed=10')); await pg.waitForTimeout(+(process.argv[4] || 40000));
const pior = process.argv.includes('--pior');   // pior caso: todas as contagens + picos do G + legenda de 4 cores, escrito no mesmo instante da medida
// controle da régua: --controle-antigo devolve os rótulos do G para dentro do desenho (como era antes de 28/10 ~12h); a régua TEM de acusar letra pequena
if (process.argv.includes('--controle-antigo')) await pg.addStyleTag({ content: '.b-mapa-dados .tv-g svg text{display:inline!important}.b-mapa-dados .tv-g::before,.b-mapa-dados .tv-g::after{content:none!important}' });
const r = await pg.evaluate((pior) => {
  if (pior) { for (let i = 1; i < 100000; i++) clearInterval(i);   // só nesta página de teste: o quadro (250 ms) não desenha por cima da injeção
    const c = document.querySelector('[data-tv-cont]'), g = document.querySelector('[data-tv-g-txt]'), t = document.querySelector('.b-mapa-dados .tv-trecho');
    const ln = (n, a, b) => '<div class="ln"><span>' + n + '</span><span><b>' + a + '</b> <span class="ap">/</span> <b>' + b + '</b></span></div>';
    c.innerHTML = '<div class="ln ap"><span></span><span>nesta / última</span></div>' + ln('pancadas', 12, 14) + '<div class="ln"><span>repetidas</span><span><b>3</b> lugares</span></div>' + ln('trocas prov.', 18, 19) + ln('traseira prov.', 2, 1) + '<div class="ln ap"><span>giro a conferir</span><span></span></div>';
    g.innerHTML = 'G sem zero do box<br>freio 1,24 · acel 0,58<br>lat 1,31 · comb 1,42';
    t.innerHTML = '<div style="overflow:hidden;text-overflow:ellipsis">trecho <b>CURVA DO BICO DE PATO</b> 12/15</div><div style="overflow:hidden;text-overflow:ellipsis">últ <b>10.80</b> · mel <b>10.42</b> · mín <b>98</b></div><div style="overflow:hidden;text-overflow:ellipsis">perdeu <b>CURVA DA JUNÇÃO</b> <span class="perdeu">+1,38</span></div>';
    [c, g.parentElement, t].forEach(e => e.style.display = ''); }
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
    if (getComputedStyle(e).overflow === 'hidden' && e.scrollWidth > e.clientWidth + 1) cortes.push((e.className.baseVal ?? e.className) + ' ' + e.textContent.trim().slice(0, 30));
    if (e.parentElement === col && e.scrollHeight > e.clientHeight + 1) cortes.push('VERTICAL ' + (e.className.baseVal ?? e.className) + ' ' + e.scrollHeight + '>' + e.clientHeight); }
  if (col.scrollHeight > col.clientHeight + 1) cortes.push('COLUNA ' + col.scrollHeight + '>' + col.clientHeight);
  // tamanho REAL na tela: texto de desenho (SVG) usa a escala do próprio desenho (antes a régua usava a da coluna e via 9 px onde havia 3,9)
  const kCol = C.width / col.offsetWidth, nome = e => (e.className.baseVal ?? e.className) + ' «' + e.textContent.trim().slice(0, 12) + '»';
  const tam = e => e instanceof SVGElement ? parseFloat(getComputedStyle(e).fontSize) * Math.hypot(e.getScreenCTM().a, e.getScreenCTM().b)
    : parseFloat(getComputedStyle(e).fontSize) * kCol;
  const comTexto = [...col.querySelectorAll('*')].filter(e => visivel(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const letras = comTexto.map(tam), pequenas = comTexto.filter(e => tam(e) < 9.7).map(e => nome(e) + ' ' + tam(e).toFixed(1) + 'px');
  // rótulos escritos por ::before/::after (o G da coluna): tamanho e caixa na tela, dentro da coluna e sem cobrir o desenho nem as contagens
  const ctx = document.createElement('canvas').getContext('2d'), pseudos = [];
  for (const e of col.querySelectorAll('*')) { if (!visivel(e)) continue; for (const ps of ['::before', '::after']) { const cs = getComputedStyle(e, ps);
    if (!cs.content || cs.content === 'none' || cs.content === 'normal' || cs.display === 'none') continue;
    const txt = cs.content.replace(/^"|"$/g, ''), R = e.getBoundingClientRect(), fs = parseFloat(cs.fontSize);
    ctx.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily; const w = (ctx.measureText(txt).width + txt.length * parseFloat(cs.letterSpacing || 0)) * kCol;
    const x = R.left + parseFloat(cs.left) * kCol, y = R.top + parseFloat(cs.top) * kCol, h = fs * kCol;
    pseudos.push({ txt, px: +(fs * kCol).toFixed(2), caixa: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)] });
    letras.push(fs * kCol); if (fs * kCol < 9.7) pequenas.push(txt + ' ' + (fs * kCol).toFixed(1) + 'px');
    if (x + w > C.right + 0.5 || y + h > C.bottom + 0.5) fora.push('PSEUDO ' + txt);
    for (const o of [e.querySelector(':scope > svg'), col.querySelector('.tv-cont')]) { if (!o || !visivel(o)) continue; const Q = o.getBoundingClientRect();
      if (Math.min(x + w, Q.right) - Math.max(x, Q.left) > 0.5 && Math.min(y + h, Q.bottom) - Math.max(y, Q.top) > 0.5) cortes.push('PSEUDO ' + txt + ' cobre ' + nome(o)); } } }
  // blocos encavalados (modo TV: só os visíveis)
  const blocos = [...document.querySelectorAll('[data-block-id]')].filter(b => visivel(b)).map(b => [b.dataset.blockId, b.getBoundingClientRect()]).filter(x => x[1].width > 2);
  const enc = [];
  for (let i = 0; i < blocos.length; i++) for (let j = i + 1; j < blocos.length; j++) { const a = blocos[i][1], b = blocos[j][1];
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 2 && iy > 2) enc.push(blocos[i][0] + '×' + blocos[j][0] + ' ' + Math.round(ix) + 'x' + Math.round(iy)); }
  const stint = document.querySelector('[data-block-id="stint"]');
  return { mapa: [Math.round(B.width), Math.round(B.height)], pista: [Math.round(cx[1]-cx[0]), Math.round(cy[1]-cy[0])], pontosCobertos: cob.size,
    coluna: [Math.round(C.left), Math.round(C.top), Math.round(C.width), Math.round(C.height)], colunaAtiva: col.classList.contains('tv-on'),
    alturaUsada: Math.round(col.scrollHeight * C.height / col.offsetHeight), cortes, fora, menorLetra: +Math.min(...letras).toFixed(1), letrasPequenas: pequenas, pseudos,
    encavalados: enc, stintTemConsistencia: /consist/i.test(stint ? stint.innerText : ''), texto: col.innerText.replace(/\s+/g, ' ').slice(0, 400) };
}, pior);
console.log(JSON.stringify(r, null, 1));
await pg.screenshot({ path: `${dir}/coluna-tv${pior ? '-pior' : ''}.png`, clip: { x: 0, y: 540, width: 1300, height: 540 } });
console.log('erros da página', erros.length, erros.slice(0, 3)); await nav.close();
