// ═══════════════════════════════════════════════════════════
// Lap — volta completa
// ═══════════════════════════════════════════════════════════
// Uma Lap é criada quando o Detector emite onLap().
// Tempos são sempre por PARCIAL (id dinâmico definido no TrackLayout) e
// opcionalmente por trecho (curva) — NUNCA em S1/S2/S3 fixos.
//
// Validade:
//   - default: valida=true
//   - pode ser invalidada (manual) com motivo
//   - pode ser revalidada (manual)
//   - cada mudança gera lapValidityEvent (auditoria imutável)
//
// Laps inválidas:
//   - NÃO entram em cálculos analíticos (benchmark, score, etc)
//   - FICAM visíveis no histórico (com flag)

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'Lap';

export const ValidityEvent = Object.freeze({
  CREATED:      'created',
  INVALIDATED:  'invalidated',
  REVALIDATED:  'revalidated',
});

export const InvalidationReason = Object.freeze({
  SAIU_PISTA:       'saiu-pista',
  BANDEIRA:         'bandeira',
  CONTATO:          'contato',
  PIT:              'pit-stop',
  TELEMETRIA_RUIM:  'telemetria-ruim',
  MANUAL:           'manual',
  OUTRO:            'outro',
});

/**
 * @typedef {Object} Lap
 * @property {string} id                uid('lap')
 * @property {string} sessionId
 * @property {number} numero
 * @property {number|null} inicioAt     timestamp unix ms
 * @property {number|null} fimAt        timestamp unix ms
 * @property {number|null} tempoMs      duração total (monotônico)
 * @property {Object}  temposPorParcial   { [parcialId]: ms } por parcialId do layout atual
 * @property {Object}  temposPorTrecho    { [segmentId]: ms } por trecho (curva) percorrido
 * @property {boolean} valida
 * @property {string|null} motivoInvalidacao  InvalidationReason.*
 * @property {string|null} notas
 */

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.sessionId) throw new Error('Lap.sessionId obrigatório');
  if (data.numero == null) throw new Error('Lap.numero obrigatório');
  return true;
}

async function _auditEvent(lapId, tipo, meta = null) {
  const evt = {
    uid: uid('lve'),
    lapId,
    tipo,
    timestamp: Date.now(),
    meta,
  };
  await db.lapValidityEvents.add(evt);
  await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: 'LapValidityEvent', entidadeId: evt.uid, payload: evt });
  return evt;
}

export const Laps = {
  async create({
    sessionId, numero,
    inicioAt = null, fimAt = null, tempoMs = null,
    temposPorParcial = null, temposPorTrecho = null,
    notas = null,
  }) {
    const lap = {
      id: uid('lap'),
      sessionId, numero,
      inicioAt, fimAt, tempoMs,
      temposPorParcial, temposPorTrecho,
      valida: true,
      motivoInvalidacao: null,
      notas,
      ...defaults(),
    };
    validate(lap);
    await db.laps.add(lap);
    await _auditEvent(lap.id, ValidityEvent.CREATED);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: lap.id, payload: lap });
    logger.info('[lap] criada', { id: lap.id, numero, tempoMs });
    return lap;
  },

  async get(id) {
    return db.laps.get(id);
  },

  async listAll(sessionId) {
    const all = await db.laps.where('sessionId').equals(sessionId).toArray();
    return all.sort((a, b) => (a.numero || 0) - (b.numero || 0));
  },

  async listValid(sessionId) {
    const all = await this.listAll(sessionId);
    return all.filter(l => l.valida === true);
  },

  async listInvalid(sessionId) {
    const all = await this.listAll(sessionId);
    return all.filter(l => l.valida === false);
  },

  async invalidar(id, { motivo = InvalidationReason.MANUAL, observacao = null, autor = null } = {}) {
    const lap = await db.laps.get(id);
    if (!lap) throw new Error(`Lap ${id} não existe`);
    if (!lap.valida) return lap;
    const merged = {
      ...lap,
      valida: false,
      motivoInvalidacao: motivo,
      atualizadoEm: Date.now(),
    };
    await db.laps.put(merged);
    await _auditEvent(id, ValidityEvent.INVALIDATED, { motivo, observacao, autor });
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[lap] invalidada', { id, motivo });
    return merged;
  },

  async revalidar(id, { observacao = null, autor = null } = {}) {
    const lap = await db.laps.get(id);
    if (!lap) throw new Error(`Lap ${id} não existe`);
    if (lap.valida) return lap;
    const merged = {
      ...lap,
      valida: true,
      motivoInvalidacao: null,
      atualizadoEm: Date.now(),
    };
    await db.laps.put(merged);
    await _auditEvent(id, ValidityEvent.REVALIDATED, { observacao, autor });
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[lap] revalidada', { id });
    return merged;
  },

  async listValidityEvents(lapId) {
    const events = await db.lapValidityEvents.where('lapId').equals(lapId).toArray();
    return events.sort((a, b) => a.timestamp - b.timestamp);
  },

  async update(id, patch) {
    const existing = await db.laps.get(id);
    if (!existing) throw new Error(`Lap ${id} não existe`);
    const { valida: _v, motivoInvalidacao: _m, ...safePatch } = patch;
    const merged = { ...existing, ...safePatch, atualizadoEm: Date.now() };
    validate(merged);
    await db.laps.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    return merged;
  },
};
