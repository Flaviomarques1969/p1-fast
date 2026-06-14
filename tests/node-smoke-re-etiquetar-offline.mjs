// Smoke do re-etiquetador offline (FASE 3) — ajudantes puros: detecção de freada por
// desaceleração (0,5 g), hierarquia de âncora do ápice (alta/baixa/borda) e conversão de t.
// A re-etiquetagem em si (retagSubsPorEventos / acharVminBuffer) já é coberta por
// node-smoke-retag-vmin; aqui cobre só o que a FASE 3 acrescentou.
import {
  segundos, acharFreadaT, ancorarApice, acharPaceIdx,
} from '../tools/re-etiquetar-passagens-offline.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// ── segundos: ms → s ──
t('segundos: 2000ms vira 2s', segundos(2000) === 2);
t('segundos: valor pequeno já é s', segundos(5) === 5);

// ── acharFreadaT: pico antes da 1ª desaceleração >= 0,5 g (t = ms de época, como o dado real) ──
const T0 = 1779562246088; // base epoch-ms realista
{
  // 140→140→100 km/h em 1 s = ~11 m/s² (>> 4,9). freada começa no pico (idx1, t=T0+1000).
  const pts = [
    { kmh: 140, t: T0 }, { kmh: 140, t: T0 + 1000 }, { kmh: 100, t: T0 + 2000 },
    { kmh: 95, t: T0 + 3000 }, { kmh: 110, t: T0 + 4000 },
  ];
  t('acharFreadaT marca o pico antes do tombo', acharFreadaT(pts, 3) === T0 + 1000, String(acharFreadaT(pts, 3)));
}
{
  // queda suave (sem cruzar 0,5 g): 100→98→96 em 1 s = ~0,55 m/s² → null (não inventa)
  const pts = [{ kmh: 100, t: T0 }, { kmh: 98, t: T0 + 1000 }, { kmh: 96, t: T0 + 2000 }];
  t('acharFreadaT sem freada nítida → null', acharFreadaT(pts, 2) === null);
}

// ── ancorarApice: hierarquia ──
// ~11 m por passo de 0,0001 grau de longitude.
const ptsGeo = [0, 1, 2, 3, 4].map(i => ({ lat: 0, lng: i * 0.0001, kmh: 100 - i, t: i * 1000 }));
{
  // ápice geométrico em cima do idx3 (dist ~0) → 'alta'
  const a = ancorarApice(ptsGeo, { lat: 0, lng: 0.0003 }, 4);
  t('ancorarApice ALTA quando ápice geométrico casa (<=60m)', a.confianca === 'alta' && a.apiceT === 3000, JSON.stringify(a));
}
{
  // ápice geométrico longe (>1km) + Vmin no MEIO (idx2) → 'baixa', ancora em t[idx-1]
  const a = ancorarApice(ptsGeo, { lat: 0, lng: 0.01 }, 2);
  t('ancorarApice BAIXA ancora no Vmin (meio)', a.confianca === 'baixa' && a.apiceT === 1000, JSON.stringify(a));
}
{
  // ápice geométrico longe + Vmin na BORDA (idx0) → 'borda', apiceT = t[0]
  const a = ancorarApice(ptsGeo, { lat: 0, lng: 0.01 }, 0);
  t('ancorarApice BORDA quando Vmin na 1ª amostra', a.confianca === 'borda' && a.apiceT === 0, JSON.stringify(a));
}
{
  // sem geometria e sem Vmin → 'borda' sem apiceT (não estoura)
  const a = ancorarApice(ptsGeo, null, null);
  t('ancorarApice sem geo nem Vmin → borda/null', a.confianca === 'borda' && a.apiceT === null, JSON.stringify(a));
}

console.log(`\n${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
