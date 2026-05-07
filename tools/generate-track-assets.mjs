// ═══════════════════════════════════════════════════════════
// generate-track-assets — gera SVG estilizado + JSON de pontos
// ═══════════════════════════════════════════════════════════
// Lê o svgPath GPS-calibrado de src/domain/seed-tracks.js (volta 5 do
// Flávio, 171.038s, viewBox 823×799 — ADR/seed) e produz três artefatos:
//
//   assets/pistas/<apelido>.svg              — base estilizada (vetorial)
//   assets/pistas/<apelido>-points.svg       — overlay de pontos
//   assets/pistas/<apelido>-reference.json   — pontos reamostrados p/ iOS
//
// Reproducível: rode `node tools/generate-track-assets.mjs` quando o
// path GPS for atualizado. Sem dependências externas — só path-mapper.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePath, pathLength, buildLookup } from '../src/telemetry/path-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Suavização Gaussiana em arc-length real (metros). Mata oscilações
// menores que ~2σ e preserva curvas reais (cujo raio é >> σ).
//
// ATENÇÃO: aplicado SÓ no gerador, NÃO no svgPath fonte
// (src/domain/seed-tracks.js) — telemetria do app continua usando a
// polilinha GPS-calibrada original.
//
// Pipeline:
//   1) Reamostra o path em pontos uniformemente espaçados em arc-length
//      (sub-amostragem fina pra convolução não distorcer)
//   2) Convolui x(s) e y(s) separadamente com kernel Gaussiano 1D circular
//   3) Decima pra ~600 vértices (path leve mas detalhado)
function smoothPathGaussian(d, sigmaMeters, totalRealMeters) {
  const lookup = buildLookup(d, 4000);
  const totalSvg = lookup.totalLength;
  const mPerU = totalRealMeters / totalSvg;
  const sigmaSvg = sigmaMeters / mPerU;
  const sampleStepM = 0.5;
  const sampleStepSvg = sampleStepM / mPerU;
  const N = Math.max(200, Math.round(totalSvg / sampleStepSvg));
  const stepFinal = totalSvg / N;
  const pts = lookup.points;

  // 1) Reamostragem uniforme
  const xs = new Float64Array(N), ys = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const target = i * stepFinal;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].offset < target) lo = mid + 1; else hi = mid; }
    const a = pts[Math.max(0, lo - 1)], b = pts[Math.min(pts.length - 1, lo)];
    const span = (b.offset - a.offset) || 1;
    const t = (target - a.offset) / span;
    xs[i] = a.x + (b.x - a.x) * t;
    ys[i] = a.y + (b.y - a.y) * t;
  }

  // 2) Kernel Gaussiano (raio 3σ)
  const kRadius = Math.max(1, Math.ceil(3 * sigmaSvg / stepFinal));
  const kernel = new Float64Array(2 * kRadius + 1);
  let kSum = 0;
  for (let k = -kRadius; k <= kRadius; k++) {
    const w = Math.exp(-((k * stepFinal) ** 2) / (2 * sigmaSvg * sigmaSvg));
    kernel[k + kRadius] = w;
    kSum += w;
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= kSum;

  // 3) Convolução circular
  const sx = new Float64Array(N), sy = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let ax = 0, ay = 0;
    for (let k = -kRadius; k <= kRadius; k++) {
      const j = ((i + k) % N + N) % N;
      const w = kernel[k + kRadius];
      ax += xs[j] * w;
      ay += ys[j] * w;
    }
    sx[i] = ax;
    sy[i] = ay;
  }

  // 4) Sem decimação — preserva resolução total da suavização. O peso
  // extra do SVG é mitigado por <defs>/<use> no render (4 paths viram 1).
  const head = `M ${sx[0].toFixed(2)} ${sy[0].toFixed(2)}`;
  const rest = [];
  for (let i = 1; i < N; i++) rest.push(`L ${sx[i].toFixed(2)} ${sy[i].toFixed(2)}`);
  return `${head} ${rest.join(' ')} Z`;
}

const PALETTE = {
  bgFar:    '#0E1014', // fundo cena
  runoff:   '#3A352E', // anel de escape (warm gray)
  asphalt:  '#2A2D31', // fita da pista
  asphaltLight: '#34373B',
  pitlane:  '#34373B',
  pointDot: '#FFFFFF',
};

const TRACKS = [
  {
    apelido: 'brasilia',
    nomeOficial: 'Autódromo Internacional Nelson Piquet',
    extensaoMetros: 5476,
    spacingMeters: 2.5,
    pathConst: 'BRASILIA_PATH',
    viewBox: { w: 823, h: 799 },
  },
];

async function extractPathFromSeed(constName) {
  const src = await readFile(resolve(ROOT, 'src/domain/seed-tracks.js'), 'utf8');
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*'([^']+)'`);
  const m = src.match(re);
  if (!m) throw new Error(`não achei ${constName} em seed-tracks.js`);
  return m[1];
}

function resampleByDistance(svgPath, totalRealMeters, spacingMeters) {
  const lookup = buildLookup(svgPath, 4000);
  const totalSvg = lookup.totalLength;
  const metersPerUnit = totalRealMeters / totalSvg;
  const spacingSvg = spacingMeters / metersPerUnit;
  const nPoints = Math.round(totalSvg / spacingSvg);
  const stepSvg = totalSvg / nPoints;

  const pts = lookup.points;
  const out = [];
  for (let i = 0; i < nPoints; i++) {
    const target = i * stepSvg;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].offset < target) lo = mid + 1; else hi = mid;
    }
    const p = pts[Math.max(0, lo - 1)];
    const q = pts[Math.min(pts.length - 1, lo)];
    const span = (q.offset - p.offset) || 1;
    const t = (target - p.offset) / span;
    const x = p.x + (q.x - p.x) * t;
    const y = p.y + (q.y - p.y) * t;
    out.push({ idx: i, x, y, sSvg: target, sMeters: i * spacingMeters });
  }
  // heading + curvatura (diferenças centrais cíclicas)
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const prev = out[(i - 1 + n) % n];
    const next = out[(i + 1) % n];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    out[i].heading = Math.atan2(dy, dx);
  }
  for (let i = 0; i < n; i++) {
    const prev = out[(i - 1 + n) % n];
    const next = out[(i + 1) % n];
    let dHeading = next.heading - prev.heading;
    while (dHeading > Math.PI) dHeading -= 2 * Math.PI;
    while (dHeading < -Math.PI) dHeading += 2 * Math.PI;
    const dsMeters = 2 * spacingMeters;
    out[i].curvature = dHeading / dsMeters;
  }
  return { points: out, totalSvg, totalRealMeters, metersPerUnit, spacingMeters };
}

function buildBaseSvg({ viewBox, svgPath }) {
  const { w, h } = viewBox;
  const strokeAsphalt = 22;
  const strokeRunoff = 38;
  const strokeKerb = 24.4;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Autódromo de Brasília — base estilizada">
  <title>Autódromo Internacional Nelson Piquet — base layer</title>
  <desc>Base vetorial para overlays de telemetria. Geometria GPS-calibrada (volta de referência). Não conter texto, marcas ou perspectiva — overlays vivem em camada superior.</desc>
  <defs>
    <style>
      .bg      { fill: ${PALETTE.bgFar}; }
      .runoff  { fill: none; stroke: ${PALETTE.runoff};  stroke-width: ${strokeRunoff}; stroke-linejoin: round; stroke-linecap: round; opacity: 0.55; }
      .kerb    { fill: none; stroke: ${PALETTE.asphaltLight}; stroke-width: ${strokeKerb}; stroke-linejoin: round; stroke-linecap: round; opacity: 0.40; }
      .asphalt { fill: none; stroke: ${PALETTE.asphalt}; stroke-width: ${strokeAsphalt}; stroke-linejoin: round; stroke-linecap: round; }
      .center  { fill: none; stroke: #FFFFFF; stroke-width: 0.6; stroke-dasharray: 2 6; opacity: 0.10; }
    </style>
    <path id="track" d="${svgPath}"/>
  </defs>
  <rect class="bg" x="0" y="0" width="${w}" height="${h}"/>
  <use class="runoff"  href="#track"/>
  <use class="kerb"    href="#track"/>
  <use class="asphalt" href="#track"/>
  <use class="center"  href="#track"/>
</svg>
`;
}

function buildPointsSvg({ viewBox, points }) {
  const { w, h } = viewBox;
  const dots = points
    .map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.4" data-idx="${p.idx}" data-s="${p.sMeters}"/>`)
    .join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Pontos de telemetria — overlay">
  <title>Pontos de referência (overlay)</title>
  <desc>Pontos equidistantes (5m) para o app pintar status de telemetria. data-idx e data-s expostos.</desc>
  <g fill="${PALETTE.pointDot}" fill-opacity="0.18">
  ${dots}
  </g>
</svg>
`;
}

function buildPreviewSvg({ viewBox, svgPath, points }) {
  const { w, h } = viewBox;
  const strokeAsphalt = 22;
  const strokeRunoff = 38;
  const strokeKerb = 24.4;
  const dots = points
    .map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.8"/>`)
    .join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Autódromo de Brasília — preview combinado (base + pontos)">
  <title>Preview — base estilizada + 1095 pontos a 5m</title>
  <desc>Visualização para humanos. Combina brasilia.svg + brasilia-points.svg num único arquivo, com pontos em cor visível. NÃO usar este arquivo no app — o app empilha os dois originais.</desc>
  <defs>
    <style>
      .bg      { fill: ${PALETTE.bgFar}; }
      .runoff  { fill: none; stroke: ${PALETTE.runoff};  stroke-width: ${strokeRunoff}; stroke-linejoin: round; stroke-linecap: round; opacity: 0.55; }
      .kerb    { fill: none; stroke: ${PALETTE.asphaltLight}; stroke-width: ${strokeKerb}; stroke-linejoin: round; stroke-linecap: round; opacity: 0.40; }
      .asphalt { fill: none; stroke: ${PALETTE.asphalt}; stroke-width: ${strokeAsphalt}; stroke-linejoin: round; stroke-linecap: round; }
      .dots    { fill: #FF7A1A; }
    </style>
    <path id="track" d="${svgPath}"/>
  </defs>
  <rect class="bg" x="0" y="0" width="${w}" height="${h}"/>
  <use class="runoff"  href="#track"/>
  <use class="kerb"    href="#track"/>
  <use class="asphalt" href="#track"/>
  <g class="dots">
    ${dots}
  </g>
</svg>
`;
}

function buildReferenceJson({ apelido, nomeOficial, viewBox, resampled }) {
  return {
    trackApelido: apelido,
    trackNome: nomeOficial,
    viewBox,
    spacingMeters: resampled.spacingMeters,
    totalLengthMeters: resampled.totalRealMeters,
    totalLengthSvgUnits: Number(resampled.totalSvg.toFixed(4)),
    metersPerUnit: Number(resampled.metersPerUnit.toFixed(6)),
    pointsCount: resampled.points.length,
    points: resampled.points.map(p => ({
      idx: p.idx,
      x: Number(p.x.toFixed(3)),
      y: Number(p.y.toFixed(3)),
      sMeters: p.sMeters,
      heading: Number(p.heading.toFixed(5)),
      curvature: Number(p.curvature.toFixed(7)),
    })),
    fonte: 'tools/generate-track-assets.mjs (svgPath GPS-calibrado em src/domain/seed-tracks.js)',
  };
}

async function generateTrack(track) {
  const rawPath = await extractPathFromSeed(track.pathConst);
  // Suavização Gaussiana com σ=18m: mata wobbles até ~36m (FWHM).
  // Curvas reais de Brasília (raio 30-100m) ficam suavizadas mas
  // reconhecíveis. Sem decimação no path final pra preservar fluidez.
  const svgPath = smoothPathGaussian(rawPath, 18, track.extensaoMetros);
  const resampled = resampleByDistance(svgPath, track.extensaoMetros, track.spacingMeters);

  const baseSvg = buildBaseSvg({ viewBox: track.viewBox, svgPath });
  const pointsSvg = buildPointsSvg({ viewBox: track.viewBox, points: resampled.points });
  const previewSvg = buildPreviewSvg({ viewBox: track.viewBox, svgPath, points: resampled.points });
  const refJson = buildReferenceJson({
    apelido: track.apelido,
    nomeOficial: track.nomeOficial,
    viewBox: track.viewBox,
    resampled,
  });

  const dir = resolve(ROOT, 'assets/pistas');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `${track.apelido}.svg`), baseSvg);
  await writeFile(resolve(dir, `${track.apelido}-points.svg`), pointsSvg);
  await writeFile(resolve(dir, `${track.apelido}-preview.svg`), previewSvg);
  await writeFile(resolve(dir, `${track.apelido}-reference.json`), JSON.stringify(refJson, null, 2));

  return {
    apelido: track.apelido,
    pontos: resampled.points.length,
    totalSvg: resampled.totalSvg.toFixed(2),
    metersPerUnit: resampled.metersPerUnit.toFixed(4),
  };
}

async function main() {
  const results = [];
  for (const t of TRACKS) results.push(await generateTrack(t));
  console.log('[generate-track-assets] OK');
  for (const r of results) {
    console.log(`  ${r.apelido}: ${r.pontos} pontos, totalSvg=${r.totalSvg} u, ${r.metersPerUnit} m/u`);
  }
}

main().catch(err => {
  console.error('[generate-track-assets] FAIL', err);
  process.exit(1);
});
