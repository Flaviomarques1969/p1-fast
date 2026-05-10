// T4000Provider — adapta T4000PacketParser num produtor de samples.
//
// Spec: docs/hardware/T4000_CAN_SPEC.md
// Plano: PLANO_FASE_1.md §6 MS-9.4 (reescrito 2026-05-09 — ADR-023)
//
// Roda no notebook Windows. Recebe pacotes de 8 bytes do reader concreto
// (USB CDC-ACM, CAN-USB, ou mock) via método `feedPacket(bytes)` e emite
// samples normalizados via callback `onT4000Sample`.
//
// NÃO herda de TelemetryProvider (`provider.js`) propositalmente: aquele contrato
// é pra GPS/IMU + sample-store/Dexie do hub legado. T4000 é ECU, fluxo separado,
// pipeline próprio. Quando o cockpit web consumir os dois (IMU/GPS via Realtime
// + T4000 local), a fusão acontece numa camada de cima (LiveDataBridge — MS-13.4).
//
// O reader concreto fica em outro módulo (MS-9.3 — T4000Reader) porque
// depende da escolha do container Windows (browser+WebSerial vs Electron+node-can)
// que ainda está em aberto (MS-9.0).

import {
  createT4000PacketFeeder,
  T4000_CAN_ID,
} from './t4000-packet-parser.js';

export const T4000_SIGNAL = Object.freeze({
  GOOD: 'good',
  DEGRADED: 'degraded',
  BAD: 'bad',
  LOST: 'lost',
});

/**
 * @typedef {Object} T4000Sample
 * @property {number} rpm
 * @property {number} speedKmh
 * @property {number} oilPressBar
 * @property {number} oilTempC
 * @property {number} waterTempC
 * @property {number} fuelPressBar
 * @property {number} batteryV
 * @property {number} tpsPct
 * @property {number} mapBar
 * @property {number} airTempC
 * @property {number} egtC
 * @property {boolean} egtOutOfRange
 * @property {number} lambda
 * @property {number} fuelTempC
 * @property {number} marcha
 * @property {number} ecuErrorBits
 * @property {number} tMono            performance.now()
 * @property {boolean} checksumOk
 */

export class T4000Provider {
  constructor({ now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), onT4000Sample } = {}) {
    this.source = 't4000-can';
    this._now = now;
    this._onT4000Sample = onT4000Sample;
    this._lastChecksumOk = null;
    this._cyclesOk = 0;
    this._cyclesBad = 0;
    this._consecutiveBadCycles = 0;

    this._feeder = createT4000PacketFeeder({
      onCycle: (cycle) => this._onCycle(cycle),
      onError: (err) => this._onFeederError(err),
    });
  }

  /**
   * Recebe pacote bruto de 8 bytes do reader concreto.
   * @param {number[]|Uint8Array} bytes
   */
  feedPacket(bytes) {
    this._feeder.feed(bytes);
  }

  /**
   * Reset do feeder (resync manual).
   */
  resetFeeder() {
    this._feeder.reset();
  }

  /**
   * Métricas de saúde do barramento.
   */
  getStats() {
    return {
      cyclesOk: this._cyclesOk,
      cyclesBad: this._cyclesBad,
      consecutiveBadCycles: this._consecutiveBadCycles,
      signalQuality: this._signalQualityFromStats(),
    };
  }

  _onCycle(cycle) {
    if (cycle.ok) {
      this._cyclesOk++;
      this._consecutiveBadCycles = 0;
    } else {
      this._cyclesBad++;
      this._consecutiveBadCycles++;
    }
    this._lastChecksumOk = cycle.ok;

    /** @type {T4000Sample} */
    const sample = {
      ...cycle.sample,
      tMono: this._now(),
      checksumOk: cycle.ok,
    };

    if (this._onT4000Sample) this._onT4000Sample(sample);
  }

  _onFeederError(err) {
    // resync ou parse error — não é um sample, mas pode degradar quality
    this._consecutiveBadCycles++;
  }

  _signalQualityFromStats() {
    if (this._consecutiveBadCycles >= 5) return T4000_SIGNAL.LOST;
    if (this._consecutiveBadCycles >= 2) return T4000_SIGNAL.DEGRADED;
    if (this._cyclesOk === 0) return T4000_SIGNAL.BAD;
    return T4000_SIGNAL.GOOD;
  }
}

export const T4000_CONSTANTS = Object.freeze({
  CAN_ID: T4000_CAN_ID,
  EXPECTED_CYCLE_HZ: 20,        // 5 pacotes × 10ms = 50ms = 20Hz
  PUBLISH_TARGET_HZ: 10,        // MS-9.5: agregação pra Realtime
});
