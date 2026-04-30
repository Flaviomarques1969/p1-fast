// ═══════════════════════════════════════════════════════════
// PedagogicalPlan — plano pedagógico do stint
// ═══════════════════════════════════════════════════════════
// Regra inviolável (SPEC §23.3):
//   - 1 meta principal por stint
//   - no máximo 3 parciais foco
//   - 1 única ação principal por parcial foco
//
// Parciais são dinâmicas (N por pista), identificadas por `parcialId`.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'PedagogicalPlan';
const MAX_FOCOS = 3;

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validateFocos(focos) {
  if (!Array.isArray(focos)) throw new Error('focos deve ser array');
  if (focos.length > MAX_FOCOS) {
    throw new Error(`máximo ${MAX_FOCOS} focos por stint — recebeu ${focos.length}`);
  }
  const ids = focos.map(f => f.parcialId);
  if (new Set(ids).size !== ids.length) throw new Error('não pode repetir parcial em focos');
  for (const f of focos) {
    if (!f.parcialId) throw new Error('foco sem parcialId');
    if (!f.acaoPrincipal || typeof f.acaoPrincipal !== 'string' || !f.acaoPrincipal.trim()) {
      throw new Error(`foco ${f.parcialId} sem ação principal`);
    }
  }
}

function validate(data) {
  if (!data.sessionId) throw new Error('sessionId obrigatório');
  if (!data.metaPrincipal?.trim()) throw new Error('metaPrincipal obrigatória (1 frase)');
  validateFocos(data.focos || []);
  return true;
}

/**
 * @typedef {Object} PlanoFoco
 * @property {string} parcialId          id da parcial do TrackLayout
 * @property {string} [parcialNome]      snapshot do nome para UI
 * @property {string} acaoPrincipal      frase da biblioteca SPEC_MENSAGENS §6.1
 * @property {string} [justificativa]    texto pedagógico opcional
 */

export const PedagogicalPlans = {
  MAX_FOCOS,

  async create({ sessionId, metaPrincipal, criterioSucesso = null, focos = [] }) {
    const plan = {
      id: uid('plan'),
      sessionId,
      metaPrincipal: metaPrincipal?.trim(),
      criterioSucesso: criterioSucesso?.trim() || null,
      focos: focos.map(f => ({
        parcialId: f.parcialId,
        parcialNome: f.parcialNome || null,
        acaoPrincipal: f.acaoPrincipal.trim(),
        justificativa: f.justificativa?.trim() || null,
      })),
      ...defaults(),
    };
    validate(plan);
    await db.pedagogicalPlans.add(plan);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: plan.id, payload: plan });
    logger.info('[pedag] plano criado', { id: plan.id, sessionId, focos: plan.focos.length });
    return plan;
  },

  async get(id) { return db.pedagogicalPlans.get(id); },

  async getBySession(sessionId) {
    const all = await db.pedagogicalPlans.where('sessionId').equals(sessionId).toArray();
    return all.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0] || null;
  },

  async update(id, patch) {
    const existing = await db.pedagogicalPlans.get(id);
    if (!existing) throw new Error(`plan ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.pedagogicalPlans.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    return merged;
  },

  async delete(id) {
    await db.pedagogicalPlans.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
  },

  /**
   * Sugestão automática baseada em AttackPriority.top3.
   */
  suggestFrom({ attackPriority, metaHint = null } = {}) {
    if (!attackPriority?.top3?.length) return null;
    const focos = attackPriority.top3
      .slice(0, MAX_FOCOS)
      .filter(t => !t.razao.includes('consolidar'))
      .map(t => ({
        parcialId: t.parcialId,
        parcialNome: t.parcialNome,
        acaoPrincipal: _acaoDefault(t),
        justificativa: t.razao,
      }));
    if (focos.length === 0) return null;

    const metaPrincipal = metaHint
      ?? (focos.length === 1
          ? `melhorar ${focos[0].parcialNome || focos[0].parcialId}`
          : `atacar ${focos.map(f => f.parcialNome || f.parcialId).join(' + ')}`);

    const criterioSucesso =
      `reduzir tempo médio em ${focos.map(f => f.parcialNome || f.parcialId).join('/')} em pelo menos 1% na próxima saída`;

    return { metaPrincipal, criterioSucesso, focos };
  },
};

function _acaoDefault(attackItem) {
  const alvo = attackItem.parcialNome || attackItem.parcialId;
  if (attackItem.razao.includes('atacável')) return `reduzir tempo em ${alvo}`;
  if (attackItem.razao.includes('moderado')) return `trabalhar execução de ${alvo}`;
  return `focar em ${alvo}`;
}
