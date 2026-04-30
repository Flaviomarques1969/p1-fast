// Smoke do TrajectoryMonitor — fecha o loop de avaliação de L001/L007.

import {
  distanceMetersGeo,
  findApexIndex,
  findBrakingIndex,
  findTurnInIndex,
  findThrottleIndex,
  evaluateSegmentTrajectory,
  evaluateReferenciaFixa,
  evaluateCurvaCega,
  TrajectoryMonitor,
} from '../src/domain/trajectory-monitor.js';
import { Confidence } from '../src/domain/lesson-schema.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ── Fixtures ────────────────────────────────────────────────
// Pista no equador → 1° lat ≈ 111km, 1° lng ≈ 111km. Origem Brasília.
const ORIG = { lat: -15.7800, lng: -47.9200 };

/** Constrói amostra; lat/lng deslocados em metros. */
function s({ tMs, dxM = 0, dyM = 0, kmh = 100, accLong = null, gyroAlpha = null, course = null }) {
  const cosLat = Math.cos((ORIG.lat * Math.PI) / 180);
  return {
    t: tMs,
    lat: ORIG.lat + dyM / 111000,
    lng: ORIG.lng + dxM / (111000 * cosLat),
    kmh, accLong, gyroAlpha, course,
  };
}

/** Volta de referência sintética: 12 amostras passando por uma curva. */
function refSamples() {
  return [
    s({ tMs:   0, dyM: -100, kmh: 130, accLong:  0.0,  gyroAlpha: 0,  course: 0 }),
    s({ tMs: 100, dyM:  -80, kmh: 130, accLong:  0.0,  gyroAlpha: 0,  course: 0 }),
    s({ tMs: 200, dyM:  -60, kmh: 125, accLong: -0.3,  gyroAlpha: 0,  course: 0 }),  // freio
    s({ tMs: 300, dyM:  -40, kmh: 110, accLong: -0.5,  gyroAlpha: 5,  course: 5 }),
    s({ tMs: 400, dyM:  -20, kmh:  90, accLong: -0.4,  gyroAlpha: 30, course: 20 }), // giro
    s({ tMs: 500, dyM:   -5, kmh:  72, accLong: -0.1,  gyroAlpha: 35, course: 50 }),
    s({ tMs: 600, dxM:    5, kmh:  68, accLong:  0.0,  gyroAlpha: 30, course: 80 }), // apex
    s({ tMs: 700, dxM:   20, kmh:  72, accLong:  0.2,  gyroAlpha: 20, course:110 }), // tração
    s({ tMs: 800, dxM:   45, kmh:  85, accLong:  0.3,  gyroAlpha: 10, course:135 }),
    s({ tMs: 900, dxM:   75, kmh: 100, accLong:  0.3,  gyroAlpha:  3, course:155 }),
    s({ tMs:1000, dxM:  110, kmh: 115, accLong:  0.2,  gyroAlpha:  0, course:170 }),
    s({ tMs:1100, dxM:  150, kmh: 125, accLong:  0.1,  gyroAlpha:  0, course:175 }),
  ];
}

// ── Distância geográfica ────────────────────────────────────
t('distanceMetersGeo: 1m horizontal ≈ 1m', () => {
  const a = { lat: ORIG.lat, lng: ORIG.lng };
  const cosLat = Math.cos((ORIG.lat * Math.PI) / 180);
  const b = { lat: ORIG.lat, lng: ORIG.lng + 1 / (111000 * cosLat) };
  const d = distanceMetersGeo(a, b);
  if (Math.abs(d - 1) > 0.05) throw new Error(`d=${d}`);
});

t('distanceMetersGeo: nulo se faltar coord', () => {
  if (distanceMetersGeo(null, null) !== null) throw new Error('null,null');
  if (distanceMetersGeo({ lat: 1 }, { lat: 1, lng: 1 }) !== null) throw new Error('sem lng');
});

// ── Detecção de eventos ─────────────────────────────────────
t('findApexIndex: aponta velocidade mínima', () => {
  const arr = refSamples();
  const i = findApexIndex(arr);
  if (arr[i].kmh !== 68) throw new Error(`apex idx=${i} kmh=${arr[i].kmh}`);
});

t('findBrakingIndex: aponta primeira amostra com accLong < -0.20', () => {
  const arr = refSamples();
  const i = findBrakingIndex(arr);
  if (i !== 2) throw new Error(`braking idx=${i}`);
});

t('findBrakingIndex: fallback sem IMU usa queda de kmh', () => {
  const arr = refSamples().map(x => ({ ...x, accLong: null }));
  const i = findBrakingIndex(arr);
  if (i < 1 || i > 4) throw new Error(`braking fallback idx=${i}`);
});

t('findTurnInIndex: aponta primeira amostra com |gyroAlpha| > 15', () => {
  const arr = refSamples();
  const i = findTurnInIndex(arr);
  if (i !== 4) throw new Error(`turnIn idx=${i}`);
});

t('findTurnInIndex: fallback via course', () => {
  const arr = refSamples().map(x => ({ ...x, gyroAlpha: null }));
  const i = findTurnInIndex(arr);
  if (i < 3 || i > 6) throw new Error(`turnIn fallback idx=${i}`);
});

t('findThrottleIndex: primeira após apex com accLong > 0.15', () => {
  const arr = refSamples();
  const apex = findApexIndex(arr);
  const i = findThrottleIndex(arr, apex);
  if (i !== 7) throw new Error(`throttle idx=${i}`);
});

// ── Avaliação completa de trecho ────────────────────────────
t('evaluateSegmentTrajectory: ref vs ref → desvios ≈ 0', () => {
  const ref = refSamples();
  const r = evaluateSegmentTrajectory({ samples: ref, refSamples: ref });
  if (!r.disponivel) throw new Error(r.razao);
  for (const k of ['brakingPointDeviationM', 'turnInPointDeviationM',
                    'throttlePointDeviationM', 'entryDeviationM', 'apexDeviationM']) {
    if (r[k] == null || r[k] > 0.5) throw new Error(`${k} = ${r[k]}`);
  }
  if (r.confidence !== Confidence.ALTA) throw new Error(`confidence=${r.confidence}`);
});

t('evaluateSegmentTrajectory: piloto 12m mais tarde no freio gera desvio coerente', () => {
  const ref = refSamples();
  // Volta atual: piloto continua acelerando 1 amostra a mais antes de frear
  const cur = ref.map((x, i) => {
    if (i === 2) return { ...x, accLong: 0.0, kmh: 130 };  // não freia ainda
    return { ...x };
  });
  const r = evaluateSegmentTrajectory({ samples: cur, refSamples: ref });
  if (!r.disponivel) throw new Error('indisponivel');
  // Piloto freou 1 amostra depois — desvio ~20m (entre dyM=-60 e dyM=-40)
  const d = r.brakingPointDeviationM;
  if (d == null || d < 5 || d > 40) throw new Error(`brakingDev fora de faixa: ${d}`);
});

t('evaluateSegmentTrajectory: poucas amostras → indisponivel', () => {
  const r = evaluateSegmentTrajectory({ samples: [], refSamples: refSamples() });
  if (r.disponivel) throw new Error('deveria estar indisponivel');
  if (r.razao !== 'sem-amostras-atuais') throw new Error(`razao=${r.razao}`);
});

t('evaluateSegmentTrajectory: sem refSamples → indisponivel', () => {
  const r = evaluateSegmentTrajectory({ samples: refSamples(), refSamples: null });
  if (r.disponivel) throw new Error('deveria estar indisponivel');
  if (r.razao !== 'sem-amostras-referencia') throw new Error(`razao=${r.razao}`);
});

t('evaluateSegmentTrajectory: confidence cai sem IMU em ambos', () => {
  const semImu = refSamples().map(x => ({ ...x, accLong: null, gyroAlpha: null }));
  const r = evaluateSegmentTrajectory({ samples: semImu, refSamples: semImu });
  // Sem accLong: braking via fallback ainda funciona; sem gyro: turnIn via course
  // throttle exige accLong → -1, então 4 detectados → MEDIA
  if (r.confidence === Confidence.ALTA) throw new Error('não deveria ser ALTA sem IMU');
});

// ── successCriteria ─────────────────────────────────────────
t('evaluateReferenciaFixa: 3 voltas com desvio < 8m → cumpriu', () => {
  const reports = [
    { brakingPointDeviationM: 5 },
    { brakingPointDeviationM: 7 },
    { brakingPointDeviationM: 4 },
  ];
  const r = evaluateReferenciaFixa(reports);
  if (!r.cumpriu) throw new Error('deveria cumprir');
  if (r.hits !== 3) throw new Error(`hits=${r.hits}`);
  if (r.mediaM == null || Math.abs(r.mediaM - 5.3) > 0.1) throw new Error(`media=${r.mediaM}`);
});

t('evaluateReferenciaFixa: 3 voltas com desvio > 8m → não cumpriu', () => {
  const reports = [
    { brakingPointDeviationM: 10 },
    { brakingPointDeviationM: 12 },
    { brakingPointDeviationM: 15 },
  ];
  const r = evaluateReferenciaFixa(reports);
  if (r.cumpriu) throw new Error('não deveria cumprir');
  if (r.hits !== 0) throw new Error(`hits=${r.hits}`);
});

t('evaluateReferenciaFixa: ignora reports sem desvio', () => {
  const reports = [
    { brakingPointDeviationM: 5 },
    { brakingPointDeviationM: null },
    { brakingPointDeviationM: 6 },
    { brakingPointDeviationM: 4 },
  ];
  const r = evaluateReferenciaFixa(reports);
  if (!r.cumpriu) throw new Error('3 hits válidos deveriam cumprir');
});

t('evaluateCurvaCega: 2 de 3 voltas com desvio < 5m → cumpriu', () => {
  const reports = [
    { entryDeviationM: 3 },
    { entryDeviationM: 8 },
    { entryDeviationM: 4 },
  ];
  const r = evaluateCurvaCega(reports);
  if (!r.cumpriu) throw new Error('deveria cumprir');
});

// ── Instância: histórico por trecho ────────────────────────
t('TrajectoryMonitor: recordSegment acumula histórico', () => {
  const m = new TrajectoryMonitor();
  const ref = refSamples();
  m.recordSegment({ segmentId: 'curva-1', samples: ref, refSamples: ref });
  m.recordSegment({ segmentId: 'curva-1', samples: ref, refSamples: ref });
  m.recordSegment({ segmentId: 'curva-2', samples: ref, refSamples: ref });
  if (m.getHistory('curva-1').length !== 2) throw new Error('hist curva-1 != 2');
  if (m.getHistory('curva-2').length !== 1) throw new Error('hist curva-2 != 1');
  if (m.getHistory('curva-X').length !== 0) throw new Error('curva-X não-vazia');
});

t('TrajectoryMonitor.evaluateLesson: roteia para o avaliador certo', () => {
  const m = new TrajectoryMonitor();
  const ref = refSamples();
  for (let i = 0; i < 4; i++) {
    m.recordSegment({ segmentId: 'c1', samples: ref, refSamples: ref });
  }
  const ev = m.evaluateLesson({ lessonId: 'L001-referencia-fixa', segmentId: 'c1' });
  if (!ev.cumpriu) throw new Error('L001 ref-vs-ref deveria cumprir');
  const evCega = m.evaluateLesson({ lessonId: 'L007-curva-cega', segmentId: 'c1' });
  if (!evCega.cumpriu) throw new Error('L007 ref-vs-ref deveria cumprir');
  const evDesconhecida = m.evaluateLesson({ lessonId: 'L999-fake', segmentId: 'c1' });
  if (evDesconhecida.cumpriu) throw new Error('lição desconhecida não cumpre');
  if (evDesconhecida.razao !== 'lesson-sem-avaliador') throw new Error('razao errada');
});

t('TrajectoryMonitor.reset() esvazia tudo', () => {
  const m = new TrajectoryMonitor();
  m.recordSegment({ segmentId: 'c1', samples: refSamples(), refSamples: refSamples() });
  m.reset();
  if (m.getHistory('c1').length !== 0) throw new Error('reset falhou');
});

console.log(`\n═══ TOTAL: ${ok} ok / ${fail} fail ═══`);
if (fail > 0) process.exit(1);
