// Smoke Node do Detector — prova que temposPorParcial são preenchidos ao fechar volta

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { Detector } = await import('../src/telemetry/detector.js');

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

const linhaChegada = { x1: -5, y1: 0, x2: 5, y2: 0 };
const svgPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';

function makePoints() {
  const pts = [];
  const t0 = 1000;
  pts.push({ t: t0,        x: 0, y: 0, offset: 0 });
  pts.push({ t: t0 + 400,  x: 0, y: 0, offset: 333 });
  pts.push({ t: t0 + 800,  x: 0, y: 0, offset: 666 });
  pts.push({ t: t0 + 1200, x: 0, y: 0, offset: 1000 });
  return pts;
}

t('Detector: volta completa fecha com temposPorParcial.P1/P2/P3 > 0', () => {
  const d = new Detector({ svgPath, linhaChegada, segments: [] });
  const laps = [];
  d.onLap((l) => laps.push(l));

  const pts = makePoints();
  d._onLineCross(pts[0]);
  d._onParcialChange('P1', pts[0].t);   // inicia P1 logo após linha
  d._onParcialChange('P2', pts[1].t);   // P1 fecha, inicia P2
  d._onParcialChange('P3', pts[2].t);   // P2 fecha, inicia P3
  d._onLineCross(pts[3]);               // P3 fecha, emite volta

  if (laps.length !== 1) throw new Error('esperava 1 lap, veio ' + laps.length);
  const l = laps[0];
  const tpp = l.temposPorParcial || {};
  if (!(tpp.P1 > 0)) throw new Error('temposPorParcial.P1 inválido: ' + tpp.P1);
  if (!(tpp.P2 > 0)) throw new Error('temposPorParcial.P2 inválido: ' + tpp.P2);
  if (!(tpp.P3 > 0)) throw new Error('temposPorParcial.P3 inválido: ' + tpp.P3);
  if (!(l.tempoMs > 0)) throw new Error('tempoMs inválido: ' + l.tempoMs);
});

t('Detector: onSegmentStart emite quando carro entra num segment novo (F4 dinâmico)', () => {
  // Path simples 100×100 → totalLength ~400u; 1 segment cobrindo 25% a 50% (offset 100..200)
  const seg = { id: 'seg-A', nome: 'CURVA A', pathStart: 25, pathEnd: 50 };
  const d = new Detector({ svgPath, linhaChegada, segments: [seg] });
  const starts = [];
  const ends = [];
  d.onSegmentStart((ev) => starts.push(ev));
  d.onSegmentEnd((ev) => ends.push(ev));
  // Sample 1 — fora do segment (offset 0)
  d.consume({ x: 0, y: 0, t: 1000, speed: 25 });
  if (starts.length !== 0) throw new Error('starts deveria ser 0 fora do segment');
  // Sample 2 — dentro do segment (offset ~100, no canto direito do retângulo)
  d.consume({ x: 100, y: 0, t: 1100, speed: 25 });
  if (starts.length !== 1) throw new Error('starts deveria ser 1 ao entrar; foi ' + starts.length);
  if (starts[0].segmentId !== 'seg-A') throw new Error('segmentId errado: ' + starts[0].segmentId);
  // Sample 3 — sai do segment (offset ~200)
  d.consume({ x: 100, y: 100, t: 1200, speed: 25 });
  if (ends.length !== 1) throw new Error('ends deveria ser 1 ao sair; foi ' + ends.length);
});

t('Detector: onSegmentStart NÃO duplica enquanto continua no MESMO segment', () => {
  const seg = { id: 'seg-B', nome: 'CURVA B', pathStart: 25, pathEnd: 75 };
  const d = new Detector({ svgPath, linhaChegada, segments: [seg] });
  const starts = [];
  d.onSegmentStart((ev) => starts.push(ev));
  // Entra
  d.consume({ x: 0, y: 0, t: 1000, speed: 25 });
  d.consume({ x: 100, y: 0, t: 1100, speed: 25 });
  // Continua dentro do segment — segment não muda
  d.consume({ x: 100, y: 50, t: 1200, speed: 25 });
  if (starts.length !== 1) throw new Error('starts deveria ser 1; foi ' + starts.length);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
