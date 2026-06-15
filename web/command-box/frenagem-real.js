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

// Janela-ideal da grade: onde o trail COMEÇA (cruza 15%) e TERMINA. Exposta pra outros
// módulos (ex.: forma-trail-tipo.js) alinharem a forma prescrita do tipo com o `live` que o
// adaptador amostra aqui — mesma fonte (FRX_ALVO_PADRAO), pra não haver dois "onset" divergentes.
export const FRX_IDEAL_ONSET = crossing(FRX_ALVO_PADRAO, FRX_XS_PADRAO) ?? 14;
export const FRX_IDEAL_END   = FRX_XS_PADRAO[FRX_XS_PADRAO.length - 1];

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

// Janela REAL da freada (m): do início (freada) ao fim da soltura (freio <10% após
// o pico) — ou, na falta, até a velocidade mínima. É o trecho que a grade representa.
function janelaFreada(met, ultimaDistM) {
  const onset = met.freadaM;
  let fim = met.solturaM > 0 ? (met.picoM + met.solturaM) : met.vminM;
  if (!(fim > onset)) fim = met.vminM;
  fim = Math.min(fim, ultimaDistM);
  if (fim < onset + 20) fim = Math.min(onset + 60, ultimaDistM); // piso de janela
  return { onset, fim };
}

// Amostra a curva de freio numa grade NORMALIZADA pela janela base: o início da
// freada da base cai no x onde o ideal começa (~14 m) e o fim cai no fim da grade.
// Assim a forma inteira (sobe até o pico e DESCE na soltura) ocupa a grade.
function amostrarNaGrade(pts, janela, xs, idealOnset, idealEnd) {
  const span = (janela.fim - janela.onset) || 1;
  const gradeSpan = (idealEnd - idealOnset) || 1;
  return xs.map((x) => {
    const d = janela.onset + ((x - idealOnset) / gradeSpan) * span;
    return Math.round(freioEm(pts, d));
  });
}

/**
 * Converte uma passagem REAL na forma que o desenho aprovado consome, agora com a
 * curva ocupando a ZONA REAL da freada (início → soltura), comparada contra a
 * MELHOR volta (referência):
 *   { live[18], ref[18], minimaFreando, soltou, freioMin, fonteFreio, deltaM }
 * - live: % de freio da passagem mostrada, na grade normalizada pela janela da melhor.
 * - ref:  % de freio da MELHOR volta, na mesma grade (vira a linha de referência + banda).
 * - deltaM: metros REAIS entre o ponto de freada da passagem e o da melhor (+ = depois).
 * Sem referência (ex.: ao vivo antes da 1ª melhor), normaliza pela própria passagem.
 * Devolve null se a passagem não tem freada real (trecho de aceleração / dado ralo).
 */
export function frenagemFrxParaPassagem(passagem, opts = {}) {
  const { pontos, refPontos, amostrasFreio } = passagem || {};
  const xs   = opts.FRX_XS   || FRX_XS_PADRAO;
  const alvo = opts.FRX_ALVO || FRX_ALVO_PADRAO;
  if (!Array.isArray(pontos) || pontos.length < 3) return null;

  const cur = motorPassagem(pontos, amostrasFreio);
  if (!cur.metricas) return null; // sem freada real

  const idealOnset = crossing(alvo, xs) ?? 14;
  const idealEnd = xs[xs.length - 1];

  let refRes = null;
  if (Array.isArray(refPontos) && refPontos.length >= 3) {
    const r = motorPassagem(refPontos);
    if (r.metricas) refRes = r;
  }
  // janela base = a da MELHOR volta (referência); sem ref, a da própria passagem.
  const baseRes = refRes || cur;
  const janela = janelaFreada(baseRes.metricas, baseRes.pts[baseRes.pts.length - 1].distM);

  const live = amostrarNaGrade(cur.pts, janela, xs, idealOnset, idealEnd);
  const ref  = amostrarNaGrade(baseRes.pts, janela, xs, idealOnset, idealEnd);

  return {
    live,
    ref,
    minimaFreando: cur.metricas.freioNaVminPct >= VMIN_MIN,
    soltou: cur.metricas.forma === 'degrau' ? 'de uma vez' : 'progressivo',
    freioMin: Math.round(cur.metricas.freioNaVminPct) + '%',
    fonteFreio: cur.fonteFreio,
    deltaM: refRes ? Math.round(cur.metricas.freadaM - refRes.metricas.freadaM) : null,
  };
}
