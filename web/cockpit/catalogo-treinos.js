// catalogo-treinos.js — catálogo canônico dos TREINOS DE TÉCNICA COM IA.
//
// Decisão Flávio 11/06/2026 ("autorizado. pode seguir suas recomendações."):
// direção "Stint Revestido" — o treino não cria tela nova; ele REVESTE a
// coreografia fechada de 09/06 com o foco escolhido no Planejamento do Stint.
// Registro da decisão: ~/.claude-decisoes/respostas/p1-fast/20260611-122527-*.json
// Proposta completa: relatorios/proposta-treinos-ia-2026-06-11.html
// Manual-base (20 técnicas auditadas): docs/research/tecnicas-pilotagem-fwd-touring-2026-06-10/
//
// Uma fonte só pra três consumidores:
//   - Planejamento do Stint (chips + brief) — configuracao-stint.js
//   - Motor do treino (filtros + consistência) — treino-stint.js
//   - Painel (selo + orientação focada) — main-t3000.js
//
// Honestidade de medição (etiqueta):
//   'pleno' — a métrica do treino é medida de verdade hoje (GPS + motor atual)
//   'proxy' — medida por aproximação DECLARADA no brief (sem o sensor pleno)
// Treino sem medição não vira chip — por isso só os 7 abaixo são selecionáveis
// na v1. Pé esquerdo / soltura do freio / pitch-and-catch esperam os sensores
// de pedal (decididos 26/05, não instalados); lift-off e zebras esperam o
// RaceBox integrado. Corpo a corpo (caps. 18/19/20), correção de derrapagem
// (14) e largada (15) NÃO são treino de stint — fundamento registrado na
// proposta; não reabrir como "função faltando".

// Mensagens permitidas referenciam as chaves do catálogo aprovado em
// mensagens-pedagogicas.js (PEDAGOGICA). Resultado/Sistema/Sugestão passam
// SEMPRE (RECORDE, MANTEVE LINHA, MELHOR STINT, BUSCAR LIMITE, REGISTRANDO).

export const TREINOS = Object.freeze([
  {
    id: 'trail-braking',
    rotulo: 'Trail braking',
    grupo: 'tecnica',
    etiqueta: 'proxy',
    selo: 'TREINO · TRAIL BRAKING',
    capitulos: [4, 5],
    subsFoco: ['freio'],
    usaVmin: true,
    mensagens: ['FREOU_CEDO', 'FREOU_TARDE'],
    brief: {
      oQueE: 'Soltar o freio aos poucos curva adentro, arrastando um resto de pressão até perto do ápice: peso na frente pra virar, traseira leve pra rotacionar. No nosso carro de tração dianteira é quase obrigatório — é a arma número 1 contra sair de frente.',
      oQueMede: [
        'Ponto de freada em metros desde a linha de entrada (por GPS, em cada trecho)',
        'Velocidade mínima do trecho e ONDE ela acontece (trail bom empurra a velocidade mínima pra perto do ápice)',
      ],
      comoAparece: 'Antes do trecho: FREIA DEPOIS / FREIA ANTES / FREIA MENOS, com a marca vermelha (onde você agiu) e a verde (onde a melhor passagem age). Depois do trecho: FREOU CEDO / FREOU TARDE.',
      ressalva: 'Medição por aproximação: ainda não há sensor de pedal no carro, então a IA enxerga o EFEITO do seu trail (ponto de freada + velocidade mínima), não a pressão do seu pé. O treino pleno chega com o sensor de pressão de freio.',
    },
  },
  {
    id: 'entrada',
    rotulo: 'Entrada',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · ENTRADA',
    capitulos: [1, 2],
    subsFoco: ['entrada'],
    usaVmin: false,
    mensagens: ['PISOU_POUCO'],
    brief: {
      oQueE: 'Chegar na linha de entrada do trecho com a velocidade da melhor passagem — sem desistir antes da hora. A entrada é onde se carrega a velocidade que a reta inteira construiu.',
      oQueMede: [
        'Velocidade ao cruzar a linha de entrada, comparada à melhor passagem histórica do carro',
        'Tempo perdido no pedaço entrada → ponto de freada',
      ],
      comoAparece: 'Depois do trecho: PISOU POUCO quando a entrada custou tempo. Antes do trecho: orientação de frenagem (FREIA DEPOIS) quando o hábito é desistir cedo.',
      ressalva: null,
    },
  },
  {
    id: 'frenagem',
    rotulo: 'Ponto de frenagem',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · FRENAGEM',
    capitulos: [3],
    subsFoco: ['freio'],
    usaVmin: false,
    mensagens: ['FREOU_CEDO', 'FREOU_TARDE'],
    brief: {
      oQueE: 'Frear forte, em linha reta, no ponto mais tardio que ainda deixa a curva acontecer. É o exercício de atraso progressivo do manual: aproximar seu ponto de freada do ponto da melhor passagem, em degraus.',
      oQueMede: [
        'Ponto de freada em metros desde a linha de entrada (medido de verdade, por GPS, a cada passagem)',
        'Tempo perdido no pedaço ponto de freada → ápice',
      ],
      comoAparece: 'Antes do trecho: FREIA DEPOIS +X m (degrau digerível: ~30% do caminho até a melhor, no máximo +4 m por vez). Depois do trecho: FREOU CEDO / FREOU TARDE.',
      ressalva: null,
    },
  },
  {
    id: 'vmin',
    rotulo: 'Velocidade mínima',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · VEL. MÍNIMA',
    capitulos: [1, 2],
    subsFoco: ['freio', 'apice'],
    usaVmin: true,
    mensagens: ['FREOU_CEDO', 'FREOU_TARDE'],
    brief: {
      oQueE: 'Carregar mais velocidade pelo miolo da curva: a velocidade mínima (Vmin) é o quanto de velocidade sobrou depois de todo o trabalho de freio e volante. Vmin baixa demais = tirou velocidade que a curva aceitava.',
      oQueMede: [
        'Velocidade mínima da passagem em cada trecho (derivada do GPS), comparada à da melhor passagem',
        'Tempo perdido nos pedaços freio → ápice',
      ],
      comoAparece: 'Antes do trecho: FREIA MENOS quando sua velocidade mínima está abaixo da melhor passagem (mesmo ponto de freada, menos pressão). Depois do trecho: FREOU CEDO / FREOU TARDE.',
      ressalva: null,
    },
  },
  {
    id: 'apice',
    rotulo: 'Ápice',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · ÁPICE',
    capitulos: [8, 9],
    subsFoco: ['apice'],
    usaVmin: false,
    mensagens: ['VIROU_POUCO', 'VIROU_MUITO', 'VIROU_TARDE', 'VIROU_CEDO'],
    brief: {
      oQueE: 'Passar no ponto mais interno que a curva permite, com o carro já apontado pra saída. Quem chega no ápice ainda virando não consegue acelerar; quem chega apontado acelera antes de todo mundo.',
      oQueMede: [
        'Distância real entre a sua passagem e o ápice de referência (metros, a cada passagem)',
        'Tempo perdido no miolo da curva',
      ],
      comoAparece: 'Antes do trecho: FECHA A CURVA com a distância real do ápice e a bolinha verde no alvo. Depois do trecho: VIROU POUCO / MUITO / CEDO / TARDE.',
      ressalva: null,
    },
  },
  {
    id: 'pace',
    rotulo: 'Início de aceleração',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · ACELERAÇÃO',
    capitulos: [12, 13],
    subsFoco: ['saida'],
    usaVmin: false,
    mensagens: ['ACELEROU_TARDE'],
    brief: {
      oQueE: 'Antecipar o ponto onde você abre o acelerador de vez (o PAce) — primeiro desvira, depois pisa, e pisa UMA vez só. Acelerar cedo com o volante torto suja o pneu da frente; acelerar tarde joga a reta fora.',
      oQueMede: [
        'Tempo perdido do ápice até a linha de saída (a fase de aceleração), comparado à melhor passagem',
        'Velocidade ao cruzar a linha de saída',
      ],
      comoAparece: 'Antes do trecho: ACELERA ANTES (sem número — o registro fino do seu ponto de aceleração pelo acelerador do motor entra na frente seguinte). Depois do trecho: ACELEROU TARDE.',
      ressalva: null,
    },
  },
  {
    id: 'saida',
    rotulo: 'Saída',
    grupo: 'ponto',
    etiqueta: 'pleno',
    selo: 'TREINO · SAÍDA',
    capitulos: [13],
    subsFoco: ['saida'],
    usaVmin: false,
    mensagens: ['ACELEROU_TARDE', 'PISOU_POUCO'],
    brief: {
      oQueE: 'Cruzar a linha de saída com a maior velocidade que o trecho entrega — porque essa velocidade viaja a reta inteira junto com você. A saída se ganha com disciplina de acelerador, não com coragem.',
      oQueMede: [
        'Velocidade ao cruzar a linha de saída, comparada à melhor passagem histórica',
        'Tempo perdido na fase de aceleração (ápice → saída)',
      ],
      comoAparece: 'Antes do trecho: ACELERA ANTES. Depois do trecho: ACELEROU TARDE / PISOU POUCO.',
      ressalva: null,
    },
  },
]);

/** Mensagens que passam SEMPRE pelo filtro do treino (resultado/sistema). */
export const MENSAGENS_SEMPRE = Object.freeze([
  'RECORDE', 'MANTEVE_LINHA', 'MELHOR_STINT', 'BUSCAR_LIMITE', 'REGISTRANDO',
]);

export function listarTreinos() {
  return TREINOS.slice();
}

export function treinoPorFoco(foco) {
  return TREINOS.find(t => t.id === foco) ?? null;
}
