// foto da TV (modo TV, gravação 21/06) — uso: node foto.mjs <saida.png> [espera_ms]
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const [saida, espera = '30000'] = process.argv.slice(2);
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=40&fim=parar'); await pg.waitForTimeout(+espera);
await pg.screenshot({ path: saida }); await nav.close();
