// ═══════════════════════════════════════════════════════════
// PedagogicalDecider — decisão ATACAR/MANTER/CONSOLIDAR/IGNORAR por parcial
// ═══════════════════════════════════════════════════════════
// Matriz (SPEC §31):
//                    │ Score ALTO (≥95)    │ Score BAIXO (<95)
//   ─────────────────┼─────────────────────┼────────────────────────
//   Repet. ALTA (≥.85) │ MANTER             │ ATACAR
//   Repet. BAIXA      │ CONSOLIDAR         │ IGNORAR AGORA

export const Decisao = Object.freeze({
  MANTER:      'manter',
  ATACAR:      'atacar',
  CONSOLIDAR:  'consolidar',
  IGNORAR:     'ignorar',
  INDEFINIDO:  'indefinido',
});

const TH_SCORE_ALTO = 95;
const TH_REPET_ALTA = 0.85;

const RAZAO_TEXTO = {
  [Decisao.MANTER]:     'trecho forte e consistente — proteger',
  [Decisao.ATACAR]:     'erro consistente — corrigir agora',
  [Decisao.CONSOLIDAR]: 'rápido mas aleatório — estabilizar antes de mexer',
  [Decisao.IGNORAR]:    'caótico e ruim — coletar mais dados antes',
  [Decisao.INDEFINIDO]: 'dados insuficientes',
};

export const PedagogicalDecider = {
  Decisao,
  TH_SCORE_ALTO,
  TH_REPET_ALTA,

  /**
   * Decisão de uma parcial isolada.
   * @param {object} input
   * @param {number} input.score          0..100
   * @param {number} input.repetibilidade 0..1
   * @returns {{decisao, razao}}
   */
  decide({ score, repetibilidade } = {}) {
    if (score == null || repetibilidade == null) {
      return { decisao: Decisao.INDEFINIDO, razao: RAZAO_TEXTO[Decisao.INDEFINIDO] };
    }
    const scoreAlto = score >= TH_SCORE_ALTO;
    const repetAlta = repetibilidade >= TH_REPET_ALTA;

    let decisao;
    if (scoreAlto && repetAlta)        decisao = Decisao.MANTER;
    else if (!scoreAlto && repetAlta)  decisao = Decisao.ATACAR;
    else if (scoreAlto && !repetAlta)  decisao = Decisao.CONSOLIDAR;
    else                                decisao = Decisao.IGNORAR;

    return { decisao, razao: RAZAO_TEXTO[decisao] };
  },

  /**
   * Decide para todas as parciais do vm.
   *
   * Espera:
   *   vm.parciais        — lista de { id, nome, apelido }
   *   vm.laps            — com scoresPorParcial[id] opcional
   *   vm.repetibilidade  — { porParcial: { [id]: { index } } }
   *
   * @returns {{porParcial: {[id]: dado}, lista: [dado]}}
   */
  decideForParciais(vm) {
    const result = { porParcial: {}, lista: [] };
    if (!vm?.parciais || !vm.laps || !vm.repetibilidade) return result;

    const validas = vm.laps.filter(l => l.valida);
    for (const p of vm.parciais) {
      const scoresValidos = validas.map(l => l.scoresPorParcial?.[p.id]).filter(v => v != null);
      const scoreMedio = scoresValidos.length
        ? scoresValidos.reduce((a, b) => a + b, 0) / scoresValidos.length
        : null;
      const repet = vm.repetibilidade.porParcial?.[p.id]?.index ?? null;

      const d = this.decide({ score: scoreMedio, repetibilidade: repet });
      const dado = {
        parcialId: p.id,
        parcialNome: p.nome,
        parcialApelido: p.apelido || null,
        ...d,
        score: scoreMedio != null ? Math.round(scoreMedio * 10) / 10 : null,
        repetibilidade: repet,
      };
      result.porParcial[p.id] = dado;
      result.lista.push(dado);
    }
    return result;
  },

  agrupar(resultado) {
    const g = { manter: [], atacar: [], consolidar: [], ignorar: [] };
    if (!resultado?.lista) return g;
    for (const item of resultado.lista) {
      if (item.decisao === Decisao.MANTER)          g.manter.push(item);
      else if (item.decisao === Decisao.ATACAR)     g.atacar.push(item);
      else if (item.decisao === Decisao.CONSOLIDAR) g.consolidar.push(item);
      else if (item.decisao === Decisao.IGNORAR)    g.ignorar.push(item);
    }
    return g;
  },
};
