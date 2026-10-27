// PROVA da E3 (câmera na TV) — Chrome sem janela, NADA de nuvem: ponte /api/room falsa, biblioteca
// de vídeo falsa (window.DailyIframe com câmera feita de canvas), câmeras do notebook falsas.
// Uso: node prova-tv-video.mjs [url-base] [pasta-saida] [video-tv.js-alternativo]   (servidor estático na raiz da worktree, porta 5199)
// Sai 1 se qualquer item reprovar. Cada item tem o controle que tem de dar o oposto.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const OUT = process.argv[3] || new URL('.', import.meta.url).pathname;
const TV = BASE + '/_design-reference/mockup-command-box-vista-piloto.html';
const NOTE = BASE + '/web/teste-aparelhos/index.html';

let ok = 0, falha = 0;
const t = (nome, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + nome + (cond ? '' : '  ' + JSON.stringify(extra))); cond ? ok++ : falha++; };

// Biblioteca de vídeo FALSA. A câmera do carro é um canvas que só gera quadro quando a prova manda
// (captureStream(0) + requestFrame): "congelar" = câmera travada de verdade, sem quadro novo.
const DAILY_FALSA = `
(() => {
  const fd = window.__fd = { chamadas: [], joins: [], entradas: [], envio: [], camFixada: [], piloto: null, timer: null };
  function camera() {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d'); const s = c.captureStream(0); const tr = s.getVideoTracks()[0]; let n = 0;
    const quadro = () => { g.fillStyle = 'hsl(' + (n++ * 7 % 360) + ',70%,45%)'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.font = '28px sans-serif'; g.fillText('CARRO ' + n, 20, 100); tr.requestFrame && tr.requestFrame(); };
    return { tr, ligar() { clearInterval(fd.timer); fd.timer = setInterval(quadro, 80); quadro(); }, congelar() { clearInterval(fd.timer); } };
  }
  fd.ligarPiloto = () => { fd.cam = fd.cam || camera(); fd.cam.ligar(); fd.piloto = fd.cam.tr; const c = fd.chamadas.at(-1); c && c._emit('participant-joined'); c && c._emit('track-started'); };
  fd.congelar = () => fd.cam && fd.cam.congelar();
  fd.derrubar = () => { const c = fd.chamadas.at(-1); c && c._emit('left-meeting'); };
  window.DailyIframe = {
    createCallObject(opts) {
      const ouv = {}; const call = {
        opts: opts || null, destruida: false,
        on(ev, f) { (ouv[ev] = ouv[ev] || []).push(f); return call; },
        _emit(ev, x) { for (const f of ouv[ev] || []) try { f(x || {}); } catch (e) { console.error(e); } },
        async join(o) { fd.joins.push(o); setTimeout(() => call._emit('joined-meeting'), 50); return {}; },
        async destroy() { call.destruida = true; },
        participants() {
          const r = { local: { local: true, user_name: 'Box', tracks: { video: {} } } };
          if (fd.piloto && !call.destruida) r.carro = { user_name: 'Piloto', tracks: { video: { persistentTrack: fd.piloto, state: 'playable' } } };
          return r;
        },
        async setLocalVideo() {}, async setLocalAudio() {},
        async updateInputSettings(x) { fd.entradas.push(x); }, async updateSendSettings(x) { fd.envio.push(x); },
        async setInputDevicesAsync(x) { fd.camFixada.push({ chamada: fd.chamadas.indexOf(call), id: x.videoDeviceId }); },
        sendAppMessage() {},
      };
      fd.chamadas.push(call); return call;
    },
  };
})();`;

// Câmeras do notebook FALSAS (a interna e a USB) + Wake Lock contado.
const NOTEBOOK_FALSO = `
(() => {
  window.__wake = 0;
  const devs = [
    { kind: 'videoinput', deviceId: 'int', label: 'Integrated Camera (0bda:5634)', groupId: 'a' },
    { kind: 'videoinput', deviceId: 'usb', label: 'HD Webcam C270 (046d:0825)', groupId: 'b' },
  ];
  const md = navigator.mediaDevices || {};
  md.enumerateDevices = async () => devs.map(d => ({ ...d, toJSON() { return d; } }));
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake++; return { addEventListener() {}, release: async () => {} }; } } });
})();`;
// Ponte do GPS falsa e quieta (mesmo formato da prova honesta): sem ela a TV se recarrega em 15 s (E1),
// e o relógio adiantado da parte D recarregaria a página no meio da conta.
const PONTE_QUIETA = `
export function onGpsPoint(){} export function onSample(){} export function onEvento(){} export function onPosicao(){}
export function onStatusChange(){} export function usarCanal(n){ return n; } export function getStatus(){ return 'connecting'; }
export function getStats(){ return {}; } export async function startCloudBridge(){ return 'connecting'; } export function publishSample(){ return false; }`;
const SUPABASE_FALSO = `export function createClient(){ return { channel(){ const ch = { on(){ return ch; }, subscribe(){ return ch; }, async unsubscribe(){}, send(){} }; return ch; } }; }`;

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

// Abre uma página com a ponte da sala respondendo pelo `sala` (função: nº do pedido → resposta).
async function abrir(url, { sala, notebook = false, relogio = false, contexto = null } = {}) {
  const ctx = contexto || await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.__logs = []; page.__pedidos = [];
  page.on('pageerror', e => page.__logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.__logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
  if (relogio) await page.clock.install();
  await page.addInitScript(DAILY_FALSA);
  if (notebook) await page.addInitScript(NOTEBOOK_FALSO);
  await page.route('https://unpkg.com/**', r => r.abort());                       // nunca a biblioteca de verdade
  await page.route('https://esm.sh/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: SUPABASE_FALSO, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/*.supabase.co/**', r => r.abort());
  await page.route('**/web/cockpit/cloud-bridge.js*', r => r.fulfill({ contentType: 'text/javascript', body: PONTE_QUIETA }));   // TV sem nuvem: só o vídeo interessa aqui
  // controle: 3º argumento = video-tv.js alternativo (ex.: o backup de antes do conserto) servido no lugar da peça
  if (process.argv[4]) await page.route('**/web/command-box/video-tv.js*', r => r.fulfill({ contentType: 'text/javascript', body: readFileSync(process.argv[4], 'utf8') }));
  await page.route('**/api/vivo', r => r.fulfill({ status: 204, body: '' }));
  await page.route('**/api/room', async r => {
    const corpo = r.request().postData();
    page.__pedidos.push(corpo);
    const x = sala(page.__pedidos.length);
    await r.fulfill(x.status ? { status: x.status, body: 'fora' } : { contentType: 'application/json', body: JSON.stringify(x) });
  });
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
const SALA = (nome = 'evento-p1-teste-aparelhos-20261027') => ({ ok: true, roomName: nome, roomUrl: 'https://x.daily.co/' + nome, tokenBox: 'TB-espectador' });
const selo = (p) => p.evaluate(() => { const c = document.querySelector('[data-block-id="video"] > .tvv'); return c ? { codigo: c.getAttribute('data-video'), texto: c.querySelector('.tvv-selo').textContent } : null; });
const esperarSelo = async (p, re, ms = 8000) => { const fim = Date.now() + ms; let s; while (Date.now() < fim) { s = await selo(p); if (s && re.test(s.texto)) return s; await p.waitForTimeout(150); } return s; };

// ── A) TV: aguardando → ao vivo → sem vídeo há X s → religa ──
{
  const p = await abrir(TV + '?tv=1', { sala: () => SALA() });
  let s = await esperarSelo(p, /AGUARDANDO/);
  t('A1 TV na sala sem o carro = "AGUARDANDO A CÂMERA DO CARRO"', s && s.codigo === 'aguardando', s);
  const pedido = JSON.parse(p.__pedidos[0] || 'null');
  t('A2 TV pede a sala como espectador (papel tv) e entra com o acesso de espectador', pedido && pedido.papel === 'tv' && await p.evaluate(() => __fd.joins[0].token) === 'TB-espectador', [pedido]);
  t('A3 TV entra sem câmera e sem microfone', await p.evaluate(() => { const o = __fd.chamadas[0].opts; return o.videoSource === false && o.audioSource === false; }));
  const coberto = await p.evaluate(() => document.querySelector('[data-block-id="video"]').classList.contains('tv-nao-racebox'));
  t('A4 bloco do vídeo NÃO fica coberto pela tarja "câmera ainda não ligada"', coberto === false, coberto);
  await p.waitForTimeout(1300);
  const coberto2 = await p.evaluate(() => document.querySelector('[data-block-id="video"]').classList.contains('tv-nao-racebox'));
  t('A4b e a volta de 1 s da camada RaceBox não cobre de novo', coberto2 === false, coberto2);
  t('A5 desenho de exemplo (REC · CAM ONBOARD) escondido', await p.evaluate(() => { const f = document.querySelector('[data-block-id="video"] .video-frame'); return !f || getComputedStyle(f).display === 'none'; }));
  await p.evaluate(() => __fd.ligarPiloto());
  s = await esperarSelo(p, /AO VIVO/);
  t('A6 câmera do carro mandando quadro = "CÂMERA AO VIVO"', s && s.codigo === 'ao-vivo', s);
  const tocando = await p.evaluate(() => { const v = document.querySelector('.tvv video'); return { rs: v.readyState, w: v.videoWidth, t: v.currentTime }; });
  t('A7 o vídeo da TV está tocando a trilha do carro (320×180)', tocando.rs >= 2 && tocando.w === 320, tocando);
  await p.screenshot({ path: OUT + 'tv-video-ao-vivo.png' });
  await p.evaluate(() => __fd.congelar());
  await p.waitForTimeout(1500);
  s = await selo(p);
  t('A8 controle: 1,5 s depois de travar ainda é "ao vivo" (tolerância de 3 s)', s && s.codigo === 'ao-vivo', s);
  s = await esperarSelo(p, /SEM VÍDEO HÁ/, 6000);
  t('A9 câmera TRAVADA (sem quadro novo) = "SEM VÍDEO HÁ X s" — não finge ao vivo', s && s.codigo === 'sem-video', s);
  await p.screenshot({ path: OUT + 'tv-video-sem-video.png' });
  await p.evaluate(() => __fd.ligarPiloto());
  s = await esperarSelo(p, /AO VIVO/);
  t('A10 quadro voltou = "CÂMERA AO VIVO" de novo', s && s.codigo === 'ao-vivo', s);
  await p.evaluate(() => __fd.derrubar());
  s = await selo(p);
  t('A11 sala caiu = "SEM VÍDEO HÁ … · religando" (nunca ao vivo)', s && s.codigo !== 'ao-vivo' && /religando/.test(s.texto), s);
  await p.waitForTimeout(3600);
  const n = await p.evaluate(() => ({ chamadas: __fd.chamadas.length, entradas: __tvVideo.entradas, quedas: __tvVideo.quedas }));
  s = await esperarSelo(p, /AO VIVO/);
  t('A12 religou sozinha em ~3 s (2ª chamada, 2ª entrada) e voltou ao vivo', n.chamadas === 2 && n.entradas === 2 && n.quedas === 1 && s && s.codigo === 'ao-vivo', [n, s]);
  t('A13 nenhuma falha de script na TV', !p.__logs.some(l => l.startsWith('PAGEERROR')), p.__logs.filter(l => l.startsWith('PAGEERROR')));
  await p.context().close();
}

// ── B) TV: ponte fora (502) → "SEM CONEXÃO" → volta sozinha ──
{
  let fora = true;
  const p = await abrir(TV + '?tv=1', { sala: () => fora ? { status: 502 } : SALA() });
  let s = await esperarSelo(p, /SEM CONEXÃO/);
  t('B1 ponte respondeu 502 = "SEM CONEXÃO COM A SALA DE VÍDEO"', s && s.codigo === 'sem-ponte', s);
  t('B2 controle: sem sala, nenhuma chamada de vídeo aberta', await p.evaluate(() => __fd.chamadas.length) === 0);
  fora = false;
  await p.evaluate(() => __fd.ligarPiloto());
  s = await esperarSelo(p, /AO VIVO/, 12000);
  t('B3 ponte voltou = religou sozinha (3 s → 6 s) e "CÂMERA AO VIVO"', s && s.codigo === 'ao-vivo' && p.__pedidos.length >= 2, [s, p.__pedidos.length]);
  await p.context().close();
}

// ── C) atelier (fora do modo TV): vídeo NÃO liga ──
{
  const p = await abrir(TV + '?tv=0', { sala: () => SALA() });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ tvv: !!document.querySelector('.tvv'), falso: !!document.querySelector('[data-block-id="video"] .video-frame') }));
  t('C1 atelier: sem camada de vídeo e sem pedido de sala', !r.tvv && p.__pedidos.length === 0, [r, p.__pedidos.length]);
  t('C2 controle: o desenho do atelier continua lá', r.falso, r);
  await p.context().close();
}

// ── D) TV: 30 min depois renova a sala; sala do dia mudou → religa nela ──
{
  const p = await abrir(TV + '?tv=1', { sala: (n) => SALA(n <= 2 ? 'evento-p1-teste-aparelhos-20261027' : 'evento-p1-teste-aparelhos-20261028'), relogio: true });
  await p.waitForTimeout(1500);
  const antes = p.__pedidos.length;
  await p.clock.fastForward('29:00');
  await p.waitForTimeout(500);
  t('D1 controle: com 29 min, nenhum pedido novo', p.__pedidos.length === antes, [antes, p.__pedidos.length]);
  await p.clock.fastForward('01:30');
  await p.waitForTimeout(800);
  const meio = p.__pedidos.length;
  t('D2 com 30 min, a TV pede a sala de novo (estende o prazo de 2 h)', meio === antes + 1, [antes, meio]);
  t('D3 controle: mesma sala → continua na mesma chamada', await p.evaluate(() => __fd.chamadas.length) === 1);
  await p.clock.fastForward('30:30');
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({ chamadas: __fd.chamadas.length, sala: __tvVideo.sala }));
  t('D4 sala do dia mudou (virou o dia) → religa na sala nova', r.chamadas === 2 && r.sala === 'evento-p1-teste-aparelhos-20261028', r);
  await p.context().close();
}

// ── E) notebook: câmera certa, escolha guardada refeita na religação e na reabertura, teto, tela acesa ──
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const salaN = () => ({ ok: true, roomName: 'evento-p1-teste-aparelhos-20261027', roomUrl: 'https://x.daily.co/r', tokenPiloto: 'TP', tokenBox: 'TB' });
  let p = await abrir(NOTE, { sala: salaN, notebook: true, contexto: ctx });
  const fim = Date.now() + 9000;
  while (Date.now() < fim && !(await p.evaluate(() => __fd.camFixada.length))) await p.waitForTimeout(200);
  let fix = await p.evaluate(() => __fd.camFixada.slice());
  t('E1 sem escolha guardada: fixa a USB "HD Webcam C270", nunca a interna', fix[0] && fix[0].id === 'usb', fix);
  t('E2 entra na sala com o acesso do piloto (notebook transmite)', await p.evaluate(() => __fd.joins[0] && __fd.joins[0].token) === 'TP');
  const envio = await p.evaluate(() => __fd.envio[0]);
  t('E3 teto de envio: 1 camada de no máx. 1 Mbps / 24 quadros', envio && envio.video.encodings.low.maxBitrate === 1000000 && envio.video.encodings.low.maxFramerate === 24, envio);
  const ent = await p.evaluate(() => __fd.entradas[0]);
  t('E4 teto de entrada: 1280×720', ent && ent.video.settings.width.max === 1280 && ent.video.settings.height.max === 720, ent);
  t('E5 pediu a tela acesa (Wake Lock)', await p.evaluate(() => window.__wake) >= 1);
  await p.selectOption('#cams', 'int');
  await p.waitForTimeout(300);
  const guardada = await p.evaluate(() => localStorage.getItem('p1fast-video-camera'));
  t('E6 escolha do seletor (a interna, de propósito) fica guardada', /"id":"int"/.test(guardada || ''), guardada);
  await p.evaluate(() => __fd.derrubar());
  const fim2 = Date.now() + 9000;
  while (Date.now() < fim2 && !(await p.evaluate(() => __fd.camFixada.some(c => c.chamada === 1)))) await p.waitForTimeout(200);
  fix = await p.evaluate(() => __fd.camFixada.filter(c => c.chamada === 1));
  t('E7 religação (chamada nova): refaz a ESCOLHIDA, não volta para a padrão', fix.length >= 1 && fix[0].id === 'int', fix);
  await p.close();
  p = await abrir(NOTE, { sala: salaN, notebook: true, contexto: ctx });
  const fim3 = Date.now() + 9000;
  while (Date.now() < fim3 && !(await p.evaluate(() => __fd.camFixada.length))) await p.waitForTimeout(200);
  fix = await p.evaluate(() => __fd.camFixada.slice());
  t('E8 reabertura da página: a escolhida continua valendo', fix[0] && fix[0].id === 'int', fix);
  await p.evaluate(() => localStorage.removeItem('p1fast-video-camera'));
  await p.close();
  p = await abrir(NOTE, { sala: salaN, notebook: true, contexto: ctx });
  const fim4 = Date.now() + 9000;
  while (Date.now() < fim4 && !(await p.evaluate(() => __fd.camFixada.length))) await p.waitForTimeout(200);
  fix = await p.evaluate(() => __fd.camFixada.slice());
  t('E9 controle: sem escolha guardada volta à USB', fix[0] && fix[0].id === 'usb', fix);
  t('E10 nenhuma falha de script no notebook', !p.__logs.some(l => l.startsWith('PAGEERROR')), p.__logs.filter(l => l.startsWith('PAGEERROR')));
  await ctx.close();
}

await browser.close();
console.log(`\nRESULTADO: ${ok} ok, ${falha} falha`);
process.exit(falha ? 1 : 0);
