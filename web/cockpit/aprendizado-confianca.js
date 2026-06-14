// aprendizado-confianca.js — calcula % de aprendizado completado da
// combinação ativa (carro × câmbio × pneu × autódromo × modo).
//
// Decisão Flávio 2026-05-29: barra de progresso no painel piloto informa
// o quanto o sistema já aprendeu. 0% = só regras-semente; 100% = mapa
// calibrado em todas as marchas críticas e todos os trechos.
//
// Critério de % (calibrado pra Brasília, 8 trechos, 5 marchas, foco em 3,4,5):
//   - Marcha identificada (5 marchas detectadas): 20% do total
//   - Pontos de troca aprendidos por marcha CRÍTICA (3,4,5) em cada trecho: 60%
//   - Validação contra melhor volta (top 30%): 20%
//
// Voltas mínimas estatisticamente robustas (auditor): 8-12 voltas limpas.
// Não 3 como eu havia proposto antes — corrigido.

const MARCHAS_CRITICAS_BRASILIA = [3, 4, 5]; // memória project_p1fast_marchas_uso_brasilia
const NUM_TRECHOS_BRASILIA = 8;              // memória reference_p1fast_barras_brasilia_aprovadas
const VOLTAS_MINIMAS_PARA_100PCT = 10;       // auditor recomendação

export function criarAcumuladorConfianca({ numTrechos = NUM_TRECHOS_BRASILIA, marchasCriticas = MARCHAS_CRITICAS_BRASILIA, voltasMinimas = VOLTAS_MINIMAS_PARA_100PCT } = {}) {
  // Estado:
  //   marchasDetectadas: Set<number>
  //   pontosTrocaPorTrechoMarcha: Map<"trecho:marcha", { rpm, amostras }>
  //   voltasLimpas: number — voltas dentro do top 30% da sessão

  const marchasDetectadas = new Set();
  const pontosPorChave = new Map();
  let voltasLimpas = 0;

  function _pct() {
    // Componente 1: marchas identificadas (20%)
    const pctMarchas = Math.min(1, marchasDetectadas.size / 5) * 20;

    // Componente 2: pontos por trecho × marcha crítica (60%)
    const totalEsperado = numTrechos * marchasCriticas.length;
    let totalCobertos = 0;
    for (const [chave, info] of pontosPorChave.entries()) {
      const [trecho, marcha] = chave.split(':');
      if (!marchasCriticas.includes(Number(marcha))) continue;
      if (info.amostras >= 3) totalCobertos += 1;
    }
    const pctPontos = (totalCobertos / totalEsperado) * 60;

    // Componente 3: voltas limpas (20%)
    const pctVoltas = Math.min(1, voltasLimpas / voltasMinimas) * 20;

    return Math.round(pctMarchas + pctPontos + pctVoltas);
  }

  return {
    /**
     * Registra que uma marcha foi identificada pelo detector.
     */
    registrarMarchaDetectada(marcha) {
      if (typeof marcha === 'number' && marcha >= 1 && marcha <= 5) {
        marchasDetectadas.add(marcha);
      }
    },

    /**
     * Registra um par "trecho + marcha + rpm de troca" aprendido.
     * Cada chamada incrementa contador de amostras pra essa combinação.
     */
    registrarPontoAprendido({ trechoId, marchaOrigem, rpmAprendido }) {
      if (!trechoId || typeof marchaOrigem !== 'number') return;
      const chave = `${trechoId}:${marchaOrigem}`;
      const cur = pontosPorChave.get(chave) || { rpm: rpmAprendido, amostras: 0 };
      // Média móvel sobre amostras
      cur.rpm = Math.round((cur.rpm * cur.amostras + rpmAprendido) / (cur.amostras + 1));
      cur.amostras += 1;
      pontosPorChave.set(chave, cur);
    },

    /**
     * Registra uma volta limpa (dentro do top 30% da sessão).
     * Auditor: 8-12 voltas mínimo pra confiabilidade estatística.
     */
    registrarVoltaLimpa() {
      voltasLimpas += 1;
    },

    /**
     * Retorna a porcentagem de aprendizado (0 a 100).
     */
    getPct() {
      return _pct();
    },

    /**
     * Retorna o ponto aprendido (rpm) pra um trecho + marcha específico,
     * ou null se ainda não há dado suficiente (mín. 3 amostras).
     * Usado pelo orquestrador quando barra está calibrada (100%).
     */
    getPontoAprendido({ trechoId, marchaOrigem }) {
      if (!trechoId || typeof marchaOrigem !== 'number') return null;
      const chave = `${trechoId}:${marchaOrigem}`;
      const info = pontosPorChave.get(chave);
      if (!info || info.amostras < 3) return null;
      return { rpm: info.rpm, amostras: info.amostras };
    },

    /**
     * Retorna detalhes pra debug/auditoria.
     */
    getDetalhes() {
      return {
        marchasDetectadas: Array.from(marchasDetectadas).sort(),
        pontosAprendidos:  Array.from(pontosPorChave.entries()).map(([k, v]) => ({ chave: k, ...v })),
        voltasLimpas,
        pct: _pct(),
      };
    },

    /**
     * Exporta o aprendizado (marchas vistas + pontos por trecho×marcha + voltas
     * limpas) para persistir entre sessões. Sem isto, o % volta a zero ao fechar.
     */
    exportarEstado() {
      return {
        versao: 1,
        marchasDetectadas: Array.from(marchasDetectadas),
        voltasLimpas,
        pontos: Array.from(pontosPorChave.entries()).map(([chave, v]) => ({ chave, rpm: v.rpm, amostras: v.amostras })),
      };
    },

    /** Importa aprendizado persistido (idempotente; substitui o estado atual). */
    importarEstado(estado) {
      marchasDetectadas.clear();
      pontosPorChave.clear();
      voltasLimpas = 0;
      if (!estado) return;
      for (const m of (estado.marchasDetectadas || [])) {
        if (typeof m === 'number' && m >= 1 && m <= 5) marchasDetectadas.add(m);
      }
      if (Number.isFinite(estado.voltasLimpas)) voltasLimpas = estado.voltasLimpas;
      for (const p of (estado.pontos || [])) {
        if (p && typeof p.chave === 'string' && Number.isFinite(p.rpm)) {
          pontosPorChave.set(p.chave, { rpm: p.rpm, amostras: Number.isFinite(p.amostras) ? p.amostras : 0 });
        }
      }
    },

    /**
     * Reseta tudo (ex: ao trocar configuração mecânica do carro).
     */
    reset() {
      marchasDetectadas.clear();
      pontosPorChave.clear();
      voltasLimpas = 0;
    },
  };
}
