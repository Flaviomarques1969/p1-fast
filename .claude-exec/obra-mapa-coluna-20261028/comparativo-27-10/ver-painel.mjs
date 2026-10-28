import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1600, height:1000 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e)));
await pg.goto('file:///Users/imac/Projetos/P1%20Fast/.claude-perguntas/pendentes/p1fast-mapa-tv-2045.html'); await pg.waitForTimeout(1500);
const t = await pg.evaluate(() => document.body.innerText);
const tit = ['Qual arrumação','Consistência e','Contadores de pancadas','Círculo de força G','Linha do trecho','Tempo “melhor”','Depois de escolher'];
console.log('títulos visíveis', tit.filter(x => t.includes(x)).length, '/ 7 | erros', erros.length, erros.slice(0,2), '| título da aba', await pg.title());
await nav.close();
