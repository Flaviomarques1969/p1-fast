// Só leitura: altura natural × altura desenhada de cada peça da coluna no fim da gravação de 21/06, e a menor letra (em px de tela)
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(+(process.argv[2] || 35000));
const r = await pg.evaluate(() => { const col = document.querySelector('[data-tv-mapa-dados]'), C = col.getBoundingClientRect(), k = C.height / col.offsetHeight;
  const pecas = [...col.children].filter(e => getComputedStyle(e).display !== 'none').map(e => ({ cls: e.className, desenhada: Math.round(e.getBoundingClientRect().height / k), natural: e.scrollHeight, texto: e.innerText.replace(/\s+/g,' ').slice(0,90) }));
  const letras = [...col.querySelectorAll('*')].filter(e => getComputedStyle(e).display !== 'none' && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => [e.className.baseVal ?? e.className, parseFloat(getComputedStyle(e).fontSize), e.textContent.trim().slice(0,20)]).sort((a,b)=>a[1]-b[1]).slice(0,6);
  return { colunaQuadro: [col.offsetWidth, col.offsetHeight], escala: k, pecas, menoresLetras: letras, trechoHTML: (col.querySelector('.tv-trecho')||{}).innerHTML }; });
console.log(JSON.stringify(r, null, 1)); await nav.close();
