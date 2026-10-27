// PROVA da E1 (TV honesta) — Chrome sem janela, ponte FALSA (nenhuma conexão à nuvem).
// Injeta pontos 'gps' no formato que o Cockpit publica, tirados da gravação REAL de 21/06.
// Uso: node prova-tv-honesta.mjs <url-base> <pasta-saida> [html-alternativo]   (servidor estático na raiz da worktree)
// Sai 1 se qualquer item reprovar. Cada item tem o controle que tem de dar o oposto.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:5199') + '/_design-reference/mockup-command-box-vista-piloto.html';
const OUT = process.argv[3] || '.';
const RAIZ = new URL('../../', import.meta.url).pathname;
const FAKE = `
const L = { gps:[], sample:[], evento:[], posicao:[] }; let status='off';
window.__fake = {
  emit(ev, p){ for (const f of L[ev]) { try { f(p); } catch(e){ console.error('ouvinte', e); } } },
  status(s){ status=s; }, n(){ return L.gps.length; }
};
export function onGpsPoint(f){ L.gps.push(f); }
export function onSample(f){ L.sample.push(f); }
export function onEvento(f){ L.evento.push(f); }
export function onPosicao(f){ L.posicao.push(f); }
export function onStatusChange(f){}
export function usarCanal(n){ return n; }
export function getStatus(){ return status; }
export function getStats(){ return {}; }
export async function startCloudBridge(){ if(status==='off'){ status='connecting'; } return status; }
export function publishSample(){ return false; }
`;
const fx = JSON.parse(readFileSync(RAIZ + 'web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps' && a.fix >= 3).map(a => ({ ...a, kmh: a.kmh / 3.6 }));  // gravação 21/06: km/h 3,6× (leitor antigo)
const ini = pts.findIndex(p => p.kmh > 60);

let ok = 0, falha = 0; const linhas = [];
const t = (nome, cond, extra) => { const l = (cond ? '  ok  ' : '  FAIL ') + nome + (cond ? '' : '  ' + JSON.stringify(extra)); linhas.push(l); console.log(l); cond ? ok++ : falha++; };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
async function abrir(vw, vh, query, ponte = 'falsa') {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  page.__logs = [];
  page.on('pageerror', e => page.__logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  // controle: 3º argumento = HTML alternativo (ex.: o backup de antes da E1) servido no lugar da página
  if (process.argv[4]) await page.route('**/_design-reference/mockup-command-box-vista-piloto.html*', r => r.fulfill({ contentType: 'text/html', body: readFileSync(process.argv[4], 'utf8') }));
  await page.route('**/web/cockpit/cloud-bridge.js*', r => ponte === 'falsa'
    ? r.fulfill({ contentType: 'text/javascript', body: FAKE })
    : r.fulfill({ status: 503, body: 'fora' }));
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return page;
}
const ver = (page) => page.evaluate(() => {
  const q = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
  const mk = document.querySelector('[data-marker="live-core"]');
  const mapa = document.querySelector('.b-map');
  const st = document.querySelector('.stage').getBoundingClientRect();
  const vis = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
  return {
    selo: q('#cb-live-selo .cb-txt'), seloCls: (document.getElementById('cb-live-selo') || {}).className,
    vel: q('[data-hud="velocidade"]'), rpm: q('[data-hud="rpm"]'),
    ovLive: q('[data-overlay-live]'), ovDelta: q('[data-overlay-delta]'),
    carro: mk ? mk.getAttribute('cx') + ',' + mk.getAttribute('cy') : null,
    carroVisivel: mk ? getComputedStyle(mk).display !== 'none' : false,
    carroParado: mapa ? mapa.classList.contains('tv-carro-parado') : null,
    gps: Array.from(document.querySelectorAll('.b-header .health .h-cell')).map(c => (c.querySelector('.h-key') || {}).textContent + '=' + (c.querySelector('.h-val') || {}).textContent).join(' '),
    cobertos: Array.from(document.querySelectorAll('[data-block-id].tv-nao-racebox')).map(e => e.getAttribute('data-block-id')).sort().join(','),
    // esperado da FONTE: todo bloco da página menos os 3 que o RaceBox alimenta (mapa, hud, header) e os que a página pinta pelo GPS (E2b)
    semFonte: Array.from(document.querySelectorAll('[data-block-id]')).map(e => e.getAttribute('data-block-id')).filter(id => !['mapa', 'hud', 'header'].includes(id) && !document.querySelector('[data-block-id="' + id + '"] > .tvb')).sort().join(','),   // E2b: bloco com a camada do GPS (.tvb) tem fonte
    stage: [Math.round(st.left), Math.round(st.top), Math.round(st.width), Math.round(st.height)],
    barraEdicao: vis('.edit-toolbar'), rodape: vis('.legend'), salvar: vis('#atelier-salvar-wrap'),
    seloFonte: getComputedStyle(document.getElementById('cb-live-selo')).fontSize,
    rolagem: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
  };
});
const emitir = (page, arr) => page.evaluate(async (arr) => {
  for (const a of arr) {
    window.__fake.emit('gps', { lat: a.lat, lng: a.lon, kmh: a.kmh, numSV: a.numSV, fix: a.fix, accM: a.hacc,
      tWall: a.tWallAbs != null ? a.tWallAbs : Date.now(), source: 'racebox', gLong: 0, gLat: 0, zeroOk: false });
    if (a.esperaMs) await new Promise(r => setTimeout(r, a.esperaMs));
  }
}, arr);
const fluxo = (i0, n) => pts.slice(i0, i0 + n).map(a => ({ ...a, esperaMs: 40 }));

// ── A–F: TV 32" (1920×1080), modo TV pelo canal de teste ──
{
  const page = await abrir(1920, 1080, '?canal=cockpit-bubi-dev-teste');
  let e = await ver(page);
  t('A: abriu sem carro → selo CONECTANDO (nunca "ao vivo")', /CONECTANDO/.test(e.selo) && !/AO VIVO/.test(e.selo), e.selo);
  t('A: velocímetro "—" sem dado', e.vel === '—', e.vel);
  t('A: tempos do mapa "—" (sem relógio de demonstração)', e.ovLive === '—' && e.ovDelta === '—', [e.ovLive, e.ovDelta]);
  t('A: carro não aparece antes do 1º ponto', !e.carroVisivel, e.carro);
  t('A: cabeçalho sem número inventado (BAT/5G/RT/TEMP/ALT/REC = —)', !/(87%|18ms|1\.2s|24°C|1124m|●|12sat)/.test(e.gps), e.gps);
  t('A: blocos sem fonte cobertos desde o 1º quadro (= todos os blocos da página menos mapa/hud/header)', e.semFonte.length > 0 && e.cobertos === e.semFonte, [e.cobertos, e.semFonte]);
  t('A: controle — mapa, velocímetro e cabeçalho NÃO cobertos', !/(^|,)(mapa|hud|header)(,|$)/.test(e.cobertos), e.cobertos);
  t('A: quadro preenche a TV (1920×1080, sem rolagem)', e.stage[2] === 1920 && e.stage[3] === 1080 && e.stage[0] === 0 && e.stage[1] === 0 && !e.rolagem, e.stage);
  t('A: sem barra de edição, rodapé e botão salvar', !e.barraEdicao && !e.rodape && !e.salvar, [e.barraEdicao, e.rodape, e.salvar]);
  await page.evaluate(() => window.__fake.status('online'));
  await page.waitForTimeout(800);
  e = await ver(page);
  t('B: ponte no ar, sem carro → AGUARDANDO O CARRO', e.selo === 'AGUARDANDO O CARRO', e.selo);

  await emitir(page, fluxo(ini, 250));   // 10 s a 25 Hz
  e = await ver(page);
  t('C: RaceBox chegando em dia → AO VIVO verde', e.selo === 'AO VIVO' && e.seloCls === 'cb-on', [e.selo, e.seloCls]);
  t('C: velocímetro com número real', /^\d+$/.test(e.vel || ''), e.vel);
  t('C: carro visível e não acinzentado', e.carroVisivel && !e.carroParado, e);
  t('C: satélites reais no cabeçalho', /GPS=\d+sat/.test(e.gps), e.gps);
  await page.screenshot({ path: OUT + '/tv-1920-ao-vivo.png' });

  const quedas = [];
  for (let s = 1; s <= 6; s++) { await page.waitForTimeout(1000); quedas.push(await ver(page)); }
  t('D: controle — 1 s sem ponto ainda AO VIVO', quedas[0].selo === 'AO VIVO', quedas[0].selo);
  t('D: 5–6 s sem ponto → SEM SINAL HÁ X s vermelho', /^SEM SINAL HÁ [56] s$/.test(quedas[5].selo) && quedas[5].seloCls === 'cb-err', quedas[5].selo);
  t('D: carro CONGELA na queda (mesma posição de 3 a 6 s)', new Set(quedas.slice(2).map(q => q.carro)).size === 1, quedas.map(q => q.carro));
  t('D: carro acinzentado na queda', quedas[5].carroParado === true, quedas[5].carroParado);
  t('D: velocímetro e satélites "—" na queda', quedas[5].vel === '—' && /GPS=—/.test(quedas[5].gps), [quedas[5].vel, quedas[5].gps]);
  await page.screenshot({ path: OUT + '/tv-1920-sem-sinal.png' });

  // volta o sinal; depois chega um ponto 10 min velho a 222 km/h
  // o último ponto real segue chegando a cada 200 ms (sem andar) para o carro assentar e o selo seguir AO VIVO
  const parado = pts[ini + 299];
  await emitir(page, fluxo(ini + 250, 50).concat(Array.from({ length: 6 }, () => ({ ...parado, esperaMs: 200 }))));
  const antes = await ver(page);
  const velho = { ...pts[ini + 10], kmh: 222, tWallAbs: Date.now() - 600000 };
  await emitir(page, [velho]);
  await page.waitForTimeout(450);
  const depois = await ver(page);
  t('E: controle — sinal voltou → AO VIVO', antes.selo === 'AO VIVO', antes.selo);
  t('E: ponto 10 min velho (222 km/h) não aparece no velocímetro', depois.vel !== '222', depois.vel);
  t('E: ponto velho não volta o carro', depois.carro === antes.carro, [antes.carro, depois.carro]);

  // rede trava 6 s; a fila chega de uma vez terminando num ponto 5 s velho → ATRASADO
  await page.waitForTimeout(6000);
  const agora = await page.evaluate(() => Date.now());
  const fila = pts.slice(ini + 300, ini + 400).map((a, i) => ({ ...a, tWallAbs: agora - 5000 - (99 - i) * 40 }));
  await emitir(page, fila);
  await page.waitForTimeout(400);
  e = await ver(page);
  t('F: rajada da fila terminando 5 s velha → ATRASADO 5 s âmbar', /^ATRASADO [56] s$/.test(e.selo) && e.seloCls === 'cb-wait', [e.selo, e.seloCls]);
  t('F: velocímetro mostra o ponto MAIS NOVO da rajada', e.vel === String(Math.round(fila[fila.length - 1].kmh)), [e.vel, Math.round(fila[fila.length - 1].kmh)]);
  await page.screenshot({ path: OUT + '/tv-1920-atrasado.png' });
  await emitir(page, fluxo(ini + 400, 40));
  e = await ver(page);
  t('F: controle — fila zerou → AO VIVO', e.selo === 'AO VIVO', e.selo);
  t('A–F: nenhum erro de página', page.__logs.length === 0, page.__logs);
  await page.close();
}

// ── G: TV ligou sem internet (a ponte não carrega) → avisa e recarrega sozinha ──
{
  const page = await abrir(1920, 1080, '?tv=1', 'fora');
  const e = await ver(page);
  t('G: ponte não carregou → SEM CONEXÃO COM A NUVEM · nova tentativa', /^SEM CONEXÃO COM A NUVEM · nova tentativa em \d+ s$/.test(e.selo) && e.seloCls === 'cb-err', e.selo);
  await page.unroute('**/web/cockpit/cloud-bridge.js*');
  await page.route('**/web/cockpit/cloud-bridge.js*', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  const recarregou = page.waitForEvent('load', { timeout: 20000 }).then(() => true).catch(() => false);
  t('G: recarregou sozinha em ~15 s', await recarregou, null);
  await page.waitForTimeout(1500);
  const e2 = await ver(page);
  t('G: depois de recarregar com a internet de volta → CONECTANDO', /CONECTANDO/.test(e2.selo), e2.selo);
  await page.close();
}

// ── H: TV menor (960×540) — quadro inteiro, sem corte ──
{
  const page = await abrir(960, 540, '?tv=1');
  const e = await ver(page);
  t('H: 960×540 → quadro inteiro (960×540), sem rolagem', e.stage[2] === 960 && e.stage[3] === 540 && !e.rolagem, e.stage);
  await page.screenshot({ path: OUT + '/tv-960-aguardando.png' });
  await page.close();
}

// ── I: CONTROLE — sem ?tv nem ?canal a página de desenho segue como era (editor, demonstração) ──
{
  const page = await abrir(1920, 1080, '');
  const e = await ver(page);
  const modo = await page.evaluate(() => window.__modoTv);
  t('I: controle — sem ?tv/?canal o modo TV fica desligado (barra de edição presente)', modo === false && e.barraEdicao && e.stage[2] === 1280, [modo, e.barraEdicao, e.stage]);
  await page.close();
}
{
  const page = await abrir(1920, 1080, '?canal=cockpit-bubi-dev-teste&tv=0');
  t('I: controle — ?tv=0 desliga mesmo com ?canal', (await page.evaluate(() => window.__modoTv)) === false);
  await page.close();
}

await browser.close();
console.log(`\nRESULTADO: ${ok} ok, ${falha} falha`);
process.exit(falha ? 1 : 0);
