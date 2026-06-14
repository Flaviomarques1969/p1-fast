// aprendizado-tempo-passagem.js — Aprendizado #2 da visão Flávio (14/06/2026):
// "o tempo de passagem — acha o ponto de troca que entrega o MELHOR TEMPO NA
//  PISTA (não o limite do motor) e afina a cada passagem".
//
// Os outros módulos do cérebro escolhem o ponto de troca por TEORIA (curva de
// força). Este aqui escolhe pela REALIDADE: para cada (trecho × marcha), guarda
// em que rotação a troca foi feita em cada passagem e qual foi o TEMPO daquela
// passagem. Com o tempo, converge para a rotação de troca que rendeu os menores
// tempos — medido, não chutado. É isto que resolve objetivamente "trocar em 6.050
// (potência máxima) vs esticar perto do redline": vence quem dá o menor tempo.
//
// Função pura (estado encapsulado no factory; persistência via export/import).

const BIN_RPM_PADRAO = 25;          // agrupa pontos de troca próximos (passo 25 rpm)
const MIN_AMOSTRAS_BIN = 2;         // mínimo de passagens por ponto pra ele "contar"
const AMOSTRAS_P_CONFIANCA = 4;     // nº de passagens no melhor ponto p/ confiança plena
const GAP_REF_FRACAO = 0.005;       // 0,5% do tempo de volta = diferença "clara" entre pontos

/**
 * Cria o aprendiz de ponto de troca por tempo de passagem.
 * @param {Object} [opts]
 * @param {number} [opts.binRpm=25]            — resolução do agrupamento de rotação
 * @param {number} [opts.minAmostrasBin=2]     — passagens mínimas p/ um ponto contar
 */
export function criarAprendizadoTempoPassagem({
  binRpm = BIN_RPM_PADRAO,
  minAmostrasBin = MIN_AMOSTRAS_BIN,
} = {}) {
  // chave "trecho:marcha" → Map<binRpm, { amostras, somaMs, melhorMs }>
  const porChave = new Map();

  function _chave(trechoId, marcha) { return `${trechoId}:${marcha}`; }
  function _bin(rpm) { return Math.round(rpm / binRpm) * binRpm; }

  /**
   * Registra uma passagem concluída: em que rotação trocou + o tempo medido.
   * O chamador deve passar SÓ passagens válidas (volta/setor limpo).
   * @param {Object} p
   * @param {string} p.trechoId
   * @param {number} p.marcha      — marcha de ORIGEM da troca (a que estava antes)
   * @param {number} p.shiftRpm    — rotação em que a troca foi feita nesta passagem
   * @param {number} p.tempoMs     — tempo da passagem (setor ou volta) em ms; menor = melhor
   * @returns {boolean} true se registrou
   */
  function registrarPassagem({ trechoId, marcha, shiftRpm, tempoMs } = {}) {
    if (!trechoId || typeof marcha !== 'number') return false;
    if (!Number.isFinite(shiftRpm) || shiftRpm <= 0) return false;
    if (!Number.isFinite(tempoMs) || tempoMs <= 0) return false;

    const chave = _chave(trechoId, marcha);
    const bins = porChave.get(chave) || new Map();
    const b = _bin(shiftRpm);
    const cur = bins.get(b) || { amostras: 0, somaMs: 0, melhorMs: Infinity };
    cur.amostras += 1;
    cur.somaMs += tempoMs;
    if (tempoMs < cur.melhorMs) cur.melhorMs = tempoMs;
    bins.set(b, cur);
    porChave.set(chave, bins);
    return true;
  }

  /**
   * Devolve o ponto de troca (rotação) que rendeu os menores tempos para o
   * (trecho × marcha), comparando os pontos já experimentados.
   *
   * Critério: entre os pontos com amostras suficientes, vence o de MENOR tempo
   * MÉDIO; empate desempata pelo melhor tempo absoluto. Sem comparação possível
   * (nenhum ponto qualificado) → null.
   *
   * @returns {{rpm:number, tempoMedioMs:number, melhorMs:number, amostras:number,
   *            confianca:number, pontosComparados:number, fonte:'tempo_passagem'}|null}
   */
  function getMelhorPontoPorTempo({ trechoId, marcha } = {}) {
    if (!trechoId || typeof marcha !== 'number') return null;
    const bins = porChave.get(_chave(trechoId, marcha));
    if (!bins || bins.size === 0) return null;

    const qualificados = [];
    for (const [rpm, info] of bins.entries()) {
      if (info.amostras >= minAmostrasBin) {
        qualificados.push({ rpm, mediaMs: info.somaMs / info.amostras, melhorMs: info.melhorMs, amostras: info.amostras });
      }
    }
    if (qualificados.length === 0) return null;

    qualificados.sort((a, b) =>
      a.mediaMs !== b.mediaMs ? a.mediaMs - b.mediaMs : a.melhorMs - b.melhorMs);
    const melhor = qualificados[0];
    const segundo = qualificados[1] || null;

    // Confiança: cresce com nº de passagens no melhor ponto e com a folga de
    // tempo pro 2º melhor (vitória clara = mais confiança). Com um ponto só,
    // não há comparação → folga neutra (0,5).
    const fatorAmostras = Math.min(1, melhor.amostras / AMOSTRAS_P_CONFIANCA);
    let fatorFolga = 0.5;
    if (segundo) {
      const folga = (segundo.mediaMs - melhor.mediaMs);
      const refFolga = melhor.mediaMs * GAP_REF_FRACAO;
      fatorFolga = refFolga > 0 ? Math.max(0, Math.min(1, folga / refFolga)) : 0.5;
    }
    const confianca = Number((fatorAmostras * fatorFolga).toFixed(3));

    return {
      rpm: melhor.rpm,
      tempoMedioMs: Math.round(melhor.mediaMs),
      melhorMs: Math.round(melhor.melhorMs),
      amostras: melhor.amostras,
      confianca,
      pontosComparados: qualificados.length,
      fonte: 'tempo_passagem',
    };
  }

  /** Detalhe por (trecho × marcha) para auditoria/debug. */
  function getDetalhes() {
    const out = {};
    for (const [chave, bins] of porChave.entries()) {
      out[chave] = Array.from(bins.entries())
        .map(([rpm, i]) => ({ rpm, amostras: i.amostras, mediaMs: Math.round(i.somaMs / i.amostras), melhorMs: Math.round(i.melhorMs) }))
        .sort((a, b) => a.rpm - b.rpm);
    }
    return out;
  }

  /** Exporta o estado aprendido (para persistir entre sessões). */
  function exportarEstado() {
    const out = {};
    for (const [chave, bins] of porChave.entries()) {
      out[chave] = Array.from(bins.entries()).map(([rpm, i]) => ({
        rpm, amostras: i.amostras, somaMs: i.somaMs, melhorMs: i.melhorMs,
      }));
    }
    return { versao: 1, binRpm, dados: out };
  }

  /** Importa estado persistido (idempotente; substitui o estado atual). */
  function importarEstado(estado) {
    porChave.clear();
    if (!estado || !estado.dados) return;
    for (const [chave, lista] of Object.entries(estado.dados)) {
      const bins = new Map();
      for (const it of (Array.isArray(lista) ? lista : [])) {
        if (!Number.isFinite(it.rpm)) continue;
        bins.set(it.rpm, {
          amostras: it.amostras || 0,
          somaMs: it.somaMs || 0,
          melhorMs: Number.isFinite(it.melhorMs) ? it.melhorMs : Infinity,
        });
      }
      if (bins.size) porChave.set(chave, bins);
    }
  }

  /** Reseta tudo (ex: trocou configuração mecânica do carro). */
  function reset() { porChave.clear(); }

  return {
    registrarPassagem,
    getMelhorPontoPorTempo,
    getDetalhes,
    exportarEstado,
    importarEstado,
    reset,
  };
}
