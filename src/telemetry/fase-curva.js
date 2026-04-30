// ═══════════════════════════════════════════════════════════
// fase-curva — Classificação de fase (C2 do PLANO_EXECUCAO)
// ═══════════════════════════════════════════════════════════
// Dada uma SegmentExecution com samples densos, identifica as 3 fases:
//   - INICIO (entrada/frenagem)
//   - MEIO   (apoio/apex)              ← contém o ponto de apex real
//   - FIM    (saída/retomada)
//
// Método híbrido:
//   • Com accLong: INICIO = enquanto accLong < limiarFreio
//                  MEIO   = |accLong| < 0.15g (estabilização)
//                  FIM    = accLong > limiarAcel
//   • Sem accLong (fallback): 33/33/33 por tempo.
//
// Indicadores mandatórios por fase (saída da função):
//   velEntrada, velMinima, velSaida, duracaoMs, accLongPeak, accLatPeak.
//
// APEX (gate 2026-04-24, docs/raceops/APEX_ANALYSIS_RULES.md):
//   meio.apexT      — timestamp do ponto de menor velocidade dentro do MEIO
//   meio.apexIdx    — índice da amostra correspondente
//   meio.apexKmh    — velocidade no apex
//   total.apexT     — idem mas considerando todos os samples (compatibilidade)
// Campos null se não houver dados de velocidade.
//
// Depende de ter: samples = [{ t, kmh, accLong, accLat }]. Tolerante a faltas.

export const Fase = Object.freeze({
  INICIO: 'inicio',
  MEIO:   'meio',
  FIM:    'fim',
});

const LIMIAR_FREIO_G = -0.35;
const LIMIAR_ACEL_G  = +0.25;
const ESTAVEL_G      = 0.15;

function fallbackPorTempo(samples) {
  if (!samples.length) return null;
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const total = t1 - t0;
  const c1 = t0 + total / 3;
  const c2 = t0 + 2 * total / 3;
  return { c1, c2 };
}

function detectarCortes(samples) {
  const temAcc = samples.some(s => s.accLong != null);
  if (!temAcc) return fallbackPorTempo(samples);

  let c1 = null, c2 = null;
  for (const s of samples) {
    if (c1 == null && s.accLong != null && s.accLong > LIMIAR_FREIO_G) c1 = s.t;
    if (c1 != null && c2 == null && s.accLong != null && s.accLong > LIMIAR_ACEL_G) c2 = s.t;
  }
  const fb = fallbackPorTempo(samples);
  if (c1 == null) c1 = fb.c1;
  if (c2 == null) c2 = fb.c2;
  return { c1, c2 };
}

function stats(samples) {
  let velMin = Infinity, velMax = -Infinity;
  let accLongPeak = 0, accLatPeak = 0;
  let apexIdx = null, apexT = null, apexKmh = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.kmh != null) {
      if (s.kmh < velMin) {
        velMin = s.kmh;
        apexIdx = i;
        apexT = s.t ?? null;
        apexKmh = s.kmh;
      }
      if (s.kmh > velMax) velMax = s.kmh;
    }
    if (s.accLong != null && Math.abs(s.accLong) > Math.abs(accLongPeak)) accLongPeak = s.accLong;
    if (s.accLat != null && Math.abs(s.accLat) > Math.abs(accLatPeak)) accLatPeak = s.accLat;
  }
  return {
    velEntrada: samples[0]?.kmh ?? null,
    velSaida: samples[samples.length - 1]?.kmh ?? null,
    velMinima: isFinite(velMin) ? velMin : null,
    velMaxima: isFinite(velMax) ? velMax : null,
    accLongPeak: accLongPeak || null,
    accLatPeak: accLatPeak || null,
    apexT,                          // timestamp do ponto de apex (menor velocidade)
    apexIdx,                        // índice da amostra correspondente
    apexKmh,                        // velocidade no apex (km/h)
  };
}

/**
 * @param {Array<{t:number, kmh:number, accLong?:number, accLat?:number}>} samples
 * @returns {{ inicio, meio, fim, stats }} — cada fase com samples + stats
 */
export function classificarFases(samples) {
  if (!samples?.length) return null;
  const cortes = detectarCortes(samples);
  if (!cortes) return null;
  const inicio = samples.filter(s => s.t <= cortes.c1);
  const meio   = samples.filter(s => s.t > cortes.c1 && s.t <= cortes.c2);
  const fim    = samples.filter(s => s.t > cortes.c2);

  return {
    inicio: { samples: inicio, stats: stats(inicio), duracaoMs: (inicio.at(-1)?.t - inicio[0]?.t) || 0 },
    meio:   { samples: meio,   stats: stats(meio),   duracaoMs: (meio.at(-1)?.t - meio[0]?.t) || 0 },
    fim:    { samples: fim,    stats: stats(fim),    duracaoMs: (fim.at(-1)?.t - fim[0]?.t) || 0 },
    total: {
      ...stats(samples),
      duracaoMs: (samples.at(-1)?.t - samples[0]?.t) || 0,
    },
    metodo: samples.some(s => s.accLong != null) ? 'sinais' : 'fallback-33',
  };
}
