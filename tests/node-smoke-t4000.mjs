// Smoke do T4000PacketParser — fixture canônica do PDF + casos de erro.
// Spec: docs/hardware/T4000_CAN_SPEC.md
// Implementação: src/telemetry/t4000-packet-parser.js

import {
  T4000_PDF_FIXTURE,
  T4000_PDF_EXPECTED,
  T4000_CAN_ID,
  T4000_PACKETS_PER_CYCLE,
  T4000_BYTES_PER_PACKET,
  parsePacket1,
  parsePacket2,
  parsePacket3,
  parsePacket4,
  parsePacket5,
  parseCycle,
  identifyPacketType,
  computeChecksum,
  validateChecksum,
  createT4000PacketFeeder,
} from '../src/telemetry/t4000-packet-parser.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

function approxEq(a, b, eps = 1e-6) {
  if (Math.abs(a - b) > eps) throw new Error(`esperado ${b}, recebeu ${a}`);
}

const FX = {
  p1: Array.from(T4000_PDF_FIXTURE.p1),
  p2: Array.from(T4000_PDF_FIXTURE.p2),
  p3: Array.from(T4000_PDF_FIXTURE.p3),
  p4: Array.from(T4000_PDF_FIXTURE.p4),
  p5: Array.from(T4000_PDF_FIXTURE.p5),
};

// ── Constantes da spec ────────────────────────────────────

t('T4K-01 CAN ID = 0x7FB', () => {
  if (T4000_CAN_ID !== 0x7FB) throw new Error('CAN ID divergente');
});
t('T4K-02 5 pacotes por ciclo, 8 bytes cada', () => {
  if (T4000_PACKETS_PER_CYCLE !== 5) throw new Error('pacotes por ciclo');
  if (T4000_BYTES_PER_PACKET !== 8) throw new Error('bytes por pacote');
});

// ── Decodificação por pacote (fixture do PDF) ──────────────

t('T4K-03 pacote 1: RPM=1000, vel=280km/h, óleo P=4bar T=80C', () => {
  const f = parsePacket1(FX.p1);
  approxEq(f.rpm, T4000_PDF_EXPECTED.rpm);
  approxEq(f.speedKmh, T4000_PDF_EXPECTED.speedKmh);
  approxEq(f.oilPressBar, T4000_PDF_EXPECTED.oilPressBar);
  approxEq(f.oilTempC, T4000_PDF_EXPECTED.oilTempC);
});

t('T4K-04 pacote 2: água=80C, comb P=4bar, bat=12V, TPS=60%', () => {
  const f = parsePacket2(FX.p2);
  approxEq(f.waterTempC, T4000_PDF_EXPECTED.waterTempC);
  approxEq(f.fuelPressBar, T4000_PDF_EXPECTED.fuelPressBar);
  approxEq(f.batteryV, T4000_PDF_EXPECTED.batteryV);
  approxEq(f.tpsPct, T4000_PDF_EXPECTED.tpsPct);
});

t('T4K-05 pacote 3: MAP=1.0bar, ar=80C, EGT=800C, λ=1.0', () => {
  const f = parsePacket3(FX.p3);
  approxEq(f.mapBar, T4000_PDF_EXPECTED.mapBar);
  approxEq(f.airTempC, T4000_PDF_EXPECTED.airTempC);
  approxEq(f.egtC, T4000_PDF_EXPECTED.egtC);
  approxEq(f.lambda, T4000_PDF_EXPECTED.lambda);
  if (f.egtOutOfRange) throw new Error('EGT 800C não deveria estar out of range');
});

t('T4K-06 pacote 4: comb=80C, marcha=4, sem erro ECU, fixed 0x1E 0xFC', () => {
  const f = parsePacket4(FX.p4);
  approxEq(f.fuelTempC, T4000_PDF_EXPECTED.fuelTempC);
  approxEq(f.marcha, T4000_PDF_EXPECTED.marcha);
  approxEq(f.ecuErrorBits, T4000_PDF_EXPECTED.ecuErrorBits);
});

t('T4K-07 pacote 5: head 0xFB 0xFA + checksum 0x91', () => {
  const f = parsePacket5(FX.p5);
  if (f.checksum !== 0x91) throw new Error(`checksum esperado 0x91, recebeu 0x${f.checksum.toString(16)}`);
  if (f.reservedBytes.length !== 5) throw new Error('reservedBytes deve ter 5 bytes');
  if (!f.reservedBytes.every(b => b === 0)) throw new Error('zero-padding esperado nos bytes 2-6');
});

// ── Identificação heurística ───────────────────────────────

t('T4K-08 identifyPacketType: pacote 4 detectado pela cauda 0x1E 0xFC', () => {
  if (identifyPacketType(FX.p4) !== 4) throw new Error('p4 não detectado');
});
t('T4K-09 identifyPacketType: pacote 5 detectado pela cabeça 0xFB 0xFA', () => {
  if (identifyPacketType(FX.p5) !== 5) throw new Error('p5 não detectado');
});
t('T4K-10 identifyPacketType: pacotes 1/2/3 retornam null (precisam ordem temporal)', () => {
  if (identifyPacketType(FX.p1) !== null) throw new Error('p1 deveria ser null');
  if (identifyPacketType(FX.p2) !== null) throw new Error('p2 deveria ser null');
  if (identifyPacketType(FX.p3) !== null) throw new Error('p3 deveria ser null');
});

// ── Checksum ───────────────────────────────────────────────

t('T4K-11 computeChecksum bate matematicamente: 1937 mod 256 = 0x91', () => {
  // soma de p1..p4 + p5[0..6]: 560+285+270+321+(251+250+0+0+0+0+0)=1937
  const cs = computeChecksum(FX);
  if (cs !== 0x91) throw new Error(`esperado 0x91, recebeu 0x${cs.toString(16)}`);
});
t('T4K-12 validateChecksum.ok=true na fixture do PDF', () => {
  const v = validateChecksum(FX);
  if (!v.ok) throw new Error(`checksum invalida: esperado 0x${v.expected.toString(16)} recebeu 0x${v.got.toString(16)}`);
});
t('T4K-13 validateChecksum.ok=false se byte alterado', () => {
  const corrupted = { ...FX, p1: [...FX.p1] };
  corrupted.p1[0] = 0xFF;
  const v = validateChecksum(corrupted);
  if (v.ok) throw new Error('deveria detectar corrupção');
});

// ── parseCycle ─────────────────────────────────────────────

t('T4K-14 parseCycle retorna sample completo + ok=true na fixture', () => {
  const r = parseCycle(FX);
  if (!r.ok) throw new Error('checksum esperado válido');
  for (const k of Object.keys(T4000_PDF_EXPECTED)) {
    approxEq(r.sample[k] ?? false, T4000_PDF_EXPECTED[k]);
  }
});

t('T4K-15 parseCycle rejeita pacote 4 sem cauda fixa', () => {
  const bad = { ...FX, p4: [...FX.p4] };
  bad.p4[6] = 0x00; bad.p4[7] = 0x00;
  let threw = false;
  try { parseCycle(bad); } catch { threw = true; }
  if (!threw) throw new Error('deveria lançar erro');
});

t('T4K-16 parseCycle rejeita pacote 5 sem cabeça fixa', () => {
  const bad = { ...FX, p5: [...FX.p5] };
  bad.p5[0] = 0x00; bad.p5[1] = 0x00;
  let threw = false;
  try { parseCycle(bad); } catch { threw = true; }
  if (!threw) throw new Error('deveria lançar erro');
});

// ── EGT out of range ──────────────────────────────────────

t('T4K-17 EGT > 1500°C dispara egtOutOfRange=true', () => {
  const p3hot = [0x00, 0x64, 0x03, 0x20, 0x06, 0x40, 0x00, 0x64]; // EGT=0x0640=1600
  const f = parsePacket3(p3hot);
  if (!f.egtOutOfRange) throw new Error('1600C deveria estar out of range');
  if (f.egtC !== 1600) throw new Error('valor cru deveria preservar 1600');
});

// ── MAP turbo (negativo via uint16 saturado pelo software, conforme spec) ──

t('T4K-18 MAP em vácuo (200=2.00bar) decodifica correto pra range turbo', () => {
  // Spec diz "−1.00 a 6.00". O fator é ÷100 sobre uint16, então MAP=200 = 2.00bar.
  const p3 = [0x00, 0xC8, 0x03, 0x20, 0x03, 0x20, 0x00, 0x64]; // MAP=0x00C8=200
  const f = parsePacket3(p3);
  approxEq(f.mapBar, 2.00);
});

// ── Erro ECU bitfield ─────────────────────────────────────

t('T4K-19 erro ECU != 0 propaga raw bits (caller decide ação)', () => {
  const p4err = [0x03, 0x20, 0x00, 0x04, 0x00, 0x05, 0x1E, 0xFC]; // 0x0005 = bit 0 + bit 2
  const f = parsePacket4(p4err);
  if (f.ecuErrorBits !== 0x0005) throw new Error('bits brutos não preservados');
});

// ── Stateful feeder: ciclo válido completo ────────────────

t('T4K-20 feeder emite onCycle quando 5 pacotes chegam em ordem', () => {
  const cycles = [];
  const errs = [];
  const f = createT4000PacketFeeder({ onCycle: c => cycles.push(c), onError: e => errs.push(e) });
  f.feed(FX.p1);
  f.feed(FX.p2);
  f.feed(FX.p3);
  f.feed(FX.p4);
  f.feed(FX.p5);
  if (cycles.length !== 1) throw new Error(`esperado 1 ciclo, recebeu ${cycles.length}`);
  if (errs.length !== 0) throw new Error(`erros inesperados: ${JSON.stringify(errs)}`);
  if (!cycles[0].ok) throw new Error('ciclo deveria ter checksum ok');
});

// ── Stateful feeder: ressincroniza ao perder pacote ──────

t('T4K-21 feeder ressincroniza se p4 chegar fora de ordem', () => {
  const cycles = [];
  const errs = [];
  const f = createT4000PacketFeeder({ onCycle: c => cycles.push(c), onError: e => errs.push(e) });
  // tenta p1 → p4 (pulando 2 e 3)
  f.feed(FX.p1);
  f.feed(FX.p4); // chegou cedo → reset
  // depois ciclo válido
  f.feed(FX.p1);
  f.feed(FX.p2);
  f.feed(FX.p3);
  f.feed(FX.p4);
  f.feed(FX.p5);
  if (cycles.length !== 1) throw new Error(`esperado 1 ciclo após resync, recebeu ${cycles.length}`);
  if (errs.length === 0) throw new Error('resync deveria gerar onError');
});

t('T4K-22 feeder ressincroniza se p5 chegar antes da hora', () => {
  const cycles = [];
  const errs = [];
  const f = createT4000PacketFeeder({ onCycle: c => cycles.push(c), onError: e => errs.push(e) });
  f.feed(FX.p1);
  f.feed(FX.p2);
  f.feed(FX.p5); // chegou cedo
  if (cycles.length !== 0) throw new Error('não deveria emitir ciclo');
  if (errs.length === 0) throw new Error('deveria gerar onError');
});

// ── Validação de input ────────────────────────────────────

t('T4K-23 parsePacket1 rejeita tamanho errado', () => {
  let threw = false;
  try { parsePacket1([0, 0, 0]); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar 3 bytes');
});

// ── T4000Provider (adapter standalone) ─────────────────────

const { T4000Provider, T4000_SIGNAL, T4000_CONSTANTS } = await import('../src/telemetry/t4000-provider.js');

t('T4K-24 T4000Provider emite sample do ciclo PDF com checksumOk=true e tMono', () => {
  let captured = null;
  const p = new T4000Provider({ now: () => 12345, onT4000Sample: s => captured = s });
  for (const k of ['p1','p2','p3','p4','p5']) p.feedPacket(Array.from(T4000_PDF_FIXTURE[k]));
  if (!captured) throw new Error('sample não capturado');
  if (!captured.checksumOk) throw new Error('checksumOk deveria ser true');
  if (captured.tMono !== 12345) throw new Error('tMono não veio do injector');
  if (captured.rpm !== 1000) throw new Error('rpm errado');
  if (captured.marcha !== 4) throw new Error('marcha errada');
  if (captured.lambda !== 1.00) throw new Error('lambda errado');
});

t('T4K-25 T4000Provider stats: cyclesOk=1 após ciclo válido', () => {
  const p = new T4000Provider({ onT4000Sample: () => {} });
  for (const k of ['p1','p2','p3','p4','p5']) p.feedPacket(Array.from(T4000_PDF_FIXTURE[k]));
  const s = p.getStats();
  if (s.cyclesOk !== 1) throw new Error(`cyclesOk esperado 1, recebeu ${s.cyclesOk}`);
  if (s.cyclesBad !== 0) throw new Error('cyclesBad deveria ser 0');
  if (s.consecutiveBadCycles !== 0) throw new Error('consecutiveBadCycles deveria ser 0');
  if (s.signalQuality !== T4000_SIGNAL.GOOD) throw new Error(`signal esperado GOOD, recebeu ${s.signalQuality}`);
});

t('T4K-26 T4000Provider sinaliza DEGRADED após 2 bad cycles consecutivos', () => {
  const p = new T4000Provider({ onT4000Sample: () => {} });
  // 2 fora de ordem (p4 antes da hora) → 2 onError
  p.feedPacket(Array.from(T4000_PDF_FIXTURE.p1));
  p.feedPacket(Array.from(T4000_PDF_FIXTURE.p4)); // resync
  p.feedPacket(Array.from(T4000_PDF_FIXTURE.p1));
  p.feedPacket(Array.from(T4000_PDF_FIXTURE.p4)); // resync
  const s = p.getStats();
  if (s.signalQuality !== T4000_SIGNAL.DEGRADED) throw new Error(`signal esperado DEGRADED, recebeu ${s.signalQuality}`);
});

t('T4K-27 T4000_CONSTANTS expõe CAN ID + Hz alvo', () => {
  if (T4000_CONSTANTS.CAN_ID !== 0x7FB) throw new Error('CAN ID divergente');
  if (T4000_CONSTANTS.EXPECTED_CYCLE_HZ !== 20) throw new Error('Hz esperado 20 (5 pacotes × 10ms)');
  if (T4000_CONSTANTS.PUBLISH_TARGET_HZ !== 10) throw new Error('Hz publish esperado 10 (MS-9.5 Realtime)');
});

console.log(`\nT4000: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
