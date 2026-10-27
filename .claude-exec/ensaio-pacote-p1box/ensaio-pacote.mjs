// ENSAIO DE BANCADA da E5 — o PACOTE montado (dist/p1box-tv), não o código solto.
//  - servidor local imitando o Vercel: estático + /tv/ → tv/index.html + /api/room pela função do pacote
//    (o fam-racing é FALSO aqui: nenhuma sala de vídeo de verdade é criada);
//  - GPS da gravação REAL de 21/06 publicado DE VERDADE pela nuvem (Supabase) no canal de TESTE,
//    no formato do GpsLivePublisher (topo + lote, 1 msg a cada 200 ms). Canal de produção = recusado;
//  - Chrome sem janela abre /tv/?canal=cockpit-bubi-dev-teste e mede: AGUARDANDO → AO VIVO → queda
//    (SEM SINAL HÁ X s) → rajada velha (ATRASADO) → volta (AO VIVO); isolamento (a TV só pede /tv/...,
//    /api/room e CDNs); telas do ar (menu e Vista de julho) seguem carregando as peças da RAIZ.
// Uso: node ensaio-pacote.mjs [pasta-do-pacote] [pasta-saida]     Sai 1 se qualquer item reprovar.
// ENSAIO_URL=https://p1box.vercel.app → mesmo ensaio contra o site PUBLICADO (validação pós-publicação): sem servidor
// local, a sala de vídeo é a de verdade (a TV pede como espectador; a resposta tem de trazer só o acesso de espectador).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { servirPacote } from './servidor-pacote.mjs';
const reqCdai = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = reqCdai('playwright');
const RAIZ = new URL('../../', import.meta.url).pathname;
const reqP1 = createRequire(RAIZ + 'package.json');
const { createClient } = reqP1('@supabase/supabase-js');

const PACOTE = resolve(process.argv[2] || RAIZ + 'dist/p1box-tv');
const OUT = process.argv[3] || new URL('.', import.meta.url).pathname;
// Canal SÓ DO ENSAIO (o dev-teste é dividido com o notebook — outro emissor vivo ali sujou E1/E3/E4 em 27/10).
// ENSAIO_CANAL=cockpit-bubi-dev-teste roda o controle no canal compartilhado.
const CANAL = process.env.ENSAIO_CANAL || 'cockpit-bubi-dev-ensaio-e5';
if (CANAL === 'cockpit-bubi-live' || !/^cockpit-bubi-[a-z0-9-]{1,40}$/.test(CANAL)) { console.error('RECUSADO: canal de produção ou fora da regra da ponte'); process.exit(2); }

let ok = 0, falha = 0;
const t = (nome, cond, extra) => { console.log((cond ? '  ok  ' : '  FAIL ') + nome + (cond ? '' : '  ' + JSON.stringify(extra))); cond ? ok++ : falha++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ── site: servidor "Vercel" local com o pacote, ou o site publicado (ENSAIO_URL) ───
const URL_PUBLICADA = (process.env.ENSAIO_URL || '').replace(/\/$/, '');
const local = URL_PUBLICADA ? null : await servirPacote(PACOTE);
const BASE = URL_PUBLICADA || local.base;
console.log('site do ensaio: ' + BASE + (URL_PUBLICADA ? ' (PUBLICADO)' : ' (pacote local, sala de vídeo falsa)'));

// ── GPS de verdade pela nuvem, canal de TESTE ──────────────────────────────
const fx = JSON.parse(readFileSync(RAIZ + 'web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = fx.amostras.filter((a) => a.tipo === 'gps' && a.fix >= 3).map((a) => ({ ...a, kmh: a.kmh / 3.6 }));
let cur = pts.findIndex((p) => p.kmh > 60);
const fix = (a, tw) => ({ lat: a.lat, lng: a.lon, kmh: a.kmh, numSV: a.numSV, fix: a.fix, accM: a.hacc, tWall: tw, source: 'racebox', gLong: 0, gLat: 0, zeroOk: false });
const nuvem = createClient('https://fvhwltzhytpnhlqbttmd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA',
  { realtime: { params: { eventsPerSecond: 20 } } });
const ch = nuvem.channel(CANAL, { config: { broadcast: { ack: true, self: false } } });
await new Promise((res, rej) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') rej(new Error(s)); }));
let enviadas = 0, recusadas = 0;
async function publicar(segundos, { atrasoMs = 0, intervaloMs = 200 } = {}) {
  const msgs = Math.round(segundos * 5);
  for (let m = 0; m < msgs; m++) {
    const agora = Date.now() - atrasoMs;
    const grupo = []; for (let k = 4; k >= 0; k--) grupo.push(fix(pts[cur++ % pts.length], agora - k * 40));
    const topo = { ...grupo[4], lote: grupo.slice(0, 4) };
    const r = await ch.send({ type: 'broadcast', event: 'gps', payload: topo });
    r === 'ok' ? enviadas++ : recusadas++;
    if (intervaloMs) await espera(intervaloMs);
  }
}

// ── Chrome sem janela ──────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const erros = [], pedidos = [], quebrados = [], pedidosSala = [];
page.on('pageerror', (e) => erros.push(String(e).slice(0, 200)));
page.on('request', (r) => { pedidos.push(r.url());
  if (r.url() === BASE + '/api/room') { let b = null; try { b = JSON.parse(r.postData() || 'null'); } catch {} pedidosSala.push({ body: b }); } });
page.on('response', (r) => { if (r.status() >= 400) quebrados.push(r.status() + ' ' + r.url()); });
await page.goto(`${BASE}/tv/?canal=${CANAL}`, { waitUntil: 'load' });
const ver = () => page.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
  return { selo: q('#cb-live-selo .cb-txt'), vel: q('[data-hud="velocidade"]') };
});
let e;
for (let i = 0; i < 20; i++) { await espera(500); e = await ver(); if (e.selo === 'AGUARDANDO O CARRO') break; }
t('E1: pacote abre e espera o carro (nuvem de verdade conectada, nenhum ponto ainda)', e.selo === 'AGUARDANDO O CARRO', e);

await publicar(8);
await espera(300); e = await ver();
t('E2: GPS da gravação pela nuvem real → selo AO VIVO', e.selo === 'AO VIVO', e);
t('E2: velocímetro com número do GPS', /^\d+$/.test(e.vel || '') && +e.vel > 0, e.vel);
await page.screenshot({ path: OUT + '/ensaio-ao-vivo.png' });

await espera(6500); e = await ver();
t('E3: notebook calado 6,5 s → SEM SINAL HÁ X s (nunca AO VIVO)', /^SEM SINAL HÁ [5-8] s$/.test(e.selo || ''), e);
await page.screenshot({ path: OUT + '/ensaio-sem-sinal.png' });

// Reenvio: pontos MAIS VELHOS que o último já mostrado (12 s atrás; o último foi há ~7 s) — a ponte
// os descarta como repetidos (E2) e a TV segue no SEM SINAL. Nunca AO VIVO.
await publicar(1, { atrasoMs: 12000 });
await espera(300); e = await ver();
t('E4: reenvio mais velho que o já mostrado → descartado, segue SEM SINAL (nunca AO VIVO)', /^SEM SINAL HÁ/.test(e.selo || ''), e);
// Fila do buraco: pontos de 5 s atrás, MAIS NOVOS que o último mostrado — chegam agora, mas velhos.
await publicar(2, { atrasoMs: 5000 });
await espera(300); e = await ver();
t('E4: fila do buraco (pontos de 5 s atrás chegando agora) → ATRASADO (nunca AO VIVO)', /^ATRASADO/.test(e.selo || ''), e);

await publicar(6);
await espera(300); e = await ver();
t('E5: sinal voltou em dia → AO VIVO de novo', e.selo === 'AO VIVO', e);

// isolamento: a TV só pede o que é dela
const locais = pedidos.filter((u) => u.startsWith(BASE)).map((u) => new URL(u).pathname);
const fora = locais.filter((p) => !p.startsWith('/tv/') && p !== '/api/room' && p !== '/favicon.ico');
t('E6: a TV só carrega /tv/... e /api/room (nenhuma peça das telas do ar)', fora.length === 0, fora.slice(0, 5));
t('E6: controle — a TV pediu peças de /tv/web/', locais.some((p) => p.startsWith('/tv/web/')), locais.slice(0, 5));
t('E7: TV pediu a sala como espectador (papel tv) e a resposta não traz o acesso do piloto',
  pedidosSala.length > 0 && pedidosSala.every((p) => p.body.papel === 'tv'), pedidosSala.map((p) => p.body));
const resp = await page.evaluate(async () => (await fetch('/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: 'tv' }) })).json());
t('E7: /api/room do site devolve o acesso de espectador e nunca o do piloto', !!resp.tokenBox && !('tokenPiloto' in resp),
  { ...resp, tokenBox: resp.tokenBox ? '(presente)' : resp.tokenBox });
const locaisQuebrados = quebrados.filter((q) => q.includes(BASE) && !q.includes('/favicon.ico'));
t('E8: nenhum arquivo do pacote deu 404 na TV', locaisQuebrados.length === 0, locaisQuebrados);
t('E8: nenhum erro de script na TV', erros.length === 0, erros);

// telas do ar seguem iguais e carregando da RAIZ
for (const tela of ['/', '/mockup-command-box-vista-piloto.html', '/mockup-command-box-comparar-voltas.html']) {
  const p2 = await browser.newPage(); const q2 = [], ped2 = [];
  p2.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().includes('favicon')) q2.push(r.status() + ' ' + r.url()); });
  p2.on('request', (r) => { if (r.url().startsWith(BASE)) ped2.push(new URL(r.url()).pathname); });
  await p2.goto(BASE + tela, { waitUntil: 'load' }); await espera(1500);
  t(`E9: tela do ar ${tela} abre sem 404 e não usa nada de /tv/`, q2.length === 0 && !ped2.some((p) => p.startsWith('/tv/')), { q2, tv: ped2.filter((p) => p.startsWith('/tv/')) });
  await p2.close();
}

console.log(`\nmensagens publicadas no canal ${CANAL}: ${enviadas} aceitas pela nuvem, ${recusadas} recusadas`);
t('nuvem aceitou todas as mensagens do ensaio', recusadas === 0 && enviadas > 0, { enviadas, recusadas });
await browser.close(); await nuvem.removeAllChannels(); if (local) local.servidor.close();
console.log(`\nensaio do pacote: ${ok} ok / ${falha} falha`);
process.exit(falha ? 1 : 0);
