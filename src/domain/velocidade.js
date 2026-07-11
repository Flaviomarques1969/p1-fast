// ── Casa única da matemática de VELOCIDADE do P1 Fast ──────────────────────────
// Lugar NEUTRO (domínio puro): o cockpit (web/cockpit/velocidade.js reexporta daqui)
// e o cérebro (web/command-box/cerebro/cerebro-velocidade.js reexporta daqui) usam a
// MESMA conta — sem cópia, sem refazer. Antes o fator de conversão m/s↔km/h (3,6)
// estava solto em ~15 arquivos, e a velocidade tirada do GPS morava só no cérebro.
// Agora mora aqui.
//
// A trava de arquitetura (npm run smoke:arquitetura) REPROVA quem multiplicar/dividir
// por 3.6 fora deste arquivo — ver docs/CONTRATO_DADOS.md.

import { distanciaCoords } from './geo.js';

// 1 m/s = 3,6 km/h. Fator físico fixo — uma casa só.
export const FATOR_KMH = 3.6;

/**
 * m/s → km/h. Aritmética pura: mantém EXATAMENTE os mesmos números de antes
 * (a guarda de nulo/NaN continua em quem chama, como já era no código).
 */
export function msParaKmh(ms) { return ms * FATOR_KMH; }

/** km/h → m/s. */
export function kmhParaMs(kmh) { return kmh / FATOR_KMH; }

/**
 * Série de velocidade (km/h) a partir das amostras de GPS gravadas
 * (Flávio 19/06: "velocidade vem do GPS, igual à frenagem"). Tira a velocidade
 * calculando a distância que o carro andou entre dois pontos do GPS / tempo.
 * O acelerômetro (futuro) entra só pra refinar; aqui é GPS puro.
 * @param {Array} amostras  [[tMs, lat, lng], ...] (formato dos fixtures volta-real-gps)
 * @returns {Array<{tMs:number, kmh:number}>}
 */
export function velocidadesDaVolta(amostras) {
  if (!Array.isArray(amostras) || amostras.length < 2) return [];
  const bruto = [{ tMs: amostras[0][0], kmh: 0 }];
  for (let i = 1; i < amostras.length; i++) {
    const [t0, la0, lo0] = amostras[i - 1];
    const [t1, la1, lo1] = amostras[i];
    const dt = (t1 - t0) / 1000;
    const d = distanciaCoords(la0, lo0, la1, lo1);
    let kmh = dt > 0 ? msParaKmh(d / dt) : 0;
    if (kmh > 320) kmh = bruto[i - 1].kmh; // descarta salto absurdo de GPS
    bruto.push({ tMs: t1, kmh });
  }
  // suavização leve (média móvel de 3) — GPS a ~1 Hz é ruidoso
  const suave = bruto.map((p, i) => {
    const a = bruto[Math.max(0, i - 1)].kmh, b = p.kmh, c = bruto[Math.min(bruto.length - 1, i + 1)].kmh;
    return { tMs: p.tMs, kmh: Math.round((a + b + c) / 3) };
  });
  return suave;
}

export default { FATOR_KMH, msParaKmh, kmhParaMs, velocidadesDaVolta };
