// ═══════════════════════════════════════════════════════════
// compare-track-densities — gera previews em vários espaçamentos
// ═══════════════════════════════════════════════════════════
// Output: assets/pistas/comparacoes/brasilia-Xm.svg para cada X.
// Não é runtime — só visual aid pra escolher granularidade.
// Reproduzível: rode `node tools/compare-track-densities.mjs`.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePath, buildLookup } from '../src/telemetry/path-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SPACINGS_M = [1, 2.5, 5, 10, 20];
const TRACK_REAL_M = 5476;
const VIEWBOX = { w: 823, h: 799 };

function smoothPathChaikin(d, iterations = 1) {
  let pts = parsePath(d);
  if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) {
    pts = pts.slice(0, -1);
  }
  for (let it = 0; it < iterations; it++) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    pts = out;
  }
  const head = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  const rest = pts.slice(1).map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `${head} ${rest} Z`;
}

function resample(svgPath, spacingM) {
  const lookup = buildLookup(svgPath, 4000);
  const totalSvg = lookup.totalLength;
  const mPerU = TRACK_REAL_M / totalSvg;
  const stepSvg = spacingM / mPerU;
  const n = Math.round(totalSvg / stepSvg);
  const stepFinal = totalSvg / n;
  const pts = lookup.points;
  const out = [];
  for (let i = 0; i < n; i++) {
    const target = i * stepFinal;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].offset < target) lo = mid + 1; else hi = mid; }
    const p = pts[Math.max(0, lo - 1)], q = pts[Math.min(pts.length - 1, lo)];
    const span = (q.offset - p.offset) || 1;
    const t = (target - p.offset) / span;
    out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  }
  return out;
}

function buildPanelSvg({ svgPath, points, spacingM }) {
  const { w, h } = VIEWBOX;
  const dotR = spacingM <= 1 ? 1.2 : spacingM <= 2.5 ? 1.6 : spacingM <= 5 ? 1.9 : spacingM <= 10 ? 2.5 : 3.4;
  const dots = points.map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${dotR}"/>`).join('');
  const labelMain = `${spacingM} m`;
  const labelSub = `${points.length} pontos`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#0E1014"/>
  <path d="${svgPath}" fill="none" stroke="#3A352E" stroke-width="38" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>
  <path d="${svgPath}" fill="none" stroke="#2A2D31" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
  <g fill="#FF7A1A">${dots}</g>
  <g font-family="-apple-system, system-ui, sans-serif" fill="#FFFFFF">
    <text x="40" y="80" font-size="64" font-weight="700">${labelMain}</text>
    <text x="40" y="120" font-size="28" opacity="0.7">${labelSub}</text>
  </g>
</svg>
`;
}

function buildGridSvg(panels) {
  // 5 paineis numa grade 3 colunas × 2 linhas (último slot vazio mostra legenda)
  const cols = 3, rows = 2;
  const cellW = VIEWBOX.w, cellH = VIEWBOX.h;
  const totalW = cellW * cols, totalH = cellH * rows;
  const inner = panels.map((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cellW, y = row * cellH;
    const dotR = p.spacingM <= 1 ? 1.2 : p.spacingM <= 2.5 ? 1.6 : p.spacingM <= 5 ? 1.9 : p.spacingM <= 10 ? 2.5 : 3.4;
    const dots = p.points.map(pt => `<circle cx="${pt.x.toFixed(2)}" cy="${pt.y.toFixed(2)}" r="${dotR}"/>`).join('');
    return `<g transform="translate(${x},${y})">
      <rect x="0" y="0" width="${cellW}" height="${cellH}" fill="#0E1014"/>
      <path d="${p.svgPath}" fill="none" stroke="#3A352E" stroke-width="38" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>
      <path d="${p.svgPath}" fill="none" stroke="#2A2D31" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
      <g fill="#FF7A1A">${dots}</g>
      <g font-family="-apple-system, system-ui, sans-serif" fill="#FFFFFF">
        <text x="40" y="90" font-size="76" font-weight="700">${p.spacingM} m</text>
        <text x="40" y="135" font-size="36" opacity="0.7">${p.points.length} pontos</text>
      </g>
    </g>`;
  }).join('\n');
  // legend slot (último)
  const legendIdx = panels.length;
  const lcol = legendIdx % cols, lrow = Math.floor(legendIdx / cols);
  const lx = lcol * cellW, ly = lrow * cellH;
  const legend = `<g transform="translate(${lx},${ly})">
    <rect x="0" y="0" width="${cellW}" height="${cellH}" fill="#0E1014"/>
    <g font-family="-apple-system, system-ui, sans-serif" fill="#FFFFFF">
      <text x="60" y="120" font-size="56" font-weight="700">Comparação</text>
      <text x="60" y="180" font-size="36" opacity="0.85">de granularidade</text>
      <text x="60" y="280" font-size="30" opacity="0.7">Pista: 5476 m</text>
      <text x="60" y="330" font-size="30" opacity="0.7">(Autódromo de Brasília)</text>
      <text x="60" y="430" font-size="26" opacity="0.6">Cada ponto laranja é uma posição</text>
      <text x="60" y="470" font-size="26" opacity="0.6">que o app pode pintar com cor</text>
      <text x="60" y="510" font-size="26" opacity="0.6">de status (verde/amarelo/vermelho)</text>
      <text x="60" y="510" font-size="26" opacity="0.6"></text>
      <text x="60" y="610" font-size="26" opacity="0.55">Mais pontos = mais granularidade</text>
      <text x="60" y="650" font-size="26" opacity="0.55">Menos pontos = mais leve no app</text>
    </g>
  </g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  ${inner}
  ${legend}
</svg>
`;
}

async function extractPath() {
  const src = await readFile(resolve(ROOT, 'src/domain/seed-tracks.js'), 'utf8');
  const m = src.match(/const\s+BRASILIA_PATH\s*=\s*'([^']+)'/);
  return m[1];
}

async function main() {
  const raw = await extractPath();
  const svgPath = smoothPathChaikin(raw, 2);

  const dir = resolve(ROOT, 'assets/pistas/comparacoes');
  await mkdir(dir, { recursive: true });

  const panels = [];
  for (const s of SPACINGS_M) {
    const points = resample(svgPath, s);
    panels.push({ spacingM: s, svgPath, points });
    const file = `brasilia-${String(s).replace('.', '_')}m.svg`;
    await writeFile(resolve(dir, file), buildPanelSvg({ svgPath, points, spacingM: s }));
    console.log(`  ${s.toString().padStart(4)} m → ${String(points.length).padStart(5)} pontos  →  ${file}`);
  }

  await writeFile(resolve(dir, 'brasilia-comparacao.svg'), buildGridSvg(panels));
  console.log('\n[grade comparativa] assets/pistas/comparacoes/brasilia-comparacao.svg');
}

main().catch(err => { console.error(err); process.exit(1); });
