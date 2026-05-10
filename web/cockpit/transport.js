// Transport — escolhe entre cabo USB (primário) e Supabase Realtime (fallback)
// pra entregar IMU/GPS do iPhone ao cockpit web do notebook Windows.
//
// Spec: PLANO_FASE_1.md §6 MS-13.4 (reescrito 2026-05-09 amendment 2 — ADR-023)
// Mockup canônico: zero impacto (transport vive antes do CockpitState).
//
// Princípio:
// - "primary"  = cabo USB (TCP-over-USB via iproxy/usbmuxd) — latência 5-15 ms
// - "fallback" = Supabase Realtime canal `live-stint-{stintId}`     — latência 150-500 ms
//
// Healthcheck por heartbeat 1 Hz:
// - iPhone publica heartbeat `{ tMono, source: 'iphone-imu' }` em ambos canais
// - Selector marca primary HEALTHY ao receber heartbeat
// - Após `silenceTimeoutMs` (3 s) sem heartbeat do primary → switch pro fallback
// - Quando primary volta a heartbeatar, espera `recoveryDebounceMs` (1 s) com
//   heartbeats consistentes antes de voltar pro primary (evita flapping)
//
// Este módulo é PURO (zero IO de rede). Os transportes concretos
// (LocalSocketTransport, RealtimeTransport) implementam a interface abaixo
// e são plugados no construtor — modelo testável em Node.

export const TransportName = Object.freeze({
  PRIMARY:  'primary',
  FALLBACK: 'fallback',
});

export const TransportHealth = Object.freeze({
  HEALTHY:    'healthy',
  SILENT:     'silent',
  STARTING:   'starting',
});

export const SelectorState = Object.freeze({
  ON_PRIMARY:  'on-primary',
  ON_FALLBACK: 'on-fallback',
  RECOVERING:  'recovering', // primary voltou a heartbeat, ainda em debounce
});

// Defaults (PLANO §6 MS-2.8 + MS-13.4)
export const DEFAULTS = Object.freeze({
  heartbeatExpectedMs:  1000, // 1 Hz
  silenceTimeoutMs:     3000, // 3 s sem heartbeat → switch
  recoveryDebounceMs:   1000, // 1 s estável antes de voltar
});

/**
 * @typedef {Object} TransportEnvelope
 * @property {number} tMono              performance.now() do publisher
 * @property {string} source             'iphone-imu' | 't4000-can' | 'heartbeat' | ...
 * @property {Object} payload            o sample propriamente dito (IMU/GPS/T4000)
 */

/**
 * Interface esperada de um transporte concreto:
 *
 *   transport.start(onMessage, onError) → void
 *   transport.stop() → void
 *   transport.name (string)
 *
 * onMessage(envelope) é chamado a cada pacote recebido (incluindo heartbeat).
 * Implementações concretas: LocalSocketTransport, RealtimeTransport.
 */

// ── TransportSelector ──────────────────────────────────────────

export class TransportSelector {
  /**
   * @param {Object} opts
   * @param {Object} opts.primary    transporte primário (cabo)
   * @param {Object} opts.fallback   transporte fallback (Realtime)
   * @param {(env: any) => void} opts.onMessage   callback unificado
   * @param {(stage: string, info: any) => void} [opts.onSwitch]  observabilidade
   * @param {number} [opts.silenceTimeoutMs]
   * @param {number} [opts.recoveryDebounceMs]
   * @param {() => number} [opts.now]   injetável pra teste (ms monotônico)
   */
  constructor({
    primary,
    fallback,
    onMessage,
    onSwitch = () => {},
    silenceTimeoutMs = DEFAULTS.silenceTimeoutMs,
    recoveryDebounceMs = DEFAULTS.recoveryDebounceMs,
    now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  }) {
    if (!primary || !fallback) throw new Error('TransportSelector: primary e fallback são obrigatórios');
    if (typeof onMessage !== 'function') throw new Error('TransportSelector: onMessage precisa ser função');

    this._primary = primary;
    this._fallback = fallback;
    this._onMessage = onMessage;
    this._onSwitch = onSwitch;
    this._silenceTimeoutMs = silenceTimeoutMs;
    this._recoveryDebounceMs = recoveryDebounceMs;
    this._now = now;

    this._state = SelectorState.ON_PRIMARY;
    this._primaryHealth = TransportHealth.STARTING;
    this._lastPrimaryHeartbeatAt = null;
    this._recoveryStartedAt = null;
    this._started = false;

    this._packetsForwarded = 0;
    this._packetsDropped = 0;
    this._switchesToPrimary = 0;
    this._switchesToFallback = 0;
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._lastPrimaryHeartbeatAt = this._now();
    this._primary.start(
      (env) => this._onPrimaryMessage(env),
      (err) => this._onTransportError('primary', err),
    );
    this._fallback.start(
      (env) => this._onFallbackMessage(env),
      (err) => this._onTransportError('fallback', err),
    );
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    try { this._primary.stop(); } catch {}
    try { this._fallback.stop(); } catch {}
  }

  /**
   * Avança o relógio interno (chamado por timer do app, ou pelo smoke pra forçar tick).
   * Aplica regras de switch baseadas em silêncio do primary.
   */
  tick() {
    if (!this._started) return;
    const now = this._now();
    const sincePrimary = now - (this._lastPrimaryHeartbeatAt ?? 0);

    // Se está no primary e ficou quieto demais → switch pro fallback
    if (this._state === SelectorState.ON_PRIMARY) {
      if (sincePrimary >= this._silenceTimeoutMs) {
        this._switchTo(SelectorState.ON_FALLBACK, { reason: 'silence', sincePrimary });
      }
      return;
    }

    // Se está em recovery e o primary continua heartbeatando estável → volta
    if (this._state === SelectorState.RECOVERING) {
      // Se primary silenciou no meio da recovery, aborta e volta pra fallback
      if (sincePrimary >= this._silenceTimeoutMs) {
        this._recoveryStartedAt = null;
        this._switchTo(SelectorState.ON_FALLBACK, { reason: 'recovery-aborted' });
        return;
      }
      const recoveryDuration = now - (this._recoveryStartedAt ?? now);
      if (recoveryDuration >= this._recoveryDebounceMs) {
        this._recoveryStartedAt = null;
        this._switchTo(SelectorState.ON_PRIMARY, { reason: 'recovered' });
      }
    }
  }

  getStats() {
    return {
      state: this._state,
      primaryHealth: this._primaryHealth,
      lastPrimaryHeartbeatAgoMs: this._lastPrimaryHeartbeatAt === null
        ? null : Math.max(0, this._now() - this._lastPrimaryHeartbeatAt),
      packetsForwarded: this._packetsForwarded,
      packetsDropped: this._packetsDropped,
      switchesToPrimary: this._switchesToPrimary,
      switchesToFallback: this._switchesToFallback,
    };
  }

  // ── handlers internos ────────────────────────────────────

  _onPrimaryMessage(env) {
    if (!this._started) return;
    if (this._isHeartbeat(env)) {
      this._lastPrimaryHeartbeatAt = this._now();
      this._primaryHealth = TransportHealth.HEALTHY;
      // se está no fallback e o primary heartbeatou, abre janela de recovery
      if (this._state === SelectorState.ON_FALLBACK) {
        this._state = SelectorState.RECOVERING;
        this._recoveryStartedAt = this._now();
        this._onSwitch('recovery-started', {});
      }
      return; // heartbeat não é forwarded
    }
    // payload normal: só forwarda se estado atual é primary OU recovering
    if (this._state === SelectorState.ON_PRIMARY || this._state === SelectorState.RECOVERING) {
      this._packetsForwarded++;
      this._onMessage(env);
    } else {
      this._packetsDropped++; // dado do primary chegando enquanto está no fallback (ignora pra evitar duplicata)
    }
  }

  _onFallbackMessage(env) {
    if (!this._started) return;
    if (this._isHeartbeat(env)) {
      // heartbeat do fallback é só sinal de vida — não influencia selector
      return;
    }
    // só forwarda fallback se realmente tá nele
    if (this._state === SelectorState.ON_FALLBACK) {
      this._packetsForwarded++;
      this._onMessage(env);
    } else {
      this._packetsDropped++;
    }
  }

  _onTransportError(which, err) {
    this._onSwitch('transport-error', { which, err: String(err && err.message || err) });
  }

  _isHeartbeat(env) {
    return env && env.source === 'heartbeat';
  }

  _switchTo(newState, info) {
    const prev = this._state;
    if (prev === newState) return;
    this._state = newState;
    if (newState === SelectorState.ON_PRIMARY) this._switchesToPrimary++;
    if (newState === SelectorState.ON_FALLBACK) this._switchesToFallback++;
    this._onSwitch('state-change', { from: prev, to: newState, ...info });
  }
}

// ── Transporte de mock pra teste/dev (sem IO real) ──────────

export class MockTransport {
  constructor(name) {
    this.name = name;
    this._onMessage = null;
    this._onError = null;
    this._started = false;
  }
  start(onMessage, onError) {
    this._onMessage = onMessage;
    this._onError = onError;
    this._started = true;
  }
  stop() { this._started = false; }
  /** Helper de teste: simula um pacote chegando do transporte. */
  inject(envelope) {
    if (!this._started || !this._onMessage) return;
    this._onMessage(envelope);
  }
  injectError(err) {
    if (this._onError) this._onError(err);
  }
}
