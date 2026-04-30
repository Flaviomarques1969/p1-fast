// ═══════════════════════════════════════════════════════════
// User — piloto / dono da conta
// ═══════════════════════════════════════════════════════════
// V1: single-user (Flavio). Estrutura preparada pra multi.
// Regra: id primário = 'usr_primary' quando single-user.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'User';
const PRIMARY_ID = 'usr_primary';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.nome || typeof data.nome !== 'string' || data.nome.trim().length === 0) {
    throw new Error('User.nome obrigatório');
  }
  return true;
}

export const Users = {
  /** Cria user (não primary) */
  async create({ nome, email = null, avatar = null }) {
    validate({ nome });
    const user = {
      id: uid('usr'),
      nome: nome.trim(),
      email: email ? String(email).trim().toLowerCase() : null,
      avatar,
      ...defaults(),
    };
    await db.users.add(user);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: user.id, payload: user });
    logger.info('[user] criado', { id: user.id, nome: user.nome });
    return user;
  },

  /** Garante que existe um user principal (single-user V1) */
  async getOrCreatePrimary() {
    const existing = await db.users.get(PRIMARY_ID);
    if (existing) return existing;
    const user = {
      id: PRIMARY_ID,
      nome: 'Piloto',
      email: null,
      avatar: null,
      ...defaults(),
    };
    await db.users.add(user);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: user.id, payload: user });
    logger.info('[user] primary criado', { id: user.id });
    return user;
  },

  async get(id) {
    return db.users.get(id);
  },

  async list() {
    return db.users.orderBy('criadoEm').toArray();
  },

  async update(id, patch) {
    const existing = await db.users.get(id);
    if (!existing) throw new Error(`User ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.users.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[user] atualizado', { id, campos: Object.keys(patch) });
    return merged;
  },

  async delete(id) {
    if (id === PRIMARY_ID) throw new Error('Não é permitido deletar o user primary');
    await db.users.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[user] deletado', { id });
  },

  PRIMARY_ID,
};
