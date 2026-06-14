// Smoke test do aprendizado #2 (tempo de passagem): escolhe o ponto de troca
// pelo MENOR tempo medido. É o que resolve "trocar em 6.050 vs esticar perto do
// redline" com dado real — vence quem dá o menor tempo.

import { criarAprendizadoTempoPassagem } from '../web/cockpit/aprendizado-tempo-passagem.js';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// ── Sem dados / dados insuficientes ────────────────────────────
let a = criarAprendizadoTempoPassagem();
check('ATP-01 sem dados → null',
  a.getMelhorPontoPorTempo({ trechoId: 'r1', marcha: 4 }) === null);

a.registrarPassagem({ trechoId: 'r1', marcha: 4, shiftRpm: 6050, tempoMs: 30000 });
check('ATP-02 um ponto com 1 amostra (< mínimo 2) → null',
  a.getMelhorPontoPorTempo({ trechoId: 'r1', marcha: 4 }) === null);

a.registrarPassagem({ trechoId: 'r1', marcha: 4, shiftRpm: 6050, tempoMs: 30100 });
const so1 = a.getMelhorPontoPorTempo({ trechoId: 'r1', marcha: 4 });
check('ATP-03 um ponto com 2 amostras → retorna esse ponto', so1 && so1.rpm === 6050, JSON.stringify(so1));
check('ATP-04 sem comparação, confiança fica parcial (≤ 0.5)', so1 && so1.confianca <= 0.5, so1 && String(so1.confianca));

// ── O ponto central: vence quem dá MENOR tempo ─────────────────
// Cenário A: esticar (6250) rende menos tempo que 6050 → escolhe 6250.
let estica = criarAprendizadoTempoPassagem();
for (let i = 0; i < 4; i++) {
  estica.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6050, tempoMs: 30500 + i * 10 });
  estica.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6250, tempoMs: 30000 + i * 10 }); // ~0,5s melhor
}
const recE = estica.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 });
check('ATP-05 quando ESTICAR (6250) dá menor tempo → escolhe 6250', recE && recE.rpm === 6250, JSON.stringify(recE));
check('ATP-06 vitória clara (~0,5s) → confiança alta (≥ 0.7)', recE && recE.confianca >= 0.7, recE && String(recE.confianca));

// Cenário B: trocar na potência máxima (6050) rende menos tempo → escolhe 6050.
let pico = criarAprendizadoTempoPassagem();
for (let i = 0; i < 4; i++) {
  pico.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6050, tempoMs: 29800 + i * 10 });
  pico.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6250, tempoMs: 30300 + i * 10 });
}
const recP = pico.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 });
check('ATP-07 quando 6.050 (potência máxima) dá menor tempo → escolhe 6050', recP && recP.rpm === 6050, JSON.stringify(recP));

// ── Agrupamento de pontos próximos (binRpm = 25) ───────────────
let bin = criarAprendizadoTempoPassagem();
bin.registrarPassagem({ trechoId: 'r3', marcha: 5, shiftRpm: 6248, tempoMs: 31000 });
bin.registrarPassagem({ trechoId: 'r3', marcha: 5, shiftRpm: 6252, tempoMs: 31010 });
const det = bin.getDetalhes()['r3:5'];
check('ATP-08 pontos a 6248 e 6252 caem no mesmo bin (6250)',
  det.length === 1 && det[0].rpm === 6250 && det[0].amostras === 2, JSON.stringify(det));

// ── Separação por trecho e por marcha (não mistura) ────────────
let sep = criarAprendizadoTempoPassagem();
sep.registrarPassagem({ trechoId: 'r4', marcha: 3, shiftRpm: 6000, tempoMs: 20000 });
sep.registrarPassagem({ trechoId: 'r4', marcha: 3, shiftRpm: 6000, tempoMs: 20000 });
check('ATP-09 não vaza pra outra marcha', sep.getMelhorPontoPorTempo({ trechoId: 'r4', marcha: 4 }) === null);
check('ATP-10 não vaza pra outro trecho', sep.getMelhorPontoPorTempo({ trechoId: 'r9', marcha: 3 }) === null);

// ── Entradas inválidas são ignoradas ───────────────────────────
let inv = criarAprendizadoTempoPassagem();
check('ATP-11 shiftRpm inválido → não registra', inv.registrarPassagem({ trechoId: 'r1', marcha: 4, shiftRpm: 0, tempoMs: 100 }) === false);
check('ATP-12 tempo inválido → não registra', inv.registrarPassagem({ trechoId: 'r1', marcha: 4, shiftRpm: 6000, tempoMs: -1 }) === false);
check('ATP-13 marcha não-número → não registra', inv.registrarPassagem({ trechoId: 'r1', marcha: 'x', shiftRpm: 6000, tempoMs: 100 }) === false);

// ── Persistência: export/import preserva a recomendação ────────
const dump = estica.exportarEstado();
let restaurado = criarAprendizadoTempoPassagem();
restaurado.importarEstado(dump);
const recR = restaurado.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 });
check('ATP-14 export/import preserva a recomendação aprendida',
  recR && recR.rpm === recE.rpm && recR.amostras === recE.amostras, JSON.stringify(recR));

// ── reset zera ─────────────────────────────────────────────────
estica.reset();
check('ATP-15 reset zera o aprendizado', estica.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 }) === null);

console.log(`\n[aprendizado-tempo-passagem.spec] ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
