// Smoke E2E do shift light inteligente — simula 10 voltas e valida
// que o pct de aprendizado sobe naturalmente, que a marcha é detectada
// e que o RPM ótimo de troca cai dentro da janela do modo.
//
// Spec da volta:
//   - 8 trechos de Brasília
//   - Em cada trecho, piloto sobe e desce uma marcha (gera amostras estáveis)
//   - Após cada volta limpa, contador sobe

import { CockpitState } from '../web/cockpit/cockpit-state.js';
import { criarShiftLightOrquestrador } from '../web/cockpit/shift-light-orquestrador.js';
import { ModoStint } from '../web/cockpit/shift-light-modos.js';

const CURVA_BUBI = [
  { rpm: 2500, potencia_cv: 1,   torque_nm: 2 },
  { rpm: 3000, potencia_cv: 68,  torque_nm: 159 },
  { rpm: 3500, potencia_cv: 79,  torque_nm: 158 },
  { rpm: 4000, potencia_cv: 87,  torque_nm: 160 },
  { rpm: 4500, potencia_cv: 101, torque_nm: 158 },
  { rpm: 5000, potencia_cv: 113, torque_nm: 161 },
  { rpm: 5200, potencia_cv: 120, torque_nm: 162 },
  { rpm: 5500, potencia_cv: 122, torque_nm: 156 },
  { rpm: 6050, potencia_cv: 124, torque_nm: 145 },
  { rpm: 6300, potencia_cv: 117, torque_nm: 130 },
  { rpm: 6400, potencia_cv: 72,  torque_nm: 79 },
];

const TRECHOS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];

// Relações F17 Wide Ratio (públicas, F17 padrão Celta 1.0)
const RAZOES_MARCHAS = [3.73, 1.96, 1.32, 0.95, 0.76];
const DIFERENCIAL = 3.94;
const RAIO_RODA = 0.2888;

// Calcula kmh estabilizada em uma marcha + rpm
function kmhParaRpm(marcha, rpm) {
  const razaoTotal = RAZOES_MARCHAS[marcha - 1] * DIFERENCIAL;
  const vMs = (rpm / 60) * (2 * Math.PI * RAIO_RODA) / razaoTotal;
  return vMs * 3.6;
}

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

const state = new CockpitState();
const orq = criarShiftLightOrquestrador({
  cockpitState: state,
  dynoCurve: CURVA_BUBI,
  modoStintInicial: ModoStint.NORMAL,
});

let ts = 0;
function tick() { ts += 100; return ts; }

function simularSegundosEmMarcha(marcha, rpmAlvo, segundos) {
  const kmh = kmhParaRpm(marcha, rpmAlvo);
  const passos = Math.round(segundos * 10); // 10 Hz
  for (let i = 0; i < passos; i++) {
    const jitter = (i % 2 === 0 ? 8 : -8);
    orq.ingestSample({ rpm: rpmAlvo + jitter, kmh, ts: tick() });
  }
}

function simularVolta(numVolta) {
  for (const trecho of TRECHOS) {
    orq.setTrechoAtual(trecho);
    // Em cada trecho, piloto opera em 3ª, 4ª e 5ª (memória: 90% em 3,4,5 em Brasília)
    simularSegundosEmMarcha(3, 4500 + numVolta * 50, 0.6);
    // Curtinha "parada" entre marchas pra resetar buffer (simula freada)
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
    simularSegundosEmMarcha(4, 5000 + numVolta * 30, 0.6);
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
    simularSegundosEmMarcha(5, 5500 + numVolta * 20, 0.5);
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
    orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
  }
  orq.registrarVoltaLimpa();
}

// ── Cenário ──
check('E2E-01 estado inicial: aprendizado = 0%',
  state.get().aprendizado.pct === 0);

// Simula 3 voltas
for (let v = 0; v < 3; v++) simularVolta(v);

const apos3 = state.get().aprendizado.pct;
check('E2E-02 após 3 voltas, pct subiu de 0',
  apos3 > 0, `pct=${apos3}`);

const detalhes = orq.getEstado();
check('E2E-03 detector identificou pelo menos 3 marchas',
  detalhes.marchasIdentificadas.length >= 3,
  `identificou=${detalhes.marchasIdentificadas.length}`);

// Nota: o detector numera as marchas que ENCONTRA (1=razão maior, N=razão menor).
// Como o teste simula só 3ª/4ª/5ª reais, o detector enxerga elas como 1/2/3 internas.
// Mapear interno→real é um passo futuro (precisa de pista com 1ª/2ª também).
check('E2E-04 acumulador tem pelo menos 3 marchas distintas detectadas',
  detalhes.detalheAprendizado.marchasDetectadas.length >= 3,
  `marchasDetectadas=${JSON.stringify(detalhes.detalheAprendizado.marchasDetectadas)}`);

// Continua simulando até 10 voltas
for (let v = 3; v < 10; v++) simularVolta(v);

const apos10 = state.get().aprendizado.pct;
check('E2E-05 após 10 voltas, pct sobe ainda mais',
  apos10 > apos3, `pct_3=${apos3} pct_10=${apos10}`);

check('E2E-06 status da barra reflete o pct',
  ['aprendendo', 'parcial', 'calibrado'].includes(state.get().aprendizado.status));

// Termina simulando o piloto na 4ª (marcha interna 2 do detector — tem destino marcha 3).
// Pra getRpmOtimoTroca() retornar valor, precisa ter marcha origem + próxima identificadas.
simularSegundosEmMarcha(4, 5500, 0.5);

const rpmOtimo = orq.getRpmOtimoTroca();
check('E2E-07 RPM ótimo retornado (não null com marcha + próxima identificadas)',
  rpmOtimo !== null,
  `rpmOtimo=${rpmOtimo}`);
if (rpmOtimo !== null) {
  check('E2E-07b RPM ótimo dentro da janela Normal (6100-6300) ou no teto',
    rpmOtimo >= 6100 && rpmOtimo <= 6300,
    `rpm=${rpmOtimo}`);
} else {
  check('E2E-07b RPM ótimo no range Normal (não testado, null)', false);
}

// Troca de modo invalida cache e recalcula
orq.setModoStint(ModoStint.AGRESSIVO);
const rpmOtimoAgr = orq.getRpmOtimoTroca();
check('E2E-08 modo Agressivo retornou RPM',
  rpmOtimoAgr !== null,
  `rpm=${rpmOtimoAgr}`);
if (rpmOtimoAgr !== null) {
  check('E2E-08b modo Agressivo no range 6250-6350',
    rpmOtimoAgr >= 6250 && rpmOtimoAgr <= 6350,
    `rpm=${rpmOtimoAgr}`);
} else {
  check('E2E-08b range Agressivo (não testado, null)', false);
}

// Reset zera tudo
orq.reset();
check('E2E-09 reset zera pct',
  state.get().aprendizado.pct === 0);

check('E2E-10 reset zera marchas identificadas',
  orq.getEstado().marchasIdentificadas.length === 0);

console.log(`\nShift Light E2E: ${ok} ok / ${fail} fail`);
console.log(`\n[debug] pct após 10 voltas: ${apos10}%`);
console.log(`[debug] marchas identificadas: ${JSON.stringify(orq.getEstado().marchasIdentificadas.map(m => ({marcha: m.marcha, razao: m.ratioMedia.toFixed(2)})))}`);

if (fail > 0) process.exit(1);
