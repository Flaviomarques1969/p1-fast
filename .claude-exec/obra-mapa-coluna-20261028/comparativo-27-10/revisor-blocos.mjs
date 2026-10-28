// Revisor (só leitura): onde fica cada bloco na TV de verdade (sem a página de comparação esconder nada) e se o mapa 576×464 cabe sem invadir vizinho.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?canal=cockpit-bubi-replay-mac'); await pg.waitForTimeout(8000);
const r = await pg.evaluate(() => { const out = [];
  for (const b of document.querySelectorAll('[data-block-id]')) { const R = b.getBoundingClientRect(), cs = getComputedStyle(b); if (cs.display === 'none' || R.width < 2) continue;
    out.push([b.dataset.blockId, Math.round(R.left), Math.round(R.top), Math.round(R.width), Math.round(R.height), cs.visibility]); }
  return out; });
const m = r.find(x => x[0] === 'mapa'); const P = { l: m[1], t: m[2], r: m[1] + 576, b: m[2] + 464 };
for (const x of r) { const ix = Math.max(0, Math.min(P.r, x[1] + x[3]) - Math.max(P.l, x[1])), iy = Math.max(0, Math.min(P.b, x[2] + x[4]) - Math.max(P.t, x[2]));
  console.log(x.join(' '), x[0] !== 'mapa' && ix * iy > 0 ? `<< INVADE ${ix}x${iy}` : ''); }
console.log('mapa proposto', JSON.stringify(P)); await nav.close();
