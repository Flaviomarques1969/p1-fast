import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const [dir] = process.argv.slice(2);
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10');
const marcos = [200, 420, 600];
let t = 0;
for (const m of marcos) { await pg.waitForTimeout((m - t) * 1000); t = m;
  const r = await pg.evaluate(() => { const E = window.__estado(); const box = document.querySelector('.qc').getBoundingClientRect();
    // corte: algum texto passa da sua célula ou o corpo passa da caixa?
    const cortes = [...document.querySelectorAll('.qc-l, .qc-nome b, .qc-cab > div')].filter(x => x.scrollWidth > x.clientWidth + 1).length;
    const corpo = document.querySelector('.qc-corpo'), ultLin = corpo.lastElementChild.getBoundingClientRect();
    return { voltas:E.voltas.map(v=>[v.n,+v.tempo.toFixed(1)]), atual:E.volta&&E.volta.n, melhor:E.melhor&&E.melhor.n, cortes,
      caixaAlt: Math.round(box.height), ultimaLinhaFundo: Math.round(ultLin.bottom - box.top), linhas: corpo.children.length,
      menorFonte: Math.min(...[...document.querySelectorAll('.qc *')].filter(x=>x.childNodes.length && [...x.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(x=>parseFloat(getComputedStyle(x).fontSize))) }; });
  console.log(`${m}s`, JSON.stringify(r));
  await pg.screenshot({ path: `${dir}/q-${m}.png` });
  await pg.locator('#tabCx').screenshot({ path: `${dir}/q-${m}-quadro.png` });
}
console.log((await pg.$$eval('.qc-lin', ls => ls.map(l => l.innerText.replace(/\s+/g,' ')))).join('\n'));
console.log('erros', erros.length, erros.slice(0,3)); await nav.close();
