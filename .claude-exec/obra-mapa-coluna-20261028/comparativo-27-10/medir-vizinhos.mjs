// Só leitura: posição de cada bloco da TV (1920×1080), para planejar a coluna à direita do mapa.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html'); await pg.waitForTimeout(4000);
const r = await pg.evaluate(() => [...document.querySelectorAll('[data-block-id]')].map(b => { const R = b.getBoundingClientRect(), cs = getComputedStyle(b);
  return cs.display === 'none' || R.width < 2 ? null : [b.dataset.blockId, Math.round(R.left), Math.round(R.top), Math.round(R.right), Math.round(R.bottom)]; }).filter(Boolean));
for (const x of r.sort((a, b) => a[1] - b[1] || a[2] - b[2])) console.log(x.join('\t'));
await pg.screenshot({ path: process.argv[2] + '/tv-inteira-1028.png' }); await nav.close();
