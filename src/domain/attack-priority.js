// ═══════════════════════════════════════════════════════════
// AttackPriority — prioridade técnica de ataque por PARCIAL
// ═══════════════════════════════════════════════════════════
// Fórmula:
//   impactoMs  = média(tempoParcial das últimas válidas) - melhorParcial
//   fatorRepet = 1.0 alta | 0.8 media | 0.5 baixa | 0.7 indefinido
//   prioridade = impactoMs × fatorRepet
//
// Justificativa: atacar parcial inconsistente arrisca perder o que tá bom.
// Consolidar consistência primeiro.

import { Benchmarks } from './benchmark.js';
import { Repeatability } from './repeatability.js';
import { Laps } from './lap.js';

const FATOR_REPETIBILIDADE = {
  alta: 1.0, media: 0.8, baixa: 0.5, indefinido: 0.7,
};

function mean(xs) {
  const v = xs.filter(x => x != null && x > 0);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export const AttackPriority = {
  /**
   * @param {object} input
   * @param {Array} input.laps
   * @param {object} input.benchmark   { parciais, melhorPorParcial, ... }
   * @param {object} input.repetibilidade   { porParcial: { [id]: res } }
   * @returns {{ranking: [...], top3: [...]}}
   */
  compute({ laps, benchmark, repetibilidade } = {}) {
    if (!laps || !benchmark?.melhorPorParcial || !benchmark.parciais) {
      return { ranking: [], top3: [] };
    }
    const ranking = [];
    for (const p of benchmark.parciais) {
      const tempos = laps.filter(l => l.valida).map(l => l.temposPorParcial?.[p.id]);
      const m = mean(tempos);
      const melhor = benchmark.melhorPorParcial[p.id]?.tempoMs;
      if (m == null || melhor == null) continue;

      const impactoMs = m - melhor;
      const repIndex = repetibilidade?.porParcial?.[p.id]?.index;
      const cat = Repeatability.categoria(repIndex);
      const fator = FATOR_REPETIBILIDADE[cat] ?? 0.7;
      const prioridade = impactoMs * fator;

      let razao;
      if (cat === 'baixa')      razao = 'inconsistente — consolidar antes';
      else if (cat === 'media') razao = 'potencial moderado';
      else if (cat === 'alta')  razao = 'consistente e acima do melhor — atacável';
      else                       razao = 'sem dados suficientes';

      ranking.push({
        parcialId: p.id,
        parcialNome: p.nome,
        parcialApelido: p.apelido || null,
        impactoMs: Math.round(impactoMs),
        prioridade: Math.round(prioridade * 10) / 10,
        repetibilidadeCategoria: cat,
        repetibilidadeIndex: repIndex ?? null,
        razao,
        tempoMedio: Math.round(m),
        tempoMelhor: melhor,
      });
    }

    ranking.sort((a, b) => b.prioridade - a.prioridade);
    return { ranking, top3: ranking.slice(0, 3) };
  },

  async computeForSession(sessionId) {
    const allLaps = await Laps.listAll(sessionId);
    const benchmark = await Benchmarks.computeForSession(sessionId);
    if (!benchmark) return { ranking: [], top3: [] };
    const repet = Repeatability.summary(allLaps, benchmark.parciais, 5);
    return this.compute({ laps: allLaps, benchmark, repetibilidade: repet });
  },

  /**
   * Versão por TRECHO (gate 2026-04-24, docs/raceops/CORNER_ANALYSIS_RULES.md).
   * Mesma fórmula da `compute()` mas opera por trecho ao invés de parcial.
   * Permite priorizar curva específica em vez de parcial inteira — alinhado
   * com a regra de que parcial agrega vários trechos.
   *
   * @param {object} input
   * @param {Array} input.laps                       — voltas com `temposPorTrecho`
   * @param {Array} input.trechos                    — trackSegments com ehTrecho=true
   * @param {object} input.melhorPorTrecho           — { [trechoId]: { tempoMs } }
   * @param {object} [input.repetibilidadePorTrecho] — { [trechoId]: { index } } opcional
   * @returns {{ranking: [...], top3: [...]}}
   */
  computeForTrechos({ laps, trechos, melhorPorTrecho, repetibilidadePorTrecho } = {}) {
    if (!laps || !trechos?.length || !melhorPorTrecho) {
      return { ranking: [], top3: [] };
    }
    const validas = laps.filter(l => l.valida);
    const ranking = [];
    for (const t of trechos) {
      const tempos = validas.map(l => l.temposPorTrecho?.[t.id]);
      const m = mean(tempos);
      const melhor = melhorPorTrecho[t.id]?.tempoMs;
      if (m == null || melhor == null) continue;

      const impactoMs = m - melhor;
      const repIndex = repetibilidadePorTrecho?.[t.id]?.index;
      const cat = repIndex != null ? Repeatability.categoria(repIndex) : 'indefinido';
      const fator = FATOR_REPETIBILIDADE[cat] ?? 0.7;
      const prioridade = impactoMs * fator;

      let razao;
      if (cat === 'baixa')      razao = 'inconsistente — consolidar antes';
      else if (cat === 'media') razao = 'potencial moderado';
      else if (cat === 'alta')  razao = 'consistente e acima do melhor — atacável';
      else                       razao = 'sem dados de repetibilidade — usar com cautela';

      ranking.push({
        trechoId: t.id,
        trechoNome: t.nome,
        parcialId: t.parcialId,
        impactoMs: Math.round(impactoMs),
        prioridade: Math.round(prioridade * 10) / 10,
        repetibilidadeCategoria: cat,
        repetibilidadeIndex: repIndex ?? null,
        razao,
        tempoMedio: Math.round(m),
        tempoMelhor: melhor,
        amostras: tempos.filter(v => v != null).length,
      });
    }

    ranking.sort((a, b) => b.prioridade - a.prioridade);
    return { ranking, top3: ranking.slice(0, 3) };
  },
};
