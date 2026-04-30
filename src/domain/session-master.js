// ═══════════════════════════════════════════════════════════
// SessionMaster — gestão do dispositivo mestre de uma sessão
// ═══════════════════════════════════════════════════════════
// Regra ADR-007: UMA fonte de telemetria por sessão.
// Handover é permitido (ex: tablet quebrou → iPhone assume), mas
// TODO handover é auditado em `deviceHandovers`.
//
// Estados:
//   - sem mestre: sessão recém-criada, ninguém gravando
//   - com mestre: só esse device grava telemetria
//   - handover manual: usuário pediu troca de mestre
//
// Session.masterDeviceId guarda o device atual (pode ser null antes do start).

import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { uid } from '../core/id.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';
import { Device } from '../core/device.js';
import { Sessions } from './session.js';

export const HandoverMotivo = Object.freeze({
  AUTO:            'auto',            // primeiro device a iniciar
  MANUAL_OVERRIDE: 'manual-override', // user pediu troca
  FAILOVER:        'failover',        // mestre caiu (futuro)
});

export const SessionMaster = {
  /**
   * Reivindica mestria: este device vira o mestre da sessão.
   * Se já havia mestre diferente, é handover auditado.
   * Se ESTE device já é mestre, no-op.
   */
  async claim(sessionId, motivo = HandoverMotivo.AUTO) {
    const device = await Device.getOrCreate();
    const session = await Sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} não existe`);

    const fromDeviceId = session.masterDeviceId || null;
    if (fromDeviceId === device.id) {
      return { session, device, handover: null, jaEra: true };
    }

    // T-007 / T-008: uid estável como referência cross-store (PK Dexie permanece ++id)
    const handover = {
      uid: uid('ho'),
      sessionId,
      fromDeviceId,
      toDeviceId: device.id,
      timestamp: Date.now(),
      motivo,
    };
    await db.deviceHandovers.add(handover);

    // Atualiza session
    const updated = await Sessions.update(sessionId, { masterDeviceId: device.id });

    await syncQueue.enqueue({
      tipo: SyncOp.CREATE,
      entidade: 'DeviceHandover',
      entidadeId: handover.uid,
      payload: handover,
    });

    logger.info('[session-master] handover', {
      sessionId,
      from: fromDeviceId,
      to: device.id,
      motivo,
    });

    return { session: updated, device, handover, jaEra: false };
  },

  /**
   * Retorna o device mestre atual da sessão (ou null).
   */
  async getMaster(sessionId) {
    const session = await Sessions.get(sessionId);
    if (!session || !session.masterDeviceId) return null;
    return Device.get(session.masterDeviceId);
  },

  /**
   * Verifica se o device atual é o mestre da sessão.
   * Útil pra "só grava telemetria se eu for o mestre".
   */
  async isCurrentMaster(sessionId) {
    const session = await Sessions.get(sessionId);
    if (!session) return false;
    const device = await Device.getOrCreate();
    return session.masterDeviceId === device.id;
  },

  /**
   * Lista histórico de handovers de uma sessão (auditoria).
   */
  async listHandovers(sessionId) {
    return db.deviceHandovers
      .where('sessionId').equals(sessionId)
      .toArray()
      .then(arr => arr.sort((a, b) => a.timestamp - b.timestamp));
  },

  /**
   * Solta a mestria (mestre abandona a sessão). Deixa sessão sem mestre.
   * Útil quando tablet vai ser desligado.
   */
  async release(sessionId) {
    const device = await Device.getOrCreate();
    const session = await Sessions.get(sessionId);
    if (!session) return;
    if (session.masterDeviceId !== device.id) return; // não sou mestre
    const handover = {
      sessionId,
      fromDeviceId: device.id,
      toDeviceId: null,
      timestamp: Date.now(),
      motivo: HandoverMotivo.MANUAL_OVERRIDE,
    };
    await db.deviceHandovers.add(handover);
    await Sessions.update(sessionId, { masterDeviceId: null });
    logger.info('[session-master] mestre solto', { sessionId, device: device.id });
  },
};
