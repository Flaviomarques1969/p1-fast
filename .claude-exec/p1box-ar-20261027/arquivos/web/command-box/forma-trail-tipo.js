// forma-trail-tipo.js — dado o TIPO da curva, devolve a FORMA-IDEAL do trail-braking
// (o trail clássico PRESCRITO do tipo) amostrada na grade FRX do Command Box, em % de
// freio. É a régua TEÓRICA: a linha tracejada + faixa que a volta real persegue.
//
// HONESTIDADE (NÃO INVENTAR): não é medição. Porta as formas y(x) que o Flávio APROVOU
// no mockup do cockpit de treino (_design-reference/mockup-cockpit-treino-trail-braking-
// VIVO-2026-06-11.html), reescrevendo-as em % de freio:
//   ALVOS.classico  = 100% na pancada + soltura gradativa até o ápice    → T0, T1, T5
//   ALVOS.residual  = pancada parcial 65% + residual 45% + soltura no fim → T2, T4
//   toque           = toque curto (≤40%) só pra assentar a dianteira      → T3
// SF (pé embaixo) e ND (indeterminado) NÃO têm prescrição de freio → devolvem null.
//
// O mapa tipo→forma vem de perfilDeTrail (fonte única, em perfil-trail-por-tipo.js). A
// grade e a JANELA-IDEAL (onset/fim) vêm de frenagem-real.js, pra a forma ALINHAR ponto a
// ponto com a volta real (`live`) que o adaptador amostra na mesma grade. Módulo PURO (sem DOM).

import { FRX_XS_PADRAO, FRX_IDEAL_ONSET, FRX_IDEAL_END } from './frenagem-real.js';
import { perfilDeTrail } from '../cockpit/perfil-trail-por-tipo.js';

// constantes geométricas do gráfico aprovado (espaço de pixel do mockup VIVO).
const XB = 300, XA = 740, YG = 252, PLATO = 56;
const pctDeY = (y) => (YG - y) / (YG - PLATO) * 100;       // pixel y → % de freio
const pctY   = (p) => YG - (YG - PLATO) * p / 100;         // % de freio → pixel y (igual ao mockup)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Bézier cúbica da soltura do clássico — P0..P3 IDÊNTICOS ao LUT do mockup VIVO.
const LUT = (() => {
  const P = [390, 56, 540, 77, 660, 154, 740, 191], out = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, mt = 1 - t;
    out.push([
      mt * mt * mt * P[0] + 3 * mt * mt * t * P[2] + 3 * mt * t * t * P[4] + t * t * t * P[6],
      mt * mt * mt * P[1] + 3 * mt * mt * t * P[3] + 3 * mt * t * t * P[5] + t * t * t * P[7],
    ]);
  }
  return out;
})();

// y(pixelX) das formas aprovadas — porte literal de ALVOS.classico / ALVOS.residual.
function classicoY(x) {
  if (x < XB) return YG;
  if (x <= 390) return PLATO;
  if (x >= XA) return LUT[LUT.length - 1][1];
  let lo = 0, hi = LUT.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (LUT[mid][0] < x) lo = mid + 1; else hi = mid; }
  const b = LUT[lo], a = LUT[Math.max(0, lo - 1)];
  const f = (x - a[0]) / ((b[0] - a[0]) || 1);
  return a[1] + (b[1] - a[1]) * f;
}
function residualY(x) {
  if (x < XB) return YG;
  if (x < 330) return YG + (pctY(65) - YG) * smooth(XB, 330, x);
  if (x < 380) return pctY(65) + (pctY(45) - pctY(65)) * smooth(330, 380, x);
  if (x < 560) return pctY(45);
  return pctY(45) + (pctY(25) - pctY(45)) * smooth(560, XA, x);
}
// toque (T3): NÃO há forma no mockup — é a prescrição do perfil (cargaPicoPct ≤40%, "toque
// curto que não reduz a velocidade"). Bump curto e baixo (pico ~35%), assumido como régua.
function toquePct(u) {
  return 35 * Math.min(smooth(0, 0.10, u), 1 - smooth(0.18, 0.45, u));
}

// % de freio na posição NORMALIZADA u∈[0,1] da zona de freada, pela forma pedida.
function pctEm(forma, u) {
  const x = XB + u * (XA - XB);
  if (forma === 'classico') return pctDeY(classicoY(x));
  if (forma === 'residual') return pctDeY(residualY(x));
  if (forma === 'toque')    return toquePct(u);
  return 0;
}

// Qual forma cada tipo usa (fonte única: perfilDeTrail → curvaExemplo / soltura).
export function formaDoTipo(tipo) {
  const p = perfilDeTrail(tipo);
  if (p.temFreio === false || p.temFreio === null) return null; // SF / ND: sem prescrição
  if (p.curvaExemplo === 'classico') return 'classico';
  if (p.curvaExemplo === 'residual') return 'residual';
  if (p.soltura === 'toque') return 'toque';
  return null;
}

/**
 * Forma-ideal (trail clássico prescrito) do TIPO, amostrada na grade FRX em % de freio.
 * Alinhada com a volta real: usa a MESMA janela (onset→fim) que frenagem-real.js usa no
 * `live`, então ideal[i] e live[i] comparam o mesmo ponto da zona de freada.
 * @returns number[] (mesmo tamanho de xs) ou null pra SF/ND (sem freio prescrito).
 */
export function formaTrailTipo(tipo, xs = FRX_XS_PADRAO) {
  const forma = formaDoTipo(tipo);
  if (!forma) return null;
  const onset = FRX_IDEAL_ONSET, span = (FRX_IDEAL_END - onset) || 1;
  return xs.map((x) => {
    if (x < onset) return 0; // antes do ponto de freada = sem freio (chão)
    const u = Math.min(1, (x - onset) / span);
    return Math.round(Math.max(0, Math.min(100, pctEm(forma, u))));
  });
}
