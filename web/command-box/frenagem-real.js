// frenagem-real.js — adaptador: roda o MOTOR DE PRODUÇÃO (freio-trecho.js) numa
// passagem real e devolve a frenagem no MESMO formato que o desenho aprovado do
// Command Box já consome (a forma de FRX_CENARIOS). Assim o bloco troca o dado
// SIMULADO pelo REAL sem tocar no renderizador frx-* nem no bloco Vmin.
//
// Decisão Flávio 15/06/2026 (card "completo, como o cockpit"): o box passa a
// calcular a freada por curva com o motor de produção — física do GPS agora,
// pressão do sensor quando o T4000 mandar — igual o cockpit do piloto já faz.
//
// NÃO copia lógica: importa as funções de produção de web/cockpit/freio-trecho.js.

import {
  comDistanciaAcumulada,
  simularFreioPelaFisica,
  fundirFreioNosPontos,
  metricasTrail,
} from '../cockpit/freio-trecho.js';

// Grade e ideal do bloco aprovado (espelham FRX_XS/FRX_ALVO do mockup).
export const FRX_XS_PADRAO   = [0, 6, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60];
export const FRX_ALVO_PADRAO = [0, 0, 0, 0, 5, 40, 80, 92, 90, 86, 78, 66, 54, 42, 32, 24, 12, 0];

const LIMIAR   = 15; // % — "começou a frear" (igual a LIMIAR_FREANDO do motor)
const VMIN_MIN = 8;  // % — freio na mínima pra contar "chegou freando" (TRAIL_DEFAULTS.freioVminMinPct)

// Roda o motor de produção numa passagem: física do GPS por padrão; pressão do
// sensor por cima quando há amostra real do T4000 (detecção de presença interna).
function motorPassagem(pontos, amostrasFreio) {
  const comDist = comDistanciaAcumulada(pontos);
  let res = null;
  if (Array.isArray(amostrasFreio) && amostrasFreio.length) {
    res = fundirFreioNosPontos(comDist, amostrasFreio); // null se sensor ausente/chapado
  }
  if (!res) res = simularFreioPelaFisica(comDist);
  return { pts: res.pontos, fonteFreio: res.fonteFreio, metricas: metricasTrail(res.pontos) };
}

// % de freio interpolado na distância-alvo (m) ao longo da passagem. Fora da
// passagem (antes do início / depois do fim) = 0.
function freioEm(pts, distAlvo) {
  if (!pts.length || distAlvo <= pts[0].distM || distAlvo >= pts[pts.length - 1].distM) return 0;
  for (let i = 1; i < pts.length; i++) {
    if (distAlvo <= pts[i].distM) {
      const a = pts[i - 1], b = pts[i];
      const span = (b.distM - a.distM) || 1;
      const f = (distAlvo - a.distM) / span;
      const fa = a.freioPct ?? 0, fb = b.freioPct ?? 0;
      return Math.max(0, Math.min(100, fa + (fb - fa) * f));
    }
  }
  return 0;
}

// ponto (interpolado) onde a curva da grade cruza 15% = "começou a frear".
function crossing(arr, xs) {
  for (let i = 1; i < xs.length; i++) {
    if (arr[i - 1] < LIMIAR && arr[i] >= LIMIAR) {
      const f = (LIMIAR - arr[i - 1]) / (arr[i] - arr[i - 1]);
      return xs[i - 1] + (xs[i] - xs[i - 1]) * f;
    }
  }
  return null;
}

/**
 * Converte uma passagem REAL (e a melhor, p/ ancorar) na forma de FRX_CENARIOS:
 *   { live[18], minimaFreando, soltou, freioMin, fonteFreio, deltaM }
 * - live: % de freio na grade FRX_XS (janela de 0..60 m), ancorado pelo ponto de
 *   freada da REFERÊNCIA (melhor volta) no mesmo x onde o ideal começa a frear —
 *   assim o renderizador aprovado compara a forma real contra o ideal, ponto a
 *   ponto, e o marcador 0/+/− cai no lugar certo.
 * - deltaM: metros entre o ponto de freada da passagem e o da melhor (+ = depois).
 * Devolve null se a passagem não tem freada real (trecho de aceleração / dado ralo).
 */
export function frenagemFrxParaPassagem(passagem, opts = {}) {
  const { pontos, refPontos, amostrasFreio } = passagem || {};
  const xs   = opts.FRX_XS   || FRX_XS_PADRAO;
  const alvo = opts.FRX_ALVO || FRX_ALVO_PADRAO;
  if (!Array.isArray(pontos) || pontos.length < 3) return null;

  const cur = motorPassagem(pontos, amostrasFreio);
  if (!cur.metricas) return null; // sem freada real

  // âncora: onde o IDEAL começa a frear (15%) define o x da freada da referência.
  const onsetIdeal = crossing(alvo, xs);
  const ancoraX = (onsetIdeal != null) ? onsetIdeal : 14;

  let refMet = null;
  if (Array.isArray(refPontos) && refPontos.length >= 3) {
    const r = motorPassagem(refPontos);
    if (r.metricas) refMet = r.metricas;
  }
  const freadaRef   = refMet ? refMet.freadaM : cur.metricas.freadaM;
  const windowStart = freadaRef - ancoraX; // metros reais que caem em x=0 da grade

  const live = xs.map(x => Math.round(freioEm(cur.pts, windowStart + x)));

  return {
    live,
    minimaFreando: cur.metricas.freioNaVminPct >= VMIN_MIN,
    soltou: cur.metricas.forma === 'degrau' ? 'de uma vez' : 'progressivo',
    freioMin: Math.round(cur.metricas.freioNaVminPct) + '%',
    fonteFreio: cur.fonteFreio,
    deltaM: refMet ? Math.round(cur.metricas.freadaM - refMet.freadaM) : null,
  };
}
