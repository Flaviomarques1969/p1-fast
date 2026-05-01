// Smoke dedicado da CrossValidationEngine — V-001..V-011
// 4 cenários por validação: normal (não dispara), divergência (dispara),
// transitório (sai antes da janela mínima — não dispara), recovery (volta ao normal e
// estado de janela é resetado).
//
// docs/raceops/CROSS_VALIDATION_RULES.md governa.

import { CrossValidationEngine } from '../src/telemetry/cross-validation.js';
import { Quality } from '../src/domain/data-quality.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Helpers ────────────────────────────────────────────────────

function makeEngine() {
  const events = [];
  const engine = new CrossValidationEngine({ onEvent: (e) => events.push(e) });
  return { engine, events };
}

/** Builder de snapshot com defaults completos (todos os canais OK e suficientes). */
function snap(tMono, overrides = {}) {
  const base = {
    t: tMono, tMono,
    engine: {}, vehicle: {}, dynamics: {}, position: {},
    quality: {
      t4000_quality: Quality.OK,
      racebox_quality: Quality.OK,
      iphone_quality: Quality.OK,
      sync_quality: Quality.OK,
    },
  };
  return {
    ...base,
    ...overrides,
    engine:   { ...base.engine,   ...(overrides.engine   || {}) },
    vehicle:  { ...base.vehicle,  ...(overrides.vehicle  || {}) },
    dynamics: { ...base.dynamics, ...(overrides.dynamics || {}) },
    position: { ...base.position, ...(overrides.position || {}) },
    quality:  { ...base.quality,  ...(overrides.quality  || {}) },
  };
}

function feed(engine, fn, fromMs, toMs, stepMs = 100) {
  for (let tMono = fromMs; tMono < toMs; tMono += stepMs) {
    engine.consume(fn(tMono));
  }
}

function count(events, validation) {
  return events.filter((e) => e.validation === validation).length;
}

// ─── V-001 · speed CAN vs GNSS ─────────────────────────────

t('V-001 normal: CAN ≈ GNSS → não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30.5 },
  }), 1000, 4000);
  if (count(events, 'V-001') !== 0) throw new Error('emitiu sem divergência');
});

t('V-001 divergência: > 5 km/h por 2s+ → dispara 1×', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
  }), 1000, 4000);
  if (count(events, 'V-001') !== 1) throw new Error('count=' + count(events, 'V-001'));
});

t('V-001 transitório: divergência por 0.5s não dispara', () => {
  const { engine, events } = makeEngine();
  // 0.5s de divergência seguida de retorno
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
  }), 1000, 1500);
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30.2 },
  }), 1500, 3000);
  if (count(events, 'V-001') !== 0) throw new Error('disparou em transitório');
});

t('V-001 recovery: divergência → recovery → divergência futura → exit zerou janela', () => {
  const { engine, events } = makeEngine();
  // 1ª divergência (2.5s) → emite
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
  }), 1000, 3500);
  if (count(events, 'V-001') !== 1) throw new Error('1ª divergência não emitiu');
  // Recovery 1s
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30.2 },
  }), 3500, 4500);
  // Nova divergência por 0.5s — janela foi zerada no recovery; ainda não atinge 2s; não emite
  feed(engine, (tMono) => snap(tMono, {
    vehicle: { speed_can: 30, speed_gnss: 30 + 10 / 3.6 },
  }), 4500, 5000);
  if (count(events, 'V-001') !== 1) throw new Error('emitiu de novo dentro do cooldown');
});

// ─── V-002 · IMU long vs derivada da velocidade ────────────

t('V-002 normal: IMU long ≈ derivada → não dispara', () => {
  const { engine, events } = makeEngine();
  let prevSpeed = 20;
  feed(engine, (tMono) => {
    const speed = prevSpeed + 0.1; // dt=100ms → derivada=1 m/s², IMU=1
    prevSpeed = speed;
    return snap(tMono, {
      dynamics: { accel_longitudinal: 1.0 },
      vehicle: { speed_fused: speed },
    });
  }, 1000, 3000);
  if (count(events, 'V-002') !== 0) throw new Error('disparou sem divergência');
});

t('V-002 divergência: IMU 5 m/s² mas velocidade não muda → dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 5.0 },
    vehicle: { speed_fused: 25 },
  }), 1000, 3000);
  if (count(events, 'V-002') !== 1) throw new Error('count=' + count(events, 'V-002'));
});

t('V-002 transitório: divergência só por 0.5s não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 5.0 },
    vehicle: { speed_fused: 25 },
  }), 1000, 1500);
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 0.0 },
    vehicle: { speed_fused: 25 },
  }), 1500, 3000);
  if (count(events, 'V-002') !== 0) throw new Error('disparou em transitório');
});

t('V-002 recovery: após divergência+recovery+divergência <1s, não reemite', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 5.0 }, vehicle: { speed_fused: 25 },
  }), 1000, 2500);
  if (count(events, 'V-002') !== 1) throw new Error('1ª não emitiu');
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 0.0 }, vehicle: { speed_fused: 25 },
  }), 2500, 3500);
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { accel_longitudinal: 5.0 }, vehicle: { speed_fused: 25 },
  }), 3500, 4000);  // só 0.5s — não atinge 1s
  if (count(events, 'V-002') !== 1) throw new Error('reemitiu sem janela completa');
});

// ─── V-003 · TPS × MAP × accel ─────────────────────────────

t('V-003 normal: TPS alto, MAP alto, ganho de aceleração → não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.95 },
    dynamics: { accel_longitudinal: 3.0 },
  }), 1000, 3000);
  if (count(events, 'V-003') !== 0) throw new Error('disparou em condição saudável');
});

t('V-003 divergência: TPS>80 + MAP<0.6 + acc<1 por 0.5s+ → dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.4 },
    dynamics: { accel_longitudinal: 0.2 },
  }), 1000, 2000);
  if (count(events, 'V-003') !== 1) throw new Error('count=' + count(events, 'V-003'));
});

t('V-003 transitório: divergência só por 0.2s não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.4 }, dynamics: { accel_longitudinal: 0.2 },
  }), 1000, 1200);
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.95 }, dynamics: { accel_longitudinal: 3.0 },
  }), 1200, 3000);
  if (count(events, 'V-003') !== 0) throw new Error('disparou em transitório');
});

t('V-003 recovery: emite 1×, recupera, nova divergência curta não reemite', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.4 }, dynamics: { accel_longitudinal: 0.2 },
  }), 1000, 2000);
  if (count(events, 'V-003') !== 1) throw new Error('não emitiu 1ª');
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 30, map: 0.5 }, dynamics: { accel_longitudinal: 0 },
  }), 2000, 3000);
  feed(engine, (tMono) => snap(tMono, {
    engine: { tps: 90, map: 0.4 }, dynamics: { accel_longitudinal: 0.2 },
  }), 3000, 3300); // só 0.3s — janela exige 0.5s
  if (count(events, 'V-003') !== 1) throw new Error('reemitiu antes da nova janela completar');
});

// ─── V-004 · RPM × marcha × velocidade ─────────────────────

t('V-004 normal: 4ª marcha em ~5000 RPM → ~175 km/h, sem divergência', () => {
  const { engine, events } = makeEngine();
  // gearMap default: 4ª = 35 km/h por 1000 RPM. 5000 RPM → 175 km/h ≈ 48.6 m/s
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 },
    vehicle: { speed_fused: 48.6 },
  }), 1000, 3000);
  if (count(events, 'V-004') !== 0) throw new Error('disparou em condição saudável');
});

t('V-004 divergência: rpm/gear/speed inconsistente por 1s+ → dispara', () => {
  const { engine, events } = makeEngine();
  // 4ª em 5000 RPM esperado 48.6 m/s; carro a 25 m/s → erro ~50%
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 },
    vehicle: { speed_fused: 25 },
  }), 1000, 3000);
  if (count(events, 'V-004') !== 1) throw new Error('count=' + count(events, 'V-004'));
});

t('V-004 transitório: divergência só por 0.5s não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 }, vehicle: { speed_fused: 25 },
  }), 1000, 1500);
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 }, vehicle: { speed_fused: 48.6 },
  }), 1500, 3000);
  if (count(events, 'V-004') !== 0) throw new Error('disparou em transitório');
});

t('V-004 recovery: rpm < 1500 zera janela', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 }, vehicle: { speed_fused: 25 },
  }), 1000, 1700); // 0.7s
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 1000, gear: 1 }, vehicle: { speed_fused: 5 },
  }), 1700, 2500); // janela exit por rpm<1500
  feed(engine, (tMono) => snap(tMono, {
    engine: { rpm: 5000, gear: 4 }, vehicle: { speed_fused: 25 },
  }), 2500, 3000); // só 0.5s — janela zerada
  if (count(events, 'V-004') !== 0) throw new Error('emitiu sem janela completa');
});

// ─── V-005 · Water temp slope ──────────────────────────────

t('V-005 normal: temperatura estável → não dispara', () => {
  const { engine, events } = makeEngine();
  // 5min de history a 90°C constante
  feed(engine, (tMono) => snap(tMono, {
    engine: { water_temp: 90 },
  }), 0, 6 * 60_000, 1000);
  if (count(events, 'V-005') !== 0) throw new Error('disparou em estável');
});

t('V-005 divergência: slope > 0.5°C/min por > 60s → dispara', () => {
  const { engine, events } = makeEngine();
  // Sobe 1°C/min por 6 min começando em 80°C
  feed(engine, (tMono) => snap(tMono, {
    engine: { water_temp: 80 + (tMono / 60_000) * 1.0 },
  }), 0, 6 * 60_000, 1000);
  if (count(events, 'V-005') < 1) throw new Error('count=' + count(events, 'V-005'));
});

t('V-005 transitório: spike curto (10s) não dispara', () => {
  const { engine, events } = makeEngine();
  // 5min normais a 90°C
  feed(engine, (tMono) => snap(tMono, {
    engine: { water_temp: 90 },
  }), 0, 5 * 60_000, 1000);
  // 10s subindo, depois volta
  feed(engine, (tMono) => snap(tMono, {
    engine: { water_temp: 90 + (tMono - 5 * 60_000) / 1000 },
  }), 5 * 60_000, 5 * 60_000 + 10_000, 1000);
  if (count(events, 'V-005') !== 0) throw new Error('disparou em spike curto');
});

t('V-005 severity: > 100°C com slope alto → critico', () => {
  const { engine, events } = makeEngine();
  // Começa em 100°C (já no threshold) e cresce a 1.5°C/min — quando a janela
  // de 60s emite, tw ainda está > 100.
  feed(engine, (tMono) => snap(tMono, {
    engine: { water_temp: 100 + (tMono / 60_000) * 1.5 },
  }), 0, 6 * 60_000, 1000);
  const v5 = events.find((e) => e.validation === 'V-005');
  if (!v5) throw new Error('V-005 não disparou');
  if (v5.severity !== 'critico') throw new Error('severity=' + v5.severity);
});

// ─── V-006 · Pressão óleo × RPM ────────────────────────────

t('V-006 normal: pressão óleo 5 bar a 5000 rpm → ok', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 5.0, rpm: 5000, oil_temp: 90 },
  }), 1000, 4000);
  if (count(events, 'V-006') !== 0) throw new Error('disparou em saudável');
});

t('V-006 divergência: pressão 1 bar a 5000 rpm por 2s+ → critico', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000, oil_temp: 90 },
  }), 1000, 4000);
  const v6 = events.find((e) => e.validation === 'V-006');
  if (!v6) throw new Error('não disparou');
  if (v6.severity !== 'critico') throw new Error('severity=' + v6.severity);
});

t('V-006 transitório: pressão baixa por 0.5s não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 1000, 1500);
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 5.0, rpm: 5000 },
  }), 1500, 3000);
  if (count(events, 'V-006') !== 0) throw new Error('disparou em transitório');
});

t('V-006 recovery: rpm baixo zera janela', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 1000, 2500); // 1.5s
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 1000 }, // rpm baixo zera
  }), 2500, 3500);
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 3500, 5000); // 1.5s — janela exige 2s
  if (count(events, 'V-006') !== 0) throw new Error('emitiu sem janela completa');
});

// ─── V-007 · Lambda sob carga ──────────────────────────────

t('V-007 normal: λ < 1.0 sob carga → ok', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { lambda: 0.85, tps: 90, map: 1.0, rpm: 6000 },
  }), 1000, 7000);
  if (count(events, 'V-007') !== 0) throw new Error('disparou em rica/ideal');
});

t('V-007 atenção: λ > 1.0 sob carga por 1-5s → atencao', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { lambda: 1.05, tps: 90, map: 1.0, rpm: 6000 },
  }), 1000, 3000); // 2s
  const v7 = events.find((e) => e.validation === 'V-007');
  if (!v7) throw new Error('não disparou');
  if (v7.severity !== 'atencao') throw new Error('severity=' + v7.severity);
});

t('V-007 critico: λ > 1.0 sob carga por 5s+ → critico', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { lambda: 1.05, tps: 90, map: 1.0, rpm: 6000 },
  }), 1000, 7000);
  const v7crit = events.find((e) => e.validation === 'V-007' && e.severity === 'critico');
  if (!v7crit) throw new Error('crítico não disparou em 5s+');
});

t('V-007 recovery: lambda volta antes de 5s → só atenção', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { lambda: 1.05, tps: 90, map: 1.0, rpm: 6000 },
  }), 1000, 2500);
  feed(engine, (tMono) => snap(tMono, {
    engine: { lambda: 0.85, tps: 90, map: 1.0, rpm: 6000 },
  }), 2500, 7000);
  const sevs = events.filter((e) => e.validation === 'V-007').map((e) => e.severity);
  if (sevs.includes('critico')) throw new Error('crítico veio sem 5s sustentado');
});

// ─── V-008 · Bateria × RPM ─────────────────────────────────

t('V-008 normal: 13.5V a 5000 rpm → ok', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { battery_voltage: 13.5, rpm: 5000 },
  }), 1000, 4000);
  if (count(events, 'V-008') !== 0) throw new Error('disparou em normal');
});

t('V-008 divergência: 11V a 5000 rpm por 2s+ → atencao', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { battery_voltage: 11.0, rpm: 5000 },
  }), 1000, 4000);
  const v8 = events.find((e) => e.validation === 'V-008');
  if (!v8) throw new Error('não disparou');
  if (v8.severity !== 'atencao') throw new Error('severity=' + v8.severity);
});

t('V-008 critico: 10V a 5000 rpm por 2s+ → critico', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { battery_voltage: 10.0, rpm: 5000 },
  }), 1000, 4000);
  const v8 = events.find((e) => e.validation === 'V-008');
  if (!v8) throw new Error('não disparou');
  if (v8.severity !== 'critico') throw new Error('severity=' + v8.severity);
});

t('V-008 transitório: 11V só por 0.5s não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { battery_voltage: 11.0, rpm: 5000 },
  }), 1000, 1500);
  feed(engine, (tMono) => snap(tMono, {
    engine: { battery_voltage: 13.5, rpm: 5000 },
  }), 1500, 3000);
  if (count(events, 'V-008') !== 0) throw new Error('disparou em transitório');
});

// ─── V-010 · Yaw × aLat (sobresterço/subesterço) ───────────

t('V-010 normal: yaw e aLat coerentes → não dispara', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    dynamics: { yaw_rate: 20, accel_lateral: 6 },
  }), 1000, 2000);
  if (count(events, 'V-010') !== 0) throw new Error('disparou em coerente');
});

t('V-010 sobresterço: yaw alto + aLat baixo → V-010', () => {
  const { engine, events } = makeEngine();
  engine.consume(snap(1000, {
    dynamics: { yaw_rate: 50, accel_lateral: 1.5 },
  }));
  if (count(events, 'V-010') !== 1) throw new Error('sobresterço não disparou');
});

t('V-010-b subesterço: aLat alto + yaw baixo → V-010-b', () => {
  const { engine, events } = makeEngine();
  engine.consume(snap(1000, {
    dynamics: { yaw_rate: 5, accel_lateral: 9 },
  }));
  if (count(events, 'V-010-b') !== 1) throw new Error('subesterço não disparou');
});

// ─── V-011 · aLat vs raio da trajetória ────────────────────

t('V-011 normal: aLat coerente com raio → não dispara', () => {
  const { engine, events } = makeEngine();
  // Curva circular a 100m de raio, velocidade 30 m/s → aLat ≈ 9 m/s²
  const radius = 100, v = 30, omega = v / radius;
  const cosLat = Math.cos((-15.77 * Math.PI) / 180);
  for (let tMono = 1000; tMono < 3000; tMono += 100) {
    const theta = (omega * tMono) / 1000;
    const lat = -15.77 + (radius * Math.cos(theta)) / 111_320;
    const lon = -47.90 + (radius * Math.sin(theta)) / (111_320 * cosLat);
    engine.consume(snap(tMono, {
      position: { lat, lon },
      vehicle: { speed_fused: v },
      dynamics: { accel_lateral: 9.0 }, // coerente com v²/r = 900/100
    }));
  }
  if (count(events, 'V-011') !== 0) throw new Error('disparou em coerente');
});

t('V-011 divergência: aLat 1 m/s² mas trajetória pede 9 m/s² → dispara', () => {
  const { engine, events } = makeEngine();
  const radius = 100, v = 30, omega = v / radius;
  const cosLat = Math.cos((-15.77 * Math.PI) / 180);
  for (let tMono = 1000; tMono < 3000; tMono += 100) {
    const theta = (omega * tMono) / 1000;
    const lat = -15.77 + (radius * Math.cos(theta)) / 111_320;
    const lon = -47.90 + (radius * Math.sin(theta)) / (111_320 * cosLat);
    engine.consume(snap(tMono, {
      position: { lat, lon },
      vehicle: { speed_fused: v },
      dynamics: { accel_lateral: 1.0 }, // muito menos do que v²/r = 9
    }));
  }
  if (count(events, 'V-011') < 1) throw new Error('não disparou');
});

// ─── Cooldown ──────────────────────────────────────────────

t('cooldown: nova divergência dentro de 30s não emite 2× pra mesma validação', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000, oil_temp: 90 },
  }), 1000, 30_000);
  if (count(events, 'V-006') !== 1) throw new Error('count=' + count(events, 'V-006'));
});

t('cooldown: passado 30s, próxima divergência re-emite', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000, oil_temp: 90 },
  }), 1000, 5000);
  // Recovery longo (mais que cooldown)
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 5.0, rpm: 5000, oil_temp: 90 },
  }), 5000, 36_000);
  // Nova divergência sustentada
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000, oil_temp: 90 },
  }), 36_000, 40_000);
  if (count(events, 'V-006') !== 2) throw new Error('count=' + count(events, 'V-006'));
});

// ─── Confiança canônica ───────────────────────────────────

t('eventos vêm anotados com confianca="Alta" por construção', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 1000, 4000);
  const v6 = events.find((e) => e.validation === 'V-006');
  if (!v6) throw new Error('V-006 não disparou');
  if (v6.confianca !== 'Alta') throw new Error('confianca=' + v6.confianca);
});

// ─── Reset ─────────────────────────────────────────────────

t('reset() limpa cooldowns e janelas', () => {
  const { engine, events } = makeEngine();
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 1000, 4000);
  if (count(events, 'V-006') !== 1) throw new Error('1ª não emitiu');
  engine.reset();
  // Após reset, mesmo dentro do cooldown original, nova divergência re-emite
  feed(engine, (tMono) => snap(tMono, {
    engine: { oil_pressure: 1.0, rpm: 5000 },
  }), 4500, 7000);
  if (count(events, 'V-006') !== 2) throw new Error('reset não permitiu re-emit');
});

// ─── Final ─────────────────────────────────────────────────

console.log('');
console.log(`cross-validation: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
