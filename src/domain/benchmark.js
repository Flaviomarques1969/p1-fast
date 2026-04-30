// ═══════════════════════════════════════════════════════════
// Benchmark — melhor volta/parcial do dia (contextualizado)
// ═══════════════════════════════════════════════════════════
// Usa APENAS voltas válidas. Contexto: carro + configuração + pista + dia.
//
// Parciais são configuráveis por pista (ver TrackLayout.parciais). O benchmark
// calcula o melhor tempo POR PARCIAL encontrada no layout da sessão.
//
// Campos:
//   - melhorVolta:      { id, tempoMs, numero, dia }
//   - melhorPorParcial: { [parcialId]: { tempoMs, lapId, numero } }
//   - idealTeoricaMs:   soma das N melhores parciais (mesmo de voltas diferentes)
//   - voltasConsideradas: count

import { db } from '../core/db.js';
import { Sessions, SessionStatus } from './session.js';
import { TrackLayouts } from './track-layout.js';

export function dayKey(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function collectValidLaps({ carId, trackId, carConfigurationId = null, dia = null }) {
  let sessions = await db.sessions.toArray();
  sessions = sessions.filter(s => s.carId === carId && s.trackId === trackId);
  sessions = sessions.filter(s => s.status !== SessionStatus.INVALIDA);
  if (carConfigurationId) sessions = sessions.filter(s => s.carConfigurationId === carConfigurationId);
  if (dia) sessions = sessions.filter(s => s.dataInicio && dayKey(s.dataInicio) === dia);
  const sessionIds = new Set(sessions.map(s => s.id));
  const allLaps = await db.laps.toArray();
  return allLaps.filter(l => l.valida === true && sessionIds.has(l.sessionId) && l.tempoMs != null);
}

async function fetchParciais(trackId) {
  // Layout "Principal" — a seed atual só cria esse. Se múltiplos, pega o mais recente.
  const layouts = await TrackLayouts.listByTrack(trackId);
  const main = layouts[0];
  return main?.parciais || [];
}

export const Benchmarks = {
  async compute({ carId, trackId, carConfigurationId = null, dia = null, parciais = null } = {}) {
    if (!carId)   throw new Error('Benchmarks.compute requer carId');
    if (!trackId) throw new Error('Benchmarks.compute requer trackId');

    const laps = await collectValidLaps({ carId, trackId, carConfigurationId, dia });
    if (laps.length === 0) return null;

    const listaParciais = parciais || await fetchParciais(trackId);

    const melhor = laps.reduce((a, b) => (a.tempoMs < b.tempoMs ? a : b));
    const melhorVolta = {
      id: melhor.id,
      tempoMs: melhor.tempoMs,
      numero: melhor.numero,
      sessionId: melhor.sessionId,
      dia: melhor.inicioAt ? dayKey(melhor.inicioAt) : null,
    };

    const melhorPorParcial = {};
    for (const p of listaParciais) {
      const comParcial = laps.filter(l => l.temposPorParcial?.[p.id] != null && l.temposPorParcial[p.id] > 0);
      if (comParcial.length > 0) {
        const best = comParcial.reduce((a, b) => (a.temposPorParcial[p.id] < b.temposPorParcial[p.id] ? a : b));
        melhorPorParcial[p.id] = {
          tempoMs: best.temposPorParcial[p.id],
          lapId: best.id,
          numero: best.numero,
        };
      } else {
        melhorPorParcial[p.id] = null;
      }
    }

    // Ideal teórica = soma de todas as parciais (uma de cada, possivelmente de voltas diferentes)
    const todasCompletas = listaParciais.length > 0 && listaParciais.every(p => melhorPorParcial[p.id] != null);
    const idealTeoricaMs = todasCompletas
      ? listaParciais.reduce((sum, p) => sum + melhorPorParcial[p.id].tempoMs, 0)
      : null;

    return {
      scope: { carId, trackId, carConfigurationId, dia },
      parciais: listaParciais,
      voltasConsideradas: laps.length,
      melhorVolta,
      melhorPorParcial,
      idealTeoricaMs,
      ganhoTeoricoMs: idealTeoricaMs != null ? melhorVolta.tempoMs - idealTeoricaMs : null,
    };
  },

  async computeForSession(sessionId) {
    const s = await Sessions.get(sessionId);
    if (!s) throw new Error(`Session ${sessionId} não existe`);
    const dia = s.dataInicio ? dayKey(s.dataInicio) : null;
    return this.compute({
      carId: s.carId,
      trackId: s.trackId,
      carConfigurationId: s.carConfigurationId,
      dia,
    });
  },
};
