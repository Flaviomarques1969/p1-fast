// ═══════════════════════════════════════════════════════════
// StintPlan — plano estruturado antes do stint
// ═══════════════════════════════════════════════════════════
// Decisão de domínio (2026-04-23): antes de sair pra pista, o piloto
// escolhe: meta + tipo de abordagem + trechos-foco. Pode ser refinado
// durante o dia (N planos por session).
//
// - meta              : rótulo curto do objetivo ("Atacar Placar", "Pneus novos", etc)
// - abordagem         : 'progressiva' | 'agressiva' | 'conservadora' | 'exploracao'
// - trechosFoco       : [segmentId] — trechos (curvas) a priorizar
// - focusModeOrigem   : 'auto' | 'piloto' | 'engenheiro' — quem arma FocusMode
// - notas             : texto livre
//
// Um sessionId pode ter múltiplos planos (histórico). O ATIVO é o último criado.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'StintPlan';

export const Abordagem = Object.freeze({
  PROGRESSIVA:   'progressiva',
  AGRESSIVA:     'agressiva',
  CONSERVADORA:  'conservadora',
  EXPLORACAO:    'exploracao',
});

export const FocusModeOrigem = Object.freeze({
  AUTO:       'auto',        // sistema escolhe baseado em attackTrechos
  PILOTO:     'piloto',      // piloto escolhe manualmente
  ENGENHEIRO: 'engenheiro',  // engenheiro sugere do box
});

export const METAS_CANONICAS = [
  'Atacar volta rápida',
  'Consistência',
  'Pneus novos — aquecer',
  'Pneus gastos — preservar',
  'Testar setup novo',
  'Reconhecimento de pista',
  'Exploração de limite',
  'Treino de ultrapassagem',
];

function validate(p) {
  if (!p.sessionId) throw new Error('StintPlan.sessionId obrigatório');
  if (!p.meta || !String(p.meta).trim()) throw new Error('StintPlan.meta obrigatório');
  if (!Object.values(Abordagem).includes(p.abordagem)) {
    throw new Error(`StintPlan.abordagem inválido: ${p.abordagem}`);
  }
  if (p.focusModeOrigem && !Object.values(FocusModeOrigem).includes(p.focusModeOrigem)) {
    throw new Error(`StintPlan.focusModeOrigem inválido: ${p.focusModeOrigem}`);
  }
  if (!Array.isArray(p.trechosFoco)) throw new Error('StintPlan.trechosFoco deve ser array');
  if (p.nVoltasAlvo == null || !(p.nVoltasAlvo > 0)) {
    throw new Error('StintPlan.nVoltasAlvo obrigatório (informado antes de cada stint)');
  }
  return true;
}

export const StintPlans = {
  async create({ sessionId, meta, nVoltasAlvo, abordagem = Abordagem.PROGRESSIVA, trechosFoco = [], focusModeOrigem = FocusModeOrigem.AUTO, notas = null }) {
    const plan = {
      id: uid('spln'),
      sessionId,
      meta: String(meta).trim(),
      nVoltasAlvo: Number(nVoltasAlvo),
      abordagem,
      trechosFoco,
      focusModeOrigem,
      notas,
      criadoEm: Date.now(),
    };
    validate(plan);
    await db.stintPlans.add(plan);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: plan.id, payload: plan });
    logger.info('[stint-plan] criado', { id: plan.id, sessionId, meta });
    return plan;
  },

  async listBySession(sessionId) {
    const all = await db.stintPlans.where('sessionId').equals(sessionId).toArray();
    return all.sort((a, b) => a.criadoEm - b.criadoEm);
  },

  async getAtivo(sessionId) {
    const all = await this.listBySession(sessionId);
    return all.length ? all[all.length - 1] : null;
  },

  async delete(id) {
    await db.stintPlans.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
  },
};
