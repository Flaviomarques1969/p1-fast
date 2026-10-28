// quais blocos aparecem na TV (modo TV, gravação 21/06) cobertos com "não vem do RaceBox" e onde estão
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(30000);
console.log(JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-block-id]')].filter(b => { const cs = getComputedStyle(b), R = b.getBoundingClientRect();
  return cs.display !== 'none' && cs.visibility !== 'hidden' && R.width > 2; }).map(b => { const R = b.getBoundingClientRect();
  return { id: b.dataset.blockId, coberto: b.classList.contains('tv-nao-racebox'), aviso: b.classList.contains('tv-nao-racebox') ? getComputedStyle(b, '::after').content : '', caixa: [Math.round(R.left), Math.round(R.top), Math.round(R.width), Math.round(R.height)] }; }))));
await nav.close();
