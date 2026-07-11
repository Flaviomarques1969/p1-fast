// ═══════════════════════════════════════════════════════════
// CarTelemetrySnapshot — estado canônico do carro num instante T (P0)
// ═══════════════════════════════════════════════════════════
// docs/raceops/TELEMETRY_SNAPSHOT_SPEC.md (Engenheiro-Chefe 2026-04-26).
//
// Princípio: snapshot NÃO é insight. Snapshot é dado consolidado pronto
// pra análise. Insight (curva, frenagem, apex, alerta) é gerado por
// análises que CONSOMEM snapshots, não pelo snapshot em si.
//
// Construído pelo TelemetryTimebase (timebase.js). Cada snapshot:
//   • imutável (Object.freeze)
//   • carrega `quality` por fonte + global (pior dos canais críticos)
//   • campos não-disponíveis = null (NUNCA 0, NUNCA '-', NUNCA 'N/A')
//   • origem rastreável (cada canal sabe de qual fonte veio)

import { Quality, worstOf, qualityLabel } from '../domain/data-quality.js';
import { msParaKmh } from '../domain/velocidade.js';

/**
 * Constrói CarTelemetrySnapshot a partir do output do TelemetryTimebase.
 *
 * @param {{ tMono: number, sourcesData: Object<string,{sample,quality,ageMs}> }} input
 * @returns {Object} snapshot congelado
 */
export function buildSnapshot({ tMono, sourcesData }) {
  const t = Date.now();

  // Por convenção:
  //   GPS principal vem de RaceBox (>=8 satélites, 25Hz) ou cockpit-mobile (1Hz fallback)
  //   IMU principal vem de RaceBox-IMU (100Hz) ou cockpit-mobile (CoreMotion 50-100Hz)
  //   Engine vem de t4000 exclusivamente
  //   Vehicle.speed_can vem de t4000; speed_gnss vem de RaceBox/cockpit-mobile

  const t4000     = sourcesData['t4000'];
  const racebox   = sourcesData['racebox-gnss'] || sourcesData['racebox'];
  const raceboxIm = sourcesData['racebox-imu'];
  const cockpit   = sourcesData['cockpit-mobile'] || sourcesData['device'];
  const cockpitIm = sourcesData['iphone-imu'] || cockpit;
  const mock      = sourcesData['mock'];

  // ─── Engine (t4000) ─────────────────────────────────────────
  const engine = pickEngine(t4000);

  // ─── Posição (racebox primary, cockpit fallback) ────────────
  const positionSource = bestOf([racebox, cockpit, mock]);
  const position = pickPosition(positionSource);

  // ─── Dynamics (racebox-imu primary, cockpit-imu fallback) ───
  const dynSource = bestOf([raceboxIm, cockpitIm, mock]);
  const dynamics = pickDynamics(dynSource);

  // ─── Vehicle (fundido) ──────────────────────────────────────
  const vehicle = pickVehicle({ t4000, gnss: positionSource });

  // ─── Quality consolidada ────────────────────────────────────
  const quality = {
    t4000_quality:   t4000?.quality   || (t4000 ? Quality.MISSING : null),
    racebox_quality: racebox?.quality || (racebox ? Quality.MISSING : null),
    iphone_quality:  cockpit?.quality || (cockpit ? Quality.MISSING : null),
    mock_quality:    mock?.quality    || (mock ? Quality.MISSING : null),
    sync_quality:    Quality.OK,
    confidence:      'Alta',
    interpolated_channels: [],
    missing_channels: [],
  };
  // Marcar canais missing
  if (engine.rpm == null)            quality.missing_channels.push('engine.rpm');
  if (position.lat == null)          quality.missing_channels.push('position.lat');
  if (dynamics.accel_lateral == null) quality.missing_channels.push('dynamics.accel_lateral');
  if (vehicle.speed_fused == null)    quality.missing_channels.push('vehicle.speed_fused');

  // Sync quality = pior das fontes que efetivamente alimentaram canais
  const fontesAtivas = Object.values(sourcesData).filter(s => s && s.sample).map(s => s.quality);
  if (fontesAtivas.length === 0) {
    quality.sync_quality = Quality.MISSING;
    quality.confidence = 'Baixa';
  } else {
    quality.sync_quality = worstOf(fontesAtivas);
    if (quality.sync_quality === Quality.OK) quality.confidence = 'Alta';
    else if ([Quality.LATE, Quality.LOW_CONFIDENCE, Quality.INTERPOLATED].includes(quality.sync_quality)) {
      quality.confidence = 'Média';
    } else quality.confidence = 'Baixa';
  }

  // synchronization_status — rótulo de UI pra "como tá a sincronia?"
  let syncStatus = 'synced';
  if (quality.sync_quality === Quality.MISSING || quality.sync_quality === Quality.LOST) syncStatus = 'lost';
  else if (quality.sync_quality === Quality.LATE) syncStatus = 'partial';
  else if ([Quality.SUSPECT, Quality.LOW_CONFIDENCE].includes(quality.sync_quality)) syncStatus = 'degraded';

  const snapshot = {
    t,
    tMono,
    source_quality: qualityLabel(quality.sync_quality),
    synchronization_status: syncStatus,
    engine,
    vehicle,
    position,
    dynamics,
    quality,
  };

  return Object.freeze(deepFreeze(snapshot));
}

/** Retorna fonte com melhor quality + sample não-null, ou null. */
function bestOf(candidates) {
  for (const c of candidates) {
    if (c && c.sample) return c;
  }
  return null;
}

function pickEngine(src) {
  if (!src || !src.sample) {
    return Object.freeze({
      rpm: null, tps: null, map: null, lambda: null,
      oil_pressure: null, oil_temp: null, water_temp: null,
      fuel_pressure: null, fuel_temp: null,
      battery_voltage: null, gear: null, egt: null, ecu_error: null,
    });
  }
  const s = src.sample;
  return {
    rpm:             num(s.rpm),
    tps:             num(s.tps),
    map:             num(s.map),
    lambda:          num(s.lambda),
    oil_pressure:    num(s.oil_pressure ?? s.pressao_oleo),
    oil_temp:        num(s.oil_temp ?? s.temp_oleo),
    water_temp:      num(s.water_temp ?? s.temp_motor),
    fuel_pressure:   num(s.fuel_pressure ?? s.pressao_comb),
    fuel_temp:       num(s.fuel_temp ?? s.temp_comb),
    battery_voltage: num(s.battery_voltage ?? s.bateria_v),
    gear:            num(s.gear ?? s.marcha),
    egt:             num(s.egt),
    ecu_error:       s.ecu_error ?? null,
  };
}

function pickPosition(src) {
  if (!src || !src.sample) {
    return Object.freeze({
      lat: null, lon: null, alt: null,
      local_x: null, local_y: null,
      heading: null, distance_from_start: null,
      gps_accuracy: null, fix_type: null, num_satellites: null,
    });
  }
  const s = src.sample;
  return {
    lat:                 num(s.lat),
    lon:                 num(s.lng ?? s.lon),
    alt:                 num(s.alt),
    local_x:             num(s.x),
    local_y:             num(s.y),
    heading:             num(s.heading ?? s.course),
    distance_from_start: num(s.distance_from_start ?? s.distance),
    gps_accuracy:        num(s.acc ?? s.gpsAccuracy),
    fix_type:            s.fix_type || (s.acc != null && s.acc < 50 ? '3D' : null),
    num_satellites:      num(s.num_satellites ?? s.satellites),
  };
}

function pickDynamics(src) {
  if (!src || !src.sample) {
    return Object.freeze({
      accel_longitudinal: null, accel_lateral: null, accel_vertical: null,
      yaw_rate: null, gyro_x: null, gyro_y: null, gyro_z: null,
    });
  }
  const s = src.sample;
  // accLong/accLat normalmente são exclusivos de fontes que fizeram rotação para
  // o frame do carro. iPhone CoreMotion bruto traz acc{X,Y,Z} no frame do device.
  return {
    accel_longitudinal: num(s.accLong ?? s.accel_longitudinal),
    accel_lateral:      num(s.accLat ?? s.accel_lateral),
    accel_vertical:     num(s.accVert ?? s.accel_vertical ?? s.accZ),
    yaw_rate:           num(s.yaw_rate ?? s.gyroAlpha ?? s.gyroZ),
    gyro_x:             num(s.gyroX ?? s.gyroBeta),
    gyro_y:             num(s.gyroY ?? s.gyroGamma),
    gyro_z:             num(s.gyroZ ?? s.gyroAlpha),
  };
}

function pickVehicle({ t4000, gnss }) {
  const speed_can  = t4000?.sample ? num(t4000.sample.speed_can ?? t4000.sample.velocidade) : null;
  const speed_gnss = gnss?.sample ? num(gnss.sample.speed) : null;
  let speed_fused;
  if (speed_can != null && speed_gnss != null) {
    // Fusão simples: média ponderada — CAN é mais reativo, GNSS mais absoluto.
    // Calibração futura: usar variância em vez de fixo.
    speed_fused = speed_can * 0.55 + speed_gnss * 0.45;
  } else if (speed_can != null) {
    speed_fused = speed_can;
  } else if (speed_gnss != null) {
    speed_fused = speed_gnss;
  } else {
    speed_fused = null;
  }
  return { speed_can, speed_gnss, speed_fused };
}

function num(v) {
  return Number.isFinite(v) ? v : null;
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
    return Object.freeze(obj);
  }
  return obj;
}

/** Snapshot vazio / sem dados — usado em estados iniciais e testes. */
export function emptySnapshot(tMono = 0) {
  return buildSnapshot({ tMono, sourcesData: {} });
}

/**
 * Helper Etapa 5: converte `CarTelemetrySnapshot` em `sample` shape
 * que `Detector`, `FaseCurva` e `Corredor` ainda consomem (com `x`, `y`,
 * `t`, `tMono`, `speed`, `kmh`, `accLong`, `accLat`).
 *
 * Mantém compatibilidade com análises existentes — caller adapta uma
 * fonte de cada vez sem reescrever as análises.
 *
 * @param {object} snap CarTelemetrySnapshot
 * @returns {object} sample-like
 */
export function snapshotToSample(snap) {
  if (!snap || !snap.position) return null;
  const speed = snap.vehicle?.speed_fused ?? snap.vehicle?.speed_gnss ?? null;
  return {
    t:     snap.t,
    tMono: snap.tMono,
    x:     snap.position.local_x,
    y:     snap.position.local_y,
    lat:   snap.position.lat,
    lng:   snap.position.lon,
    speed,
    kmh:   speed != null ? msParaKmh(speed) : null,
    accLong: snap.dynamics?.accel_longitudinal ?? null,
    accLat:  snap.dynamics?.accel_lateral ?? null,
    accVert: snap.dynamics?.accel_vertical ?? null,
    heading: snap.position.heading,
    quality: snap.source_quality,
  };
}
