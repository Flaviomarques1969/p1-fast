// ═══════════════════════════════════════════════════════════
// ReplayEngine — re-alimenta o pipeline com samples gravados
// ═══════════════════════════════════════════════════════════
// Pega uma sequência de samples já gravada (array em memória) e
// re-emite via onSample(cb) — interface igual à do TelemetryProvider,
// pra encaixar no SessionRecorder mode='sample' sem nenhuma mudança
// no Detector ou downstream.
//
// Não estende TelemetryProvider de propósito: replay deve ser
// não-destrutivo. Não enfileira em sample-store, não toca no DB,
// não chama applyProjection de novo (assume samples já projetados,
// ou x/y já preenchidos pela origem dos dados).
//
// Modos de velocidade:
//   'instant'   (default) — empurra tudo síncrono. Bom pra regressão.
//   'realtime'            — respeita deltas de sample.t (ms). Simula vivo.
//   <number>              — multiplicador (2 = 2x mais rápido, 0.5 = metade).
//
// Pause/resume/stop espelham o contrato de Provider:
//   start() retorna Promise que resolve quando todos os samples
//   foram emitidos OU quando stop() foi chamado (resolve, não rejeita).
//   pause() congela o cursor; resume() continua de onde parou.

const VALID_SPEED_MODES = new Set(['instant', 'realtime']);

const STATE_IDLE = 'idle';
const STATE_RUNNING = 'running';
const STATE_PAUSED = 'paused';
const STATE_STOPPED = 'stopped';

export class ReplayEngine {
  /**
   * @param {object} cfg
   * @param {Array<object>} cfg.samples   sequência ordenada por t. Não copiado — não mute.
   * @param {string} [cfg.sessionId]      sobrepõe sample.sessionId no emit (útil pra regredir uma sessão antiga sob novo id).
   * @param {string} [cfg.source='replay'] sobrepõe sample.source.
   * @param {'instant'|'realtime'|number} [cfg.speed='instant']
   * @param {(ms:number,fn:Function)=>any} [cfg.scheduler] injeção pra teste (default setTimeout).
   * @param {(id:any)=>void} [cfg.cancelScheduler] (default clearTimeout).
   */
  constructor(cfg = {}) {
    if (!Array.isArray(cfg.samples)) {
      throw new Error('[replay] samples deve ser array');
    }
    if (cfg.samples.length === 0) {
      throw new Error('[replay] samples vazio');
    }

    let speedMode = 'instant';
    let speedFactor = 1;
    if (cfg.speed != null) {
      if (typeof cfg.speed === 'number') {
        if (!(cfg.speed > 0) || !Number.isFinite(cfg.speed)) {
          throw new Error('[replay] speed numérico deve ser > 0');
        }
        speedMode = 'realtime';
        speedFactor = cfg.speed;
      } else if (typeof cfg.speed === 'string') {
        if (!VALID_SPEED_MODES.has(cfg.speed)) {
          throw new Error(`[replay] speed inválido: ${cfg.speed}`);
        }
        speedMode = cfg.speed;
      } else {
        throw new Error('[replay] speed deve ser string ou número');
      }
    }

    this.samples = cfg.samples;
    this.sessionId = cfg.sessionId || null;
    this.source = cfg.source || 'replay';
    this.speedMode = speedMode;        // 'instant' | 'realtime'
    this.speedFactor = speedFactor;    // só usado em realtime
    this._scheduler = cfg.scheduler || ((ms, fn) => setTimeout(fn, ms));
    this._cancel = cfg.cancelScheduler || ((id) => clearTimeout(id));

    this.listeners = new Set();
    this.state = STATE_IDLE;
    this.cursor = 0;                   // próximo índice a emitir
    this.emitted = 0;
    this.dropped = 0;                  // samples descartados por t não-monotônico
    this._lastT = null;
    this._timer = null;
    this._resolveStart = null;
    this._startPromise = null;
  }

  /** Inscreve callback. Retorna função de unsubscribe. */
  onSample(cb) {
    if (typeof cb !== 'function') throw new Error('[replay] onSample requer função');
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Liga o replay. Em mode='instant', emite tudo síncrono e a Promise
   * resolve no mesmo tick. Em mode='realtime', resolve depois do último
   * sample (ou no stop()).
   *
   * @returns {Promise<{emitted:number, dropped:number, completed:boolean}>}
   */
  start() {
    if (this.state === STATE_RUNNING) {
      return Promise.reject(new Error('[replay] já rodando'));
    }
    if (this.state === STATE_STOPPED) {
      return Promise.reject(new Error('[replay] já parado — recrie a instância'));
    }
    this.state = STATE_RUNNING;

    if (this.speedMode === 'instant') {
      this._drainSync();
      this.state = STATE_STOPPED;
      return Promise.resolve(this._stats(true));
    }

    this._startPromise = new Promise((resolve) => { this._resolveStart = resolve; });
    this._scheduleNext();
    return this._startPromise;
  }

  /** Pausa o cursor. No-op fora de RUNNING. */
  pause() {
    if (this.state !== STATE_RUNNING) return;
    if (this._timer != null) {
      this._cancel(this._timer);
      this._timer = null;
    }
    this.state = STATE_PAUSED;
  }

  /** Continua de onde parou. No-op fora de PAUSED. */
  resume() {
    if (this.state !== STATE_PAUSED) return;
    this.state = STATE_RUNNING;
    this._scheduleNext();
  }

  /** Para definitivamente. Resolve a promise de start() com completed=false. */
  stop() {
    if (this.state === STATE_STOPPED || this.state === STATE_IDLE) return;
    if (this._timer != null) {
      this._cancel(this._timer);
      this._timer = null;
    }
    this.state = STATE_STOPPED;
    if (this._resolveStart) {
      const r = this._resolveStart;
      this._resolveStart = null;
      r(this._stats(false));
    }
  }

  stats() {
    return {
      state: this.state,
      cursor: this.cursor,
      emitted: this.emitted,
      dropped: this.dropped,
      total: this.samples.length,
      speedMode: this.speedMode,
      speedFactor: this.speedFactor,
    };
  }

  // ── interno ────────────────────────────────────────────────

  _drainSync() {
    while (this.cursor < this.samples.length) {
      this._emitOne(this.samples[this.cursor++]);
    }
  }

  _scheduleNext() {
    if (this.state !== STATE_RUNNING) return;
    if (this.cursor >= this.samples.length) {
      this.state = STATE_STOPPED;
      if (this._resolveStart) {
        const r = this._resolveStart;
        this._resolveStart = null;
        r(this._stats(true));
      }
      return;
    }
    const current = this.samples[this.cursor];
    let waitMs = 0;
    if (this._lastT != null && current && typeof current.t === 'number') {
      const delta = current.t - this._lastT;
      if (delta > 0) waitMs = delta / this.speedFactor;
    }
    this._timer = this._scheduler(waitMs, () => {
      this._timer = null;
      if (this.state !== STATE_RUNNING) return;
      this._emitOne(this.samples[this.cursor++]);
      this._scheduleNext();
    });
  }

  _emitOne(sample) {
    if (!sample || typeof sample !== 'object') {
      this.dropped++;
      return;
    }
    if (typeof sample.t === 'number') {
      if (this._lastT != null && sample.t < this._lastT) {
        // t retrocedeu — pipeline assume monotonia. Conta como drop e pula.
        this.dropped++;
        return;
      }
      this._lastT = sample.t;
    }
    const out = this.sessionId
      ? { ...sample, source: this.source, sessionId: this.sessionId }
      : { ...sample, source: this.source };
    this.emitted++;
    for (const cb of this.listeners) {
      try { cb(out); } catch { /* listener é responsável por seus erros */ }
    }
  }

  _stats(completed) {
    return {
      emitted: this.emitted,
      dropped: this.dropped,
      completed,
    };
  }
}
