// Smoke test: ACELERAÇÃO no gatilho da detecção de troca (visão Flávio 14/06 —
// "cruza sinais: RPM caindo em degrau + aceleração caindo"). Trava opcional,
// desligada por padrão. Liga e corta degraus de RPM sem queda de força-G.

import { createShiftEventDetector } from '../src/pipeline/shift-event-detector.js';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// Roda um upshift (queda de 1000 rpm, velocidade estável) e devolve os eventos.
// aPrev/aCur = aceleração longitudinal antes/durante; null = sem leitura.
function rodarUpshift({ accelCorroboraUpshift = false, aPrev, aCur }) {
  const events = [];
  const det = createShiftEventDetector({ onEvent: e => events.push(e), accelCorroboraUpshift });
  const mk = (rpm, ts, ax) => {
    const s = { rpm, speed: 100, tps: 80, timestamp: ts };
    if (ax !== null && ax !== undefined) s.accel = { x: ax, y: 0, z: 0 };
    return s;
  };
  det.pushSample(mk(6000, 0,   aPrev));
  det.pushSample(mk(5000, 100, aCur));   // degrau de -1000 rpm = candidato a upshift
  det.pushSample(mk(5050, 300, aCur));   // 200ms depois → fecha e emite (se válido)
  return events;
}

// ── Trava DESLIGADA (padrão) = comportamento atual preservado ──
check('AG-01 trava off + aceleração plana → DETECTA (como hoje)',
  rodarUpshift({ accelCorroboraUpshift: false, aPrev: 2.0, aCur: 1.8 }).length === 1);
check('AG-02 trava off + sem leitura de aceleração → DETECTA (como hoje)',
  rodarUpshift({ accelCorroboraUpshift: false, aPrev: null, aCur: null }).length === 1);

// ── Trava LIGADA = exige queda de força-G no upshift ───────────
check('AG-03 trava on + aceleração CAI (2.0→0.0) → DETECTA (sinais batem)',
  rodarUpshift({ accelCorroboraUpshift: true, aPrev: 2.0, aCur: 0.0 }).length === 1);
check('AG-04 trava on + aceleração NÃO cai (2.0→1.8) → NÃO detecta (corta falso positivo)',
  rodarUpshift({ accelCorroboraUpshift: true, aPrev: 2.0, aCur: 1.8 }).length === 0);
check('AG-05 trava on + sem leitura de aceleração → degrada e DETECTA por RPM',
  rodarUpshift({ accelCorroboraUpshift: true, aPrev: null, aCur: null }).length === 1);
check('AG-06 trava on + queda no limite (2.0→1.0, exatamente accelDropMin) → DETECTA',
  rodarUpshift({ accelCorroboraUpshift: true, aPrev: 2.0, aCur: 1.0 }).length === 1);

console.log(`\n[deteccao-acel-gate.spec] ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
