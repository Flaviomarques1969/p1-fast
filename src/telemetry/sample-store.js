// ═══════════════════════════════════════════════════════════
// sample-store — persistência append-only de telemetria
// ═══════════════════════════════════════════════════════════
// REGRA FUNDAMENTAL (ADR-004):
//   Samples NÃO são editáveis nem deletáveis individualmente.
//   Única exceção: purge de sessão inteira (admin/dev).
//
// ADR-014:
//   telemetrySamples é a ÚNICA store que não enfileira row-a-row em
//   syncQueue (volume ≈ 36 000 rows/h tornaria o drainer inviável).
//   Sincronização remota, quando existir, será por batch/arquivo.
//
// Escrita: batch buffered a cada ~10 samples ou 500ms (reduz overhead IDB).
// Leitura: por sessionId, range de seq ou tempo.

import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

// T-031 / A-036: batch maior + flush menos frequente = ~75% menos I/O IDB
const BATCH_SIZE = 50;        // amostras por flush
const FLUSH_INTERVAL_MS = 1000;

/**
 * T-031: compacta sample removendo campos null/undefined antes da persistência.
 * Reduz payload típico em ~30% (muitos gyro/acc null em providers simples).
 */
function compactSample(s) {
  const out = {};
  for (const k in s) {
    const v = s[k];
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
export { compactSample };

export class SampleStore {
  constructor() {
    this.buffer = [];
    this.flushTimer = null;
    this.totalPersisted = 0;
  }

  /** Empurra sample pro buffer. Flush automático por tamanho ou tempo. */
  enqueue(sample) {
    this.buffer.push(sample);
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  /** Flush imediato do buffer no IndexedDB. */
  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;
    // T-031: compactar antes do bulkAdd
    const toWrite = this.buffer.splice(0).map(compactSample);
    try {
      await db.telemetrySamples.bulkAdd(toWrite);
      this.totalPersisted += toWrite.length;
    } catch (err) {
      logger.error('[sample-store] flush falhou', { err: String(err), samples: toWrite.length });
      // devolve pro buffer pra tentar depois
      this.buffer.unshift(...toWrite);
    }
  }

  /** Força flush de tudo pendente (chamar ao parar sessão). */
  async drain() {
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /** Lê samples de uma sessão, em ordem de seq. */
  async getBySession(sessionId, { from = 0, to = Infinity } = {}) {
    return db.telemetrySamples
      .where('[sessionId+seq]')
      .between([sessionId, from], [sessionId, to])
      .toArray();
  }

  async countBySession(sessionId) {
    return db.telemetrySamples.where('sessionId').equals(sessionId).count();
  }

  /** Purga samples de uma sessão (uso dev/admin). */
  async purgeSession(sessionId) {
    const n = await db.telemetrySamples.where('sessionId').equals(sessionId).delete();
    logger.warn('[sample-store] sessão purgada', { sessionId, samples: n });
    return n;
  }

  stats() {
    return {
      buffered: this.buffer.length,
      totalPersisted: this.totalPersisted,
    };
  }
}

export const sampleStore = new SampleStore();
