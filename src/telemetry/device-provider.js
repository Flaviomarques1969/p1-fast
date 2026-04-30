// ═══════════════════════════════════════════════════════════
// DeviceProvider — captura telemetria do celular/tablet
// ═══════════════════════════════════════════════════════════
// Fontes usadas:
//   - navigator.geolocation.watchPosition (lat, lng, speed, heading, altitude, accuracy)
//   - DeviceMotionEvent (acc longitudinal/lateral/vertical, giroscópio)
//
// Os dois fluxos rodam em paralelo e os valores mais recentes são
// combinados num único sample emitido a cada "tick" do GPS
// (tipicamente 1Hz em smartphone).
//
// iOS 13+ exige permission explícita pro motion: DeviceMotionEvent.requestPermission().

import { TelemetryProvider, SignalQuality, ProviderState } from './provider.js';
import { logger } from '../core/logger.js';

export class DeviceProvider extends TelemetryProvider {
  constructor(options = {}) {
    super({ source: 'device' });
    this.watchId = null;
    this.motionHandler = null;
    this.lastMotion = { accLong: null, accLat: null, accVert: null, gyroX: null, gyroY: null, gyroZ: null };
    this.options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
      ...options,
    };
  }

  async _onStart() {
    if (!('geolocation' in navigator)) {
      this.state = ProviderState.ERROR;     // T-011
      throw new Error('geolocation indisponível neste dispositivo');
    }
    await this._requestMotionPermission();
    this._registerSensors();    // T-019/T-020
  }

  /** T-019/T-020: registra GPS + motion (reusado por _onStart e _onResume). */
  _registerSensors() {
    if (!this.motionHandler) {
      this.motionHandler = (ev) => this._onMotion(ev);
    }
    window.addEventListener('devicemotion', this.motionHandler);
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onGps(pos),
      (err) => this._onGpsError(err),
      this.options,
    );
  }

  /** T-019/T-020: desregistra GPS + motion (reusado por _onPause e _onStop). */
  _unregisterSensors() {
    if (this.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.motionHandler && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.motionHandler);
    }
  }

  async _requestMotionPermission() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    const req = DeviceMotionEvent.requestPermission;
    if (typeof req === 'function') {
      try {
        const result = await req();
        if (result !== 'granted') {
          logger.warn('[device-provider] motion permission negada', { result });
        }
      } catch (err) {
        logger.warn('[device-provider] motion permission falhou', { err: String(err) });
      }
    }
  }

  _onGps(pos) {
    const c = pos.coords;
    // Qualidade do sinal baseada em accuracy
    if (c.accuracy == null)       this.signalQuality = SignalQuality.DEGRADED;
    else if (c.accuracy <= 5)      this.signalQuality = SignalQuality.GOOD;
    else if (c.accuracy <= 20)     this.signalQuality = SignalQuality.DEGRADED;
    else                           this.signalQuality = SignalQuality.BAD;

    this._emit({
      lat: c.latitude,
      lng: c.longitude,
      alt: c.altitude,
      speed: c.speed,         // m/s
      heading: c.heading,     // graus (0-360) ou null
      gpsAccuracy: c.accuracy,
      ...this.lastMotion,
    });
  }

  _onGpsError(err) {
    this.signalQuality = SignalQuality.LOST;
    logger.warn('[device-provider] gps erro', { code: err.code, msg: err.message });
  }

  _onMotion(ev) {
    // iOS: accelerationIncludingGravity ou acceleration (sem gravidade)
    const a = ev.acceleration || ev.accelerationIncludingGravity || {};
    const r = ev.rotationRate || {};
    this.lastMotion = {
      accLong: a.x ?? null,     // longitudinal
      accLat:  a.y ?? null,     // lateral
      accVert: a.z ?? null,     // vertical
      gyroX:   r.alpha ?? null,
      gyroY:   r.beta  ?? null,
      gyroZ:   r.gamma ?? null,
    };
  }

  _onPause() {
    // T-019 / A-009: pausar interrompe sensores (economia de bateria)
    this._unregisterSensors();
  }

  _onResume() {
    // T-020 / A-010: resume re-registra
    this._registerSensors();
  }

  async _onStop() {
    this._unregisterSensors();
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
  }
}
