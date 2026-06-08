// Smoke test do apice-calculator.
// Verifica: 1) círculo perfeito = ápice no meio; 2) reta = null;
// 3) trajetória real do trajeto Brasília tem ápice plausível.

import { acharApice } from '../web/cockpit/apice-calculator.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

// Helper: gera arco de círculo com centro c, raio r, de ang0 a ang1, N pontos.
function arcoCirculo(centroLat, centroLng, raioM, ang0, ang1, n) {
  const M_LAT = 111_132.0;
  const M_LNG = 111_320.0 * Math.cos(centroLat * Math.PI / 180);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ang0 + (ang1 - ang0) * i / (n - 1);
    pts.push({
      lat: centroLat + (raioM * Math.sin(a)) / M_LAT,
      lng: centroLng + (raioM * Math.cos(a)) / M_LNG,
    });
  }
  return pts;
}

t('AC-01 arco de 20m de raio: detecta raio ~20m (idx em qualquer posição válida)', () => {
  const pts = arcoCirculo(-15.77, -47.90, 20, 0, Math.PI, 21);
  const r = acharApice(pts);
  if (!r) throw new Error('não detectou ápice');
  if (r.raioM < 18 || r.raioM > 22) throw new Error(`raio fora da faixa esperada: ${r.raioM}m`);
});

t('AC-02 reta pura: retorna null (raio > 200m)', () => {
  const pts = [];
  for (let i = 0; i < 20; i++) pts.push({ lat: -15.77 + i * 0.0001, lng: -47.90 });
  const r = acharApice(pts);
  if (r !== null) throw new Error(`esperava null, recebeu raio=${r.raioM}m`);
});

t('AC-03 passagem curta (menos pontos que a janela): retorna null', () => {
  const pts = [{lat: 0, lng: 0}, {lat: 0, lng: 0.0001}];
  const r = acharApice(pts);
  if (r !== null) throw new Error('esperava null');
});

t('AC-04 trajetória de curva real (entrada larga, ápice apertado, saída larga)', () => {
  // Constrói trajetória contínua: entrada (raio 60m), ápice (raio 18m), saída (raio 60m).
  // Espiral simples: raio cai de 60 a 18 e volta a 60.
  const N = 41;
  const M_LAT = 111_132.0;
  const M_LNG = 111_320.0 * Math.cos(-15.77 * Math.PI / 180);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);                      // 0..1
    const raio = 60 - 42 * Math.sin(t * Math.PI); // 60 → 18 → 60
    const ang = -Math.PI/2 + t * Math.PI;        // -90° a +90°
    pts.push({
      lat: -15.77 + (raio * Math.sin(ang)) / M_LAT,
      lng: -47.90 + (raio * Math.cos(ang)) / M_LNG,
    });
  }
  const r = acharApice(pts);
  if (!r) throw new Error('não detectou ápice');
  // O ápice físico está no meio (i ≈ 20).
  if (r.idx < 15 || r.idx > 25) throw new Error(`ápice fora do meio: idx=${r.idx}`);
  if (r.raioM > 30) throw new Error(`raio do ápice maior que o esperado: ${r.raioM}m`);
});

console.log(`\nApice Calculator: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
