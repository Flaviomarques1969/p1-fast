// ═══════════════════════════════════════════════════════════
// Geometria da curva — análise da forma física do trecho
// ═══════════════════════════════════════════════════════════
// Dado um trecho da pista (entrada, saída, contexto da pista),
// calcula:
//   - Raio aproximado da curva (apertada / aberta)
//   - Direção da curva (esquerda / direita)
//   - Comprimento da reta antes da entrada
//   - Comprimento da reta depois da saída
//   - Se faz parte de uma combinação (curva seguinte muito próxima)
//
// Saída usada pelo módulo de ESTRATÉGIA pra decidir o tipo de ápice
// ideal (antecipado / geométrico / tardio).

import { buildLookup, snap } from '../telemetry/path-mapper.js';

/**
 * @typedef {Object} GeometriaCurva
 * @property {number} raioM            raio aproximado em METROS
 * @property {'esquerda'|'direita'} sentido
 * @property {number} comprimentoCurvaM  comprimento da curva em metros
 * @property {number} retaAntesM       metros de "reta" antes da entrada
 * @property {number} retaDepoisM      metros de "reta" depois da saída
 * @property {boolean} temCurvaPropxAntes  curva próxima atrás (menos de 50m)
 * @property {boolean} temCurvaPropxDepois curva próxima à frente (menos de 50m)
 * @property {'apertada'|'media'|'rapida'}  classificacao
 */

/**
 * Calcula a geometria de UMA curva a partir do desenho da pista,
 * lista de trechos pedagógicos e do trecho específico.
 *
 * @param {Object} args
 * @param {string} args.svgPath      String d= do path da pista
 * @param {Array}  args.trechos      Todos os trechos pedagógicos da pista
 * @param {Object} args.trecho       Trecho específico que estamos analisando
 * @param {number} args.metrosPorUnidade Conversão de unidades do path → metros reais
 * @returns {GeometriaCurva}
 */
export function calcularGeometria({ svgPath, trechos, trecho, metrosPorUnidade }) {
  const lookup = buildLookup(svgPath, 3000);
  const totalLen = lookup.totalLength;

  const entrada = trecho.entradas?.[0] || trecho.entrada;
  const saida = trecho.saidas?.[0] || trecho.saida;
  if (!entrada || !saida) {
    return null;
  }

  // Offset de cada ponto no path
  delete lookup._lastIdx;
  const offE = snap(lookup, entrada.x, entrada.y).offset;
  delete lookup._lastIdx;
  const offS = snap(lookup, saida.x, saida.y).offset;

  // Comprimento da curva (do path) em metros
  let comprimentoUnit = offS - offE;
  if (comprimentoUnit < 0) comprimentoUnit += totalLen;
  const comprimentoCurvaM = comprimentoUnit * metrosPorUnidade;

  // Raio aproximado: aplica fórmula da circunferência ao acaso de um terço da curva
  // Aproximação simples: pega 3 pontos (entrada, meio, saída) e calcula o raio
  // do círculo que passa por eles
  const meiaOffset = (offE + comprimentoUnit / 2) % totalLen;
  const pMeio = pontoNoOffset(lookup, meiaOffset);
  const raio = raioCircunscrito(entrada, pMeio, saida);
  const raioM = raio === null ? Infinity : raio * metrosPorUnidade;

  // Direção da curva (sentido): usa o sinal do produto vetorial entre
  // (entrada→meio) e (meio→saída). Positivo = esquerda; negativo = direita.
  const v1x = pMeio.x - entrada.x, v1y = pMeio.y - entrada.y;
  const v2x = saida.x - pMeio.x, v2y = saida.y - pMeio.y;
  const cruz = v1x * v2y - v1y * v2x;
  const sentido = cruz > 0 ? 'direita' : 'esquerda';

  // Encontrar trechos VIZINHOS (pedagógicos ou não) pra medir retas antes/depois
  // Olhar +/- 200m no path
  const trechosOrdenados = trechos
    .filter(t => t.entradas?.[0] && t.saidas?.[0])
    .map(t => {
      delete lookup._lastIdx;
      const e = snap(lookup, t.entradas[0].x, t.entradas[0].y).offset;
      delete lookup._lastIdx;
      const s = snap(lookup, t.saidas[0].x, t.saidas[0].y).offset;
      return { id: t.id, offE: e, offS: s };
    })
    .filter(t => t.id !== trecho.id)
    .sort((a, b) => a.offE - b.offE);

  // Trecho mais próximo ANTES (offset menor que offE atual)
  let antesM = 200; // padrão: assume reta longa
  let temCurvaPropxAntes = false;
  for (const t of trechosOrdenados) {
    let dist = offE - t.offS;
    if (dist < 0) dist += totalLen;
    if (dist > 0 && dist * metrosPorUnidade < antesM) {
      antesM = dist * metrosPorUnidade;
      temCurvaPropxAntes = antesM < 50;
    }
  }
  // Trecho mais próximo DEPOIS (offset maior que offS atual)
  let depoisM = 200;
  let temCurvaPropxDepois = false;
  for (const t of trechosOrdenados) {
    let dist = t.offE - offS;
    if (dist < 0) dist += totalLen;
    if (dist > 0 && dist * metrosPorUnidade < depoisM) {
      depoisM = dist * metrosPorUnidade;
      temCurvaPropxDepois = depoisM < 50;
    }
  }

  // Classificação por raio
  let classificacao = 'media';
  if (raioM < 40) classificacao = 'apertada';
  else if (raioM > 100) classificacao = 'rapida';

  return {
    raioM: +raioM.toFixed(1),
    sentido,
    comprimentoCurvaM: +comprimentoCurvaM.toFixed(1),
    retaAntesM: +antesM.toFixed(1),
    retaDepoisM: +depoisM.toFixed(1),
    temCurvaPropxAntes,
    temCurvaPropxDepois,
    classificacao,
  };
}

function pontoNoOffset(lookup, offset) {
  const t = offset / lookup.totalLength;
  const idx = Math.floor(t * (lookup.points.length - 1));
  return lookup.points[Math.min(idx, lookup.points.length - 1)];
}

// Raio do círculo circunscrito a 3 pontos (devolve em unidades do viewBox)
function raioCircunscrito(p1, p2, p3) {
  const a = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const b = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const c = Math.hypot(p1.x - p3.x, p1.y - p3.y);
  const s = (a + b + c) / 2;
  const area2 = s * (s - a) * (s - b) * (s - c);
  if (area2 <= 0) return null;
  const area = Math.sqrt(area2);
  return (a * b * c) / (4 * area);
}
