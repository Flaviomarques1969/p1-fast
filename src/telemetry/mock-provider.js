// ═══════════════════════════════════════════════════════════
// MockProvider — provider sintético pra testes e dev
// ═══════════════════════════════════════════════════════════
// Emite samples a ~10Hz descrevendo um círculo na origem com velocidade
// variável. Bom pra testar o pipeline sem precisar de GPS/carro real.

import { TelemetryProvider, SignalQuality, ProviderState } from './provider.js';

export class MockProvider extends TelemetryProvider {
  constructor(options = {}) {
    super({ source: 'mock' });
    this.intervalId = null;
    this.rateMs = options.rateMs || 100;     // 10Hz default
    this.centerLat = options.centerLat || -15.77;
    this.centerLng = options.centerLng || -47.90;
    this.radiusM = options.radiusM || 200;
    this.angularSpeed = options.angularSpeed || 0.1; // rad/s
    this.t = 0;
  }

  async _onStart() {
    this.signalQuality = SignalQuality.GOOD;
    this.intervalId = setInterval(() => this._tick(), this.rateMs);
  }

  _tick() {
    if (this.state !== ProviderState.RUNNING) return;   // T-011
    this.t += this.rateMs / 1000;
    const angle = this.t * this.angularSpeed;
    // desloca em pequenos graus (aprox: 1 grau lat ≈ 111km)
    const dLat = (this.radiusM * Math.cos(angle)) / 111000;
    const dLng = (this.radiusM * Math.sin(angle)) / (111000 * Math.cos(this.centerLat * Math.PI / 180));
    const speed = 30 + 10 * Math.sin(angle * 2);  // 20-40 m/s (72-144 km/h)
    const heading = ((angle * 180 / Math.PI) + 90) % 360;
    this._emit({
      lat: this.centerLat + dLat,
      lng: this.centerLng + dLng,
      alt: 1100,
      speed,
      heading,
      gpsAccuracy: 3 + Math.random() * 2,
      accLong: Math.cos(angle) * 2,
      accLat:  Math.sin(angle) * 4,
      accVert: 0,
      gyroX: 0, gyroY: 0, gyroZ: this.angularSpeed,
    });
  }

  _onPause() {
    // T-022 / A-028: clearInterval pra não tickar em pausa
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }
  _onResume() {
    if (!this.intervalId) this.intervalId = setInterval(() => this._tick(), this.rateMs);
  }

  async _onStop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
