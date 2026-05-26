// track-detector.js — detector de cruzamento de apex/saída usando GPS ao vivo.
//
// Fluxo:
//   1. Recebe ponto GPS (lat, lng) do iPhone via canal Realtime.
//   2. Converte lat/lng → coordenadas do SVG da pista (via 2 âncoras geográficas).
//   3. Compara distância com cada apex/saída das curvas do circuito.
//   4. Quando entra na zona (raio configurável), dispara callback uma vez.
//   5. Quando sai da zona (saída do raio), libera pra disparar de novo na próxima volta.

// 2 âncoras geográficas Brasília (lat/lng → svg x/y). Origem: SeedBrasilia.swift
const ANCORAS = [
  { lat: -15.77000, lng: -47.90000, x: 410, y: 707 },
  { lat: -15.77180, lng: -47.89800, x: 630, y: 400 },
];

// Raio de detecção em coordenadas SVG. Calibrar conforme escala — Brasília SVG
// tem ~823×799, pista ~5km → ~30m ≈ 5 unidades SVG (estimativa inicial).
const RAIO_DETECCAO_SVG = 25;

/**
 * Converte lat/lng pra coordenadas SVG da pista.
 * Usa transformação afim 2D a partir de 2 âncoras (a3 ponto vem por extrapolação).
 * Suficiente pra pista plana e GPS de boa precisão.
 */
export function latLngToSvg(lat, lng, ancoras = ANCORAS) {
  if (ancoras.length < 2) return null;
  const [a, b] = ancoras;
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  if (dLat === 0 && dLng === 0) return null;
  // proporção entre o ponto e a 1ª âncora, projetada no eixo das âncoras
  const tLat = (lat - a.lat) / (dLat || 1);
  const tLng = (lng - a.lng) / (dLng || 1);
  // média entre as 2 projeções (aproximação afim simples — calibrar com dados reais)
  const x = a.x + ((b.x - a.x) * tLng);
  const y = a.y + ((b.y - a.y) * tLat);
  return { x, y };
}

function dist(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx*dx + dy*dy);
}

/**
 * Cria um detector pra um conjunto de curvas. As curvas precisam ter `apex_x`,
 * `apex_y` (entrada/apex) e opcionalmente um ponto de saída calculado.
 *
 * onCruzarEntrada(curva)  → chamado quando passa pelo apex (registrar velocidade).
 * onCruzarSaida(curva)    → chamado quando sai do raio do apex (registrar saída).
 *
 * Estado interno: lembra em qual curva está "dentro" pra não disparar várias vezes.
 */
export function createDetector({ curvas, onCruzarEntrada, onCruzarSaida, raioSvg = RAIO_DETECCAO_SVG }) {
  const dentroDe = new Set();    // curva.id que estamos atualmente dentro
  const cruzouEntrada = new Set(); // curva.id que já disparou entrada nesta passagem

  return {
    /** Chamar a cada ponto GPS novo (lat, lng). */
    ingestGps(lat, lng) {
      const pt = latLngToSvg(lat, lng);
      if (!pt) return;
      for (const c of curvas) {
        if (typeof c.apex_x !== 'number' || typeof c.apex_y !== 'number') continue;
        const d = dist(pt, { x: c.apex_x, y: c.apex_y });
        const estavaDentro = dentroDe.has(c.id);
        const agoraDentro = d <= raioSvg;
        if (agoraDentro && !estavaDentro) {
          dentroDe.add(c.id);
          if (!cruzouEntrada.has(c.id)) {
            cruzouEntrada.add(c.id);
            if (typeof onCruzarEntrada === 'function') onCruzarEntrada(c);
          }
        } else if (!agoraDentro && estavaDentro) {
          dentroDe.delete(c.id);
          if (typeof onCruzarSaida === 'function') onCruzarSaida(c);
        }
      }
    },
    /** Resetar entre voltas (cruzou linha de chegada). */
    resetVolta() {
      cruzouEntrada.clear();
    },
    getDebug() {
      return { dentroDe: [...dentroDe], cruzouEntrada: [...cruzouEntrada] };
    },
  };
}
