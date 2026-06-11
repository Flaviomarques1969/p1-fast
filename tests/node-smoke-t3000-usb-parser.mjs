// node-smoke-t3000-usb-parser.mjs — testes do decodificador USB Injepro T3000.
//
// v2 (2026-05-26): cobertura completa do mapeamento extraído via engenharia
// reversa do software T LINE v3.3.7. Fixtures derivadas de captura real
// com o Celta "Bubi" + bytes sintéticos pros campos que não capturamos ainda.

import { parseT3000RIBlock, ACK_BYTES, RI_BYTES, isAckOk } from '../web/cockpit/t3000-usb-parser.js';

let ok = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); fail++; }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert falhou'); };
const assertEq = (a, b, msg) => assert(a === b, `${msg||''}: esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`);
const assertClose = (a, b, eps=0.001, msg) => assert(Math.abs(a-b) < eps, `${msg||''}: |${a}-${b}| < ${eps}`);

console.log('\n=== T3000 USB parser v2 ===');

// ── Saudação ─────────────────────────────────────────
test('ACK = "ACK"', () => {
  assertEq(ACK_BYTES.length, 3);
  assertEq(ACK_BYTES[0], 0x41); assertEq(ACK_BYTES[1], 0x43); assertEq(ACK_BYTES[2], 0x4B);
});
test('RI = "RI"', () => {
  assertEq(RI_BYTES.length, 2);
  assertEq(RI_BYTES[0], 0x52); assertEq(RI_BYTES[1], 0x49);
});
test('isAckOk reconhece "OK" mas não "NC"', () => {
  assert(isAckOk(new Uint8Array([0x4F, 0x4B])));
  assert(!isAckOk(new Uint8Array([0x4E, 0x43])));
  assert(!isAckOk(new Uint8Array([])));
});

// ── Helper pra montar fixture ─────────────────────────
function buildBlock({
  rpm=0, batRaw=0, mapRaw=0,
  tps1Raw=0, pedal1Raw=0, pedal2Raw=0,
  tempArRaw=0xFFFE, tempMotorRaw=0xFFEC, lambdaRaw=0,
  injTimeA=[0,0,0,0,0,0,0,0],
  velocidadeRaw=0, pressaoFreioRaw=0,
  accelXRaw=0, accelYRaw=0, accelZRaw=0,
  alarmesBits=0, b18=0, mapaAtual=0,
  len=460,
} = {}) {
  const b = new Uint8Array(len);
  const w16 = (off, v) => { b[off] = v & 0xFF; b[off+1] = (v >> 8) & 0xFF; };
  const w32 = (off, v) => { b[off]=v&0xFF; b[off+1]=(v>>8)&0xFF; b[off+2]=(v>>16)&0xFF; b[off+3]=(v>>24)&0xFF; };
  w16(0, rpm);
  w16(2, batRaw);
  w16(4, mapRaw);
  // sensores externos default zeros
  w16(46, tps1Raw);
  w16(52, pedal1Raw);
  w16(54, pedal2Raw);
  w16(56, tempArRaw);
  w16(58, tempMotorRaw);
  // lambda de teste vai no offset 62 (sonda WB banda larga — a ATIVA no Bubi;
  // conserto 26/05, PR #216). O offset 60 é a NB desligada (fica 0 no bloco).
  w16(62, lambdaRaw);
  for (let i = 0; i < 8; i++) w16(84 + i*2, injTimeA[i]);
  b[100] = b18;
  w16(102, velocidadeRaw);
  b[108] = mapaAtual;
  if (len >= 270) w16(268, pressaoFreioRaw);
  if (len >= 276) { w16(270, accelXRaw); w16(272, accelYRaw); w16(274, accelZRaw); }
  if (len >= 292) w32(288, alarmesBits);
  return b;
}

// ── Motor parado ────────────────────────────────────────
test('motor parado: rpm=0, bateria 11.5V, tudo zerado', () => {
  const buf = buildBlock({ rpm: 0, batRaw: 115 });
  const s = parseT3000RIBlock(buf);
  assertEq(s.rpm, 0);
  assertEq(s.batteryV, 11.5);
  assertEq(s.checksumOk, true);
  assertEq(s.source, 't3000-usb');
});

// ── Motor ligado em marcha lenta (cap. real Bubi 25/05) ──
test('motor marcha lenta 905 rpm, bateria 13V', () => {
  const buf = buildBlock({ rpm: 905, batRaw: 130, injTimeA: [2128,2128,2128,2128,0,0,0,0] });
  const s = parseT3000RIBlock(buf);
  assertEq(s.rpm, 905);
  assertEq(s.batteryV, 13.0);
  assertEq(s.fuelInjectionRaw.length, 4);
  assertEq(s.fuelInjectionSpread, 0);
  assert(s.fuelInjectionBalanced, 'deveria estar balanceado');
});

// ── TPS, pedal, freio ─────────────────────────────────
test('acelerador (pedal) 50%, freio (pedal) 30%, TPS abertura 45%', () => {
  const buf = buildBlock({ tps1Raw: 450, pedal1Raw: 500, pedal2Raw: 300 });
  const s = parseT3000RIBlock(buf);
  assertEq(s.tpsPct, 45);
  assertEq(s.pedalAceleradorPct, 50);
  assertEq(s.pedalFreioPct, 30);
});

// ── Temperaturas ──────────────────────────────────────
test('temperatura motor (água) 87°C, ar de admissão 39°C', () => {
  const buf = buildBlock({ tempArRaw: 39, tempMotorRaw: 87 });
  const s = parseT3000RIBlock(buf);
  assertEq(s.waterTempC, 87);
  assertEq(s.airTempC, 39);
});

test('sensor desligado retorna null (não interpreta -2/-20 como temperatura)', () => {
  // -2 = 0xFFFE; -20 = 0xFFEC
  const buf = buildBlock({ tempArRaw: 0xFFFE, tempMotorRaw: 0xFFEC });
  const s = parseT3000RIBlock(buf);
  assertEq(s.airTempC, null);
  assertEq(s.waterTempC, null);
});

// ── Lambda ────────────────────────────────────────────
test('lambda 0.92 (mistura rica)', () => {
  const buf = buildBlock({ lambdaRaw: 920 });
  const s = parseT3000RIBlock(buf);
  assertClose(s.lambda, 0.92);
});

// ── MAP ───────────────────────────────────────────────
test('MAP -0.5 bar (vácuo, marcha lenta típica)', () => {
  const buf = buildBlock({ mapRaw: -50 });
  const s = parseT3000RIBlock(buf);
  assertClose(s.mapBar, -0.5);
});

// ── Velocidade ────────────────────────────────────────
test('velocidade 80 km/h', () => {
  const buf = buildBlock({ velocidadeRaw: 800 });
  const s = parseT3000RIBlock(buf);
  assertClose(s.speedKmh, 80);
});

// ── Pressão de freio + acelerômetro ───────────────────
test('pressão freio 4.5 bar, accel +0.8g longitudinal', () => {
  const buf = buildBlock({ pressaoFreioRaw: 450, accelXRaw: 800, accelYRaw: 100, accelZRaw: -50 });
  const s = parseT3000RIBlock(buf);
  assertClose(s.pressaoFreioBar, 4.5);
  assertClose(s.accelXg, 0.8);
  assertClose(s.accelYg, 0.1);
  assertClose(s.accelZg, -0.05);
});

// ── Alarmes ───────────────────────────────────────────
test('alarme baixaPressaoOleo (bit 4) detectado', () => {
  const buf = buildBlock({ alarmesBits: 1 << 4 });
  const s = parseT3000RIBlock(buf);
  assertEq(s.alarmes.baixaPressaoOleo, true);
  assertEq(s.alarmes.excessoRotacao, false);
  assertEq(s.ecuErrorBits, 1 << 4);
});
test('alarme excessoRotacao + excessoTempMotor combinados', () => {
  const buf = buildBlock({ alarmesBits: (1<<0) | (1<<2) });
  const s = parseT3000RIBlock(buf);
  assertEq(s.alarmes.excessoRotacao, true);
  assertEq(s.alarmes.excessoTempMotor, true);
  assertEq(s.alarmes.baixaPressaoOleo, false);
});

// ── Status sinais (bitfield byte) ─────────────────────
test('bit ar condicionado + boost', () => {
  // bit3 = arCondicionado; bit4 = sinalBooster
  const buf = buildBlock({ b18: (1<<3) | (1<<4) });
  const s = parseT3000RIBlock(buf);
  assertEq(s.statusSinais.arCondicionado, true);
  assertEq(s.statusSinais.sinalBooster, true);
  assertEq(s.statusSinais.corteArrancada, false);
});

// ── Cilindros desbalanceados ──────────────────────────
test('cilindro 3 com defeito → desbalanceado', () => {
  const buf = buildBlock({ injTimeA: [2128, 2128, 1800, 2128, 0,0,0,0] });
  const s = parseT3000RIBlock(buf);
  assertEq(s.fuelInjectionSpread, 328);
  assert(!s.fuelInjectionBalanced, 'deveria detectar desbalanceio');
});

// ── Defensivos ────────────────────────────────────────
test('buffer null → null', () => assert(parseT3000RIBlock(null) === null));
test('buffer curto < 110 → null', () => assert(parseT3000RIBlock(new Uint8Array(50)) === null));
test('não Uint8Array → null', () => assert(parseT3000RIBlock([0,0]) === null));

// ── Compatibilidade com LiveDataBridge ────────────────
test('sample tem todos os campos esperados pela LiveDataBridge', () => {
  const buf = buildBlock({ rpm: 3500, batRaw: 132, tempMotorRaw: 90, alarmesBits: 1<<4 });
  const s = parseT3000RIBlock(buf);
  // Campos consumidos pelo bridge (live-data-bridge.js)
  assert('rpm' in s);
  assert('checksumOk' in s);
  assert('ecuErrorBits' in s);
  assert('waterTempC' in s);
  assert('oilTempC' in s);          // undefined OK
  assert('oilPressBar' in s);        // undefined OK
  assert('egtOutOfRange' in s);
  assert('tMono' in s);
  // ecuErrorBits = bitfield de alarmes → bridge dispara mensagem GRAVE
  assertEq(s.ecuErrorBits, 1 << 4);
});

// ── Bloco grande (com todos os offsets) ──────────────
test('bloco completo 460 bytes — todos os campos populados', () => {
  const buf = buildBlock({
    rpm: 4500, batRaw: 138, mapRaw: 50,
    tps1Raw: 700, pedal1Raw: 750, pedal2Raw: 0,
    tempArRaw: 42, tempMotorRaw: 92,
    lambdaRaw: 880,
    injTimeA: [2500, 2500, 2500, 2500, 0,0,0,0],
    velocidadeRaw: 1500,
    pressaoFreioRaw: 0,
    accelXRaw: 450, accelYRaw: -200, accelZRaw: 100,
    alarmesBits: 0,
    mapaAtual: 0,
    len: 460,
  });
  const s = parseT3000RIBlock(buf);
  assertEq(s.rpm, 4500);
  assertClose(s.batteryV, 13.8);
  assertClose(s.mapBar, 0.5);
  assertEq(s.tpsPct, 70);
  assertEq(s.pedalAceleradorPct, 75);
  assertClose(s.lambda, 0.88);
  assertClose(s.speedKmh, 150);
  assertClose(s.accelXg, 0.45);
  assertEq(s.waterTempC, 92);
  assertEq(s.bytesLen, 460);
  assertEq(s.parserVersion, '2.0.0');
});

console.log(`\n=== ${ok} ok / ${fail} fail ===\n`);
if (fail > 0) process.exit(1);
