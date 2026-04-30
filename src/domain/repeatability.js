// ═══════════════════════════════════════════════════════════
// Repeatability — índice de consistência
// ═══════════════════════════════════════════════════════════
// Separa "muito rápido porém aleatório" de "menos rápido porém repetível".
// CV (coeficiente de variação) normalizado em índice 0..1.
// Janela: últimas N voltas válidas (default 5).

const CV_MAX_DEFAULT = 0.05;

function mean(xs) {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs, m = null) {
  if (xs.length < 2) return 0;
  const mu = m ?? mean(xs);
  const sq = xs.reduce((s, x) => s + (x - mu) * (x - mu), 0);
  return Math.sqrt(sq / (xs.length - 1));
}

export const Repeatability = {
  CV_MAX_DEFAULT,

  fromSeries(values, cvMax = CV_MAX_DEFAULT) {
    const xs = values.filter(v => v != null && !Number.isNaN(v) && v > 0);
    if (xs.length < 2) return null;
    const mu = mean(xs);
    const sd = stdev(xs, mu);
    const cv = mu > 0 ? sd / mu : 0;
    const index = Math.max(0, Math.min(1, 1 - cv / cvMax));
    return {
      index: Math.round(index * 1000) / 1000,
      cv: Math.round(cv * 10000) / 10000,
      mean: Math.round(mu * 100) / 100,
      stdev: Math.round(sd * 100) / 100,
      n: xs.length,
    };
  },

  fromLaps(laps, field = 'tempoMs', N = 5, cvMax = CV_MAX_DEFAULT) {
    const ultimas = laps.filter(l => l.valida).slice(-N);
    const values = ultimas.map(l => l[field]);
    return this.fromSeries(values, cvMax);
  },

  fromParcial(laps, parcialId, N = 5, cvMax = CV_MAX_DEFAULT) {
    const ultimas = laps.filter(l => l.valida).slice(-N);
    const values = ultimas.map(l => l.temposPorParcial?.[parcialId]);
    return this.fromSeries(values, cvMax);
  },

  /**
   * Resumo: repet. de tempo de volta + por parcial (N variável por pista).
   * @param {Array} laps
   * @param {Array} parciais  lista de { id, nome, ... } do TrackLayout
   * @param {number} N
   * @returns {{volta, porParcial:{[id]:res}, overall}}
   */
  summary(laps, parciais = [], N = 5) {
    const volta = this.fromLaps(laps, 'tempoMs', N);
    const porParcial = {};
    for (const p of parciais) {
      porParcial[p.id] = this.fromParcial(laps, p.id, N);
    }
    const indices = [volta, ...Object.values(porParcial)]
      .filter(r => r != null).map(r => r.index);
    const overall = indices.length > 0
      ? { index: Math.round(indices.reduce((a, b) => a + b, 0) / indices.length * 1000) / 1000 }
      : null;
    return { volta, porParcial, overall };
  },

  categoria(index) {
    if (index == null) return 'indefinido';
    if (index >= 0.85) return 'alta';
    if (index >= 0.65) return 'media';
    return 'baixa';
  },
};
