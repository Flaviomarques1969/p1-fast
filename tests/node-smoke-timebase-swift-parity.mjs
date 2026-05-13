// ═══════════════════════════════════════════════════════════
// node-smoke-timebase-swift-parity — MS-16.1
// ═══════════════════════════════════════════════════════════
// Espelha 1:1 os smokes TB-01..TB-12 em
// ios/p1fast-core/Sources/P1FastSmoke/main.swift.
//
// Constantes numéricas IDÊNTICAS aos asserts Swift. Cada caso aqui
// (TPB-XX) produz o mesmo resultado em ambas implementações JS e Swift —
// paridade verificável por code review + saída numérica do CI.
//
// docs/COMMAND_BOX_ENGENHARIA.md §1.1 e §5.1.
// docs/PLANO_FASE_1.md §6 MS-16 task 16.1.

import { TelemetryTimebase, DEFAULT_FRESHNESS_MS } from '../src/telemetry/timebase.js';
import { Quality, fromSignalQuality } from '../src/domain/data-quality.js';

let ok = 0;
let fail = 0;

function step(name, body) {
  try {
    body();
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.log(`✗ ${name} — ${err.message || err}`);
    fail++;
  }
}

function assertEq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} — esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`);
}
function assertClose(a, b, tol = 0.001, msg = '') {
  if (a == null) throw new Error(`${msg} — recebeu null`);
  if (Math.abs(a - b) > tol) throw new Error(`${msg} — ${a} ≠ ${b} (tol ${tol})`);
}
function assertTrue(cond, msg = 'assert false') {
  if (!cond) throw new Error(msg);
}

/**
 * Normaliza quality JS pra Quality canônica.
 * Timebase JS legacy guarda signalQuality cru ('GOOD') no campo `quality` —
 * Swift port normaliza via Sample.quality computed property. Esta função
 * fecha o gap pra paridade semântica em comparações.
 */
function qNorm(raw) {
  if (raw == null) return Quality.MISSING;
  return fromSignalQuality(raw);
}

// ── Helpers de fixture — IDÊNTICOS aos do Swift (TB-XX) ─────────────

function tbT4000Sample(tMono, t = 1_700_000_000_000) {
  return {
    t,
    tMono,
    source: 't4000',
    signalQuality: 'GOOD',
    rpm: 5800,
    tps: 60,
    map: 0.92,
    lambda: 1.06,
    water_temp: 102,
    oil_temp: 118,
    oil_pressure: 4.0,
    battery_voltage: 13.8,
  };
}

function tbGpsSample(tMono, acc = 3) {
  return {
    t: 1_700_000_000_000,
    tMono,
    source: 'cockpit-mobile',
    signalQuality: 'GOOD',
    lat: -15.77,
    lng: -47.90,
    speed: 23.0,
    kmh: 82.8,
    acc,
  };
}

function tbImuSample(tMono, signalQuality = 'GOOD') {
  return {
    t: 1_700_000_000_000,
    tMono,
    source: 'iphone-imu',
    signalQuality,
    accLong: 1.2,
    accLat: 0.3,
    accVert: 0.0,
    gyroAlpha: 0.0,
  };
}

// ── TPB-01: attach + ingest single sample ─────────────────────

step('TPB-01: attach + ingest single sample → snapshot reflete fonte', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  const res = tb.ingest(tbT4000Sample(1000));
  assertEq(qNorm(res.quality), Quality.OK);
  assertEq(res.accepted, true);
  const snap = tb.snapshotAt(1000);
  assertClose(snap.engine.rpm, 5800);
  assertClose(snap.engine.map, 0.92);
  assertClose(snap.engine.lambda, 1.06);
  assertEq(qNorm(snap.quality.t4000_quality), Quality.OK);
});

// ── TPB-02: multi-source consolidation ─────────────────────────

step('TPB-02: multi-source — t4000 + cockpit-mobile + iphone-imu consolidam', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.attachSource({ source: 'cockpit-mobile' });
  tb.attachSource({ source: 'iphone-imu' });
  // Timings escolhidos pra todas as 3 fontes ficarem dentro da freshness no
  // snapshot @1200: t4000 (50ms) @1190 → delta 10; cockpit (1500ms) @1100 →
  // delta 100; imu (200ms) @1180 → delta 20. Todas OK → sync OK → Alta.
  tb.ingest(tbT4000Sample(1190));
  tb.ingest(tbGpsSample(1100));
  tb.ingest(tbImuSample(1180));
  const snap = tb.snapshotAt(1200);
  assertClose(snap.engine.rpm, 5800);
  assertClose(snap.position.lat, -15.77);
  assertClose(snap.dynamics.accel_longitudinal, 1.2);
  assertEq(qNorm(snap.quality.sync_quality), Quality.OK);
  assertEq(snap.quality.confidence, 'Alta');
});

// ── TPB-03: out-of-order detection ────────────────────────────

step('TPB-03: out-of-order — segundo tMono retroativo aceito + marcado', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  const r1 = tb.ingest(tbT4000Sample(2000));
  assertEq(qNorm(r1.quality), Quality.OK);
  const r2 = tb.ingest(tbT4000Sample(1500));
  assertEq(r2.quality, Quality.OUT_OF_ORDER);
  assertEq(r2.accepted, true);
  const stats = tb.sourceStatus()['t4000'];
  assertEq(stats.discardedOutOfOrder, 1);
});

// ── TPB-04: duplicate detection ───────────────────────────────

step('TPB-04: duplicate — mesmo tMono descartado, accepted=false', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.ingest(tbT4000Sample(2000));
  const r2 = tb.ingest(tbT4000Sample(2000));
  assertEq(r2.quality, Quality.DUPLICATE);
  assertEq(r2.accepted, false);
  const stats = tb.sourceStatus()['t4000'];
  assertEq(stats.discardedDuplicate, 1);
});

// ── TPB-05: LATE detection ────────────────────────────────────

step('TPB-05: late — idade entre freshness e 3×freshness → LATE', () => {
  // t4000 freshness default = 50; LATE quando 50 < idade ≤ 150
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.ingest(tbT4000Sample(1000));
  const snap = tb.snapshotAt(1080);   // 80 ms idade
  assertEq(snap.quality.t4000_quality, Quality.LATE);
});

// ── TPB-06: MISSING detection ─────────────────────────────────

step('TPB-06: missing — idade > 3×freshness → MISSING', () => {
  // t4000 freshness default = 50; MISSING quando idade > 150
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.ingest(tbT4000Sample(1000));
  const snap = tb.snapshotAt(1200);   // 200 ms idade
  assertEq(snap.quality.t4000_quality, Quality.MISSING);
});

// ── TPB-07: auto-attach ───────────────────────────────────────

step('TPB-07: mock source — auto-attach quando ingere sem attach prévio', () => {
  const tb = new TelemetryTimebase();
  assertEq(tb.sources.size, 0);
  tb.ingest(tbT4000Sample(1000));
  assertEq(tb.sources.size, 1);
  // freshness default deve ter sido aplicada (t4000 = 50)
  assertEq(tb.sources.get('t4000').freshness, DEFAULT_FRESHNESS_MS.t4000);
});

// ── TPB-08: counters discardedOutOfOrder + discardedDuplicate ─

step('TPB-08: stats — counters discardedOutOfOrder + discardedDuplicate', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.ingest(tbT4000Sample(1000));
  tb.ingest(tbT4000Sample(800));   // out-of-order
  tb.ingest(tbT4000Sample(600));   // out-of-order
  tb.ingest(tbT4000Sample(1000));  // duplicate
  const stats = tb.sourceStatus()['t4000'];
  assertEq(stats.discardedOutOfOrder, 2);
  assertEq(stats.discardedDuplicate, 1);
});

// ── TPB-09: buffer GC ─────────────────────────────────────────

step('TPB-09: buffer GC — amostras > 10000ms descartadas', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 'mock' });
  tb.ingest({ t: 0, tMono: 1000,  source: 'mock', signalQuality: 'GOOD', accLong: 0.5 });
  tb.ingest({ t: 0, tMono: 5000,  source: 'mock', signalQuality: 'GOOD', accLong: 0.7 });
  tb.ingest({ t: 0, tMono: 15000, source: 'mock', signalQuality: 'GOOD', accLong: 0.9 });
  // cutoff = 15000 - 10000 = 5000.
  // while buffer[0].tMono < cutoff: 1000<5000 yes drop; 5000<5000 no stop.
  // Resultado: 2 amostras (tMono 5000 e 15000).
  const stats = tb.sourceStatus()['mock'];
  assertEq(stats.bufferSize, 2);
});

// ── TPB-10: worstOf consolidation ─────────────────────────────

step('TPB-10: snapshot quality consolidada — worstOf de fontes', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });          // freshness 50
  tb.attachSource({ source: 'cockpit-mobile' }); // freshness 1500
  tb.ingest(tbT4000Sample(1000));                // delta 200 → MISSING
  tb.ingest(tbGpsSample(1180));                  // delta 20 → OK
  const snap = tb.snapshotAt(1200);
  assertEq(qNorm(snap.quality.t4000_quality), Quality.MISSING);
  assertEq(qNorm(snap.quality.iphone_quality), Quality.OK);   // cockpit-mobile vai pra iphone_quality (snapshot.js)
  assertEq(qNorm(snap.quality.sync_quality), Quality.MISSING);
  assertEq(snap.quality.confidence, 'Baixa');
});

// ── TPB-11: detach ────────────────────────────────────────────

step('TPB-11: detach remove fonte do snapshot', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  tb.attachSource({ source: 'cockpit-mobile' });
  tb.ingest(tbT4000Sample(1050));
  tb.ingest(tbGpsSample(1050));
  tb.detachSource('t4000');
  assertEq(tb.sources.size, 1);
  const snap = tb.snapshotAt(1100);
  assertEq(snap.engine.rpm, null);
  assertClose(snap.position.lat, -15.77);
});

// ── TPB-12: jitter / latencyMedian ────────────────────────────

step('TPB-12: jitter — janela LATENCY_WINDOW', () => {
  const tb = new TelemetryTimebase();
  tb.attachSource({ source: 't4000' });
  // Intervalos constantes 10 → jitter ≈ 0
  tb.ingest(tbT4000Sample(1000));
  tb.ingest(tbT4000Sample(1010));
  tb.ingest(tbT4000Sample(1020));
  tb.ingest(tbT4000Sample(1030));
  const s1 = tb.sourceStatus()['t4000'];
  assertClose(s1.jitter, 0, 0.001);
  // Spike de 100 → jitter > 10
  tb.ingest(tbT4000Sample(1130));
  const s2 = tb.sourceStatus()['t4000'];
  assertTrue(s2.jitter > 10, 'jitter deve refletir intervalo anômalo');
});

// ── Relatório ─────────────────────────────────────────────────

console.log('');
console.log('═══ RESULTADO ═══');
console.log(`${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
