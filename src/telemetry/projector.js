// ═══════════════════════════════════════════════════════════
// Projector — lat/lng → x/y do viewBox (T-003 / A-003)
// ═══════════════════════════════════════════════════════════
// Resolve o gap identificado no AUDIT: Provider emite lat/lng mas
// Detector espera x/y em coordenadas do viewBox. Sem isso, o pipeline
// inteiro morre em H03.
//
// Algoritmo: duas âncoras (lat, lng, x, y) definem uma transformação
// afim 2D (escala + rotação + translação). Para pequenas áreas (<5km)
// é aproximação suficiente — a curvatura terrestre é irrelevante na
// escala de um autódromo.
//
// Representação complexa:
//   vetor lat/lng→metros locais (relative ao anchor[0]) = A
//   vetor viewBox (anchor[1] - anchor[0])               = B
//   fator k = B / A  (multiplicação complexa)
//   para qualquer sample: dx_m/dy_m → (dx,dy) via k → somar anchor[0] no viewBox
//
// Retorno null → track sem âncoras (caller mantém x/y = null).

const M_PER_DEG_LAT = 111000;

function latlngToMeters(lat, lng, origin) {
  const dLat = lat - origin.lat;
  const dLng = lng - origin.lng;
  const cosLat = Math.cos(origin.lat * Math.PI / 180);
  return {
    mx: dLng * M_PER_DEG_LAT * cosLat,   // leste+
    my: -dLat * M_PER_DEG_LAT,           // norte+; invertido pra casar com y-DOM (y cresce pra baixo)
  };
}

/**
 * Projeta lat/lng de um sample para x/y do viewBox usando as âncoras do track.
 *
 * @param {object} sample   — deve ter `lat` e `lng`; retorna {x,y} setados (ou null se falhar)
 * @param {object} track    — deve ter `geoAncoras: [{lat,lng,x,y}, {lat,lng,x,y}]`
 * @returns {{x:number, y:number}|null}
 */
export function projectToViewBox(sample, track) {
  if (!track?.geoAncoras || track.geoAncoras.length < 2) return null;
  if (sample?.lat == null || sample?.lng == null) return null;

  const [a0, a1] = track.geoAncoras;

  // vetor A em metros (anchor1 - anchor0)
  const A = latlngToMeters(a1.lat, a1.lng, a0);
  // vetor B em viewBox (anchor1 - anchor0)
  const B = { x: a1.x - a0.x, y: a1.y - a0.y };

  // k = B / A (complexo): ( (Bx+iBy) * (Ax-iAy) ) / |A|²
  const denom = A.mx * A.mx + A.my * A.my;
  if (denom < 1e-9) return null;                   // âncoras coincidentes → degenerado
  const kx = (B.x * A.mx + B.y * A.my) / denom;
  const ky = (B.y * A.mx - B.x * A.my) / denom;    // parte imaginária de k

  // P em metros (sample - anchor0)
  const P = latlngToMeters(sample.lat, sample.lng, a0);

  // (Px + iPy) * (kx + iky) = (Px*kx - Py*ky) + i(Px*ky + Py*kx)
  const x = a0.x + (P.mx * kx - P.my * ky);
  const y = a0.y + (P.mx * ky + P.my * kx);
  return { x, y };
}

/**
 * Mutator conveniente: popula sample.x/y in-place se a projeção for possível.
 * Retorna true se populou, false caso contrário (caller pode logar).
 */
export function applyProjection(sample, track) {
  const r = projectToViewBox(sample, track);
  if (!r) return false;
  sample.x = r.x;
  sample.y = r.y;
  return true;
}
