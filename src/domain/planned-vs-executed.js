// ═══════════════════════════════════════════════════════════
// PlannedVsExecuted — avaliação pedagógica do plano
// ═══════════════════════════════════════════════════════════
// Para cada foco do plano (um por PARCIAL), analisa as execuções reais
// daquela parcial e emite veredicto:
//
//   CONSEGUIU         → ação alvo foi observada consistentemente
//   PARCIAL           → só parte das voltas mostrou a ação alvo
//   TENTOU_FALHOU     → tentou a ação mas terminou em erro
//   ERRADO            → não executou a ação planejada (fez outra coisa)
//   SEM_DADOS         → poucas execuções ou sem benchmark

import { ErrorClassifier, ErroTipo } from './error-classifier.js';

export const PvEResultado = Object.freeze({
  CONSEGUIU:      'conseguiu',
  PARCIAL:        'parcial',
  TENTOU_FALHOU:  'tentou-falhou',
  ERRADO:         'errado',
  SEM_DADOS:      'sem-dados',
});

const ACAO_MAP = {
  'atrasar frenagem':   { alinhadas: [ErroTipo.BOA_FRENAGEM, ErroTipo.MANTEVE_LINHA], tentativas: [ErroTipo.FREOU_TARDE_DEMAIS] },
  'antecipar frenagem': { alinhadas: [ErroTipo.MANTEVE_LINHA, ErroTipo.BOA_FRENAGEM], tentativas: [ErroTipo.FREOU_CEDO] },
  'acelerar mais cedo': { alinhadas: [ErroTipo.SAIU_FORTE, ErroTipo.MANTEVE_LINHA], tentativas: [ErroTipo.PERDEU_TRACAO] },
  'saída mais forte':   { alinhadas: [ErroTipo.SAIU_FORTE, ErroTipo.MANTEVE_LINHA], tentativas: [ErroTipo.PERDEU_TRACAO] },
  'entrar mais forte':  { alinhadas: [ErroTipo.BOA_FRENAGEM, ErroTipo.MANTEVE_LINHA], tentativas: [ErroTipo.ENTROU_FORTE_DEMAIS] },
  'manter linha':       { alinhadas: [ErroTipo.MANTEVE_LINHA], tentativas: [] },
  'reduzir tempo':      { alinhadas: [ErroTipo.MANTEVE_LINHA, ErroTipo.BOA_FRENAGEM, ErroTipo.SAIU_FORTE], tentativas: [] },
  'trabalhar execução': { alinhadas: [ErroTipo.MANTEVE_LINHA, ErroTipo.BOA_FRENAGEM, ErroTipo.SAIU_FORTE], tentativas: [] },
  'focar em':           { alinhadas: [ErroTipo.MANTEVE_LINHA, ErroTipo.BOA_FRENAGEM, ErroTipo.SAIU_FORTE], tentativas: [] },
};

function mapAcao(acao) {
  if (!acao) return null;
  const lower = acao.toLowerCase();
  for (const key of Object.keys(ACAO_MAP)) {
    if (lower.includes(key)) return ACAO_MAP[key];
  }
  return null;
}

function _aggregateVelocidades(execs) {
  const pick = (field) => {
    const vals = execs.map(e => e?.[field]).filter(v => v != null && isFinite(v));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    velEntradaMedia: pick('velEntrada'),
    velMinimaMedia:  pick('velMinima'),
    velSaidaMedia:   pick('velSaida'),
  };
}

function buildReference(parcialId, benchmark, execsPorParcial = {}) {
  const melhor = benchmark?.melhorPorParcial?.[parcialId]?.tempoMs;
  const vels = _aggregateVelocidades(execsPorParcial[parcialId] || []);
  return { tempoMs: melhor ?? null, ...vels };
}

function buildExecution(parcialId, lap, execsDoLap = []) {
  const execParcial = execsDoLap.find(e => e.parcialId === parcialId);
  return {
    tempoMs: lap.temposPorParcial?.[parcialId] ?? null,
    velEntrada: execParcial?.velEntrada ?? null,
    velMinima:  execParcial?.velMinima  ?? null,
    velSaida:   execParcial?.velSaida   ?? null,
  };
}

export const PlannedVsExecuted = {
  PvEResultado,

  /**
   * Avalia o plano contra as voltas da sessão.
   * @param {object} plan       - PedagogicalPlan (focos[].parcialId)
   * @param {Array}  laps
   * @param {object} benchmark  - { parciais, melhorPorParcial, ... }
   */
  evaluate({ plan, laps, benchmark } = {}) {
    if (!plan || !Array.isArray(plan.focos)) return null;
    const validLaps = (laps || []).filter(l => l.valida);

    const focos = plan.focos.map(foco => {
      const { parcialId, parcialNome, acaoPrincipal } = foco;
      const mapping = mapAcao(acaoPrincipal);

      const execucoes = validLaps.map(l => {
        const execution = buildExecution(parcialId, l);
        const reference = buildReference(parcialId, benchmark);
        let classificacao = null;
        if (reference.tempoMs != null && execution.tempoMs != null) {
          const dTempo = (execution.tempoMs - reference.tempoMs) / reference.tempoMs;
          if (dTempo <= 0.01) classificacao = { principal: ErroTipo.MANTEVE_LINHA };
          else if (dTempo <= 0.03) classificacao = { principal: ErroTipo.BOA_FRENAGEM };
          else classificacao = { principal: null };
        }
        return { lapId: l.id, numero: l.numero, tempoMs: execution.tempoMs, classificacao };
      });

      const classificados = execucoes.filter(e => e?.classificacao?.principal != null);
      const resultado = _julgar(mapping, classificados);
      const proximaAcao = _sugerirProxima(resultado, foco);

      return {
        parcialId,
        parcialNome,
        acaoAlvo: acaoPrincipal,
        justificativa: foco.justificativa,
        execucoes,
        resultado,
        proximaAcao,
      };
    });

    return {
      metaPrincipal: plan.metaPrincipal,
      criterioSucesso: plan.criterioSucesso,
      focos,
    };
  },
};

function _julgar(mapping, classificados) {
  if (classificados.length === 0) return PvEResultado.SEM_DADOS;
  if (!mapping) {
    const ok = classificados.filter(c => c.classificacao.principal === ErroTipo.MANTEVE_LINHA).length;
    const pct = ok / classificados.length;
    if (pct >= 0.6) return PvEResultado.PARCIAL;
    return PvEResultado.SEM_DADOS;
  }
  const n = classificados.length;
  const alinhadas = classificados.filter(c => mapping.alinhadas.includes(c.classificacao.principal)).length;
  const tentativas = classificados.filter(c => mapping.tentativas.includes(c.classificacao.principal)).length;
  const pctAlinhadas = alinhadas / n;
  const pctTentativas = tentativas / n;

  if (pctAlinhadas >= 0.6) return PvEResultado.CONSEGUIU;
  if (pctAlinhadas >= 0.3) return PvEResultado.PARCIAL;
  if (pctTentativas >= 0.4) return PvEResultado.TENTOU_FALHOU;
  return PvEResultado.ERRADO;
}

function _sugerirProxima(resultado, foco) {
  const alvo = foco.parcialNome || foco.parcialId;
  switch (resultado) {
    case PvEResultado.CONSEGUIU:     return `manter ${alvo} — ação consolidada`;
    case PvEResultado.PARCIAL:       return `repetir ação em ${alvo} com mais consistência`;
    case PvEResultado.TENTOU_FALHOU: return `executou a ideia mas errou dose — ajustar intensidade em ${alvo}`;
    case PvEResultado.ERRADO:        return `reavaliar ação planejada em ${alvo}`;
    case PvEResultado.SEM_DADOS:     return `coletar mais voltas válidas em ${alvo}`;
    default:                         return null;
  }
}
