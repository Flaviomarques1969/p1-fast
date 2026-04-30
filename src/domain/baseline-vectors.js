// ═══════════════════════════════════════════════════════════
// BaselineVectors — Painel de Vetores Configuráveis (B4)
// ═══════════════════════════════════════════════════════════
// Antes de rodar o baseline (5 melhores voltas pra evidência do Advisor),
// o engenheiro escolhe QUAIS dimensões considerar na seleção:
//   • pneu         { marca, composto, nivelDesgaste }
//   • ambiente     { tempPistaRange, tempArRange, clima }
//   • piloto       { apenasOMesmo, userId }
//   • carroConfig  { apenasOMesmo, carConfigId }
//   • dia          { apenasMesmoDia }
//
// Um preset fica salvo em meta (Dexie) sob key `baseline:preset:<trackId>`.

import { db } from '../core/db.js';

const KEY_PREFIX = 'baseline:preset:';

export const DEFAULT_VECTORS = Object.freeze({
  pneu:        { igualarMarca: true, igualarComposto: true, nivelMax: 2 },
  ambiente:    { tempPistaTol: 5, tempArTol: 5, apenasClima: true },
  piloto:      { apenasMesmoPiloto: true },
  carroConfig: { apenasMesmoCarroConfig: true },
  dia:         { apenasMesmoDia: false },
  minVoltas:   5,
});

export const BaselineVectors = {
  async getPreset(trackId) {
    const row = await db.meta.get(KEY_PREFIX + trackId);
    return row?.value || DEFAULT_VECTORS;
  },

  async setPreset(trackId, preset) {
    const value = { ...DEFAULT_VECTORS, ...preset };
    await db.meta.put({ key: KEY_PREFIX + trackId, value });
    return value;
  },
};

/**
 * Filtra candidatos de laps pra baseline a partir do preset.
 * @param {Array} candidateLaps - laps de várias sessions já enriquecidas com {session, env}
 * @param {Object} ref - { sessionId, env, userId, carConfigId, timestamp } do stint alvo
 * @param {Object} preset
 */
export function filterForBaseline(candidateLaps, ref, preset = DEFAULT_VECTORS) {
  const out = [];
  for (const c of candidateLaps) {
    if (!c.lap.valida) continue;
    const s = c.session;
    const e = c.env || {};
    const r = ref.env || {};

    if (preset.pneu.igualarMarca && r.composto && e.composto && r.composto !== e.composto) continue;
    if (preset.pneu.nivelMax != null && e.desgasteNivelD != null && e.desgasteNivelD > preset.pneu.nivelMax) continue;

    if (preset.ambiente.apenasClima && ref.clima && s.clima && ref.clima !== s.clima) continue;
    if (preset.ambiente.tempPistaTol != null && r.tempPista != null && e.tempPista != null) {
      if (Math.abs(r.tempPista - e.tempPista) > preset.ambiente.tempPistaTol) continue;
    }
    if (preset.ambiente.tempArTol != null && r.tempAr != null && e.tempAr != null) {
      if (Math.abs(r.tempAr - e.tempAr) > preset.ambiente.tempArTol) continue;
    }

    if (preset.piloto.apenasMesmoPiloto && ref.userId && s.userId !== ref.userId) continue;
    if (preset.carroConfig.apenasMesmoCarroConfig && ref.carConfigId && s.carConfigurationId !== ref.carConfigId) continue;
    if (preset.dia.apenasMesmoDia && ref.timestamp && s.dataInicio) {
      const mesmo = new Date(ref.timestamp).toDateString() === new Date(s.dataInicio).toDateString();
      if (!mesmo) continue;
    }

    out.push(c);
  }
  out.sort((a, b) => (a.lap.tempoMs || 9e9) - (b.lap.tempoMs || 9e9));
  return out.slice(0, Math.max(preset.minVoltas || 5, 10));
}
