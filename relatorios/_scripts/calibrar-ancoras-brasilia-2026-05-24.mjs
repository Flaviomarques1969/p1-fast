// Calibração das âncoras geográficas de Brasília usando o GPS de hoje
// ──────────────────────────────────────────────────────────────────────
// Estratégia:
//  1. Rodar o Detector com bounding-box-calibration (~95% snap pass).
//  2. Pra cada passagem nos trechos seg_brasilia_0 (Curva 1) e
//     seg_brasilia_6 (Curva da Bruxa), pegar o `apexT` (momento exato
//     em que o carro estava no ápice).
//  3. Lookup no GPS bruto pelo timestamp → obter lat/lng médio das
//     passagens daquele ápice.
//  4. Coordenadas (x, y) no desenho da pista já estão em
//     `MAPA-BRASILIA-DEFINITIVO.json` em `trechos[].apices[0]`.
//  5. Resultado: 2 âncoras (lat, lng, x, y) calibradas com dado real.
//  6. Atualizar o JSON do cadastro do circuito (com backup).
//  7. Re-validar — rodar a análise inteira de novo com âncoras novas
//     e mostrar a melhoria no relatório.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Detector } from '../../src/telemetry/detector.js';
import { projectToViewBox } from '../../src/telemetry/projector.js';
import { buildLookup, snap } from '../../src/telemetry/path-mapper.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const mapaPath = path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json');
const mapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

// ── 1. Bounding-box calibration temporária (pra o detector funcionar) ──
const lookup = buildLookup(svgPath, 4000);
let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
for(const p of lookup.points){xMin=Math.min(xMin,p.x);xMax=Math.max(xMax,p.x);yMin=Math.min(yMin,p.y);yMax=Math.max(yMax,p.y);}

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), speed: Number(kmh) / 3.6 };
});
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const trackAuto = { geoAncoras: [
  { lat: Math.min(...lats), lng: Math.min(...lngs), x: xMin, y: yMax },
  { lat: Math.max(...lats), lng: Math.max(...lngs), x: xMax, y: yMin },
]};

// ── 2. Montar segments com pathStart/pathEnd dos pontos E/S ──
function pctOf(point) {
  delete lookup._lastIdx;
  const r = snap(lookup, point.x, point.y);
  return (r.offset / lookup.totalLength) * 100;
}
const segmentos = mapa.trechos
  .filter(t => t.eh_trecho_pedagogico && t.entradas?.length && t.saidas?.length)
  .map(t => ({
    id: t.id, nome: t.nome,
    parcialId: t.parcial,
    pathStart: pctOf(t.entradas[0]),
    pathEnd: pctOf(t.saidas[0]),
    pontoApiceDesenho: t.apices[0],
  }));

// ── 3. Rodar Detector ──
const detector = new Detector({ svgPath, linhaChegada: mapa.pista.linha_chegada, segments: segmentos });
const segmentEnds = [];
detector.onSegmentEnd(ev => segmentEnds.push(ev));

for (const s of samples) {
  const proj = projectToViewBox(s, trackAuto);
  if (!proj) continue;
  detector.consume({ x: proj.x, y: proj.y, t: s.t, speed: s.speed });
}

console.error(`Detector emitiu ${segmentEnds.length} passagens`);

// ── 4. Pra Curva 1 e Curva da Bruxa: pegar apexT de cada passagem e fazer lookup do GPS ──
function gpsNoInstante(t) {
  // Lookup binário; samples já está ordenado por t
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (samples[m].t < t) lo = m + 1; else hi = m;
  }
  const i = Math.max(0, lo - 1);
  // Interpolação linear entre i e i+1
  const a = samples[i], b = samples[Math.min(i + 1, samples.length - 1)];
  if (a === b) return { lat: a.lat, lng: a.lng };
  const frac = (t - a.t) / (b.t - a.t);
  return { lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac };
}

function mediaApiceDoTrecho(segId) {
  const passagens = segmentEnds.filter(e => e.segmentId === segId && e.apexT != null);
  if (passagens.length === 0) return null;
  const coords = passagens.map(p => gpsNoInstante(p.apexT));
  return {
    lat: coords.reduce((a, c) => a + c.lat, 0) / coords.length,
    lng: coords.reduce((a, c) => a + c.lng, 0) / coords.length,
    n: coords.length,
  };
}

const apiceCurva1 = mediaApiceDoTrecho('seg_brasilia_0');
const apiceBruxa  = mediaApiceDoTrecho('seg_brasilia_6');
const pontoCurva1 = segmentos.find(s => s.id === 'seg_brasilia_0').pontoApiceDesenho;
const pontoBruxa  = segmentos.find(s => s.id === 'seg_brasilia_6').pontoApiceDesenho;

console.error(`Curva 1: ${apiceCurva1.n} passagens, GPS médio lat=${apiceCurva1.lat.toFixed(6)} lng=${apiceCurva1.lng.toFixed(6)} → desenho (${pontoCurva1.x}, ${pontoCurva1.y})`);
console.error(`Curva da Bruxa: ${apiceBruxa.n} passagens, GPS médio lat=${apiceBruxa.lat.toFixed(6)} lng=${apiceBruxa.lng.toFixed(6)} → desenho (${pontoBruxa.x}, ${pontoBruxa.y})`);

const ancorasNovas = [
  { latitude: apiceCurva1.lat, longitude: apiceCurva1.lng, x: pontoCurva1.x, y: pontoCurva1.y },
  { latitude: apiceBruxa.lat,  longitude: apiceBruxa.lng,  x: pontoBruxa.x,  y: pontoBruxa.y  },
];

// ── 5. Validar — rodar projeção com âncoras novas e medir snap pass ──
const trackNovo = { geoAncoras: ancorasNovas.map(a => ({ lat: a.latitude, lng: a.longitude, x: a.x, y: a.y })) };
let passNovo = 0, distSomaNovo = 0;
for (const s of samples) {
  const p = projectToViewBox(s, trackNovo);
  if (!p) continue;
  delete lookup._lastIdx;
  const sn = snap(lookup, p.x, p.y);
  distSomaNovo += sn.dist;
  if (sn.dist <= 80) passNovo++;
}
const passPctNovo = (passNovo * 100 / samples.length).toFixed(1);
const distMediaNovo = (distSomaNovo / samples.length).toFixed(1);

// Comparar com âncoras oficiais
const trackOficial = { geoAncoras: mapa.pista.ancoras_geo.map(a => ({ lat: a.latitude, lng: a.longitude, x: a.x, y: a.y })) };
let passOf = 0, distSomaOf = 0;
for (const s of samples) {
  const p = projectToViewBox(s, trackOficial);
  if (!p) continue;
  delete lookup._lastIdx;
  const sn = snap(lookup, p.x, p.y);
  distSomaOf += sn.dist;
  if (sn.dist <= 80) passOf++;
}
const passPctOf = (passOf * 100 / samples.length).toFixed(1);
const distMediaOf = (distSomaOf / samples.length).toFixed(1);

console.error('\n══ VALIDAÇÃO ══');
console.error(`Oficial (antiga): ${passPctOf}% dentro · dist média ${distMediaOf}`);
console.error(`Calibrada hoje:   ${passPctNovo}% dentro · dist média ${distMediaNovo}`);

// ── 6. Backup + atualizar JSON ──
const backup = mapaPath.replace('.json', `.backup-2026-05-24-${Date.now()}.json`);
fs.copyFileSync(mapaPath, backup);
console.error(`\nBackup do cadastro original em: ${path.basename(backup)}`);

mapa.pista.ancoras_geo = ancorasNovas;
mapa._meta = mapa._meta || {};
mapa._meta.ancoras_recalibradas_em = '2026-05-24';
mapa._meta.ancoras_recalibradas_metodo = 'média dos ápices reais da Curva 1 e Curva da Bruxa do stint EDA3DA6B-262D-4839-B6F0-26A3BE2891E7';
fs.writeFileSync(mapaPath, JSON.stringify(mapa, null, 2));
console.error(`Cadastro atualizado: ${path.basename(mapaPath)}`);

// ── 7. Salvar resultado pro relatório ──
const resultPath = path.join(ROOT, 'relatorios/_scripts/.calibracao-resultado.json');
fs.writeFileSync(resultPath, JSON.stringify({
  ancorasAntigas: mapa.pista.ancoras_geo,
  ancorasNovas,
  validacao: {
    oficialPct: parseFloat(passPctOf), oficialDistMedia: parseFloat(distMediaOf),
    novoPct: parseFloat(passPctNovo),  novoDistMedia: parseFloat(distMediaNovo),
  },
  apiceCurva1, apiceBruxa,
  pontoCurva1, pontoBruxa,
  backup: path.basename(backup),
}, null, 2));
console.error(`Resultado em: ${path.basename(resultPath)}`);
