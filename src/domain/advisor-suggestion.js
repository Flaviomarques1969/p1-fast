// ═══════════════════════════════════════════════════════════
// AdvisorSuggestion — saída da IA (Setup Advisor + Pós-stint)
// ═══════════════════════════════════════════════════════════
// Persiste cada resposta da Claude + decisão do engenheiro (approve/edit/reject).
// Alimenta feedback loop (F1): após N aprovações consistentes por piloto/tipo-pista,
// sugestões futuras podem ser mais diretas.
//
// tipo:
//   'advisor'   — sugestão de setup/linha no meio do stint
//   'posstint'  — resumo narrativo + 3 pontos-chave ao finalizar stint
//   'gap'       — gap analysis vs trilha de referência (F4)
//
// decisao:
//   'pendente' | 'aprovada' | 'editada' | 'rejeitada'

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'AdvisorSuggestion';

export const SuggestionTipo = Object.freeze({
  ADVISOR:  'advisor',
  POSSTINT: 'posstint',
  GAP:      'gap',
});

export const SuggestionDecisao = Object.freeze({
  PENDENTE:  'pendente',
  APROVADA:  'aprovada',
  EDITADA:   'editada',
  REJEITADA: 'rejeitada',
});

export const AdvisorSuggestions = {
  async create({ sessionId, tipo = SuggestionTipo.ADVISOR, payload, lapCountAtRun = null, meta = null }) {
    const s = {
      id: uid('adv'),
      sessionId,
      tipo,
      payload,           // objeto puro {sugestao, racional, prioridade, ajustes, confianca, evidencias, …}
      lapCountAtRun,     // qtd voltas no momento da sugestão (pro feedback loop)
      decisao: SuggestionDecisao.PENDENTE,
      decisaoEm: null,
      decisaoPor: null,
      payloadEditado: null,
      meta,
      criadoEm: Date.now(),
    };
    await db.advisorSuggestions.add(s);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: s.id, payload: s });
    logger.info('[advisor-suggestion] criada', { id: s.id, tipo, sessionId });
    return s;
  },

  async decidir(id, { decisao, payloadEditado = null, autor = null } = {}) {
    if (!Object.values(SuggestionDecisao).includes(decisao)) {
      throw new Error(`decisao inválida: ${decisao}`);
    }
    const existing = await db.advisorSuggestions.get(id);
    if (!existing) throw new Error(`AdvisorSuggestion ${id} não existe`);
    const merged = {
      ...existing,
      decisao,
      decisaoEm: Date.now(),
      decisaoPor: autor,
      payloadEditado: decisao === SuggestionDecisao.EDITADA ? payloadEditado : null,
    };
    await db.advisorSuggestions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[advisor-suggestion] decidida', { id, decisao });
    return merged;
  },

  async listBySession(sessionId) {
    const all = await db.advisorSuggestions.where('sessionId').equals(sessionId).toArray();
    return all.sort((a, b) => a.criadoEm - b.criadoEm);
  },

  async listByTipo(tipo) {
    const all = await db.advisorSuggestions.toArray();
    return all.filter(s => s.tipo === tipo).sort((a, b) => a.criadoEm - b.criadoEm);
  },

  /** Stats simples pra alimentar o feedback loop (F1). */
  async approvalRate(filter = {}) {
    const all = await db.advisorSuggestions.toArray();
    const rel = all.filter(s => {
      if (filter.tipo && s.tipo !== filter.tipo) return false;
      if (filter.sessionId && s.sessionId !== filter.sessionId) return false;
      return s.decisao !== SuggestionDecisao.PENDENTE;
    });
    if (!rel.length) return { total: 0, aprovadas: 0, editadas: 0, rejeitadas: 0, taxa: null };
    const aprov = rel.filter(s => s.decisao === SuggestionDecisao.APROVADA).length;
    const edit  = rel.filter(s => s.decisao === SuggestionDecisao.EDITADA).length;
    const rej   = rel.filter(s => s.decisao === SuggestionDecisao.REJEITADA).length;
    return {
      total: rel.length,
      aprovadas: aprov,
      editadas: edit,
      rejeitadas: rej,
      taxa: (aprov + edit * 0.5) / rel.length,
    };
  },
};
