// Smoke do LiveDataBridge (MS-13.4 parte 2) — T4000 → CockpitState.
// Spec: PLANO_FASE_1.md §6 MS-13.4 + ADR-023 amendment 2 (Flávio 2026-05-09)
// Implementação: web/cockpit/live-data-bridge.js

import {
  LiveDataBridge,
  DEFAULT_LIMITS,
  rpmToShift,
  checkCriticalAlerts,
} from '../web/cockpit/live-data-bridge.js';

import {
  CockpitState,
  ShiftMode,
  MsgTipo,
} from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

const FRESH_T4000 = (overrides = {}) => ({
  rpm: 3000,
  speedKmh: 80,
  oilPressBar: 4.0,
  oilTempC: 80,
  waterTempC: 80,
  fuelPressBar: 4.0,
  batteryV: 12.5,
  tpsPct: 30,
  mapBar: 1.0,
  airTempC: 30,
  egtC: 600,
  egtOutOfRange: false,
  lambda: 0.95,
  fuelTempC: 50,
  marcha: 3,
  ecuErrorBits: 0,
  tMono: 1234,
  checksumOk: true,
  ...overrides,
});

// ── rpmToShift puro ──────────────────────────────────────

t('LDB-01 rpmToShift: < 50% redline → OFF', () => {
  const r = rpmToShift(3000); // 3000/7500 = 40%
  if (r.mode !== ShiftMode.OFF) throw new Error();
  if (r.level !== 0) throw new Error();
});

t('LDB-02 rpmToShift: 50% redline → LIT level 1', () => {
  const r = rpmToShift(3750); // 50%
  if (r.mode !== ShiftMode.LIT) throw new Error();
  if (r.level < 1) throw new Error();
});

t('LDB-03 rpmToShift: 95% redline → FIRE', () => {
  const r = rpmToShift(7125); // 95%
  if (r.mode !== ShiftMode.FIRE) throw new Error();
});

t('LDB-04 rpmToShift: > redline → OVERREV', () => {
  const r = rpmToShift(7800);
  if (r.mode !== ShiftMode.OVERREV) throw new Error();
});

t('LDB-05 rpmToShift: 70% redline → LIT level no meio do range', () => {
  const r = rpmToShift(5250); // 70%
  if (r.mode !== ShiftMode.LIT) throw new Error();
  if (r.level < 2 || r.level > 5) throw new Error(`level ${r.level} fora do meio`);
});

t('LDB-06 rpmToShift: NaN/negativo/string → OFF (defensive)', () => {
  for (const bad of [NaN, -100, 'x', null, undefined]) {
    const r = rpmToShift(bad);
    if (r.mode !== ShiftMode.OFF) throw new Error(`bad ${bad}`);
  }
});

t('LDB-07 rpmToShift respeita redlineRpm injetado', () => {
  const r = rpmToShift(8500, { ...DEFAULT_LIMITS, redlineRpm: 9000 });
  // 8500/9000 = 94.4% < 95% fire threshold → LIT
  if (r.mode !== ShiftMode.LIT) throw new Error();
});

// ── checkCriticalAlerts puro ────────────────────────────

t('LDB-08 checkCriticalAlerts: erro ECU != 0 → grave Erro ECU', () => {
  const a = checkCriticalAlerts(FRESH_T4000({ ecuErrorBits: 0x0005 }));
  if (!a) throw new Error('deveria alertar');
  if (a.tipo !== MsgTipo.GRAVE) throw new Error('tipo');
  if (!/erro ecu/i.test(a.texto)) throw new Error(`texto ${a.texto}`);
});

t('LDB-09 checkCriticalAlerts: prioridade — erro ECU vence outras condições', () => {
  const a = checkCriticalAlerts(FRESH_T4000({
    ecuErrorBits: 0x0001,
    waterTempC: 130, // tb crítico, mas ECU vence
  }));
  if (!/erro ecu/i.test(a.texto)) throw new Error('ECU deveria ter prioridade');
});

t('LDB-10 checkCriticalAlerts: água acima do limite → grave', () => {
  const a = checkCriticalAlerts(FRESH_T4000({ waterTempC: 115 }));
  if (!a || !/temperatura .*gua/i.test(a.texto)) throw new Error();
});

t('LDB-11 checkCriticalAlerts: óleo > 130 → grave', () => {
  const a = checkCriticalAlerts(FRESH_T4000({ oilTempC: 135 }));
  if (!a || !/temperatura .*leo/i.test(a.texto)) throw new Error();
});

t('LDB-12 checkCriticalAlerts: pressão óleo baixa só dispara com RPM > 2000', () => {
  // RPM baixo → não alerta
  const aLow = checkCriticalAlerts(FRESH_T4000({ rpm: 1500, oilPressBar: 0.3 }));
  if (aLow) throw new Error('não deveria alertar com RPM baixo');
  // RPM alto → alerta
  const aHigh = checkCriticalAlerts(FRESH_T4000({ rpm: 4000, oilPressBar: 0.3 }));
  if (!aHigh || !/press.*o.*leo/i.test(aHigh.texto)) throw new Error();
});

t('LDB-13 checkCriticalAlerts: EGT out of range → grave', () => {
  const a = checkCriticalAlerts(FRESH_T4000({ egtOutOfRange: true }));
  if (!a || !/egt/i.test(a.texto)) throw new Error();
});

t('LDB-14 checkCriticalAlerts: tudo OK → null', () => {
  const a = checkCriticalAlerts(FRESH_T4000());
  if (a !== null) throw new Error(`esperava null, recebeu ${JSON.stringify(a)}`);
});

t('LDB-15 checkCriticalAlerts: checksumOk=false → null (não interpreta)', () => {
  const a = checkCriticalAlerts(FRESH_T4000({ checksumOk: false, ecuErrorBits: 0xFFFF }));
  if (a !== null) throw new Error('checksum ruim deveria descartar');
});

// ── LiveDataBridge — integração T4000 → CockpitState ────

t('LDB-16 ingestT4000 com RPM 7200 (96%) → cockpit.shift.mode=FIRE', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ rpm: 7200 }));
  if (cs.get().shift.mode !== ShiftMode.FIRE) throw new Error();
});

t('LDB-17 ingestT4000 com RPM 5000 (66%) → cockpit.shift.mode=LIT, level médio', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ rpm: 5000 }));
  const s = cs.get().shift;
  if (s.mode !== ShiftMode.LIT) throw new Error('mode');
  if (s.level < 1 || s.level > 6) throw new Error(`level ${s.level}`);
});

t('LDB-18 ingestT4000 com erro ECU → cockpit.message=GRAVE Erro ECU', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ ecuErrorBits: 0x0001 }));
  const m = cs.get().message;
  if (!m) throw new Error('sem message');
  if (m.tipo !== MsgTipo.GRAVE) throw new Error();
  if (!/erro ecu/i.test(m.texto)) throw new Error();
});

t('LDB-19 ingestT4000 com alerta resolvido → cockpit.message volta a null', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ ecuErrorBits: 0x0001 })); // alerta
  if (!cs.get().message) throw new Error('alerta não setou');
  b.ingestT4000(FRESH_T4000({ ecuErrorBits: 0 })); // resolveu
  if (cs.get().message !== null) throw new Error('alerta não limpou');
});

t('LDB-20 ingestT4000 não dispara showMessage repetida com mesmo alerta', () => {
  const cs = new CockpitState();
  let messageChanges = 0;
  cs.onChange((cur, prev, keys) => { if (keys.includes('message')) messageChanges++; });
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ waterTempC: 115 }));
  b.ingestT4000(FRESH_T4000({ waterTempC: 116 })); // mesmo alerta semântico
  b.ingestT4000(FRESH_T4000({ waterTempC: 117 }));
  if (messageChanges !== 1) throw new Error(`esperado 1 trigger, recebeu ${messageChanges}`);
});

t('LDB-21 ingestT4000 com checksumOk=false não atualiza shift nem alerta', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000({ checksumOk: false, rpm: 7800, ecuErrorBits: 0xFFFF }));
  if (cs.get().shift.mode !== ShiftMode.OFF) throw new Error('shift mexeu com check ruim');
  if (cs.get().message !== null) throw new Error('alerta saiu de check ruim');
});

t('LDB-22 ingestImuGps armazena payload pra detector (MS-13.5)', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestImuGps({
    tMono: 100,
    source: 'iphone-imu',
    payload: { x: 12, y: 34, accLong: 0.5, accLat: -0.2, speedKmh: 90 },
  });
  const last = b.getLastImuGps();
  if (!last || last.x !== 12) throw new Error('imu não armazenou');
});

t('LDB-23 ingestImuGps com source diferente é ignorado', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestImuGps({ tMono: 1, source: 'heartbeat', payload: null });
  if (b.getLastImuGps() !== null) throw new Error('heartbeat não deveria armazenar');
});

t('LDB-24 stats expõe contadores', () => {
  const cs = new CockpitState();
  const b = new LiveDataBridge({ cockpitState: cs });
  b.ingestT4000(FRESH_T4000());
  b.ingestT4000(FRESH_T4000({ ecuErrorBits: 1 }));
  b.ingestT4000(FRESH_T4000({ ecuErrorBits: 0 }));
  b.ingestImuGps({ tMono: 1, source: 'iphone-imu', payload: { x: 0, y: 0 } });
  const s = b.getStats();
  if (s.t4000Count !== 3) throw new Error('t4000Count');
  if (s.imuGpsCount !== 1) throw new Error('imuGpsCount');
  if (s.alertsRaised !== 1) throw new Error('alertsRaised');
  if (s.alertsCleared !== 1) throw new Error('alertsCleared');
});

t('LDB-25 onEvent recebe alert-raised e alert-cleared', () => {
  const cs = new CockpitState();
  const events = [];
  const b = new LiveDataBridge({ cockpitState: cs, onEvent: (s, i) => events.push({ s, i }) });
  b.ingestT4000(FRESH_T4000({ waterTempC: 120 }));
  b.ingestT4000(FRESH_T4000({ waterTempC: 80 }));
  if (!events.some(e => e.s === 'alert-raised')) throw new Error();
  if (!events.some(e => e.s === 'alert-cleared')) throw new Error();
});

t('LDB-26 LiveDataBridge exige cockpitState no construtor', () => {
  let threw = false;
  try { new LiveDataBridge({}); } catch { threw = true; }
  if (!threw) throw new Error();
});

console.log(`\nLiveDataBridge: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
