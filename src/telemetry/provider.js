// ═══════════════════════════════════════════════════════════
// TelemetryProvider — interface abstrata
// ═══════════════════════════════════════════════════════════
// Qualquer provedor de telemetria (GPS do celular, RaceBox BLE, mock)
// deve herdar daqui.
//
// Contrato:
//   - start(sessionId)  → começa a emitir samples pro store
//   - pause()           → para sem descartar estado (pode retomar)
//   - resume()          → continua do pause
//   - stop()            → finaliza e flusha buffer
//   - onSample(cb)      → callback pra cada sample (cockpit lê daqui)
//
// Qualidade de sinal ('good' | 'degraded' | 'bad' | 'lost') é responsabilidade do provider.
// Timestamp monotônico (performance.now) é obrigatório pra detecção de gaps.

import { logger } from '../core/logger.js';
import { sampleStore } from './sample-store.js';
import { applyProjection } from './projector.js';

/**
 * @typedef {Object} Sample
 * @property {string} sessionId
 * @property {number} seq
 * @property {number} t               timestamp unix ms (auditorial — ADR-015)
 * @property {number} tMono           performance.now() ms (canônico para deltas)
 * @property {string} source          'device' | 'racebox' | 'mock'
 * @property {string} signalQuality   SignalQuality.*
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {number|null} alt
 * @property {number|null} speed      m/s
 * @property {number|null} heading    graus (0-360)
 * @property {number|null} accLong    aceleração longitudinal m/s²
 * @property {number|null} accLat     aceleração lateral m/s²
 * @property {number|null} accVert
 * @property {number|null} gyroX
 * @property {number|null} gyroY
 * @property {number|null} gyroZ
 * @property {number|null} gpsAccuracy metros
 * @property {number|null} x          viewBox (projetado — T-003)
 * @property {number|null} y          viewBox (projetado — T-003)
 */

export const SignalQuality = Object.freeze({
  GOOD:     'good',
  DEGRADED: 'degraded',
  BAD:      'bad',
  LOST:     'lost',
});

export const ProviderState = Object.freeze({
  IDLE:    'idle',
  RUNNING: 'running',
  PAUSED:  'paused',
  STOPPED: 'stopped',
  ERROR:   'error',
});

export class TelemetryProvider {
  constructor({ source = 'unknown', track = null } = {}) {
    this.source = source;           // 'device' | 'racebox' | 'mock'
    this.state = ProviderState.IDLE;
    this.sessionId = null;
    this.seq = 0;
    this.listeners = new Set();
    this.startedAt = null;          // timestamp (ms unix)
    this.startedAtMono = null;      // performance.now() no start
    this.lastSampleAt = null;
    this.signalQuality = SignalQuality.GOOD;
    this.track = track;             // T-003: se presente, habilita projeção lat/lng→x/y
  }

  /** Permite atualizar a track depois (ex: quando a seed chega async). */
  setTrack(track) { this.track = track; }

  onSample(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Deve ser chamado pelo provider concreto quando tiver um sample novo. */
  _emit(partial) {
    if (this.state !== ProviderState.RUNNING) return;
    const tMono = performance.now();
    const sample = {
      sessionId: this.sessionId,
      seq: this.seq++,
      t: Date.now(),
      tMono,
      source: this.source,
      signalQuality: this.signalQuality,
      // campos opcionais (cada provider preenche o que tem)
      lat: null, lng: null, alt: null,
      speed: null, heading: null,
      accLong: null, accLat: null, accVert: null,
      gyroX: null, gyroY: null, gyroZ: null,
      gpsAccuracy: null,
      x: null, y: null,              // T-003: preenchidos via applyProjection
      ...partial,
    };
    // T-003: se track com âncoras disponível, projeta lat/lng → x/y in-place
    if (this.track && sample.lat != null && sample.lng != null && (sample.x == null || sample.y == null)) {
      applyProjection(sample, this.track);
    }
    this.lastSampleAt = sample.t;
    sampleStore.enqueue(sample);
    for (const cb of this.listeners) {
      try { cb(sample); } catch (err) { logger.error('[provider] listener falhou', { err: String(err) }); }
    }
  }

  async start(sessionId) {
    if (this.state === ProviderState.RUNNING) throw new Error('provider já rodando');
    if (!sessionId) throw new Error('start requer sessionId');
    this.sessionId = sessionId;
    this.seq = 0;
    this.startedAt = Date.now();
    this.startedAtMono = performance.now();
    this.state = ProviderState.RUNNING;
    logger.info('[provider] start', { source: this.source, sessionId });
    await this._onStart();
  }

  pause() {
    if (this.state !== ProviderState.RUNNING) return;
    this.state = ProviderState.PAUSED;
    this._onPause();
    logger.info('[provider] pause', { source: this.source });
  }

  resume() {
    if (this.state !== ProviderState.PAUSED) return;
    this.state = ProviderState.RUNNING;
    this._onResume();
    logger.info('[provider] resume', { source: this.source });
  }

  async stop() {
    if (this.state === ProviderState.STOPPED || this.state === ProviderState.IDLE) return;
    this.state = ProviderState.STOPPED;
    await this._onStop();
    await sampleStore.drain();
    logger.info('[provider] stop', { source: this.source, samples: this.seq });
  }

  // Hooks abstratos — cada provider implementa
  async _onStart() {}
  _onPause() {}
  _onResume() {}
  async _onStop() {}
}
