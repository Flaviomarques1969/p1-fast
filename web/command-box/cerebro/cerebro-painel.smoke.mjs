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
  ['META ligada: alvo 1:32', p.meta && p.meta.tempoAlvoStr === '1:32'],
  ['META atingidas = voltas <= alvo', p.meta && p.meta.atingidas === entradas.slice(1).filter(e => e.timeSec <= 92.0).length],
  ['barra do stint: lista volta-a-volta presente', !!p.stintBar && Array.isArray(p.stintBar.lapHistory)],
  ['barra do stint: nº de voltas na lista = voltas reais', p.stintBar && p.stintBar.lapHistory.length === entradas.length],
  ['barra do stint: total = plano (12)', p.stintBar && p.stintBar.voltas === 12],
  ['barra do stint: sem parada no plano → paradas vazias', p.stintBar && Array.isArray(p.stintBar.paradas) && p.stintBar.paradas.length === 0],
  ['barra do stint: pbEver = referência real (91.95)', p.stintBar && Math.abs(p.stintBar.pbEver - pbEverSec) < 1e-6],
  ['barra do stint: cada volta tem n e timeSec reais', p.stintBar && p.stintBar.lapHistory.every((v, i) => v.n === entradas[i].lapNumber && Math.abs(v.timeSec - entradas[i].timeSec) < 1e-6)],
  ['barra do stint: volta em curso = após as fechadas', p.stintBar && p.stintBar.current === entradas.length + 1],
  ['coach ainda pendente (honesto)', p.coach === null && p._pendentes.includes('coach')],
  ['preditivo LIGADO (Onda 5): fora de pendentes', !p._pendentes.includes('preditivo')],
  ['sem temperatura nesta volta → preditivo null (honesto)', p.preditivo === null],
];
console.log('META  :', JSON.stringify(p.meta));

let ok = true;
console.log('\n=== CONFERÊNCIAS ===');
for (const [nome, passou] of checks) {
  console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`);
  if (!passou) ok = false;
}
console.log(`\nstintBest=${fmtTempo(stintBest)}  PB=${fmtTempo(pbEverSec)}  delta=${(stintBest - pbEverSec).toFixed(2)}s  tag="${p.ritmo.tag}"`);

// ---- BARRA DO STINT: paradas no box do plano viram as voltas certas ----
// Plano: 8 voltas, parada na 6 (configuracao-stint manda paradas:[{volta,motivo}]).
const cerebroBox = criarCerebroPainel({ plano: { voltas: 8, paradas: [{ volta: 6, motivo: 'troca de piloto' }] }, pbEverSec });
[1, 2, 3].forEach(n => cerebroBox.onVolta({ n, tempoSec: 92 }));
const sbBox = cerebroBox.snapshot().stintBar;
console.log('\n=== BARRA DO STINT (plano 8 voltas, box na 6) ===');
console.log('voltas=', sbBox.voltas, '| paradas=', JSON.stringify(sbBox.paradas), '| volta em curso=', sbBox.current);
// Sem nada informado no plano → barra ZERADA (voltas=0): a tela mostra só aquece + resfria.
const sbZero = criarCerebroPainel({ plano: {} }).snapshot().stintBar;
const checksBox = [
  ['total da barra = voltas do plano (8)', sbBox.voltas === 8],
  ['parada no box virou a volta 6', sbBox.paradas.length === 1 && sbBox.paradas[0] === 6],
  ['volta em curso = 4 (após 3 fechadas)', sbBox.current === 4],
  ['sem plano informado → barra zerada (voltas=0)', sbZero && sbZero.voltas === 0 && sbZero.paradas.length === 0],
];
console.log('\n=== CONFERÊNCIAS BARRA/PARADAS ===');
for (const [nome, passou] of checksBox) {
  console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`);
  if (!passou) ok = false;
}

// ---- ONDA 5: alerta preditivo de temperatura (cenário com temp subindo) ----
// 5 voltas com a água subindo ~5°C/volta (50→70) e crítico 80°C: tem que projetar
// o estouro em ~2 voltas e sair com +°C de desvio. Sem dado de temp = null (honesto).
const cerebroT = criarCerebroPainel({ plano: { voltas: 12 }, pbEverSec, tempLimiteC: 80 });
[50, 55, 61, 66, 70].forEach((tC, i) => {
  cerebroT.onSample({ waterTempC: tC });          // pico da volta
  cerebroT.onVolta({ n: i + 1, tempoSec: 92 });   // fecha a volta
});
const pt = cerebroT.snapshot();
console.log('\n=== ONDA 5 (preditivo de temperatura) ===');
console.log('PREDITIVO:', JSON.stringify(pt.preditivo));
const semTemp = criarCerebroPainel({ plano: { voltas: 12 } });
[1, 2, 3, 4, 5].forEach(n => semTemp.onVolta({ n, tempoSec: 92 }));
const checks5 = [
  ['preditivo dispara com temp subindo', pt.preditivo !== null],
  ['preditivo traz ETA em voltas', !!(pt.preditivo && /voltas/.test(pt.preditivo.eta))],
  ['preditivo traz desvio +°C', !!(pt.preditivo && /\+\d+°C/.test(pt.preditivo.metricaStr))],
  ['preditivo fora de pendentes', !pt._pendentes.includes('preditivo')],
  ['voltas com temperatura → preditivo só com temp; sem temp = null', semTemp.snapshot().preditivo === null],
];
console.log('\n=== CONFERÊNCIAS ONDA 5 ===');
for (const [nome, passou] of checks5) {
  console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`);
  if (!passou) ok = false;
}

console.log(ok ? '\nTUDO VERDE\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
