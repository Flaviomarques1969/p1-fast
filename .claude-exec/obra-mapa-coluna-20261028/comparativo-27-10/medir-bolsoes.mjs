import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const [W, H, dir] = [576, 464, process.argv[2]];
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1');
await pg.waitForTimeout(3000);
const r = await pg.evaluate(([W, H]) => {
  const blk = document.querySelector('[data-block-id="mapa"]');
  const st = document.createElement('style'); st.textContent = `.b-map{left:86px!important;top:572px!important;width:${W}px!important;height:${H}px!important}.b-map .map-overlay{display:none!important}`; document.head.appendChild(st);
  const B = blk.getBoundingClientRect(), use = blk.querySelector('g.track-transformed use'), trk = blk.querySelector('#track');
  const M = use.getScreenCTM(), L = trk.getTotalLength(), pts = [];
  for (let i = 0; i < 1200; i++) { const p = trk.getPointAtLength(L*i/1200); pts.push({ x: M.a*p.x + M.c*p.y + M.e - B.left, y: M.b*p.x + M.d*p.y + M.f - B.top }); }
  const meia = 15 * Math.hypot(M.a, M.b) + 6;   // meia largura do escape + 6 px de respiro
  const livre = (x0,y0,x1,y1) => !pts.some(p => p.x > x0-meia && p.x < x1+meia && p.y > y0-meia && p.y < y1+meia);
  const caixa = { x0:Math.round(Math.min(...pts.map(p=>p.x))-meia), x1:Math.round(Math.max(...pts.map(p=>p.x))+meia), y0:Math.round(Math.min(...pts.map(p=>p.y))-meia), y1:Math.round(Math.max(...pts.map(p=>p.y))+meia) };
  // maior retângulo livre ancorado em cada canto, para algumas alturas
  const res = {};
  for (const [nome, cx, cy] of [['sup-esq',0,0],['sup-dir',1,0],['inf-esq',0,1],['inf-dir',1,1]]) {
    res[nome] = [];
    for (const h of [40, 60, 90, 120, 160, 200]) { let w = 0;
      for (let t = 10; t <= W; t += 2) { const x0 = cx ? W - t : 0, x1 = cx ? W : t, y0 = cy ? H - h : 0, y1 = cy ? H : h; if (livre(x0,y0,x1,y1)) w = t; else break; }
      res[nome].push([w, h]); }
  }
  return { escala: +Math.hypot(M.a, M.b).toFixed(3), caixaPista: caixa, cantos: res };
}, [W, H]);
console.log(JSON.stringify(r));
const b = await pg.locator('[data-block-id="mapa"]').boundingBox(); await pg.screenshot({ path:`${dir}/pista-cheia.png`, clip:b }); await nav.close();
