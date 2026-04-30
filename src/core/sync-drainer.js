// ═══════════════════════════════════════════════════════════
// SyncDrainer — drena syncQueue
// ═══════════════════════════════════════════════════════════
// ADR-009 abre caminho: nas fases 0-19 a fila SÓ acumulava.
// Agora existe um drainer com "send handler" injetado.
// Send handler é uma função async(entry) → { ok, erro? }.
// V1: sem handler → modo "pass-through" = marca done (útil em dev/teste
// e quando piloto está 100% local-first sem backend).
//
// Exponencial backoff simples: 1s, 4s, 16s, 60s (cap).

import { db } from './db.js';
import { logger } from './logger.js';
import { syncQueue, SyncStatus } from './sync-queue.js';

const BACKOFFS_MS = [1000, 4000, 16000, 60000];
const MAX_TENTATIVAS = 8;

function nextDelay(tentativas) {
  const i = Math.min(tentativas, BACKOFFS_MS.length - 1);
  return BACKOFFS_MS[i];
}

export class SyncDrainer {
  constructor(opts = {}) {
    this.handler = opts.handler || null;  // async (entry) → { ok, erro? }
    this.batchSize = opts.batchSize ?? 20;
    this.intervalMs = opts.intervalMs ?? 5000;
    this._timer = null;
    this._started = false;     // T-021: separar "intenção de rodar" de "tick em execução"
    this._ticking = false;
    this.history = [];
  }

  setHandler(fn) { this.handler = fn; }

  /**
   * T-021 / A-027: setTimeout recursivo com flag `_ticking` evita concorrência
   * quando drainOnce() demora mais que intervalMs. Execuções sempre serializam.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._schedule(0);
    logger.info('[sync-drainer] start', { batchSize: this.batchSize, intervalMs: this.intervalMs });
  }

  _schedule(delay = this.intervalMs) {
    if (!this._started) return;
    this._timer = setTimeout(async () => {
      if (this._ticking) { this._schedule(); return; }  // já rodando: remarca simples
      this._ticking = true;
      try { await this._tick(); }
      finally { this._ticking = false; this._schedule(); }
    }, delay);
  }

  stop() {
    this._started = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    logger.info('[sync-drainer] stop');
  }

  async _tick() {
    try {
      await this.drainOnce();
    } catch (err) {
      logger.error('[sync-drainer] tick falhou', { err: String(err) });
    }
  }

  /**
   * Drena 1 batch. Retorna contagem de ok/fail/noop.
   * Se handler == null, marca tudo como DONE (pass-through).
   */
  async drainOnce() {
    const batch = await syncQueue.getPending(this.batchSize);
    if (batch.length === 0) return { ok: 0, fail: 0, pass: 0 };
    let ok = 0, fail = 0, pass = 0;
    for (const entry of batch) {
      await syncQueue.setStatus(entry.id, SyncStatus.SYNCING);
      if (!this.handler) {
        await syncQueue.setStatus(entry.id, SyncStatus.DONE);
        this._record(entry.id, 'pass');
        pass++;
        continue;
      }
      try {
        const res = await this.handler(entry);
        if (res && res.ok) {
          await syncQueue.setStatus(entry.id, SyncStatus.DONE);
          this._record(entry.id, 'ok');
          ok++;
        } else {
          await syncQueue.incrementarTentativas(entry.id);
          const novaEntrada = await db.syncQueue.get(entry.id);
          const tent = novaEntrada?.tentativas ?? 0;
          if (tent >= MAX_TENTATIVAS) {
            await syncQueue.setStatus(entry.id, SyncStatus.FAILED, res?.erro || 'max tentativas');
          } else {
            // volta pra pending; drainer retenta depois do backoff (caller controla intervalo)
            await syncQueue.setStatus(entry.id, SyncStatus.PENDING, res?.erro || null);
          }
          this._record(entry.id, 'fail');
          fail++;
        }
      } catch (err) {
        await syncQueue.setStatus(entry.id, SyncStatus.PENDING, String(err));
        this._record(entry.id, 'error');
        fail++;
      }
    }
    return { ok, fail, pass };
  }

  _record(id, resultado) {
    this.history.push({ t: Date.now(), id, resultado });
    if (this.history.length > 500) this.history.shift();
  }

  stats() {
    const porResultado = {};
    for (const h of this.history) porResultado[h.resultado] = (porResultado[h.resultado] || 0) + 1;
    return { historySize: this.history.length, running: this._started, ticking: this._ticking, porResultado };
  }
}

export const syncDrainer = new SyncDrainer();
export { nextDelay, BACKOFFS_MS, MAX_TENTATIVAS };
