// ============================================================================
// CÉREBRO — Coach (Onda 3). Gera o conteúdo do bloco P1 COACH a partir do DADO
// REAL, reusando o motor pedagógico de verdade `src/domain/trecho-advisor.js`
// (gerarConselho: compara a passagem mais recente com a melhor do stint).
//
// Honesto: produz COMANDO (o que corrigir, onde) + LIÇÃO + ANÁLISE a partir das
// passagens reais. NÃO inventa NOTA da volta nem % da lição — esses não têm
// fonte real hoje (dependem de uma regra de pontuação que o Flávio precisa
// definir), então saem null e o painel marca o sub-bloco como "aguardando".
// ============================================================================

import { gerarConselho } from '../../../src/domain/trecho-advisor.js';

// indicador (no advisor) -> comando curto + tema da lição (linguagem de pilotagem)
const MAPA = {
  vminKmh:      { comando: 'carregue mais no apex', licao: 'velocidade no apex',  desc: 'pouca velocidade no meio da curva' },
  vEntradaKmh:  { comando: 'entre mais forte',      licao: 'entrada de curva',    desc: 'entrou comportado demais' },
  vFreadaKmh:   { comando: 'freie mais tarde',      licao: 'ponto de freada',     desc: 'freou cedo demais' },
  vChegadaKmh:  { comando: 'puxe a reta',           licao: 'fim de reta',         desc: 'reta anterior não foi até o fim' },
  vPaceKmh:     { comando: 'abra o gás antes',      licao: 'tração na saída',     desc: 'pouca aceleração na saída' },
  vSaidaPicoKmh:{ comando: 'estique a saída',       licao: 'tração na saída',     desc: 'não puxou tudo na reta seguinte' },
};
const ORDEM_INDICADORES = ['vminKmh','vEntradaKmh','vFreadaKmh','vChegadaKmh','vPaceKmh','vSaidaPicoKmh'];
const TOL = 0.15; // km/h — ruído de GPS, mesmo critério do advisor

/** De uma passagem (sequência de pontos com kmh) extrai os indicadores de velocidade. */
export function indicadoresDaPassagem(pontos, voltaId) {
  const kmhs = (pontos || []).map(p => p && typeof p.kmh === 'number' ? p.kmh : null).filter(v => v != null);
  if (kmhs.length < 3) return null;
  let idxMin = 0; for (let i = 1; i < kmhs.length; i++) if (kmhs[i] < kmhs[idxMin]) idxMin = i;
  const vmin = kmhs[idxMin];
  const entrada = kmhs[0];
  const chegada = Math.max(...kmhs.slice(0, idxMin + 1));      // pico antes do apex
  const saidaPico = Math.max(...kmhs.slice(idxMin));            // pico depois do apex
  return {
    voltaId: String(voltaId),
    vEntradaKmh: entrada,
    vminKmh: vmin,
    vChegadaKmh: chegada,
    vSaidaPicoKmh: saidaPico,
    vFreadaKmh: null,   // precisa do ponto de freada (sensor) — fica null
    vPaceKmh: null,     // precisa de aceleração na saída — fica null
  };
}

/** Agrupa as passagens por curva, em ordem cronológica de volta. */
export function execucoesPorCurva(passagens) {
  const grupos = {};
  for (const p of (passagens || [])) {
    if (!grupos[p.curva]) grupos[p.curva] = [];
    grupos[p.curva].push(p);
  }
  const out = {};
  for (const curva of Object.keys(grupos)) {
    const ordenadas = grupos[curva].slice().sort((a, b) =>
      (a.dia === b.dia) ? (a.volta - b.volta) : String(a.dia).localeCompare(String(b.dia)));
    out[curva] = ordenadas.map(p => indicadoresDaPassagem(p.pontos, p.volta)).filter(Boolean);
  }
  return out;
}

/** Maior perda (melhor - última) da curva e qual indicador. */
function piorDaCurva(execs) {
  if (!execs || execs.length < 2) return null;
  const ultima = execs[execs.length - 1];
  let pior = null;
  for (const chave of ORDEM_INDICADORES) {
    const vals = execs.map(e => e[chave]).filter(v => typeof v === 'number');
    if (!vals.length) continue;
    const melhor = Math.max(...vals);
    const v = ultima[chave];
    if (typeof v !== 'number') continue;
    const delta = melhor - v;
    if (delta <= TOL) continue;
    if (!pior || delta > pior.delta) pior = { delta, chave };
  }
  return pior;
}

/**
 * Avalia o coach a partir das passagens reais.
 * @param {Array} passagens   array de passagens (cada uma: { curva, dia, volta, pontos:[{kmh}] })
 * @param {string[]} ordemCurvas  ordem oficial das curvas (pra numerar "curva N")
 * @returns {object|null} conteúdo do bloco P1 COACH (ou null se sem base)
 */
export function avaliarCoach(passagens, ordemCurvas = []) {
  const exsPorCurva = execucoesPorCurva(passagens);
  let alvo = null; // curva com a maior perda
  for (const curva of Object.keys(exsPorCurva)) {
    const pior = piorDaCurva(exsPorCurva[curva]);
    if (pior && (!alvo || pior.delta > alvo.pior.delta)) alvo = { curva, pior, execs: exsPorCurva[curva] };
  }
  if (!alvo) return null;

  const idx = ordemCurvas.indexOf(alvo.curva);
  const curvaNum = idx >= 0 ? idx + 1 : null;
  const m = MAPA[alvo.pior.chave] || { comando: 'ajuste a curva', licao: 'trecho', desc: '' };
  const analise = gerarConselho(alvo.curva, alvo.execs); // frase do motor REAL

  return {
    frase: curvaNum ? `${m.comando} na ${curvaNum}` : m.comando,
    comando: 'comando ativo',
    curva: curvaNum,
    curvaNome: alvo.curva,
    licaoTitulo: m.licao,
    licaoDesc: m.desc,
    analise: analise || '',
    perdaKmh: Number(alvo.pior.delta.toFixed(1)),
    // sem fonte real hoje — Flávio precisa definir a regra. Não inventar:
    pontuacao: null,
    progressoPct: null,
    _pendentes: ['pontuacao', 'progresso'],
  };
}

export default { avaliarCoach, execucoesPorCurva, indicadoresDaPassagem };
