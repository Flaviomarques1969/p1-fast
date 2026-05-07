// ═══════════════════════════════════════════════════════════
// build-atelier-preview — peça premium "Atelier"
// ═══════════════════════════════════════════════════════════
// Output: assets/pistas/premium-styles/atelier.svg
//
// 4 elementos compositivos:
//   1) Chrome (título + dados + frame)
//   2) Background (atmosfera com 2 blooms + vinheta + topo lines)
//   3) Pista (halo gold + runoff + asfalto cambado + filete champagne
//      + sector ticks nas parciais + apex marks nas curvas + start)
//   4) Volta (live marker + ghost marker + rastro fading — estáticos
//      neste preview, dinâmicos no app)
//
// viewBox 1100×900: maior que a fonte (823×799) pra dar respiro de
// chrome em volta do traçado. Track wrapped em <g translate(138, 60)>.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const FRAME_W = 1280, FRAME_H = 920;
const TRACK_OX = 138, TRACK_OY = 60; // offset onde o track 823×799 começa
const HUD_X = 1010;                   // coluna da direita pra HUD telemetria
const HUD_W = 230;

// Curvas a rotular (do seed-tracks.js, ehTrecho=true) com posição e direção
// preferida do label (l/r/t/b) pra evitar choque com o traçado.
const CORNERS = [
  { name: 'CURVA 1',         x: 145, y: 645, dir: 'l', sub: 'lenta · tardio' },
  { name: 'MERGULHO BRUXA',  x: 315, y: 305, dir: 't', sub: 'rápida · neutro' },
  { name: 'CURVA 2',         x: 290, y:  85, dir: 't', sub: 'média · tardio' },
  { name: 'JUNÇÃO',          x: 600, y: 330, dir: 't', sub: 'média · neutro' },
  { name: 'CURVA DA BRUXA',  x: 225, y: 570, dir: 'l', sub: 'lenta · tardio' },
  { name: 'CURVA DO PLACAR', x: 335, y: 475, dir: 'r', sub: 'média · neutro' },
  { name: 'S DO PIQUET',     x: 630, y: 525, dir: 'r', sub: 'rápida · duplo' },
  { name: 'VITÓRIA',         x: 645, y: 650, dir: 'r', sub: 'média · tardio' },
];

const START = { x1: 415, y1: 695, x2: 415, y2: 720 };

async function loadCanonical() {
  const baseSvg = await readFile(resolve(ROOT, 'assets/pistas/brasilia.svg'), 'utf8');
  const ref = JSON.parse(await readFile(resolve(ROOT, 'assets/pistas/brasilia-reference.json'), 'utf8'));
  const m = baseSvg.match(/<path id="track" d="([^"]+)"/);
  if (!m) throw new Error('não achei <path id="track">');
  return { svgPath: m[1], points: ref.points, totalM: ref.totalLengthMeters };
}

function leader(corner) {
  // Calcula posição do label e da leader line conforme dir
  const padApex = 18;     // distância do círculo do apex
  const padLabel = 26;    // distância da ponta da leader pro texto
  let lx, ly, anchor;
  switch (corner.dir) {
    case 'l': lx = corner.x - 70; ly = corner.y - 4; anchor = 'end';   break;
    case 'r': lx = corner.x + 70; ly = corner.y - 4; anchor = 'start'; break;
    case 't': lx = corner.x;      ly = corner.y - 60; anchor = 'middle'; break;
    case 'b': lx = corner.x;      ly = corner.y + 60; anchor = 'middle'; break;
  }
  return { lx, ly, anchor, ax: corner.x, ay: corner.y };
}

// Telemetria sintética derivada da curvatura real (vem da reference.json).
// Modelo simplificado: na reta v alta + RPM alto + G baixo, na curva inverso.
//   v(km/h)  = clamp(290 - 9500·|κ|, 60, 290)
//   rpm     = clamp(2400 + v · 22, 4000, 9000)  (engrenamento médio)
//   gLat(g) = ±(v_ms² · κ) / 9.81  (sinal preserva direção da curva)
function deriveTelemetry(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const k = Math.abs(points[i].curvature);
    const v = Math.max(60, Math.min(290, 290 - 9500 * k));
    const rpm = Math.max(4000, Math.min(9000, 2400 + v * 22));
    const vms = v / 3.6;
    const gLat = (vms * vms * points[i].curvature) / 9.81;
    out.push({ v: Math.round(v), rpm: Math.round(rpm), gLat: Number(gLat.toFixed(2)) });
  }
  // Suaviza por janela 7 (frenagens/acelerações não são instantâneas)
  const n = out.length;
  const sm = out.map((_, i) => {
    let sv = 0, sr = 0, sg = 0;
    const W = 7;
    for (let k = -W; k <= W; k++) {
      const j = ((i + k) % n + n) % n;
      sv += out[j].v; sr += out[j].rpm; sg += out[j].gLat;
    }
    return { v: Math.round(sv / (2 * W + 1)), rpm: Math.round(sr / (2 * W + 1)), gLat: Number((sg / (2 * W + 1)).toFixed(2)) };
  });
  return sm;
}

// Delta acumulado sintético: começa em 0, ganha em P2, perde em P3, fecha +0.42s
function deriveCumDelta(n, finalDeltaS) {
  const profile = i => {
    const t = i / n;
    // 4 setores: P1 (+0.14), P2 (-0.08), P3 (+0.21), P4 (+0.15) — soma = +0.42
    if (t < 0.25) return (t / 0.25) * 0.14;
    if (t < 0.50) return 0.14 + ((t - 0.25) / 0.25) * (-0.08);
    if (t < 0.75) return 0.06 + ((t - 0.50) / 0.25) * 0.21;
    return 0.27 + ((t - 0.75) / 0.25) * 0.15;
  };
  return Array.from({ length: n }, (_, i) => profile(i));
}

// Helper: serializa valores em formato SMIL "v0;v1;v2;..."
function smil(values, sampleEvery = 1) {
  const sampled = [];
  for (let i = 0; i < values.length; i += sampleEvery) sampled.push(values[i]);
  // garante fechar o ciclo
  sampled.push(values[0]);
  return sampled.join(';');
}

function buildAtelier({ svgPath, points, totalM }) {
  // Sample posições para os marcadores live + ghost + rastro
  const liveIdx = Math.floor(points.length * 0.42);          // ~42% da volta
  const ghostIdx = Math.floor(points.length * 0.46);         // 4% à frente do live (ghost mais rápido)
  const trailLen = 80;                                       // 80 pontos de rastro
  const live = points[liveIdx];
  const ghost = points[ghostIdx];
  const ghostTrailLen = 60;
  const tele = deriveTelemetry(points);
  const cumDelta = deriveCumDelta(points.length, 0.42);

  // Sub-amostragem pra animação SMIL (evita arquivo gigante)
  const FRAMES = 110;
  const stride = Math.max(1, Math.floor(points.length / FRAMES));
  const speedSeq = []; const rpmSeq = []; const gLatSeq = [];
  const speedTextSeq = [];
  for (let i = 0; i < points.length; i += stride) {
    speedSeq.push(tele[i].v);
    rpmSeq.push(tele[i].rpm);
    gLatSeq.push(tele[i].gLat);
    speedTextSeq.push(tele[i].v.toString());
  }
  speedSeq.push(tele[0].v); rpmSeq.push(tele[0].rpm); gLatSeq.push(tele[0].gLat);
  speedTextSeq.push(tele[0].v.toString());

  const liveTrail = [];
  for (let i = 1; i <= trailLen; i++) {
    const idx = (liveIdx - i + points.length) % points.length;
    liveTrail.push({ p: points[idx], opacity: 1 - i / trailLen });
  }
  const ghostTrail = [];
  for (let i = 1; i <= ghostTrailLen; i++) {
    const idx = (ghostIdx - i + points.length) % points.length;
    ghostTrail.push({ p: points[idx], opacity: (1 - i / ghostTrailLen) * 0.5 });
  }

  // Animação: durações em segundos. Live = volta atual mais lenta, ghost mais rápido.
  // Fase do ghost desloca pra ele aparecer adiante do live.
  const LIVE_DUR = 12;     // segundos (pra preview ficar agradável; na prática 171s)
  const GHOST_DUR = 11.5;  // ghost completa volta um pouco mais rápido
  const GHOST_PHASE = -0.04 * GHOST_DUR; // começa adiantado em 4% da volta

  // Delta entre live e ghost (exemplo estático: ghost à frente em 0.42s)
  const DELTA_S = +0.42; // positivo = live atrás do ghost
  const DELTA_LABEL = (DELTA_S >= 0 ? '+' : '−') + Math.abs(DELTA_S).toFixed(2);
  const DELTA_COLOR = DELTA_S >= 0 ? '#FF5A4E' : '#5BE07A';
  const DELTA_TEXT = DELTA_S >= 0 ? 'ATRÁS DO GHOST' : 'À FRENTE DO GHOST';

  // Setores: 4 parciais com delta exemplo (positivo = perdeu tempo nesse setor)
  const SECTORS = [
    { id: 'P1', name: 'BOX → C2',     delta: +0.14 },
    { id: 'P2', name: 'JUNÇÃO',       delta: -0.08 },
    { id: 'P3', name: 'BRUXA',        delta: +0.21 },
    { id: 'P4', name: 'PLACAR → END', delta: +0.15 },
  ];

  // Chrome metrics
  const titleX = 60, titleY = 64;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_W} ${FRAME_H}" width="${FRAME_W}" height="${FRAME_H}">
  <defs>
    <!-- ─── BACKGROUND ─────────────────────────────────── -->
    <radialGradient id="bgBase" cx="50%" cy="42%" r="80%">
      <stop offset="0%"   stop-color="#0E1322"/>
      <stop offset="55%"  stop-color="#070A14"/>
      <stop offset="100%" stop-color="#02030A"/>
    </radialGradient>
    <radialGradient id="bloomWarm" cx="22%" cy="25%" r="42%">
      <stop offset="0%"  stop-color="#C9A961" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#C9A961" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomCool" cx="78%" cy="78%" r="48%">
      <stop offset="0%"  stop-color="#3B82F6" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="78%">
      <stop offset="65%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </radialGradient>

    <!-- ─── TRACK ─────────────────────────────────────── -->
    <radialGradient id="haloGold" cx="50%" cy="50%" r="60%">
      <stop offset="0%"   stop-color="#E8C97A" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#E8C97A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="runoff" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#3A3328"/>
      <stop offset="100%" stop-color="#1F1B14"/>
    </linearGradient>
    <linearGradient id="asphalt" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#3A3D44"/>
      <stop offset="50%"  stop-color="#222428"/>
      <stop offset="100%" stop-color="#15171B"/>
    </linearGradient>
    <linearGradient id="champagne" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#D4AF37"/>
      <stop offset="50%"  stop-color="#F0DCA0"/>
      <stop offset="100%" stop-color="#D4AF37"/>
    </linearGradient>

    <!-- ─── MARKERS ───────────────────────────────────── -->
    <radialGradient id="liveGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#FF7A1A" stop-opacity="0.95"/>
      <stop offset="60%"  stop-color="#FF7A1A" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#FF7A1A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ghostGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#7DD3FC" stop-opacity="0.85"/>
      <stop offset="60%"  stop-color="#7DD3FC" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#7DD3FC" stop-opacity="0"/>
    </radialGradient>

    <!-- ─── FILTERS ───────────────────────────────────── -->
    <filter id="blurLg" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="20"/>
    </filter>
    <filter id="blurMd" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <filter id="blurSm" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <!-- Terreno: turbulência fractal monocromática, low contrast, dá sensação aérea -->
    <filter id="terrain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.42
                              0 0 0 0 0.36
                              0 0 0 0 0.22
                              0 0 0 0.08 0"/>
    </filter>
    <!-- Cintilação sutil para o glow do live marker (pulse) -->
    <filter id="markerGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>

    <path id="track" d="${svgPath}"/>
  </defs>

  <!-- ════════════════ ELEMENTO 2: BACKGROUND ════════════════ -->
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="url(#bgBase)"/>
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="url(#bloomWarm)"/>
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="url(#bloomCool)"/>
  <!-- terreno aéreo (turbulência fractal) — não é elevação real, dá quality de foto aérea -->
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" filter="url(#terrain)" opacity="0.55"/>

  <!-- topographic concentric rings (decoração sutil) -->
  <g stroke="#1A2438" stroke-opacity="0.20" fill="none" stroke-width="0.6">
    <circle cx="550" cy="450" r="120"/>
    <circle cx="550" cy="450" r="190"/>
    <circle cx="550" cy="450" r="270"/>
    <circle cx="550" cy="450" r="360"/>
    <circle cx="550" cy="450" r="460"/>
  </g>

  <!-- ════════════════ ELEMENTO 1: CHROME (TÍTULO) ════════════════ -->
  <g font-family="'Helvetica Neue', -apple-system, sans-serif" fill="#F5F0E0">
    <!-- Brand mark -->
    <text x="${titleX}" y="${titleY - 18}" font-size="9" font-weight="500" letter-spacing="6" fill-opacity="0.55" fill="#D4AF37">P 1 · F A S T</text>
    <!-- Display -->
    <text x="${titleX}" y="${titleY + 8}" font-size="42" font-weight="200" letter-spacing="14" fill-opacity="0.96">B R A S Í L I A</text>
    <!-- Subhead -->
    <text x="${titleX}" y="${titleY + 30}" font-size="9" font-weight="400" letter-spacing="4" fill-opacity="0.55">AUTÓDROMO INTERNACIONAL NELSON PIQUET</text>
    <!-- Hairline divider sob o título -->
    <line x1="${titleX}" y1="${titleY + 42}" x2="${FRAME_W - 60}" y2="${titleY + 42}" stroke="url(#champagne)" stroke-width="0.6" stroke-opacity="0.45"/>
  </g>

  <!-- Bloco metadata (esquerda do delta) -->
  <g font-family="ui-monospace, 'SF Mono', Menlo, monospace" fill="#F5F0E0" text-anchor="end">
    <text x="${FRAME_W - 240}" y="${titleY - 14}" font-size="8"  letter-spacing="2" fill-opacity="0.45">EXTENSÃO · CURVAS · VOLTA REF · SENTIDO</text>
    <text x="${FRAME_W - 240}" y="${titleY + 8}"  font-size="14" font-weight="300" letter-spacing="2" fill-opacity="0.85">${(totalM/1000).toFixed(3).replace('.',',')} KM · 8 · 2:51.038 · CCW</text>
  </g>

  <!-- ════════════════ DELTA BADGE (canto superior direito) ════════════════ -->
  <g transform="translate(${FRAME_W - 60}, ${titleY - 6})" text-anchor="end" font-family="'Helvetica Neue', -apple-system, sans-serif">
    <text font-size="9" letter-spacing="3" fill="#F5F0E0" fill-opacity="0.50" y="-22">DELTA · LIVE vs GHOST</text>
    <text font-size="46" font-weight="200" letter-spacing="1" fill="${DELTA_COLOR}" y="14">
      ${DELTA_LABEL}<animate attributeName="fill-opacity" values="0.95;0.65;0.95" dur="2.4s" repeatCount="indefinite"/>
    </text>
    <text font-size="8" letter-spacing="3" fill="${DELTA_COLOR}" fill-opacity="0.85" y="30">${DELTA_TEXT}</text>
  </g>

  <!-- ════════════════ ELEMENTO 3: PISTA ════════════════ -->
  <g transform="translate(${TRACK_OX},${TRACK_OY})">
    <!-- ANÉIS DE ELEVAÇÃO (4 níveis topográficos sutis em volta da pista) -->
    <g fill="none" stroke="#3A4055" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.22">
      <use href="#track" stroke-width="200" stroke-opacity="0.04"/>
      <use href="#track" stroke-width="150" stroke-opacity="0.06"/>
      <use href="#track" stroke-width="110" stroke-opacity="0.08"/>
      <use href="#track" stroke-width="78"  stroke-opacity="0.11"/>
      <use href="#track" stroke-width="56"  stroke-opacity="0.16"/>
    </g>

    <!-- halo dourado (atmosfera) -->
    <use href="#track" fill="none" stroke="#E8C97A" stroke-width="80" stroke-opacity="0.06" stroke-linejoin="round" stroke-linecap="round" filter="url(#blurLg)"/>
    <use href="#track" fill="none" stroke="#E8C97A" stroke-width="46" stroke-opacity="0.08" stroke-linejoin="round" stroke-linecap="round" filter="url(#blurMd)"/>

    <!-- runoff (escape, gradiente warm) -->
    <use href="#track" fill="none" stroke="url(#runoff)" stroke-width="36" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.85"/>

    <!-- asfalto (gradiente vertical = camber) -->
    <use href="#track" fill="none" stroke="url(#asphalt)" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- filete champagne na borda interna -->
    <use href="#track" fill="none" stroke="url(#champagne)" stroke-width="0.7" stroke-opacity="0.55"/>

    <!-- centerline pontilhada muito sutil -->
    <use href="#track" fill="none" stroke="#FFFFFF" stroke-width="0.4" stroke-dasharray="3 9" stroke-opacity="0.10"/>

    <!-- start/finish line -->
    <g>
      <line x1="${START.x1 - 8}" y1="${START.y1}" x2="${START.x2 - 8}" y2="${START.y2}" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.85"/>
      <line x1="${START.x1 + 8}" y1="${START.y1}" x2="${START.x2 + 8}" y2="${START.y2}" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.85"/>
      <text x="${START.x1 + 18}" y="${START.y1 + 14}" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="8" letter-spacing="3" fill="#D4AF37" fill-opacity="0.85">START / FINISH</text>
    </g>

    <!-- corner labels com leader lines -->
    <g font-family="'Helvetica Neue', -apple-system, sans-serif" fill="#F5F0E0">
      ${CORNERS.map(c => {
        const L = leader(c);
        return `
      <g>
        <circle cx="${L.ax}" cy="${L.ay}" r="3.5" fill="none" stroke="#D4AF37" stroke-width="0.8" stroke-opacity="0.85"/>
        <circle cx="${L.ax}" cy="${L.ay}" r="1.2" fill="#D4AF37" fill-opacity="0.95"/>
        <line x1="${L.ax}" y1="${L.ay}" x2="${L.lx}" y2="${L.ly}" stroke="#D4AF37" stroke-width="0.5" stroke-opacity="0.45"/>
        <text x="${L.lx + (c.dir==='l'?-6:c.dir==='r'?6:0)}" y="${L.ly + (c.dir==='t'?-4:c.dir==='b'?12:0)}" text-anchor="${L.anchor}" font-size="9" font-weight="500" letter-spacing="2" fill-opacity="0.85">${c.name}</text>
        <text x="${L.lx + (c.dir==='l'?-6:c.dir==='r'?6:0)}" y="${L.ly + (c.dir==='t'?-4:c.dir==='b'?12:0) + 12}" text-anchor="${L.anchor}" font-size="7" letter-spacing="1.5" fill-opacity="0.40">${c.sub.toUpperCase()}</text>
      </g>`;
      }).join('')}
    </g>

    <!-- ════════════════ ELEMENTO 4: VOLTA (live + ghost + rastros) ════════════════ -->
    <!-- Rastro do ghost (atrás do live no z-order, fade ciano) -->
    <g fill="#7DD3FC">
      ${ghostTrail.map(t => `<circle cx="${t.p.x.toFixed(2)}" cy="${t.p.y.toFixed(2)}" r="1.6" fill-opacity="${t.opacity.toFixed(3)}"/>`).join('')}
    </g>
    <!-- Rastro do live (fade laranja) -->
    <g fill="#FF7A1A">
      ${liveTrail.map(t => `<circle cx="${t.p.x.toFixed(2)}" cy="${t.p.y.toFixed(2)}" r="1.8" fill-opacity="${t.opacity.toFixed(3)}"/>`).join('')}
    </g>

    <!-- Ghost marker — ANIMADO ao longo do path, fase adiantada -->
    <g>
      <circle r="22" fill="url(#ghostGlow)" filter="url(#blurSm)">
        <animateMotion dur="${GHOST_DUR}s" repeatCount="indefinite" begin="${GHOST_PHASE}s" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
      </circle>
      <circle r="5.5" fill="none" stroke="#7DD3FC" stroke-width="1.2" stroke-opacity="0.95">
        <animateMotion dur="${GHOST_DUR}s" repeatCount="indefinite" begin="${GHOST_PHASE}s" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
      </circle>
      <circle r="2" fill="#E0F7FF">
        <animateMotion dur="${GHOST_DUR}s" repeatCount="indefinite" begin="${GHOST_PHASE}s" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
      </circle>
    </g>

    <!-- Live marker — ANIMADO ao longo do path, fase 0 -->
    <g>
      <circle r="26" fill="url(#liveGlow)" filter="url(#blurSm)">
        <animateMotion dur="${LIVE_DUR}s" repeatCount="indefinite" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
        <animate attributeName="r" values="26;30;26" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <circle r="6" fill="none" stroke="#FF7A1A" stroke-width="1.5">
        <animateMotion dur="${LIVE_DUR}s" repeatCount="indefinite" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
      </circle>
      <circle r="2.5" fill="#FFE5C9">
        <animateMotion dur="${LIVE_DUR}s" repeatCount="indefinite" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
      </circle>
    </g>

    <!-- Speed badge flutuante seguindo o live marker -->
    <g font-family="ui-monospace, 'SF Mono', Menlo, monospace">
      <g>
        <animateMotion dur="${LIVE_DUR}s" repeatCount="indefinite" rotate="0">
          <mpath href="#track"/>
        </animateMotion>
        <rect x="14" y="-22" width="58" height="22" rx="2" fill="#0E1322" fill-opacity="0.85" stroke="#FF7A1A" stroke-width="0.6" stroke-opacity="0.85"/>
        <text x="43" y="-7" text-anchor="middle" font-size="14" font-weight="600" fill="#FFE5C9" letter-spacing="1">
          <tspan>${tele[liveIdx].v}</tspan>
          <animate attributeName="textContent" values="${speedTextSeq.join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
        </text>
        <text x="68" y="-7" text-anchor="end" font-size="6" fill="#FF7A1A" fill-opacity="0.85" letter-spacing="1.5" dx="10">km/h</text>
      </g>
    </g>
  </g>

  <!-- ════════════════ HUD TELEMETRIA (right column) ════════════════ -->
  <g transform="translate(${HUD_X}, 110)" font-family="ui-monospace, 'SF Mono', Menlo, monospace">
    <!-- Painel base -->
    <rect x="0" y="0" width="${HUD_W}" height="640" fill="#0A0E18" fill-opacity="0.55" stroke="#D4AF37" stroke-width="0.5" stroke-opacity="0.25" rx="3"/>

    <!-- VELOCIDADE (gigante) -->
    <g transform="translate(0, 30)">
      <text x="${HUD_W / 2}" y="0" text-anchor="middle" font-size="9" letter-spacing="4" fill="#F5F0E0" fill-opacity="0.55">VELOCIDADE</text>
      <text x="${HUD_W / 2}" y="68" text-anchor="middle" font-family="'Helvetica Neue', sans-serif" font-size="76" font-weight="100" letter-spacing="-2" fill="#F5F0E0">
        <tspan>${tele[liveIdx].v}</tspan>
        <animate attributeName="textContent" values="${speedTextSeq.join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
      </text>
      <text x="${HUD_W / 2}" y="86" text-anchor="middle" font-size="9" letter-spacing="3" fill="#D4AF37" fill-opacity="0.85">km/h</text>
    </g>

    <!-- divider -->
    <line x1="20" y1="148" x2="${HUD_W - 20}" y2="148" stroke="url(#champagne)" stroke-opacity="0.20" stroke-width="0.5"/>

    <!-- RPM (semicírculo gauge) -->
    <g transform="translate(${HUD_W / 2}, 230)">
      <text x="0" y="-50" text-anchor="middle" font-size="9" letter-spacing="4" fill="#F5F0E0" fill-opacity="0.55">RPM</text>

      <!-- Trilha do gauge (0-9000 RPM mapeado a 270°: -135° a +135°) -->
      <!-- Verde: 0-6300 (-135° a +54°), Amarelo: 6300-7900 (+54° a +123°), Vermelho: 7900-9000 (+123° a +135°) -->
      <path d="M -70 49.5 A 86 86 0 0 1 70 49.5" fill="none" stroke="#22C55E" stroke-width="6" stroke-opacity="0.40" stroke-linecap="butt"/>
      <path d="M 70 49.5 A 86 86 0 0 1 81 -19" fill="none" stroke="#FACC15" stroke-width="6" stroke-opacity="0.50" stroke-linecap="butt"/>
      <path d="M 81 -19 A 86 86 0 0 1 70 -49.5" fill="none" stroke="#EF4444" stroke-width="6" stroke-opacity="0.65" stroke-linecap="butt"/>

      <!-- Marcadores de RPM (3, 6, 9) -->
      <g font-size="7" letter-spacing="1" fill="#F5F0E0" fill-opacity="0.45" text-anchor="middle">
        <text x="-95" y="58">3</text>
        <text x="0" y="-78">6</text>
        <text x="95" y="58">9</text>
      </g>

      <!-- Ponteiro animado: rotaciona -135° a +135° = 270° pra rpm 0 a 9000 -->
      <g>
        <line x1="0" y1="0" x2="0" y2="-78" stroke="#F5F0E0" stroke-width="2" stroke-linecap="round" transform="rotate(${(tele[liveIdx].rpm / 9000) * 270 - 135})">
          <animateTransform attributeName="transform" type="rotate" values="${rpmSeq.map(r => ((r / 9000) * 270 - 135).toFixed(1)).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
        </line>
        <circle r="5" fill="#0A0E18" stroke="#D4AF37" stroke-width="0.8" stroke-opacity="0.85"/>
        <circle r="2" fill="#D4AF37"/>
      </g>

      <!-- Valor numérico do RPM -->
      <text x="0" y="42" text-anchor="middle" font-size="14" font-weight="500" fill="#F5F0E0" letter-spacing="1">
        <tspan>${tele[liveIdx].rpm.toLocaleString('pt-BR')}</tspan>
        <animate attributeName="textContent" values="${rpmSeq.map(r => r.toLocaleString('pt-BR')).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
      </text>
    </g>

    <!-- divider -->
    <line x1="20" y1="358" x2="${HUD_W - 20}" y2="358" stroke="url(#champagne)" stroke-opacity="0.20" stroke-width="0.5"/>

    <!-- G LATERAL (barra horizontal com origem no centro) -->
    <g transform="translate(0, 388)">
      <text x="${HUD_W / 2}" y="0" text-anchor="middle" font-size="9" letter-spacing="4" fill="#F5F0E0" fill-opacity="0.55">G LATERAL</text>

      <!-- Trilha da barra -->
      <line x1="20" y1="36" x2="${HUD_W - 20}" y2="36" stroke="#F5F0E0" stroke-opacity="0.10" stroke-width="6" stroke-linecap="round"/>
      <!-- Centro -->
      <line x1="${HUD_W / 2}" y1="28" x2="${HUD_W / 2}" y2="44" stroke="#F5F0E0" stroke-opacity="0.35" stroke-width="0.8"/>
      <!-- Marcadores ±2g -->
      <g font-size="7" fill="#F5F0E0" fill-opacity="0.40" letter-spacing="1">
        <text x="20" y="56" text-anchor="start">−2g</text>
        <text x="${HUD_W / 2}" y="56" text-anchor="middle">0</text>
        <text x="${HUD_W - 20}" y="56" text-anchor="end">+2g</text>
      </g>

      <!-- Barra animada (largura cresce do centro pra direção do g) -->
      <rect x="${HUD_W / 2}" y="32" width="0" height="8" fill="#FF7A1A" fill-opacity="0.85" rx="1">
        <animate attributeName="x"     values="${gLatSeq.map(g => (HUD_W / 2 + (g < 0 ? (g / 2) * (HUD_W / 2 - 20) : 0)).toFixed(1)).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
        <animate attributeName="width" values="${gLatSeq.map(g => (Math.min(Math.abs(g) / 2, 1) * (HUD_W / 2 - 20)).toFixed(1)).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
      </rect>

      <!-- Valor numérico do G -->
      <text x="${HUD_W / 2}" y="86" text-anchor="middle" font-size="22" font-weight="200" fill="#F5F0E0" letter-spacing="1">
        <tspan>${tele[liveIdx].gLat.toFixed(2)}</tspan>
        <animate attributeName="textContent" values="${gLatSeq.map(g => g.toFixed(2)).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
      </text>
      <text x="${HUD_W / 2}" y="100" text-anchor="middle" font-size="8" letter-spacing="3" fill="#D4AF37" fill-opacity="0.85">G</text>
    </g>

    <!-- divider -->
    <line x1="20" y1="514" x2="${HUD_W - 20}" y2="514" stroke="url(#champagne)" stroke-opacity="0.20" stroke-width="0.5"/>

    <!-- Posição na volta (s/total) -->
    <g transform="translate(0, 540)">
      <text x="${HUD_W / 2}" y="0" text-anchor="middle" font-size="8" letter-spacing="3" fill="#F5F0E0" fill-opacity="0.45">POSIÇÃO NA VOLTA</text>
      <text x="${HUD_W / 2}" y="32" text-anchor="middle" font-size="22" font-weight="300" fill="#F5F0E0" letter-spacing="2">
        <tspan>${(points[liveIdx].sMeters).toFixed(0)}</tspan>
        <animate attributeName="textContent" values="${Array.from({length: speedSeq.length}, (_, i) => points[Math.min(i * stride, points.length - 1)].sMeters.toFixed(0)).join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
      </text>
      <text x="${HUD_W / 2}" y="50" text-anchor="middle" font-size="8" letter-spacing="2" fill="#D4AF37" fill-opacity="0.85">m / ${totalM}</text>
    </g>

    <!-- Brand assinatura -->
    <text x="${HUD_W / 2}" y="618" text-anchor="middle" font-size="7" letter-spacing="4" fill="#D4AF37" fill-opacity="0.40">P 1 · F A S T   ·   ATELIER</text>
  </g>

  <!-- vinheta sobre tudo -->
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="url(#vignette)" pointer-events="none"/>

  <!-- ════════════════ FOOTER ════════════════ -->
  <g font-family="ui-monospace, 'SF Mono', Menlo, monospace" fill="#F5F0E0">
    <line x1="60" y1="${FRAME_H - 110}" x2="${FRAME_W - 60}" y2="${FRAME_H - 110}" stroke="url(#champagne)" stroke-width="0.5" stroke-opacity="0.30"/>

    <!-- DELTA CUMULATIVO (gráfico de linha sobre toda a volta) -->
    <g transform="translate(60, ${FRAME_H - 100})">
      <text x="0" y="0" font-size="8" letter-spacing="3" fill="#F5F0E0" fill-opacity="0.45">DELTA CUMULATIVO AO LONGO DA VOLTA (s)</text>

      ${(() => {
        const W = 600, H = 56;
        const dx = W / (cumDelta.length - 1);
        const ymax = 0.5; // ±0.5s escala
        const yMid = H / 2;
        // baseline + grid
        const grid = `
          <line x1="0" y1="${yMid}" x2="${W}" y2="${yMid}" stroke="#F5F0E0" stroke-opacity="0.20" stroke-width="0.5"/>
          <line x1="0" y1="0"        x2="${W}" y2="0"        stroke="#F5F0E0" stroke-opacity="0.08" stroke-width="0.5" stroke-dasharray="2 4"/>
          <line x1="0" y1="${H}"     x2="${W}" y2="${H}"     stroke="#F5F0E0" stroke-opacity="0.08" stroke-width="0.5" stroke-dasharray="2 4"/>
        `;
        // separadores de setor (P1/P2/P3/P4 a cada 25%)
        const dividers = [0.25, 0.50, 0.75].map(t => `<line x1="${t * W}" y1="-2" x2="${t * W}" y2="${H + 2}" stroke="#D4AF37" stroke-opacity="0.20" stroke-width="0.5" stroke-dasharray="3 5"/>`).join('');
        // labels de setor
        const sectorLabels = ['P1', 'P2', 'P3', 'P4'].map((s, i) => `<text x="${(i + 0.5) * (W / 4)}" y="${H + 14}" text-anchor="middle" font-size="7" letter-spacing="2" fill="#D4AF37" fill-opacity="0.55">${s}</text>`).join('');
        // path do delta (positive = vermelho, fica acima da linha; negative = verde, abaixo)
        let pathPos = '', pathNeg = '';
        for (let i = 0; i < cumDelta.length; i++) {
          const x = i * dx;
          const y = yMid - (cumDelta[i] / ymax) * yMid;
          const cmd = i === 0 ? 'M' : 'L';
          if (cumDelta[i] >= 0) pathPos += `${cmd} ${x.toFixed(1)} ${y.toFixed(1)} `;
          else pathNeg += `${cmd} ${x.toFixed(1)} ${y.toFixed(1)} `;
        }
        // area filled under (positive)
        const areaPath = `M 0 ${yMid} ` + cumDelta.map((d, i) => `L ${(i * dx).toFixed(1)} ${(yMid - (d / ymax) * yMid).toFixed(1)}`).join(' ') + ` L ${W} ${yMid} Z`;

        // Marcador da posição atual (segue o liveIdx)
        const cursorXAt = idx => ((idx / points.length) * W).toFixed(1);
        const cursorXSeq = Array.from({length: speedSeq.length + 1}, (_, i) => cursorXAt(Math.min(i * stride, points.length - 1)));

        return `
          ${grid}
          ${dividers}
          <!-- area gradient bg -->
          <defs>
            <linearGradient id="deltaArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FF5A4E" stop-opacity="0.45"/>
              <stop offset="50%" stop-color="#FF5A4E" stop-opacity="0.05"/>
              <stop offset="100%" stop-color="#5BE07A" stop-opacity="0.30"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#deltaArea)"/>
          <path d="${cumDelta.map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i * dx).toFixed(1)} ${(yMid - (d / ymax) * yMid).toFixed(1)}`).join(' ')}" fill="none" stroke="#F5F0E0" stroke-width="1.4" stroke-opacity="0.95"/>
          ${sectorLabels}
          <!-- cursor que segue o live marker -->
          <line x1="${cursorXAt(liveIdx)}" y1="-4" x2="${cursorXAt(liveIdx)}" y2="${H + 4}" stroke="#FF7A1A" stroke-width="1" stroke-opacity="0.85">
            <animate attributeName="x1" values="${cursorXSeq.join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
            <animate attributeName="x2" values="${cursorXSeq.join(';')}" dur="${LIVE_DUR}s" repeatCount="indefinite"/>
          </line>
          <!-- escala Y -->
          <g font-size="7" fill="#F5F0E0" fill-opacity="0.40" letter-spacing="1">
            <text x="-6" y="3" text-anchor="end">+${ymax.toFixed(1)}s</text>
            <text x="-6" y="${yMid + 3}" text-anchor="end">0</text>
            <text x="-6" y="${H + 3}" text-anchor="end">−${ymax.toFixed(1)}s</text>
          </g>
        `;
      })()}
    </g>

    <!-- BARRAS POR SETOR (lado direito do delta cumulativo) -->
    <g transform="translate(720, ${FRAME_H - 100})">
      <text x="0" y="0" font-size="8" letter-spacing="3" fill="#F5F0E0" fill-opacity="0.45">DELTA POR SETOR (s)</text>
      ${SECTORS.map((s, i) => {
        const max = 0.30;
        const w = Math.min(Math.abs(s.delta) / max, 1) * 50;
        const color = s.delta >= 0 ? '#FF5A4E' : '#5BE07A';
        const sign = s.delta >= 0 ? '+' : '−';
        const cx = 130; // baseline central
        return `
      <g transform="translate(0,${14 + i * 16})">
        <text x="0" y="6" font-size="8" letter-spacing="1.5" fill-opacity="0.65">${s.id}</text>
        <line x1="35" y1="2" x2="245" y2="2" stroke="#F5F0E0" stroke-opacity="0.08" stroke-width="0.5"/>
        <line x1="${cx}" y1="-3" x2="${cx}" y2="7" stroke="#F5F0E0" stroke-opacity="0.30" stroke-width="0.5"/>
        <rect x="${s.delta >= 0 ? cx : cx - w}" y="-2" width="${w}" height="8" fill="${color}" fill-opacity="0.85"/>
        <text x="245" y="6" text-anchor="end" font-size="9" font-weight="500" fill="${color}" fill-opacity="0.95">${sign}${Math.abs(s.delta).toFixed(2)}</text>
      </g>`;
      }).join('')}
    </g>

    <!-- bottom-left: coordenadas -->
    <text x="60" y="${FRAME_H - 38}" font-size="9" letter-spacing="2" fill-opacity="0.45">15°46′28″ S    ·    47°53′59″ W    ·    ALT 1.130 m</text>
    <text x="60" y="${FRAME_H - 22}" font-size="8" letter-spacing="2" fill-opacity="0.30">GPS-CALIBRATED LAP REFERENCE   ·   SAMPLED EVERY 2.5 m   ·   2.190 POINTS</text>

    <!-- bottom-right: legenda dos marcadores -->
    <g text-anchor="end">
      <circle cx="${FRAME_W - 268}" cy="${FRAME_H - 41}" r="4" fill="none" stroke="#FF7A1A" stroke-width="1.2"/>
      <circle cx="${FRAME_W - 268}" cy="${FRAME_H - 41}" r="1.6" fill="#FFE5C9"/>
      <text x="${FRAME_W - 200}" y="${FRAME_H - 38}" font-size="9" letter-spacing="2" fill-opacity="0.85">VOLTA ATUAL</text>
      <circle cx="${FRAME_W - 116}" cy="${FRAME_H - 41}" r="4" fill="none" stroke="#7DD3FC" stroke-width="1.2"/>
      <circle cx="${FRAME_W - 116}" cy="${FRAME_H - 41}" r="1.6" fill="#E0F7FF"/>
      <text x="${FRAME_W - 60}"  y="${FRAME_H - 38}" font-size="9" letter-spacing="2" fill-opacity="0.85">VOLTA GHOST</text>
    </g>
  </g>

  <!-- frame hairline final -->
  <rect x="20" y="20" width="${FRAME_W - 40}" height="${FRAME_H - 40}" fill="none" stroke="url(#champagne)" stroke-width="0.5" stroke-opacity="0.18"/>
</svg>
`;
}

async function main() {
  const data = await loadCanonical();
  const dir = resolve(ROOT, 'assets/pistas/premium-styles');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'atelier.svg'), buildAtelier(data));
  console.log('[atelier] OK → assets/pistas/premium-styles/atelier.svg');
}

main().catch(err => { console.error(err); process.exit(1); });
