// ═══════════════════════════════════════════════════════════
// SampleBus — multi-listener pra samples do MobileTelemetry
// ═══════════════════════════════════════════════════════════
// MobileTelemetry suporta UM callback `onSample`. Pra alimentar múltiplos
// consumidores (timebase, storage, idleWatchdog, Detector via SessionRecorder)
// no callback principal apenas chamamos `sampleBus._emit(sample)` e qualquer
// módulo se inscreve via `sampleBus.onSample(cb)`.
//
// Solução pro achado #4 da auditoria 2026-04-28: "Detector NUNCA chama
// consumeSnapshot" — agora SessionRecorder pode subscrever este bus
// passando-o como `provider` (a interface { onSample } é a mesma).

const _listeners = new Set();

export const sampleBus = {
  onSample(cb) {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
  },
  _emit(sample) {
    for (const cb of _listeners) {
      try { cb(sample); }
      catch (err) { console.error('[sample-bus] listener falhou', err); }
    }
  },
  count() { return _listeners.size; },
  clear() { _listeners.clear(); },
};
