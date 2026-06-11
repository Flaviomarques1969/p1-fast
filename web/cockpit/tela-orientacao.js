// tela-orientacao.js — a tela "Oportunidade do Trecho" (contrato de design v3,
// aprovado pelo Flávio 09/06: _design-reference/versions/
// mockup-oportunidade-trecho-v3-APROVADO-2026-06-09.html).
//
// Regras do contrato:
//   - Curva REAL (desenho oficial, sem suavização), na VISÃO DO PILOTO
//     (chegada por baixo, apontando pra cima).
//   - VERMELHO = onde ele fez · VERDE = onde queremos que faça. Sem seta.
//   - Verbo no alto à direita; dado embaixo (número de lugar OU gráfico de pedal).
//   - Sem nome de curva, sem segundos de ganho, sem comparação "N carros".
//   - Mensagens críticas atropelam (o chamador esconde esta tela).
//
// API: criarTelaOrientacao({ container }) →
//   { mostrar(segment, orientacao, opts), esconder(), mostrarResumoVolta(resumo), visivel() }

import { PONTOS_DESENHO, geoParaDesenho } from './pista-oficial-brasilia.js';

const CSS = `
.p1-orient { position:fixed; inset:0; background:oklch(0% 0 0); z-index:880; display:none;
  font-family:'Inter',system-ui,sans-serif; color:oklch(100% 0 0); overflow:hidden; }
.p1-orient[data-on="1"] { display:block; }
.p1-orient .halo { position:absolute; inset:-20%; background:
  radial-gradient(ellipse 55% 70% at 35% 55%, oklch(78% 0.18 65 / .42), transparent 60%); opacity:.45; }
.p1-orient .regua { position:absolute; top:0; left:0; height:5px; width:100%;
  background:linear-gradient(90deg, oklch(74% 0.16 73), oklch(85% 0.17 80));
  box-shadow:0 0 12px oklch(78% 0.18 65 / .42); transition:width .2s linear; }
.p1-orient .palco { position:absolute; left:0; top:1%; bottom:1%; width:56%; }
.p1-orient .palco svg { width:100%; height:100%; }
.p1-orient .pista { fill:none; stroke:oklch(32% 0 0); stroke-width:17; stroke-linecap:round; stroke-linejoin:round; }
.p1-orient .zona { fill:none; stroke:oklch(74% 0.16 73); stroke-width:17; stroke-linecap:round;
  filter:drop-shadow(0 0 18px oklch(78% 0.18 65 / .42)); animation:p1orRespira 1.5s ease-in-out infinite; }
@keyframes p1orRespira { 0%,100% { opacity:.95; } 50% { opacity:.55; } }
.p1-orient .mvoce { stroke:oklch(68% 0.26 27); stroke-width:4; }
.p1-orient .mouro { stroke:oklch(80% 0.22 145); stroke-width:5; filter:drop-shadow(0 0 10px oklch(80% 0.22 145 / .4)); }
.p1-orient .apice-anel { fill:none; stroke:oklch(80% 0.22 145); stroke-width:2.5; animation:p1orRespira 1.5s ease-in-out infinite; }
.p1-orient .apice-bola { fill:oklch(80% 0.22 145); filter:drop-shadow(0 0 12px oklch(80% 0.22 145 / .4)); }
.p1-orient .carro { fill:oklch(100% 0 0); opacity:.9; }
/* Par verbo+dado JUNTO, centrado na vertical — distância equilibrada com a curva
   da esquerda. Antes era justify-content:space-between + margin-top:auto (extremos
   com buraco no meio); Flávio mandou aproximar em 10/06/2026. */
.p1-orient .acao { position:absolute; right:3%; top:50%; transform:translateY(-50%); width:44%; text-align:right;
  display:flex; flex-direction:column; justify-content:center; gap:5vh; align-items:flex-end; }
.p1-orient .verbo { font-size:clamp(44px, 6vw, 80px); font-weight:900; letter-spacing:2px; line-height:1.02; }
.p1-orient .verbo b { color:oklch(80% 0.22 145); }
.p1-orient .dado { font-family:'JetBrains Mono',ui-monospace,monospace; font-weight:900;
  letter-spacing:-2px; font-size:clamp(80px, 12vw, 150px); line-height:.95; color:oklch(80% 0.22 145);
  font-variant-numeric:tabular-nums; text-shadow:0 0 30px oklch(80% 0.22 145 / .4); width:100%; }
.p1-orient .dado small { font-size:.34em; letter-spacing:0; font-weight:800; opacity:.75; margin-left:4px; }
.p1-orient .resumo { position:absolute; inset:0; display:none; flex-direction:column;
  align-items:center; justify-content:center; gap:2vh; }
.p1-orient[data-modo="resumo"] .resumo { display:flex; }
.p1-orient[data-modo="resumo"] .palco, .p1-orient[data-modo="resumo"] .acao, .p1-orient[data-modo="resumo"] .halo { display:none; }
.p1-orient .resumo .vn { font-size:clamp(14px,2vw,20px); letter-spacing:3px; color:oklch(58% 0 0); font-weight:800; }
.p1-orient .resumo .vt { font-family:'JetBrains Mono',ui-monospace,monospace; font-weight:900;
  font-size:clamp(70px, 12vw, 150px); line-height:1; font-variant-numeric:tabular-nums; }
.p1-orient .resumo .vt.bom { color:oklch(80% 0.22 145); } .p1-orient .resumo .vt.ruim { color:oklch(68% 0.26 27); }
.p1-orient .resumo .vm { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:clamp(18px,2.6vw,28px);
  color:oklch(74% 0.16 73); font-weight:800; }
`;

const NS = 'http://www.w3.org/2000/svg';

function nearIdx(pts, p) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dd = (pts[i][0] - p.x) ** 2 + (pts[i][1] - p.y) ** 2;
    if (dd < bd) { bd = dd; bi = i; }
  }
  return bi;
}

function centroLinha(linha) {
  return { lat: (linha.a.lat + linha.b.lat) / 2, lng: (linha.a.lng + linha.b.lng) / 2 };
}

/** Fatia do desenho oficial entre as linhas do segmento — SEMPRE no sentido da
 *  pilotagem (= ordem dos pontos do traçado oficial). */
function fatiaSegmento(segment) {
  const e = geoParaDesenho(centroLinha(segment.entradaLine).lat, centroLinha(segment.entradaLine).lng);
  const s = geoParaDesenho(centroLinha(segment.saidaLine).lat, centroLinha(segment.saidaLine).lng);
  const i0 = nearIdx(PONTOS_DESENHO, e), i1 = nearIdx(PONTOS_DESENHO, s);
  const n = PONTOS_DESENHO.length;
  const fwd = (i1 - i0 + n) % n;
  const FOLGA = 16;
  const pts = [];
  for (let k = -FOLGA; k <= fwd + FOLGA; k++) pts.push(PONTOS_DESENHO[((i0 + k) % n + n) % n]);
  return { pts, folga: FOLGA, nucleo: fwd };
}

/** Gira pra visão do piloto: direção de chegada aponta pra CIMA. */
function orientarPiloto(pts, folga) {
  const a = pts[0], b = pts[Math.min(pts.length - 1, folga)];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const rot = -Math.PI / 2 - ang;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return pts.map(p => [a[0] + (p[0] - a[0]) * cos - (p[1] - a[1]) * sin,
                       a[1] + (p[0] - a[0]) * sin + (p[1] - a[1]) * cos]);
}

// O gráfico de pressão do pedal (FREIA MENOS) só pode existir com sensor de
// pedal INSTALADO e desenhado da passagem real — regra Flávio 09/06 ("sem
// sensor, o sistema só infere pelo Vmin e mostra o verbo sem curva"). O SVG
// estático que ficava aqui furava a regra (curvas inventadas, iguais pra
// qualquer passagem) e foi removido em 11/06 (proposta treinos aprovada).
// Quando o sensor chegar, o gráfico volta desenhado dos dados reais.

export function criarTelaOrientacao({ container } = {}) {
  const doc = (container && container.ownerDocument) || document;
  if (!doc.getElementById('p1-orient-css')) {
    const st = doc.createElement('style');
    st.id = 'p1-orient-css';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }
  const raiz = doc.createElement('div');
  raiz.className = 'p1-orient';
  raiz.innerHTML = `
    <div class="halo"></div>
    <div class="regua"></div>
    <div class="palco"><svg viewBox="0 0 560 560" preserveAspectRatio="xMidYMid meet"></svg></div>
    <div class="acao"><div class="verbo"></div><div class="dado"></div></div>
    <div class="resumo"><div class="vn"></div><div class="vt"></div><div class="vm"></div></div>`;
  (container || doc.body).appendChild(raiz);

  const svg = raiz.querySelector('svg');
  const mk = (tag, attrs, cls) => {
    const el = doc.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (cls) el.setAttribute('class', cls);
    svg.appendChild(el);
    return el;
  };

  function desenharCurva(segment, o) {
    svg.innerHTML = '';
    const f = fatiaSegmento(segment);
    let pts = f.pts.map(p => [p[0], p[1]]);
    const apiceXY = geoParaDesenho(segment.apicePoint.lat, segment.apicePoint.lng);
    pts.push([apiceXY.x, apiceXY.y]);
    pts = orientarPiloto(pts, f.folga);
    const ap0 = pts.pop();

    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const M = 80, W = 560, H = 560;
    const esc = Math.min((W - 2 * M) / Math.max(1, maxX - minX), (H - 2 * M) / Math.max(1, maxY - minY));
    const tx = x => (x - minX) * esc + (W - (maxX - minX) * esc) / 2;
    const ty = y => (y - minY) * esc + (H - (maxY - minY) * esc) / 2;
    const P = pts.map(p => [tx(p[0]), ty(p[1])]);

    mk('path', { d: P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') }, 'pista');

    // seta do carro chegando (embaixo, sentido de quem pilota)
    const c0 = P[0], c1 = P[2] || P[1];
    let dx = c1[0] - c0[0], dy = c1[1] - c0[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    mk('path', { d: `M ${c0[0]} ${c0[1]} L ${c0[0] - dx * 16 - (-dy) * 8} ${c0[1] - dy * 16 - dx * 8} L ${c0[0] - dx * 16 + (-dy) * 8} ${c0[1] - dy * 16 + dx * 8} Z` }, 'carro');

    function riscar(frac, cls, comp) {
      const i = Math.max(1, Math.min(P.length - 2, f.folga + Math.floor(f.nucleo * frac)));
      const p = P[i], q = P[i + 1];
      let ux = q[0] - p[0], uy = q[1] - p[1];
      const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      mk('line', { x1: p[0] - (-uy) * comp, y1: p[1] - ux * comp, x2: p[0] + (-uy) * comp, y2: p[1] + ux * comp }, cls);
    }

    if (o.apice) {
      const ax = tx(ap0[0]), ay = ty(ap0[1]);
      mk('circle', { cx: ax, cy: ay, r: 18 }, 'apice-anel');
      mk('circle', { cx: ax, cy: ay, r: 9 }, 'apice-bola');
    } else if (o.zona) {
      const a = f.folga + Math.floor(f.nucleo * o.zona[0]);
      const b = f.folga + Math.ceil(f.nucleo * o.zona[1]);
      const Z = P.slice(Math.max(0, a), Math.min(P.length, b + 1));
      if (Z.length > 1) mk('path', { d: Z.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') }, 'zona');
      // marcas só quando há posição REAL (regra: nunca inventar marca)
      if (o.voceFrac != null && o.ouroFrac != null && o.voceFrac !== o.ouroFrac) riscar(o.voceFrac, 'mvoce', 16);
      if (o.ouroFrac != null) riscar(o.ouroFrac, 'mouro', 20);
    }
  }

  return {
    mostrar(segment, o) {
      raiz.dataset.modo = 'curva';
      raiz.querySelector('.verbo').innerHTML = `${o.verbo}<br><b>${o.destaque}</b>`;
      const dado = raiz.querySelector('.dado');
      if (o.quanto != null) dado.innerHTML = `${o.quanto}<small>${o.un || ''}</small>`;
      else dado.innerHTML = '';
      desenharCurva(segment, o);
      raiz.dataset.on = '1';
    },
    setProgresso(frac) { // 1 → cheia (acabou de aparecer) · 0 → entrada do trecho
      raiz.querySelector('.regua').style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
    },
    mostrarResumoVolta(r) {
      raiz.dataset.modo = 'resumo';
      raiz.querySelector('.vn').textContent = `VOLTA ${r.voltaN ?? '—'}`;
      const vt = raiz.querySelector('.vt');
      vt.textContent = r.tempoTxt ?? '—';
      vt.className = 'vt ' + (r.melhorou ? 'bom' : (r.melhorou === false ? 'ruim' : ''));
      raiz.querySelector('.vm').textContent = r.melhorTxt ? `MELHOR ${r.melhorTxt}` : '';
      raiz.dataset.on = '1';
    },
    esconder() { raiz.dataset.on = '0'; },
    visivel() { return raiz.dataset.on === '1'; },
    _raiz: raiz,
  };
}
