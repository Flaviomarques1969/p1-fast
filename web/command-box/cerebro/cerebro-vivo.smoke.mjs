// Prova o caminho AO VIVO sem carro e sem rede: alimenta o orquestrador com as
// voltas REAIS do stint gravado, NO MESMO FORMATO do canal (amostras com
// cronômetro + evento 'volta'), e confere que sai o mesmo PainelPronto real.
// Rodar: node web/command-box/cerebro/cerebro-vivo.smoke.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarOrquestradorVivo } from './cerebro-vivo.js';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '../../..');
const fx = JSON.parse(readFileSync(resolve(raiz, 'web/cockpit/fixtures/stint-brasilia-3-laps.v1.json'), 'utf8'));
const entradas = fx.stintHistory.entries.filter(e => typeof e.timeSec === 'number');

const orq = criarOrquestradorVivo({
  plano: { voltas: fx.stintHistory.totalLaps, duracaoS: 1680 },
  pbEverSec: fx.track.pbEverSec, stintNumero: 3, stintTotal: 5,
});

// SIMULA O CANAL: para cada volta, manda algumas amostras com o cronômetro
// subindo até o tempo da volta, e então o evento 'volta' (como o carro manda).
for (const e of entradas) {
  for (let f = 1; f <= 5; f++) {
    orq.feedSample({ rpm: 6000, waterTempC: 88, cronometroParcialS: (e.timeSec * f) / 5, cronometroTotalS: 0 });
  }
  orq.feedVolta({ tipo: 'volta', n: e.lapNumber }); // SEM tempo pronto — vem do cronômetro
}

const p = orq.snapshot();
console.log('STINT :', JSON.stringify(p.stint));
console.log('RITMO :', JSON.stringify(p.ritmo));
console.log('META  :', JSON.stringify(p.meta));

const stintBest = Math.min(...entradas.slice(1).map(e => e.timeSec));
const checks = [
  ['voltas ao vivo contadas', p.stint.voltaAtual === entradas.length],
  ['ritmo tirou o tempo do cronômetro (sem tempo pronto)', p.ritmo && p.ritmo.stintStr],
  ['melhor do stint = melhor volta real', Math.abs(parseTempo(p.ritmo.stintStr) - stintBest) < 0.05],
  ['meta calculada ao vivo', p.meta && p.meta.atingidas === entradas.slice(1).filter(e => e.timeSec <= 92.0).length],
];
function parseTempo(str) { const [m, s] = str.split(':'); return (+m) * 60 + (+s); }

let ok = true;
console.log('\n=== CONFERÊNCIAS (caminho AO VIVO) ===');
for (const [nome, passou] of checks) { console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`); if (!passou) ok = false; }
console.log(ok ? '\nTUDO VERDE — o caminho ao vivo produz o mesmo dado real\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
