// foto de uma URL qualquer — uso: node foto-url.mjs <url> <saida.png> [espera_ms] [largura] [altura]
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const [url, saida, espera = '6000', w = '1920', h = '1080'] = process.argv.slice(2);
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:+w, height:+h } });
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.route('**/api/room', r => r.abort());
await pg.goto(url); await pg.waitForTimeout(+espera); await pg.screenshot({ path: saida });
console.log('erros', erros.length, erros.slice(0,3)); await nav.close();
