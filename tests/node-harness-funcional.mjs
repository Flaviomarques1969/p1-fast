// ═══════════════════════════════════════════════════════════
// Harness funcional end-to-end — sessão de teste 2026-05-01
// ═══════════════════════════════════════════════════════════
// Objetivo: validar o fluxo real "criar autódromo → carro → 2 stints
// com comportamentos opostos" exercitando o pipeline real:
//   • Persistência Dexie (Tracks, TrackLayouts, TrackSegments,
//     Cars, Sessions, StintPlans, Users)
//   • CriticalRulesEngine (deve disparar BOX_AGORA em stint ATAQUE,
//     ficar quieto em stint CONSISTÊNCIA)
//   • CrossValidationEngine (V-001 quando speed_can ≠ speed_gnss)
//   • buildSnapshot consumindo IMU (accLong/accLat) + GPS + Engine
//   • Reload do DB e leitura idempotente
//
// Não substitui os 12 smokes — exercita o domínio + telemetria
// num cenário ALÉM do escopo dos smokes.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen: { width: 390, height: 844 }, devicePixelRatio: 3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s: new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { db } = await import('../src/core/db.js');
const { Users } = await import('../src/domain/user.js');
const { Cars } = await import('../src/domain/car.js');
const { Tracks } = await import('../src/domain/track.js');
const { TrackLayouts } = await import('../src/domain/track-layout.js');
const { TrackSegments } = await import('../src/domain/track-segment.js');
const { Sessions, SessionTipo } = await import('../src/domain/session.js');
const { StintPlans, Abordagem, FocusModeOrigem } = await import('../src/domain/stint-plan.js');
const { seedBrasilia } = await import('../src/domain/seed-tracks.js');
const { buildSnapshot } = await import('../src/telemetry/snapshot.js');
const { CriticalRulesEngine, AlertLevel } = await import('../src/pipeline/critical-rules.js');
const { CrossValidationEngine } = await import('../src/telemetry/cross-validation.js');
const { Quality } = await import('../src/domain/data-quality.js');

await db.open();

// ── runtime helpers ──────────────────────────────────────────
let ok = 0, fail = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    ok++;
    results.push({ name, status: 'PASS' });
  } catch (e) {
    console.log(`✗ ${name}\n   → ${e.message}`);
    fail++;
    results.push({ name, status: 'FAIL', err: e.message });
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'eq'}: esperado ${b}, recebido ${a}`); };

// ── helpers de telemetria sintética ──────────────────────────
// IMU em m/s² (não em g). buildSnapshot lê accLong/accLat direto do sample.
function imu({ longMs2 = 0, latMs2 = 0 } = {}) {
  return { sample: { accLong: longMs2, accLat: latMs2, accVert: 0 }, quality: Quality.OK, ageMs: 5 };
}
function gps({ lat = -15.77000, lng = -47.90000, kmh = 90 } = {}) {
  // speed em m/s (CoreLocation/Geolocation API)
  return { sample: { lat, lng, x: 410, y: 707, speed: kmh / 3.6 }, quality: Quality.OK, ageMs: 5 };
}
function engine({ rpm = 5500, oilPressure = 4.2, waterTemp = 92, kmh = 90, kmhCanOffset = 0 } = {}) {
  return {
    sample: {
      rpm, tps: 60, map: 0.7, lambda: 0.92,
      oil_pressure: oilPressure,
      water_temp: waterTemp,
      battery_voltage: 13.8,
      fuel_pressure: 3.0,
      // speed_can em m/s (canônico — pickVehicle lê s.speed_can)
      speed_can: (kmh + kmhCanOffset) / 3.6,
    },
    quality: Quality.OK,
    ageMs: 5,
  };
}

// ════════════════════════════════════════════════════════════
// FASE 1 — bootstrap (User + autódromo Brasília)
// ════════════════════════════════════════════════════════════

let user, brasiliaTrack, brasiliaLayout, brasiliaSegments;

await step('B-01: usuário primary criado / lido', async () => {
  user = await Users.getOrCreatePrimary();
  assert(user.id === 'usr_primary', 'id esperado=usr_primary');
});

await step('B-02: seedBrasilia cadastra autódromo (idempotente)', async () => {
  const r1 = await seedBrasilia();
  assert(r1.criado === true, 'primeira execução deve criar');
  brasiliaTrack = r1.track;
  brasiliaLayout = r1.layout;
  // segunda chamada → não recria
  const r2 = await seedBrasilia();
  assert(r2.criado === false, 'segunda execução deve detectar existente');
});

await step('B-03: Brasília persiste com 4 parciais + linha de chegada', async () => {
  const got = await Tracks.getByApelido('Brasília');
  assert(got != null, 'Brasília deve existir');
  eq(got.apelido, 'Brasília', 'apelido');
  eq(got.numeroCurvas, 8, 'numeroCurvas');
  eq(got.sentido, 'anti-horário', 'sentido');
  const layouts = await TrackLayouts.listByTrack(got.id);
  assert(layouts.length === 1, 'um layout');
  eq(layouts[0].parciais.length, 4, '4 parciais');
  brasiliaLayout = layouts[0];
});

await step('B-04: Brasília tem 8 trechos (curvas) + 4 retas, com apex calibration default', async () => {
  brasiliaSegments = await TrackSegments.listByLayout(brasiliaLayout.id);
  eq(brasiliaSegments.length, 12, 'total segmentos');
  const curvas = brasiliaSegments.filter(s => s.ehTrecho);
  const retas = brasiliaSegments.filter(s => !s.ehTrecho);
  eq(curvas.length, 8, 'curvas');
  eq(retas.length, 4, 'retas');
  // todos os trechos têm apexReference
  for (const c of curvas) {
    assert(c.apexReference && Number.isFinite(c.apexReference.x), `${c.nome} sem apexReference`);
    assert(c.apexStrategy, `${c.nome} sem apexStrategy`);
    assert(c.cornerType, `${c.nome} sem cornerType`);
    eq(c._apex_calibration, 'DEFAULT', `${c.nome} apex_calibration`);
  }
});

// ════════════════════════════════════════════════════════════
// FASE 2 — Garagem (Celta 1.4 turismo)
// ════════════════════════════════════════════════════════════

let celta;

await step('C-01: cadastra Celta 1.4 na garagem', async () => {
  celta = await Cars.create({
    userId: user.id,
    nome: 'Celta',
    marca: 'Chevrolet',
    modelo: 'Celta 1.4',
    ano: 2008,
    categoria: 'Turismo',
    cor: 'amarelo',
  });
  assert(celta.id?.startsWith('car_'), 'id Car');
});

await step('C-02: lista de carros do usuário tem só o Celta', async () => {
  const list = await Cars.list(user.id);
  eq(list.length, 1, 'um carro');
  eq(list[0].id, celta.id, 'carro listado');
});

// ════════════════════════════════════════════════════════════
// FASE 3 — STINT 1 (ATAQUE) com 1 problema crítico
// ════════════════════════════════════════════════════════════

let stintAtaque, planAtaque;
const alertasAtaque = [];
const xvalAtaque = [];

await step('S1-01: cria Session ATAQUE (treino livre, Brasília)', async () => {
  stintAtaque = await Sessions.create({
    userId: user.id,
    carId: celta.id,
    trackId: brasiliaTrack.id,
    tipoSessao: SessionTipo.TREINO_LIVRE,
    clima: 'seco',
    temperaturaAr: 28,
    temperaturaPista: 38,
    notas: 'Stint sintético — atacar volta rápida',
  });
  assert(stintAtaque.id?.startsWith('ses_'));
});

await step('S1-02: cria StintPlan ATAQUE (meta + abordagem agressiva + foco no Placar e S)', async () => {
  const placar = brasiliaSegments.find(s => s.nome === 'CURVA DO PLACAR');
  const curvaS = brasiliaSegments.find(s => s.nome === 'CURVA "S"');
  planAtaque = await StintPlans.create({
    sessionId: stintAtaque.id,
    meta: 'Atacar volta rápida',
    abordagem: Abordagem.AGRESSIVA,
    trechosFoco: [placar.id, curvaS.id],
    focusModeOrigem: FocusModeOrigem.PILOTO,
    nVoltasAlvo: 5,
    notas: 'Ataque — buscar PB',
  });
  assert(planAtaque.id, 'StintPlan id');
  eq(planAtaque.trechosFoco.length, 2, 'dois trechos foco');
});

await step('S1-03: pipeline ATAQUE — óleo despressuriza → BOX_AGORA + V-001 (CAN vs GNSS diverge)', async () => {
  const critical = new CriticalRulesEngine({ onAlert: a => alertasAtaque.push(a) });
  const xval = new CrossValidationEngine({ onEvent: ev => xvalAtaque.push(ev) });

  // 5 voltas × 10 amostras a 10Hz. IMU constante coerente com velocidade quase
  // constante → V-002 (IMU vs derivada speed) NÃO dispara nas voltas normais.
  const N_VOLTAS = 5;
  const AMOSTRAS_POR_VOLTA = 10;
  let tMono = 0;
  const KMH_NOMINAL = 90;

  for (let lap = 1; lap <= N_VOLTAS; lap++) {
    for (let i = 0; i < AMOSTRAS_POR_VOLTA; i++) {
      tMono += 100;
      // Cenário 1 (crítico): volta 3 amostra 4 → óleo cai pra 0.6 bar com RPM alto
      const oleoCritico = (lap === 3 && i === 4);
      // Cenário 2 (V-001): WindowState.enter exige strict > minMs (2000ms),
      // então amostras a 100ms precisam ≥ 21 consecutivas.
      // Janela: volta 3 amostras 5-9 + voltas 4 e 5 inteiras = 25 amostras = 2.5s. ✓
      const dispersao = (lap === 3 && i >= 5) || lap === 4 || lap === 5;
      const eng = engine({
        rpm: oleoCritico ? 5800 : 5500,
        oilPressure: oleoCritico ? 0.6 : 4.2,
        kmh: KMH_NOMINAL,
        kmhCanOffset: dispersao ? 12 : 0.4,  // V-001 dispara se diff > 5 km/h por 2s
      });
      const snap = buildSnapshot({
        tMono,
        sourcesData: {
          't4000': eng,
          'racebox-gnss': gps({ kmh: KMH_NOMINAL }),
          'iphone-imu': imu({ longMs2: 0, latMs2: 0 }),  // velocidade ~constante → derivada≈0
        },
      });
      critical.consume(snap);
      xval.consume(snap);
    }
  }

  const oleoAlerts = alertasAtaque.filter(a => a.id === 'press-oleo-baixa');
  assert(oleoAlerts.length >= 1, `esperava ≥1 alerta press-oleo-baixa, recebeu ${oleoAlerts.length}`);
  eq(oleoAlerts[0].nivel, AlertLevel.BOX_AGORA, 'nível BOX_AGORA');
  assert(oleoAlerts[0].quem_age === 'piloto', 'quem_age');
  assert(oleoAlerts[0].acao_imediata?.includes('Box agora'), 'acao_imediata');

  const v001 = xvalAtaque.filter(e => e.validation === 'V-001');
  assert(v001.length >= 1, `esperava ≥1 V-001, recebeu ${v001.length}`);
});

await step('S1-04: stint ATAQUE persiste e pode ser relido', async () => {
  const got = await Sessions.get(stintAtaque.id);
  assert(got, 'session lida');
  eq(got.tipoSessao, SessionTipo.TREINO_LIVRE, 'tipoSessao');
  eq(got.carId, celta.id, 'carId');
});

// ════════════════════════════════════════════════════════════
// FASE 4 — STINT 2 (CONSISTÊNCIA) sem alertas
// ════════════════════════════════════════════════════════════

let stintConsist, planConsist;
const alertasConsist = [];
const xvalConsist = [];

await step('S2-01: cria Session CONSISTÊNCIA', async () => {
  stintConsist = await Sessions.create({
    userId: user.id,
    carId: celta.id,
    trackId: brasiliaTrack.id,
    tipoSessao: SessionTipo.TREINO_LIVRE,
    clima: 'seco',
    temperaturaAr: 28,
    temperaturaPista: 36,
    notas: 'Stint sintético — consistência ±0.3s',
  });
});

await step('S2-02: cria StintPlan CONSISTÊNCIA (progressiva, sem trecho foco)', async () => {
  planConsist = await StintPlans.create({
    sessionId: stintConsist.id,
    meta: 'Consistência',
    abordagem: Abordagem.PROGRESSIVA,
    trechosFoco: [],
    focusModeOrigem: FocusModeOrigem.AUTO,
    nVoltasAlvo: 5,
    notas: 'Consistência — manter desvio < 0.4s',
  });
  eq(planConsist.abordagem, Abordagem.PROGRESSIVA, 'abordagem');
});

await step('S2-03: pipeline CONSISTÊNCIA — sem alertas críticos, sem V-001 nem V-002', async () => {
  const critical = new CriticalRulesEngine({ onAlert: a => alertasConsist.push(a) });
  const xval = new CrossValidationEngine({ onEvent: ev => xvalConsist.push(ev) });
  let tMono = 0;
  const KMH = 90;
  // Velocidade constante 90 km/h, IMU ~0, óleo nominal, CAN bate com GNSS (offset 0.4).
  for (let lap = 1; lap <= 5; lap++) {
    for (let i = 0; i < 10; i++) {
      tMono += 100;
      const eng = engine({ rpm: 5500, oilPressure: 4.2, waterTemp: 91, kmh: KMH, kmhCanOffset: 0.4 });
      const snap = buildSnapshot({
        tMono,
        sourcesData: {
          't4000': eng,
          'racebox-gnss': gps({ kmh: KMH }),
          'iphone-imu': imu({ longMs2: 0, latMs2: 0 }),
        },
      });
      critical.consume(snap);
      xval.consume(snap);
    }
  }
  eq(alertasConsist.length, 0, `0 alertas críticos esperado, recebido ${alertasConsist.length}`);
  const v001 = xvalConsist.filter(e => e.validation === 'V-001');
  eq(v001.length, 0, `0 V-001 esperado, recebido ${v001.length}`);
  const v002 = xvalConsist.filter(e => e.validation === 'V-002');
  eq(v002.length, 0, `0 V-002 esperado, recebido ${v002.length}`);
});

await step('S2-04: stint CONSISTÊNCIA persiste e StintPlan ativo é o último', async () => {
  const got = await Sessions.get(stintConsist.id);
  assert(got, 'session lida');
  const plan = await StintPlans.getAtivo(stintConsist.id);
  assert(plan && plan.id === planConsist.id, 'plano ativo');
});

// ════════════════════════════════════════════════════════════
// FASE 5 — Acelerômetro (IMU): mudança de fase via accLong
// ════════════════════════════════════════════════════════════

await step('IMU-01: snapshot consome accLong e accLat do iphone-imu', async () => {
  const snap = buildSnapshot({
    tMono: 100,
    sourcesData: {
      'iphone-imu': imu({ longMs2: -8.3, latMs2: 1.0 }),  // freio ~0.85g
      'racebox-gnss': gps({ kmh: 100 }),
    },
  });
  assert(snap.dynamics, 'dynamics presente');
  assert(snap.dynamics.accel_longitudinal < 0, `accel_longitudinal < 0, recebido ${snap.dynamics.accel_longitudinal}`);
  assert(snap.dynamics.accel_lateral > 0, `accel_lateral > 0, recebido ${snap.dynamics.accel_lateral}`);
});

await step('IMU-02: 4 fases distintas geram leituras coerentes (reta/freio/curva/acel)', async () => {
  const reta  = buildSnapshot({ tMono: 1, sourcesData: { 'iphone-imu': imu({ longMs2: 0.5, latMs2: 0.2 }),  'racebox-gnss': gps() } });
  const freio = buildSnapshot({ tMono: 2, sourcesData: { 'iphone-imu': imu({ longMs2: -8.3, latMs2: 1.0 }), 'racebox-gnss': gps() } });
  const curva = buildSnapshot({ tMono: 3, sourcesData: { 'iphone-imu': imu({ longMs2: -1.0, latMs2: 11.8 }),'racebox-gnss': gps() } });
  const acel  = buildSnapshot({ tMono: 4, sourcesData: { 'iphone-imu': imu({ longMs2: 5.4, latMs2: 1.5 }),  'racebox-gnss': gps() } });
  assert(Math.abs(reta.dynamics.accel_longitudinal) < 2.0, `reta ~0g, recebido ${reta.dynamics.accel_longitudinal}`);
  assert(freio.dynamics.accel_longitudinal < -5.0, `freio < -5 m/s² (~0.5g), recebido ${freio.dynamics.accel_longitudinal}`);
  assert(Math.abs(curva.dynamics.accel_lateral) > 5.0, `curva |lateral| > 5 m/s², recebido ${curva.dynamics.accel_lateral}`);
  assert(acel.dynamics.accel_longitudinal > 3.0, `acel > 3 m/s² (~0.3g), recebido ${acel.dynamics.accel_longitudinal}`);
});

// ════════════════════════════════════════════════════════════
// FASE 6 — Reload Dexie e validar persistência total
// ════════════════════════════════════════════════════════════

await step('R-01: fecha Dexie e reabre — Brasília + 12 segs + Celta + 2 stints + 2 planos persistem', async () => {
  await db.close();
  await db.open();
  const trk = await Tracks.getByApelido('Brasília');
  assert(trk, 'track persistida');
  const segs = await TrackSegments.listByLayout(brasiliaLayout.id);
  eq(segs.length, 12, 'segs persistidos');
  const cars = await Cars.list(user.id);
  eq(cars.length, 1, 'car persistido');
  const sess = await Sessions.list({ userId: user.id });
  assert(sess.length >= 2, `sessions ≥ 2, recebido ${sess.length}`);
  const plans = await db.stintPlans.toArray();
  assert(plans.length >= 2, `plans ≥ 2, recebido ${plans.length}`);
});

// ════════════════════════════════════════════════════════════
// FASE 7 — Pendências do stint (sem flicker quando relê)
// ════════════════════════════════════════════════════════════

await step('R-02: query Sessions.list por carId retorna 2 stints (ATAQUE + CONSIST)', async () => {
  const sess = await Sessions.list({ carId: celta.id });
  assert(sess.length >= 2, `2 sessions do Celta, recebido ${sess.length}`);
  const ids = sess.map(s => s.id);
  assert(ids.includes(stintAtaque.id), 'ATAQUE listada');
  assert(ids.includes(stintConsist.id), 'CONSIST listada');
});

// ── relatório final ──────────────────────────────────────────
console.log(`\n═══ RESULTADO ═══`);
console.log(`${ok} ok / ${fail} fail`);
console.log(`Alertas críticos no stint ATAQUE: ${alertasAtaque.length}`);
console.log(`Alertas críticos no stint CONSISTÊNCIA: ${alertasConsist.length}`);
console.log(`Eventos cross-validation no stint ATAQUE: ${xvalAtaque.length}`);
console.log(`Eventos cross-validation no stint CONSISTÊNCIA: ${xvalConsist.length}`);
process.exit(fail ? 1 : 0);
