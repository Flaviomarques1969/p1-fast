// ── Casa única da matemática de GPS (lat/lng → metros) do P1 Fast ──────────────
// Lugar NEUTRO (domínio puro): o cockpit (web/cockpit/geo.js reexporta daqui) e o
// cérebro (web/command-box/cerebro/*) usam a MESMA conta — sem cópia, sem refazer.
// Antes a distância estava copiada em ~16 arquivos e o cruzamento da linha de chegada
// era espelhado entre o cockpit e o cérebro ("mudar num, mudar no outro"). Agora mora aqui.
//
// Escala de uso = pista (< ~2 km): projeção equiretangular local é exata o bastante
// e barata. A trava de arquitetura reprova quem reescrever a fórmula fora deste arquivo
// (docs/CONTRATO_DADOS.md).

export const R_TERRA_M = 6378137;          // raio equatorial WGS84 (modelo esférico)
export const D2R = Math.PI / 180;

// Metros por grau — usado pelos detectores que projetam lat/lng em x,y (cruzamento de
// linha de chegada/box). Mantém os MESMOS números que estavam espalhados nos detectores.
export const M_POR_GRAU_LAT = 110540;
export function mPorGrauLng(lat) { return 111320 * Math.cos(lat * D2R); }

/**
 * Distância em metros entre dois pontos {lat, lng} (equiretangular esférica).
 * É a fórmula da maioria do sistema (freio, delta, classificador, trail) — número idêntico.
 */
export function distanciaPontos(a, b) {
  const x = (b.lng - a.lng) * D2R * Math.cos(((a.lat + b.lat) / 2) * D2R);
  const y = (b.lat - a.lat) * D2R;
  return Math.hypot(x, y) * R_TERRA_M;
}

/** Mesma distância, mas recebendo as coordenadas soltas (lat1, lng1, lat2, lng2). */
export function distanciaCoords(lat1, lng1, lat2, lng2) {
  return distanciaPontos({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}

// ── Cruzamento de linha (chegada / trecho) ─────────────────────────────────────
/** De que lado da reta a–b está o ponto p (sinal). Muda de sinal = cruzou a reta. */
export function sideOfLine(p, a, b) {
  return (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng);
}

/** O caminho p0→p1 cruza a LINHA DE VERDADE a–b? (interseção de segmentos em projeção
 *  local; folga de 50% em cada ponta da linha pela largura real). */
export function caminhoCruzaLinha(p0, p1, a, b) {
  const kLat = M_POR_GRAU_LAT;
  const kLng = mPorGrauLng(a.lat);
  const X = q => (q.lng - a.lng) * kLng;
  const Y = q => (q.lat - a.lat) * kLat;
  const r = { x: X(p1) - X(p0), y: Y(p1) - Y(p0) };
  const d = { x: X(b), y: Y(b) };
  const den = r.x * d.y - r.y * d.x;
  if (Math.abs(den) < 1e-9) return false; // paralelos
  const qp = { x: -X(p0), y: -Y(p0) };
  const v = (qp.x * d.y - qp.y * d.x) / den;  // posição ao longo do caminho
  const u = (qp.x * r.y - qp.y * r.x) / den;  // posição ao longo da linha
  return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
}

export default {
  R_TERRA_M, D2R, M_POR_GRAU_LAT, mPorGrauLng,
  distanciaPontos, distanciaCoords, sideOfLine, caminhoCruzaLinha,
};
