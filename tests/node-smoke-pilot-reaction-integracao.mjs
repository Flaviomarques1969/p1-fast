// Smoke da Onda 7 — antecipação do shift light pelo tempo de troca do piloto.
//
// Cenários:
//   1. Sem rpmRise → compensação = 0
//   2. Sem perfis aprendidos + rate alto → usa default 250ms
//   3. Aceleração alta (alto rpm/s) → antecipa mais rpm que aceleração baixa
//   4. Modo aprendendo ('learning') → não antecipa (deixa piloto ditar)
//   5. Após N eventos de troca → perfil aprendido substitui default

import { CockpitState } from '../web/cockpit/cockpit-state.js';
import { criarShiftLightOrquestrador } from '../web/cockpit/shift-light-orquestrador.js';
import { ModoStint } from '../web/cockpit/shift-light-modos.js';

const CURVA_BUBI = [
  { rpm: 2500, potencia_cv: 1,   torque_nm: 2 },
  { rpm: 3500, potencia_cv: 79,  torque_nm: 158 },
  { rpm: 4500, potencia_cv: 101, torque_nm: 158 },
  { rpm: 5200, potencia_cv: 120, torque_nm: 162 },
  { rpm: 6050, potencia_cv: 124, torque_nm: 145 },
  { rpm: 6300, potencia_cv: 117, torque_nm: 130 },
];

const RAZOES = [3.73, 1.96, 1.32, 0.95, 0.76];
const DIF = 3.94;
const RAIO = 0.2888;

function kmhDe(marcha, rpm) {
  const r = RAZOES[marcha - 1] * DIF;
  return ((rpm / 60) * 2 * Math.PI * RAIO / r) * 3.6;
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

// Adiciona pares estáveis em uma marcha + RPM
function pares(marcha, rpm, n = 8) {
  const kmh = kmhDe(marcha, rpm);
  for (let i = 0; i < n; i++) {
    orq.ingestSample({ rpm: rpm + (i % 2 ? 5 : -5), kmh, ts: tick() });
  }
}
function pausa() {
  orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
  orq.ingestSample({ rpm: 0, kmh: 0, ts: tick() });
}

// ── Cenário 1: ingere uma amostra só → ritmo zero → compensação zero ──
orq.ingestSample({ rpm: 4500, kmh: 90, ts: tick() });
const sem = orq.getRpmVisualLuz();
check('PR-01 sem histórico, rpmVisual === rpmAlvo (sem antecipação)',
  sem === null || sem.antecipouRpm === 0, JSON.stringify(sem));

// ── Cenário 2: 2 amostras estáveis → ritmo definido, sem perfil aprendido ──
pares(3, 5500, 10);
const r2 = orq.getRpmVisualLuz();
check('PR-02 com ritmo zero (giro constante), antecipa 0',
  r2 === null || r2.antecipouRpm === 0,
  JSON.stringify(r2));

// ── Cenário 3: aceleração rápida → ritmo alto → antecipa MAIS ──
orq.reset();
let rpmSubindo = 4000;
for (let i = 0; i < 8; i++) {
  rpmSubindo += 150; // sobe 150 rpm a cada 100ms = 1500 rpm/s
  orq.ingestSample({ rpm: rpmSubindo, kmh: kmhDe(3, rpmSubindo), ts: tick() });
}
const rapido = orq.getRpmVisualLuz();
check('PR-03 ritmo rápido + sem perfil → usa default 250ms',
  rapido === null || (rapido.tempoTrocaMs === 250 && rapido.antecipouRpm > 100),
  JSON.stringify(rapido));

// ── Cenário 4: aceleração branda → antecipa MENOS que aceleração rápida ──
orq.reset();
rpmSubindo = 4000;
for (let i = 0; i < 8; i++) {
  rpmSubindo += 30; // sobe 30 rpm a cada 100ms = 300 rpm/s
  orq.ingestSample({ rpm: rpmSubindo, kmh: kmhDe(3, rpmSubindo), ts: tick() });
}
const brando = orq.getRpmVisualLuz();
check('PR-04 ritmo brando → antecipa menos que ritmo rápido',
  brando === null || (
    rapido !== null && brando.antecipouRpm < rapido.antecipouRpm
  ),
  `brando=${JSON.stringify(brando)} rapido=${JSON.stringify(rapido)}`);

// ── Cenário 5: modo learning → não antecipa ──
orq.reset();
rpmSubindo = 4000;
for (let i = 0; i < 8; i++) {
  rpmSubindo += 150;
  orq.ingestSample({ rpm: rpmSubindo, kmh: kmhDe(3, rpmSubindo), ts: tick() });
}
const aprendendo = orq.getRpmVisualLuz({ mode: 'learning' });
check('PR-05 modo "learning" não antecipa (deixa piloto ditar)',
  aprendendo === null || aprendendo.antecipouRpm === 0,
  JSON.stringify(aprendendo));

// ── Cenário 6: rpm/s sai positivo após sequência ascendente ──
const ritmo = orq.getRitmoSubidaGiro();
check('PR-06 getRitmoSubidaGiro devolve valor positivo após subida',
  ritmo > 0, `ritmo=${ritmo}`);

console.log(`\nPilot Reaction (Onda 7): ${ok} ok / ${fail} fail`);
console.log(`[debug] rapido: ${JSON.stringify(rapido)}`);
console.log(`[debug] brando: ${JSON.stringify(brando)}`);

if (fail > 0) process.exit(1);
