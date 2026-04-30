// ═══════════════════════════════════════════════════════════
// EventoResumo / DiaResumo — agregados pós-execução
// ═══════════════════════════════════════════════════════════
// Lê stints (modelo do app local) e calcula totais e melhores tempos por dia
// e por evento. Usado pelo card de evento (`/app`) e relatório pós-evento.
//
// Quando stint tem `lapsExecutados[]` (vindos do pipeline real de telemetria):
//   conta voltas válidas + min(tempoMs); quality = 'MEDIDO'.
//
// Quando stint só tem `voltasPlanejadas` (entrada manual, sem telemetria):
//   usa esse valor; quality = 'ESTIMADO' (tempo fica null).
//
// Mistura → quality = 'PARCIAL'. Sem stints → 'VAZIO'.
//
// Esquema canônico no domain:
//   StintLap = { id?, tempoMs: number, valida?: boolean (default true) }
//   DiaResumo = { voltas, melhorMs, melhorLapId, melhorStintId, quality, calculadoEm }
//   EventoResumo = { voltasTotal, melhorMsGlobal, melhorMsPorDia, quality, calculadoEm }

export const ResumoQuality = Object.freeze({
  MEDIDO:   'MEDIDO',
  PARCIAL:  'PARCIAL',
  ESTIMADO: 'ESTIMADO',
  VAZIO:    'VAZIO',
});

function _melhorDosLaps(laps) {
  let best = null;
  let bestId = null;
  for (const l of laps) {
    if (!l || l.valida === false) continue;
    if (typeof l.tempoMs !== 'number' || !isFinite(l.tempoMs) || l.tempoMs <= 0) continue;
    if (best == null || l.tempoMs < best) { best = l.tempoMs; bestId = l.id || null; }
  }
  return { tempoMs: best, lapId: bestId };
}

export function calcularStintResumo(stint) {
  if (!stint) return _vazioStint();
  const laps = Array.isArray(stint.lapsExecutados) ? stint.lapsExecutados : [];
  if (laps.length > 0) {
    const validas = laps.filter(l => l && l.valida !== false && typeof l.tempoMs === 'number' && l.tempoMs > 0);
    const best = _melhorDosLaps(validas);
    return {
      voltas: validas.length,
      voltasTotais: laps.length,
      melhorMs: best.tempoMs,
      melhorLapId: best.lapId,
      quality: ResumoQuality.MEDIDO,
    };
  }
  if (typeof stint.voltasPlanejadas === 'number' && stint.voltasPlanejadas > 0) {
    return {
      voltas: stint.voltasPlanejadas,
      voltasTotais: stint.voltasPlanejadas,
      melhorMs: null,
      melhorLapId: null,
      quality: ResumoQuality.ESTIMADO,
    };
  }
  return _vazioStint();
}

function _vazioStint() {
  return { voltas: 0, voltasTotais: 0, melhorMs: null, melhorLapId: null, quality: ResumoQuality.VAZIO };
}

export function calcularDiaResumo(stints) {
  if (!Array.isArray(stints) || !stints.length) {
    return { voltas: 0, melhorMs: null, melhorLapId: null, melhorStintId: null, quality: ResumoQuality.VAZIO, calculadoEm: Date.now() };
  }
  let voltas = 0;
  let melhorMs = null;
  let melhorLapId = null;
  let melhorStintId = null;
  let temMedido = false;
  let temEstimado = false;
  for (const s of stints) {
    const r = calcularStintResumo(s);
    voltas += r.voltas;
    if (r.melhorMs != null && (melhorMs == null || r.melhorMs < melhorMs)) {
      melhorMs = r.melhorMs;
      melhorLapId = r.melhorLapId;
      melhorStintId = s.id || null;
    }
    if (r.quality === ResumoQuality.MEDIDO) temMedido = true;
    else if (r.quality === ResumoQuality.ESTIMADO) temEstimado = true;
  }
  let quality = ResumoQuality.VAZIO;
  if (temMedido && temEstimado) quality = ResumoQuality.PARCIAL;
  else if (temMedido) quality = ResumoQuality.MEDIDO;
  else if (temEstimado) quality = ResumoQuality.ESTIMADO;
  return { voltas, melhorMs, melhorLapId, melhorStintId, quality, calculadoEm: Date.now() };
}

export function calcularEventoResumo(evento, stintsByDia) {
  if (!evento || !Array.isArray(evento.dias)) {
    return { voltasTotal: 0, melhorMsGlobal: null, melhorMsPorDia: {}, quality: ResumoQuality.VAZIO, calculadoEm: Date.now() };
  }
  let voltasTotal = 0;
  let melhorMsGlobal = null;
  const melhorMsPorDia = {};
  const qualidades = [];
  for (const d of evento.dias) {
    const stints = (stintsByDia || {})[d.id] || [];
    const dr = calcularDiaResumo(stints);
    voltasTotal += dr.voltas;
    melhorMsPorDia[d.id] = dr.melhorMs;
    if (dr.melhorMs != null && (melhorMsGlobal == null || dr.melhorMs < melhorMsGlobal)) {
      melhorMsGlobal = dr.melhorMs;
    }
    qualidades.push(dr.quality);
  }
  const naoVazias = qualidades.filter(q => q !== ResumoQuality.VAZIO);
  let quality = ResumoQuality.VAZIO;
  if (naoVazias.length) {
    if (naoVazias.every(q => q === ResumoQuality.MEDIDO)) quality = ResumoQuality.MEDIDO;
    else if (naoVazias.every(q => q === ResumoQuality.ESTIMADO)) quality = ResumoQuality.ESTIMADO;
    else quality = ResumoQuality.PARCIAL;
  }
  return { voltasTotal, melhorMsGlobal, melhorMsPorDia, quality, calculadoEm: Date.now() };
}

// Mutates: escreve `dia.resumo` em cada dia + `evento.resumo`.
// Idempotente — pode ser chamada N vezes sem efeito colateral além do recalc.
export function recalcularResumoEvento(evento) {
  if (!evento || !Array.isArray(evento.dias)) return null;
  const stintsByDia = evento.stintsByDia || {};
  for (const d of evento.dias) {
    const stints = stintsByDia[d.id] || [];
    d.resumo = calcularDiaResumo(stints);
  }
  evento.resumo = calcularEventoResumo(evento, stintsByDia);
  return evento.resumo;
}

// ─── Enriquecer com Laps reais do Dexie ────────────────────────────────────
// Quando o cockpit roda com track configurada, SessionRecorder grava Laps em
// `db.laps` ligados a uma `Sessions`. Esta função busca por carId+data, cola
// `lapsExecutados` em cada stint do dia (via match por carId), e recalcula.
// Sem laps reais, stint.lapsExecutados fica intocado e fallback ESTIMATED
// continua valendo. Chamar em bootApp após carregar Dexie + DB local.

export async function enriquecerEventosComLapsReais(eventos, dbDexie) {
  if (!eventos?.length || !dbDexie) return { enriquecidos: 0 };
  let enriquecidos = 0;
  for (const ev of eventos) {
    let mudou = false;
    for (const d of (ev.dias || [])) {
      const dataDia = d.data;
      if (!dataDia) continue;
      const stints = (ev.stintsByDia || {})[d.id] || [];
      if (!stints.length) continue;

      // Sessions iniciadas neste dia (dataInicio é setado por SessionMaster.claim;
      // se ainda nulo, usa criadoEm como proxy — sessão recém-criada na mesma data).
      const allSessions = await dbDexie.sessions.toArray();
      const sessionsDoDia = allSessions.filter(s => {
        const ts = s.dataInicio || (s.criadoEm ? new Date(s.criadoEm).toISOString() : null);
        if (!ts) return false;
        return String(ts).slice(0, 10) === dataDia;
      });
      if (!sessionsDoDia.length) continue;

      for (const stint of stints) {
        if (!stint.carId) continue;
        const sessionsDoCarro = sessionsDoDia.filter(s => s.carId === stint.carId);
        if (!sessionsDoCarro.length) continue;
        const sessionIds = sessionsDoCarro.map(s => s.id);
        const lapsAll = await dbDexie.laps.where('sessionId').anyOf(sessionIds).toArray();
        const lapsLimpos = lapsAll
          .filter(l => l.tempoMs != null && l.tempoMs > 0)
          .map(l => ({ id: l.id, tempoMs: l.tempoMs, valida: l.valida !== false }));
        if (lapsLimpos.length) {
          stint.lapsExecutados = lapsLimpos;
          stint.sessionIds = sessionIds;  // pra debug + futura UI
          mudou = true;
        }
      }
    }
    if (mudou) {
      recalcularResumoEvento(ev);
      enriquecidos++;
    }
  }
  return { enriquecidos };
}
