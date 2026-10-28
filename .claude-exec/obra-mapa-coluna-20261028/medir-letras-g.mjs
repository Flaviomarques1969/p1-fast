// tamanho REAL na tela dos rótulos do círculo G (SVG): altura da caixa e escala do desenho; controle = um texto HTML de 9,76 px
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(60000);
console.log(JSON.stringify(await pg.evaluate(() => { const col = document.querySelector('[data-tv-mapa-dados]');
  const g = [...col.querySelectorAll('text')].map(t => { const M = t.getScreenCTM(), fs = parseFloat(getComputedStyle(t).fontSize);
    return { txt: t.textContent, fontSvg: fs, escalaSvg: +Math.hypot(M.a, M.b).toFixed(3), naTela: +(fs * Math.hypot(M.a, M.b)).toFixed(2), alturaCaixa: +t.getBoundingClientRect().height.toFixed(2) }; });
  const ctl = [...col.querySelectorAll('span')].find(s => s.textContent.trim() === 'pancadas'), R = ctl.getBoundingClientRect();
  return { g, controle: { txt: 'pancadas', alturaCaixa: +R.height.toFixed(2) } }; }), null, 1)); await nav.close();
