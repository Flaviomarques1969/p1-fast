// node-smoke-gps-tv.mjs — CATRACA do item 5 do GPS (Flávio 27/10/2026, painel p1fast-gps-funcoes-0850):
// TV do box com mapa ao vivo (velocidade + G), círculo de G e tempos de volta e setores.
// Casa da conta: web/command-box/cerebro/cerebro-gps-tv.js. Offline, sem rede.
// Cada regra tem um CONTROLE que tem de dar o resultado oposto.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv, SEM_DADO_MS, PANCADA_G, LUGAR_FRAC } from '../web/command-box/cerebro/cerebro-gps-tv.js';
import { criarDetectorTrocaMarcha } from '../web/command-box/cerebro/troca-marcha-g.js';
import { criarDetectorTraseira, giroEsperadoDps, APRENDER_MIN } from '../web/command-box/cerebro/traseira-giro.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra ?? ''); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const perto = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

// ── Pista de teste: círculo em volta de um centro em Brasília; fração = ângulo/2π ──
const C = { lat: -15.77, lng: -47.90 }, RAIO = 0.002;
const projetar = (lat, lng) => {
  const ang = Math.atan2(lat - C.lat, lng - C.lng);
  return { x: (lng - C.lng) * 1e5, y: (lat - C.lat) * 1e5, frac: ((ang / (2 * Math.PI)) % 1 + 1) % 1 };
};
const MARCO = { a_gps: { lat: C.lat, lng: C.lng + RAIO * 0.75 }, b_gps: { lat: C.lat, lng: C.lng + RAIO * 1.25 } };
function ponto(fr, tWall, extra = {}) {
  const ang = 2 * Math.PI * fr;
  return { lat: C.lat + RAIO * Math.sin(ang), lng: C.lng + RAIO * Math.cos(ang), kmh: 80, fix: 3, accM: 0.4,
    tWall, source: 'racebox', ...extra };
}
/** Anda `voltas` voltas a 25 Hz; cada volta dura tempos[i] s; setor k anda uniformemente na fração. */
function rodar(cerebro, tempos, { inicioFrac = 0.9, extra = () => ({}), pularEm = null } = {}) {
  let tw = 1_000_000;
  // volta de saída: de inicioFrac até a chegada (fração 1)
  for (let fr = inicioFrac; fr < 1; fr += 0.002) { tw += 40; cerebro.feedGps(ponto(fr, tw, extra(tw, fr, 0))); }
  for (let v = 0; v < tempos.length; v++) {
    const n = Math.round(tempos[v] * 25);
    for (let i = 1; i <= n; i++) {
      const fr = (i / n) % 1;
      tw += 40;
      if (pularEm != null && v === pularEm.volta && fr > pularEm.de && fr < pularEm.ate) continue;
      cerebro.feedGps(ponto(fr + 1e-6, tw, extra(tw, fr, v + 1)));
    }
  }
  // um pouco além da chegada
  for (let i = 1; i <= 25; i++) { tw += 40; cerebro.feedGps(ponto(i / 2000, tw, extra(tw, i / 2000, tempos.length + 1))); }
  return tw;
}

// 1) Voltas e setores
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 58, 61]);
  const s = c.snapshot();
  t('3 voltas fechadas (volta de saída não conta)', s.voltas.length === 3, s.voltas.length);
  t('tempo da volta bate (±0,08 s)', s.voltas.every((v, i) => perto(v.tempoS, [60, 58, 61][i], 0.08)), JSON.stringify(s.voltas.map(v => v.tempoS)));
  t('3 setores por volta, cada ~1/3 (±0,1 s)', s.voltas.every((v, i) => v.setoresS && v.setoresS.length === 3
    && v.setoresS.every(x => perto(x, [60, 58, 61][i] / 3, 0.1))), JSON.stringify(s.voltas.map(v => v.setoresS)));
  t('soma dos setores = tempo da volta (exato)', s.voltas.every(v => v.setoresS && perto(v.setoresS.reduce((a, b) => a + b, 0), v.tempoS, 0.002)));
  t('melhor volta = a 2ª (58 s)', s.melhorVolta && s.melhorVolta.n === 2);
  t('delta da última contra a melhor = +3 s', perto(s.deltaUltimaS, 3, 0.1), s.deltaUltimaS);
  t('volta ideal = soma dos melhores setores (≈58 s)', perto(s.voltaIdealS, 58, 0.15), s.voltaIdealS);
  t('volta em curso: nº 4, setor 1', s.voltaAtual && s.voltaAtual.n === 4 && s.voltaAtual.setorAtual === 1);
  t('mapa: rastro da última volta tem pontos com x/y/kmh', s.mapa.ultima.length > 50 && s.mapa.ultima.every(p => p.x != null && p.kmh === 80));
}
// controle: sentido trocado → voltas contam, setores NÃO (linha nunca é cruzada "para a frente")
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar, sentido: -1 });
  rodar(c, [60, 58]);
  const s = c.snapshot();
  t('controle: sentido trocado → voltas contam e setores ficam vazios', s.voltas.length === 2 && s.voltas.every(v => v.setoresS === null));
}
// buraco no GPS que pula a linha do setor 2 → a volta fica sem setores (não inventa)
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 60], { pularEm: { volta: 0, de: 0.62, ate: 0.72 } });
  const s = c.snapshot();
  t('salto de projeção sobre a linha do setor → setores null só naquela volta',
    s.voltas[0].setoresS === null && Array.isArray(s.voltas[1].setoresS), JSON.stringify(s.voltas.map(v => v.setoresS)));
}
// portas de qualidade
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  t('iPhone descartado', c.feedGps(ponto(0.5, 10, { source: 'iphone-gps' })) === false);
  t('fix 2D descartado', c.feedGps(ponto(0.5, 11, { fix: 2 })) === false);
  t('precisão ≥ 50 m descartada', c.feedGps(ponto(0.5, 12, { accM: 50 })) === false);
  t('controle: ponto bom entra', c.feedGps(ponto(0.5, 13)) === true);
  t('repetido/fora de ordem descartado (fila reenviada)', c.feedGps(ponto(0.5, 13)) === false && c.feedGps(ponto(0.5, 5)) === false);
  t('aceita "lon" (formato da gravação)', (() => { const p = ponto(0.5, 20); p.lon = p.lng; delete p.lng; return c.feedGps(p); })());
  t('fresco até 2,5 s sem ponto; depois não', c.snapshot(20 + SEM_DADO_MS).fresco === true && c.snapshot(21 + SEM_DADO_MS).fresco === false);
}

// 2) Círculo de G e cor do mapa
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  // G do notebook: freando forte na 1ª metade de cada volta, curva à esquerda na 2ª
  const extra = (tw) => {
    const fase = Math.floor((tw - 1_000_000) / 40) % 1500;
    return fase < 400 ? { gLong: -0.8, gLat: 0.1, zeroOk: true }
      : fase < 800 ? { gLong: 0.3, gLat: 0.0, zeroOk: true }
      : { gLong: 0.0, gLat: -1.1, zeroOk: true };
  };
  rodar(c, [60, 60], { extra });
  const s = c.snapshot();
  const p = s.voltas[0].picosG;
  t('picos da volta: freio −0,8 / aceleração +0,3 / lateral −1,1', p && perto(p.freioMax, -0.8, 1e-9) && perto(p.acelMax, 0.3, 1e-9) && perto(p.latMax, -1.1, 1e-9), JSON.stringify(p));
  t('G combinado máximo = 1,1 (curva) e não 0,81 (freio)', perto(p.combinadoMax, 1.1, 1e-9), p.combinadoMax);
  t('rastro do círculo = só os últimos 3 s (≤ 76 pontos a 25 Hz)', s.circuloG.rastro.length > 60 && s.circuloG.rastro.length <= 76, s.circuloG.rastro.length);
  t('nuvem da volta a 10 Hz (~600 pontos numa volta de 60 s)', s.circuloG.ultima.length >= 590 && s.circuloG.ultima.length <= 610, s.circuloG.ultima.length);
  const fases = new Set(s.mapa.ultima.map(q => q.fase));
  t('mapa colore freio / aceleração / embalo pelo G do carro', fases.has('freio') && fases.has('acel') && fases.has('embalo'), [...fases].join(','));
}
// controle: G sem zero do box → mostra o ponto vivo, mas não soma pico nem colore o mapa
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60], { extra: () => ({ gLong: -0.9, gLat: 0.2, zeroOk: false }) });
  const s = c.snapshot();
  t('controle: sem zero do box → sem picos e sem cor de fase', s.voltas[0].picosG === null && s.mapa.ultima.every(q => q.fase === null));
  t('controle: sem zero do box → ponto vivo aparece marcado zeroOk=false', s.circuloG.vivo && s.circuloG.vivo.zeroOk === false);
}
// controle: gravação sem G (Cockpit antigo) → círculo vazio, voltas continuam
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60]);
  const s = c.snapshot();
  t('controle: sem gLong/gLat → círculo vazio e volta contada', s.circuloG.vivo === null && s.circuloG.rastro.length === 0 && s.voltas.length === 1);
}

// 3) Sessão REAL de pista (21/06, RaceBox 25 Hz, sem G) com a geometria real de Brasília
{
  const j = JSON.parse(ler('web/command-box/fixtures/replay-hoje-2026-06-21.json'));
  const m = JSON.parse(ler('web/command-box/fixtures/replay-hoje-mapa.json'));
  const c = criarCerebroGpsTv();
  for (const a of j.amostras) if (a.tipo === 'gps') c.feedGps(a);
  const s = c.snapshot();
  t('real 21/06: 2 voltas, como o recorte gravado do mapa', s.voltas.length === m.voltas.length, s.voltas.length);
  t('real 21/06: tempos batem com o recorte (±0,1 s)', s.voltas.every((v, i) => perto(v.tempoS, m.voltas[i].lapSec, 0.1)),
    JSON.stringify(s.voltas.map(v => v.tempoS)) + ' × ' + JSON.stringify(m.voltas.map(v => v.lapSec)));
  t('real 21/06: as 2 voltas têm os 3 setores e somam a volta', s.voltas.every(v => v.setoresS && v.setoresS.length === 3
    && perto(v.setoresS.reduce((a, b) => a + b, 0), v.tempoS, 0.002)), JSON.stringify(s.voltas.map(v => v.setoresS)));
  t('real 21/06: rastro do mapa no espaço do desenho (viewBox 130..710 × 110..770)',
    s.mapa.ultima.length > 300 && s.mapa.ultima.every(p => p.x > 100 && p.x < 740 && p.y > 80 && p.y < 800), s.mapa.ultima.length);
}

// 3b) Item 7 — pancadas (gVert) e consistência das voltas
{
  // pancada de 0,6 G em 0,500–0,510 nas voltas 1 e 2 (mesmo lugar); na volta 3, uma em 0,200 (lugar só dela)
  const bate = (fr, v) => (v === 1 || v === 2) && fr > 0.500 && fr < 0.510 ? 0.3 + 30 * Math.min(fr - 0.500, 0.510 - fr)
    : (v === 3 && fr > 0.200 && fr < 0.204 ? -0.4 : 0.02);
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 58, 61], { extra: (tw, fr, v) => ({ gVert: bate(fr, v) }) });
  const s = c.snapshot();
  t('item 7: 1 pancada por volta (grupo acima do limite conta 1 vez)', s.voltas.map(v => v.pancadas).join() === '1,1,1',
    JSON.stringify(s.voltas.map(v => v.pancadas)));
  const picoEsperado = 0.3 + 30 * 0.005;   // pico da rampa no meio do trecho
  t('item 7: pancada vale o PICO do grupo, com sinal', perto(s.voltas[0].pancadaMaxG, picoEsperado, 0.02) && s.voltas[2].pancadaMaxG === -0.4,
    JSON.stringify(s.voltas.map(v => v.pancadaMaxG)));
  const L = s.pancadas.lugaresRepetidos;
  t('item 7: lugar repetido = o de 0,505 nas voltas 1 e 2 (o da volta 3 sozinho não entra)',
    L.length === 1 && L[0].voltas.join() === '1,2' && perto(L[0].frac, 0.505, LUGAR_FRAC), JSON.stringify(L));
  t('item 7: pancadas da última volta no mapa (x/y/g)', s.pancadas.ultima.length === 1 && s.pancadas.ultima[0].x != null);
  // consistência: esperado DERIVADO das voltas que o próprio cérebro fechou
  const ts = s.voltas.map(v => v.tempoS), m = ts.reduce((a, b) => a + b, 0) / ts.length;
  const dp = Math.sqrt(ts.reduce((a, b) => a + (b - m) ** 2, 0) / ts.length);
  const fora = s.voltas.reduce((a, v) => (Math.abs(v.tempoS - m) > Math.abs(a.tempoS - m) ? v : a));
  const k = s.consistencia;
  t('item 7: consistência = média, desvio e amplitude das voltas fechadas',
    k && k.nVoltas === 3 && perto(k.mediaS, m, 0.001) && perto(k.desvioS, dp, 0.001)
      && perto(k.amplitudeS, Math.max(...ts) - Math.min(...ts), 0.001), JSON.stringify(k));
  t('item 7: volta mais longe da média e desvio por setor', k && k.voltaMaisFora.n === fora.n
    && perto(k.voltaMaisFora.difS, fora.tempoS - m, 0.001) && k.desvioSetoresS.length === 3 && k.desvioSetoresS.every(x => x != null));
}
// controles do item 7: G vertical abaixo do limite / sem gVert → 0 pancadas; 2 batidas separadas → 2; 1 volta → sem consistência
{
  const c0 = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c0, [60, 58], { extra: () => ({ gVert: PANCADA_G - 0.001 }) });
  const c1 = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c1, [60, 58]);
  const c2 = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c2, [60], { extra: (tw, fr, v) => ({ gVert: v === 1 && ((fr > 0.3 && fr < 0.31) || (fr > 0.32 && fr < 0.33)) ? 0.5 : 0 }) });
  t('controle item 7: abaixo do limite e sem gVert = 0 pancadas', c0.snapshot().pancadas.total === 0 && c1.snapshot().pancadas.total === 0);
  t('controle item 7: 2 batidas separadas = 2 pancadas', c2.snapshot().voltas[0].pancadas === 2, c2.snapshot().voltas[0].pancadas);
  t('controle item 7: 1 volta fechada = sem consistência (null)', c2.snapshot().consistencia === null);
  const fonte = ler('web/command-box/cerebro/cerebro-gps-tv.js').replace(/\/\/.*$/gm, '');
  t('item 7: sem regra de corte inventada (107%) no cérebro', !/1\.07|107/.test(fonte));
}
// 3c) Item 7 na gravação REAL de 27/10 (rua, 7.345 leituras; recorte só de gz/km/h): o cérebro conta as
// MESMAS pancadas que a régua independente da análise (capacidade.py: borda de subida de |gz−1| > 0,15).
{
  const r = JSON.parse(ler('web/command-box/fixtures/gz-rua-2026-10-27.json'));
  let esperado = 0;
  for (let i = 1; i < r.gz.length; i++) if (Math.abs(r.gz[i] - 1) > PANCADA_G && Math.abs(r.gz[i - 1] - 1) <= PANCADA_G) esperado++;
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  r.gz.forEach((gz, i) => c.feedGps(ponto(0.25, 1_000_000 + i * 40, { kmh: r.kmh[i], gVert: gz - 1 })));
  const s = c.snapshot();
  t('real 27/10: pancadas do cérebro = régua da análise', r.gz.length === r._meta.n && esperado > 0 && s.pancadas.total === esperado,
    s.pancadas.total + ' × ' + esperado);
  const sem = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  r.gz.forEach((gz, i) => sem.feedGps(ponto(0.25, 1_000_000 + i * 40, { kmh: r.kmh[i] })));
  t('controle real 27/10: mesma gravação sem gVert = 0 pancadas', sem.snapshot().pancadas.total === 0);
}

// 3d) Item 8 — troca de marcha pelo G (provável). Régua = capacidade2.py da análise de 27/10, copiada
// em LOTE aqui (zero = média do gx parado; G curto = média de 3; mesma busca); o detector em FLUXO
// da casa troca-marcha-g.js tem de achar as MESMAS trocas. Análise em Python deu: 2 trocas,
// 163,4 s/33 km/h e 235,2 s/26 km/h (".claude-exec/analise-gps-20261027/capacidade2.txt").
{
  const r = JSON.parse(ler('web/command-box/fixtures/gz-rua-2026-10-27.json'));
  const n = r.gx.length;
  const parado = r.kmh.map((v, i) => (v < 0.5 ? i : -1)).filter(i => i >= 0);
  const z0 = parado.reduce((s, i) => s + r.gx[i], 0) / parado.length;
  const gx = r.gx.map(v => v - z0);
  const med1 = (i) => { const sl = gx.slice(Math.max(0, i - 1), i + 2); return sl.reduce((a, b) => a + b, 0) / sl.length; };
  const gl1 = gx.map((_, i) => med1(i));
  const lote = [];
  for (let i = 10; i < n - 25;) {
    const antes = gl1.slice(i - 8, i).reduce((a, b) => a + b, 0) / 8;
    if (antes > 0.08 && r.kmh[i] > 12 && gl1[i] < antes * 0.35) {
      let k = null;
      for (let j = i + 1; j < Math.min(n, i + 20); j++) if (gl1[j] > antes * 0.6) { k = j; break; }
      if (k && (r.t[k] - r.t[i]) / 1000 >= 0.12 && (r.t[k] - r.t[i]) / 1000 <= 0.8) { lote.push({ t: r.t[i], kmh: r.kmh[i] }); i = k + 10; continue; }
    }
    i++;
  }
  t('real 27/10 (régua em lote): 2 trocas em 163,4 s/33 km/h e 235,2 s/26 km/h, igual à análise em Python',
    r.t.length === n && r.kmh.length === n && lote.length === 2
    && perto(lote[0].t / 1000, 163.4, 0.05) && Math.round(lote[0].kmh) === 33
    && perto(lote[1].t / 1000, 235.2, 0.05) && Math.round(lote[1].kmh) === 26, JSON.stringify(lote));
  const det = criarDetectorTrocaMarcha();
  const fluxo = [];
  for (let i = 0; i < n; i++) fluxo.push(...det.ler({ t: r.t[i], gLong: gx[i], kmh: r.kmh[i] }));
  t('real 27/10: detector em fluxo = régua em lote (mesmos instantes)', fluxo.length === lote.length
    && fluxo.every((f, i) => f.t === lote[i].t && f.provavel === true), JSON.stringify(fluxo));
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  for (let i = 0; i < n; i++) c.feedGps(ponto(0.25, 1_000_000 + r.t[i], { kmh: r.kmh[i], gLong: gx[i], gLat: 0, zeroOk: true }));
  const sc = c.snapshot();
  t('real 27/10: cérebro da TV conta as 2 trocas, marcadas "provável"', sc.trocas.total === 2 && sc.trocas.provavel === true
    && sc.trocas.volta.length === 2 && sc.trocas.volta.every(x => x.buracoS >= 0.12 && x.buracoS <= 0.8), JSON.stringify(sc.trocas));
  const sz = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  for (let i = 0; i < n; i++) sz.feedGps(ponto(0.25, 1_000_000 + r.t[i], { kmh: r.kmh[i], gLong: gx[i], gLat: 0, zeroOk: false }));
  t('controle real 27/10: mesmo G sem zero do box = 0 trocas', sz.snapshot().trocas.total === 0);
}
// sintético: G 0,20 constante a 80 km/h com um buraco de G ≈0 de `dur` s → só o buraco de 0,12–0,8 s conta
{
  const buraco = (dur, gBuraco = 0) => {
    const d = criarDetectorTrocaMarcha(); const out = [];
    for (let i = 0; i < 200; i++) { const ts = i * 40; const g = ts >= 3000 && ts < 3000 + dur * 1000 ? gBuraco : 0.2;
      out.push(...d.ler({ t: ts, gLong: g, kmh: 80 })); }
    return out;
  };
  t('buraco de 0,3 s = 1 troca', buraco(0.3).length === 1, JSON.stringify(buraco(0.3)));
  t('controle: buraco de 1,2 s (embalo, não troca) = 0', buraco(1.2).length === 0);
  t('controle: buraco de 0,08 s (ruído) = 0', buraco(0.08).length === 0);
  t('controle: G que só cai para 60% (sem buraco) = 0', buraco(0.3, 0.12).length === 0);
  const parado = criarDetectorTrocaMarcha(); let np = 0;
  for (let i = 0; i < 200; i++) { const ts = i * 40; np += parado.ler({ t: ts, gLong: ts >= 3000 && ts < 3300 ? 0 : 0.2, kmh: 8 }).length; }
  t('controle: mesmo buraco a 8 km/h (abaixo de 12) = 0', np === 0);
  // a 10 Hz (RaceBox caindo de taxa) 1,2 s cabe nas 20 leituras da busca: quem barra a borda é o teto de
  // 0,8 s. LIMITE do critério da análise (copiado fiel): a cauda do buraco longo ainda passa com 0,7 s.
  const d10 = criarDetectorTrocaMarcha(); const a10 = [];
  const d10b = criarDetectorTrocaMarcha(); let n10ok = 0;
  for (let i = 0; i < 120; i++) { const ts = i * 100;
    a10.push(...d10.ler({ t: ts, gLong: ts >= 3000 && ts < 4200 ? 0 : 0.2, kmh: 80 }));
    n10ok += d10b.ler({ t: ts, gLong: ts >= 3000 && ts < 3400 ? 0 : 0.2, kmh: 80 }).length; }
  t('controle: a 10 Hz, nenhuma troca aceita passa de 0,8 s (borda do buraco de 1,2 s recusada); buraco de 0,4 s = 1',
    a10.length <= 1 && a10.every(x => x.buracoS <= 0.8 && x.t > 3000) && n10ok === 1, JSON.stringify(a10) + ' / ' + n10ok);
  // leitura sem G no meio (zero do box perdido) zera o histórico: o G de ANTES do vão não vale para depois
  const dv = criarDetectorTrocaMarcha(); let nv = 0;
  for (let i = 0; i < 200; i++) { const ts = i * 40;
    const g = ts < 2000 ? 0.2 : ts < 3000 ? null : ts < 3300 ? 0 : 0.2;
    nv += dv.ler({ t: ts, gLong: g, kmh: 80 }).length; }
  t('controle: vão sem G seguido de G baixo não vira troca (histórico zerado)', nv === 0, nv);
}
// troca logo antes da chegada: o detector confirma ~1 s depois, com a volta já fechada → conta na volta da queda
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 60, 60], { extra: (tw, fr, v) => ({ gLong: v === 2 && fr > 0.99 && fr < 0.995 ? 0 : 0.2, gLat: 0, zeroOk: true }) });
  const s = c.snapshot();
  t('troca que confirma depois da chegada conta na volta 2 (e só nela)', s.voltas.length === 3
    && s.voltas[0].trocas === 0 && s.voltas[1].trocas === 1 && s.voltas[2].trocas === 0
    && s.voltas[1].trocaBuracoMedioS >= 0.12 && s.voltas[1].trocaBuracoMedioS <= 0.8 && s.trocas.total === 1,
    JSON.stringify(s.voltas.map(v => [v.trocas, v.trocaBuracoMedioS])));
  t('mapa da última volta fechada (a 3) não herda a troca da volta 2', s.trocas.ultima.length === 0);
}

// 3e) Item 9 — traseira saiu pelo giro (provável). Curva firme a 80 km/h com G lateral 0,8: o giro que a
// curva explica é gLat×g÷v ≈ 20 °/s. Aparelho montado "de cabeça para baixo" (giro com sinal −1): o
// detector tem de APRENDER o sinal e só julgar depois. Saída = giro 60% acima do esperado (≈ +12 °/s).
{
  const ESP = giroEsperadoDps(0.8, 80);
  t('física: giro esperado a 80 km/h com 0,8 G ≈ 20,2 °/s', perto(ESP, 20.2, 0.1), ESP);
  // anda `ms` de curva a 25 Hz; `giro(ts)` devolve o fator sobre o esperado (1 = curva limpa) ou null (sem giro)
  const curva = ({ ms = 8000, montagem = -1, kmh = () => 80, gLat = 0.8, giro = () => 1 } = {}) => {
    const d = criarDetectorTraseira(); const out = [];
    for (let ts = 0; ts < ms; ts += 40) {
      const f = giro(ts); const k = kmh(ts); const gl = typeof gLat === 'function' ? gLat(ts) : gLat;
      out.push(...d.ler({ t: ts, giroZ: f == null ? null : montagem * f * giroEsperadoDps(gl, k), gLat: gl, kmh: k }));
    }
    return { d, out };
  };
  const janela = (de, dur, fator = 1.6) => (ts) => (ts >= de && ts < de + dur ? fator : 1);
  const est = curva();
  t('sinal do giro aprendido = −1 (aparelho invertido) depois de 2 s de curva', est.d.sinal() === -1 && est.d.aprendido() >= APRENDER_MIN, est.d.sinal());
  t('curva estável de 8 s = 0 saídas', est.out.length === 0, JSON.stringify(est.out));
  const s04 = curva({ giro: janela(5000, 400) }).out;
  t('saída de 0,4 s com giro 60% acima = 1, "provável", excesso ≈ 12 °/s',
    s04.length === 1 && s04[0].provavel === true && s04[0].t === 5000 && s04[0].duracaoMs >= 320 && s04[0].duracaoMs <= 400
    && perto(s04[0].excessoDps, 0.6 * ESP, 0.2), JSON.stringify(s04));
  t('montagem normal (sinal +1) acha a mesma saída', curva({ montagem: 1, giro: janela(5000, 400) }).out.length === 1);
  t('controle: a mesma saída ANTES de aprender o sinal (1 s de curva) = 0', curva({ giro: janela(1000, 400) }).out.length === 0);
  t('controle: saída de 0,12 s (ruído) = 0', curva({ giro: janela(5000, 120) }).out.length === 0);
  // folga de 30%: curva fechada a 40 km/h com 1,2 G (≈ 61 °/s esperado) — 20% acima já passa de 5 °/s
  t('controle: giro só 20% acima (≈ +12 °/s, dentro da folga de 30%) = 0; 40% acima = 1',
    curva({ kmh: () => 40, gLat: 1.2, giro: janela(5000, 400, 1.2) }).out.length === 0
    && curva({ kmh: () => 40, gLat: 1.2, giro: janela(5000, 400, 1.4) }).out.length === 1);
  t('controle: a mesma saída a 20 km/h (abaixo de 30) = 0',
    curva({ kmh: (ts) => (ts >= 4500 && ts < 6000 ? 20 : 80), giro: janela(5000, 400) }).out.length === 0);
  // depois de aprender a 0,8 G, o G lateral cai na janela da saída
  const gCai = (gl) => (ts) => (ts >= 4500 && ts < 6000 ? gl : 0.8);
  t('controle: curva leve (0,25 G → 6 °/s esperado) com 60% acima = 0 (excesso < 5 °/s); com 2× = 1',
    curva({ gLat: gCai(0.25), giro: janela(5000, 400) }).out.length === 0
    && curva({ gLat: gCai(0.25), giro: janela(5000, 400, 2) }).out.length === 1);
  t('controle: quase reta (0,15 G, abaixo de 0,2) com giro 4× = 0; a 0,25 G com 4× = 1',
    curva({ gLat: gCai(0.15), giro: janela(5000, 400, 4) }).out.length === 0
    && curva({ gLat: gCai(0.25), giro: janela(5000, 400, 4) }).out.length === 1);
  t('controle: giro no sentido OPOSTO à curva = 0', curva({ giro: janela(5000, 400, -1.6) }).out.length === 0);
  const semGiro = curva({ giro: () => null });
  t('controle: sem giro = 0 saídas e sinal não aprendido', semGiro.out.length === 0 && semGiro.d.sinal() === 0);
  t('controle: vão sem giro no meio não emenda duas metades curtas (0,16 s + 0,16 s = 0)',
    curva({ giro: (ts) => (ts >= 5160 && ts < 5240 ? null : janela(5000, 400)(ts)) }).out.length === 0);
}
// cérebro da TV: saída que começa antes da chegada e só fecha depois conta na volta em que COMEÇOU
{
  const gl = 0.8, giro = (fator) => -fator * giroEsperadoDps(gl, 80);
  const saida = (v, fr) => (v === 2 && fr > 0.99) || (v === 3 && fr < 0.003);
  const montar = (extra) => { const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar }); rodar(c, [60, 60, 60], { extra }); return c.snapshot(); };
  const s = montar((tw, fr, v) => ({ gLat: gl, gLong: 0, zeroOk: true, giroZ: giro(saida(v, fr) ? 1.6 : 1) }));
  t('cérebro: traseira atravessando a chegada conta na volta 2 (e só nela)', s.voltas.length === 3
    && s.voltas.map(v => v.traseira).join() === '0,1,0' && perto(s.voltas[1].traseiraMaxDps, 0.6 * giroEsperadoDps(gl, 80), 0.3)
    && s.traseira.total === 1, JSON.stringify(s.voltas.map(v => [v.traseira, v.traseiraMaxDps])));
  t('cérebro: pacote marca "provável", "a conferir", tem giro e sinal aprendido',
    s.traseira.provavel === true && s.traseira.aConferir === true && s.traseira.temGiro === true && s.traseira.sinalAprendido === true);
  t('cérebro: mapa da última volta fechada (a 3) não herda a saída da volta 2', s.traseira.ultima.length === 0);
  const sz = montar((tw, fr, v) => ({ gLat: gl, gLong: 0, zeroOk: false, giroZ: giro(saida(v, fr) ? 1.6 : 1) }));
  t('controle cérebro: mesmo giro sem zero do box = 0 saídas', sz.traseira.total === 0 && sz.voltas.every(v => v.traseira === 0));
  const sg = montar(() => ({ gLat: gl, gLong: 0, zeroOk: true }));
  t('controle cérebro: gravação sem giroZ (como a de 27/10) = temGiro falso e 0 saídas',
    sg.traseira.temGiro === false && sg.traseira.total === 0);
}

// 4) Ligações na fonte (quem desligar reprova aqui)
const live = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const dic = (live.match(/_liveCloudGps\.Enqueue\(new Dictionary[\s\S]{0,1800}?\}\);/) || [''])[0];
t('Cockpit: canal leva gLong/gLat/zeroOk', /\["gLong"\]/.test(dic) && /\["gLat"\]/.test(dic) && /\["zeroOk"\]/.test(dic));
t('Cockpit (item 7): canal e .jsonl levam gVert da MESMA peça (Converter com f.GZ)',
  /\["gVert"\]\s*=\s*gVert/.test(dic) && /_gpsFiltro\.Acel\.Converter\(f\.GX, f\.GY, f\.GZ\)/.test(live)
  && /_liveRecorder\?\.Gps\([\s\S]{0,600}?gVert[,\s][\s\S]{0,300}?\}/.test(live));
t('Cockpit: G do canal sai da MESMA peça do cérebro (Acel.Converter), sem aprender de novo',
  /_gpsFiltro\.Acel\.Converter\(f\.GX, f\.GY(, f\.GZ)?\)/.test(live) && !/_gpsFiltro\.Acel\.Ler\(/.test(live));
const contrato = ler('docs/CONTRATO_DADOS.md');
t('contrato: gLong/gLat/zeroOk registrados e casa do cérebro da TV listada',
  /gLong/.test(contrato) && /zeroOk/.test(contrato) && /cerebro-gps-tv\.js/.test(contrato));
t('contrato (item 7): gVert registrado', /gVert/.test(contrato));
t('Cockpit (item 9): canal e .jsonl levam giroZ do RaceBox; leitor BLE repassa d.GiroZ',
  /\["giroZ"\]\s*=\s*f\.GiroZ/.test(dic) && /_liveRecorder\?\.Gps\([\s\S]{0,900}?giroZ\s*=\s*f\.GiroZ[\s\S]{0,100}?\}/.test(live)
  && /tWalls\[k\], d\.RawHex, d\.GiroZ\)/.test(ler('windows/cockpit/P1Fast.Cockpit.UI/RaceBoxBleReader.cs')));
t('contrato (item 9): giroZ registrado e casa da traseira listada', /giroZ/.test(contrato) && /traseira-giro\.js/.test(contrato));
const tela = ler('_design-reference/mockup-command-box-vista-piloto.html');
const camada = (tela.match(/<!-- TV-GPS item 5[\s\S]*?<\/script>/) || [''])[0];
t('TV: Vista Piloto carrega o cérebro da TV pela ponte única', /cerebro-gps-tv\.js/.test(camada) && /cloud-bridge\.js/.test(camada));
t('TV (item 7): camada desenha pancadas, lugares repetidos e consistência do pacote',
  /s\.pancadas/.test(camada) && /lugaresRepetidos/.test(camada) && /s\.consistencia/.test(camada)
  // chamadas DENTRO do quadro da TV (definir a função sem chamar não desenha nada)
  && /function quadro\(\)[\s\S]*?desenharPancadas\(ui\.pancadas, s\.pancadas\);[\s\S]*?desenharConsistencia\(ui, s\);[\s\S]*?\n  \}/.test(camada));
t('TV (item 7): camada não conta pancada nem consistência (sem PANCADA_G/desvio na tela)',
  !/PANCADA_G|gVert\s*[<>]|Math\.sqrt/.test(camada));
t('TV (item 8): camada desenha as trocas do pacote, dentro do quadro, marcadas "provável"',
  /s\.trocas/.test(camada) && /trocas \(provável\)/.test(camada)
  && /function quadro\(\)[\s\S]*?desenharTrocas\(ui\.trocas, s\.trocas\);[\s\S]*?\n  \}/.test(camada));
t('TV (item 8): camada não procura troca (sem detector, BURACO ou QUEDA na tela)',
  !/criarDetectorTrocaMarcha|troca-marcha-g|BURACO_|QUEDA_FRAC/.test(camada));
t('contrato (item 8): casa da troca de marcha registrada', /troca-marcha-g\.js/.test(contrato));
t('TV (item 9): camada desenha a traseira do pacote, dentro do quadro, só com giro, marcada "provável · giro a conferir"',
  /s\.traseira/.test(camada) && /if\(ts && ts\.temGiro\) l\.push\('traseira \(provável · giro a conferir\)/.test(camada)
  && /el\.innerHTML = !ts \|\| !ts\.temGiro \?/.test(camada)
  && /function quadro\(\)[\s\S]*?desenharTraseira\(ui\.traseira, s\.traseira\);[\s\S]*?\n  \}/.test(camada));
t('TV (item 9): camada não julga giro (sem detector, EXCESSO_ ou giro esperado na tela)',
  !/criarDetectorTraseira|traseira-giro|EXCESSO_|giroEsperado|giroZ/.test(camada));
t('TV: a camada só exibe (não projeta GPS nem refaz G/volta)',
  camada.length > 0 && !/geoParaCommandBox|fracDe\(|criarDetectorChegada|Math\.hypot|createClient/.test(camada));

console.log(`\ngps-tv: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
