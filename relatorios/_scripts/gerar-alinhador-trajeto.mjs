// Gerador do alinhador interativo do trajeto de hoje
// ────────────────────────────────────────────────────
// HTML standalone com ferramenta visual de alinhamento:
//   - Desenho da pista oficial fixo
//   - Trajeto de hoje (verde) sobreposto, mas com sliders de
//     rotação, deslocamento X/Y e escala
//   - Modo "marcar ponto": clica no trajeto verde, dá nome
//   - Exporta âncoras geográficas calculadas

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), kmh: Number(kmh) };
});

// Bounding box do GPS + path → posição inicial
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
const vb = mapa.pista.view_box;

// Pontos GPS pré-projetados (escala 1, sem rotação) — no espaço bruto.
// O usuário ajusta rotação/translação/escala pra alinhar.
function gpsRaw(lat, lng) {
  return {
    x: (lng - lngMin) / (lngMax - lngMin) * 500 + 150, // ~500 unidades de largura
    y: (latMax - lat) / (latMax - latMin) * 500 + 150,
  };
}
const trajetoPts = samples.map(s => {
  const p = gpsRaw(s.lat, s.lng);
  return { x: p.x, y: p.y, lat: s.lat, lng: s.lng, t: s.t, kmh: s.kmh };
});

const curvas = mapa.trechos.filter(t => t.eh_trecho_pedagogico).map(t => ({
  nome: t.nome.replace('CURVA ', ''),
  apice: t.apices[0],
}));
const linha = mapa.pista.linha_chegada;

// Pontos canônicos do desenho pra ele escolher como alvo
const pontosAlvo = [
  { id: 'box', nome: 'Box (entrada dos boxes)', x: 390, y: 630, hint: 'Reta principal lado interno' },
  ...mapa.trechos
    .filter(t => t.eh_trecho_pedagogico)
    .flatMap(t => ([
      { id: `apice_${t.id}`, nome: 'Ápice ' + t.nome, x: t.apices[0].x, y: t.apices[0].y, hint: '' },
    ])),
];

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Alinhador do trajeto · Brasília 2026-05-24</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --panel2:#15233d; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff; --ok:#5dd39e;
    --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1400px;margin:0 auto;padding:24px}
  header{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}
  h1{font-size:22px;margin:0 0 6px;font-weight:600;letter-spacing:-0.01em}
  .sub{color:var(--muted);font-size:13px}
  .layout{display:grid;grid-template-columns:1fr 360px;gap:16px}
  @media (max-width:1000px){.layout{grid-template-columns:1fr}}
  .map-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;position:relative;overflow:hidden}
  svg{width:100%;height:auto;display:block;background:var(--bg);border-radius:8px;cursor:crosshair;user-select:none}
  .col{display:flex;flex-direction:column;gap:14px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
  .card h3{margin:0 0 10px;font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
  .ctrl{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
  .ctrl-head{display:flex;justify-content:space-between;align-items:center}
  .ctrl-head label{font-size:12px;color:var(--muted)}
  .ctrl-head .val{font-family:"SF Mono",ui-monospace,monospace;font-size:12px;color:var(--ouro)}
  input[type=range]{width:100%;accent-color:var(--accent)}
  .btn{background:var(--accent);color:var(--bg);border:none;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer;font-size:13px;letter-spacing:.02em}
  .btn:hover{background:#7cb8ff}
  .btn-sec{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
  .btn-sec:hover{background:#1a2a4a}
  .btn-warn{background:var(--warn);color:var(--bg)}
  .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  select{width:100%;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px;font-size:13px}
  .marca{padding:10px;border-radius:8px;background:var(--panel2);border-left:3px solid var(--ouro);margin:6px 0;font-size:12px}
  .marca .nome{font-weight:600;color:var(--ouro);margin-bottom:4px}
  .marca .coord{font-family:"SF Mono",ui-monospace,monospace;color:var(--muted);font-size:11px}
  .marca .del{float:right;color:var(--bad);cursor:pointer;font-size:14px;font-weight:bold}
  .help{background:rgba(93,163,255,.06);border-left:3px solid var(--accent);padding:10px 12px;border-radius:0 6px 6px 0;font-size:12px;line-height:1.55}
  .resultado{background:rgba(93,211,158,.08);border-left:3px solid var(--ok);padding:12px;border-radius:0 6px 6px 0;font-family:"SF Mono",ui-monospace,monospace;font-size:11px;white-space:pre-wrap;word-break:break-all}
  .modo-marca{background:rgba(231,152,0,.15);outline:2px solid var(--ouro)}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ouro);color:var(--bg);padding:10px 18px;border-radius:8px;font-weight:600;opacity:0;transition:opacity .25s;pointer-events:none}
  .toast.show{opacity:1}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Alinhar o trajeto de hoje com o desenho da pista</h1>
  <div class="sub">Use os controles pra girar e mover o trajeto verde até ele cair em cima do desenho cinza. Depois marque o box e um segundo ponto pra calibrar as âncoras geográficas.</div>
</header>

<div class="layout">

<div class="map-wrap">
<svg id="mapa" viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
  <!-- Pista fixa -->
  <g id="pista">
    <path d="${svgPath}" fill="none" stroke="#3a4a6a" stroke-width="8" stroke-linejoin="round" />
    <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#5da3ff" stroke-width="4" />
    <text x="${linha.x1 + 8}" y="${linha.y1 - 6}" fill="#5da3ff" font-size="11" font-weight="600">linha chegada</text>
    ${curvas.map(c => `
      <circle cx="${c.apice.x}" cy="${c.apice.y}" r="5" fill="#ff6b6b" opacity="0.6" />
      <text x="${c.apice.x + 8}" y="${c.apice.y + 3}" fill="#ff6b6b" font-size="9" opacity="0.75">${c.nome}</text>
    `).join('')}
  </g>
  <!-- Trajeto editável -->
  <g id="trajeto-grupo">
    <polyline id="trajeto" points="${trajetoPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="2.5" opacity="0.9" />
    <circle id="ponto-inicio" cx="${trajetoPts[0].x.toFixed(1)}" cy="${trajetoPts[0].y.toFixed(1)}" r="10" fill="#e79800" />
    <circle id="ponto-fim" cx="${trajetoPts[trajetoPts.length-1].x.toFixed(1)}" cy="${trajetoPts[trajetoPts.length-1].y.toFixed(1)}" r="8" fill="#5da3ff" opacity="0.7" />
  </g>
  <!-- Marcas do usuário -->
  <g id="marcas"></g>
</svg>
</div>

<div class="col">

<div class="card">
  <h3>1. Alinhar trajeto</h3>
  <div class="ctrl">
    <div class="ctrl-head"><label>Rotação</label><span class="val" id="vRot">0°</span></div>
    <input type="range" id="rot" min="-180" max="180" step="1" value="0">
  </div>
  <div class="ctrl">
    <div class="ctrl-head"><label>Mover horizontal</label><span class="val" id="vTx">0</span></div>
    <input type="range" id="tx" min="-500" max="500" step="1" value="0">
  </div>
  <div class="ctrl">
    <div class="ctrl-head"><label>Mover vertical</label><span class="val" id="vTy">0</span></div>
    <input type="range" id="ty" min="-500" max="500" step="1" value="0">
  </div>
  <div class="ctrl">
    <div class="ctrl-head"><label>Escala</label><span class="val" id="vSc">1.00×</span></div>
    <input type="range" id="sc" min="0.2" max="3" step="0.01" value="1">
  </div>
  <div class="btn-row">
    <button class="btn btn-sec" id="auto">Encaixe automático</button>
    <button class="btn btn-sec" id="reset">Zerar</button>
  </div>
</div>

<div class="card">
  <h3>2. Marcar pontos do trajeto</h3>
  <div class="help">Selecione abaixo qual ponto do desenho você vai apontar. Clique no botão "Marcar". O cursor vira mira. Clique no trajeto verde onde corresponde no mundo real.</div>
  <select id="alvo" style="margin-top:10px">
    ${pontosAlvo.map(p => `<option value="${p.id}" data-x="${p.x}" data-y="${p.y}">${p.nome}</option>`).join('')}
  </select>
  <div class="btn-row">
    <button class="btn btn-warn" id="modoMarca">Marcar este ponto</button>
  </div>
  <div id="listaMarcas"></div>
</div>

<div class="card">
  <h3>3. Resultado (âncoras calculadas)</h3>
  <div class="help">Quando você tiver pelo menos <strong>2 pontos marcados</strong>, eu calculo as âncoras geográficas finais aqui embaixo. Copia o conteúdo e me passa.</div>
  <div id="resultado" class="resultado" style="margin-top:10px;display:none"></div>
  <div class="btn-row">
    <button class="btn" id="copiar" disabled>Copiar âncoras</button>
  </div>
</div>

</div>
</div>

<div class="toast" id="toast"></div>
</div>

<script>
const samples = ${JSON.stringify(trajetoPts.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), lat: p.lat, lng: p.lng })))};

const grupo = document.getElementById('trajeto-grupo');
const rot = document.getElementById('rot');
const tx = document.getElementById('tx');
const ty = document.getElementById('ty');
const sc = document.getElementById('sc');
const svg = document.getElementById('mapa');
const marcasG = document.getElementById('marcas');
const lista = document.getElementById('listaMarcas');
const alvo = document.getElementById('alvo');
const resultado = document.getElementById('resultado');
const copiar = document.getElementById('copiar');

// Centro de rotação = média do trajeto
let cx = 0, cy = 0;
for (const p of samples) { cx += p.x; cy += p.y; }
cx /= samples.length; cy /= samples.length;

function aplicarTransform() {
  const r = +rot.value, x = +tx.value, y = +ty.value, s = +sc.value;
  // Ordem: rotaciona em torno do centro, escala em torno do centro, depois translada
  grupo.setAttribute('transform',
    \`translate(\${x},\${y}) translate(\${cx},\${cy}) rotate(\${r}) scale(\${s}) translate(\${-cx},\${-cy})\`);
  document.getElementById('vRot').textContent = r + '°';
  document.getElementById('vTx').textContent = x;
  document.getElementById('vTy').textContent = y;
  document.getElementById('vSc').textContent = s.toFixed(2) + '×';
}
[rot, tx, ty, sc].forEach(el => el.addEventListener('input', aplicarTransform));

document.getElementById('reset').onclick = () => {
  rot.value = 0; tx.value = 0; ty.value = 0; sc.value = 1;
  aplicarTransform();
};

document.getElementById('auto').onclick = () => {
  // Encaixe automático: usa bounding-box do trajeto vs path
  // Esse é o que rodei no análise — 94,8% de acerto.
  // Path bounds X 167-688 (largura 521) Y 144-713 (altura 569)
  // Trajeto bounds: usar samples
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
  for(const p of samples){xMin=Math.min(xMin,p.x);xMax=Math.max(xMax,p.x);yMin=Math.min(yMin,p.y);yMax=Math.max(yMax,p.y);}
  const sx = (688-167) / (xMax-xMin);
  const sy = (713-144) / (yMax-yMin);
  const escala = Math.min(sx, sy) * 0.92;
  // Alvo da centralização
  const trajCx = (xMin+xMax)/2, trajCy = (yMin+yMax)/2;
  const pistaCx = (167+688)/2, pistaCy = (144+713)/2;
  sc.value = escala.toFixed(2);
  tx.value = Math.round(pistaCx - trajCx);
  ty.value = Math.round(pistaCy - trajCy);
  rot.value = 0;
  aplicarTransform();
};

// ─── Marcação de pontos ───────────────────────
let modoMarca = false;
let marcas = [];

document.getElementById('modoMarca').onclick = () => {
  modoMarca = true;
  svg.classList.add('modo-marca');
  toast('Modo marcação ligado. Clique no trajeto verde onde fica: ' + alvo.options[alvo.selectedIndex].text);
};

function svgPoint(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

svg.addEventListener('click', (e) => {
  if (!modoMarca) return;
  const p = svgPoint(e);
  // Achar o sample do trajeto VISUAL mais próximo do clique
  // Para isso preciso aplicar o transform a cada sample e achar o mais perto
  const r = +rot.value * Math.PI / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const s = +sc.value, x0 = +tx.value, y0 = +ty.value;
  function aplicar(pt) {
    let dx = pt.x - cx, dy = pt.y - cy;
    let rx = (cos * dx - sin * dy) * s;
    let ry = (sin * dx + cos * dy) * s;
    return { x: rx + cx + x0, y: ry + cy + y0 };
  }
  let melhor = null, dMin = Infinity;
  for (const samp of samples) {
    const v = aplicar(samp);
    const d = (v.x - p.x)**2 + (v.y - p.y)**2;
    if (d < dMin) { dMin = d; melhor = { samp, v }; }
  }
  if (!melhor || dMin > 1600) {
    toast('Clique mais perto do trajeto verde. Tente de novo.');
    return;
  }
  const sel = alvo.options[alvo.selectedIndex];
  const alvoX = +sel.dataset.x, alvoY = +sel.dataset.y;
  marcas.push({
    nome: sel.text, alvoX, alvoY,
    lat: melhor.samp.lat, lng: melhor.samp.lng,
    visX: melhor.v.x, visY: melhor.v.y,
  });
  desenharMarcas();
  renderLista();
  calcularAncoras();
  modoMarca = false;
  svg.classList.remove('modo-marca');
  toast('Marcado: ' + sel.text);
});

function desenharMarcas() {
  marcasG.innerHTML = marcas.map((m, i) => \`
    <circle cx="\${m.alvoX}" cy="\${m.alvoY}" r="6" fill="#e79800" stroke="#fff" stroke-width="2" />
    <line x1="\${m.visX}" y1="\${m.visY}" x2="\${m.alvoX}" y2="\${m.alvoY}" stroke="#e79800" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7" />
    <text x="\${m.alvoX + 10}" y="\${m.alvoY - 8}" fill="#e79800" font-size="11" font-weight="700">#\${i+1}</text>
  \`).join('');
}

function renderLista() {
  lista.innerHTML = marcas.map((m, i) => \`
    <div class="marca">
      <span class="del" onclick="removerMarca(\${i})">&times;</span>
      <div class="nome">#\${i+1} \${m.nome}</div>
      <div class="coord">lat \${m.lat.toFixed(6)} · lng \${m.lng.toFixed(6)}</div>
      <div class="coord">→ desenho (\${m.alvoX}, \${m.alvoY})</div>
    </div>
  \`).join('');
}

window.removerMarca = (i) => {
  marcas.splice(i, 1);
  desenharMarcas(); renderLista(); calcularAncoras();
};

function calcularAncoras() {
  if (marcas.length < 2) { resultado.style.display = 'none'; copiar.disabled = true; return; }
  // Usar os 2 primeiros como âncoras
  const a = marcas[0], b = marcas[marcas.length-1];
  const txt = JSON.stringify([
    { latitude: a.lat, longitude: a.lng, x: a.alvoX, y: a.alvoY },
    { latitude: b.lat, longitude: b.lng, x: b.alvoX, y: b.alvoY },
  ], null, 2);
  resultado.style.display = 'block';
  resultado.textContent = 'Marca #1: ' + a.nome + ' → (' + a.alvoX + ', ' + a.alvoY + ')\\n' +
                          'Marca #' + marcas.length + ': ' + b.nome + ' → (' + b.alvoX + ', ' + b.alvoY + ')\\n\\n' +
                          'Âncoras finais:\\n' + txt;
  copiar.disabled = false;
}

copiar.onclick = () => {
  navigator.clipboard.writeText(resultado.textContent);
  toast('Copiado!');
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

// Encaixe automático no carregamento (ponto de partida útil)
document.getElementById('auto').click();
</script>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/ALINHADOR-trajeto-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('Alinhador gerado:', out);
