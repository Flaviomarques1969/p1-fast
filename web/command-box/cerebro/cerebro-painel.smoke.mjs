// Teste FORA DO AR do cérebro do painel (Onda 1: voltas + ritmo).
// Alimenta o cérebro com os tempos REAIS de volta do stint gravado e confere
// que Voltas e Ritmo saem calculados (não hardcoded). Não toca rede nem produção.
//
// Rodar:  node web/command-box/cerebro/cerebro-painel.smoke.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarCerebroPainel, fmtTempo } from './cerebro-painel.js';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '../../..');
const fx = JSON.parse(readFileSync(resolve(raiz, 'web/cockpit/fixtures/stint-brasilia-3-laps.v1.json'), 'utf8'));

const pbEverSec = fx.track.pbEverSec;            // 91.95 -> "1:31.95"
const voltaTotal = fx.stintHistory.totalLaps;    // 12
const entradas = fx.stintHistory.entries.filter(e => typeof e.timeSec === 'number');

// monta o cérebro como a nuvem montaria, com o plano do stint
const cerebro = criarCerebroPainel({
  plano: { voltas: voltaTotal, duracaoS: 28 * 60 },  // stint de ~28 min
  pbEverSec,
  stintNumero: 3,
  stintTotal: 5,
});

// transmite as voltas reais, uma a uma (como o canal manda o evento 'volta')
for (const e of entradas) {
  cerebro.onVolta({ n: e.lapNumber, tempoSec: e.timeSec });
}
// uma amostra com o relógio do stint (como o sample ao vivo traria)
cerebro.onSample({ cronometroTotalS: entradas.reduce((a, e) => a + e.timeSec, 0) });

const p = cerebro.snapshot();

console.log('\n=== RESULTADO PRONTO (o que a nuvem mandaria pra TV) ===');
console.log('STINT :', JSON.stringify(p.stint));
console.log('RITMO :', JSON.stringify(p.ritmo));
console.log('PENDENTES (ondas a construir):', p._pendentes.join(', '));

// ---- conferências (falha = sai !=0) --------------------------------------
const stintBest = Math.min(...entradas.slice(1).map(e => e.timeSec));
const checks = [
  ['voltas contadas = nº de voltas reais', p.stint.voltaAtual === entradas.length],
  ['total de voltas veio do plano (12)', p.stint.voltaTotal === 12],
  ['% calculado', p.stint.voltaPct === Math.round((entradas.length / 12) * 100)],
  ['PB formatado = 1:31.95', p.ritmo.pbStr === '1:31.95'],
  ['melhor volta do stint calculada', p.ritmo.stintStr === fmtTempo(stintBest)],
  ['delta = stintBest - PB', Math.abs(p.ritmo.deltaPorVoltaSec - (stintBest - pbEverSec)) < 1e-6],
  ['lado coerente com o delta', (stintBest < pbEverSec) ? p.ritmo.lado === 'a-frente' : true],
  ['coach/meta/preditivo ainda pendentes (honesto)', p.coach === null && p.meta === null && p.preditivo === null],
];

let ok = true;
console.log('\n=== CONFERÊNCIAS ===');
for (const [nome, passou] of checks) {
  console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`);
  if (!passou) ok = false;
}
console.log(`\nstintBest=${fmtTempo(stintBest)}  PB=${fmtTempo(pbEverSec)}  delta=${(stintBest - pbEverSec).toFixed(2)}s  tag="${p.ritmo.tag}"`);
console.log(ok ? '\nTUDO VERDE\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
