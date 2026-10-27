// PROVA da E2 (TV recebe o GPS em LOTE) — Chrome sem janela, com a PONTE REAL (web/cockpit/cloud-bridge.js)
// e só a biblioteca da nuvem falsificada por baixo (nenhuma conexão ao Supabase). As mensagens saem no
// formato do GpsLivePublisher do notebook: topo = fix mais novo + chave "lote" com os anteriores, 1 a cada 200 ms.
// Pontos da gravação REAL de 21/06.
// Uso: node prova-tv-lote.mjs <url-base> <pasta-saida> [pasta-ponte-alternativa]
//   3º argumento (CONTROLE) = pasta com cloud-bridge.js + gps-fonte-unica.js de antes da E2, servidos no lugar.
// Sai 1 se qualquer item reprovar.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:5199') + '/_design-reference/mockup-command-box-vista-piloto.html';
const OUT = process.argv[3] || '.';
const PONTE_ALT = process.argv[4] || null;
const RAIZ = new URL('../../', import.meta.url).pathname;

// Biblioteca da nuvem falsa: o canal guarda os ouvintes; window.__nuvem.emit entrega como o Supabase entregaria.
const SUPABASE_FALSO = `
const ouvintes = {}; let assinar = null;
window.__nuvem = {
  emit(ev, payload){ for (const f of (ouvintes[ev] || [])) f({ type:'broadcast', event: ev, payload }); },
  ligar(){ if (assinar) assinar('SUBSCRIBED'); }, msgs: 0,
};
export function createClient(){ return { channel(){ return {
  on(_t, filtro, f){ (ouvintes[filtro.event] = ouvintes[filtro.event] || []).push(f); return this; },
  subscribe(cb){ assinar = cb; setTimeout(() => cb('SUBSCRIBED'), 50); return this; },
  send(){ return Promise.resolve('ok'); }, unsubscribe(){ return Promise.resolve('ok'); },
}; } }; }
`;
const fx = JSON.parse(readFileSync(RAIZ + 'web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps' && a.fix >= 3).map(a => ({ ...a, kmh: a.kmh / 3.6 }));  // gravação 21/06: km/h 3,6× (leitor antigo)
const ini = pts.findIndex(p => p.kmh > 60);

let ok = 0, falha = 0;
const t = (nome, cond, extra) => { console.log((cond ? '  ok  ' : '  FAIL ') + nome + (cond ? '' : '  ' + JSON.stringify(extra))); cond ? ok++ : falha++; };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const erros = [];
page.on('pageerror', e => erros.push('PAGEERROR: ' + String(e).slice(0, 200)));
await page.route('https://esm.sh/@supabase/supabase-js*', r => r.fulfill({ contentType: 'text/javascript', body: SUPABASE_FALSO }));
if (PONTE_ALT) for (const arq of ['cloud-bridge.js', 'gps-fonte-unica.js'])
  await page.route('**/web/cockpit/' + arq + '*', r => r.fulfill({ contentType: 'text/javascript', body: readFileSync(PONTE_ALT + '/' + arq, 'utf8') }));
// HTML_ALT=<arquivo> no ambiente: serve outra versão da TV no lugar (controle de oscilação entre versões)
if (process.env.HTML_ALT) await page.route('**/_design-reference/mockup-command-box-vista-piloto.html*', r => r.fulfill({ contentType: 'text/html', body: readFileSync(process.env.HTML_ALT, 'utf8') }));
await page.goto(BASE + '?canal=cockpit-bubi-dev-teste', { waitUntil: 'load' });
await page.waitForTimeout(2500);

// Ouvinte de prova na MESMA instância da ponte que a TV usa: conta cada ponto entregue, em ordem.
await page.evaluate(async () => {
  const cb = await import('/web/cockpit/cloud-bridge.js');
  window.__entregues = [];
  cb.onGpsPoint(p => window.__entregues.push(p.tWall));
  window.__stats = () => cb.getStats();
});

const ver = () => page.evaluate(() => {
  const q = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
  const mk = document.querySelector('[data-marker="live-core"]');
  return { selo: q('#cb-live-selo .cb-txt'), vel: q('[data-hud="velocidade"]'),
    carro: mk ? mk.getAttribute('cx') + ',' + mk.getAttribute('cy') : null, n: window.__entregues.length };
});
// Monta os fixes do formato do notebook e envia em lotes de 5 (200 ms), como o GpsLivePublisher.
const fix = (a, tw) => ({ lat: a.lat, lng: a.lon, kmh: a.kmh, numSV: a.numSV, fix: a.fix, accM: a.hacc,
  tWall: tw, source: 'racebox', gLong: 0, gLat: 0, zeroOk: false });
const enviarLotes = (fixes, esperaMs = 200) => page.evaluate(async ({ fixes, esperaMs }) => {
  for (let i = 0; i < fixes.length; i += 5) {
    const grupo = fixes.slice(i, i + 5);
    const topo = { ...grupo[grupo.length - 1] };
    if (grupo.length > 1) topo.lote = grupo.slice(0, -1);
    window.__nuvem.emit('gps', topo); window.__nuvem.msgs++;
    if (esperaMs) await new Promise(r => setTimeout(r, esperaMs));
  }
}, { fixes, esperaMs });

// L1: 10 s de pista a 25 Hz = 250 fixes em 50 mensagens
const agora0 = await page.evaluate(() => Date.now());
const trecho1 = pts.slice(ini, ini + 250).map((a, i) => fix(a, agora0 + i * 40));
await enviarLotes(trecho1);
// o velocímetro recebe o ponto mais novo 5×/s (E1): ler depois de mais uma batida, senão a régua empata com o relógio da página
await page.waitForTimeout(250);
let e = await ver();
t('L1: 50 mensagens em lote → TV entrega os 250 pontos (fidelidade 25 Hz preservada)', e.n === 250, e.n);
const ordem = await page.evaluate(() => window.__entregues.every((v, i, a) => i === 0 || v > a[i - 1]));
t('L1: pontos entregues em ordem de tempo', ordem, null);
t('L1: selo AO VIVO', e.selo === 'AO VIVO', e.selo);
t('L1: velocímetro = o fix mais novo do último lote', e.vel === String(Math.round(trecho1[249].kmh)), [e.vel, Math.round(trecho1[249].kmh)]);
await page.screenshot({ path: OUT + '/tv-lote-ao-vivo.png' });

// L2: conexão meio-morta — o notebook achou que enviou os últimos 2 s, o canal caiu, e na religação
// ele REENVIA os últimos 10 s (que a TV já tinha) + os fixes novos.
await page.waitForTimeout(5750);   // + os 250 ms da leitura do L1 = os mesmos 6 s sem mensagem
e = await ver();
t('L2: 6 s sem mensagem → SEM SINAL', /^SEM SINAL HÁ [56] s$/.test(e.selo), e.selo);
const carroQueda = e.carro;
const agora1 = await page.evaluate(() => Date.now());
const reenvio = trecho1.slice(0, 250);                                           // os 10 s já entregues, de novo
const novos = pts.slice(ini + 250, ini + 300).map((a, i) => fix(a, agora1 - 1960 + i * 40));  // 2 s novos, terminando agora
const antesN = (await ver()).n;
await enviarLotes(reenvio.concat(novos), 0);   // a fila do notebook despeja de uma vez
await enviarLotes(pts.slice(ini + 300, ini + 325).map((a, i) => fix(a, agora1 + 40 + i * 40)));  // e segue ao vivo
await page.waitForTimeout(250);   // mais uma batida do velocímetro (5×/s)
e = await ver();
const st = await page.evaluate(() => window.__stats());
t('L2: os 250 pontos repetidos do reenvio NÃO chegam de novo à TV', e.n - antesN === 75, [e.n - antesN, 'esperado 75 novos']);
t('L2: a ponte contou os repetidos descartados', st.gpsRepetidos === 250, st.gpsRepetidos);
t('L2: sinal voltou → AO VIVO', e.selo === 'AO VIVO', e.selo);
t('L2: velocímetro = o fix mais novo (não o passado do reenvio)', e.vel === String(Math.round(pts[ini + 324].kmh)), [e.vel, Math.round(pts[ini + 324].kmh)]);
t('L2: carro andou para a frente depois da volta do sinal', e.carro && e.carro !== carroQueda, [carroQueda, e.carro]);
await page.screenshot({ path: OUT + '/tv-lote-apos-reenvio.png' });

// L3: Cockpit ANTIGO (sem lote) continua funcionando: 1 fix por mensagem
const agora2 = await page.evaluate(() => Date.now());
const antes3 = (await ver()).n;
await page.evaluate(async (fixes) => { for (const f of fixes) { window.__nuvem.emit('gps', f); await new Promise(r => setTimeout(r, 40)); } },
  pts.slice(ini + 325, ini + 375).map((a, i) => fix(a, agora2 + i * 40)));
e = await ver();
t('L3: controle — Cockpit antigo (1 fix por mensagem) segue entregando ponto a ponto', e.n - antes3 === 50, e.n - antes3);
t('L3: controle — selo segue AO VIVO', e.selo === 'AO VIVO', e.selo);

t('nenhum erro de página', erros.length === 0, erros);
await browser.close();
console.log(`\nRESULTADO: ${ok} ok, ${falha} falha`);
process.exit(falha ? 1 : 0);
