// ═══════════════════════════════════════════════════════════
// ReferenceLine — Pista de Referência (B3) + Gap Analysis (F4)
// ═══════════════════════════════════════════════════════════
// Pilotos-referência são users com `ehReferencia: true` (rodam só pra
// estabelecer o limite do carro naquela pista — não vão ao dia-a-dia).
//
// Sessions desses pilotos marcadas como `isReferenceRun: true` entram
// no cômputo da trilha de referência por trackId.
//
// Trilha = média ponderada (por nº de voltas válidas) do MELHOR tempo
// de cada piloto em cada parcial/trecho/volta total.
//
// Gap Analysis (F4) compara vm atual contra a trilha: delta total + delta
// por trecho + proporção (quanto do gap está em cada trecho).

import { db } from '../core/db.js';
import { Users } from './user.js';
import { Sessions } from './session.js';
import { Laps } from './lap.js';
import { TrackLayouts } from './track-layout.js';
import { TrackSegments } from './track-segment.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';
import { logger } from '../core/logger.js';

export const ReferencePilots = {
  async marcarComoReferencia(userId) {
    const u = await db.users.get(userId);
    if (!u) throw new Error(`User ${userId} não existe`);
    const merged = { ...u, ehReferencia: true, atualizadoEm: Date.now() };
    await db.users.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: 'User', entidadeId: userId, payload: merged });
    return merged;
  },

  async desmarcar(userId) {
    const u = await db.users.get(userId);
    if (!u) return;
    const merged = { ...u, ehReferencia: false, atualizadoEm: Date.now() };
    await db.users.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: 'User', entidadeId: userId, payload: merged });
    return merged;
  },

  async criarPiloto({ nome, observacoes = null }) {
    const u = await Users.create({ nome });
    return this.marcarComoReferencia(u.id);
  },

  async list() {
    const all = await db.users.toArray();
    return all.filter(u => u.ehReferencia === true);
  },
};

export const ReferenceSessions = {
  async marcar(sessionId) {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error(`Session ${sessionId} não existe`);
    const merged = { ...s, isReferenceRun: true, atualizadoEm: Date.now() };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: 'Session', entidadeId: sessionId, payload: merged });
    return merged;
  },

  async desmarcar(sessionId) {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const merged = { ...s, isReferenceRun: false, atualizadoEm: Date.now() };
    await db.sessions.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: 'Session', entidadeId: sessionId, payload: merged });
    return merged;
  },

  async listByTrack(trackId) {
    const all = await db.sessions.where('trackId').equals(trackId).toArray();
    return all.filter(s => s.isReferenceRun === true);
  },
};

/**
 * Calcula trilha de referência pra uma pista.
 * Retorna { tempoVoltaMs, temposPorParcial, temposPorTrecho, pilotos, amostras }
 * — todos campos medianos entre pilotos (ignora piloto sem amostras no nível).
 */
export async function computeReferenceLine(trackId) {
  const layout = await TrackLayouts.getPrincipal(trackId);
  const allSegs = layout ? await TrackSegments.listByLayout(layout.id) : [];
  const trechos = allSegs.filter(s => s.ehTrecho);
  const parciais = layout?.parciais || [];

  const refSessions = await ReferenceSessions.listByTrack(trackId);
  const out = {
    trackId,
    tempoVoltaMs: null,
    temposPorParcial: {},
    temposPorTrecho: {},
    pilotos: [],
    amostras: { sessions: refSessions.length, pilotos: 0, voltasValidas: 0 },
    geradoEm: Date.now(),
  };
  if (!refSessions.length) return out;

  const porPiloto = new Map(); // userId → { melhorVoltaMs, melhorParcial, melhorTrecho, voltas }
  for (const s of refSessions) {
    const laps = await Laps.listValid(s.id);
    if (!laps.length) continue;
    out.amostras.voltasValidas += laps.length;
    const atual = porPiloto.get(s.userId) || {
      melhorVoltaMs: Infinity,
      melhorParcial: {},
      melhorTrecho: {},
    };
    for (const l of laps) {
      if (l.tempoMs != null && l.tempoMs < atual.melhorVoltaMs) atual.melhorVoltaMs = l.tempoMs;
      const tpp = l.temposPorParcial || {};
      for (const p of parciais) {
        const v = tpp[p.id];
        if (v != null && (atual.melhorParcial[p.id] == null || v < atual.melhorParcial[p.id])) {
          atual.melhorParcial[p.id] = v;
        }
      }
      const tpt = l.temposPorTrecho || {};
      for (const t of trechos) {
        const v = tpt[t.id];
        if (v != null && (atual.melhorTrecho[t.id] == null || v < atual.melhorTrecho[t.id])) {
          atual.melhorTrecho[t.id] = v;
        }
      }
    }
    porPiloto.set(s.userId, atual);
  }

  const pilotoIds = [...porPiloto.keys()];
  out.amostras.pilotos = pilotoIds.length;
  out.pilotos = (await Promise.all(pilotoIds.map(id => db.users.get(id))))
    .filter(Boolean)
    .map(u => ({ id: u.id, nome: u.nome }));

  const median = arr => {
    const vals = arr.filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    const m = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[m] : Math.round((vals[m - 1] + vals[m]) / 2);
  };

  const tempos = pilotoIds.map(id => porPiloto.get(id).melhorVoltaMs);
  out.tempoVoltaMs = median(tempos);
  for (const p of parciais) {
    out.temposPorParcial[p.id] = median(pilotoIds.map(id => porPiloto.get(id).melhorParcial[p.id]));
  }
  for (const t of trechos) {
    out.temposPorTrecho[t.id] = median(pilotoIds.map(id => porPiloto.get(id).melhorTrecho[t.id]));
  }

  logger.info('[reference-line] calculada', { trackId, pilotos: out.amostras.pilotos, voltas: out.amostras.voltasValidas });
  return out;
}

/**
 * Gap Analysis — vm (viewmodel do stint atual) vs trilha de referência.
 * Retorna:
 *   gapTotalMs       : delta ideal-teorica - referência (positivo = atrás da ref)
 *   gapPorTrecho[]   : { trechoId, nome, gapMs, pctTotal }
 *   topTrechos[]     : os 3 maiores gaps (foco de trabalho)
 *   mensagem         : frase curta pra mostrar no Box
 */
export function computeGap(vm, refLine) {
  if (!refLine || refLine.tempoVoltaMs == null) {
    return { disponivel: false, razao: 'sem-pista-de-referencia' };
  }
  const melhorVolta = vm.melhorVolta?.tempoMs;
  if (melhorVolta == null) return { disponivel: false, razao: 'sem-volta-valida' };

  const gapTotalMs = melhorVolta - refLine.tempoVoltaMs;

  const gapPorTrecho = [];
  let somaGaps = 0;
  for (const t of vm.trechos) {
    const atual = vm.melhorPorTrecho?.[t.id]?.tempoMs;
    const ref = refLine.temposPorTrecho?.[t.id];
    if (atual == null || ref == null) continue;
    const gap = atual - ref;
    if (gap > 0) somaGaps += gap;
    gapPorTrecho.push({ trechoId: t.id, nome: t.nome, gapMs: gap });
  }
  for (const g of gapPorTrecho) {
    g.pctTotal = somaGaps > 0 && g.gapMs > 0 ? Math.round((g.gapMs / somaGaps) * 100) : 0;
  }
  const topTrechos = [...gapPorTrecho].filter(g => g.gapMs > 0).sort((a, b) => b.gapMs - a.gapMs).slice(0, 3);

  const sec = ms => (ms / 1000).toFixed(2);
  let mensagem;
  if (gapTotalMs <= 0) {
    mensagem = `Você está ${sec(-gapTotalMs)}s à FRENTE da referência conhecida nesta pista.`;
  } else if (topTrechos.length) {
    const top = topTrechos[0];
    mensagem = `Você está a ${sec(gapTotalMs)}s da referência — ${top.pctTotal}% disso está em ${top.nome}.`;
  } else {
    mensagem = `Você está a ${sec(gapTotalMs)}s da referência (distribuído sem foco claro).`;
  }

  return {
    disponivel: true,
    gapTotalMs,
    gapPorTrecho,
    topTrechos,
    mensagem,
    refMeta: { pilotos: refLine.amostras.pilotos, voltas: refLine.amostras.voltasValidas },
  };
}
