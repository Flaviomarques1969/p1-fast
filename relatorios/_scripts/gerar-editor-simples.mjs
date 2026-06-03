// Editor de pontos SIMPLES — só mapa, pontos, arrastar
// ────────────────────────────────────────────────────
// Sem sliders. Sem transformação geral. Só:
//  - desenho da pista + GPS
//  - 16 pontos (8 entradas, 8 saídas) com barrinhas
//  - rolar o mouse pra dar zoom no ponto do cursor
//  - clicar e arrastar pra reposicionar
//  - botão "Focar" em cada curva pra zoom rápido
//  - exportar copia os 16 pontos

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { lat: Number(lat), lng: Number(lng) };
});

// Bounds ORIGINAIS do desenho (antes de qualquer transformação) —
// usados pra posicionar o trajeto verde sempre no mesmo lugar do
// viewBox, independentemente de o desenho da pista ter sido encolhido,
// girado ou movido pelo Flávio.
const xMinPath = 167, xMaxPath = 688, yMinPath = 144, yMaxPath = 713;

const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
const margemPct = 0.04;
const tx0 = xMinPath + (xMaxPath - xMinPath) * margemPct;
const tx1 = xMaxPath - (xMaxPath - xMinPath) * margemPct;
const ty0 = yMinPath + (yMaxPath - yMinPath) * margemPct;
const ty1 = yMaxPath - (yMaxPath - yMinPath) * margemPct;
const trajeto = samples.map(s => ({
  x: +(tx0 + (s.lng - lngMin) / (lngMax - lngMin) * (tx1 - tx0)).toFixed(1),
  y: +(ty0 + (latMax - s.lat) / (latMax - latMin) * (ty1 - ty0)).toFixed(1),
}));

const trechos = mapa.trechos
  .filter(t => t.eh_trecho_pedagogico)
  .map(t => ({
    id: t.id,
    nome: t.nome,
    entrada: t.entradas?.[0] || null,
    saida: t.saidas?.[0] || null,
  }));

const vb = mapa.pista.view_box;
const linha = mapa.pista.linha_chegada;

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Editor de entrada/saída · Brasília</title>
<style>
  :root{--bg:#0b1220;--panel:#101a2e;--panel2:#15233d;--line:#1f2f4d;--ink:#e8eef9;--muted:#8ea0c1;--accent:#5da3ff;--ok:#5dd39e;--warn:#ffb454;--bad:#ff6b6b;--ouro:#e79800;}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;overflow:hidden;height:100%}
  body{background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .map-area{width:100vw;height:100vh;background:var(--bg);position:relative;overflow:hidden}
  .map-area svg{width:100%;height:100%;display:block;cursor:grab;touch-action:none}
  .map-area svg.dragging{cursor:grabbing}
  .toolbar{position:absolute;top:14px;left:14px;display:flex;gap:8px;z-index:10;align-items:center;background:rgba(11,18,32,.9);padding:8px 12px;border-radius:8px;border:1px solid var(--line);backdrop-filter:blur(8px)}
  .toolbar .btn{padding:8px 14px;font-size:12px;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:5px;cursor:pointer;font-weight:600}
  .toolbar .btn:hover{background:#1a2a4a}
  .toolbar .btn.ok{background:var(--ok);color:var(--bg);border-color:var(--ok)}
  .toolbar .info{color:var(--muted);font-size:11px;margin-left:6px}
  .resultado-box{position:absolute;bottom:14px;right:14px;max-width:380px;max-height:240px;background:var(--panel);border:1px solid var(--ok);border-radius:8px;padding:10px;font-family:"SF Mono",ui-monospace,monospace;font-size:10px;line-height:1.4;color:var(--ok);overflow:auto;z-index:10;display:none;backdrop-filter:blur(8px)}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ouro);color:var(--bg);padding:10px 18px;border-radius:8px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none;z-index:99}
  .toast.show{opacity:1}
  .ponto{cursor:grab}
  .ponto:hover{filter:brightness(1.3)}
  .barrinha{pointer-events:none}
  text{user-select:none;pointer-events:none}
</style>
</head>
<body>
<div class="map-area">
<svg id="mapa" viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
  <path d="${svgPath}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.7" />
  <polyline points="${trajeto.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="2.5" opacity="0.9" />
  <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#ffb454" stroke-width="3" />
  <g id="pontos">
    ${trechos.map((t, i) => `
      ${t.entrada ? `
      <line class="barrinha" data-trecho="${i}" data-tipo="entrada" x1="${t.entrada.x - 14}" y1="${t.entrada.y}" x2="${t.entrada.x + 14}" y2="${t.entrada.y}" stroke="#ffb454" stroke-width="4" stroke-linecap="round" opacity="0.85" />
      <circle class="ponto" data-trecho="${i}" data-tipo="entrada" cx="${t.entrada.x}" cy="${t.entrada.y}" r="8" fill="#ffb454" stroke="#fff" stroke-width="1.5" />
      <text x="${t.entrada.x + 12}" y="${t.entrada.y - 9}" fill="#ffb454" font-size="10" font-weight="700">E ${t.nome.replace('CURVA ', '')}</text>` : ''}
      ${t.saida ? `
      <line class="barrinha" data-trecho="${i}" data-tipo="saida" x1="${t.saida.x - 14}" y1="${t.saida.y}" x2="${t.saida.x + 14}" y2="${t.saida.y}" stroke="#5dd39e" stroke-width="4" stroke-linecap="round" opacity="0.85" />
      <circle class="ponto" data-trecho="${i}" data-tipo="saida" cx="${t.saida.x}" cy="${t.saida.y}" r="8" fill="#5dd39e" stroke="#fff" stroke-width="1.5" />
      <text x="${t.saida.x + 12}" y="${t.saida.y - 9}" fill="#5dd39e" font-size="10" font-weight="700">S ${t.nome.replace('CURVA ', '')}</text>` : ''}
    `).join('')}
  </g>
</svg>

<div class="toolbar">
  <button class="btn" id="resetZoom">Pista inteira</button>
  <button class="btn" id="zoomIn">+</button>
  <button class="btn" id="zoomOut">−</button>
  <span class="info" id="zoomInfo">100%</span>
  <button class="btn ok" id="exportar" style="margin-left:10px">Copiar pontos</button>
  <button class="btn" id="restaurar">Restaurar originais</button>
  <span class="info">Rolar mouse = zoom · Shift+arrastar = mover · arrastar bolinha = reposicionar</span>
</div>
<div class="resultado-box" id="resultado"></div>
</div>

<div class="toast" id="toast"></div>

<script>
const trechos = ${JSON.stringify(trechos)};
const trechosOriginais = JSON.parse(JSON.stringify(trechos));
const svg = document.getElementById('mapa');
const VB_W = ${vb.largura}, VB_H = ${vb.altura};
let view = { x: 0, y: 0, w: VB_W, h: VB_H };

function aplicarView() {
  svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  document.getElementById('zoomInfo').textContent = Math.round(VB_W / view.w * 100) + '%';
}
function resetZoom() { view = {x:0,y:0,w:VB_W,h:VB_H}; aplicarView(); }
function zoomAt(cx, cy, fator) {
  view.x = cx - (cx - view.x) * fator;
  view.y = cy - (cy - view.y) * fator;
  view.w *= fator; view.h *= fator;
  aplicarView();
}

document.getElementById('resetZoom').onclick = resetZoom;
document.getElementById('zoomIn').onclick = () => zoomAt(view.x + view.w/2, view.y + view.h/2, 0.7);
document.getElementById('zoomOut').onclick = () => zoomAt(view.x + view.w/2, view.y + view.h/2, 1/0.7);

// CLIENT → VIEWBOX (cálculo manual, robusto a qualquer browser)
function clientToVB(evt) {
  const r = svg.getBoundingClientRect();
  const aSvg = r.width / r.height;
  const aVb = view.w / view.h;
  let s, ox = 0, oy = 0;
  if (aSvg > aVb) {
    s = r.height / view.h;
    ox = (r.width - view.w * s) / 2;
  } else {
    s = r.width / view.w;
    oy = (r.height - view.h * s) / 2;
  }
  return {
    x: view.x + (evt.clientX - r.left - ox) / s,
    y: view.y + (evt.clientY - r.top - oy) / s,
  };
}

// Zoom com rolagem do mouse
svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pt = clientToVB(e);
  zoomAt(pt.x, pt.y, e.deltaY > 0 ? 1.15 : 1/1.15);
}, { passive: false });

// Pan com Shift + arrastar
let pan = null;
svg.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('ponto')) return;
  if (e.shiftKey || e.button === 1) {
    pan = clientToVB(e);
    svg.classList.add('dragging');
    e.preventDefault();
  }
});

// Arrastar pontos
let arrastando = null;
svg.addEventListener('mousedown', (e) => {
  if (!e.target.classList.contains('ponto')) return;
  arrastando = { el: e.target, trecho: +e.target.dataset.trecho, tipo: e.target.dataset.tipo };
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (pan) {
    const p = clientToVB(e);
    view.x -= (p.x - pan.x);
    view.y -= (p.y - pan.y);
    aplicarView();
  } else if (arrastando) {
    const p = clientToVB(e);
    moverPonto(arrastando, p.x, p.y);
  }
});
window.addEventListener('mouseup', () => {
  pan = null;
  svg.classList.remove('dragging');
  arrastando = null;
});

function moverPonto(p, x, y) {
  p.el.setAttribute('cx', x.toFixed(1));
  p.el.setAttribute('cy', y.toFixed(1));
  // barrinha
  const barra = svg.querySelector(\`line.barrinha[data-trecho="\${p.trecho}"][data-tipo="\${p.tipo}"]\`);
  if (barra) {
    barra.setAttribute('x1', (x - 14).toFixed(1));
    barra.setAttribute('y1', y.toFixed(1));
    barra.setAttribute('x2', (x + 14).toFixed(1));
    barra.setAttribute('y2', y.toFixed(1));
  }
  // texto
  let txt = p.el.nextElementSibling;
  while (txt && txt.tagName !== 'text') txt = txt.nextElementSibling;
  if (txt) {
    txt.setAttribute('x', (x + 12).toFixed(1));
    txt.setAttribute('y', (y - 9).toFixed(1));
  }
  trechos[p.trecho][p.tipo] = { x: +x.toFixed(1), y: +y.toFixed(1) };
  salvar();
}

// Sem lista lateral — você navega pelo mapa com zoom + Shift+arrastar.

// Persistência
const KEY = 'p1fast-editor-simples-v1';
function salvar() {
  try { localStorage.setItem(KEY, JSON.stringify(trechos.map(t => ({id:t.id, entrada:t.entrada, saida:t.saida})))); } catch(_) {}
}
function carregar() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
    const est = JSON.parse(raw);
    for (let i = 0; i < trechos.length; i++) {
      const e = est[i]; if (!e || e.id !== trechos[i].id) continue;
      if (e.entrada) trechos[i].entrada = e.entrada;
      if (e.saida) trechos[i].saida = e.saida;
      ['entrada','saida'].forEach(tipo => {
        const p = trechos[i][tipo]; if (!p) return;
        const circ = svg.querySelector(\`circle.ponto[data-trecho="\${i}"][data-tipo="\${tipo}"]\`);
        if (circ) {
          circ.setAttribute('cx', p.x); circ.setAttribute('cy', p.y);
          const barra = svg.querySelector(\`line.barrinha[data-trecho="\${i}"][data-tipo="\${tipo}"]\`);
          if (barra) {
            barra.setAttribute('x1', (p.x - 14).toFixed(1)); barra.setAttribute('y1', p.y);
            barra.setAttribute('x2', (p.x + 14).toFixed(1)); barra.setAttribute('y2', p.y);
          }
          let txt = circ.nextElementSibling;
          while (txt && txt.tagName !== 'text') txt = txt.nextElementSibling;
          if (txt) { txt.setAttribute('x', (p.x + 12).toFixed(1)); txt.setAttribute('y', (p.y - 9).toFixed(1)); }
        }
      });
    }
  } catch(_) {}
}

// Exportar
document.getElementById('exportar').onclick = () => {
  const dados = trechos.map(t => ({
    id: t.id, nome: t.nome,
    entradas: t.entrada ? [t.entrada] : [],
    saidas: t.saida ? [t.saida] : [],
  }));
  const txt = JSON.stringify({ trechos: dados }, null, 2);
  const r = document.getElementById('resultado');
  r.style.display = 'block';
  r.textContent = txt;
  navigator.clipboard.writeText(txt);
  toast('Copiado! Cole na conversa.');
};
document.getElementById('restaurar').onclick = () => {
  if (!confirm('Voltar todos os pontos pras posições originais?')) return;
  for (let i = 0; i < trechos.length; i++) {
    trechos[i].entrada = trechosOriginais[i].entrada ? {...trechosOriginais[i].entrada} : null;
    trechos[i].saida = trechosOriginais[i].saida ? {...trechosOriginais[i].saida} : null;
  }
  localStorage.removeItem(KEY);
  carregar();
  // forçar redesenho mesmo sem localStorage
  for (let i = 0; i < trechos.length; i++) {
    ['entrada','saida'].forEach(tipo => {
      const p = trechos[i][tipo]; if (!p) return;
      const circ = svg.querySelector(\`circle.ponto[data-trecho="\${i}"][data-tipo="\${tipo}"]\`);
      if (circ) {
        circ.setAttribute('cx', p.x); circ.setAttribute('cy', p.y);
        const barra = svg.querySelector(\`line.barrinha[data-trecho="\${i}"][data-tipo="\${tipo}"]\`);
        if (barra) { barra.setAttribute('x1', p.x - 14); barra.setAttribute('y1', p.y); barra.setAttribute('x2', p.x + 14); barra.setAttribute('y2', p.y); }
      }
    });
  }
  toast('Pontos restaurados.');
};

function toast(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

carregar();
aplicarView();
</script>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/EDITOR-simples-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('Editor simples:', out);
