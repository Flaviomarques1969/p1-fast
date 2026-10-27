// PROVA da E2b (blocos da TV que saem do GPS) — Chrome sem janela, TV em modo TV (?canal=), PONTE REAL
// (web/cockpit/cloud-bridge.js) e só a biblioteca da nuvem falsificada (nenhuma conexão ao Supabase).
// Entra a gravação REAL de 21/06 inteira, em lotes de 5 como o GpsLivePublisher do notebook, com o G longitudinal
// montado pela física da própria volta (Δkm/h ÷ Δt) e o zero do box valendo. A conta esperada é refeita aqui no Node
// pelas MESMAS casas (cerebro-gps-tv + cerebro-tv-blocos-gps) e comparada com o que a TV desenhou.
// Uso: node prova-tv-blocos-gps.mjs <url-base> <pasta-saida> [html-alternativo]
//   3º argumento (CONTROLE) = HTML de antes da E2b servido no lugar — a prova TEM de reprovar com ele.
// Sai 1 se qualquer item reprovar.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');

const RAIZ = new URL('../../', import.meta.url).pathname;
const { criarCerebroGpsTv } = await import(RAIZ + 'web/command-box/cerebro/cerebro-gps-tv.js');
const { criarCerebroTvBlocosGps } = await import(RAIZ + 'web/command-box/cerebro/cerebro-tv-blocos-gps.js');
const BASE = (process.argv[2] || 'http://127.0.0.1:5199') + '/_design-reference/mockup-command-box-vista-piloto.html';
const OUT = process.argv[3] || '.';
const HTML_ALT = process.argv[4] || null;

const SUPABASE_FALSO = `
const ouvintes = {}; let assinar = null;
window.__nuvem = { emit(ev, payload){ for (const f of (ouvintes[ev] || [])) f({ type:'broadcast', event: ev, payload }); } };
export function createClient(){ return { channel(){ return {
  on(_t, filtro, f){ (ouvintes[filtro.event] = ouvintes[filtro.event] || []).push(f); return this; },
  subscribe(cb){ assinar = cb; setTimeout(() => cb('SUBSCRIBED'), 50); return this; },
  send(){ return Promise.resolve('ok'); }, unsubscribe(){ return Promise.resolve('ok'); },
}; } }; }
`;
const fx = JSON.parse(readFileSync(RAIZ + 'web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const brutos = fx.amostras.filter(a => a.tipo === 'gps' && a.fix >= 3).map(a => ({ ...a, kmh: a.kmh / 3.6 }));  // 21/06: km/h 3,6× (leitor antigo)

let ok = 0, falha = 0;
const t = (nome, cond, extra) => { console.log((cond ? '  ok  ' : '  FAIL ') + nome + (cond ? '' : '  ' + JSON.stringify(extra))); cond ? ok++ : falha++; };
const virg = (x, c) => Math.abs(x).toFixed(c).replace('.', ',');

function fixes(zeroOk, agora) {
  const tFim = brutos[brutos.length - 1].tWall;
  let ant = null;
  return brutos.map(a => {
    const gLong = ant && a.tWall > ant.tWall ? ((a.kmh - ant.kmh) / 3.6) / ((a.tWall - ant.tWall) / 1000) / 9.81 : 0;
    ant = a;
    return { lat: a.lat, lng: a.lon, kmh: a.kmh, numSV: a.numSV, fix: a.fix, accM: a.hacc,
      tWall: a.tWall - tFim + agora, source: 'racebox', gLong, gLat: 0, zeroOk };
  });
}
function esperado(fx) {
  const c = criarCerebroGpsTv({ guardarVoltas: true });
  for (const p of fx) c.feedGps(p);
  return criarCerebroTvBlocosGps().pacote(c.snapshot(fx[fx.length - 1].tWall));
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
async function abrir() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const erros = [];
  page.on('pageerror', e => erros.push('PAGEERROR: ' + String(e).slice(0, 200)));
  await page.route('https://esm.sh/@supabase/supabase-js*', r => r.fulfill({ contentType: 'text/javascript', body: SUPABASE_FALSO }));
  if (HTML_ALT) await page.route('**/_design-reference/mockup-command-box-vista-piloto.html*', r => r.fulfill({ contentType: 'text/html', body: readFileSync(HTML_ALT, 'utf8') }));
  await page.goto(BASE + '?canal=cockpit-bubi-dev-teste', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { page, erros };
}
const texto = (page) => page.evaluate(() => {
  const o = {};
  for (const id of ['stint', 'stint-bar', 'delta-acum', 'passagem', 'frenagem', 'vmin', 'coach']) {
    const c = document.querySelector('[data-block-id="' + id + '"] > .tvb');
    o[id] = c ? c.innerText.replace(/\s+/g, ' ').trim() : null;
  }
  return o;
});
const enviar = (page, fx) => page.evaluate(async (fx) => {
  for (let i = 0; i < fx.length; i += 5) {
    const g = fx.slice(i, i + 5), topo = { ...g[g.length - 1] };
    if (g.length > 1) topo.lote = g.slice(0, -1);
    window.__nuvem.emit('gps', topo);
    if (i % 2500 === 0) await new Promise(r => setTimeout(r, 0));
  }
}, fx);

// ── B1: antes do carro — os 7 blocos já são do GPS ("aguardando"), nada de demonstração à vista ──
let { page, erros } = await abrir();
let tx = await texto(page);
t('B1: os 7 blocos têm a camada do GPS no modo TV', Object.values(tx).every(v => v != null), tx);
t('B1: sem carro → "aguardando", nenhum número de demonstração', tx.stint && /aguardando/i.test(tx.stint) && /aguardando/i.test(tx.coach) && !/\d:\d\d/.test(tx.stint), tx);
const visDemo = await page.evaluate(() => [...document.querySelectorAll('[data-block-id="stint"] > :not(.tvb), [data-block-id="coach"] > :not(.tvb)')]
  .filter(e => getComputedStyle(e).visibility !== 'hidden').length);
t('B1: o desenho de demonstração por baixo está escondido', visDemo === 0, visDemo);
await page.screenshot({ path: OUT + '/tv-blocos-aguardando.png' });

// ── B2: sessão real inteira, G pela física, zero do box valendo ──
const agora = await page.evaluate(() => Date.now());
const fxOk = fixes(true, agora);
await enviar(page, fxOk);
await page.waitForTimeout(1200);
const exp = esperado(fxOk);
const pg = await page.evaluate(() => window.__tvGps && window.__tvGps.blocos);
tx = await texto(page);
t('B2: a TV montou o pacote dos blocos', !!(pg && pg.stint), pg && Object.keys(pg));
t('B2: voltas completas = conta refeita no Node', pg && pg.stint.feitas === exp.stint.feitas && exp.stint.feitas >= 2, [pg && pg.stint.feitas, exp.stint.feitas]);
t('B2: melhor volta = conta refeita no Node', pg && pg.stint.melhor && exp.stint.melhor && pg.stint.melhor.n === exp.stint.melhor.n && Math.abs(pg.stint.melhor.tempoS - exp.stint.melhor.tempoS) < 0.002, [pg && pg.stint.melhor, exp.stint.melhor]);
const mT = exp.stint.melhor.tempoS, mm = Math.floor(mT / 60), mr = mT - mm * 60;
const melhorTxt = mm + ':' + (mr < 10 ? '0' : '') + mr.toFixed(3);
t('B2: bloco STINT mostra as voltas e a melhor (' + melhorTxt + ')', tx.stint.includes(String(exp.stint.feitas)) && tx.stint.includes(melhorTxt), tx.stint);
t('B2: barra do stint marca a melhor e o Δ das outras', /melhor/i.test(tx['stint-bar']) && /[+−]\d+,\d\d/.test(tx['stint-bar']), tx['stint-bar']);
const dUlt = exp.deltaAcum.voltas[exp.deltaAcum.voltas.length - 1].deltaS;
t('B2: Δ ACUMULADO = Δ da última contra a melhor da sessão (não "PB all-time")', tx['delta-acum'].includes(virg(dUlt, 3)) && /melhor da sess/i.test(tx['delta-acum']) && !/all-time/i.test(tx['delta-acum']), [tx['delta-acum'], dUlt]);
t('B2: curva da vez = a da conta no Node', pg && pg.curva && exp.curva && pg.curva.nome === exp.curva.nome, [pg && pg.curva && pg.curva.nome, exp.curva && exp.curva.nome]);
const pe = exp.curva.passagem;
t('B2: PASSAGEM mostra entrada/mínima/saída medidas', pe && tx.passagem.toLowerCase().includes(exp.curva.nome.toLowerCase()) && tx.passagem.includes(String(Math.round(pe.minima.kmh))) && tx.passagem.includes(String(Math.round(pe.entrada.kmh))), [tx.passagem, pe]);
const fe = exp.curva.frenagem;
t('B2: FRENAGEM pelo G: ok com o zero do box', fe && fe.ok === true, fe);
t('B2: FRENAGEM mostra o pico de G medido e a origem', fe && (!fe.freou || tx.frenagem.includes(virg(fe.picoFreioG, 2))) && /G medido/i.test(tx.frenagem), [tx.frenagem, fe && fe.picoFreioG]);
const temGraf = await page.evaluate(() => document.querySelectorAll('[data-block-id="frenagem"] > .tvb polyline').length);
t('B2: FRENAGEM desenha o gráfico de G (volta × melhor)', temGraf >= 1, temGraf);
t('B2: VMIN mostra a mínima medida', tx.vmin.includes(String(Math.round(exp.curva.vmin.kmh))), [tx.vmin, exp.curva.vmin.kmh]);
t('B2: COACH = trecho de maior perda da conta no Node', exp.coach && tx.coach.includes(exp.coach.nome), [tx.coach, exp.coach && exp.coach.nome]);
t('B2: nenhum bloco ficou "não vem do RaceBox" entre os 7', await page.evaluate(() => ['stint','stint-bar','delta-acum','passagem','frenagem','vmin','coach'].every(id => !document.querySelector('[data-block-id="' + id + '"]').classList.contains('tv-nao-racebox'))), null);
t('B2: blocos sem fonte seguem cobertos (carro, pneus, combustível)', await page.evaluate(() => ['carro','pneus','fuel-gauge'].every(id => document.querySelector('[data-block-id="' + id + '"]').classList.contains('tv-nao-racebox'))), null);
// o desenho de demonstração reescreve o bloco inteiro — a camada tem de voltar sozinha
await page.evaluate(() => { document.querySelector('[data-block-id="frenagem"]').innerHTML = '<div>demo</div>'; });
await page.waitForTimeout(50);
t('B2: bloco reescrito pela demonstração → a camada do GPS volta', await page.evaluate(() => !!document.querySelector('[data-block-id="frenagem"] > .tvb')), null);
await page.screenshot({ path: OUT + '/tv-blocos-gps-real.png' });
t('B2: nenhum erro de página', erros.length === 0, erros);
await page.close();

// ── B3: mesma sessão SEM o zero do box → frenagem "—" com o motivo; o resto continua ──
({ page, erros } = await abrir());
const agora3 = await page.evaluate(() => Date.now());
await enviar(page, fixes(false, agora3));
await page.waitForTimeout(1200);
tx = await texto(page);
t('B3: sem zero do box → FRENAGEM não mostra G (motivo "zero do box")', /zero do box/i.test(tx.frenagem) && !/G medido/.test(tx.frenagem), tx.frenagem);
t('B3: sem zero do box → STINT e PASSAGEM seguem com número', tx.stint.includes(melhorTxt) && /\d/.test(tx.passagem), [tx.stint, tx.passagem]);
t('B3: nenhum erro de página', erros.length === 0, erros);
await page.close();

await browser.close();
console.log(`\nRESULTADO: ${ok} ok, ${falha} falha`);
process.exit(falha ? 1 : 0);
