import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&canal=cockpit-bubi-replay-mac');
await pg.waitForTimeout(6000);
const r = await pg.evaluate(() => [...document.querySelectorAll('[data-block-id]')].filter(b => getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden').map(b => { const R = b.getBoundingClientRect(); return [b.dataset.blockId, Math.round(R.left), Math.round(R.top), Math.round(R.width), Math.round(R.height)]; }));
console.log(JSON.stringify(r));
const z = await pg.evaluate(() => { const e = document.querySelector('.tv-consist'); return e ? getComputedStyle(e).fontSize + ' ' + JSON.stringify(e.getBoundingClientRect()) : 'sem'; }); console.log(z);
await pg.screenshot({ path: process.argv[2] + '/tv-inteira.png' }); await nav.close();
