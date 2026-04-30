// ═══════════════════════════════════════════════════════════
// TrackLayout — camada 1 da pista
// ═══════════════════════════════════════════════════════════
// Define: linha de chegada + parciais (divisões por tempo).
// Cada Track pode ter múltiplos layouts (ex: "completo", "curto"),
// mas por ora usamos só o "Principal".
//
// Parciais = divisões da volta por TEMPO. Cada pista cadastra N parciais
// (ex: Brasília = 4). Não são 3 fixos. Cada parcial tem janela temporal
// (tStart/tEnd em % do tempo total da volta de referência).
// Trechos (TrackSegment) são atribuídos a parciais pelo t do seu ponto.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'TrackLayout';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.trackId) throw new Error('TrackLayout.trackId obrigatório');
  if (!data.nome) throw new Error('TrackLayout.nome obrigatório');
  if (!Array.isArray(data.parciais) || data.parciais.length < 1) {
    throw new Error('TrackLayout.parciais deve ter ao menos 1 parcial');
  }
  for (const p of data.parciais) {
    if (!p.id) throw new Error('parcial.id obrigatório');
    if (typeof p.tStart !== 'number' || typeof p.tEnd !== 'number') {
      throw new Error(`parcial ${p.id}: tStart/tEnd numéricos (% do lap) obrigatórios`);
    }
    if (p.tEnd < p.tStart) {
      throw new Error(`parcial ${p.id}: tEnd < tStart`);
    }
  }
  return true;
}

/**
 * Divide a volta em N parciais de tempo igual.
 * @param {number} n — quantidade de parciais
 * @returns {Array} [{id:'P1', nome:'Parcial 1', tStart:0, tEnd:25, ...}]
 */
export function parciaisIguais(n = 4) {
  if (n < 1) throw new Error('n >= 1');
  const passo = 100 / n;
  return Array.from({ length: n }, (_, i) => ({
    id: `P${i + 1}`,
    nome: `Parcial ${i + 1}`,
    tStart: +(i * passo).toFixed(4),
    tEnd: +((i + 1) * passo).toFixed(4),
  }));
}

export const TrackLayouts = {
  async create({ trackId, nome = 'Principal', linhaChegada = null, parciais = null, numParciais = 4 }) {
    const layout = {
      id: uid('lay'),
      trackId,
      nome,
      linhaChegada,
      parciais: parciais || parciaisIguais(numParciais),
      configCompleta: false,
      ...defaults(),
    };
    layout.configCompleta = !!(layout.linhaChegada && layout.parciais?.length >= 1);
    validate(layout);
    await db.trackLayouts.add(layout);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: layout.id, payload: layout });
    logger.info('[track-layout] criado', { id: layout.id, trackId, parciais: layout.parciais.length });
    return layout;
  },

  async get(id) {
    return db.trackLayouts.get(id);
  },

  async listByTrack(trackId) {
    return db.trackLayouts.where('trackId').equals(trackId).toArray();
  },

  async getPrincipal(trackId) {
    const all = await this.listByTrack(trackId);
    return all[0] || null;
  },

  async setLinhaChegada(id, { x1, y1, x2, y2 }) {
    const l = await db.trackLayouts.get(id);
    if (!l) throw new Error(`TrackLayout ${id} não existe`);
    const merged = {
      ...l,
      linhaChegada: { x1, y1, x2, y2 },
      atualizadoEm: Date.now(),
    };
    merged.configCompleta = !!(merged.linhaChegada && merged.parciais?.length >= 1);
    await db.trackLayouts.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[track-layout] linha de chegada', { id, linhaChegada: merged.linhaChegada });
    return merged;
  },

  async setParciais(id, parciais) {
    if (!Array.isArray(parciais) || parciais.length < 1) {
      throw new Error('parciais deve ser array não vazio');
    }
    const l = await db.trackLayouts.get(id);
    if (!l) throw new Error(`TrackLayout ${id} não existe`);
    const merged = { ...l, parciais, atualizadoEm: Date.now() };
    merged.configCompleta = !!(merged.linhaChegada && merged.parciais?.length >= 1);
    validate(merged);
    await db.trackLayouts.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[track-layout] parciais atualizadas', { id, n: parciais.length });
    return merged;
  },

  async update(id, patch) {
    const existing = await db.trackLayouts.get(id);
    if (!existing) throw new Error(`TrackLayout ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    merged.configCompleta = !!(merged.linhaChegada && merged.parciais?.length >= 1);
    validate(merged);
    await db.trackLayouts.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    return merged;
  },

  async delete(id) {
    await db.trackSegments.where('layoutId').equals(id).delete();
    await db.trackLayouts.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[track-layout] deletado', { id });
  },
};
