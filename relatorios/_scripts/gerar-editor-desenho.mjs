// Editor interativo do desenho oficial da pista
// ─────────────────────────────────────────────
// Trajeto verde do GPS = REFERÊNCIA FIXA (o GPS está certo)
// Desenho cinza = OBJETO QUE FLÁVIO AJUSTA (esticar X, esticar Y,
// girar, mover) até bater visualmente com o GPS.
//
// Pontos canônicos (E/A/S das 8 curvas) ficam grudados no desenho
// e sofrem a MESMA transformação automaticamente.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPathOficial = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), kmh: Number(kmh) };
});

const vb = mapa.pista.view_box;
const linha = mapa.pista.linha_chegada;
const curvas = mapa.trechos.filter(t => t.eh_trecho_pedagogico).map(t => ({
  nome: t.nome.replace('CURVA ', ''),
  entrada: t.entradas?.[0],
  saida: t.saidas?.[0],
  apice: t.apices?.[0],
}));

// Projeção EXATAMENTE igual ao alinhador interativo anterior que
// Flávio aprovou — normalização SEPARADA por eixo (lat e lng).
// Cada eixo é esticado pra preencher o bounding box do path,
// preservando a ORIENTAÇÃO visual que ele aprovou (sem proporção
// natural do mundo — eixos são tratados independentemente, igual
// ao gpsRaw + encaixe automático do alinhador antigo).
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);

// Bounding box do path SVG do desenho oficial — alvo do encaixe
const xMinPath = 167, xMaxPath = 688;
const yMinPath = 144, yMaxPath = 713;
// Margem interna de 4% pra trajeto não encostar nas bordas do path
const margemPct = 0.04;
const tx0 = xMinPath + (xMaxPath - xMinPath) * margemPct;
const tx1 = xMaxPath - (xMaxPath - xMinPath) * margemPct;
const ty0 = yMinPath + (yMaxPath - yMinPath) * margemPct;
const ty1 = yMaxPath - (yMaxPath - yMinPath) * margemPct;
function gps2vb(lat, lng) {
  return {
    x: tx0 + (lng - lngMin) / (lngMax - lngMin) * (tx1 - tx0),
    y: ty0 + (latMax - lat) / (latMax - latMin) * (ty1 - ty0),
  };
}
const trajeto = samples.map(s => {
  const p = gps2vb(s.lat, s.lng);
  return { x: +p.x.toFixed(1), y: +p.y.toFixed(1) };
});

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Editor do desenho da pista · Brasília</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --panel2:#15233d; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff; --ok:#5dd39e;
    --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1500px;margin:0 auto;padding:24px}
  header{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}
  h1{font-size:22px;margin:0 0 6px;font-weight:600;letter-spacing:-0.01em}
  .sub{color:var(--muted);font-size:13px}
  .layout{display:grid;grid-template-columns:1fr 340px;gap:18px}
  @media (max-width:1100px){.layout{grid-template-columns:1fr}}
  .map-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
  svg{width:100%;height:auto;display:block;background:var(--bg);border-radius:8px;user-select:none}
  .col{display:flex;flex-direction:column;gap:14px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
  .card h3{margin:0 0 12px;font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
  .ctrl{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
  .ctrl-head{display:flex;justify-content:space-between;align-items:center}
  .ctrl-head label{font-size:12px;color:var(--muted)}
  .ctrl-head .val{font-family:"SF Mono",ui-monospace,monospace;font-size:12px;color:var(--ouro);font-weight:600}
  input[type=range]{width:100%;accent-color:var(--accent);height:22px}
  .btn{background:var(--accent);color:var(--bg);border:none;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer;font-size:13px;letter-spacing:.02em}
  .btn:hover{filter:brightness(1.1)}
  .btn-sec{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
  .btn-ok{background:var(--ok);color:var(--bg)}
  .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .resultado{background:rgba(93,211,158,.08);border-left:3px solid var(--ok);padding:12px;border-radius:0 6px 6px 0;font-family:"SF Mono",ui-monospace,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.5}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ouro);color:var(--bg);padding:10px 18px;border-radius:8px;font-weight:600;opacity:0;transition:opacity .25s;pointer-events:none;z-index:99}
  .toast.show{opacity:1}
  .help{background:rgba(93,163,255,.06);border-left:3px solid var(--accent);padding:10px 12px;border-radius:0 6px 6px 0;font-size:12px;line-height:1.55;margin-bottom:12px}
  .legenda{display:flex;flex-direction:column;gap:6px;font-size:12px}
  .legenda div{display:flex;align-items:center;gap:8px}
  .leg-dot{width:14px;height:3px;border-radius:2px;flex-shrink:0}
  .leg-circle{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .grupo-btn{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
  .grupo-btn button{padding:6px;font-size:11px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Editor do desenho oficial da pista</h1>
  <div class="sub">Trajeto verde do GPS está fixo (é a referência correta). Use os controles do lado direito pra esticar, girar e mover o desenho cinza até ele bater com o verde.</div>
</header>

<div class="layout">

<div class="map-wrap">
<svg id="mapa" viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
  <!-- Trajeto verde (referência fixa do GPS) -->
  <polyline points="${trajeto.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="3" opacity="0.9" />

  <!-- Desenho cinza (objeto editável) -->
  <g id="desenho">
    <path d="${svgPathOficial}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.75" />
    <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#ffb454" stroke-width="3" />
    ${curvas.map(c => `
      ${c.entrada ? `<circle cx="${c.entrada.x}" cy="${c.entrada.y}" r="5" fill="#ffb454" opacity="0.85" />` : ''}
      ${c.apice ? `<circle cx="${c.apice.x}" cy="${c.apice.y}" r="6" fill="#ff6b6b" opacity="0.85" />` : ''}
      ${c.saida ? `<circle cx="${c.saida.x}" cy="${c.saida.y}" r="5" fill="#5dd39e" opacity="0.85" />` : ''}
      <text x="${(c.apice?.x ?? 0) + 8}" y="${(c.apice?.y ?? 0) + 3}" fill="#ff6b6b" font-size="10" opacity="0.85">${c.nome}</text>
    `).join('')}
  </g>
</svg>
</div>

<div class="col">

<div class="card">
  <h3>1. Esticar horizontal</h3>
  <div class="ctrl">
    <div class="ctrl-head"><label>Largura</label><span class="val" id="vScX">100%</span></div>
    <input type="range" id="scX" min="50" max="150" step="0.5" value="100">
  </div>
  <div class="grupo-btn">
    <button class="btn btn-sec" onclick="bump('scX',-1)">-1%</button>
    <button class="btn btn-sec" onclick="bump('scX',-0.1)">-0.1%</button>
    <button class="btn btn-sec" onclick="bump('scX',0.1)">+0.1%</button>
  </div>
</div>

<div class="card">
  <h3>2. Esticar vertical</h3>
  <div class="ctrl">
    <div class="ctrl-head"><label>Altura</label><span class="val" id="vScY">100%</span></div>
    <input type="range" id="scY" min="50" max="150" step="0.5" value="100">
  </div>
  <div class="grupo-btn">
    <button class="btn btn-sec" onclick="bump('scY',-1)">-1%</button>
    <button class="btn btn-sec" onclick="bump('scY',-0.1)">-0.1%</button>
    <button class="btn btn-sec" onclick="bump('scY',0.1)">+0.1%</button>
  </div>
</div>

<div class="card">
  <h3>3. Girar</h3>
  <div class="ctrl">
    <div class="ctrl-head"><label>Rotação</label><span class="val" id="vRot">0°</span></div>
    <input type="range" id="rot" min="-180" max="180" step="0.5" value="0">
  </div>
  <div class="grupo-btn">
    <button class="btn btn-sec" onclick="bump('rot',-1)">-1°</button>
    <button class="btn btn-sec" onclick="bump('rot',-0.5)">-0.5°</button>
    <button class="btn btn-sec" onclick="bump('rot',0.5)">+0.5°</button>
  </div>
</div>

<div class="card">
  <h3>4. Mover</h3>
  <div class="ctrl">
    <div class="ctrl-head"><label>Horizontal</label><span class="val" id="vTx">0</span></div>
    <input type="range" id="tx" min="-200" max="200" step="1" value="0">
  </div>
  <div class="ctrl">
    <div class="ctrl-head"><label>Vertical</label><span class="val" id="vTy">0</span></div>
    <input type="range" id="ty" min="-200" max="200" step="1" value="0">
  </div>
</div>

<div class="card">
  <h3>5. Quando estiver alinhado</h3>
  <div class="help">Quando o desenho azul estiver em cima do trajeto verde, copie os números aqui embaixo e me passe. Eu aplico no cadastro oficial com cópia de segurança antes.</div>
  <div class="resultado" id="result">Largura: 100,0%
Altura: 100,0%
Rotação: 0,0°
Mover horizontal: 0
Mover vertical: 0</div>
  <div class="btn-row" style="margin-top:10px">
    <button class="btn" id="copiar">Copiar números</button>
    <button class="btn btn-sec" id="reset">Zerar tudo</button>
  </div>
</div>

<div class="card">
  <h3>Legenda</h3>
  <div class="legenda">
    <div><div class="leg-dot" style="background:#5dd39e"></div>Trajeto do GPS (REFERÊNCIA, fixo)</div>
    <div><div class="leg-dot" style="background:#5da3ff"></div>Desenho oficial (objeto editável)</div>
    <div><div class="leg-circle" style="background:#ffb454"></div>Entradas das curvas</div>
    <div><div class="leg-circle" style="background:#ff6b6b"></div>Ápices das curvas</div>
    <div><div class="leg-circle" style="background:#5dd39e"></div>Saídas das curvas</div>
  </div>
</div>

</div>
</div>

<div class="toast" id="toast"></div>
</div>

<script>
const desenho = document.getElementById('desenho');
const scX = document.getElementById('scX');
const scY = document.getElementById('scY');
const rot = document.getElementById('rot');
const tx = document.getElementById('tx');
const ty = document.getElementById('ty');
const result = document.getElementById('result');

// Centro do desenho oficial (centroide aproximado, usado pra pivot de rotação/escala)
const cx = ${(167 + 688) / 2};
const cy = ${(144 + 713) / 2};

function aplicar() {
  const sx = (+scX.value) / 100;
  const sy = (+scY.value) / 100;
  const r = +rot.value;
  const x = +tx.value;
  const y = +ty.value;
  // Ordem: translada centro pra origem → escala não-uniforme → rotaciona → translada de volta + offset
  desenho.setAttribute('transform',
    \`translate(\${cx + x},\${cy + y}) rotate(\${r}) scale(\${sx},\${sy}) translate(\${-cx},\${-cy})\`);
  document.getElementById('vScX').textContent = sx.toFixed(3).replace('.', ',') === 'NaN' ? '—' : (sx*100).toFixed(1).replace('.', ',') + '%';
  document.getElementById('vScY').textContent = (sy*100).toFixed(1).replace('.', ',') + '%';
  document.getElementById('vRot').textContent = r.toFixed(1).replace('.', ',') + '°';
  document.getElementById('vTx').textContent = x;
  document.getElementById('vTy').textContent = y;
  result.textContent =
    'Largura: ' + (sx*100).toFixed(2).replace('.', ',') + '%\\n' +
    'Altura: ' + (sy*100).toFixed(2).replace('.', ',') + '%\\n' +
    'Rotação: ' + r.toFixed(2).replace('.', ',') + '°\\n' +
    'Mover horizontal: ' + x + '\\n' +
    'Mover vertical: ' + y;
}
[scX, scY, rot, tx, ty].forEach(el => el.addEventListener('input', aplicar));

window.bump = (id, delta) => {
  const el = document.getElementById(id);
  const v = +el.value + delta;
  el.value = Math.max(+el.min, Math.min(+el.max, v));
  aplicar();
};

document.getElementById('reset').onclick = () => {
  scX.value = 100; scY.value = 100; rot.value = 0; tx.value = 0; ty.value = 0;
  aplicar();
};

document.getElementById('copiar').onclick = () => {
  navigator.clipboard.writeText(result.textContent);
  const t = document.getElementById('toast');
  t.textContent = 'Copiado! Cole na conversa que eu aplico.';
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
};

aplicar();
</script>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/EDITOR-desenho-pista-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('Editor gerado:', out);
