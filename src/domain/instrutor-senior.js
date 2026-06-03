// ═══════════════════════════════════════════════════════════
// Instrutor sênior — análise execução vs estratégia + conselho
// ═══════════════════════════════════════════════════════════
// Junta:
//   - Geometria da curva (curva-geometria.js)
//   - Estratégia ideal de ápice (apice-estrategia.js)
//   - Execução do piloto (ponto de Vmin = ápice executado, tempos da
//     passagem, velocidades nos 6 indicadores canônicos)
//
// Devolve um conselho em linguagem de instrutor experiente, com base
// na DIFERENÇA entre o que o piloto FEZ e o que A CURVA PEDE.

/**
 * Distância em metros entre o ápice executado e o "meio geométrico"
 * da curva (ponto a meio caminho entre entrada e saída no path).
 *
 * Sinal:
 *   negativo → ápice ANTES do meio geométrico = antecipado
 *   positivo → ápice DEPOIS do meio geométrico = tardio
 *   próximo de zero → geométrico
 */
function offsetExecutadoVsMeio(apiceExecutado, entrada, saida) {
  // Vetor entrada→saída (direção do trecho)
  const vx = saida.x - entrada.x;
  const vy = saida.y - entrada.y;
  const comp = Math.hypot(vx, vy);
  if (comp < 1e-3) return 0;
  // Vetor entrada→apiceExecutado
  const ax = apiceExecutado.x - entrada.x;
  const ay = apiceExecutado.y - entrada.y;
  // Projeção no eixo entrada→saída
  const proj = (ax * vx + ay * vy) / comp;
  // Distância do meio (= comp/2)
  return proj - comp / 2;
}

/**
 * Classifica o ápice executado em antecipado / geométrico / tardio
 * usando o desvio em metros e o comprimento total do trecho.
 */
function classificarApiceExecutado(offsetVsMeioM, comprimentoCurvaM) {
  // Zona "geométrica" = +/- 10% do comprimento da curva
  const zonaNeutra = Math.max(3, comprimentoCurvaM * 0.10);
  if (Math.abs(offsetVsMeioM) <= zonaNeutra) return 'geometrico';
  return offsetVsMeioM < 0 ? 'antecipado' : 'tardio';
}

/**
 * @typedef {Object} AnaliseInstrutor
 * @property {string} nomeCurva
 * @property {Object} estrategiaIdeal       saída de estrategiaIdeal()
 * @property {string} apiceExecutadoTipo    'antecipado' | 'geometrico' | 'tardio'
 * @property {number} desvioMetros          + = depois do meio, - = antes
 * @property {boolean} bateuEstrategia      execução === estratégia?
 * @property {string} conselho              frase de instrutor sênior
 * @property {string} severidade            'verde' | 'amarelo' | 'vermelho'
 */

/**
 * Avalia UMA passagem do piloto pelo trecho.
 *
 * @param {Object} args
 * @param {Object} args.trecho        objeto do trecho (id, nome, entradas, saidas)
 * @param {Object} args.geometria     saída de calcularGeometria()
 * @param {Object} args.estrategia    saída de estrategiaIdeal()
 * @param {Object} args.apiceExecutado  {x, y} — ponto onde Vmin aconteceu
 * @param {Object} args.indicadores   {vChegada, vFreada, vEntrada, vmin, vPace, vSaidaPico} em km/h
 * @param {Object} [args.melhorPassagem]  ref ao melhor histórico (mesmos campos)
 * @returns {AnaliseInstrutor}
 */
export function analisarPassagem({ trecho, geometria, estrategia, apiceExecutado, indicadores, melhorPassagem = null }) {
  const entrada = trecho.entradas?.[0] || trecho.entrada;
  const saida = trecho.saidas?.[0] || trecho.saida;
  const nomeCurva = trecho.nome || 'Curva';

  // Comparação em UNIDADES do viewBox → converter pra metros pelo raio/comprimento da curva
  const desvioUnit = offsetExecutadoVsMeio(apiceExecutado, entrada, saida);
  // Aproximação: o comprimento em unidades vai ser ~ entrada→saída linha reta;
  // pra converter pra metros usamos a razão comprimentoCurvaM / dist(entrada, saida) em unit
  const compLinear = Math.hypot(saida.x - entrada.x, saida.y - entrada.y);
  const metrosPorUnit = compLinear > 0 ? geometria.comprimentoCurvaM / compLinear : 1;
  const desvioMetros = desvioUnit * metrosPorUnit;

  const apiceExecutadoTipo = classificarApiceExecutado(desvioMetros, geometria.comprimentoCurvaM);
  const bateuEstrategia = apiceExecutadoTipo === estrategia.tipo;

  const conselho = montarConselho({
    nomeCurva, estrategia, apiceExecutadoTipo, desvioMetros,
    indicadores, melhorPassagem,
  });
  const severidade = bateuEstrategia ? 'verde' : (Math.abs(desvioMetros) > 8 ? 'vermelho' : 'amarelo');

  return {
    nomeCurva,
    estrategiaIdeal: estrategia,
    apiceExecutadoTipo,
    desvioMetros: +desvioMetros.toFixed(1),
    bateuEstrategia,
    conselho,
    severidade,
  };
}

function montarConselho({ nomeCurva, estrategia, apiceExecutadoTipo, desvioMetros, indicadores, melhorPassagem }) {
  const nomeFmt = nomeCurva.replace(/^CURVA\s+/i, 'Curva ');
  const metaTxt = {
    tardio: 'ápice tardio',
    geometrico: 'ápice geométrico',
    antecipado: 'ápice antecipado',
  }[estrategia.tipo];
  const exeTxt = {
    tardio: 'tardio',
    geometrico: 'geométrico',
    antecipado: 'antecipado',
  }[apiceExecutadoTipo];

  // Caso 1 — bateu a estratégia
  if (apiceExecutadoTipo === estrategia.tipo) {
    if (melhorPassagem && indicadores.vPaceKmh != null && melhorPassagem.vPaceKmh != null) {
      const delta = indicadores.vPaceKmh - melhorPassagem.vPaceKmh;
      if (delta >= 0) {
        return `${nomeFmt} — execução no padrão (${exeTxt}). Pace na saída ${indicadores.vPaceKmh.toFixed(0)} km/h, igual ou melhor que a sua melhor passagem. Mantenha.`;
      } else {
        return `${nomeFmt} — ápice no lugar certo (${exeTxt}), mas a saída saiu ${Math.abs(delta).toFixed(0)} km/h mais lenta que sua melhor. Confira se você está aplicando o acelerador no mesmo ponto.`;
      }
    }
    return `${nomeFmt} — ${exeTxt}, como pede a curva. Boa execução.`;
  }

  // Caso 2 — não bateu. Detalhar.
  let acao = '';
  if (estrategia.tipo === 'tardio' && apiceExecutadoTipo === 'antecipado') {
    acao = `Você entrou cedo demais. Freie ${Math.abs(desvioMetros).toFixed(0)} m mais tarde, deixe o carro rodar mais reto na entrada e só vire o volante quando você ver o vértice mais interno. A saída vai abrir e você ganha aceleração na próxima reta.`;
  } else if (estrategia.tipo === 'tardio' && apiceExecutadoTipo === 'geometrico') {
    acao = `Você está fazendo a curva no meio. Mas essa curva pede ápice tardio — atrase a virada do volante em meio segundo e veja se a saída fica mais reta.`;
  } else if (estrategia.tipo === 'geometrico' && apiceExecutadoTipo === 'tardio') {
    acao = `Você está fazendo tardio demais. Essa curva pede ápice no meio — antecipe a virada e mantenha o volante mais leve no meio da curva pra preservar velocidade.`;
  } else if (estrategia.tipo === 'geometrico' && apiceExecutadoTipo === 'antecipado') {
    acao = `Você está virando cedo demais. Essa curva pede ápice no meio — segure mais a entrada antes de virar.`;
  } else if (estrategia.tipo === 'antecipado' && apiceExecutadoTipo === 'tardio') {
    acao = `Você está fazendo a curva tarde. Esse trecho leva pra outra curva colada, então pede ápice antecipado — passe pelo interno cedo pra deixar o carro pronto pra entrar na próxima.`;
  } else if (estrategia.tipo === 'antecipado' && apiceExecutadoTipo === 'geometrico') {
    acao = `Curva no meio, mas leva pra outra curva colada. Antecipe o ápice — passe pelo interno mais cedo pra preparar a próxima.`;
  } else {
    acao = `Execução fora do padrão dessa curva. Revise sua linha visual de entrada.`;
  }

  return `${nomeFmt} — você fez ápice ${exeTxt} (${Math.abs(desvioMetros).toFixed(0)} m do meio). A curva pede ${metaTxt}. ${estrategia.explicacao} ${acao}`;
}
