// ═══════════════════════════════════════════════════════════
// Estratégia ideal de ápice — regras canônicas de pilotagem
// ═══════════════════════════════════════════════════════════
// Decide se uma curva pede:
//   - ÁPICE TARDIO: entrar mais devagar, sair mais aberto, acelera cedo
//     (ideal: curva apertada seguida de reta longa)
//   - ÁPICE GEOMÉTRICO: mantém a maior velocidade média na curva
//     (ideal: curva rápida e aberta, ou apertada sem reta significativa
//     depois)
//   - ÁPICE ANTECIPADO: passa pelo interno cedo pra preparar a próxima
//     (ideal: curva apertada antes de outra curva apertada)
//
// Referências:
//   - Driver61: How to Drive the Perfect Racing Line
//   - simracingcockpit.gg: Racing Line Explained
//   - speedsecrets.com: The Late Apex Explained

/**
 * @typedef {'antecipado'|'geometrico'|'tardio'} TipoApice
 */

/**
 * @typedef {Object} EstrategiaIdeal
 * @property {TipoApice} tipo
 * @property {string} explicacao  Frase curta explicando porque essa é a meta
 * @property {number} confianca   0..1 — quanto a regra "se aplica" com certeza
 */

/**
 * Decide a estratégia ideal de ápice pra uma curva.
 *
 * @param {Object} geometria  saída de calcularGeometria()
 * @returns {EstrategiaIdeal}
 */
export function estrategiaIdeal(geometria) {
  if (!geometria) return null;
  const { raioM, retaAntesM, retaDepoisM, temCurvaPropxAntes, temCurvaPropxDepois, classificacao } = geometria;

  // REGRA 1 — Curva apertada antes de outra curva apertada → ANTECIPADO
  // (sacrificar essa curva pra preparar a próxima)
  if (temCurvaPropxDepois && classificacao === 'apertada') {
    return {
      tipo: 'antecipado',
      explicacao: `Curva apertada (raio ${raioM.toFixed(0)} m) seguida de outra curva colada. Vale a pena passar pelo interno cedo pra abrir a entrada da próxima.`,
      confianca: 0.85,
    };
  }

  // REGRA 2 — Curva apertada + reta longa depois → TARDIO
  // (entra devagar, sai aberto, acelera mais cedo na reta)
  if ((classificacao === 'apertada' || classificacao === 'media') && retaDepoisM > 120) {
    return {
      tipo: 'tardio',
      explicacao: `Curva ${classificacao === 'apertada' ? 'apertada' : 'média'} (raio ${raioM.toFixed(0)} m) seguida de reta de ${retaDepoisM.toFixed(0)} m. Ápice tardio abre a saída e ganha tempo na aceleração.`,
      confianca: 0.9,
    };
  }

  // REGRA 3 — Curva rápida ou aberta → GEOMÉTRICO
  // (mantém velocidade média alta)
  if (classificacao === 'rapida') {
    return {
      tipo: 'geometrico',
      explicacao: `Curva rápida (raio ${raioM.toFixed(0)} m). Ápice geométrico mantém a maior velocidade média.`,
      confianca: 0.8,
    };
  }

  // REGRA 4 — Curva apertada sem reta depois → GEOMÉTRICO
  // (não vale comprometer entrada)
  if (classificacao === 'apertada' && retaDepoisM < 80) {
    return {
      tipo: 'geometrico',
      explicacao: `Curva apertada (raio ${raioM.toFixed(0)} m) sem reta significativa depois (${retaDepoisM.toFixed(0)} m). Ápice geométrico balanceia entrada e saída.`,
      confianca: 0.75,
    };
  }

  // PADRÃO — Curva média sem características marcantes → GEOMÉTRICO
  return {
    tipo: 'geometrico',
    explicacao: `Curva média (raio ${raioM.toFixed(0)} m, reta depois ${retaDepoisM.toFixed(0)} m). Sem padrão dominante; ápice geométrico é a referência segura.`,
    confianca: 0.6,
  };
}
