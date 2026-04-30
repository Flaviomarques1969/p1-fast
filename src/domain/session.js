// ═══════════════════════════════════════════════════════════
// Session — sessão de pista (gravação)
// ═══════════════════════════════════════════════════════════
// Uma Session = um período em que o piloto está na pista gravando.
// Referencia: user + car + carConfiguration + track.
// Contém: voltas[], tempo, clima, notas.
//
// Estados:
//   criada    → registrada mas não iniciada
//   ativa     → gravando agora
//   pausada   → parou temporariamente (bandeira, pit)
//   finalizada→ terminou, dados imutáveis
//   inválida  → abortada (não conta pra benchmark)

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'Session';

export const SessionStatus = Object.freeze({
  CRIADA:      'criada',
  ATIVA:       'ativa',
  PAUSADA:     'pausada',
  FINALIZADA:  'finalizada',
  INVALIDA:    'invalida',
});

export const SessionTipo = Object.freeze({
  TREINO_LIVRE:  'treino-livre',
  CLASSIFICACAO: 'classificacao',
  CORRIDA:       'corrida',
});

export const ClimaCondicao = Object.freeze({
  SECO:     'seco',
  MOLHADO:  'molhado',
  MISTO:    'misto',
});

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.userId) throw new Error('Session.userId obrigatório');
  if (!data.carId) throw new Error('Session.carId obrigatório');
  if (!data.trackId) throw new Error('Session.trackId obrigatório');
  if (!Object.values(SessionStatus).includes(data.status)) {
    throw new Error(`Session.status inválido: ${data.status}`);
  }
  return true;
}

export const Sessions = {
  async create({
    userId,
    carId,
    trackId,
    carConfigurationId = null,
    tipoSessao = SessionTipo.TREINO_LIVRE,
    clima = null,
    temperaturaAr = null,
    temperaturaPista = null,
    eventoId = null,
    diaId = null,
    planoStint = null,      // preenchido pelo StintPlanner (Bloco D)
    notas = null,
  }) {
    const session = {
      id: uid('ses'),
      userId,
      carId,
      trackId,
      carConfigurationId,
      tipoSessao,
      clima,
      temperaturaAr,
      temperaturaPista,
      eventoId,
      diaId,
      planoStint,
      notas,
      status: SessionStatus.CRIADA,
      masterDeviceId: null,   // setado no claim via SessionMaster.claim()
      dataInicio: null,
      dataFim: null,
      duracaoMs: null,
      totalVoltas: 0,
      melhorVoltaId: null,
      ...defaults(),
    };
    validate(session);
    await db.sessions.add(session);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: session.id, payload: session });
    logger.info('[session] criada', { id: session.id, carId, trackId });
    return session;
  },

  async get(id) {
    return db.sessions.get(id);
  },

  async list({ userId = null, carId = null, trackId = null, status = null } = {}) {
    let coll = db.sessions;
    if (userId) coll = coll.where('userId').equals(userId);
    else if (carId) coll = coll.where('carId').equals(carId);
    else if (trackId) coll = coll.where('trackId').equals(trackId);
    else coll = coll.toCollection();
    let arr = await coll.toArray();
    if (status) arr = arr.filter(s => s.status === status);
    return arr.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  },

  async start(id) {
    const s = await db.sessions.get(id);
    if (!s) throw new Error(`Session ${id} não existe`);
    if (s.status !== SessionStatus.CRIADA && s.status !== SessionStatus.PAUSADA) {
      throw new Error(`Session ${id} não pode iniciar no status ${s.status}`);
    }
    const merged = {
      ...s,
      status: SessionStatus.ATIVA,
      dataInicio: s.dataInicio || Date.now(),
      atualizadoEm: Date.now(),
    };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[session] iniciada', { id });
    return merged;
  },

  async pause(id) {
    const s = await db.sessions.get(id);
    if (!s) throw new Error(`Session ${id} não existe`);
    if (s.status !== SessionStatus.ATIVA) {
      throw new Error(`Session ${id} não está ativa (status=${s.status})`);
    }
    const merged = { ...s, status: SessionStatus.PAUSADA, atualizadoEm: Date.now() };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[session] pausada', { id });
    return merged;
  },

  async finish(id) {
    const s = await db.sessions.get(id);
    if (!s) throw new Error(`Session ${id} não existe`);
    const agora = Date.now();
    const merged = {
      ...s,
      status: SessionStatus.FINALIZADA,
      dataFim: agora,
      duracaoMs: s.dataInicio ? agora - s.dataInicio : null,
      atualizadoEm: agora,
    };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[session] finalizada', { id, duracaoMs: merged.duracaoMs });
    return merged;
  },

  async invalidate(id, motivo = null) {
    const s = await db.sessions.get(id);
    if (!s) throw new Error(`Session ${id} não existe`);
    const merged = {
      ...s,
      status: SessionStatus.INVALIDA,
      notas: motivo ? `[invalidada] ${motivo}${s.notas ? '\n' + s.notas : ''}` : s.notas,
      atualizadoEm: Date.now(),
    };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.warn('[session] invalidada', { id, motivo });
    return merged;
  },

  async update(id, patch) {
    const existing = await db.sessions.get(id);
    if (!existing) throw new Error(`Session ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[session] atualizada', { id, campos: Object.keys(patch) });
    return merged;
  },

  async delete(id) {
    await db.sessions.delete(id);
    // também remove laps vinculados
    await db.laps.where('sessionId').equals(id).delete();
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[session] deletada', { id });
  },
};
