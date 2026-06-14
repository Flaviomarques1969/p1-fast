// apice-calculator.js — calcula o ápice de uma passagem por uma curva.
//
// Decisão Flávio 2026-05-27:
//   "o ápice vai ser marcado em função do lugar mais dentro da curva
//    com o melhor tempo na passagem que o carro em uma determinada
//    configuração de motor e pneu fizer."
//
// Interpretação operacional:
//   - "lugar mais dentro da curva" = ponto de máxima curvatura local
//     (onde o raio da trajetória é menor — o piloto está apertando
//     ao máximo).
//   - Depende da CONFIGURAÇÃO (carro + tipo de pneu): pneu radial trace
//     diferente do semi-slick, então o ápice físico muda.
//   - O ponto é tirado do array de amostras GPS de UMA passagem completa,
//     entre a barra de entrada e a barra de saída da curva.
//
// Uso:
//   import { acharApice } from './apice-calculator.js';
//   const { ponto, idx, raioM } = acharApice(pontosDaPassagem);
//
// Algoritmo:
//   1. Para cada ponto interno i, ajustar círculo pelos vizinhos (i-W..i+W).
//   2. Raio do círculo = raio de curvatura local.
//   3. Ápice = i com menor raio (= mais curvado = "mais dentro").
//   4. Filtra ruído: raios absurdamente pequenos (<1m) são descartados.

const DEG2RAD = Math.PI / 180;
const M_PER_DEG_LAT = 111_132.0;

function metrosPorGrauLng(latMedia) {
  return 111_320.0 * Math.cos(latMedia * DEG2RAD);
}

/**
 * Converte um ponto (lat/lng) para coordenadas locais em metros,
 * com origem na média do grupo.
 */
function paraMetrosLocais(pontos) {
  const latMedia = pontos.reduce((s, p) => s + p.lat, 0) / pontos.length;
  const lngMedia = pontos.reduce((s, p) => s + p.lng, 0) / pontos.length;
  const mLng = metrosPorGrauLng(latMedia);
  return pontos.map(p => ({
    x: (p.lng - lngMedia) * mLng,
    y: (p.lat - latMedia) * M_PER_DEG_LAT,
  }));
}

/**
 * Ajusta um círculo a 3 pontos e retorna o raio.
 * Fórmula direta (sem regressão): determinante das coordenadas.
 * Retorna Infinity se os pontos são colineares.
 */
function raioCirculo3Pontos(p1, p2, p3) {
  const ax = p2.x - p1.x, ay = p2.y - p1.y;
  const bx = p3.x - p1.x, by = p3.y - p1.y;
  const d = 2 * (ax * by - ay * bx);
  if (Math.abs(d) < 1e-9) return Infinity;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const cx = (by * a2 - ay * b2) / d;
  const cy = (ax * b2 - bx * a2) / d;
  return Math.sqrt(cx * cx + cy * cy);
}

/**
 * Acha o ponto de máxima curvatura (menor raio) numa passagem.
 *
 * @param {Array<{lat,lng,t?:number,kmh?:number}>} pontos
 *   Pontos GPS da passagem, em ordem temporal.
 * @param {Object} [opts]
 * @param {number} [opts.janela=4] Distância em amostras entre p1, p2, p3.
 * @param {number} [opts.raioMinM=2] Raio menor que isso é considerado ruído.
 * @param {number} [opts.raioMaxM=200] Raio maior que isso = quase reta, ignora.
 * @returns {{ ponto, idx, raioM }|null}
 *   ponto: {lat, lng} mais "dentro" da curva.
 *   idx: posição no array.
 *   raioM: raio de curvatura local em metros.
 *   Retorna null se a passagem é muito curta ou nenhum ponto válido.
 */
export function acharApice(pontos, opts = {}) {
  const janela   = opts.janela   ?? 4;
  const raioMinM = opts.raioMinM ?? 2;
  const raioMaxM = opts.raioMaxM ?? 200;

  if (!Array.isArray(pontos) || pontos.length < 2 * janela + 1) return null;

  const m = paraMetrosLocais(pontos);
  let melhorIdx = -1;
  let melhorRaio = Infinity;

  for (let i = janela; i < pontos.length - janela; i++) {
    const r = raioCirculo3Pontos(m[i - janela], m[i], m[i + janela]);
    if (!Number.isFinite(r) || r < raioMinM || r > raioMaxM) continue;
    if (r < melhorRaio) {
      melhorRaio = r;
      melhorIdx = i;
    }
  }

  if (melhorIdx < 0) return null;
  return {
    ponto: { lat: pontos[melhorIdx].lat, lng: pontos[melhorIdx].lng },
    idx:   melhorIdx,
    raioM: melhorRaio,
  };
}

/**
 * Dada uma passagem (pontos da entrada à saída) e a melhor passagem
 * histórica (referência), retorna o ápice da MELHOR PASSAGEM.
 * Esse é o "ápice de referência" que o painel exibe.
 *
 * Lógica:
 *   - Sempre retorna o ápice da melhor passagem (a referência).
 *   - Para atualizar a referência, o consumidor compara tempos e,
 *     se a passagem atual for melhor, persiste ela como nova referência
 *     em `melhores_passagens_trecho` — e o ápice recalcula sozinho da próxima vez.
 */
export function apiceDaReferencia(passagemReferencia, opts = {}) {
  if (!passagemReferencia || !Array.isArray(passagemReferencia.pontos)) return null;
  return acharApice(passagemReferencia.pontos, opts);
}
