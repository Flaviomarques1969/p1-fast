// Smoke do TrechoAdvisor — Comando GO 2026-05-24
// ────────────────────────────────────────────────
// Cobre os 5 cenários listados no plano:
//   1. Sem histórico (primeira vez)
//   2. Melhor passagem histórica (única ou empate)
//   3. Freou tarde demais (delta no indicador Freada)
//   4. Vmin baixo (delta no Vmin)
//   5. Pace baixo (delta no Pace)

import { gerarConselho } from '../src/domain/trecho-advisor.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

function exec(over) {
  return {
    voltaId: 'v', vChegadaKmh: 156, vEntradaKmh: 136, vFreadaKmh: 153,
    vminKmh: 104, vPaceKmh: 106, vSaidaPicoKmh: 142, ...over,
  };
}

t('1. única passagem → frase "primeira passagem"', () => {
  const r = gerarConselho('Curva 1', [exec({})]);
  if (!r || !r.includes('primeira passagem')) throw new Error('frase errada: ' + r);
});

t('2. última = melhor em tudo → "melhor passagem registrada"', () => {
  const r = gerarConselho('Curva da Bruxa', [
    exec({ voltaId: 'a', vminKmh: 102 }),
    exec({ voltaId: 'b', vminKmh: 103 }),
    exec({ voltaId: 'c', vminKmh: 104 }), // última é a melhor
  ]);
  if (!r || !r.includes('melhor passagem')) throw new Error('frase errada: ' + r);
});

t('3. Freada baixa → menciona "Freada"', () => {
  const r = gerarConselho('Curva 1', [
    // Cria 2 passagens: a primeira freou em 153 (mais tarde), última em 145.
    // Os outros indicadores ficam IGUAIS pra isolar a Freada como pior.
    exec({ voltaId: 'a', vFreadaKmh: 153, vminKmh: 104, vPaceKmh: 106 }),
    exec({ voltaId: 'b', vFreadaKmh: 145, vminKmh: 104, vPaceKmh: 106 }),
  ]);
  if (!r || !r.includes('Freada')) throw new Error('frase não cita Freada: ' + r);
  if (!r.includes('8.0 km/h')) throw new Error('delta errado: ' + r);
});

t('4. Vmin baixo → menciona "Vmin" (prioridade máxima)', () => {
  const r = gerarConselho('Junção', [
    exec({ voltaId: 'a', vminKmh: 110, vPaceKmh: 113 }),
    exec({ voltaId: 'b', vminKmh: 102, vPaceKmh: 108 }), // perdeu Vmin (-8) e Pace (-5)
  ]);
  // Pelo critério "maior delta", Vmin (8) > Pace (5) → ganha Vmin.
  if (!r || !r.includes('Vmin')) throw new Error('esperava Vmin: ' + r);
});

t('5. Pace baixo isoladamente → menciona "Pace"', () => {
  const r = gerarConselho('Bruxa', [
    exec({ voltaId: 'a', vPaceKmh: 110 }),
    exec({ voltaId: 'b', vPaceKmh: 104 }),
  ]);
  if (!r || !r.includes('Pace')) throw new Error('frase não cita Pace: ' + r);
});

t('6. tolerância 0.15 km/h: variação dentro do ruído conta como "melhor passagem"', () => {
  const r = gerarConselho('Curva 1', [
    exec({ voltaId: 'a', vminKmh: 104.0, vPaceKmh: 106.0, vChegadaKmh: 156.0 }),
    exec({ voltaId: 'b', vminKmh: 103.95, vPaceKmh: 105.95, vChegadaKmh: 155.95 }),
  ]);
  if (!r || !r.includes('melhor passagem')) throw new Error('esperava "melhor passagem": ' + r);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
