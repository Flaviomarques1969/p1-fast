// ═══════════════════════════════════════════════════════════
// trecho-advisor — 1 conselho por trecho (Comando GO 2026-05-24)
// ═══════════════════════════════════════════════════════════
// Recebe a lista de execuções de UM trecho (na ordem cronológica das
// voltas) e devolve UM texto curto explicando o ponto fraco principal
// da passagem mais recente comparada com a MELHOR observada no
// próprio stint.
//
// Lógica V1:
//   1. Pega a última passagem (mais recente).
//   2. Computa "melhor da sessão" por indicador (maior valor em todos
//      — quanto maior km/h ou mais tarde a freada, melhor).
//   3. Calcula o delta % da última em relação à melhor.
//   4. Identifica o indicador com maior delta NEGATIVO (perda maior).
//   5. Gera frase: "Curva X: {indicador} {delta} km/h abaixo da sua
//      melhor. {causa provável}".
//   6. Casos especiais:
//      - 1 única passagem → "primeira passagem registrada. Sem
//        comparativo."
//      - Última passagem é a melhor da sessão em TODOS os indicadores
//        → "melhor passagem registrada nesta sessão."
//      - Sem indicadores comparáveis (todos nil) → null.
//
// NÃO usa curva de motor / histórico de outras sessões (Phase 2). A
// versão atual é puramente comparativa intra-stint.

/**
 * @typedef {Object} ExecucaoIndicadores
 * @property {string} voltaId
 * @property {number|null} vChegadaKmh
 * @property {number|null} vEntradaKmh
 * @property {number|null} vFreadaKmh
 * @property {number|null} vminKmh
 * @property {number|null} vPaceKmh
 * @property {number|null} vSaidaPicoKmh
 */

/** Mapa pickers/labels/causas — ordem importa pra escolha da frase. */
const INDICADORES = [
  {
    chave: 'vminKmh',
    label: 'Vmin',
    causa: 'Velocidade no apex baixa demais.',
  },
  {
    chave: 'vPaceKmh',
    label: 'Pace',
    causa: 'Pouca aceleração na saída.',
  },
  {
    chave: 'vSaidaPicoKmh',
    label: 'V saída pico',
    causa: 'Não puxou tudo na reta seguinte.',
  },
  {
    chave: 'vEntradaKmh',
    label: 'Entrada',
    causa: 'Entrou comportado demais — freou antes do necessário.',
  },
  {
    chave: 'vFreadaKmh',
    label: 'Freada',
    causa: 'Freou cedo demais.',
  },
  {
    chave: 'vChegadaKmh',
    label: 'V chegada',
    causa: 'Reta anterior não foi puxada até o fim.',
  },
];

function bestPerIndicator(execucoes) {
  const out = {};
  for (const ind of INDICADORES) {
    const vals = execucoes.map(e => e[ind.chave]).filter(v => typeof v === 'number');
    if (vals.length === 0) { out[ind.chave] = null; continue; }
    out[ind.chave] = Math.max(...vals);
  }
  return out;
}

/**
 * Gera 1 conselho pra um trecho.
 *
 * @param {string} trechoNome  Ex: "Curva da Reta Oposta"
 * @param {ExecucaoIndicadores[]} execucoes
 * @returns {string|null}      Frase pronta ou null se não houver base.
 */
export function gerarConselho(trechoNome, execucoes) {
  if (!Array.isArray(execucoes) || execucoes.length === 0) return null;
  if (execucoes.length === 1) {
    return `${trechoNome}: primeira passagem registrada. Sem comparativo.`;
  }
  const ultima = execucoes[execucoes.length - 1];
  const melhor = bestPerIndicator(execucoes);

  // Acha o pior delta negativo da última em relação ao melhor.
  // "Pior" = maior queda em km/h. Empata pela ordem de prioridade
  // do array INDICADORES (Vmin > Pace > Saída > Entrada > Freada > Chegada).
  let pior = null;
  for (const ind of INDICADORES) {
    const valor = ultima[ind.chave];
    const ref = melhor[ind.chave];
    if (typeof valor !== 'number' || typeof ref !== 'number') continue;
    const delta = ref - valor;  // positivo quando última < melhor
    if (delta <= 0.15) continue; // tolerância de 0.15 km/h (ruído GPS)
    if (pior === null || delta > pior.delta) {
      pior = { delta, ind, valor, ref };
    }
  }
  if (!pior) {
    return `${trechoNome}: melhor passagem registrada nesta sessão.`;
  }
  const deltaTxt = pior.delta.toFixed(1);
  return `${trechoNome}: ${pior.ind.label} ${deltaTxt} km/h abaixo da sua melhor. ${pior.ind.causa}`;
}

export default { gerarConselho };
