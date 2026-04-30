// ═══════════════════════════════════════════════════════════
// TrajectoryMonitor — desvio em metros vs volta de referência
// ═══════════════════════════════════════════════════════════
// Fecha o loop de avaliação das lições L001 (Referência Fixa) e
// L007 (Curva Cega) do P1 Coach. Recebe a sequência de samples
// de UM trecho (curva) + a sequência da MESMA curva na volta de
// referência, e devolve um relatório com:
//
//   • brakingPointDeviationM  — desvio do ponto de freio (m)
//   • turnInPointDeviationM   — desvio do ponto de giro (m)
//   • throttlePointDeviationM — desvio do ponto de tração (m)
//   • entryDeviationM         — desvio da posição na entrada (m)
//   • apexDeviationM          — desvio da posição no apex (m)
//
// Detecção:
//   • freio   = primeira amostra com accLong < BRAKE_G_THRESHOLD
//               OU (sem IMU) primeira queda sustentada de kmh
//   • giro    = primeira amostra com |gyroAlpha| > YAW_THRESHOLD
//               OU mudança de course além de COURSE_DELTA
//   • tração  = primeira amostra após apex com accLong > THROTTLE_G_THRESHOLD
//
// Distância em metros: prefere `track.geoAncoras` (cálculo geográfico
// puro). Se ausentes, usa fallback via lat/lng → metros (haversine
// aproximado para áreas pequenas <5km — autódromo).
//
// Módulo é PURO: não toca DB, não toca DOM, não usa Dexie. Recebe
// tudo por parâmetro. O caller (cockpit/UI) carrega refSamples.

import { Confidence } from './lesson-schema.js';

// ── Limiares (mesmas constantes de fase-curva.js, mantidos em sincronia) ──
const BRAKE_G_THRESHOLD     = -0.20;   // accLong abaixo disso = frenagem
const THROTTLE_G_THRESHOLD  = +0.15;   // accLong acima disso = aceleração
const YAW_THRESHOLD_DEG_S   = 15;      // gyroAlpha acima disso = giro
const COURSE_DELTA_DEG      = 6;       // delta de course entre samples consecutivos
const KMH_DROP_PER_SEC      = 8;       // fallback sem IMU: queda de kmh/s
const MIN_SAMPLES           = 4;       // abaixo disso, monitor desiste
const M_PER_DEG_LAT         = 111000;

// ─── Conversão geográfica ───────────────────────────────────

/**
 * Distância em metros entre dois pontos lat/lng (aproximação plana,
 * válida para distâncias < 5km — escala de autódromo).
 */
export function distanceMetersGeo(a, b) {
  if (a == null || b == null) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return null;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;
  const dLat = (b.lat - a.lat) * M_PER_DEG_LAT;
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const dLng = (b.lng - a.lng) * M_PER_DEG_LAT * cosLat;
  return Math.hypot(dLat, dLng);
}

// ─── Detecção de eventos no stream do trecho ────────────────

/**
 * Retorna o índice da PRIMEIRA amostra em que o piloto começou a frear.
 * Estratégia híbrida (espelha fase-curva.js detectarCortes):
 *  1. Se houver accLong: primeiro com accLong < BRAKE_G_THRESHOLD
 *  2. Senão (fallback): primeira amostra onde dKmh/dt < -KMH_DROP_PER_SEC
 *      por pelo menos 2 amostras consecutivas (anti-spike).
 * Retorna -1 se nada bater.
 */
export function findBrakingIndex(samples) {
  if (!samples || samples.length < MIN_SAMPLES) return -1;
  const temAcc = samples.some(s => Number.isFinite(s.accLong));
  if (temAcc) {
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i].accLong;
      if (Number.isFinite(a) && a < BRAKE_G_THRESHOLD) return i;
    }
    return -1;
  }
  // Fallback sem IMU
  let consecutivos = 0;
  for (let i = 1; i < samples.length; i++) {
    const k0 = samples[i - 1].kmh, k1 = samples[i].kmh;
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (k0 == null || k1 == null || dt <= 0) { consecutivos = 0; continue; }
    const queda = (k0 - k1) / dt;          // km/h por segundo
    if (queda > KMH_DROP_PER_SEC) {
      consecutivos++;
      if (consecutivos >= 2) return i - 1;
    } else {
      consecutivos = 0;
    }
  }
  return -1;
}

/**
 * Retorna o índice da primeira amostra em que o piloto começou a girar
 * (turn-in). Híbrido: gyroAlpha (preferido) ou delta de course.
 */
export function findTurnInIndex(samples) {
  if (!samples || samples.length < MIN_SAMPLES) return -1;
  const temGyro = samples.some(s => Number.isFinite(s.gyroAlpha));
  if (temGyro) {
    for (let i = 0; i < samples.length; i++) {
      const g = samples[i].gyroAlpha;
      if (Number.isFinite(g) && Math.abs(g) > YAW_THRESHOLD_DEG_S) return i;
    }
    return -1;
  }
  // Fallback via course
  for (let i = 1; i < samples.length; i++) {
    const c0 = samples[i - 1].course, c1 = samples[i].course;
    if (c0 == null || c1 == null) continue;
    let d = Math.abs(c1 - c0);
    if (d > 180) d = 360 - d;             // wrap
    if (d > COURSE_DELTA_DEG) return i;
  }
  return -1;
}

/**
 * Retorna o índice da primeira amostra após o apex em que o piloto
 * voltou a acelerar de forma clara.
 *
 * @param {Array} samples
 * @param {number} apexIdx — índice do apex (velocidade mínima); -1 desativa
 */
export function findThrottleIndex(samples, apexIdx) {
  if (!samples || samples.length < MIN_SAMPLES) return -1;
  const start = apexIdx >= 0 ? apexIdx : 0;
  for (let i = start; i < samples.length; i++) {
    const a = samples[i].accLong;
    if (Number.isFinite(a) && a > THROTTLE_G_THRESHOLD) return i;
  }
  return -1;
}

/**
 * Encontra o apex (velocidade mínima) — espelha fase-curva.js.
 */
export function findApexIndex(samples) {
  if (!samples || samples.length < MIN_SAMPLES) return -1;
  let best = -1, vMin = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const k = samples[i].kmh;
    if (Number.isFinite(k) && k < vMin) { vMin = k; best = i; }
  }
  return best;
}

// ─── Avaliação de um trecho ────────────────────────────────

/**
 * @typedef {Object} TrajectoryReport
 * @property {boolean} disponivel
 * @property {string|null} razao              motivo se !disponivel
 * @property {number|null} brakingPointDeviationM
 * @property {number|null} turnInPointDeviationM
 * @property {number|null} throttlePointDeviationM
 * @property {number|null} entryDeviationM
 * @property {number|null} apexDeviationM
 * @property {string} confidence              alta|media|baixa
 * @property {object} debug                   índices encontrados
 */

/**
 * Avalia um trecho contra a referência. Cada métrica é calculada de
 * forma independente — uma falha de detecção (ex: sem accLong na ref)
 * não invalida as outras.
 *
 * @param {object} args
 * @param {Array}  args.samples       amostras do trecho na volta atual
 * @param {Array}  args.refSamples    amostras do MESMO trecho na volta-ref
 * @returns {TrajectoryReport}
 */
export function evaluateSegmentTrajectory({ samples, refSamples } = {}) {
  const empty = (razao) => ({
    disponivel: false, razao,
    brakingPointDeviationM: null, turnInPointDeviationM: null,
    throttlePointDeviationM: null, entryDeviationM: null, apexDeviationM: null,
    confidence: Confidence.BAIXA,
    debug: {},
  });
  if (!samples?.length || samples.length < MIN_SAMPLES) return empty('sem-amostras-atuais');
  if (!refSamples?.length || refSamples.length < MIN_SAMPLES) return empty('sem-amostras-referencia');

  const apexIdx = findApexIndex(samples);
  const refApexIdx = findApexIndex(refSamples);

  const brakingIdx = findBrakingIndex(samples);
  const refBrakingIdx = findBrakingIndex(refSamples);

  const turnInIdx = findTurnInIndex(samples);
  const refTurnInIdx = findTurnInIndex(refSamples);

  const throttleIdx = findThrottleIndex(samples, apexIdx);
  const refThrottleIdx = findThrottleIndex(refSamples, refApexIdx);

  const safeDist = (idxA, arrA, idxB, arrB) => {
    if (idxA < 0 || idxB < 0) return null;
    return distanceMetersGeo(arrA[idxA], arrB[idxB]);
  };

  // Confidence:
  //   ALTA  — todos os 3 eventos críticos detectados em ambos
  //   MEDIA — pelo menos 2 detectados
  //   BAIXA — só apex/entry (geometria pura)
  const detectados = [brakingIdx, refBrakingIdx, turnInIdx, refTurnInIdx,
                      throttleIdx, refThrottleIdx].filter(i => i >= 0).length;
  const confidence = detectados >= 5 ? Confidence.ALTA
                   : detectados >= 3 ? Confidence.MEDIA
                   : Confidence.BAIXA;

  return {
    disponivel: true,
    razao: null,
    brakingPointDeviationM:  safeDist(brakingIdx, samples, refBrakingIdx, refSamples),
    turnInPointDeviationM:   safeDist(turnInIdx, samples, refTurnInIdx, refSamples),
    throttlePointDeviationM: safeDist(throttleIdx, samples, refThrottleIdx, refSamples),
    entryDeviationM:         distanceMetersGeo(samples[0], refSamples[0]),
    apexDeviationM:          safeDist(apexIdx, samples, refApexIdx, refSamples),
    confidence,
    debug: {
      apexIdx, refApexIdx,
      brakingIdx, refBrakingIdx,
      turnInIdx, refTurnInIdx,
      throttleIdx, refThrottleIdx,
    },
  };
}

// ─── Avaliação de successCriteria de uma lição ─────────────

/**
 * Avalia se o piloto cumpriu o successCriteria de L001 (Referência
 * Fixa) — desvio do ponto de freio < toleranciaM em N de M voltas.
 *
 * @param {Array<TrajectoryReport>} reports — uma por volta recente
 * @param {object} cfg
 * @param {number} [cfg.toleranciaM=8]       — desvio aceito
 * @param {number} [cfg.exigidasN=3]
 * @param {number} [cfg.janelaM=4]
 * @returns {{cumpriu: boolean, hits: number, total: number, mediaM: number|null}}
 */
export function evaluateReferenciaFixa(reports, cfg = {}) {
  const toleranciaM = cfg.toleranciaM ?? 8;
  const exigidasN   = cfg.exigidasN ?? 3;
  const janelaM     = cfg.janelaM ?? 4;
  const ultimas = reports.slice(-janelaM);
  let hits = 0, soma = 0, com = 0;
  for (const r of ultimas) {
    const d = r?.brakingPointDeviationM;
    if (d == null) continue;
    com++;
    soma += d;
    if (d < toleranciaM) hits++;
  }
  return {
    cumpriu: hits >= exigidasN,
    hits, total: ultimas.length,
    mediaM: com > 0 ? Math.round((soma / com) * 10) / 10 : null,
  };
}

/**
 * L007 (Curva Cega) — desvio da entrada < toleranciaM nas voltas-ref.
 */
export function evaluateCurvaCega(reports, cfg = {}) {
  const toleranciaM = cfg.toleranciaM ?? 5;
  const exigidasN   = cfg.exigidasN ?? 2;
  const janelaM     = cfg.janelaM ?? 3;
  const ultimas = reports.slice(-janelaM);
  let hits = 0, soma = 0, com = 0;
  for (const r of ultimas) {
    const d = r?.entryDeviationM;
    if (d == null) continue;
    com++;
    soma += d;
    if (d < toleranciaM) hits++;
  }
  return {
    cumpriu: hits >= exigidasN,
    hits, total: ultimas.length,
    mediaM: com > 0 ? Math.round((soma / com) * 10) / 10 : null,
  };
}

// ─── Wrapper de instância (para o caller manter histórico) ─

/**
 * TrajectoryMonitor — instância que mantém histórico por trecho e
 * acumula relatórios. Usar uma instância por sessão de aprendizado.
 */
export class TrajectoryMonitor {
  constructor() {
    /** @type {Map<string, TrajectoryReport[]>} segmentId → reports */
    this.bySegment = new Map();
  }

  /**
   * Registra a finalização de um trecho. O caller deve chamar isso
   * em onSegmentEnd, com os samples acumulados do trecho atual.
   *
   * @returns {TrajectoryReport}
   */
  recordSegment({ segmentId, samples, refSamples } = {}) {
    if (!segmentId) throw new Error('recordSegment: segmentId obrigatório');
    const report = evaluateSegmentTrajectory({ samples, refSamples });
    const arr = this.bySegment.get(segmentId) ?? [];
    arr.push(report);
    this.bySegment.set(segmentId, arr);
    return report;
  }

  /** Histórico de relatórios de um trecho (mais recente por último). */
  getHistory(segmentId) {
    return this.bySegment.get(segmentId)?.slice() ?? [];
  }

  /** Avalia successCriteria da lição contra o histórico do trecho. */
  evaluateLesson({ lessonId, segmentId, cfg = {} } = {}) {
    const reports = this.getHistory(segmentId);
    if (lessonId === 'L001-referencia-fixa') return evaluateReferenciaFixa(reports, cfg);
    if (lessonId === 'L007-curva-cega')      return evaluateCurvaCega(reports, cfg);
    return { cumpriu: false, hits: 0, total: reports.length, mediaM: null,
             razao: 'lesson-sem-avaliador' };
  }

  reset() { this.bySegment.clear(); }
}
