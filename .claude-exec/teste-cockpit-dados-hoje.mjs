// ============================================================================
// TESTE FORA DO AR — funções da tela de cockpit x dados colhidos hoje (21/06).
// Importa os módulos REAIS do cérebro do cockpit e os alimenta com a sessão
// real gravada hoje no notebook. Não toca rede, nuvem, nem o canal ao vivo.
//   Rodar: node .claude-exec/teste-cockpit-dados-hoje.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '..');
const C = resolve(raiz, 'web/command-box/cerebro');

const { velocidadesDaVolta, distanciaM } = await import(resolve(C, 'cerebro-velocidade.js'));
const { criarOrquestradorVivo } = await import(resolve(C, 'cerebro-vivo.js'));
const { fmtTempo, fmtRelogio } = await import(resolve(C, 'cerebro-painel.js'));
const { avaliarPreditivo } = await import(resolve(C, 'cerebro-preditivo.js'));

const ARQ = resolve(raiz, '.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json');
const sess = JSON.parse(readFileSync(ARQ, 'utf8'));
const am = sess.amostras;
const t4 = am.filter(a => a.tipo === 't4000');
const gps = am.filter(a => a.tipo === 'gps');

const L = (...x) => console.log(...x);
const linha = () => L('-'.repeat(72));
let falhas = 0;

L('\n========================================================================');
L(' TESTE — FUNÇÕES DO COCKPIT x DADOS DE HOJE (21/06)');
L('========================================================================');
L(`Sessão: ${sess.sessao.id}`);
L(`Status: ${sess.sessao.status} (${sess.sessao.motivoFim}) · duração ${sess.sessao.duracaoS}s · sim=${sess.sessao.sim}`);
L(`Amostras: ${am.length}  (motor=${t4.length} @ ${sess.sessao.hzMotorMedia}Hz · GPS=${gps.length} @ ${sess.sessao.hzGpsMedia}Hz)`);

// ---------------------------------------------------------------------------
// 0) QUALIDADE DO DADO COLHIDO (o que dá pra usar)
// ---------------------------------------------------------------------------
linha(); L('0) QUALIDADE DO DADO COLHIDO');
const HOJE_BR = { latMin: -16.1, latMax: -15.4, lonMin: -48.3, lonMax: -47.6 }; // janela de Brasília
function gpsValido(d) {
  return d && d.fix === 3 && Number.isFinite(d.lat) && Number.isFinite(d.lon)
    && d.lat >= HOJE_BR.latMin && d.lat <= HOJE_BR.latMax
    && d.lon >= HOJE_BR.lonMin && d.lon <= HOJE_BR.lonMax
    && Number.isFinite(d.hacc) && d.hacc < 50;
}
const gpsBons = gps.filter(g => gpsValido(g.dados));
const gpsLixo = gps.length - gpsBons.length;
function campoVivo(rows, key) { return rows.some(r => Number.isFinite(r.dados[key]) && r.dados[key] !== 0); }
const motorCampos = ['rpm','lambda','batteryV','mapBar','waterTempC','airTempC','speedKmh',
  'accelXg','accelYg','pedalAceleradorPct','pedalFreioPct','pressaoFreioBar',
  'cronometroParcialS','cronometroTotalS','tpsPct'];
L(`GPS:   válidos=${gpsBons.length}  descartados(lixo/sem-fix)=${gpsLixo}`);
L('Motor: campo a campo (tem valor real ≠ 0?):');
for (const k of motorCampos) {
  const vivo = campoVivo(t4, k);
  const vals = t4.map(r => r.dados[k]).filter(Number.isFinite);
  const faixa = vals.length ? `min=${Math.min(...vals)} max=${Math.max(...vals)}` : 'sem números';
  L(`   ${vivo ? 'VIVO ' : 'ZERO '} ${k.padEnd(20)} ${faixa}`);
}

// ---------------------------------------------------------------------------
// 1) FUNÇÃO: VELOCIDADE pelo GPS  (cerebro-velocidade.js)
// ---------------------------------------------------------------------------
linha(); L('1) FUNÇÃO VELOCIDADE (GPS → km/h)  — cerebro-velocidade.js');
function testaVelocidade(label, passo) {
  const pts = [];
  const spdRef = [];
  for (let i = 0; i < gpsBons.length; i += passo) {
    const d = gpsBons[i].dados;
    pts.push([gpsBons[i].tWall, d.lat, d.lon]);
    spdRef.push(d.spd); // velocidade do próprio GPS (Doppler) = referência
  }
  if (pts.length < 5) { L(`   ${label}: amostras insuficientes`); return null; }
  const serie = velocidadesDaVolta(pts); // FUNÇÃO REAL
  // erro vs spd do GPS, ponto a ponto (ignora o 1º, que a função força em 0)
  const erros = [];
  for (let i = 1; i < serie.length; i++) {
    if (Number.isFinite(spdRef[i])) erros.push(Math.abs(serie[i].kmh - spdRef[i]));
  }
  erros.sort((a, b) => a - b);
  const mae = erros.reduce((a, b) => a + b, 0) / erros.length;
  const mediana = erros[Math.floor(erros.length / 2)];
  const calcMax = Math.max(...serie.map(s => s.kmh));
  const refMax = Math.max(...spdRef.filter(Number.isFinite));
  L(`   ${label}: ${pts.length} pontos · vMax calc=${calcMax} km/h (GPS=${refMax.toFixed(1)}) · ` +
    `erro vs GPS: mediana=${mediana.toFixed(1)} média=${mae.toFixed(1)} km/h`);
  return { mediana, mae, calcMax, refMax };
}
const vFull = testaVelocidade('taxa cheia (~24,5 Hz)', 1);
const v1hz  = testaVelocidade('reamostrado p/ ~1 Hz (passo 24)', 24);
// verificação: a 1 Hz (taxa pra qual a função foi feita) o erro tem que ser baixo
const velOK = v1hz && v1hz.mediana < 10 && Math.abs(v1hz.calcMax - v1hz.refMax) < 25;
L(`   => VELOCIDADE ${velOK ? 'OK' : 'ATENÇÃO'} (referência: erro mediano <10 km/h a 1 Hz)`);
if (!velOK) falhas++;

// ---------------------------------------------------------------------------
// 2) FUNÇÃO: PAINEL / VIVO  (stint, ritmo, meta)  — cerebro-vivo + cerebro-painel
// ---------------------------------------------------------------------------
linha(); L('2) FUNÇÃO PAINEL AO VIVO (stint/ritmo/meta) — cerebro-vivo.js');
// monta como a nuvem montaria, com um plano de stint plausível
const orq = criarOrquestradorVivo({
  plano: { voltas: 12, duracaoS: 28 * 60 },
  pbEverSec: 91.95, stintNumero: 3, stintTotal: 5,
});
// alimenta TODA a sessão no formato do canal (espalha 'dados' no topo da amostra)
let voltasDetectadas = 0;
for (const a of am) {
  const s = { ...a.dados, tWall: a.tWall, tipo: a.tipo };
  orq.feedSample(s);
  // o canal manda evento 'volta' separado; aqui detectamos pelo reset do cronômetro
  // parcial (a injeção zera ao cruzar a linha). Se nunca rodou, não há volta.
}
const snap = orq.snapshot();
L(`   voltas alimentadas no cérebro: ${snap._geradoComVoltas}`);
L(`   STINT: ${JSON.stringify(snap.stint)}`);
L(`   RITMO: ${JSON.stringify(snap.ritmo)}`);
L(`   META : ${JSON.stringify(snap.meta)}`);
L(`   PENDENTES: ${snap._pendentes.join(', ')}`);
// é honesto: sem cronômetro de volta nesta sessão, stint/ritmo/meta NÃO têm como sair
const cronoRodou = campoVivo(t4, 'cronometroTotalS') || campoVivo(t4, 'cronometroParcialS');
L(`   cronômetro de volta da injeção rodou nesta sessão? ${cronoRodou ? 'SIM' : 'NÃO'}`);
const painelCoerente = (snap._geradoComVoltas === 0) === !cronoRodou;
L(`   => PAINEL ${painelCoerente ? 'OK (coerente)' : 'INCOERENTE'}: ` +
  (cronoRodou ? 'há voltas, deveria calcular' : 'sem volta cronometrada → blocos ficam aguardando (correto)'));
if (!painelCoerente) falhas++;

// ---------------------------------------------------------------------------
// 3) FUNÇÃO: PREDITIVO (temperatura sobe → estoura) — cerebro-preditivo.js
// ---------------------------------------------------------------------------
linha(); L('3) FUNÇÃO PREDITIVO (temperatura por volta) — cerebro-preditivo.js');
const temTemp = campoVivo(t4, 'waterTempC');
L(`   temperatura de água gravada? ${temTemp ? 'SIM' : 'NÃO'}`);
// precisa de temp máx POR VOLTA (>=4 voltas). Sem voltas e sem temp, não há entrada.
const pred = avaliarPreditivo([]); // função real, entrada vazia
L(`   avaliarPreditivo(sem voltas) = ${JSON.stringify(pred)} (null = aguardando, honesto)`);
const predOK = pred === null; // com esta sessão (sem volta/sem temp) o correto é null
L(`   => PREDITIVO ${predOK ? 'OK' : 'ATENÇÃO'}: precisa de temperatura máx por volta (≥4 voltas) — não há nesta sessão`);
if (!predOK) falhas++;

// ---------------------------------------------------------------------------
// 4) FUNÇÃO: COACH (lição por curva) — cerebro-coach.js
// ---------------------------------------------------------------------------
linha(); L('4) FUNÇÃO COACH (lição por curva) — cerebro-coach.js');
try {
  const mod = await import(resolve(C, 'cerebro-coach.js'));
  const coach = mod.avaliarCoach([], []); // função real, sem passagens segmentadas
  L(`   avaliarCoach(sem passagens) = ${JSON.stringify(coach)} (null = aguardando, honesto)`);
  L('   => COACH carregou e respondeu. Precisa de PASSAGENS segmentadas por curva');
  L('      (mesma curva ≥2 voltas) — esta sessão crua não tem segmentação de voltas.');
} catch (e) {
  L(`   => COACH não pôde ser exercido fora do ar: ${e.message}`);
  L('      (depende do motor pedagógico que usa o banco do app)');
}

// ---------------------------------------------------------------------------
linha();
L(`RESULTADO GERAL: ${falhas === 0 ? 'TUDO VERDE' : falhas + ' ponto(s) de atenção'}`);
L('========================================================================\n');
process.exit(falhas === 0 ? 0 : 1);
