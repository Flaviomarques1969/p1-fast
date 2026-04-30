// ═══════════════════════════════════════════════════════════
// sync-queue — fila de operações pendentes de sincronização
// ═══════════════════════════════════════════════════════════
// NESTA FASE (0) a fila só ACUMULA. Não existe consumer ainda.
// Próximas fases vão drenar a fila contra um backend (Supabase, etc).
//
// Regra: TODA mutação em entidade de domínio ENFILEIRA aqui.
// Isso garante que quando o sync chegar, nada se perde.

import { db } from './db.js';
import { logger } from './logger.js';

/** Estados possíveis de uma operação */
export const SyncStatus = Object.freeze({
  PENDING: 'pending',
  SYNCING: 'syncing',
  DONE:    'done',
  FAILED:  'failed',
});

/** Tipos de operação */
export const SyncOp = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
});

export const syncQueue = {
  /**
   * Enfileira uma operação.
   * @param {object} op
   * @param {'create'|'update'|'delete'} op.tipo
   * @param {string} op.entidade  - nome da entidade ('User', 'Car', ...)
   * @param {string} op.entidadeId
   * @param {object} op.payload   - estado atual da entidade
   * @returns {Promise<number>} id da linha na fila
   */
  async enqueue(op) {
    if (!op || !op.tipo || !op.entidade || !op.entidadeId) {
      throw new Error('[sync-queue] op inválida');
    }
    const entry = {
      tipo: op.tipo,
      entidade: op.entidade,
      entidadeId: op.entidadeId,
      payload: op.payload || null,
      timestamp: Date.now(),
      tentativas: 0,
      status: SyncStatus.PENDING,
      erro: null,
    };
    const id = await db.syncQueue.add(entry);
    logger.debug('[sync-queue] enqueue', { id, tipo: op.tipo, entidade: op.entidade, entidadeId: op.entidadeId });
    return id;
  },

  /** Lista pendentes (ordenados por timestamp) */
  async getPending(limit = 100) {
    return db.syncQueue
      .where('status').equals(SyncStatus.PENDING)
      .limit(limit)
      .toArray();
  },

  /** Conta pendentes */
  async countPending() {
    return db.syncQueue.where('status').equals(SyncStatus.PENDING).count();
  },

  /** Atualiza status de uma entrada (usado pelo futuro drainer) */
  async setStatus(id, status, erro = null) {
    if (!Object.values(SyncStatus).includes(status)) {
      throw new Error(`[sync-queue] status inválido: ${status}`);
    }
    await db.syncQueue.update(id, { status, erro });
  },

  /** Incrementa tentativas (pra exponential backoff no drainer futuro) */
  async incrementarTentativas(id) {
    const atual = await db.syncQueue.get(id);
    if (!atual) return;
    await db.syncQueue.update(id, { tentativas: (atual.tentativas || 0) + 1 });
  },

  /** Limpa toda a fila (uso dev/diagnóstico) */
  async clearAll() {
    const n = await db.syncQueue.count();
    await db.syncQueue.clear();
    logger.warn('[sync-queue] fila limpa', { linhasRemovidas: n });
  },

  /** Estatísticas */
  async stats() {
    const [pending, syncing, done, failed] = await Promise.all([
      db.syncQueue.where('status').equals(SyncStatus.PENDING).count(),
      db.syncQueue.where('status').equals(SyncStatus.SYNCING).count(),
      db.syncQueue.where('status').equals(SyncStatus.DONE).count(),
      db.syncQueue.where('status').equals(SyncStatus.FAILED).count(),
    ]);
    return { pending, syncing, done, failed };
  },
};
