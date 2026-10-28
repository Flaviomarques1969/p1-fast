import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const [dir, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10'); await pg.waitForTimeout(4000);
const f = pg.frames().find(x => x.url().includes('vista-piloto'));
const r = await f.evaluate(([W, H]) => {
  const blk = document.querySelector('[data-block-id="mapa"]'), antes = blk.getBoundingClientRect();
  const st = document.createElement('style'); st.textContent = `.b-map{width:${W}px!important;height:${H}px!important}`; document.head.appendChild(st);
  const B = blk.getBoundingClientRect(), use = blk.querySelector('g.track-transformed use'), trk = blk.querySelector('#track');
  const M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 1200; i++) { const p = trk.getPointAtLength(L*i/1200); pts.push({ x: M.a*p.x + M.c*p.y + M.e - B.left, y: M.b*p.x + M.d*p.y + M.f - B.top }); }
  const k = Math.hypot(M.a, M.b), meia = 15 * k + 6;
  const livre = (x0,y0,x1,y1) => !pts.some(p => p.x > x0-meia && p.x < x1+meia && p.y > y0-meia && p.y < y1+meia);
  const cx = [Math.min(...pts.map(p=>p.x))-15*k, Math.max(...pts.map(p=>p.x))+15*k], cy = [Math.min(...pts.map(p=>p.y))-15*k, Math.max(...pts.map(p=>p.y))+15*k];
  const cantos = {};
  for (const [nome, ax, ay] of [['sup-esq',0,0],['sup-dir',1,0],['inf-esq',0,1],['inf-dir',1,1]]) { cantos[nome] = [];
    for (const h of [40, 60, 90, 120, 160]) { let w = 0; for (let t = 10; t <= B.width; t += 2) { const x0 = ax ? B.width - t : 0, x1 = ax ? B.width : t, y0 = ay ? B.height - h : 0, y1 = ay ? B.height : h; if (livre(x0,y0,x1,y1)) w = t; else break; } cantos[nome].push([w, h]); } }
  return { antes:[Math.round(antes.width), Math.round(antes.height)], bloco:[Math.round(B.left), Math.round(B.top), Math.round(B.width), Math.round(B.height)], escala:+k.toFixed(3),
    pista:{ x:[Math.round(cx[0]), Math.round(cx[1])], y:[Math.round(cy[0]), Math.round(cy[1])] }, cantos };
}, [W, H]);
console.log(JSON.stringify(r));
await pg.screenshot({ path:`${dir}/pista-${W}x${H}.png`, clip:{ x:r.bloco[0], y:r.bloco[1], width:r.bloco[2], height:r.bloco[3] } }); await nav.close();
