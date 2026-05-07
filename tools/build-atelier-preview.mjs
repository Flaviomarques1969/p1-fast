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

const FRAME_W = 1100, FRAME_H = 900;
const TRACK_OX = 138, TRACK_OY = 60; // offset onde o track 823×799 começa

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

function buildAtelier({ svgPath, points, totalM }) {
  // Sample posições para os marcadores live + ghost + rastro
  const liveIdx = Math.floor(points.length * 0.42);          // ~42% da volta
  const ghostIdx = Math.floor(points.length * 0.46);         // 4% à frente do live (ghost mais rápido)
  const trailLen = 80;                                       // 80 pontos de rastro
  const live = points[liveIdx];
  const ghost = points[ghostIdx];
  const ghostTrailLen = 60;

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
  </g>

  <!-- vinheta sobre tudo -->
  <rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="url(#vignette)" pointer-events="none"/>

  <!-- ════════════════ FOOTER ════════════════ -->
  <g font-family="ui-monospace, 'SF Mono', Menlo, monospace" fill="#F5F0E0">
    <line x1="60" y1="${FRAME_H - 110}" x2="${FRAME_W - 60}" y2="${FRAME_H - 110}" stroke="url(#champagne)" stroke-width="0.5" stroke-opacity="0.30"/>

    <!-- BARRAS POR SETOR (centro do footer) -->
    <g transform="translate(${FRAME_W / 2 - 360}, ${FRAME_H - 92})">
      <text x="0" y="0" font-size="8" letter-spacing="3" fill="#F5F0E0" fill-opacity="0.45">DELTA POR SETOR (s)</text>
      ${SECTORS.map((s, i) => {
        const cellW = 180;
        const x = i * cellW;
        const max = 0.30; // escala máx ±0.30s
        const w = Math.min(Math.abs(s.delta) / max, 1) * 60;
        const color = s.delta >= 0 ? '#FF5A4E' : '#5BE07A';
        const sign = s.delta >= 0 ? '+' : '−';
        const center = x + 100; // baseline da barra
        return `
      <g transform="translate(0,12)">
        <text x="${x}" y="6" font-size="8" letter-spacing="2" fill-opacity="0.55">${s.id} · ${s.name}</text>
        <line x1="${x}" y1="20" x2="${x + 165}" y2="20" stroke="#F5F0E0" stroke-opacity="0.10" stroke-width="0.6"/>
        <line x1="${center}" y1="14" x2="${center}" y2="26" stroke="#F5F0E0" stroke-opacity="0.30" stroke-width="0.6"/>
        <rect x="${s.delta >= 0 ? center : center - w}" y="16" width="${w}" height="8" fill="${color}" fill-opacity="0.85"/>
        <text x="${x + 165}" y="22" text-anchor="end" font-size="10" font-weight="500" fill="${color}" fill-opacity="0.95">${sign}${Math.abs(s.delta).toFixed(2)}</text>
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
