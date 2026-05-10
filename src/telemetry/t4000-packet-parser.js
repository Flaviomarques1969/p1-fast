// T4000PacketParser — decodifica frames CAN da Injepro T4000.
//
// Spec: docs/hardware/T4000_CAN_SPEC.md
// PDF oficial Injepro 2026-04-24, exemplo canônico (checksum 0x91).
//
// Frame: 5 pacotes de 8 bytes cada, mesmo CAN ID 0x7FB, big-endian unsigned 16-bit
// por par de bytes, intervalo 10ms entre pacotes. Cycle total = 50ms (~20Hz).
//
// As 3 dúvidas residuais da spec não bloqueiam este parser:
// - #1 Diferenciação dos 5 pacotes: usamos contador temporal + sentinelas FIXED.
// - #2 Bytes 2-6 do pacote 5: assumidos zero-padding (matemática do checksum exige).
// - #3 Range max EGT: heurística OUT_OF_RANGE acima de 1500°C.
//
// Captura real do barramento (MS-9.1) confirma e refina.

export const T4000_CAN_ID = 0x7FB;
export const T4000_PACKETS_PER_CYCLE = 5;
export const T4000_BYTES_PER_PACKET = 8;
export const T4000_PACKET_INTERVAL_MS = 10;

// Sentinelas FIXED da spec
export const T4000_P4_FIXED_TAIL = [0x1E, 0xFC]; // bytes 6-7 do pacote 4
export const T4000_P5_FIXED_HEAD = [0xFB, 0xFA]; // bytes 0-1 do pacote 5

// Heurística range — refinar com captura real
export const T4000_EGT_MAX_C = 1500;

function u16BE(b0, b1) { return ((b0 & 0xFF) << 8) | (b1 & 0xFF); }

function bytesEq(arr, ...expected) {
  if (arr.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if ((arr[i] & 0xFF) !== expected[i]) return false;
  }
  return true;
}

function ensure8Bytes(name, bytes) {
  if (!bytes || bytes.length !== T4000_BYTES_PER_PACKET) {
    throw new Error(`T4000 ${name}: esperado ${T4000_BYTES_PER_PACKET} bytes, recebeu ${bytes?.length}`);
  }
}

// ── Parse pacote a pacote ────────────────────────────────────

export function parsePacket1(bytes) {
  ensure8Bytes('pacote 1', bytes);
  return {
    rpm:           u16BE(bytes[0], bytes[1]),       // ÷1
    speedKmh:      u16BE(bytes[2], bytes[3]) / 10,
    oilPressBar:   u16BE(bytes[4], bytes[5]) / 10,
    oilTempC:      u16BE(bytes[6], bytes[7]) / 10,
  };
}

export function parsePacket2(bytes) {
  ensure8Bytes('pacote 2', bytes);
  return {
    waterTempC:    u16BE(bytes[0], bytes[1]) / 10,
    fuelPressBar:  u16BE(bytes[2], bytes[3]) / 10,
    batteryV:      u16BE(bytes[4], bytes[5]) / 10,
    tpsPct:        u16BE(bytes[6], bytes[7]) / 10,
  };
}

export function parsePacket3(bytes) {
  ensure8Bytes('pacote 3', bytes);
  const egtRaw = u16BE(bytes[4], bytes[5]); // ÷1, range físico ~1500°C
  return {
    mapBar:        u16BE(bytes[0], bytes[1]) / 100, // -1.00 a 6.00 (turbo)
    airTempC:      u16BE(bytes[2], bytes[3]) / 10,
    egtC:          egtRaw,
    egtOutOfRange: egtRaw > T4000_EGT_MAX_C,
    lambda:        u16BE(bytes[6], bytes[7]) / 100,
  };
}

export function parsePacket4(bytes) {
  ensure8Bytes('pacote 4', bytes);
  if (!bytesEq(bytes.slice(6, 8), ...T4000_P4_FIXED_TAIL)) {
    throw new Error(`T4000 pacote 4: cauda fixa esperada 0x1E 0xFC, recebeu 0x${bytes[6].toString(16)} 0x${bytes[7].toString(16)}`);
  }
  return {
    fuelTempC:     u16BE(bytes[0], bytes[1]) / 10,
    marcha:        u16BE(bytes[2], bytes[3]),       // 0=N por convenção (a confirmar)
    ecuErrorBits:  u16BE(bytes[4], bytes[5]),       // bitfield
  };
}

export function parsePacket5(bytes) {
  ensure8Bytes('pacote 5', bytes);
  if (!bytesEq(bytes.slice(0, 2), ...T4000_P5_FIXED_HEAD)) {
    throw new Error(`T4000 pacote 5: cabeça fixa esperada 0xFB 0xFA, recebeu 0x${bytes[0].toString(16)} 0x${bytes[1].toString(16)}`);
  }
  return {
    reservedBytes: Array.from(bytes.slice(2, 7)), // bytes 2-6, dúvida residual #2
    checksum:      bytes[7] & 0xFF,
  };
}

// ── Identificação heurística do tipo de pacote (sem contexto temporal) ──

export function identifyPacketType(bytes) {
  ensure8Bytes('identify', bytes);
  if (bytesEq(bytes.slice(6, 8), ...T4000_P4_FIXED_TAIL)) return 4;
  if (bytesEq(bytes.slice(0, 2), ...T4000_P5_FIXED_HEAD)) return 5;
  return null; // pacotes 1, 2, 3 indistinguíveis sem ordem temporal
}

// ── Checksum ─────────────────────────────────────────────────

export function computeChecksum({ p1, p2, p3, p4, p5 }) {
  let sum = 0;
  for (const pkt of [p1, p2, p3, p4]) {
    for (let i = 0; i < T4000_BYTES_PER_PACKET; i++) sum += pkt[i] & 0xFF;
  }
  // pacote 5: TODOS bytes 0..6 (cabeça fixa + 5 reservados), não inclui o byte 7 (próprio checksum)
  for (let i = 0; i < T4000_BYTES_PER_PACKET - 1; i++) sum += p5[i] & 0xFF;
  return sum % 256;
}

export function validateChecksum({ p1, p2, p3, p4, p5 }) {
  const expected = computeChecksum({ p1, p2, p3, p4, p5 });
  const got = p5[T4000_BYTES_PER_PACKET - 1] & 0xFF;
  return { ok: expected === got, expected, got };
}

// ── Parse de ciclo completo ──────────────────────────────────

export function parseCycle({ p1, p2, p3, p4, p5 }) {
  ensure8Bytes('p1', p1);
  ensure8Bytes('p2', p2);
  ensure8Bytes('p3', p3);
  ensure8Bytes('p4', p4);
  ensure8Bytes('p5', p5);

  const f1 = parsePacket1(p1);
  const f2 = parsePacket2(p2);
  const f3 = parsePacket3(p3);
  const f4 = parsePacket4(p4);
  const f5 = parsePacket5(p5);
  const cs = validateChecksum({ p1, p2, p3, p4, p5 });

  return {
    ok: cs.ok,
    checksum: cs,
    sample: { ...f1, ...f2, ...f3, ...f4 },
    reservedBytes: f5.reservedBytes,
  };
}

// ── Stateful feeder ─────────────────────────────────────────
//
// Recebe pacotes 1-a-1 (ordem em que chegam do barramento), agrupa em ciclos,
// ressincroniza por sentinelas FIXED quando perde frame.
// Hipótese (a)+(b) da spec.

export function createT4000PacketFeeder({ onCycle, onError } = {}) {
  let buf = [null, null, null, null, null]; // p1..p5 slots
  let nextSlot = 0;

  function reset(reason) {
    buf = [null, null, null, null, null];
    nextSlot = 0;
    if (reason && onError) onError({ stage: 'resync', reason });
  }

  function emitIfReady() {
    if (nextSlot !== 5) return;
    try {
      const result = parseCycle({
        p1: buf[0], p2: buf[1], p3: buf[2], p4: buf[3], p5: buf[4],
      });
      if (onCycle) onCycle(result);
    } catch (e) {
      if (onError) onError({ stage: 'parse', reason: e.message });
    }
    reset();
  }

  function feed(bytes) {
    ensure8Bytes('feed', bytes);
    const detected = identifyPacketType(bytes); // 4, 5, ou null
    if (detected === 4) {
      // só aceita pacote 4 se já tem 1, 2, 3
      if (nextSlot !== 3) {
        reset(`pacote 4 chegou em slot ${nextSlot}, ressincronizando`);
        return;
      }
      buf[3] = bytes;
      nextSlot = 4;
      return;
    }
    if (detected === 5) {
      if (nextSlot !== 4) {
        reset(`pacote 5 chegou em slot ${nextSlot}, ressincronizando`);
        return;
      }
      buf[4] = bytes;
      nextSlot = 5;
      emitIfReady();
      return;
    }
    // detected === null → pacote 1, 2 ou 3 por exclusão; encaixa por ordem temporal
    if (nextSlot >= 3) {
      reset(`pacote ambíguo chegou em slot ${nextSlot} (esperando p4 ou p5)`);
      return;
    }
    buf[nextSlot] = bytes;
    nextSlot++;
  }

  return { feed, reset };
}

// ── Fixture canônica do PDF (ground truth) ───────────────────
//
// Exemplo do documento oficial Injepro 2026-04-24. Soma total: 1937.
// 1937 mod 256 = 145 = 0x91 (checksum). Validado matematicamente.
// Os 5 bytes reservados do pacote 5 são zero-padding (única forma do checksum fechar).

export const T4000_PDF_FIXTURE = Object.freeze({
  p1: Object.freeze([0x03, 0xE8, 0x0A, 0xF0, 0x00, 0x28, 0x03, 0x20]),
  p2: Object.freeze([0x03, 0x20, 0x00, 0x28, 0x00, 0x78, 0x02, 0x58]),
  p3: Object.freeze([0x00, 0x64, 0x03, 0x20, 0x03, 0x20, 0x00, 0x64]),
  p4: Object.freeze([0x03, 0x20, 0x00, 0x04, 0x00, 0x00, 0x1E, 0xFC]),
  p5: Object.freeze([0xFB, 0xFA, 0x00, 0x00, 0x00, 0x00, 0x00, 0x91]),
});

export const T4000_PDF_EXPECTED = Object.freeze({
  rpm: 1000,
  speedKmh: 280,
  oilPressBar: 4.0,
  oilTempC: 80,
  waterTempC: 80,
  fuelPressBar: 4.0,
  batteryV: 12.0,
  tpsPct: 60.0,
  mapBar: 1.00,
  airTempC: 80,
  egtC: 800,
  egtOutOfRange: false,
  lambda: 1.00,
  fuelTempC: 80,
  marcha: 4,
  ecuErrorBits: 0,
});
