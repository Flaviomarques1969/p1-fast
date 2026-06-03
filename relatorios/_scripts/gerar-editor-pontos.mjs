// Editor de pontos canônicos dos trechos
// ──────────────────────────────────────
// Mostra desenho da pista + GPS de hoje + 24 pontos (E/A/S de 8 curvas).
// Permite:
//   - Zoom com rolagem do mouse
//   - Mover (arrastar) o mapa com o botão direito ou shift+arrastar
//   - Arrastar cada ponto individualmente pra reposicionar
//   - Atalhos pra focar em cada curva (zoom rápido)
//   - Exportar a lista de pontos atualizada

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

// Mesma projeção do alinhador que Flávio aprovou
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
const xMinPath = 167, xMaxPath = 688, yMinPath = 144, yMaxPath = 713;
const margemPct = 0.04;
const tx0 = xMinPath + (xMaxPath - xMinPath) * margemPct;
const tx1 = xMaxPath - (xMaxPath - xMinPath) * margemPct;
const ty0 = yMinPath + (yMaxPath - yMinPath) * margemPct;
const ty1 = yMaxPath - (yMaxPath - yMinPath) * margemPct;
const trajeto = samples.map(s => ({
  x: +(tx0 + (s.lng - lngMin) / (lngMax - lngMin) * (tx1 - tx0)).toFixed(1),
  y: +(ty0 + (latMax - s.lat) / (latMax - latMin) * (ty1 - ty0)).toFixed(1),
}));

// Pontos canônicos: trechos pedagógicos com (entrada, ápice, saída)
const trechos = mapa.trechos
  .filter(t => t.eh_trecho_pedagogico)
  .map(t => ({
    id: t.id,
    nome: t.nome,
    parcial: t.parcial,
    entrada: t.entradas?.[0],
    apice: t.apices?.[0],
    saida: t.saidas?.[0],
  }));

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Editor de pontos · Brasília</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --panel2:#15233d; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff; --ok:#5dd39e;
    --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
  .wrap{display:grid;grid-template-columns:1fr 340px;height:100vh}
  .map-area{background:var(--bg);position:relative;overflow:hidden}
  .map-area svg{width:100%;height:100%;display:block;cursor:grab}
  .map-area svg.dragging{cursor:grabbing}
  .toolbar{position:absolute;top:14px;left:14px;display:flex;gap:8px;z-index:10;align-items:center;background:rgba(11,18,32,.85);padding:8px 12px;border-radius:8px;border:1px solid var(--line);backdrop-filter:blur(8px)}
  .toolbar .btn{padding:6px 10px;font-size:11px}
  .toolbar .info{color:var(--muted);font-size:11px;margin-left:8px}
  .side{background:var(--panel);border-left:1px solid var(--line);overflow-y:auto;padding:18px}
  .side h1{font-size:16px;margin:0 0 4px}
  .side .sub{font-size:11px;color:var(--muted);margin-bottom:14px}
  .card{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px}
  .card h3{margin:0 0 8px;font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
  .help{background:rgba(93,163,255,.06);border-left:3px solid var(--accent);padding:8px 10px;border-radius:0 6px 6px 0;font-size:11px;line-height:1.5;margin-bottom:12px}
  .btn{background:var(--accent);color:var(--bg);border:none;border-radius:6px;padding:8px 12px;font-weight:600;cursor:pointer;font-size:12px}
  .btn:hover{filter:brightness(1.1)}
  .btn-sec{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
  .btn-ok{background:var(--ok);color:var(--bg)}
  .btn-row{display:flex;gap:6px;flex-wrap:wrap}
  .trecho-row{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:8px;border-radius:6px;margin-bottom:4px;cursor:pointer;background:var(--panel2);border:1px solid var(--line)}
  .trecho-row:hover{background:#1a2a4a}
  .trecho-row.ativo{background:rgba(231,152,0,.15);border-color:var(--ouro)}
  .trecho-row .nome{font-size:12px;font-weight:600}
  .trecho-row .par{font-size:10px;color:var(--muted)}
  .trecho-row .ir{background:var(--accent);color:var(--bg);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
  .ponto-info{background:var(--panel2);border-radius:6px;padding:8px;margin-top:8px;font-size:11px;font-family:"SF Mono",ui-monospace,monospace;color:var(--ouro)}
  .resultado{background:rgba(93,211,158,.08);border-left:3px solid var(--ok);padding:10px 12px;border-radius:0 6px 6px 0;font-size:11px;line-height:1.5;font-family:"SF Mono",ui-monospace,monospace;max-height:200px;overflow:auto;margin-top:8px}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ouro);color:var(--bg);padding:10px 18px;border-radius:8px;font-weight:600;opacity:0;transition:opacity .25s;pointer-events:none;z-index:99}
  .toast.show{opacity:1}
  .ponto{cursor:grab}
  .ponto:hover{filter:brightness(1.3)}
  .ponto.arrastando{cursor:grabbing}
  text{user-select:none;pointer-events:none}
</style>
</head>
<body>
<div class="wrap">

<div class="map-area">
<svg id="mapa" viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
  <!-- Trajeto verde do GPS (REFERÊNCIA FIXA, fora do grupo transformado) -->
  <polyline points="${trajeto.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="2.5" opacity="0.85" />
  <!-- Grupo do desenho oficial + pontos: este sim recebe transform dos sliders -->
  <g id="desenho-grupo">
    <!-- Desenho oficial -->
    <path d="${svgPathOficial}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.7" />
    <!-- Linha de chegada -->
    <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#ffb454" stroke-width="3" />
    <!-- Pontos canônicos -->
    <g id="pontos">
      ${trechos.map((t, i) => `
        ${t.entrada ? `
        <line class="barrinha" data-trecho="${i}" data-tipo="entrada" x1="${t.entrada.x - 14}" y1="${t.entrada.y}" x2="${t.entrada.x + 14}" y2="${t.entrada.y}" stroke="#ffb454" stroke-width="4" stroke-linecap="round" opacity="0.85" />
        <circle class="ponto" data-trecho="${i}" data-tipo="entrada" cx="${t.entrada.x}" cy="${t.entrada.y}" r="7" fill="#ffb454" stroke="#fff" stroke-width="1.5" />
        <text x="${t.entrada.x + 12}" y="${t.entrada.y - 8}" fill="#ffb454" font-size="10" font-weight="700">E ${t.nome.replace('CURVA ', '')}</text>` : ''}
        ${t.saida ? `
        <line class="barrinha" data-trecho="${i}" data-tipo="saida" x1="${t.saida.x - 14}" y1="${t.saida.y}" x2="${t.saida.x + 14}" y2="${t.saida.y}" stroke="#5dd39e" stroke-width="4" stroke-linecap="round" opacity="0.85" />
        <circle class="ponto" data-trecho="${i}" data-tipo="saida" cx="${t.saida.x}" cy="${t.saida.y}" r="7" fill="#5dd39e" stroke="#fff" stroke-width="1.5" />
        <text x="${t.saida.x + 12}" y="${t.saida.y - 8}" fill="#5dd39e" font-size="10" font-weight="700">S ${t.nome.replace('CURVA ', '')}</text>` : ''}
      `).join('')}
    </g>
  </g>
</svg>

<div class="toolbar">
  <button class="btn btn-sec" id="resetZoom">Voltar ao zoom inicial</button>
  <button class="btn btn-sec" id="zoomIn">+</button>
  <button class="btn btn-sec" id="zoomOut">−</button>
  <span class="info" id="zoomInfo">Zoom: 100%</span>
  <span class="info">Rolar mouse = zoom · Shift+arrastar = mover · Arrastar ponto = reposicionar</span>
</div>
</div>

<div class="side">
  <h1>Editor de entrada e saída</h1>
  <div class="sub">Você marca só a barrinha de entrada (laranja) e a de saída (verde) de cada curva. O ápice é descoberto automaticamente pelo aplicativo a partir da melhor passagem do piloto.</div>

  <div class="card">
    <h3>Como usar</h3>
    <div class="help">
      <strong>Rolar mouse</strong>: zoom no ponto onde está o cursor<br>
      <strong>Shift + arrastar fundo</strong>: mover o mapa<br>
      <strong>Arrastar ponto colorido</strong>: reposicionar o ponto<br>
      <strong>Clicar em uma curva da lista abaixo</strong>: ir até ela ampliada
    </div>
  </div>

  <div class="card">
    <h3>Ajustes do desenho (azul)</h3>
    <div class="help" style="margin-bottom:8px">Os pontos coloridos seguem o desenho automaticamente quando você mexe nesses controles.</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      <div><label style="font-size:11px;color:var(--muted)">Largura <span style="color:var(--ouro);float:right" id="vScX">100,00%</span></label><input type="range" id="scX" min="50" max="150" step="0.05" value="100" style="width:100%"></div>
      <div><label style="font-size:11px;color:var(--muted)">Altura <span style="color:var(--ouro);float:right" id="vScY">100,00%</span></label><input type="range" id="scY" min="50" max="150" step="0.05" value="100" style="width:100%"></div>
      <div><label style="font-size:11px;color:var(--muted)">Girar <span style="color:var(--ouro);float:right" id="vRotD">0,00°</span></label><input type="range" id="rotD" min="-180" max="180" step="0.1" value="0" style="width:100%"></div>
      <div><label style="font-size:11px;color:var(--muted)">Mover horizontal <span style="color:var(--ouro);float:right" id="vTxD">0</span></label><input type="range" id="txD" min="-200" max="200" step="1" value="0" style="width:100%"></div>
      <div><label style="font-size:11px;color:var(--muted)">Mover vertical <span style="color:var(--ouro);float:right" id="vTyD">0</span></label><input type="range" id="tyD" min="-200" max="200" step="1" value="0" style="width:100%"></div>
    </div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn btn-sec" id="zerarDesenho">Zerar transformação</button>
    </div>
  </div>

  <div class="card">
    <h3>Trechos pedagógicos</h3>
    <div id="listaTrechos"></div>
  </div>

  <div class="card">
    <h3>Último ponto editado</h3>
    <div class="ponto-info" id="ultimoPonto">Nenhum ainda</div>
  </div>

  <div class="card">
    <h3>Salvar alterações</h3>
    <div class="help">Quando estiver satisfeito com os pontos, clique no botão pra exportar todos. Eu pego os números e gravo no cadastro com cópia de segurança antes.</div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn btn-ok" id="exportar">Exportar pontos</button>
      <button class="btn btn-sec" id="restaurar">Restaurar originais</button>
    </div>
    <div class="resultado" id="resultado" style="display:none"></div>
  </div>
</div>

<div class="toast" id="toast"></div>
</div>

<script>
const trechos = ${JSON.stringify(trechos)};
const trechosOriginais = JSON.parse(JSON.stringify(trechos));

const svg = document.getElementById('mapa');
const desenhoGrupo = document.getElementById('desenho-grupo');
const VB_W = ${vb.largura};
const VB_H = ${vb.altura};

// ── Transformação do desenho (sliders) ─────────────────────────
// Centro pivot do desenho oficial pra rotação/escala
const PIVOT_CX = ${(167 + 688) / 2};
const PIVOT_CY = ${(144 + 713) / 2};
function aplicarTransformDesenho() {
  const sx = (+document.getElementById('scX').value) / 100;
  const sy = (+document.getElementById('scY').value) / 100;
  const r = +document.getElementById('rotD').value;
  const x = +document.getElementById('txD').value;
  const y = +document.getElementById('tyD').value;
  desenhoGrupo.setAttribute('transform',
    \`translate(\${PIVOT_CX + x},\${PIVOT_CY + y}) rotate(\${r}) scale(\${sx},\${sy}) translate(\${-PIVOT_CX},\${-PIVOT_CY})\`);
  document.getElementById('vScX').textContent = (sx*100).toFixed(2).replace('.', ',') + '%';
  document.getElementById('vScY').textContent = (sy*100).toFixed(2).replace('.', ',') + '%';
  document.getElementById('vRotD').textContent = r.toFixed(2).replace('.', ',') + '°';
  document.getElementById('vTxD').textContent = x;
  document.getElementById('vTyD').textContent = y;
}

let view = { x: 0, y: 0, w: VB_W, h: VB_H };
function aplicarView() {
  svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  document.getElementById('zoomInfo').textContent = 'Zoom: ' + Math.round(VB_W / view.w * 100) + '%';
}
function resetZoom() {
  view = { x: 0, y: 0, w: VB_W, h: VB_H };
  aplicarView();
}
document.getElementById('resetZoom').onclick = resetZoom;
document.getElementById('zoomIn').onclick = () => zoomAt(VB_W/2, VB_H/2, 0.7);
document.getElementById('zoomOut').onclick = () => zoomAt(VB_W/2, VB_H/2, 1/0.7);

// Zoom com rolagem do mouse
svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pt = svgPoint(e);
  const fator = e.deltaY > 0 ? 1.15 : 1/1.15;
  zoomAt(pt.x, pt.y, fator);
}, { passive: false });

function zoomAt(cx, cy, fator) {
  const novaW = view.w * fator;
  const novaH = view.h * fator;
  // Mantém o ponto (cx, cy) no mesmo lugar visual
  view.x = cx - (cx - view.x) * fator;
  view.y = cy - (cy - view.y) * fator;
  view.w = novaW;
  view.h = novaH;
  aplicarView();
}

// Converte clientX/clientY (pixel da tela) pra coords do viewBox do
// SVG. Cálculo manual usando o viewBox atual + tamanho do SVG —
// evita bugs do getScreenCTM em alguns navegadores que retornam
// matrix em pixels de tela ao invés de coords de viewBox.
function clientToViewBox(evt) {
  const rect = svg.getBoundingClientRect();
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  const aspectSvg = rect.width / rect.height;
  const aspectVb = vw / vh;
  let scale, offsetX = 0, offsetY = 0;
  if (aspectSvg > aspectVb) {
    // SVG mais largo que viewBox — barras (vazio) nas laterais
    scale = rect.height / vh;
    offsetX = (rect.width - vw * scale) / 2;
  } else {
    scale = rect.width / vw;
    offsetY = (rect.height - vh * scale) / 2;
  }
  return {
    x: vx + (evt.clientX - rect.left - offsetX) / scale,
    y: vy + (evt.clientY - rect.top - offsetY) / scale,
  };
}
const svgPoint = clientToViewBox;
// Quando o grupo do desenho está com transform aplicado (rotação,
// escala, mover), converter da tela pro espaço interno do grupo
// precisa inverter o transform também.
function svgPointInDesenhoGrupo(evt) {
  const pvb = clientToViewBox(evt);
  // Aplica inverso do transform atual do grupo:
  // Estado atual dos sliders → matrix M; queremos inv(M) aplicado em pvb.
  const sx = (+document.getElementById('scX').value) / 100;
  const sy = (+document.getElementById('scY').value) / 100;
  const r = (+document.getElementById('rotD').value) * Math.PI / 180;
  const tx = +document.getElementById('txD').value;
  const ty = +document.getElementById('tyD').value;
  // M = T(PIVOT + tx,ty) · R(r) · S(sx,sy) · T(-PIVOT)
  // inv(M) = T(PIVOT) · S(1/sx,1/sy) · R(-r) · T(-(PIVOT + tx,ty))
  let px = pvb.x - (PIVOT_CX + tx);
  let py = pvb.y - (PIVOT_CY + ty);
  const cos = Math.cos(-r), sin = Math.sin(-r);
  let rx = px * cos - py * sin;
  let ry = px * sin + py * cos;
  rx = sx === 0 ? 0 : rx / sx;
  ry = sy === 0 ? 0 : ry / sy;
  return { x: rx + PIVOT_CX, y: ry + PIVOT_CY };
}

// Pan com shift+arrastar OU botão do meio
let panAtivo = false, panInicio = null;
svg.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('ponto')) return; // ponto tem handler próprio
  if (e.shiftKey || e.button === 1) {
    panAtivo = true;
    panInicio = svgPoint(e);
    svg.classList.add('dragging');
    e.preventDefault();
  }
});
window.addEventListener('mousemove', (e) => {
  if (panAtivo) {
    const p = svgPoint(e);
    view.x -= (p.x - panInicio.x);
    view.y -= (p.y - panInicio.y);
    aplicarView();
  } else if (pontoArrastado) {
    const p = svgPointInDesenhoGrupo(e);
    moverPonto(pontoArrastado, p.x, p.y);
  }
});
window.addEventListener('mouseup', () => {
  panAtivo = false;
  svg.classList.remove('dragging');
  if (pontoArrastado) {
    pontoArrastado.el.classList.remove('arrastando');
    pontoArrastado = null;
  }
});

// Arrastar pontos
let pontoArrastado = null;
svg.addEventListener('mousedown', (e) => {
  if (!e.target.classList.contains('ponto')) return;
  if (e.shiftKey) return;
  pontoArrastado = {
    el: e.target,
    trecho: +e.target.dataset.trecho,
    tipo: e.target.dataset.tipo,
  };
  e.target.classList.add('arrastando');
  e.preventDefault();
});

function moverPonto(p, x, y) {
  p.el.setAttribute('cx', x.toFixed(1));
  p.el.setAttribute('cy', y.toFixed(1));
  // Move junto a barrinha de entrada/saída (linha perpendicular)
  if (p.tipo === 'entrada' || p.tipo === 'saida') {
    const barrinha = svg.querySelector(\`line.barrinha[data-trecho="\${p.trecho}"][data-tipo="\${p.tipo}"]\`);
    if (barrinha) {
      // Calcula direção tangente à pista no ponto (estimativa simples:
      // toma 2 pontos do desenho próximos pra calcular a perpendicular)
      barrinha.setAttribute('x1', (x - 14).toFixed(1));
      barrinha.setAttribute('y1', y.toFixed(1));
      barrinha.setAttribute('x2', (x + 14).toFixed(1));
      barrinha.setAttribute('y2', y.toFixed(1));
    }
  }
  // Atualiza texto da label do ponto — próximo <text> depois do círculo
  let text = p.el.nextElementSibling;
  while (text && text.tagName !== 'text') text = text.nextElementSibling;
  if (text) {
    const dx = (p.tipo === 'apice') ? 12 : 12;
    const dy = (p.tipo === 'apice') ? 4 : -8;
    text.setAttribute('x', (x + dx).toFixed(1));
    text.setAttribute('y', (y + dy).toFixed(1));
  }
  // Atualiza no estado
  trechos[p.trecho][p.tipo] = { x: +x.toFixed(1), y: +y.toFixed(1) };
  // Mostra no painel
  document.getElementById('ultimoPonto').textContent =
    trechos[p.trecho].nome + ' · ' + p.tipo + '\\n' +
    'x: ' + x.toFixed(1) + ' · y: ' + y.toFixed(1);
  salvarEstado();
}

// Lista de trechos
const lista = document.getElementById('listaTrechos');
lista.innerHTML = trechos.map((t, i) => \`
  <div class="trecho-row" data-trecho="\${i}">
    <div>
      <div class="nome">\${t.nome}</div>
      <div class="par">Parcial \${t.parcial}</div>
    </div>
    <div class="ir">ir</div>
  </div>
\`).join('');
lista.querySelectorAll('.trecho-row').forEach(el => {
  el.addEventListener('click', () => {
    const i = +el.dataset.trecho;
    focar(i);
    document.querySelectorAll('.trecho-row').forEach(r => r.classList.remove('ativo'));
    el.classList.add('ativo');
  });
});

function focar(i) {
  const t = trechos[i];
  const ptsBrutos = [t.entrada, t.saida].filter(Boolean);
  if (ptsBrutos.length === 0) return;
  // IMPORTANTE: aplicar a matriz do desenho-grupo pra obter as
  // coordenadas FINAIS dos pontos (depois de qualquer transformação
  // que o usuário fez nos sliders). Sem isso, o zoom vai pra posição
  // antiga do ponto.
  const matrix = desenhoGrupo.getCTM();
  const pts = ptsBrutos.map(p => {
    const pt = svg.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    return pt.matrixTransform(matrix);
  });
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Zoom focado: caixa ~200×200 unidades em volta do trecho
  view = { x: cx - 100, y: cy - 100, w: 200, h: 200 };
  aplicarView();
}

// Sliders do desenho — wire + persistência em localStorage
const LS_KEY = 'p1fast-editor-pontos-brasilia-v3-coord-corrigida';
function salvarEstado() {
  const estado = {
    sliders: {
      scX: +document.getElementById('scX').value,
      scY: +document.getElementById('scY').value,
      rotD: +document.getElementById('rotD').value,
      txD: +document.getElementById('txD').value,
      tyD: +document.getElementById('tyD').value,
    },
    trechos: trechos.map(t => ({
      id: t.id, entrada: t.entrada, apice: t.apice, saida: t.saida,
    })),
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(estado)); } catch(_) {}
}
function carregarEstado() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const est = JSON.parse(raw);
    if (est.sliders) {
      document.getElementById('scX').value = est.sliders.scX;
      document.getElementById('scY').value = est.sliders.scY;
      document.getElementById('rotD').value = est.sliders.rotD;
      document.getElementById('txD').value = est.sliders.txD;
      document.getElementById('tyD').value = est.sliders.tyD;
    }
    if (est.trechos) {
      for (let i = 0; i < trechos.length; i++) {
        const e = est.trechos[i];
        if (!e || e.id !== trechos[i].id) continue;
        if (e.entrada) trechos[i].entrada = e.entrada;
        if (e.apice) trechos[i].apice = e.apice;
        if (e.saida) trechos[i].saida = e.saida;
        // Atualiza posição visual dos círculos
        document.querySelectorAll(\`circle[data-trecho="\${i}"]\`).forEach(el => {
          const tipo = el.dataset.tipo;
          const p = trechos[i][tipo];
          if (p) {
            el.setAttribute('cx', p.x);
            el.setAttribute('cy', p.y);
            const text = el.nextElementSibling;
            if (text && text.tagName === 'text') {
              text.setAttribute('x', (p.x + 10).toFixed(1));
              text.setAttribute('y', (p.y + 3).toFixed(1));
            }
          }
        });
      }
    }
  } catch (e) { console.warn('Não consegui carregar estado salvo:', e); }
}

['scX','scY','rotD','txD','tyD'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    aplicarTransformDesenho();
    salvarEstado();
  });
});
document.getElementById('zerarDesenho').onclick = () => {
  document.getElementById('scX').value = 100;
  document.getElementById('scY').value = 100;
  document.getElementById('rotD').value = 0;
  document.getElementById('txD').value = 0;
  document.getElementById('tyD').value = 0;
  aplicarTransformDesenho();
};

// Aplica a matriz final do desenho ao ponto pra obter a coord no
// viewBox da pista. Cálculo MANUAL — não usa getCTM() porque
// alguns navegadores retornam coords em pixel da tela (bug histórico
// do WebKit) em vez do viewport SVG.
function pontoFinal(cxInterno, cyInterno) {
  const sx = (+document.getElementById('scX').value) / 100;
  const sy = (+document.getElementById('scY').value) / 100;
  const r = (+document.getElementById('rotD').value) * Math.PI / 180;
  const tx = +document.getElementById('txD').value;
  const ty = +document.getElementById('tyD').value;
  // M = T(PIVOT + tx,ty) · R(r) · S(sx,sy) · T(-PIVOT)
  let px = cxInterno - PIVOT_CX;
  let py = cyInterno - PIVOT_CY;
  px *= sx; py *= sy;
  const cos = Math.cos(r), sin = Math.sin(r);
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;
  return {
    x: +(rx + PIVOT_CX + tx).toFixed(1),
    y: +(ry + PIVOT_CY + ty).toFixed(1),
  };
}

document.getElementById('exportar').onclick = () => {
  // Captura os 5 parâmetros do desenho
  const transformacao = {
    largura_pct: +(+document.getElementById('scX').value).toFixed(2),
    altura_pct: +(+document.getElementById('scY').value).toFixed(2),
    rotacao_graus: +(+document.getElementById('rotD').value).toFixed(2),
    mover_horizontal: +document.getElementById('txD').value,
    mover_vertical: +document.getElementById('tyD').value,
  };
  // Calcula a posição FINAL de cada ponto (após transformação).
  // Só entrada e saída — o ápice é calculado automaticamente pelo
  // aplicativo a partir da melhor passagem do piloto.
  const dados = trechos.map(t => ({
    id: t.id, nome: t.nome,
    entradas: t.entrada ? [pontoFinal(t.entrada.x, t.entrada.y)] : [],
    saidas: t.saida ? [pontoFinal(t.saida.x, t.saida.y)] : [],
  }));
  const payload = { transformacao_aplicada_no_desenho: transformacao, trechos: dados };
  const txt = JSON.stringify(payload, null, 2);
  document.getElementById('resultado').style.display = 'block';
  document.getElementById('resultado').textContent = txt;
  navigator.clipboard.writeText(txt);
  toast('Exportado e copiado! Cole na conversa.');
};

document.getElementById('restaurar').onclick = () => {
  if (!confirm('Voltar todos os pontos pras posições originais?')) return;
  trechos.forEach((t, i) => {
    t.entrada = trechosOriginais[i].entrada ? {...trechosOriginais[i].entrada} : null;
    t.apice = trechosOriginais[i].apice ? {...trechosOriginais[i].apice} : null;
    t.saida = trechosOriginais[i].saida ? {...trechosOriginais[i].saida} : null;
  });
  // Recarrega visualmente todos os círculos
  document.querySelectorAll('.ponto').forEach(el => {
    const i = +el.dataset.trecho, tipo = el.dataset.tipo;
    const p = trechosOriginais[i][tipo];
    if (p) {
      el.setAttribute('cx', p.x);
      el.setAttribute('cy', p.y);
      const text = el.nextElementSibling;
      if (text && text.tagName === 'text') {
        text.setAttribute('x', (p.x + 10).toFixed(1));
        text.setAttribute('y', (p.y + 3).toFixed(1));
      }
    }
  });
  toast('Pontos restaurados pras posições originais.');
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

carregarEstado();
resetZoom();
aplicarTransformDesenho();
</script>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/EDITOR-pontos-trechos-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('Editor de pontos gerado:', out);
