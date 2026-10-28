// Só leitura: foto da TV em modo TV (?tv=1), 1920×1080; argv[2] = arquivo, argv[3] = recorte x,y,w,h (opcional)
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1' + (process.argv[4] || '')); await pg.waitForTimeout(5000);
const c = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
await pg.screenshot({ path: process.argv[2], ...(c ? { clip: { x:c[0], y:c[1], width:c[2], height:c[3] } } : {}) });
console.log('erros', erros.length, erros.slice(0,3)); await nav.close();
