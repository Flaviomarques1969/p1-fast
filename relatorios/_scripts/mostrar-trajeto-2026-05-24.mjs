// Mapa do trajeto de hoje — pra Flávio confirmar onde fica o box
// ──────────────────────────────────────────────────────────────
// Plota o desenho da pista + os 940 pontos GPS de hoje +
// destaque no PRIMEIRO ponto (provável box) e em um ponto
// na ponta oposta (referência distante).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLookup } from '../../src/telemetry/path-mapper.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), kmh: Number(kmh) };
});

// Ponto 1: PRIMEIRO sample (provável box)
const p1 = samples[0];

// Ponto 2: o sample mais distante do p1 (referência geográfica oposta)
let p2 = samples[0], maxD = 0;
for (const s of samples) {
  const d = (s.lat - p1.lat) ** 2 + (s.lng - p1.lng) ** 2;
  if (d > maxD) { maxD = d; p2 = s; }
}

// Bounding box do GPS + bounding box do path → transformação afim simples
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
const lookup = buildLookup(svgPath, 4000);
let xMin=Infinity, xMax=-Infinity, yMin=Infinity, yMax=-Infinity;
for (const p of lookup.points) {
  xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
  yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
}
function gps2view(lat, lng) {
  // lat max (norte) → y min (topo); lat min (sul) → y max (rodapé)
  // lng max (leste) → x max (direita); lng min (oeste) → x min (esquerda)
  const x = xMin + (lng - lngMin) / (lngMax - lngMin) * (xMax - xMin);
  const y = yMax - (lat - latMin) / (latMax - latMin) * (yMax - yMin);
  return { x, y };
}

const trajetoPts = samples.map(s => {
  const p = gps2view(s.lat, s.lng);
  return { ...p, kmh: s.kmh };
});

const p1view = gps2view(p1.lat, p1.lng);
const p2view = gps2view(p2.lat, p2.lng);

// Curvas pedagógicas — pra ele se localizar
const curvas = mapa.trechos.filter(t => t.eh_trecho_pedagogico).map(t => ({
  nome: t.nome,
  apice: t.apices[0],
}));

const vb = mapa.pista.view_box;
const linha = mapa.pista.linha_chegada;

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Trajeto de hoje — onde fica o box?</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff;
    --ok:#5dd39e; --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1200px;margin:0 auto;padding:24px}
  header{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}
  h1{font-size:22px;margin:0 0 6px;font-weight:600}
  .sub{color:var(--muted);font-size:13px}
  .layout{display:grid;grid-template-columns:1fr 320px;gap:20px}
  @media (max-width:900px){.layout{grid-template-columns:1fr}}
  .map-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
  svg{width:100%;height:auto;display:block;background:var(--bg);border-radius:8px}
  .info-col{display:flex;flex-direction:column;gap:14px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
  .card h3{margin:0 0 8px;font-size:14px;color:var(--accent)}
  .coord{font-family:"SF Mono",ui-monospace,monospace;font-size:12px;color:var(--ouro);font-weight:600}
  .pin-label{font-size:11px;color:var(--muted);margin-top:4px}
  .legend{display:flex;flex-direction:column;gap:6px;font-size:12px}
  .legend-item{display:flex;align-items:center;gap:8px}
  .leg-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0}
  .pergunta{background:rgba(255,180,84,.08);border-left:3px solid var(--warn);padding:12px 14px;border-radius:0 8px 8px 0;font-size:13px}
  .pergunta strong{color:var(--warn)}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Trajeto que você andou hoje — onde fica o box?</h1>
  <div class="sub">Desenho oficial da pista de Brasília + os 940 pontos de GPS do stint de hoje em cima · 2026-05-24</div>
</header>

<div class="layout">

<div class="map-wrap">
<svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
  <!-- Desenho oficial da pista -->
  <path d="${svgPath}" fill="none" stroke="#2a3a5a" stroke-width="6" stroke-linejoin="round" />

  <!-- Linha de chegada (que está marcada no cadastro como x=${linha.x1}) -->
  <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#5da3ff" stroke-width="3" />
  <text x="${linha.x1 + 8}" y="${linha.y1 - 6}" fill="#5da3ff" font-size="11" font-weight="600">linha chegada (cadastro)</text>

  <!-- Ápices das curvas pedagógicas -->
  ${curvas.map(c => `
    <circle cx="${c.apice.x}" cy="${c.apice.y}" r="4" fill="#ff6b6b" opacity="0.5" />
    <text x="${c.apice.x + 8}" y="${c.apice.y + 3}" fill="#ff6b6b" font-size="9" opacity="0.7">${c.nome.replace('CURVA ','')}</text>
  `).join('')}

  <!-- Trajeto do GPS de hoje -->
  <polyline
    points="${trajetoPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
    fill="none" stroke="#5dd39e" stroke-width="2" opacity="0.85" />

  <!-- PONTO 1 em destaque: primeiro GPS do stint (provável box) -->
  <circle cx="${p1view.x}" cy="${p1view.y}" r="14" fill="none" stroke="#e79800" stroke-width="4" />
  <circle cx="${p1view.x}" cy="${p1view.y}" r="6" fill="#e79800" />
  <text x="${p1view.x + 20}" y="${p1view.y - 16}" fill="#e79800" font-size="14" font-weight="700">PONTO A</text>
  <text x="${p1view.x + 20}" y="${p1view.y - 4}" fill="#e79800" font-size="10">primeiro GPS</text>
  <text x="${p1view.x + 20}" y="${p1view.y + 8}" fill="#e79800" font-size="10">(provável box)</text>

  <!-- PONTO 2 em destaque: ponto mais distante (extremo oposto do circuito) -->
  <circle cx="${p2view.x}" cy="${p2view.y}" r="14" fill="none" stroke="#5da3ff" stroke-width="4" />
  <circle cx="${p2view.x}" cy="${p2view.y}" r="6" fill="#5da3ff" />
  <text x="${p2view.x + 20}" y="${p2view.y - 16}" fill="#5da3ff" font-size="14" font-weight="700">PONTO B</text>
  <text x="${p2view.x + 20}" y="${p2view.y - 4}" fill="#5da3ff" font-size="10">extremo oposto</text>
  <text x="${p2view.x + 20}" y="${p2view.y + 8}" fill="#5da3ff" font-size="10">do circuito</text>
</svg>
</div>

<div class="info-col">

<div class="card">
  <h3>O que você está vendo</h3>
  <div class="legend">
    <div class="legend-item"><div class="leg-dot" style="background:#2a3a5a"></div>Desenho oficial da pista</div>
    <div class="legend-item"><div class="leg-dot" style="background:#5da3ff"></div>Linha de chegada (no cadastro)</div>
    <div class="legend-item"><div class="leg-dot" style="background:#ff6b6b;opacity:.5"></div>Ápices das curvas pedagógicas</div>
    <div class="legend-item"><div class="leg-dot" style="background:#5dd39e"></div>Trajeto que você andou hoje (940 pontos GPS)</div>
    <div class="legend-item"><div class="leg-dot" style="background:#e79800"></div>PONTO A (primeiro GPS)</div>
    <div class="legend-item"><div class="leg-dot" style="background:#5da3ff"></div>PONTO B (extremo oposto)</div>
  </div>
</div>

<div class="card">
  <h3>PONTO A — onde o GPS começou</h3>
  <div class="coord">Latitude: ${p1.lat.toFixed(6)}</div>
  <div class="coord">Longitude: ${p1.lng.toFixed(6)}</div>
  <div class="pin-label">Velocidade nesse instante: ${p1.kmh.toFixed(1)} km/h</div>
  <div class="pin-label">Hora: ${new Date(p1.t).toLocaleTimeString('pt-BR')}</div>
</div>

<div class="card">
  <h3>PONTO B — extremo oposto do circuito</h3>
  <div class="coord">Latitude: ${p2.lat.toFixed(6)}</div>
  <div class="coord">Longitude: ${p2.lng.toFixed(6)}</div>
  <div class="pin-label">Velocidade nesse instante: ${p2.kmh.toFixed(1)} km/h</div>
  <div class="pin-label">Hora: ${new Date(p2.t).toLocaleTimeString('pt-BR')}</div>
</div>

<div class="pergunta">
  <strong>Pergunta pra você:</strong>
  <p style="margin:6px 0 0">Olhando o desenho ao lado, identifique no <strong>circuito real</strong>:</p>
  <ol style="margin:8px 0 0 18px;padding:0">
    <li>O ponto laranja (A) — é o seu box? Ou outro lugar?</li>
    <li>O ponto azul (B) — qual marco do circuito é esse no mundo real? (ex: ápice da Bruxa, fim da reta oposta...)</li>
  </ol>
  <p style="margin:8px 0 0;font-size:12px;color:var(--muted)">Sabendo onde os dois pontos ficam no mundo real, eu calibro as duas âncoras geográficas e o GPS volta a bater com o desenho da pista.</p>
</div>

</div>
</div>

</div>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/TRAJETO-2026-05-24-onde-e-o-box.html');
fs.writeFileSync(out, html);
console.error('HTML gerado:', out);
console.error('\nPONTO A (primeiro GPS):  lat=' + p1.lat.toFixed(6) + ' lng=' + p1.lng.toFixed(6));
console.error('PONTO B (mais distante): lat=' + p2.lat.toFixed(6) + ' lng=' + p2.lng.toFixed(6));
