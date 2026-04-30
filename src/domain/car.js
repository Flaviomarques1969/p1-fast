// ═══════════════════════════════════════════════════════════
// Car — carro de corrida (entidade raiz da garagem)
// ═══════════════════════════════════════════════════════════
// Um user pode ter N carros. Cada carro tem N CarConfigurations
// (setups específicos), N Sessions, etc.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'Car';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.userId) throw new Error('Car.userId obrigatório');
  if (!data.nome || typeof data.nome !== 'string' || data.nome.trim().length === 0) {
    throw new Error('Car.nome obrigatório');
  }
  return true;
}

export const Cars = {
  async create({ userId, nome, marca = null, modelo = null, ano = null, categoria = null, numero = null, cor = null, descricao = null }) {
    const car = {
      id: uid('car'),
      userId,
      nome: nome.trim(),
      marca,
      modelo,
      ano,
      categoria,       // ex: "Celta 1.4 Montana 2008"
      numero,          // ex: 80
      cor,             // ex: "amarelo/verde"
      descricao,
      ativo: true,
      ...defaults(),
    };
    validate(car);
    await db.cars.add(car);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: car.id, payload: car });
    logger.info('[car] criado', { id: car.id, nome: car.nome });
    return car;
  },

  async get(id) {
    return db.cars.get(id);
  },

  async list(userId = null) {
    if (userId) return db.cars.where('userId').equals(userId).toArray();
    return db.cars.orderBy('criadoEm').toArray();
  },

  async update(id, patch) {
    const existing = await db.cars.get(id);
    if (!existing) throw new Error(`Car ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.cars.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[car] atualizado', { id, campos: Object.keys(patch) });
    return merged;
  },

  async delete(id) {
    await db.cars.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[car] deletado', { id });
  },
};
