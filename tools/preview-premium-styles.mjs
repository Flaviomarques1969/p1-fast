// ═══════════════════════════════════════════════════════════
// preview-premium-styles — 3 variações estéticas premium
// ═══════════════════════════════════════════════════════════
// Output: assets/pistas/premium-styles/<estilo>.svg
//
// Reusa o svgPath JÁ suavizado do canônico (brasilia.svg) e os pontos
// JÁ reamostrados do canônico (brasilia-reference.json). Aqui só
// reimagina o STYLING.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function loadCanonical() {
  const baseSvg = await readFile(resolve(ROOT, 'assets/pistas/brasilia.svg'), 'utf8');
  const ref = JSON.parse(await readFile(resolve(ROOT, 'assets/pistas/brasilia-reference.json'), 'utf8'));
  const m = baseSvg.match(/<path id="track" d="([^"]+)"/);
  if (!m) throw new Error('não achei <path id="track"> no brasilia.svg');
  return { svgPath: m[1], points: ref.points, viewBox: ref.viewBox, totalM: ref.totalLengthMeters };
}

function dotsMarkup(points, color, radius, opacity) {
  return points
    .map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${radius}"/>`)
    .join('');
}

// ─── Estilo 1: WATCHMAKER ─────────────────────────────────
function buildWatchmaker({ svgPath, points, viewBox, totalM }) {
  const { w, h } = viewBox;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="75%">
      <stop offset="0%"   stop-color="#161616"/>
      <stop offset="60%"  stop-color="#080808"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="asphalt" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#2E2F33"/>
      <stop offset="50%"  stop-color="#1F2024"/>
      <stop offset="100%" stop-color="#15161A"/>
    </linearGradient>
    <filter id="halo" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="14"/>
    </filter>
    <path id="track" d="${svgPath}"/>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- halo quente difuso atrás da pista -->
  <use href="#track" fill="none" stroke="#F5E6CC" stroke-width="60" stroke-opacity="0.06" stroke-linejoin="round" stroke-linecap="round" filter="url(#halo)"/>

  <!-- runoff / escape -->
  <use href="#track" fill="none" stroke="#3A352E" stroke-width="34" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- asfalto com gradiente vertical (camber) -->
  <use href="#track" fill="none" stroke="url(#asphalt)" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- filete champagne na borda interna do asfalto (1px) -->
  <use href="#track" fill="none" stroke="#D4AF37" stroke-width="0.8" stroke-opacity="0.55"/>

  <!-- pontos -->
  <g fill="#D4AF37" fill-opacity="0.85">
    ${dotsMarkup(points, '#D4AF37', 1.2, 0.85)}
  </g>

  <!-- tipografia inferior direita -->
  <g font-family="-apple-system, 'Helvetica Neue', sans-serif" fill="#D4AF37" fill-opacity="0.45">
    <text x="${w - 20}" y="${h - 28}" font-size="14" font-weight="300" letter-spacing="6" text-anchor="end">BRASÍLIA</text>
    <text x="${w - 20}" y="${h - 12}" font-size="9"  font-weight="300" letter-spacing="3" text-anchor="end">${(totalM / 1000).toFixed(3).replace('.', ',')} KM · NELSON PIQUET</text>
  </g>

  <!-- frame hairline -->
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#D4AF37" stroke-width="0.5" stroke-opacity="0.18"/>
</svg>
`;
}

// ─── Estilo 2: BROADCAST F1 ───────────────────────────────
function buildBroadcastF1({ svgPath, points, viewBox, totalM }) {
  const { w, h } = viewBox;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="80%">
      <stop offset="0%"   stop-color="#0B1A33"/>
      <stop offset="60%"  stop-color="#050B19"/>
      <stop offset="100%" stop-color="#01030A"/>
    </radialGradient>
    <linearGradient id="asphalt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#2A3340"/>
      <stop offset="100%" stop-color="#1A2230"/>
    </linearGradient>
    <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="9"/>
    </filter>
    <filter id="cyanGlowBig" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="22"/>
    </filter>
    <path id="track" d="${svgPath}"/>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- glow ciano grande (atmosfera) -->
  <use href="#track" fill="none" stroke="#4FC3F7" stroke-width="50" stroke-opacity="0.10" stroke-linejoin="round" stroke-linecap="round" filter="url(#cyanGlowBig)"/>

  <!-- runoff cinza-azulado -->
  <use href="#track" fill="none" stroke="#2A3540" stroke-width="36" stroke-opacity="0.7" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- asfalto -->
  <use href="#track" fill="none" stroke="url(#asphalt)" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- highlight ciano fino na pista -->
  <use href="#track" fill="none" stroke="#7DD3FC" stroke-width="2" stroke-opacity="0.30" filter="url(#cyanGlow)"/>

  <!-- linha central pontilhada -->
  <use href="#track" fill="none" stroke="#FFFFFF" stroke-width="0.6" stroke-dasharray="3 8" stroke-opacity="0.25"/>

  <!-- pontos brancos brilhantes -->
  <g fill="#E0F7FF">
    ${dotsMarkup(points, '#E0F7FF', 1.4, 0.95)}
  </g>

  <!-- tipografia broadcast -->
  <g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#FFFFFF">
    <text x="22" y="36" font-size="16" font-weight="700" letter-spacing="2" fill-opacity="0.95">BRASÍLIA</text>
    <text x="22" y="56" font-size="10" font-weight="400" letter-spacing="2" fill-opacity="0.55">AUTÓDROMO INTERNACIONAL NELSON PIQUET</text>
    <text x="22" y="74" font-size="10" font-weight="700" letter-spacing="3" fill="#4FC3F7" fill-opacity="0.85">${(totalM / 1000).toFixed(3).replace('.', ',')} KM · 8 CURVAS</text>
  </g>
</svg>
`;
}

// ─── Estilo 3: CARBON CONCEPT ─────────────────────────────
function buildCarbonConcept({ svgPath, points, viewBox, totalM }) {
  const { w, h } = viewBox;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <pattern id="carbon" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#0A0B0E"/>
      <line x1="0" y1="0" x2="0" y2="8" stroke="#16181D" stroke-width="2"/>
      <line x1="4" y1="0" x2="4" y2="8" stroke="#1B1D22" stroke-width="2"/>
    </pattern>
    <linearGradient id="asphalt" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#262830"/>
      <stop offset="100%" stop-color="#1A1C22"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="60%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.7"/>
    </radialGradient>
    <path id="track" d="${svgPath}"/>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#carbon)"/>

  <!-- runoff sutil -->
  <use href="#track" fill="none" stroke="#2C2E34" stroke-width="32" stroke-opacity="0.65" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- asfalto matte -->
  <use href="#track" fill="none" stroke="url(#asphalt)" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- filete prata escovada -->
  <use href="#track" fill="none" stroke="#9CA3AF" stroke-width="0.7" stroke-opacity="0.40"/>

  <!-- pontos prata neutros (app pinta por cima) -->
  <g fill="#E5E7EB" fill-opacity="0.82">
    ${dotsMarkup(points, '#E5E7EB', 1.3, 0.82)}
  </g>

  <!-- start marker vermelho F1 (#C8102E) -->
  <g transform="translate(${points[0].x},${points[0].y})">
    <circle r="5" fill="none" stroke="#C8102E" stroke-width="1.5" stroke-opacity="0.9"/>
    <circle r="2" fill="#C8102E"/>
  </g>

  <!-- vinheta -->
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#vignette)" pointer-events="none"/>

  <!-- tipografia técnica -->
  <g font-family="ui-monospace, 'SF Mono', Menlo, monospace" fill="#9CA3AF">
    <text x="22" y="36" font-size="11" font-weight="500" letter-spacing="2" fill-opacity="0.90">P1 FAST · BRASÍLIA</text>
    <text x="22" y="52" font-size="9"  font-weight="400" letter-spacing="1.5" fill-opacity="0.55">LAT -15.7745 · LON -47.8997</text>
    <text x="22" y="68" font-size="9"  font-weight="400" letter-spacing="1.5" fill="#C8102E" fill-opacity="0.85">${totalM} M · 8 TURNS · CCW</text>
  </g>

  <!-- frame técnico no canto -->
  <g stroke="#9CA3AF" stroke-width="0.7" stroke-opacity="0.30" fill="none">
    <path d="M 12 12 L 12 30 M 12 12 L 30 12"/>
    <path d="M ${w - 12} 12 L ${w - 12} 30 M ${w - 12} 12 L ${w - 30} 12"/>
    <path d="M 12 ${h - 12} L 12 ${h - 30} M 12 ${h - 12} L 30 ${h - 12}"/>
    <path d="M ${w - 12} ${h - 12} L ${w - 12} ${h - 30} M ${w - 12} ${h - 12} L ${w - 30} ${h - 12}"/>
  </g>
</svg>
`;
}

async function main() {
  const data = await loadCanonical();
  const dir = resolve(ROOT, 'assets/pistas/premium-styles');
  await mkdir(dir, { recursive: true });

  await writeFile(resolve(dir, 'watchmaker.svg'), buildWatchmaker(data));
  await writeFile(resolve(dir, 'broadcast-f1.svg'), buildBroadcastF1(data));
  await writeFile(resolve(dir, 'carbon-concept.svg'), buildCarbonConcept(data));

  console.log('[premium-styles] OK');
  console.log('  watchmaker.svg     — preto + champagne + halo quente');
  console.log('  broadcast-f1.svg   — navy + glow ciano + tipografia FOM');
  console.log('  carbon-concept.svg — carbon weave + prata + accent F1 red');
}

main().catch(err => { console.error(err); process.exit(1); });
