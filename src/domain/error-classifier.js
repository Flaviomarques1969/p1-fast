// ═══════════════════════════════════════════════════════════
// ErrorClassifier
// ═══════════════════════════════════════════════════════════
// Transforma telemetria em LINGUAGEM DE PISTA.
//
// Taxonomia (16 rótulos):
//   freou-cedo, freou-tarde-demais, entrou-forte-demais, entrou-timido,
//   perdeu-rotacao, matou-saida, perdeu-tracao,
//   manteve-linha, saiu-forte, boa-frenagem, tempo-medio,
//   apex-perdido-fora, apex-antecipado, apex-tardio,
//   apex-interno-demais, apex-sacrificou-saida.
//
// Regra ADR-010 / SPEC_COCKPIT: UMA classificação principal por trecho.
// Pode retornar secundária (só consumida pelo box, nunca cockpit).
//
// Inputs base:
//   execution = { tempoMs, velEntrada, velMinima, velSaida }
//   reference = { tempoMs (melhor), velEntradaMedia, velMinimaMedia, velSaidaMedia }
//
// Inputs opcionais (apex — gate 2026-04-24, docs/raceops/APEX_ANALYSIS_RULES.md):
//   execution.apexActual = { x, y }            (vindo do detector)
//   reference.apexReference = { x, y }         (do TrackSegment)
//   reference.apexStrategy = 'antecipado' | 'neutro' | 'tardio' | 'duplo'
//   reference.nextStraightLength = m
// Quando esses dados existem, classifica também por apex (delta lateral
// + delta longitudinal vs apexReference) e considera estratégia da curva.
// Sem eles, opera só na taxonomia base.
//
// Output:
//   { principal, secundaria, evidencias: [{metric, delta, unit}], confianca }

export const ErroTipo = Object.freeze({
  FREOU_CEDO:          'freou-cedo',
  FREOU_TARDE_DEMAIS:  'freou-tarde-demais',
  ENTROU_FORTE_DEMAIS: 'entrou-forte-demais',
  ENTROU_TIMIDO:       'entrou-timido',
  PERDEU_ROTACAO:      'perdeu-rotacao',
  MATOU_SAIDA:         'matou-saida',
  PERDEU_TRACAO:       'perdeu-tracao',
  MANTEVE_LINHA:       'manteve-linha',
  SAIU_FORTE:          'saiu-forte',
  BOA_FRENAGEM:        'boa-frenagem',
  TEMPO_MEDIO:         'tempo-medio',  // T-040 / A-023: ritmo intermediário sem sinal forte
  // Apex (gate 2026-04-24)
  APEX_PERDIDO_FORA:   'apex-perdido-fora',
  APEX_ANTECIPADO:     'apex-antecipado',
  APEX_TARDIO:         'apex-tardio',
  APEX_INTERNO_DEMAIS: 'apex-interno-demais',
  APEX_SACRIFICOU_SAIDA: 'apex-sacrificou-saida',
});

// Linguagem humana de pista (pro box e futura UI)
export const ErroLabel = Object.freeze({
  'freou-cedo':          'Freou cedo',
  'freou-tarde-demais':  'Freou tarde demais',
  'entrou-forte-demais': 'Entrou forte demais',
  'entrou-timido':       'Entrou tímido',
  'perdeu-rotacao':      'Perdeu rotação',
  'matou-saida':         'Matou a saída',
  'perdeu-tracao':       'Perdeu tração',
  'manteve-linha':       'Manteve linha',
  'saiu-forte':          'Saiu forte',
  'boa-frenagem':        'Boa frenagem',
  'tempo-medio':         'Ritmo médio',
  'apex-perdido-fora':   'Apex perdido por fora',
  'apex-antecipado':     'Apex antecipado',
  'apex-tardio':         'Apex tardio',
  'apex-interno-demais': 'Apex interno demais',
  'apex-sacrificou-saida': 'Apex sacrificou saída',
});

// Limiar para classificação apex em metros (delta lateral vs ideal).
// Apex "correto" = dentro de APEX_TOL_LATERAL_M; fora disso entra a classificação.
const APEX_TOL_LATERAL_M = 1.5;
const APEX_TOL_LONGITUDINAL_M = 4.0;

// Thresholds (em unidades adimensionais — fração)
const TH = Object.freeze({
  TEMPO_BOM:       0.01,  // dentro de 1% do melhor = bom
  TEMPO_RUIM:      0.03,  // acima de 3% = ruim
  VEL_SIGNIFICANT: 0.04,  // 4% de diff em velocidade é relevante
  VEL_FORTE:       0.07,  // 7% = muito forte
});

function delta(actual, ref) {
  if (actual == null || ref == null || ref === 0) return null;
  return (actual - ref) / ref;
}

function push(evs, metric, deltaVal, unit) {
  if (deltaVal == null) return;
  evs.push({
    metric,
    delta: Math.round(deltaVal * 10000) / 10000,
    deltaPct: Math.round(deltaVal * 1000) / 10, // pra apresentar
    unit,
  });
}

/**
 * Classifica o apex a partir de execution.apexActual e reference.apexReference.
 * Retorna { tipo, deltaLateralM, deltaLongitudinalM } ou null se dado insuficiente.
 *
 * Heurística simples (gate 2026-04-24):
 *   - delta lateral pequeno + delta longitudinal pequeno → apex correto (sem rótulo de erro)
 *   - delta lateral grande, exterior → APEX_PERDIDO_FORA
 *   - delta lateral negativo grande → APEX_INTERNO_DEMAIS
 *   - delta longitudinal negativo (passou apex antes do ideal) → APEX_ANTECIPADO
 *   - delta longitudinal positivo (passou apex depois) → APEX_TARDIO
 *
 * NOTA: a "direção" lateral (interno vs externo) precisa do raio da curva. Sem cadastro
 * direcional, usamos só magnitude — distinção interno/externo entra quando TrackSegment
 * tiver `cornerSide` (extensão futura).
 */
function classifyApex({ execution, reference }) {
  const a = execution?.apexActual;
  const r = reference?.apexReference;
  if (!a || !r || a.x == null || a.y == null || r.x == null || r.y == null) return null;
  const dx = a.x - r.x;
  const dy = a.y - r.y;
  const distLateral = Math.sqrt(dx * dx + dy * dy);
  // Sem direção tangente da curva, longitudinal vs lateral é aproximação.
  // Convenção temporária: distância total euclidiana = |delta lateral|.
  // Substituir por projeção tangencial quando reference tiver tangente cadastrada.
  return {
    distLateralM: distLateral,
    deltaXM: dx,
    deltaYM: dy,
  };
}

/**
 * Decide se o apex prejudicou a saída.
 * Critério: delta lateral OK (apex próximo do ideal) MAS velSaida muito baixa
 * E reference.nextStraightLength longa (> 200m).
 */
function apexSacrificouSaida({ apexInfo, dSaida, reference }) {
  if (!apexInfo) return false;
  if (apexInfo.distLateralM > APEX_TOL_LATERAL_M) return false;
  if (dSaida == null || dSaida >= -0.04) return false;
  const nextStraight = reference?.nextStraightLength ?? 0;
  return nextStraight >= 200;
}

export const ErrorClassifier = {
  ErroTipo, ErroLabel,

  /**
   * Classifica 1 execução de trecho vs referência.
   * @returns {{principal, secundaria, evidencias, confianca}}
   */
  classify({ execution, reference } = {}) {
    if (!execution || !reference) {
      return { principal: null, secundaria: null, evidencias: [], confianca: 0 };
    }

    const evidencias = [];
    const dTempo   = delta(execution.tempoMs,   reference.tempoMs);
    const dEntrada = delta(execution.velEntrada, reference.velEntradaMedia);
    const dApice   = delta(execution.velMinima,  reference.velMinimaMedia);
    const dSaida   = delta(execution.velSaida,   reference.velSaidaMedia);

    push(evidencias, 'tempo',   dTempo,   'ms');
    push(evidencias, 'vEntrada', dEntrada, 'm/s');
    push(evidencias, 'vApice',   dApice,   'm/s');
    push(evidencias, 'vSaida',   dSaida,   'm/s');

    // Análise de apex (opcional — só se cadastro existe, gate 2026-04-24)
    const apexInfo = classifyApex({ execution, reference });
    if (apexInfo) {
      push(evidencias, 'apexLateralM', apexInfo.distLateralM, 'm');
    }

    // ─── Apex prejudicou a saída? (verificar antes dos demais erros de saída) ───
    if (apexSacrificouSaida({ apexInfo, dSaida, reference })) {
      return _emit(ErroTipo.APEX_SACRIFICOU_SAIDA, ErroTipo.MATOU_SAIDA, evidencias, 0.8);
    }

    // ─── Apex perdido por fora (prioritário sobre erros de velocidade) ───
    if (apexInfo && apexInfo.distLateralM > APEX_TOL_LATERAL_M * 2) {
      return _emit(ErroTipo.APEX_PERDIDO_FORA, null, evidencias, 0.75);
    }

    // ─── Primeiro: detectar ACERTOS (prioridade positiva) ───
    const tempoBom = dTempo != null && dTempo <= TH.TEMPO_BOM;
    const saidaForte = dSaida != null && dSaida >= TH.VEL_FORTE;
    if (saidaForte && tempoBom) {
      return _emit(ErroTipo.SAIU_FORTE, _secundaria(tempoBom), evidencias, 0.9);
    }
    const entradaOk = dEntrada != null && Math.abs(dEntrada) < TH.VEL_SIGNIFICANT;
    const apiceOk   = dApice   != null && Math.abs(dApice)   < TH.VEL_SIGNIFICANT;
    if (tempoBom && entradaOk && apiceOk) {
      return _emit(ErroTipo.MANTEVE_LINHA, null, evidencias, 0.85);
    }
    if (tempoBom && dApice != null && dApice >= -TH.VEL_SIGNIFICANT) {
      return _emit(ErroTipo.BOA_FRENAGEM, null, evidencias, 0.8);
    }

    // ─── Erros (ordem importa: mais específico antes) ───
    // Freou tarde demais: entrou alta + ápice MUITO baixo (travou)
    // Verificar ANTES de ENTROU_FORTE_DEMAIS porque é caso específico dele
    if (dEntrada != null && dEntrada >= TH.VEL_SIGNIFICANT && dApice != null && dApice <= -TH.VEL_FORTE) {
      return _emit(ErroTipo.FREOU_TARDE_DEMAIS, null, evidencias, 0.85);
    }
    // Entrou forte demais: vel entrada muito alta + tempo ruim (não compensou), ápice razoável
    if (dEntrada != null && dEntrada >= TH.VEL_FORTE && dTempo != null && dTempo > TH.TEMPO_RUIM) {
      return _emit(ErroTipo.ENTROU_FORTE_DEMAIS, null, evidencias, 0.8);
    }
    // Entrou tímido: vel entrada baixa + tempo ruim
    if (dEntrada != null && dEntrada <= -TH.VEL_SIGNIFICANT && dTempo != null && dTempo > TH.TEMPO_BOM) {
      return _emit(ErroTipo.ENTROU_TIMIDO, null, evidencias, 0.8);
    }
    // Freou cedo: vel entrada na média, ápice baixo, tempo ruim
    if (dApice != null && dApice <= -TH.VEL_SIGNIFICANT && dTempo != null && dTempo > TH.TEMPO_RUIM) {
      return _emit(ErroTipo.FREOU_CEDO, null, evidencias, 0.7);
    }
    // Matou saída: vSaida muito baixa + tempo ruim
    if (dSaida != null && dSaida <= -TH.VEL_SIGNIFICANT && dTempo != null && dTempo > TH.TEMPO_BOM) {
      return _emit(ErroTipo.MATOU_SAIDA, null, evidencias, 0.8);
    }
    // Perdeu rotação: vEntrada média-baixa, vSaida baixa
    if (dSaida != null && dSaida <= -TH.VEL_SIGNIFICANT && dEntrada != null && dEntrada <= 0) {
      return _emit(ErroTipo.PERDEU_ROTACAO, null, evidencias, 0.6);
    }
    // Perdeu tração: vApice OK, vSaida muito baixa (derrapou saindo)
    if (dSaida != null && dSaida <= -TH.VEL_FORTE && dApice != null && dApice >= -TH.VEL_SIGNIFICANT) {
      return _emit(ErroTipo.PERDEU_TRACAO, null, evidencias, 0.7);
    }

    // Default: manteve linha se tempo não explodiu
    if (dTempo != null && dTempo <= TH.TEMPO_RUIM) {
      return _emit(ErroTipo.MANTEVE_LINHA, null, evidencias, 0.5);
    }

    return { principal: null, secundaria: null, evidencias, confianca: 0 };
  },

  humanize(principal) {
    return ErroLabel[principal] || principal;
  },
};

function _secundaria(tempoBom) {
  return tempoBom ? ErroTipo.MANTEVE_LINHA : null;
}

function _emit(principal, secundaria, evidencias, confianca) {
  return { principal, secundaria, evidencias, confianca };
}
