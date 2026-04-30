// ═══════════════════════════════════════════════════════════
// AdaptiveTick — taxa do snapshot regulada pela qualidade do IMU
// ═══════════════════════════════════════════════════════════
// Decisão de design (Flavio 2026-04-29, achado #4 da auditoria 2026-04-28):
// Detector.consumeSnapshot + crossValidationEngine.consume são alimentados
// por UM tick que sobe pra `highHz` quando há fonte rápida (IMU) saudável e
// cai pra `lowHz` quando IMU degrada ou some.
//
// Por que adaptativo:
//   • iPhone GPS é 1Hz, IMU é 50-100Hz. RaceBox IMU vai a 100Hz.
//   • 60Hz só compensa quando IMU realmente entrega — sob bateria fraca,
//     térmico alto ou sem provider, virar 60Hz só queima CPU sem ganho.
//   • CrossValidation tem janelas de 0.5–2s; 10Hz cobre. Detector pega
//     entrada/saída de trecho com 10Hz tranquilo. 60Hz dá fineza extra
//     pra apex/freio quando os dados sustentam.
//
// Heurística: percorre `timebase.sourceStatus()`, declara "fonte rápida
// saudável" quando ALGUMA fonte tem `expectedRateHz >= threshold`,
// `quality === 'OK'` e `ratePerSec >= 0.7 × expectedRateHz`. Sem fonte
// rápida saudável → low. Re-avalia a cada `evalIntervalMs`.
//
// Multi-consumer: caller subscreve com `onTick(cb)`. Um único subscriber
// no timebase redistribui pra todos. Trocar de taxa NÃO afeta subscribers.

import { Quality } from '../domain/data-quality.js';
import { logger } from '../core/logger.js';

const DEFAULTS = Object.freeze({
  highHz:         60,
  lowHz:          10,
  evalIntervalMs: 5000,
  fastRateHz:     30,    // expectedRateHz mínimo pra fonte ser candidata a "rápida"
  rateFloorPct:   0.7,   // ratePerSec >= rateFloorPct × expectedRateHz
});

/**
 * Cria controlador de tick adaptativo.
 *
 * @param {object} timebase  TelemetryTimebase com .onTick(rateHz, cb) e .sourceStatus()
 * @param {object} [opts]
 * @returns {{ start, stop, onTick, currentRate, evaluateNow }}
 */
export function createAdaptiveTick(timebase, opts = {}) {
  if (!timebase || typeof timebase.onTick !== 'function' || typeof timebase.sourceStatus !== 'function') {
    throw new Error('createAdaptiveTick requer timebase com onTick + sourceStatus');
  }
  const cfg = { ...DEFAULTS, ...opts };
  const subscribers = new Set();
  let _currentRate = cfg.lowHz;
  let _unsubFromTb = null;
  let _evalTimer = null;
  let _started = false;

  function _dispatch(snap) {
    for (const cb of subscribers) {
      try { cb(snap); }
      catch (err) { logger.error('[adaptive-tick] subscriber falhou', { err: String(err) }); }
    }
  }

  function _reSubscribe(rate) {
    if (rate === _currentRate && _unsubFromTb) return;
    if (_unsubFromTb) { _unsubFromTb(); _unsubFromTb = null; }
    _unsubFromTb = timebase.onTick(rate, _dispatch);
    _currentRate = rate;
    logger.info('[adaptive-tick] taxa', { rateHz: rate });
  }

  function _hasFastHealthySource() {
    const status = timebase.sourceStatus();
    for (const name of Object.keys(status)) {
      const s = status[name];
      if (!s) continue;
      // expectedRateHz vem do attachSource; ratePerSec é medido por intervalos.
      const expected = s.expectedRateHz;
      const measured = s.ratePerSec;
      if (!Number.isFinite(expected) || expected < cfg.fastRateHz) continue;
      if (s.quality !== Quality.OK) continue;
      if (!Number.isFinite(measured) || measured < expected * cfg.rateFloorPct) continue;
      return true;
    }
    return false;
  }

  function evaluateNow() {
    if (!_started) return;
    const target = _hasFastHealthySource() ? cfg.highHz : cfg.lowHz;
    if (target !== _currentRate) _reSubscribe(target);
  }

  return {
    start() {
      if (_started) return;
      _started = true;
      _reSubscribe(cfg.lowHz);
      _evalTimer = setInterval(evaluateNow, cfg.evalIntervalMs);
      evaluateNow();
    },
    stop() {
      if (!_started) return;
      _started = false;
      if (_unsubFromTb) { _unsubFromTb(); _unsubFromTb = null; }
      if (_evalTimer)   { clearInterval(_evalTimer); _evalTimer = null; }
      subscribers.clear();
    },
    onTick(cb) {
      if (typeof cb !== 'function') throw new Error('onTick requer callback');
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    currentRate: () => _currentRate,
    evaluateNow,
  };
}

