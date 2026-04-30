// ═══════════════════════════════════════════════════════════
// CarConfiguration — setup específico de um carro
// ═══════════════════════════════════════════════════════════
// Um carro pode ter MUITAS configurações ao longo do tempo:
// "Setup Brasília Seco 2026-04", "Setup molhado", etc.
// Uma Session é gravada COM uma CarConfiguration específica,
// o que permite análise "mudei X, impactou em Y".

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'CarConfiguration';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.carId) throw new Error('CarConfiguration.carId obrigatório');
  if (!data.nome || typeof data.nome !== 'string' || data.nome.trim().length === 0) {
    throw new Error('CarConfiguration.nome obrigatório');
  }
  return true;
}

export const CarConfigurations = {
  async create({
    carId,
    nome,
    dataAplicacao = null,
    pressaoPneus = null,      // { de, dd, te, td } em PSI
    suspensao = null,         // { dianteira: {...}, traseira: {...} }
    alinhamento = null,       // { camber, caster, toe } por eixo
    diferencial = null,
    motor = null,             // { injecao: 'T4000', mapa: 'seco-1' }
    notas = null,
  }) {
    const config = {
      id: uid('cfg'),
      carId,
      nome: nome.trim(),
      dataAplicacao: dataAplicacao || Date.now(),
      pressaoPneus,
      suspensao,
      alinhamento,
      diferencial,
      motor,
      notas,
      ativo: true,
      ...defaults(),
    };
    validate(config);
    await db.carConfigurations.add(config);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: config.id, payload: config });
    logger.info('[car-cfg] criado', { id: config.id, carId, nome: config.nome });
    return config;
  },

  async get(id) {
    return db.carConfigurations.get(id);
  },

  async listByCar(carId) {
    return db.carConfigurations.where('carId').equals(carId).reverse().sortBy('dataAplicacao');
  },

  async getLatestForCar(carId) {
    const all = await this.listByCar(carId);
    return all[0] || null;
  },

  async update(id, patch) {
    const existing = await db.carConfigurations.get(id);
    if (!existing) throw new Error(`CarConfiguration ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.carConfigurations.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[car-cfg] atualizado', { id, campos: Object.keys(patch) });
    return merged;
  },

  async delete(id) {
    await db.carConfigurations.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[car-cfg] deletado', { id });
  },
};
