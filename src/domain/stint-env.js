// ═══════════════════════════════════════════════════════════
// StintEnvironment — pneu + ambiente por stint (sessão)
// ═══════════════════════════════════════════════════════════
// Dados informados no planejamento do stint e ao voltar ao box:
//   • pressaoD, pressaoT       — manual, saída do box (bar)
//   • pneuTempD[4], pneuTempT[4] — pirômetro 4 pontos, pós-stint
//   • desgasteNivelD, desgasteNivelT — 0..3 (novo..usado) no momento do install
//   • composto                 — lookup de pneu (texto livre por ora)
//   • tempPista, tempAr        — °C (manhã + medida do stint)
//   • voltasNoPneuD, voltasNoPneuT — contador para aprendizado de vida útil
//
// Um sessionId tem UM stintEnvironment (1:1).

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'StintEnvironment';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

export const StintEnvironment = {
  async getBySession(sessionId) {
    const all = await db.stintEnvironment.where('sessionId').equals(sessionId).toArray();
    return all[0] || null;
  },

  async upsert(sessionId, data) {
    const existing = await this.getBySession(sessionId);
    if (existing) {
      const merged = { ...existing, ...data, atualizadoEm: Date.now() };
      await db.stintEnvironment.put(merged);
      await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: merged.id, payload: merged });
      return merged;
    }
    const created = {
      id: uid('senv'),
      sessionId,
      pressaoD: null,
      pressaoT: null,
      pneuTempD: [],
      pneuTempT: [],
      desgasteNivelD: null,
      desgasteNivelT: null,
      composto: null,
      tempPista: null,
      tempAr: null,
      tanqueLitros: null,          // capacidade total do tanque
      combustivelInicialL: null,   // litros no início do stint (informado)
      consumoMedioLVolta: null,    // preenchido pós-stint (real) ou estimativa
      ...data,
      ...defaults(),
    };
    await db.stintEnvironment.add(created);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: created.id, payload: created });
    logger.info('[stint-env] criado', { id: created.id, sessionId });
    return created;
  },

  async delete(sessionId) {
    const existing = await this.getBySession(sessionId);
    if (!existing) return;
    await db.stintEnvironment.delete(existing.id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: existing.id, payload: null });
  },
};

export const DesgasteNivelLabels = Object.freeze({
  0: 'Novo',
  1: 'Pouco uso',
  2: 'Usado',
  3: 'Desgastado',
});
