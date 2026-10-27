// ═══════════════════════════════════════════════════════════
// CATRACA da E3 (TV do box ao vivo, 27/10/2026) — câmera na TV
// ═══════════════════════════════════════════════════════════
// Trava o que a E3 consertou, para não voltar:
//  - TV honesta sobre o vídeo (ao vivo só com quadro novo ≤ 3 s; senão "sem vídeo há X s");
//  - acesso da TV = espectador: sem dono, sem transmitir, e a TV nunca leva o acesso do piloto;
//  - sala do dia pela data de BRASÍLIA nas duas pontas (notebook e ponte do site);
//  - escolha da câmera guardada e refeita em toda religação; teto 720p / 1 Mbps; sala renovada;
//  - biblioteca de vídeo com versão fixa e selo de integridade IGUAL nos 3 lugares (fonte: video-tv.js).
// Cada regra tem controle (o caso que TEM de dar o oposto).
// Roda com: node tests/node-smoke-tv-video.mjs   (e dentro de npm run smoke)
import { readFileSync } from 'node:fs';

let ok = 0, fail = 0;
function t(nome, cond, det = '') { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, det ? '— ' + det : ''); } }
const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
// Peça faltando ou seção que quebra = FAIL com o nome (nunca sai calada nem para as seções seguintes).
async function carregar(f) { try { return await import('../' + f); } catch (e) { t(`peça carrega: ${f}`, false, String(e.message).split('\n')[0]); return {}; } }
async function secao(nome, fn) { try { await fn(); } catch (e) { t(`seção inteira: ${nome}`, false, String(e.message).split('\n')[0]); } }
const { estadoVideo, trilhaDoCarro, proximaEspera, DAILY_JS = {}, SEM_QUADRO_MS, ESPERA_MAX_MS } = await carregar('web/command-box/video-tv.js');
const { default: ponte, dataSalaBrasilia } = await carregar('web/teste-aparelhos/api/room.js');

await secao('1) estado do bloco', () => {
const A = 1_000_000;
t('vídeo: quadro de 1 s atrás = CÂMERA AO VIVO', estadoVideo({ fase: 'sala', ultimoQuadroEm: A - 1000, agora: A }).codigo === 'ao-vivo');
t('controle: quadro de 3,1 s atrás NÃO é ao vivo (sem vídeo há 3 s)',
  (() => { const e = estadoVideo({ fase: 'sala', ultimoQuadroEm: A - SEM_QUADRO_MS - 100, agora: A }); return e.codigo === 'sem-video' && e.texto === 'SEM VÍDEO HÁ 3 s'; })());
t('vídeo: parado há 2 min = "SEM VÍDEO HÁ 2 min"', estadoVideo({ fase: 'sala', ultimoQuadroEm: A - 125000, agora: A }).texto === 'SEM VÍDEO HÁ 2 min');
t('vídeo: na sala sem imagem nunca = AGUARDANDO A CÂMERA', estadoVideo({ fase: 'sala', ultimoQuadroEm: null, agora: A }).codigo === 'aguardando');
t('vídeo: ponte fora sem imagem nunca = SEM CONEXÃO', estadoVideo({ fase: 'sem-ponte', ultimoQuadroEm: null, agora: A }).codigo === 'sem-ponte');
t('controle: ponte fora com quadro recente NÃO é ao vivo (religando)',
  (() => { const e = estadoVideo({ fase: 'sem-ponte', ultimoQuadroEm: A - 500, agora: A }); return e.codigo === 'sem-video' && /religando/.test(e.texto); })());

});

await secao('2) trilha do carro', () => {
const tr = (n) => ({ id: n });
const P = (nome, track, state = 'playable', local = false) => ({ user_name: nome, local, tracks: { video: { persistentTrack: track, state } } });
t('trilha: prefere quem entrou como Piloto', trilhaDoCarro({ local: P('Box', tr('tv'), 'playable', true), a: P('Outro', tr('x')), b: P('Piloto', tr('p')) }).id === 'p');
t('trilha: sem Piloto, qualquer remoto com vídeo', trilhaDoCarro({ a: P('', tr('x')) }).id === 'x');
t('controle: nunca a própria TV (local)', trilhaDoCarro({ local: P('Box', tr('tv'), 'playable', true) }) === null);
t('controle: vídeo desligado não conta', trilhaDoCarro({ a: P('Piloto', tr('p'), 'off') }) === null);

});

await secao('3) religação', () => {
const esperas = []; let w = 3000; for (let i = 0; i < 7; i++) { esperas.push(w); w = proximaEspera(w); }
t('religação: 3 → 6 → 12 → 24 → 48 → 60 → 60 s', esperas.join(',') === '3000,6000,12000,24000,48000,60000,60000', esperas.join(','));
t('controle: nunca passa do teto', proximaEspera(ESPERA_MAX_MS) === ESPERA_MAX_MS);

});

await secao('4) ponte do site (a mesma que vai no p1box)', async () => {
const as2330Brasilia = Date.parse('2026-10-28T02:30:00Z');   // 27/10 23h30 em Brasília
t('ponte: 23h30 de Brasília = sala do dia 27', dataSalaBrasilia(as2330Brasilia) === '2026-10-27');
t('controle: a conta antiga (UTC) daria o dia 28', new Date(as2330Brasilia).toISOString().slice(0, 10) === '2026-10-28');
t('ponte: 00h10 de Brasília já é o dia seguinte', dataSalaBrasilia(Date.parse('2026-10-28T03:10:00Z')) === '2026-10-28');
async function chamarPonte(body) {
  const pedidos = [];
  const fetchFn = async (url, o) => { pedidos.push({ url, body: JSON.parse(o.body) }); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, roomName: 'r', roomUrl: 'u', tokenPiloto: 'TP', tokenBox: 'TB' }) }; };
  const res = { h: {}, code: 0, out: null, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, send(x) { this.out = JSON.parse(x); }, json(x) { this.out = x; } };
  await ponte({ method: 'POST', body }, res, { fetchFn, agoraMs: as2330Brasilia });
  return { pedidos, res };
}
{
  const tv = await chamarPonte({ papel: 'tv' });
  t('ponte: papel tv → só o acesso de espectador (sem tokenPiloto)', tv.res.out.tokenBox === 'TB' && !('tokenPiloto' in tv.res.out), JSON.stringify(tv.res.out));
  t('ponte: pede a sala com a data de Brasília e o papel', tv.pedidos[0].body.dateISO === '2026-10-27' && tv.pedidos[0].body.papel === 'tv');
  const str = await chamarPonte(JSON.stringify({ papel: 'tv' }));
  t('ponte: corpo em texto também vale', !('tokenPiloto' in str.res.out));
  const velho = await chamarPonte(undefined);
  t('controle: sem papel = resposta antiga com os dois acessos (iPhone/notebook)', velho.res.out.tokenPiloto === 'TP' && velho.res.out.tokenBox === 'TB');
}

});

await secao('5) backend da sala (api/video/room.js) com a Daily falsa', async () => {
  process.env.DAILY_API_KEY = 'chave-falsa';
  const chamadas = [];
  globalThis.fetch = async (url, o) => {
    const body = o && o.body ? JSON.parse(o.body) : null; chamadas.push({ url, body });
    const j = url.endsWith('/rooms') ? { name: body.name, url: 'https://x.daily.co/' + body.name } : { token: body.properties.user_name === 'Box' ? 'TB' : 'TP' };
    return { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) };
  };
  const { default: room } = await import('../api/video/room.js');
  const rodar = async (body, ip) => {
    const res = { code: 0, out: null, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(x) { this.out = x; return this; }, end() {} };
    await room({ method: 'POST', headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip }, body }, res);
    return res;
  };
  const r1 = await rodar({ eventId: 'p1-teste-aparelhos', dateISO: '2026-10-27', papel: 'tv' }, '10.0.0.1');
  const tokBox = chamadas.find(c => c.body && c.body.properties && c.body.properties.user_name === 'Box');
  t('backend: acesso do Box SEM dono', r1.code === 200 && tokBox && !tokBox.body.properties.is_owner, JSON.stringify(r1.out));
  t('backend: acesso do Box sem permissão de transmitir', tokBox && tokBox.body.properties.permissions && tokBox.body.properties.permissions.canSend === false);
  t('backend: papel tv → resposta sem tokenPiloto', r1.out && r1.out.tokenBox === 'TB' && !('tokenPiloto' in r1.out));
  const tokPil = chamadas.find(c => c.body && c.body.properties && c.body.properties.user_name === 'Piloto');
  t('controle: acesso do Piloto continua podendo transmitir', tokPil && !tokPil.body.properties.permissions);
  const r2 = await rodar({ eventId: 'p1-teste-aparelhos', dateISO: '2026-10-27' }, '10.0.0.2');
  t('controle: sem papel = os dois acessos (compat)', r2.out && r2.out.tokenPiloto === 'TP' && r2.out.tokenBox === 'TB');
  const r3 = await rodar({ eventId: 'p1-teste-aparelhos', dateISO: '2026-10-27', papel: 'dono' }, '10.0.0.3');
  t('controle: papel desconhecido é recusado (400)', r3.code === 400, String(r3.code));
});

await secao('6) peças conferidas pelo texto (notebook, roteiro do Windows, TV)', () => {
const idx = ler('web/teste-aparelhos/index.html');
const pai = ler('web/teste-aparelhos/painel.html');
const tag = (h) => (h.match(/<script[^>]*daily-js[^>]*>/) || [''])[0];
for (const [nome, h] of [['notebook (index.html)', idx], ['assistidor p1tv (painel.html)', pai]]) {
  const s = tag(h);
  t(`biblioteca de vídeo: ${nome} usa a MESMA versão e selo da TV`, s.includes(DAILY_JS.src) && s.includes(`integrity="${DAILY_JS.integrity}"`), s);
}
t('controle: nenhuma página com a biblioteca SEM versão', !/daily-js"/.test(idx + pai));
const internaM = idx.match(/const CAM_INTERNA = \/(.+)\/i;/);
const CAM_INTERNA = internaM ? new RegExp(internaM[1], 'i') : null;
t('câmera: "HD Webcam C270" (USB) NÃO é tratada como interna', CAM_INTERNA && !CAM_INTERNA.test('HD Webcam C270 (046d:0825)'));
t('controle: "Integrated Camera" continua interna', CAM_INTERNA && CAM_INTERNA.test('Integrated Camera (0bda:5634)'));
t('câmera: escolha do seletor fica guardada e vale primeiro', /guardarCam\(d\)/.test(idx) && /const g = camGuardada\(\);\s*return \(g &&/.test(idx));
t('câmera: chamada nova zera a marca e fixa a escolhida de novo', /createCallObject\(\);[\s\S]{0,300}camAtualId = null;/.test(idx));
t('qualidade: teto 720p, 24 quadros, 1 Mbps numa camada', /width: \{ ideal: 1280, max: 1280 \}/.test(idx) && /maxBitrate: 1000000/.test(idx) && /await aplicarQualidade\(\);/.test(idx));
t('sala: notebook renova a cada 30 min', /RENOVAR_SALA_MS = 30 \* 60 \* 1000/.test(idx));
t('energia: página pede a tela acesa (Wake Lock)', /navigator\.wakeLock\.request\('screen'\)/.test(idx));
const ps1 = ler('windows/cockpit/servidor-video-local.ps1');
t('notebook: data da sala em Brasília (UTC-3)', /\[DateTime\]::UtcNow\.AddHours\(-3\)\.ToString\('yyyy-MM-dd'\)/.test(ps1));
t('controle: nada de relógio local na data da sala', !/\(Get-Date\)\.ToString\('yyyy-MM-dd'\)/.test(ps1));
t('notebook: servidor segura o Windows acordado', /SetThreadExecutionState\(\[uint32\]2147483651\)/.test(ps1));
t('notebook: versão 3 do servidor (troca o antigo sozinho)', /\$VERSAO = 3\b/.test(ps1));
const tv = ler('_design-reference/mockup-command-box-vista-piloto.html');
t('TV: liga o vídeo pela casa única, só no modo TV', /if \(window\.__modoTv\) \{\s*import\('\/web\/command-box\/video-tv\.js'\)/.test(tv));
t('TV: bloco com fonte própria (.tvv) não é coberto', /!el\.querySelector\(':scope > \.tvv'\)/.test(tv));
const vt = ler('web/command-box/video-tv.js');
t('TV: entra sem câmera e sem microfone', /videoSource: false, audioSource: false/.test(vt));
t('TV: pede a sala como espectador', /JSON\.stringify\(\{ papel: 'tv' \}\)/.test(vt));
t('controle: a TV não usa o acesso do piloto', !/tokenPiloto/.test(vt));
t('TV: "ao vivo" pelo quadro NOVO pintado (requestVideoFrameCallback), com a contagem de quadros de reserva', /video\.requestVideoFrameCallback\(aCada\)/.test(vt) && /totalVideoFrames/.test(vt));
t('controle: o relógio do vídeo (currentTime) não é régua de "ao vivo" — anda com a câmera travada', !/video\.currentTime/.test(vt));
});

console.log(`\ntv-video: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
