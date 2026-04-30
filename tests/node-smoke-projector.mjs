// Smoke do projector — valida transformação afim lat/lng→viewBox (T-003 / A-003)

import { projectToViewBox, applyProjection } from '../src/telemetry/projector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Track sintético com 2 âncoras
const track = {
  geoAncoras: [
    { lat: -15.77,      lng: -47.90,      x: 400, y: 400 },
    { lat: -15.77 + 0.001, lng: -47.90 + 0.001, x: 500, y: 300 },
  ],
};

t('projectToViewBox: âncora 0 → (x0, y0)', () => {
  const r = projectToViewBox({ lat: -15.77, lng: -47.90 }, track);
  if (!r) throw new Error('null');
  if (Math.abs(r.x - 400) > 0.1) throw new Error('x divergiu: ' + r.x);
  if (Math.abs(r.y - 400) > 0.1) throw new Error('y divergiu: ' + r.y);
});

t('projectToViewBox: âncora 1 → (x1, y1)', () => {
  const r = projectToViewBox({ lat: -15.77 + 0.001, lng: -47.90 + 0.001 }, track);
  if (Math.abs(r.x - 500) > 0.5) throw new Error('x divergiu: ' + r.x);
  if (Math.abs(r.y - 300) > 0.5) throw new Error('y divergiu: ' + r.y);
});

t('projectToViewBox: ponto intermediário cai entre as âncoras', () => {
  const r = projectToViewBox({ lat: -15.77 + 0.0005, lng: -47.90 + 0.0005 }, track);
  // meio do caminho entre (400,400) e (500,300) → (450, 350)
  if (Math.abs(r.x - 450) > 1) throw new Error('x ≠ 450: ' + r.x);
  if (Math.abs(r.y - 350) > 1) throw new Error('y ≠ 350: ' + r.y);
});

t('projectToViewBox: track sem âncoras → null', () => {
  const r = projectToViewBox({ lat: -15.77, lng: -47.90 }, {});
  if (r !== null) throw new Error('deveria retornar null');
});

t('projectToViewBox: sample sem lat/lng → null', () => {
  if (projectToViewBox({}, track) !== null) throw new Error('deveria ser null');
});

t('applyProjection: popula sample.x/y in-place', () => {
  const s = { lat: -15.77, lng: -47.90 };
  const ok2 = applyProjection(s, track);
  if (!ok2) throw new Error('retornou false');
  if (s.x !== 400 || Math.abs(s.y - 400) > 0.1) throw new Error('x/y não foram setados');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
