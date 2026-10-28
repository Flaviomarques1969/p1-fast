import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1600, height:1000 } });
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('file://' + process.argv[2]); await pg.waitForTimeout(1200);
const r = await pg.evaluate(() => { const vis = e => e.offsetParent !== null; const cards = [...document.querySelectorAll('[data-qid], .card, .pergunta')];
  return { titulo: document.title, h1: (document.querySelector('h1')||{}).textContent, cartoes: cards.length, visiveis: cards.filter(vis).length, texto: document.body.innerText.includes('Legenda das cores') }; });
// escolher A na 1 e conferir que as perguntas que dependem de C somem
console.log(JSON.stringify(r), 'erros', erros.length, erros.slice(0,2)); await nav.close();
