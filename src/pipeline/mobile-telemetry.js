// ═══════════════════════════════════════════════════════════
// CockpitTelemetry — captura GPS + IMU no celular do piloto
// ═══════════════════════════════════════════════════════════
// Responsabilidade: enquanto o cockpit MOBILE renderiza a tela do
// piloto no iPhone (berço do carro), este módulo captura GPS via
// CoreLocation (Geolocation API) + IMU via CoreMotion (DeviceMotion
// + DeviceOrientation) e expõe um stream de samples.
//
// Decisão Flavio 2026-04-25: o iPhone tem 2 papéis simultâneos AGORA:
//   1. Display do piloto (renderiza /cockpit-mobile.html)
//   2. Fonte de telemetria (publica GPS + IMU)
// Quando o Mini PC entrar no carro (Perna 2), o iPhone vira só fonte
// de vídeo — esse módulo aqui continua ligado, mas o display do piloto
// migra pro monitor 10.5" alimentado pelo Mini PC.
//
// Endpoint final (E3 do PLANO_EXECUCAO): /api/ingest/iphone — bloqueado
// até E3 entrar. Por ora o módulo bufferiza local + emite via callback
// (caller decide o que fazer: console.log, IndexedDB, fetch futuro).
//
// Permissões iOS:
//   - Geolocation: pedido automático no primeiro watchPosition()
//   - DeviceMotion: requer DeviceMotionEvent.requestPermission() em iOS 13+
//     que SÓ funciona em resposta a user gesture (botão "ENTRAR" do gate)
//
// Boas práticas iOS:
//   - watchPosition com enableHighAccuracy:true + maximumAge:0
//   - DeviceMotion roda em ~60Hz (Safari iOS — pode ser limitado a 1Hz
//     se a página não estiver visível)
//   - Wake Lock pra evitar tela apagar enquanto piloto roda
//
// O módulo NUNCA bloqueia. Falha = aviso no chip de telemetria.

import { logger } from '../core/logger.js';
import { msParaKmh } from '../domain/velocidade.js';

const SAMPLE_BUFFER_MAX = 600;   // ~10s a 60Hz, evita estourar memória

// Janela rolling pra computar rate (samples/s) e jitter por canal.
// 60 amostras = ~1s de IMU @ 60Hz, ~60s de GPS @ 1Hz — suficiente pra
// detectar throttling/drop sem oscilação chata.
const RATE_WINDOW = 60;

/**
 * Sample canônico — alinhado com `src/telemetry/provider.js` typedef
 * (TELEMETRY_ENGINEERING_RULES Regra 1: origem, timestamp dual, unidade,
 * escala, qualidade). Engenheiro-Chefe de Telemetria 2026-04-26 reprovou
 * o formato anterior aninhado `{gps:{...}, imu:{...}}` por: (a) sem `tMono`
 * (usava só Date.now → quebra ADR-015), (b) sem `source` rastreável,
 * (c) sem `signalQuality`, (d) divergente do Sample do projeto.
 *
 * @typedef {Object} Sample
 * @property {number} t              timestamp epoch ms (Date.now)
 * @property {number} tMono          relógio monotônico ms (performance.now), imune a NTP jump
 * @property {string} source         'cockpit-mobile' (origem)
 * @property {string} signalQuality  'GOOD'|'DEGRADED'|'BAD'|'LOST' por amostra
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {number} [alt]
 * @property {number} [speed]        m/s (CLLocation.speed)
 * @property {number} [kmh]          derivado: speed × 3.6
 * @property {number} [course]       graus (heading GPS)
 * @property {number} [acc]          accuracy do GPS em metros
 * @property {number} [accX]         m/s² (DeviceMotion.acceleration sem gravidade)
 * @property {number} [accY]
 * @property {number} [accZ]
 * @property {number} [gyroAlpha]    deg/s (DeviceMotion.rotationRate)
 * @property {number} [gyroBeta]
 * @property {number} [gyroGamma]
 * @property {number} [heading]      graus (compass — webkitCompassHeading no iOS)
 */

/** Mapeia accuracy do GPS pra SignalQuality por amostra (espelho de DeviceProvider). */
function gpsAccToQuality(acc) {
  if (acc == null || !Number.isFinite(acc)) return 'LOST';
  if (acc <= 5)  return 'GOOD';
  if (acc <= 20) return 'DEGRADED';
  if (acc <= 50) return 'BAD';
  return 'LOST';
}

/** Source canônico por canal — TelemetryTimebase usa pra freshness diferente. */
export const SourceTags = Object.freeze({
  GPS: 'cockpit-mobile',     // GPS @ ~1Hz, freshness 1500ms
  IMU: 'iphone-imu',          // CoreMotion @ 50-100Hz, freshness 200ms
});

export class MobileTelemetry {
  constructor({ onSample = null, onStatus = null, sourceGps = SourceTags.GPS, sourceImu = SourceTags.IMU } = {}) {
    this.onSample = onSample;
    this.onStatus = onStatus;
    this.sourceGps = sourceGps;
    this.sourceImu = sourceImu;
    this.buffer = [];
    this._gpsWatchId = null;
    this._motionHandler = null;
    this._orientHandler = null;
    this._wakeLock = null;
    this._wakeLockAttached = false;
    this._lastImu = null;
    this._lastGps = null;
    this._sessionStartedAt = null;
    // Compass: calibração detectada quando rotação Z muda razoavelmente
    // (Flavio fazendo figura-8 antes do stint). Conta amostras com gyroAlpha
    // > THRESHOLD; após N amostras → calibrado.
    this._compassCalibSamples = 0;
    this._compassCalibrated = false;
    // Rate tracking — janela rolling de timestamps por canal.
    this._gpsTimestamps = [];
    this._imuTimestamps = [];
    this.status = {
      gps: 'idle',
      imu: 'idle',
      wakeLock: 'idle',
      compass: 'idle',     // 'idle' | 'calibrating' | 'ok'
      thermal: 'idle',     // 'idle' | 'ok' | 'warn' (jitter alto)
      gpsHz: 0,
      imuHz: 0,
      gpsJitter: 0,
      imuJitter: 0,
    };
  }

  _setStatus(canal, valor) {
    this.status[canal] = valor;
    if (this.onStatus) {
      try { this.onStatus({ ...this.status }); } catch (err) { logger.error('[telemetry] onStatus', { err: String(err) }); }
    }
  }

  /**
   * Inicia GPS + IMU + Wake Lock. Deve ser chamado em resposta a user
   * gesture (toque) — em iOS 13+, DeviceMotionEvent.requestPermission()
   * só resolve nesse contexto.
   */
  async start() {
    if (this._sessionStartedAt) {
      logger.debug('[telemetry] já iniciada');
      return { ok: true, alreadyRunning: true };
    }
    this._sessionStartedAt = Date.now();

    // Os 3 canais rodam em paralelo. Falha de um não bloqueia os outros.
    const results = await Promise.allSettled([
      this._startGps(),
      this._startImu(),
      this._startWakeLock(),
    ]);

    const out = {
      ok: true,
      gps:      results[0].status === 'fulfilled' && results[0].value?.ok,
      imu:      results[1].status === 'fulfilled' && results[1].value?.ok,
      wakeLock: results[2].status === 'fulfilled' && results[2].value?.ok,
    };
    logger.info('[telemetry] start', out);
    return out;
  }

  async stop() {
    if (this._gpsWatchId != null) {
      try { navigator.geolocation.clearWatch(this._gpsWatchId); } catch {}
      this._gpsWatchId = null;
    }
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
    }
    if (this._orientHandler) {
      window.removeEventListener('deviceorientation', this._orientHandler);
      this._orientHandler = null;
    }
    if (this._wakeLock) {
      try { await this._wakeLock.release(); } catch {}
      this._wakeLock = null;
    }
    if (this._wakeLockAttached) {
      document.removeEventListener('visibilitychange', this._reacquireWakeLock);
      this._wakeLockAttached = false;
    }
    this._setStatus('gps', 'idle');
    this._setStatus('imu', 'idle');
    this._setStatus('wakeLock', 'idle');
    this._sessionStartedAt = null;
    logger.info('[telemetry] stop');
  }

  // ─── GPS via Geolocation API (CoreLocation no iOS) ──────────────────
  async _startGps() {
    if (!navigator.geolocation) {
      this._setStatus('gps', 'erro');
      logger.warn('[telemetry] sem Geolocation API');
      return { ok: false, reason: 'sem-api' };
    }
    return new Promise((resolve) => {
      this._gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this._setStatus('gps', 'ok');
          const c = pos.coords;
          const speed = Number.isFinite(c.speed) ? c.speed : null;
          // Sample canônico flat com source='cockpit-mobile' (GPS).
          // SourceTags.GPS distingue do IMU (iphone-imu) pra freshness
          // diferente no TelemetryTimebase (1500ms GPS vs 200ms IMU).
          const sample = this._buildSample({
            t: pos.timestamp || Date.now(),
            source: this.sourceGps,
            lat: c.latitude,
            lng: c.longitude,
            alt: Number.isFinite(c.altitude) ? c.altitude : null,
            speed,
            kmh: speed != null ? msParaKmh(speed) : null,
            course: Number.isFinite(c.heading) ? c.heading : null,
            acc: c.accuracy,
            signalQuality: gpsAccToQuality(c.accuracy),
          });
          this._trackRate('gps', sample.tMono);
          this._emit(sample);
          this._lastGps = sample;
          resolve({ ok: true });
        },
        (err) => {
          this._setStatus('gps', 'erro');
          logger.warn('[telemetry] gps erro', { code: err.code, msg: err.message });
          resolve({ ok: false, reason: err.message });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        }
      );
    });
  }

  // ─── IMU via DeviceMotion + DeviceOrientation (CoreMotion no iOS) ────
  async _startImu() {
    // iOS 13+ requer requestPermission()
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') {
          this._setStatus('imu', 'erro');
          logger.warn('[telemetry] imu permissão negada');
          return { ok: false, reason: 'permissao-negada' };
        }
      } catch (err) {
        this._setStatus('imu', 'erro');
        logger.warn('[telemetry] imu requestPermission falhou', { err: String(err) });
        return { ok: false, reason: 'requestPermission-falhou' };
      }
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch {}
    }

    this._motionHandler = (ev) => {
      this._setStatus('imu', 'ok');
      const acc = ev.acceleration || ev.accelerationIncludingGravity || {};
      const gyro = ev.rotationRate || {};
      // IMU é high-frequency (~60Hz) e sem accuracy explícita — assume GOOD
      // enquanto o evento chega; provider externo pode reclassificar via
      // cross-validation (V-001..V-011) quando esses módulos existirem.
      // Source = 'iphone-imu' (distinto de GPS) — TelemetryTimebase usa
      // freshness 200ms vs 1500ms do GPS.
      const sample = this._buildSample({
        source: this.sourceImu,
        accX: acc.x ?? null,
        accY: acc.y ?? null,
        accZ: acc.z ?? null,
        gyroAlpha: gyro.alpha ?? null,
        gyroBeta: gyro.beta ?? null,
        gyroGamma: gyro.gamma ?? null,
        heading: this._lastHeading,
        signalQuality: 'GOOD',
      });
      this._trackRate('imu', sample.tMono);
      // Compass calibration: se gyroAlpha tem variação significativa
      // (figura-8 do piloto), conta. Após 50 amostras → calibrado.
      if (!this._compassCalibrated && Math.abs(gyro.alpha || 0) > 30) {
        this._compassCalibSamples++;
        if (this._compassCalibSamples >= 50) {
          this._compassCalibrated = true;
          this._setStatus('compass', 'ok');
        } else if (this.status.compass === 'idle') {
          this._setStatus('compass', 'calibrating');
        }
      }
      this._lastImu = sample;
      this._emit(sample);
    };
    window.addEventListener('devicemotion', this._motionHandler);

    this._orientHandler = (ev) => {
      // ev.alpha = compass heading (graus, 0 = norte). Em iOS,
      // ev.webkitCompassHeading é a versão calibrada — preferida.
      // Guardado em `_lastHeading` para a próxima amostra do motionHandler
      // pegar (em vez de mutar o último sample já emitido).
      const heading = (typeof ev.webkitCompassHeading === 'number')
        ? ev.webkitCompassHeading
        : (typeof ev.alpha === 'number' ? (360 - ev.alpha) : null);
      this._lastHeading = heading;
    };
    window.addEventListener('deviceorientation', this._orientHandler);

    return { ok: true };
  }

  // ─── Wake Lock (mantém tela acesa enquanto piloto roda) ──────────────
  async _startWakeLock() {
    if (!('wakeLock' in navigator)) {
      this._setStatus('wakeLock', 'erro');
      logger.warn('[telemetry] sem Wake Lock API');
      return { ok: false, reason: 'sem-api' };
    }
    try {
      this._wakeLock = await navigator.wakeLock.request('screen');
      this._setStatus('wakeLock', 'ok');
      this._wakeLock.addEventListener('release', () => {
        this._setStatus('wakeLock', 'idle');
      });
      // iOS solta o wake lock quando a aba some — re-aquire on visibility
      this._reacquireWakeLock = async () => {
        if (document.visibilityState === 'visible' && !this._wakeLock?.released) {
          try {
            this._wakeLock = await navigator.wakeLock.request('screen');
            this._setStatus('wakeLock', 'ok');
          } catch (err) {
            this._setStatus('wakeLock', 'erro');
            logger.warn('[telemetry] re-acquire wake lock falhou', { err: String(err) });
          }
        }
      };
      document.addEventListener('visibilitychange', this._reacquireWakeLock);
      this._wakeLockAttached = true;
      return { ok: true };
    } catch (err) {
      this._setStatus('wakeLock', 'erro');
      logger.warn('[telemetry] wake lock falhou', { err: String(err) });
      return { ok: false, reason: String(err) };
    }
  }

  /**
   * Constrói Sample canônico flat injetando metadados obrigatórios
   * (t, tMono, source, signalQuality) — TELEMETRY_ENGINEERING_RULES Regra 1.
   * Caller passa apenas campos próprios (lat/lng/speed... ou accX/accY...).
   * Source default = SourceTags.GPS; caller passa SourceTags.IMU pra IMU.
   */
  _buildSample(fields = {}) {
    const t     = fields.t ?? Date.now();
    const tMono = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : t;
    return {
      t,
      tMono,
      source: this.sourceGps,
      signalQuality: fields.signalQuality || 'GOOD',
      ...fields,
    };
  }

  /**
   * Atualiza estatísticas de rate (Hz) e jitter (% nominal) por canal.
   * Quando rate cai pra < 50% nominal OU jitter > 50% nominal → status
   * thermal vai pra 'warn' (sintoma típico de throttling térmico iPhone).
   */
  _trackRate(canal, tMono) {
    const arr = canal === 'gps' ? this._gpsTimestamps : this._imuTimestamps;
    arr.push(tMono);
    if (arr.length > RATE_WINDOW) arr.shift();
    if (arr.length < 2) return;
    const span = arr[arr.length - 1] - arr[0];
    const hz = span > 0 ? ((arr.length - 1) * 1000) / span : 0;
    // Jitter = stddev dos intervalos
    let intervals = [];
    for (let i = 1; i < arr.length; i++) intervals.push(arr[i] - arr[i - 1]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let variance = 0;
    for (const v of intervals) variance += (v - mean) * (v - mean);
    variance /= intervals.length;
    const jitter = Math.sqrt(variance);

    if (canal === 'gps') {
      this.status.gpsHz = hz;
      this.status.gpsJitter = jitter;
    } else {
      this.status.imuHz = hz;
      this.status.imuJitter = jitter;
    }

    // Avalia thermal: rate IMU < 30Hz ou jitter > 50ms = warn
    const imuNominal = 60;
    const imuRateOk  = this.status.imuHz >= imuNominal * 0.5;
    const imuJitterOk = this.status.imuJitter < (1000 / imuNominal) * 1.0;
    const newThermal = (imuRateOk && imuJitterOk) ? 'ok' : 'warn';
    if (this.status.thermal !== newThermal && this.status.imuHz > 0) {
      this._setStatus('thermal', newThermal);
    }
    // Re-publish status pra UI pegar Hz/jitter atualizado
    if (this.onStatus) {
      try { this.onStatus({ ...this.status }); } catch (err) { logger.error('[telemetry] onStatus rate', { err: String(err) }); }
    }
  }

  _emit(sample) {
    this.buffer.push(sample);
    if (this.buffer.length > SAMPLE_BUFFER_MAX) {
      this.buffer.splice(0, this.buffer.length - SAMPLE_BUFFER_MAX);
    }
    if (this.onSample) {
      try { this.onSample(sample); } catch (err) { logger.error('[telemetry] onSample', { err: String(err) }); }
    }
  }

  /** Snapshot do estado atual — útil pra UI de status e debug. */
  snapshot() {
    return {
      status: { ...this.status },
      bufferLen: this.buffer.length,
      lastGps: this._lastGps,
      lastImu: this._lastImu,
      sessionStartedAt: this._sessionStartedAt,
    };
  }
}

/** Boot conveniente — instancia + inicia. Retorna a instância. */
export async function startMobileTelemetry(opts = {}) {
  const t = new MobileTelemetry(opts);
  await t.start();
  return t;
}

export const mobileTelemetry = new MobileTelemetry();
