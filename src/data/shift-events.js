// shift-events — store Dexie + helpers de leitura/escrita de eventos de troca.
// Idempotência via campo único `dedup_key` (índice & no schema v11).

import { db } from '../core/db.js';

// Os 25 campos do plano (seção 14) + dedup_key. Auto id é gerado pela Dexie.
export const SHIFT_EVENT_FIELDS = Object.freeze([
  'piloto_id', 'carro_id', 'sessao_id', 'volta_id', 'trecho_id',
  'timestamp',
  'rpm_before', 'rpm_at_shift', 'rpm_after',
  'speed_kmh', 'tps',
  'gear_before', 'gear_after', 'gear_confidence',
  'accel_long_before', 'accel_long_during', 'accel_long_after',
  'target_optimal_rpm', 'target_visual_rpm', 'delta_rpm',
  'status', 'mode_used',
  'overrev_flag', 'data_inconsistent_flag',
  'lesson_text'
]);

export async function saveEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('saveEvent: event obrigatório');
  }
  if (!event.dedup_key || typeof event.dedup_key !== 'string') {
    throw new Error('saveEvent: dedup_key obrigatório (string)');
  }
  const existing = await db.shift_events.where('dedup_key').equals(event.dedup_key).first();
  if (existing) return existing.id;
  return db.shift_events.add(event);
}

export async function listEventsBySession(sessionId) {
  if (!sessionId) return [];
  return db.shift_events.where('sessao_id').equals(sessionId).sortBy('timestamp');
}

export async function getEvent(id) {
  return db.shift_events.get(id);
}

export async function clearShiftEvents() {
  return db.shift_events.clear();
}
