// ============================================================================
// CÉREBRO — Velocidade pelo GPS (Flávio 19/06: "velocidade vem do GPS, igual à
// frenagem"). Tira a velocidade da volta GRAVADA calculando a distância que o
// carro andou entre um ponto e outro do GPS, dividida pelo tempo. O acelerômetro
// (futuro) entra só pra refinar; aqui é GPS puro.
// ============================================================================

const R_TERRA_M = 6371000;
const TO_RAD = Math.PI / 180;

/** Distância em metros entre dois pontos lat/lng (Haversine). */
export function distanciaM(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLng = (lng2 - lng1) * TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Série de velocidade (km/h) a partir das amostras de GPS gravadas.
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
    const d = distanciaM(la0, lo0, la1, lo1);
    let kmh = dt > 0 ? (d / dt) * 3.6 : 0;
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

export default { velocidadesDaVolta, distanciaM };
