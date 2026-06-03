// Análise das 4 voltas de hoje pelo Instrutor Sênior
// ────────────────────────────────────────────────────
// Gera HTML com:
//   - Estratégia ideal de cada curva (deduzida da geometria)
//   - Análise da execução do piloto em cada passagem
//   - Conselho de instrutor por passagem
//   - Linha verde do GPS de fundo

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Detector } from '../../src/telemetry/detector.js';
import { projectToViewBox } from '../../src/telemetry/projector.js';
import { buildLookup, snap } from '../../src/telemetry/path-mapper.js';
import { calcularGeometria } from '../../src/domain/curva-geometria.js';
import { estrategiaIdeal } from '../../src/domain/apice-estrategia.js';
import { analisarPassagem } from '../../src/domain/instrutor-senior.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), speed: Number(kmh) / 3.6 };
});

// Lookup pra calcular metrosPorUnidade (pista 5476m / totalLength em unidades viewBox)
const lookup = buildLookup(svgPath, 4000);
const metrosPorUnidade = mapa.pista.extensao_metros / lookup.totalLength;

// Trechos pedagógicos + geometria + estratégia
const trechosPed = mapa.trechos.filter(t => t.eh_trecho_pedagogico && t.entradas?.length && t.saidas?.length);

function pctOf(point) {
  delete lookup._lastIdx;
  const r = snap(lookup, point.x, point.y);
  return (r.offset / lookup.totalLength) * 100;
}

const segments = trechosPed.map(t => ({
  id: t.id, nome: t.nome,
  parcialId: t.parcial,
  pathStart: pctOf(t.entradas[0]),
  pathEnd: pctOf(t.saidas[0]),
})).filter(s => s.pathStart < s.pathEnd);

// Geometria + estratégia ideal pra cada trecho
const analisePorTrecho = new Map();
for (const t of trechosPed) {
  const geo = calcularGeometria({ svgPath, trechos: trechosPed, trecho: t, metrosPorUnidade });
  const est = geo ? estrategiaIdeal(geo) : null;
  analisePorTrecho.set(t.id, { trecho: t, geometria: geo, estrategia: est, passagens: [] });
}

// Detector → execuções
const detector = new Detector({ svgPath, linhaChegada: mapa.pista.linha_chegada, segments });
const segmentEnds = [];
const postBursts = [];
detector.onSegmentEnd(e => segmentEnds.push(e));
detector.onSegmentPostBurst(p => postBursts.push(p));
const track = { geoAncoras: mapa.pista.ancoras_geo.map(a => ({ lat: a.latitude, lng: a.longitude, x: a.x, y: a.y })) };
for (const s of samples) {
  const proj = projectToViewBox(s, track);
  if (!proj) continue;
  detector.consume({ x: proj.x, y: proj.y, t: s.t, speed: s.speed });
}
console.error(`Detector emitiu ${segmentEnds.length} passagens em ${analisePorTrecho.size} trechos`);

// Pareia postBurst com segmentEnd e roda analisarPassagem
function pareiaPB(ev) {
  return postBursts.find(pb => pb.segmentId === ev.segmentId && Math.abs(pb.tSaidaPico - ev.saidaAt) < 5000) || null;
}
let lapCount = 0, lastT = 0;
const passagensPorTrecho = new Map();
for (const ev of segmentEnds.sort((a, b) => a.entradaAt - b.entradaAt)) {
  if (ev.segmentId === 'seg_brasilia_0' || (lastT > 0 && ev.entradaAt - lastT > 60000)) lapCount++;
  lastT = ev.entradaAt;
  const dados = analisePorTrecho.get(ev.segmentId);
  if (!dados || !dados.geometria || !dados.estrategia) continue;
  const pb = pareiaPB(ev);
  const indicadores = {
    vChegadaKmh:   ev.vChegada    != null ? ev.vChegada    * 3.6 : null,
    vEntradaKmh:   ev.velEntrada  != null ? ev.velEntrada  * 3.6 : null,
    vFreadaKmh:    ev.vFreada     != null ? ev.vFreada     * 3.6 : null,
    vminKmh:       ev.velMinima   != null ? ev.velMinima   * 3.6 : null,
    vPaceKmh:      ev.velSaida    != null ? ev.velSaida    * 3.6 : null,
    vSaidaPicoKmh: pb?.vSaidaPico != null ? pb.vSaidaPico  * 3.6 : null,
  };
  // Acumula passagens pro trecho
  if (!passagensPorTrecho.has(ev.segmentId)) passagensPorTrecho.set(ev.segmentId, []);
  passagensPorTrecho.get(ev.segmentId).push({
    volta: lapCount, ev, indicadores, apiceExecutado: ev.apexActual,
  });
}

// Pra cada trecho, pega a MELHOR passagem (menor tempoMs) e roda analisarPassagem
const resultado = [];
for (const [segId, passagens] of passagensPorTrecho) {
  const dados = analisePorTrecho.get(segId);
  if (!dados) continue;
  const melhor = passagens.slice().sort((a, b) => a.ev.tempoMs - b.ev.tempoMs)[0];
  const analisesPorPassagem = passagens.map(p => analisarPassagem({
    trecho: dados.trecho,
    geometria: dados.geometria,
    estrategia: dados.estrategia,
    apiceExecutado: p.apiceExecutado || { x: 0, y: 0 },
    indicadores: p.indicadores,
    melhorPassagem: p === melhor ? null : melhor.indicadores,
  }));
  resultado.push({
    trecho: dados.trecho,
    geometria: dados.geometria,
    estrategia: dados.estrategia,
    passagens: passagens.map((p, i) => ({ ...p, analise: analisesPorPassagem[i] })),
    melhorVolta: melhor.volta,
  });
}

// Trajeto verde
const trajeto = samples.map(s => {
  const p = projectToViewBox(s, track);
  return p ? { x: +p.x.toFixed(1), y: +p.y.toFixed(1) } : null;
}).filter(Boolean);

// HTML
const vb = mapa.pista.view_box;
const linha = mapa.pista.linha_chegada;

function corSeveridade(s) { return s === 'verde' ? '#5dd39e' : s === 'amarelo' ? '#ffb454' : '#ff6b6b'; }

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Análise do instrutor — Brasília 2026-05-24</title>
<style>
  :root{--bg:#0b1220;--panel:#101a2e;--panel2:#15233d;--line:#1f2f4d;--ink:#e8eef9;--muted:#8ea0c1;--accent:#5da3ff;--ok:#5dd39e;--warn:#ffb454;--bad:#ff6b6b;--ouro:#e79800;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1300px;margin:0 auto;padding:32px 24px 80px}
  header{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px}
  h1{font-size:24px;margin:0 0 6px;font-weight:600}
  .sub{color:var(--muted);font-size:13px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin:18px 0}
  .card h2{margin:0 0 6px;font-size:18px;color:var(--accent)}
  .card h3{margin:14px 0 6px;font-size:14px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
  .estrat{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:12px;margin:8px 0}
  .estrat .badge{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .badge.tardio{background:rgba(231,152,0,.2);color:var(--ouro);border:1px solid var(--ouro)}
  .badge.geometrico{background:rgba(93,163,255,.15);color:var(--accent);border:1px solid var(--accent)}
  .badge.antecipado{background:rgba(255,107,107,.15);color:var(--bad);border:1px solid var(--bad)}
  .geo-info{font-size:12px;color:var(--muted);margin-top:6px}
  .passagem{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:12px;margin:8px 0}
  .pass-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px}
  .pass-head .info{color:var(--muted);font-size:11px}
  .sev-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
  .conselho{background:var(--panel);border-left:3px solid var(--accent);padding:10px 12px;border-radius:0 6px 6px 0;font-size:13px;line-height:1.55;margin-top:6px}
  .conselho.verde{border-left-color:var(--ok)}
  .conselho.amarelo{border-left-color:var(--warn)}
  .conselho.vermelho{border-left-color:var(--bad)}
  .indic{display:flex;flex-wrap:wrap;gap:14px;margin-top:4px;font-size:11px;color:var(--muted)}
  .indic span strong{color:var(--ink);margin-left:4px}
  svg.mini{width:100%;max-width:200px;height:auto;background:var(--bg);border-radius:6px;float:right;margin-left:14px}
  .melhor-tag{background:var(--ouro);color:var(--bg);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}
  footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Análise do instrutor sênior — Brasília 2026-05-24</h1>
  <div class="sub">${resultado.length} trechos pedagógicos · ${samples.length} amostras GPS · análise tipo "piloto experiente dando treinamento"</div>
</header>

${resultado.map(r => {
  const e = r.trecho.entradas[0], s = r.trecho.saidas[0];
  const ax = (e.x + s.x) / 2, ay = (e.y + s.y) / 2;
  const margem = 60;
  const x0 = Math.min(e.x, s.x) - margem, y0 = Math.min(e.y, s.y) - margem;
  const w = Math.abs(e.x - s.x) + 2 * margem, h = Math.abs(e.y - s.y) + 2 * margem;
  return `
  <div class="card">
    <svg class="mini" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <path d="${svgPath}" fill="none" stroke="#2a3a5a" stroke-width="6" />
      <polyline points="${trajeto.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="1.5" opacity="0.7" />
      <circle cx="${e.x}" cy="${e.y}" r="5" fill="#ffb454" />
      <circle cx="${s.x}" cy="${s.y}" r="5" fill="#5dd39e" />
      ${r.passagens.map(p => p.apiceExecutado ? `<circle cx="${p.apiceExecutado.x}" cy="${p.apiceExecutado.y}" r="3" fill="#ff6b6b" opacity="0.75" />` : '').join('')}
    </svg>
    <h2>${r.trecho.nome}</h2>
    <div class="sub">${r.passagens.length} passagens registradas</div>

    <div class="estrat">
      <span class="badge ${r.estrategia.tipo}">${r.estrategia.tipo.toUpperCase()}</span>
      <div>
        <div style="font-weight:600">Estratégia ideal: ${r.estrategia.tipo === 'tardio' ? 'Ápice tardio' : r.estrategia.tipo === 'antecipado' ? 'Ápice antecipado' : 'Ápice geométrico'}</div>
        <div class="geo-info">${r.estrategia.explicacao}</div>
        <div class="geo-info">Raio ${r.geometria.raioM.toFixed(0)} m · comprimento ${r.geometria.comprimentoCurvaM.toFixed(0)} m · reta antes ${r.geometria.retaAntesM.toFixed(0)} m · reta depois ${r.geometria.retaDepoisM.toFixed(0)} m</div>
      </div>
    </div>

    <h3>Análise das passagens</h3>
    ${r.passagens.map(p => `
      <div class="passagem">
        <div class="pass-head">
          <div><strong>Volta ${p.volta}</strong> ${p.volta === r.melhorVolta ? '<span class="melhor-tag">melhor</span>' : ''}</div>
          <div class="info">tempo ${(p.ev.tempoMs/1000).toFixed(2)} s · ápice executado: <span style="color:${corSeveridade(p.analise.severidade)};font-weight:600">${p.analise.apiceExecutadoTipo}</span> (${p.analise.desvioMetros > 0 ? '+' : ''}${p.analise.desvioMetros.toFixed(0)} m)</div>
        </div>
        <div class="indic">
          <span>V chegada<strong>${p.indicadores.vChegadaKmh?.toFixed(0) ?? '—'}</strong></span>
          <span>Freada<strong>${p.indicadores.vFreadaKmh?.toFixed(0) ?? '—'}</strong></span>
          <span>Entrada<strong>${p.indicadores.vEntradaKmh?.toFixed(0) ?? '—'}</strong></span>
          <span>Vmin<strong>${p.indicadores.vminKmh?.toFixed(0) ?? '—'}</strong></span>
          <span>Pace<strong>${p.indicadores.vPaceKmh?.toFixed(0) ?? '—'}</strong></span>
          <span>Saída pico<strong>${p.indicadores.vSaidaPicoKmh?.toFixed(0) ?? '—'}</strong></span>
        </div>
        <div class="conselho ${p.analise.severidade}">${p.analise.conselho}</div>
      </div>
    `).join('')}
  </div>`;
}).join('')}

<footer>
  Gerado em ${new Date().toISOString()} · Stint <code>EDA3DA6B-262D-4839-B6F0-26A3BE2891E7</code> · Análise pelo instrutor sênior canônico
</footer>

</div>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/ANALISE-instrutor-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('\nHTML:', out);
console.error('Trechos com análise:', resultado.length);
for (const r of resultado) {
  console.error(`  ${r.trecho.nome}: estratégia ${r.estrategia.tipo}, ${r.passagens.length} passagens`);
}
