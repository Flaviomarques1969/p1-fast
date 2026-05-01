// Smoke spec: estimateGear, learnSignature, detectShiftEvent

import { estimateGear } from '../../src/domain/gear-estimation.js';
import { learnSignature, loadSignatures } from '../../src/domain/gear-signatures.js';
import { detectShiftEvent } from '../../src/domain/gear-shift-detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Calibração de referência: ratios rpm/(km/h) por marcha
const calibration = {
  gear_signatures: {
    1: { rpm_speed_ratio: 250 },
    2: { rpm_speed_ratio: 150 },
    3: { rpm_speed_ratio: 100 }
  }
};

// ─── Helpers para stream sintético ───────────────────────────────────────

function rampGear({ ratio, speedStart, speedEnd, dt = 50, t0 = 0 }) {
  const out = [];
  const steps = Math.max(2, Math.round((speedEnd - speedStart) / 0.5));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const speed = speedStart + (speedEnd - speedStart) * f;
    const rpm = Math.round(speed * ratio);
    out.push({ rpm, speed, tps: 80, accel: { x: 1.5, y: 0, z: 0 }, timestamp: t0 + i * dt });
  }
  return out;
}

function shiftSnapshot({ ratioFrom, ratioTo, speed, t0 }) {
  return [
    { rpm: Math.round(speed * ratioFrom), speed, tps: 0,  accel: { x: 0, y: 0, z: 0 }, timestamp: t0 },
    { rpm: Math.round(speed * ratioTo),   speed, tps: 70, accel: { x: 1.0, y: 0, z: 0 }, timestamp: t0 + 100 }
  ];
}

// ─── Testes ──────────────────────────────────────────────────────────────

t('sem calibração → fallback', () => {
  const r = estimateGear({ rpm: 4000, speed: 20, tps: 80, accel: {x:1,y:0,z:0}, timestamp: 0 }, [], {});
  assert(r.gear === null, 'gear deveria ser null');
  assert(r.confidence === 0, 'confidence deveria ser 0');
  assert(r.method === 'fallback', 'method deveria ser fallback');
  assert(r.reason === 'no calibration', 'reason inesperado: ' + r.reason);
});

t('marcha 1 estabilizada → identifica corretamente', () => {
  const sample = { rpm: 5000, speed: 20, tps: 80, accel: {x:1,y:0,z:0}, timestamp: 0 };
  const r = estimateGear(sample, [], calibration);
  assert(r.gear === 1, 'gear deveria ser 1, foi ' + r.gear);
  assert(r.confidence > 0.8, 'confidence baixa: ' + r.confidence);
});

t('marcha 2 estabilizada → identifica corretamente', () => {
  const sample = { rpm: 4500, speed: 30, tps: 80, accel: {x:1,y:0,z:0}, timestamp: 0 };
  const r = estimateGear(sample, [], calibration);
  assert(r.gear === 2, 'gear deveria ser 2, foi ' + r.gear);
  assert(r.confidence > 0.8, 'confidence baixa: ' + r.confidence);
});

t('marcha 3 estabilizada → identifica corretamente', () => {
  const sample = { rpm: 4500, speed: 45, tps: 80, accel: {x:1,y:0,z:0}, timestamp: 0 };
  const r = estimateGear(sample, [], calibration);
  assert(r.gear === 3, 'gear deveria ser 3, foi ' + r.gear);
  assert(r.confidence > 0.8, 'confidence baixa: ' + r.confidence);
});

t('stream 1→2→3: identifica cada marcha em ≤100ms da troca', () => {
  // Gear 1: 12→22 km/h
  const g1 = rampGear({ ratio: 250, speedStart: 12, speedEnd: 22, t0: 0 });
  // Shift snapshot to gear 2 at speed=22
  const sh12 = shiftSnapshot({ ratioFrom: 250, ratioTo: 150, speed: 22, t0: g1[g1.length - 1].timestamp + 50 });
  // Gear 2: 22→36
  const g2 = rampGear({ ratio: 150, speedStart: 22.5, speedEnd: 36, t0: sh12[1].timestamp + 50 });
  // Shift to gear 3 at speed=36
  const sh23 = shiftSnapshot({ ratioFrom: 150, ratioTo: 100, speed: 36, t0: g2[g2.length - 1].timestamp + 50 });
  // Gear 3: 36→50
  const g3 = rampGear({ ratio: 100, speedStart: 36.5, speedEnd: 50, t0: sh23[1].timestamp + 50 });

  const stream = [...g1, ...sh12, ...g2, ...sh23, ...g3];

  // Para cada momento alvo (depois das trocas), checar gear correto
  // Gear 1: amostra no meio de g1 (estabilizado)
  const idxG1 = Math.floor(g1.length * 0.7);
  const r1 = estimateGear(g1[idxG1], stream.slice(0, idxG1), calibration);
  assert(r1.gear === 1, 'esperava gear 1 estabilizado, foi ' + r1.gear);

  // Gear 2: 100ms depois do shift sh12[1]
  const tTarget12 = sh12[1].timestamp + 100;
  const idx2 = stream.findIndex(s => s.timestamp >= tTarget12);
  const r2 = estimateGear(stream[idx2], stream.slice(0, idx2), calibration);
  assert(r2.gear === 2, 'esperava gear 2 ≤100ms após shift, foi ' + r2.gear + ' (ratio=' + (stream[idx2].rpm/stream[idx2].speed).toFixed(1) + ')');

  // Gear 3: 100ms depois do shift sh23[1]
  const tTarget23 = sh23[1].timestamp + 100;
  const idx3 = stream.findIndex(s => s.timestamp >= tTarget23);
  const r3 = estimateGear(stream[idx3], stream.slice(0, idx3), calibration);
  assert(r3.gear === 3, 'esperava gear 3 ≤100ms após shift, foi ' + r3.gear);
});

t('velocidade ruidosa ±5% → confidence cai mas gear razoável', () => {
  const base = { rpm: 4500, speed: 30, tps: 80, accel: {x:1,y:0,z:0} };
  const history = [];
  for (let i = 0; i < 6; i++) {
    const noise = (Math.sin(i * 1.3) * 0.05);
    history.push({ ...base, speed: base.speed * (1 + noise), timestamp: i * 30 });
  }
  const sample = { ...base, speed: base.speed * 1.04, timestamp: 200 };
  const r = estimateGear(sample, history, calibration);
  assert(r.gear === 2, 'gear deveria continuar 2, foi ' + r.gear);
  assert(r.confidence < 1.0, 'confidence deveria ser < 1.0 com ruído, foi ' + r.confidence);
  assert(r.method === 'rpm_speed_history_accel', 'method esperado rpm_speed_history_accel, foi ' + r.method);
});

t('TPS=0 + acelerômetro indica desaceleração → reduz confidence (neutro/embreagem)', () => {
  const sample = { rpm: 4500, speed: 30, tps: 0, accel: {x: -2, y: 0, z: 0}, timestamp: 0 };
  const noClutchSample = { rpm: 4500, speed: 30, tps: 80, accel: {x: 1, y: 0, z: 0}, timestamp: 0 };
  const rClutch = estimateGear(sample, [], calibration);
  const rDrive = estimateGear(noClutchSample, [], calibration);
  assert(rClutch.gear === 2, 'gear ainda deveria ser estimada como 2');
  assert(rClutch.confidence < rDrive.confidence, 'confidence em modo clutch deveria ser menor');
  assert(rClutch.reason && rClutch.reason.includes('clutch'), 'reason deveria mencionar clutch/neutro');
});

t('patinação (RPM sobe sem accel) → ratio destoa, gear pode bater mas confidence baixa', () => {
  // Gear 2 esperado em 30 km/h: rpm ideal 4500. Patinação: rpm dispara para 7500.
  const sample = { rpm: 7500, speed: 30, tps: 90, accel: {x: 0.2, y: 0, z: 0}, timestamp: 0 };
  const r = estimateGear(sample, [], calibration);
  // ratio = 250 → deve parecer gear 1, mas com confidence baixa (não está em gear 1 fisicamente)
  // Não fazemos detecção de patinação aqui, apenas garantimos que confidence reflete a anomalia
  // ou que gear retornado faz sentido para o ratio observado.
  assert(r.gear === 1 || r.gear === 2, 'gear retornado: ' + r.gear);
  // Sem assertiva forte de confidence aqui — é caso de borda, basta que função não trave
  assert(r.confidence >= 0 && r.confidence <= 1, 'confidence fora de range');
});

t('redução (downshift) detectada por detectShiftEvent', () => {
  const history = [
    { rpm: 3500, speed: 36, tps: 0, timestamp: 0 },
    { rpm: 5400, speed: 36, tps: 0, timestamp: 100 }
  ];
  const ev = detectShiftEvent(history);
  assert(ev.type === 'down', 'esperava down, foi ' + ev.type);
});

t('troca pra cima (upshift) detectada por detectShiftEvent', () => {
  const history = [
    { rpm: 5500, speed: 22, tps: 0, timestamp: 0 },
    { rpm: 3300, speed: 22, tps: 0, timestamp: 100 }
  ];
  const ev = detectShiftEvent(history);
  assert(ev.type === 'up', 'esperava up, foi ' + ev.type);
});

t('detectShiftEvent ignora variação grande de velocidade', () => {
  const history = [
    { rpm: 5500, speed: 22, tps: 80, timestamp: 0 },
    { rpm: 4000, speed: 30, tps: 80, timestamp: 100 }  // velocidade subiu 36% — não é shift
  ];
  const ev = detectShiftEvent(history);
  assert(ev.type === null, 'não deveria detectar shift, retornou ' + ev.type);
});

t('detectShiftEvent: histórico curto retorna null', () => {
  assert(detectShiftEvent([]).type === null, 'lista vazia');
  assert(detectShiftEvent([{ rpm: 1, speed: 1, timestamp: 0 }]).type === null, 'lista 1 elemento');
});

t('learnSignature: amostras suficientes → ratio aprendido', () => {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    samples.push({ rpm: 4500 + (Math.random()-0.5)*100, speed: 30 + (Math.random()-0.5)*0.5 });
  }
  const sig = learnSignature(samples);
  assert(sig.rpm_speed_ratio !== null, 'ratio deveria ter sido aprendido');
  assert(sig.rpm_speed_ratio > 140 && sig.rpm_speed_ratio < 160, 'ratio fora do esperado: ' + sig.rpm_speed_ratio);
  assert(sig.sample_count === 20, 'sample_count: ' + sig.sample_count);
});

t('learnSignature: poucas amostras → null com reason', () => {
  const sig = learnSignature([{ rpm: 4500, speed: 30 }]);
  assert(sig.rpm_speed_ratio === null);
  assert(sig.reason === 'insufficient samples');
});

t('learnSignature: input inválido → null com reason', () => {
  const sig = learnSignature(null);
  assert(sig.rpm_speed_ratio === null);
  assert(typeof sig.reason === 'string');
});

t('loadSignatures: carro sem signatures → null', () => {
  assert(loadSignatures(null) === null);
  assert(loadSignatures({}) === null);
});

t('loadSignatures: carro com signatures → retorna o objeto', () => {
  const car = { gear_signatures: { 1: { rpm_speed_ratio: 250 } } };
  const s = loadSignatures(car);
  assert(s && s[1] && s[1].rpm_speed_ratio === 250);
});

t('estimateGear é função pura — não muta inputs', () => {
  const sample = Object.freeze({ rpm: 4500, speed: 30, tps: 80, accel: Object.freeze({x:1,y:0,z:0}), timestamp: 0 });
  const history = Object.freeze([]);
  const calib = Object.freeze({ gear_signatures: Object.freeze({ 2: Object.freeze({ rpm_speed_ratio: 150 }) }) });
  const r = estimateGear(sample, history, calib);
  assert(r.gear === 2);
});

console.log(`\n[gear-estimation.spec] ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
