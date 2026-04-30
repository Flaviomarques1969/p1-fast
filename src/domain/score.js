// ═══════════════════════════════════════════════════════════
// Score — score BRUTO + compensado
// ═══════════════════════════════════════════════════════════
// Fórmula bruta: score = (melhorTempo / tempoAtual) × 100, clamp 0..100.
// Interpretação: 100 = empatou, 95 = 5% mais lento, 0 = sem ref/inválido.
//
// A versão compensada aceita parciais dinâmicas (N por pista) e pesos
// opcionais. Sem pesos, distribui igualmente entre parciais presentes.

export const Scores = {
  /** score bruto de volta vs melhor volta. */
  lap(tempoAtualMs, melhorTempoMs) {
    if (!tempoAtualMs || !melhorTempoMs || tempoAtualMs <= 0 || melhorTempoMs <= 0) return null;
    const raw = (melhorTempoMs / tempoAtualMs) * 100;
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  },

  /** score bruto de parcial/trecho vs melhor do mesmo. */
  trecho(tempoAtualMs, melhorTempoMs) {
    return this.lap(tempoAtualMs, melhorTempoMs);
  },

  /**
   * Dado um Lap e um Benchmark (com parciais + melhorPorParcial), retorna
   * scores por parcial + volta.
   */
  fromLap(lap, benchmark) {
    if (!lap || !benchmark) return { volta: null, porParcial: {} };
    const porParcial = {};
    const melhorPorParcial = benchmark.melhorPorParcial || {};
    for (const [parcialId, best] of Object.entries(melhorPorParcial)) {
      porParcial[parcialId] = this.trecho(lap.temposPorParcial?.[parcialId], best?.tempoMs);
    }
    return {
      volta: this.lap(lap.tempoMs, benchmark.melhorVolta?.tempoMs),
      porParcial,
    };
  },

  /** Classifica um score em 4 categorias. */
  categoria(score) {
    if (score == null) return 'indefinido';
    if (score >= 98)   return 'excelente';
    if (score >= 95)   return 'bom';
    if (score >= 90)   return 'medio';
    return 'ruim';
  },

  /**
   * SCORE COMPENSADO por parciais.
   *
   * @param {object} lap         - { temposPorParcial: { [parcialId]: ms } }
   * @param {object} benchmark   - { parciais, melhorPorParcial }
   * @param {object} options     - { weights?: { [parcialId]: number }, contextoLap?, contextoRef? }
   *
   * @returns {{score, breakdown, parcial, fatorContexto, explicacao, weights} | null}
   */
  compensado(lap, benchmark, options = {}) {
    if (!lap || !benchmark?.melhorPorParcial) return null;
    const parciaisIds = Object.keys(benchmark.melhorPorParcial);
    if (parciaisIds.length === 0) return null;

    // Peso default: distribui igualmente (totaliza 100)
    const weights = options.weights
      || Object.fromEntries(parciaisIds.map(id => [id, 100 / parciaisIds.length]));

    const presentes = parciaisIds.filter(id => lap.temposPorParcial?.[id] != null);
    if (presentes.length === 0) return null;

    const breakdown = {};
    let somaPesada = 0;
    let somaPesosValidos = 0;
    for (const id of parciaisIds) {
      const t = lap.temposPorParcial?.[id];
      const m = benchmark.melhorPorParcial[id]?.tempoMs;
      const sc = this.trecho(t, m);
      breakdown[id] = sc;
      if (sc != null && weights[id] != null) {
        somaPesada += sc * weights[id];
        somaPesosValidos += weights[id];
      }
    }
    if (somaPesosValidos === 0) return null;

    const scoreRaw = somaPesada / somaPesosValidos;
    const fatorContexto = _fatorContexto(options.contextoLap, options.contextoRef);
    const score = Math.max(0, Math.min(100, Math.round(scoreRaw * fatorContexto * 10) / 10));

    const presentesRanked = presentes
      .filter(id => breakdown[id] != null)
      .sort((a, b) => breakdown[a] - breakdown[b]);
    let explicacao = null;
    if (presentesRanked.length) {
      const pior = presentesRanked[0];
      const melhor = presentesRanked[presentesRanked.length - 1];
      const diff = breakdown[melhor] - breakdown[pior];
      if (diff < 2) explicacao = 'consistente em todas as parciais';
      else if (breakdown[pior] < 90) explicacao = `${pior} puxou pra baixo`;
      else if (breakdown[melhor] >= 98) explicacao = `${melhor} excelente`;
      else explicacao = `${melhor} forte, ${pior} pode melhorar`;
    }

    const parcial = presentes.length < parciaisIds.length;
    return {
      score,
      breakdown,
      parciaisConsideradas: presentes.length,
      totalParciais: parciaisIds.length,
      parcial,
      fatorContexto,
      explicacao: parcial ? `dados parciais: ${presentes.length}/${parciaisIds.length} parciais` : explicacao,
      weights,
    };
  },
};

function _fatorContexto(ctxLap, ctxRef) {
  if (!ctxLap || !ctxRef) return 1.0;
  let fator = 1.0;
  if (ctxLap.temperaturaAr != null && ctxRef.temperaturaAr != null) {
    const dt = Math.abs(ctxLap.temperaturaAr - ctxRef.temperaturaAr);
    if (dt > 10) fator *= 1.02;
  }
  if (ctxLap.umidade != null && ctxRef.umidade != null) {
    const du = Math.abs(ctxLap.umidade - ctxRef.umidade);
    if (du > 20) fator *= 1.01;
  }
  return fator;
}
