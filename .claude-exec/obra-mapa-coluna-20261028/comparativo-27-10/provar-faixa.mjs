// Prova da faixa de baixo da A: legenda sempre presente (cores do pé com G, faixas de velocidade sem G) e nada cortado.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());   // robô não ocupa vaga na sala de vídeo
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10&mapa=faixas'); await pg.waitForTimeout(15000);
let falhas = 0, vistos = new Set();
for (let i = 0; i < 50; i++) { await pg.waitForTimeout(500);
  if (i === 40) await pg.frames().find(x => x.url().includes('vista-piloto')).evaluate(() => { const o = window.__tvGps.snapshot; window.__tvGps.snapshot = () => { const s = o(); return Object.assign({}, s, { pancadas: Object.assign({}, s.pancadas, { lugaresRepetidos: [1, 2] }) }); }; });   // 3ª parte: simula 2 lugares repetidos
  if (i === 20) await pg.frames().find(x => x.url().includes('vista-piloto')).evaluate(() => { const o = window.__tvGps.snapshot; window.__tvGps.snapshot = () => { const s = o(); return Object.assign({}, s, { agora: Object.assign({}, s.agora, { zeroOk: false }) }); }; });   // 2ª metade: simula fonte sem o zero da força G
  const r = await pg.frames().find(x => x.url().includes('vista-piloto')).evaluate(() => { const pe = document.querySelector('.est-pe'); if (!pe || !pe.innerHTML) return null;
    const lins = [...pe.querySelectorAll('.lin')].map(l => ({ t: l.innerText.replace(/\s+/g, ' ').trim(), cortada: l.scrollWidth > l.clientWidth + 1 }));
    const comG = window.__tvGps.snapshot().agora?.zeroOk; return { comG: !!comG, lins }; });
  // logo depois da simulação a faixa ainda não redesenhou (ela roda a cada 250 ms)
  if (!r || i === 20 || i === 21 || i === 40 || i === 41) continue;
  if (i > 41 && !/2 repetidos/.test(r.lins[0].t.toLowerCase())) { falhas++; console.log('FALHA repetidos', r.lins[0].t); } const leg = r.lins[2].t.toLowerCase(); const ok = r.comG ? /freio.*acel.*embalo/.test(leg) : /< 60.*130 km\/h/.test(leg);
  const cortes = r.lins.filter(l => l.cortada).length; if (!ok || cortes) falhas++;
  const k = (r.comG ? 'G ' : 'semG ') + (ok ? 'ok' : 'FALHA') + (cortes ? ' cortada' : ''); if (!vistos.has(k)) { vistos.add(k); console.log(k, JSON.stringify(r.lins.map(l => l.t))); } }
console.log(falhas ? `RESULTADO: REPROVADO (${falhas})` : 'RESULTADO: APROVADO', '| casos vistos', [...vistos].join(', '), '| erros', erros.length); await nav.close(); process.exit(falhas ? 1 : 0);
