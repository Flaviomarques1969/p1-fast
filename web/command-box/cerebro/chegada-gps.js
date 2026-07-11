// ============================================================================
// CHEGADA-GPS — detector PURO de cruzamento da linha de chegada (volta por GPS).
//
// Peça de cálculo do cérebro da NUVEM. Não fala com Supabase, não importa nada
// do cockpit — só geometria. O marco { a_gps, b_gps } chega pronto por quem usa.
//
// A geometria de cruzamento mora numa CASA ÚNICA (src/domain/geo.js), usada também
// pelo detector do cockpit (chegada-detector.js). Decisão Flávio 2026-05-28 (regra de
// cruzamento) + 2026-06-23 (casa única — acabou a cópia espelho). Aqui sem a parte de
// Supabase (loadMarcoChegada), porque o cérebro recebe o marco de fora.
// ============================================================================

import { sideOfLine, caminhoCruzaLinha } from '../../../src/domain/geo.js';

const DEBOUNCE_MS = 5000;

/**
 * Cria um detector de chegada por GPS.
 * @param {{a_gps:{lat,lng}, b_gps:{lat,lng}}} marco  linha de chegada
 * @param {(info:{t:number, voltaN:number}) => void} onChegada  chamado a cada cruzamento
 * @returns {{ ingestGps:(s:{lat:number,lng:number,t?:number})=>void, getVoltas:()=>number }}
 */
export function criarDetectorChegada(marco, onChegada = () => {}) {
  if (!marco || !marco.a_gps || !marco.b_gps) {
    throw new Error('criarDetectorChegada: marco { a_gps, b_gps } obrigatório');
  }
  const a = marco.a_gps, b = marco.b_gps;
  let lastSide = null, lastPos = null, lastCrossT = -Infinity, voltas = 0;

  function ingestGps(sample) {
    if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') return;
    const t = typeof sample.t === 'number' ? sample.t : null;
    const side = sideOfLine(sample, a, b);
    if (lastSide != null
        && Math.sign(side) !== Math.sign(lastSide)
        && lastPos
        && caminhoCruzaLinha(lastPos, sample, a, b)
        && (t == null || t - lastCrossT > DEBOUNCE_MS)) {
      if (t != null) lastCrossT = t;
      voltas++;
      try { onChegada({ t, voltaN: voltas }); }
      catch (e) { /* não derruba o fluxo do painel por erro de callback */ }
    }
    lastSide = side;
    lastPos = { lat: sample.lat, lng: sample.lng };
  }

  return { ingestGps, getVoltas: () => voltas };
}

export default { criarDetectorChegada };
