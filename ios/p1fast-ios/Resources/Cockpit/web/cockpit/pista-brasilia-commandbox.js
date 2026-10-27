// pista-brasilia-commandbox.js — GERADO por tools/recalibrar-mapa-command-box.mjs (recalibração 2026-06-16)
// Projeta GPS (lat,lng) -> espaço do SVG da pista do Command Box (viewBox "130 110 580 660").
// Reusa a amarração provada GPS->desenho-oficial (pista-oficial-brasilia.js) e acrescenta a
// transformação desenho-oficial(823x799) -> traço do Command Box, estimada por semelhança.
// Erro do casamento ao traço: mediana 12.5 px · p95 22.4 px.
// Erro de uma VOLTA REAL do Bubi projetada: mediana 7.3 px · p95 22.9 px (largura da pista ~22 px).
import { geoParaDesenho } from './pista-oficial-brasilia.js';
const SCALE = 1.0715743273003722;
const R = [[-0.9278403673171279, 0.3729775499635563], [-0.3729775499635563, -0.9278403673171279]];
const TX = 688.4092206734772, TY = 1070.002725037379;
export function geoParaCommandBox(lat, lng) {
  const d = geoParaDesenho(lat, lng);
  return { x: SCALE*(R[0][0]*d.x + R[0][1]*d.y) + TX, y: SCALE*(R[1][0]*d.x + R[1][1]*d.y) + TY };
}
