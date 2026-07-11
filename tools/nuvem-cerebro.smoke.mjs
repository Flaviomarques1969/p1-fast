// nuvem-cerebro.smoke.mjs — prova o SERVIÇO do cérebro hospedado SEM rede e SEM carro.
// Alimenta o processador com as voltas REAIS do stint gravado, no MESMO formato do canal
// ('sample' com cronômetro + 'evento' de volta), e confere que sai o PainelPronto real.
// Rodar: node tools/nuvem-cerebro.smoke.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarProcessadorCerebro } from './nuvem-cerebro.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '..');
const fx = JSON.parse(readFileSync(resolve(raiz, 'web/cockpit/fixtures/stint-brasilia-3-laps.v1.json'), 'utf8'));
const entradas = fx.stintHistory.entries.filter(e => typeof e.timeSec === 'number');

const proc = criarProcessadorCerebro({
  plano: { voltas: fx.stintHistory.totalLaps, duracaoS: 1680 },
  pbEverSec: fx.track.pbEverSec, stintNumero: 3, stintTotal: 5,
});

// SIMULA O CANAL: pra cada volta, manda amostras com o cronômetro subindo até o tempo da volta,
// e então o evento 'volta' (exatamente como o carro publica no canal).
for (const e of entradas) {
  for (let f = 1; f <= 5; f++) {
    proc.ingestSample({ rpm: 6000, waterTempC: 88, cronometroParcialS: (e.timeSec * f) / 5, cronometroTotalS: 0 });
  }
  proc.ingestEvento({ tipo: 'volta', n: e.lapNumber }); // sem tempo pronto — vem do cronômetro
}

const p = proc.snapshotPainel();
console.log('STINT :', JSON.stringify(p.stint));
console.log('RITMO :', JSON.stringify(p.ritmo));
console.log('META  :', JSON.stringify(p.meta));
console.log('COMBUST:', JSON.stringify(p.combustivel));

function parseTempo(str) { const [m, s] = str.split(':'); return (+m) * 60 + (+s); }
const stintBest = Math.min(...entradas.slice(1).map(e => e.timeSec));
// Combustível esperado: tanque 40 − 0.82 × voltas (decisão Flávio: conta consumo vs tanque).
const restanteEsperado = Math.max(0, 40 - 0.82 * entradas.length);
const checks = [
  ['serviço produz PainelPronto', !!p && !!p.stint && !!p.ritmo],
  ['voltas ao vivo contadas pelo serviço', p.stint.voltaAtual === entradas.length],
  ['ritmo tirou o tempo do cronômetro (sem tempo pronto)', !!(p.ritmo && p.ritmo.stintStr)],
  ['melhor do stint = melhor volta real', Math.abs(parseTempo(p.ritmo.stintStr) - stintBest) < 0.05],
  ['meta calculada ao vivo', !!(p.meta && p.meta.atingidas === entradas.slice(1).filter(e => e.timeSec <= 92.0).length)],
  ['combustível = conta tanque − consumo×voltas', !!(p.combustivel && p.combustivel.disponivel === true && Math.abs(p.combustivel.restanteL - restanteEsperado) < 0.01)],
];

let ok = true;
console.log('\n=== CONFERÊNCIAS (serviço do cérebro hospedado) ===');
for (const [nome, passou] of checks) { console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`); if (!passou) ok = false; }
console.log(ok ? '\nTUDO VERDE — o serviço do cérebro produz o pacote pronto a partir do fluxo do canal\n'
              : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
