// Prova do selo do mapa na página de comparação: com a gravação tocando, nunca "ao vivo" (nos 3 modos).
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=hoje'); await pg.waitForTimeout(15000);
let falhas = 0;
for (const m of ['hoje', 'faixas', 'grande']) { await pg.click(`#modo [data-mapa="${m}"]`); await pg.waitForTimeout(1500);
  const r = await pg.frames().find(x => x.url().includes('vista-piloto')).evaluate(() => { const b = document.querySelector('[data-block-id="mapa"]'), a = getComputedStyle(b, '::after');
    return { classeVivo: b.classList.contains('cb-vivo'), texto: a.content, fundo: a.backgroundColor }; });
  const ok = !/ao vivo/i.test(r.texto); if (!ok) falhas++; console.log(m, ok ? 'ok' : 'FALHA', JSON.stringify(r)); }
console.log(falhas ? `RESULTADO: REPROVADO (${falhas})` : 'RESULTADO: APROVADO', '| erros da página', erros.length); await nav.close(); process.exit(falhas ? 1 : 0);
