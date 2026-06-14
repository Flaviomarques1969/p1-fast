// Smoke test do conjunto novo do shift light inteligente.
// 4 módulos: shift-light-modos, gear-detector-online,
// forca-integrada-calculator, aprendizado-confianca.

import {
  ModoStint, JANELAS_BUBI, ENVELOPE_DEFAULT_BUBI,
  janelaParaModo, listarModos, rpmDentroDaJanela,
} from '../web/cockpit/shift-light-modos.js';
import { criarGearDetectorOnline } from '../web/cockpit/gear-detector-online.js';
import { calcularPontoOtimoTroca } from '../web/cockpit/forca-integrada-calculator.js';
import { criarAcumuladorConfianca } from '../web/cockpit/aprendizado-confianca.js';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// ── Modos ──────────────────────────────────────────────────────

check('SLM-01 3 modos canônicos existem',
  Object.keys(JANELAS_BUBI).length === 3 &&
  JANELAS_BUBI[ModoStint.DURABILIDADE] &&
  JANELAS_BUBI[ModoStint.NORMAL] &&
  JANELAS_BUBI[ModoStint.AGRESSIVO]);

const dur = janelaParaModo(ModoStint.DURABILIDADE);
check('SLM-02 Durabilidade derivada do perfil Bubi (5800-6050, vai até pico HP)',
  dur.rpmMin === 5800 && dur.rpmMax === 6050,
  `dur=${dur.rpmMin}-${dur.rpmMax}`);

const nrm = janelaParaModo(ModoStint.NORMAL);
check('SLM-03 Normal tem janela 6100-6250 (padrão)',
  nrm.rpmMin === 6100 && nrm.rpmMax === 6250);

const agr = janelaParaModo(ModoStint.AGRESSIVO);
check('SLM-04 Agressivo tem janela 6250-6350 (perto do limite mecânico)',
  agr.rpmMin === 6250 && agr.rpmMax === 6350);

check('SLM-05 listarModos devolve em ordem canônica (Dur/Nrm/Agr)',
  listarModos().map(m => m.nome).join('|') === 'Durabilidade|Normal|Agressivo');

check('SLM-06 envelope default tem teto duro = 6300',
  ENVELOPE_DEFAULT_BUBI.rpm_max_absoluto === 6300);

check('SLM-07 envelope tem força lateral máxima 0.5g (auditor: nunca trocar em curva acima)',
  ENVELOPE_DEFAULT_BUBI.forca_lateral_max_g === 0.50);

check('SLM-08 rpmDentroDaJanela(6200, Normal) → true',
  rpmDentroDaJanela(6200, ModoStint.NORMAL) === true);

check('SLM-09 rpmDentroDaJanela(5200, Normal) → false (fora da janela)',
  rpmDentroDaJanela(5200, ModoStint.NORMAL) === false);

// ── Detector de marcha ────────────────────────────────────────

const det = criarGearDetectorOnline({ numMarchas: 5 });

// Simular pares estáveis em 3ª: rpm=4000, kmh=70 (razão ~57)
let t = 0;
for (let i = 0; i < 10; i++) {
  det.ingest({ rpm: 4000 + (i % 2 === 0 ? 5 : -5), kmh: 70, ts: t });
  t += 100;
}
check('GDO-01 detector identifica pelo menos 1 marcha após amostras estáveis',
  det.getMarchasIdentificadas().length >= 1);

// Pra detectar nova marcha, simular uma transição com "freada" entre
// (carro parando o buffer e reiniciando com nova combinação rpm/kmh).
// Em pista real, isso acontece quando piloto freia entre saídas de curva.
det.ingest({ rpm: 0, kmh: 0, ts: t }); t += 200;
det.ingest({ rpm: 0, kmh: 0, ts: t }); t += 200;

// Agora pares estáveis em 4ª: rpm=4500, kmh=120 (razão ~37)
for (let i = 0; i < 10; i++) {
  det.ingest({ rpm: 4500 + (i % 2 === 0 ? 5 : -5), kmh: 120, ts: t });
  t += 100;
}
check('GDO-02 após 2 lotes estáveis com pausa entre, detecta 2 marchas',
  det.getMarchasIdentificadas().length === 2);

// Pares com aceleração brusca devem ser ignorados
let rejeitos = 0;
const det2 = criarGearDetectorOnline({});
for (let i = 0; i < 5; i++) {
  det2.ingest({ rpm: 3000 + i * 1000, kmh: 60, ts: t });
  t += 100;
}
check('GDO-03 aceleração brusca não cria marcha falsa',
  det2.getMarchasIdentificadas().length === 0);

// Buffer reseta quando carro para
det2.ingest({ rpm: 0, kmh: 0, ts: t }); t += 100;
det2.ingest({ rpm: 0, kmh: 0, ts: t }); t += 100;
check('GDO-04 carro parado limpa buffer (não confunde com marcha)',
  det2.getMarchaAtual() === null);

// Reset funciona
det.reset();
check('GDO-05 reset zera estatística',
  det.getMarchasIdentificadas().length === 0);

// ── Calculador de força integrada ─────────────────────────────

// Curva sintética simplificada: torque alto até 5000, cai depois
const curvaSintetica = [
  { rpm: 2500, potencia_cv: 35 },
  { rpm: 3500, potencia_cv: 65 },
  { rpm: 4500, potencia_cv: 95 },
  { rpm: 5200, potencia_cv: 118 },
  { rpm: 5500, potencia_cv: 122 },
  { rpm: 6050, potencia_cv: 124 }, // pico
  { rpm: 6300, potencia_cv: 117 },
  { rpm: 6400, potencia_cv: 71 },
];

const resultado = calcularPontoOtimoTroca({
  curva:              curvaSintetica,
  razaoMarchaAtual:   1.32, // 3ª F17
  razaoMarchaProxima: 0.95, // 4ª F17
  diferencial:        3.94,
  raioRodaM:          0.289, // Bubi
  janelaRpmMin:       6100,  // Normal
  janelaRpmMax:       6250,
});

check('FIC-01 calcularPontoOtimoTroca devolve estrutura completa',
  typeof resultado.rpmOtimo === 'number' && typeof resultado.confianca === 'number');

check('FIC-02 rpm ótimo está dentro da janela do modo',
  resultado.rpmOtimo >= 6100 && resultado.rpmOtimo <= 6250);

// Auditor: "com Wide Ratio em câmbio amador, todas as trocas vão pra perto do redline"
// Pra essa curva e relações, espera-se rpm alto na janela
check('FIC-03 pra Wide Ratio + curva Bubi, rpm ótimo tende ao topo da janela',
  resultado.rpmOtimo >= 6200);

// Curva inválida devolve fallback
const resultFallback = calcularPontoOtimoTroca({
  curva: [], razaoMarchaAtual: 1.3, razaoMarchaProxima: 0.95,
  diferencial: 3.94, raioRodaM: 0.289,
  janelaRpmMin: 6100, janelaRpmMax: 6250,
});
check('FIC-04 curva vazia devolve fallback no centro da janela',
  resultFallback.rpmOtimo === Math.round((6100 + 6250) / 2));

// ── Acumulador de confiança ───────────────────────────────────

const acc = criarAcumuladorConfianca();

check('ACC-01 acumulador vazio devolve 0%',
  acc.getPct() === 0);

acc.registrarMarchaDetectada(3);
acc.registrarMarchaDetectada(4);
check('ACC-02 detectar 2 marchas de 5 dá pct > 0',
  acc.getPct() > 0 && acc.getPct() < 50);

acc.registrarMarchaDetectada(1);
acc.registrarMarchaDetectada(2);
acc.registrarMarchaDetectada(5);
const pctAposTodas = acc.getPct();
check('ACC-03 todas as 5 marchas detectadas → componente 1 completo (20%)',
  pctAposTodas >= 20);

// Registrar pontos aprendidos em marchas críticas (3, 4, 5)
for (let trecho = 1; trecho <= 8; trecho++) {
  for (const marcha of [3, 4, 5]) {
    for (let i = 0; i < 3; i++) {
      acc.registrarPontoAprendido({ trechoId: `trecho-${trecho}`, marchaOrigem: marcha, rpmAprendido: 6200 });
    }
  }
}
const pctAposPontos = acc.getPct();
check('ACC-04 todos os 24 pontos críticos (8 trechos × 3 marchas) cobertos → componente 2 (60%)',
  pctAposPontos >= 80);

for (let i = 0; i < 10; i++) acc.registrarVoltaLimpa();
check('ACC-05 10 voltas limpas → componente 3 completo → pct = 100',
  acc.getPct() === 100);

acc.reset();
check('ACC-06 reset zera pct',
  acc.getPct() === 0);

// ── Final ──────────────────────────────────────────────────────

console.log(`\nShift Light Inteligente: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
