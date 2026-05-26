// node-smoke-t3000-usb-parser.mjs — testes automáticos do decodificador
// USB Injepro T3000.
//
// Fixtures vêm de captura real com o Bubi do Flávio em 2026-05-25.

import { parseT3000RIBlock, ACK_BYTES, ACK_RESPONSE, RI_BYTES, isAckOk } from '../web/cockpit/t3000-usb-parser.js';

let ok = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); fail++; }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert falhou'); };
const assertEq = (a, b, msg) => assert(a === b, `${msg||''}: esperado ${b}, recebeu ${a}`);

console.log('\n=== T3000 USB parser ===');

// Bytes de saudação
test('ACK = "ACK"', () => {
  assertEq(ACK_BYTES.length, 3);
  assertEq(ACK_BYTES[0], 0x41);
  assertEq(ACK_BYTES[1], 0x43);
  assertEq(ACK_BYTES[2], 0x4B);
});

test('RI = "RI"', () => {
  assertEq(RI_BYTES.length, 2);
  assertEq(RI_BYTES[0], 0x52);
  assertEq(RI_BYTES[1], 0x49);
});

test('isAckOk reconhece "OK"', () => {
  assert(isAckOk(new Uint8Array([0x4F, 0x4B])));
  assert(isAckOk(new Uint8Array([0x4F, 0x4B, 0x00, 0x00])));
  assert(!isAckOk(new Uint8Array([0x4E, 0x43]))); // "NC"
  assert(!isAckOk(new Uint8Array([0x4F])));
  assert(!isAckOk(new Uint8Array([])));
});

// Helpers pra montar fixture
function buildBlock({ rpm = 0, batRaw = 0, inj = [0,0,0,0] }) {
  const buf = new Uint8Array(460);
  buf[0] = rpm & 0xFF; buf[1] = (rpm >> 8) & 0xFF;
  buf[2] = batRaw & 0xFF; buf[3] = (batRaw >> 8) & 0xFF;
  // sensores não-instalados típicos (do Bubi)
  buf[4] = 0xFE; buf[5] = 0xFF;
  buf[10] = 0xEC; buf[11] = 0xFF;
  for (let i = 0; i < 4; i++) {
    const v = inj[i] | 0;
    buf[84 + i*2] = v & 0xFF;
    buf[85 + i*2] = (v >> 8) & 0xFF;
  }
  return buf;
}

// Fixture do Bubi, motor parado
test('motor parado: rpm=0 batteryV=11.5V', () => {
  const buf = buildBlock({ rpm: 0, batRaw: 115, inj: [0,0,0,0] });
  const s = parseT3000RIBlock(buf);
  assertEq(s.rpm, 0);
  assertEq(s.batteryV, 11.5);
  assertEq(s.source, 't3000-usb');
  assertEq(s.checksumOk, true);
});

// Fixture do Bubi, motor ligado em marcha lenta (capturado 2026-05-25)
test('motor ligado marcha lenta: rpm≈905 batteryV=13V inj balanceada', () => {
  const buf = buildBlock({ rpm: 905, batRaw: 130, inj: [2128, 2128, 2128, 2128] });
  const s = parseT3000RIBlock(buf);
  assertEq(s.rpm, 905);
  assertEq(s.batteryV, 13.0);
  assertEq(s.fuelInjectionRaw[0], 2128);
  assertEq(s.fuelInjectionRaw[3], 2128);
  assertEq(s.fuelInjectionSpread, 0);
  assert(s.fuelInjectionBalanced, 'deveria estar balanceado');
});

// Fixture com cilindro fora
test('cilindro com defeito: spread > 200 → balanceado=false', () => {
  const buf = buildBlock({ rpm: 940, batRaw: 132, inj: [2128, 2128, 1800, 2128] });
  const s = parseT3000RIBlock(buf);
  assertEq(s.fuelInjectionSpread, 328);
  assert(!s.fuelInjectionBalanced, 'deveria estar desbalanceado');
});

// Validações defensivas
test('buffer null → null', () => {
  assert(parseT3000RIBlock(null) === null);
});

test('buffer curto demais → null', () => {
  assert(parseT3000RIBlock(new Uint8Array(50)) === null);
});

test('não Uint8Array → null', () => {
  assert(parseT3000RIBlock([0,0,0,0]) === null);
});

// LiveDataBridge compat: sample tem os campos esperados (mesmo que undefined)
test('sample tem todos os campos que LiveDataBridge consulta', () => {
  const buf = buildBlock({ rpm: 940, batRaw: 132, inj: [2128, 2128, 2128, 2128] });
  const s = parseT3000RIBlock(buf);
  assert('rpm' in s);
  assert('checksumOk' in s);
  assert('ecuErrorBits' in s);
  assert('waterTempC' in s);
  assert('oilTempC' in s);
  assert('oilPressBar' in s);
  assert('egtOutOfRange' in s);
  assert('tMono' in s);
});

console.log(`\n=== ${ok} ok / ${fail} fail ===\n`);
if (fail > 0) process.exit(1);
