// delta-calculator.js — CASA NEUTRA da conta de DELTA por trecho (tempo perdido).
//
// Lugar NEUTRO (domínio puro) desde 24/06: o cockpit do piloto (programa do
// notebook) e o cérebro da nuvem (Command Box) consomem a MESMA conta — sem
// cópia. web/cockpit/delta-calculator.js reexporta daqui. Condição da junta de
// checadores (24/06) + ADR-023 amendment 6 (processamento em DOIS lugares: o
// delta não pode morar na pasta de um e ser puxado pelo outro). ADR-005: a
// unidade da análise é o TRECHO, não a volta. ADR-015: o tempo (delta) vem do
// relógio à prova de salto — quem produz os pontos (t) é responsável por isso.
//
// Compara a passagem atual em um trecho com a melhor passagem histórica daquele
// carro + autódromo + configuração de pneu, e calcula a perda de tempo (em
// segundos) por sub-trecho.
//
// Spec / decisões de produto:
//   - reference_p1fast_mensagens_painel_piloto_v1 — critério de "maior" é
//     tempo perdido em segundos. Algoritmo: integrar ponto a ponto a
//     diferença de tempo entre a passagem atual e a referência.
//   - project_p1fast_logica_central_comparacao_por_trecho — referência é
//     persistente entre sessões.
//
// Mecanismo:
//   1. Para cada amostra GPS da volta atual no trecho, encontra o ponto
//      equivalente na trajetória de referência (mesma fração ao longo do
//      segmento) e calcula dt = ds/v_atual - ds/v_ref.
//   2. Acumula esses dt em quatro sub-trechos atribuídos a cada widget:
//        Entrada  → linha de entrada até ponto de freada
//        Freio    → ponto de freada até ponto ideal de ápice
//        Ápice    → ponto de ápice até início da reta de saída
//        Saída    → reta de saída até a próxima linha de entrada
//   3. Retorna a perda cumulativa de cada sub-trecho. O widget com maior
//      perda é o que recebe a mensagem do trecho.
//
// Entrada esperada — referência (melhor histórica salva no banco):
//   {
//     segmentId,
//     pontos: [ { lat, lng, kmh, t, fracao, sub } ... ]
//     // fracao 0..1 ao longo do trecho (entrada=0, saída=1)
//     // sub ∈ 'entrada' | 'freio' | 'apice' | 'saida'
//   }
//
// Entrada — passagem atual (acumulada pelo TrechoDetector + buffer GPS):
//   {
//     segmentId,
//     pontos: [ { lat, lng, kmh, t, fracao, sub } ... ]
//   }
//
// Saída:
//   {
//     segmentId,
//     deltaTotalS,                 // perda total no trecho (s)
//     porSubTrecho: {
//       entrada: { deltaS, ... },
//       freio:   { deltaS, ... },
//       apice:   { deltaS, ... },
//       pace:    { deltaS, ... },   // aceleração pós-Vmin (5º marco, Flávio 13/06)
//       saida:   { deltaS, ... },
//     },
//     piorSubTrecho: 'freio',      // nome do que mais custou tempo
//     piorDeltaS: 0.18,
//   }

// PACE = ponto/zona de aceleração depois do Vmin (5º marco, decisão Flávio 13/06/2026).
// Entra na PARTIÇÃO de dados da passagem (entrada→freio→apice→pace→saida). NÃO vira um 4º+1
// widget: a tela mantém os 4 widgets canônicos + Pace CENTRAL (decisão 26/05). Sem sensor de
// acelerador casado por tempo, PACE é PROXY por velocidade (ver acharPaceIdx).
export const SUB_TRECHOS = Object.freeze(['entrada', 'freio', 'apice', 'pace', 'saida']);

// Distância em metros entre dois pontos GPS — casa única em geo.js.
import { distanciaPontos as distMeters } from './geo.js';
import { kmhParaMs } from './velocidade.js';

/**
 * Procura na referência o ponto com a fracao mais próxima da fracaoAlvo.
 * Retorna o ponto e seu índice (pra otimizar buscas sequenciais).
 */
function pontoRefNaFracao(referenciaPontos, fracaoAlvo, idxStart = 0) {
  let melhor = referenciaPontos[idxStart];
  let melhorIdx = idxStart;
  let melhorDiff = Math.abs(melhor.fracao - fracaoAlvo);
  for (let i = idxStart; i < referenciaPontos.length; i++) {
    const p = referenciaPontos[i];
    const diff = Math.abs(p.fracao - fracaoAlvo);
    if (diff < melhorDiff) {
      melhor = p;
      melhorIdx = i;
      melhorDiff = diff;
    }
    // a fracao é monotônica crescente — para se já passou do alvo
    if (p.fracao > fracaoAlvo + 0.02) break;
  }
  return { ponto: melhor, idx: melhorIdx };
}

/**
 * Calcula delta de tempo de uma única passagem.
 * Veja contrato no topo do arquivo.
 */
export function calcularDelta({ atual, referencia }) {
  if (!atual || !referencia || !Array.isArray(atual.pontos) || !Array.isArray(referencia.pontos)) {
    throw new Error('calcularDelta: atual e referencia precisam ter pontos[]');
  }
  if (atual.pontos.length < 2 || referencia.pontos.length < 2) {
    throw new Error('calcularDelta: passagem com menos de 2 pontos — descartada');
  }

  const porSub = {
    entrada: { deltaS: 0, distM: 0, amostras: 0 },
    freio:   { deltaS: 0, distM: 0, amostras: 0 },
    apice:   { deltaS: 0, distM: 0, amostras: 0 },
    pace:    { deltaS: 0, distM: 0, amostras: 0 },
    saida:   { deltaS: 0, distM: 0, amostras: 0 },
  };

  let refIdx = 0;

  // percorre cada par de amostras consecutivas da passagem atual
  for (let i = 1; i < atual.pontos.length; i++) {
    const a0 = atual.pontos[i - 1];
    const a1 = atual.pontos[i];

    // distância percorrida e velocidade média no par
    const ds = distMeters(a0, a1);
    if (ds < 0.05) continue; // amostras quase coincidentes — descarta
    const vAtual = kmhParaMs((a0.kmh + a1.kmh) / 2); // m/s
    // kmh ausente vira NaN, e "NaN < 0.5" é falso — sem a guarda, UM ponto sem
    // velocidade envenenava o delta do trecho inteiro (risco (e) da auditoria 10/06).
    if (!Number.isFinite(vAtual) || vAtual < 0.5) continue; // inválido/parado

    // tempo gasto pelo carro atual nesse incremento
    const dtAtual = ds / vAtual;

    // ponto de referência correspondente: mesma fração de progresso no trecho
    const fracao = a1.fracao;
    const { ponto: pRef, idx: idxRef } = pontoRefNaFracao(referencia.pontos, fracao, refIdx);
    refIdx = idxRef;
    // tempo esperado pela referência pra percorrer o mesmo ds com vRef
    const vRef = kmhParaMs(pRef.kmh);
    if (!Number.isFinite(vRef) || vRef < 0.5) continue;
    const dtRef = ds / vRef;

    // dt positivo = atual mais lento que ref (perdeu tempo); negativo = ganhou
    const dt = dtAtual - dtRef;

    // atribui ao sub-trecho da amostra atual
    const sub = a1.sub;
    if (sub && porSub[sub]) {
      porSub[sub].deltaS  += dt;
      porSub[sub].distM   += ds;
      porSub[sub].amostras++;
    }
  }

  // total e pior sub-trecho
  const deltaTotalS = SUB_TRECHOS.reduce((s, k) => s + porSub[k].deltaS, 0);
  let pior = 'entrada';
  let piorVal = -Infinity;
  for (const sub of SUB_TRECHOS) {
    // pior = mais positivo (mais perdeu)
    if (porSub[sub].deltaS > piorVal) {
      piorVal = porSub[sub].deltaS;
      pior = sub;
    }
  }

  // tempo de relógio da passagem atual (paridade com C# DeltaResultado.TempoAtualS,
  // DeltaCoach.cs:31 — lá é injetado pelo orquestrador como (_buf[^1].T-_buf[0].T)/1000).
  // Campo ADITIVO: consumidores antigos que só desestruturam os 5 campos acima seguem
  // intactos; o acumulador de stint (coach) e mensagens-pedagogicas.js:206 leem este
  // tempoAtualS como a AUTORIDADE do ganho em segundos (relógio, não integração — J2 §3.1).
  const pontosPassagem = atual.pontos;
  const t0 = pontosPassagem[0]?.t;
  const tN = pontosPassagem[pontosPassagem.length - 1]?.t;
  const tempoAtualS = (Number.isFinite(t0) && Number.isFinite(tN) && tN > t0)
    ? (tN - t0) / 1000
    : null; // sem timestamps confiáveis → null (mesma default do record C#)

  return {
    segmentId: atual.segmentId,
    deltaTotalS,
    porSubTrecho: porSub,
    piorSubTrecho: pior,
    piorDeltaS: piorVal,
    tempoAtualS,
  };
}

/**
 * Helper pra construir o ponto canônico de cada amostra durante a passagem,
 * já com `fracao` e `sub`. Usado pelo coletor enquanto o detector vai
 * disparando os eventos de cada sub-trecho.
 *
 * Argumentos:
 *   - rawSample: { lat, lng, kmh, t }  → amostra GPS bruta
 *   - sub: 'entrada' | 'freio' | 'apice' | 'saida'  → sub-trecho atual
 *   - dsAcumuladoM, dsTotalEstimadoM   → fração calculada por distância
 *     cumulativa desde a linha de entrada / distância total do segmento
 */
export function pontoCanonico(rawSample, sub, dsAcumuladoM, dsTotalEstimadoM) {
  const fracao = Math.min(1, Math.max(0, dsAcumuladoM / Math.max(1, dsTotalEstimadoM)));
  return {
    lat: rawSample.lat,
    lng: rawSample.lng,
    kmh: rawSample.kmh,
    t:   rawSample.t,
    fracao,
    sub,
  };
}
