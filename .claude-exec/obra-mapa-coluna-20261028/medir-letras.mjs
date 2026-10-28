// quais textos da coluna da TV (modo TV, fim da gravação 21/06) ficam abaixo de 9,75 px na tela
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(60000);
console.log(JSON.stringify(await pg.evaluate(() => { const col = document.querySelector('[data-tv-mapa-dados]'), C = col.getBoundingClientRect(), k = C.width / col.offsetWidth;
  const vis = e => { for (let el = e; el && el !== document.body; el = el.parentElement) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const m = {}; for (const e of col.querySelectorAll('*')) { if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const px = +(parseFloat(getComputedStyle(e).fontSize) * k).toFixed(2); (m[px] = m[px] || []).push(e.tagName + '.' + e.className + ' «' + e.textContent.trim().slice(0, 18) + '»'); }
  return { escala: k, porTamanho: m }; }), null, 1)); await nav.close();
