// Só leitura: blocos [data-block-id] visíveis que se sobrepõem, na página dada (argv[2] = caminho no servidor 5201)
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201' + process.argv[2] + '?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(8000);
console.log(process.argv[2], JSON.stringify(await pg.evaluate(() => { const vis = e => { for (let el = e; el && el !== document.body; el = el.parentElement) { const c = getComputedStyle(el); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; } return true; };
  const b = [...document.querySelectorAll('[data-block-id]')].filter(vis).map(x => [x.dataset.blockId, x.getBoundingClientRect()]).filter(x => x[1].width > 2), out = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const a = b[i][1], c = b[j][1], ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ix > 2 && iy > 2) out.push(b[i][0] + '×' + b[j][0]); }
  return out; }))); await nav.close();
