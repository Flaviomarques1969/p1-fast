// ═══════════════════════════════════════════════════════════
// seed-tracks — cadastro automático de pistas conhecidas
// ═══════════════════════════════════════════════════════════
// Brasília é a pista principal. Já nasce com:
//   • Track (metadados + path GPS real)
//   • TrackLayout "Principal" (linha de chegada + 4 parciais de tempo)
//   • 8 TrackSegments do tipo CURVA (ehTrecho=true) distribuídos nas 4 parciais
//   • 4 TrackSegments do tipo RETA (ehTrecho=false) como labels geográficos
//
// Parciais são divisões de TEMPO (não distância) da volta de referência.
// Cada trecho é atribuído à parcial cujo intervalo contém seu tempo de passagem.
// Idempotente: detecta pelo apelido.

import { Tracks } from './track.js';
import { TrackLayouts, parciaisIguais } from './track-layout.js';
import { TrackSegments, SegmentTipo } from './track-segment.js';
import { buildLookup, snap } from '../telemetry/path-mapper.js';
import { logger } from '../core/logger.js';

// 2 âncoras de calibração (lat/lng ↔ viewBox x/y) pra MockProvider sintético.
const BRASILIA_GEO_ANCORAS = [
  { lat: -15.77000, lng: -47.90000, x: 410, y: 707 },
  { lat: -15.77180, lng: -47.89800, x: 630, y: 400 },
];

// Linha de chegada calibrada perto do primeiro ponto do path (x=415, y 695-720).
const BRASILIA_LINHA_CHEGADA = { x1: 415, y1: 695, x2: 415, y2: 720 };

// Path SVG calibrado da volta 5 do Flavio (viewBox 823x799) — 171.038s total.
const BRASILIA_PATH = 'M 420.20 707.58 L 242.63 705.75 L 223.63 704.27 L 206.67 699.64 L 190.46 690.06 L 177.44 675.92 L 163.53 640.49 L 173.07 615.32 L 177.09 595.50 L 181.56 552.34 L 189.99 507.41 L 195.17 485.19 L 201.93 462.25 L 207.99 438.19 L 229.60 366.52 L 237.64 341.92 L 252.10 290.03 L 260.17 264.58 L 279.72 194.33 L 291.15 161.70 L 294.72 156.29 L 298.66 150.33 L 311.63 145.96 L 326.58 143.68 L 343.19 148.38 L 358.95 155.60 L 374.08 164.69 L 388.56 176.62 L 401.91 190.62 L 426.33 224.01 L 454.76 257.96 L 469.70 274.35 L 488.13 287.86 L 508.65 299.03 L 530.47 307.88 L 553.93 313.11 L 602.62 318.12 L 625.66 321.92 L 645.47 326.63 L 661.43 333.14 L 674.27 342.65 L 683.96 355.44 L 688.29 370.67 L 686.56 387.23 L 679.94 402.31 L 668.35 415.01 L 653.49 424.27 L 635.14 427.77 L 615.99 423.99 L 599.32 414.02 L 563.03 395.14 L 544.62 386.15 L 524.16 377.79 L 502.83 371.66 L 478.87 368.78 L 455.47 367.00 L 432.13 368.11 L 407.30 371.47 L 382.97 378.12 L 335.78 393.87 L 314.58 402.85 L 295.48 415.65 L 279.26 431.18 L 265.73 450.19 L 255.25 471.55 L 248.52 494.81 L 234.11 513.72 L 238.41 537.37 L 234.92 549.83 L 233.49 560.58 L 237.93 572.18 L 246.95 583.62 L 259.77 593.13 L 276.11 598.40 L 327.75 611.39 L 528.57 671.64 L 542.60 672.98 L 556.32 670.11 L 567.69 660.39 L 574.68 647.16 L 575.82 631.31 L 573.66 615.56 L 566.35 600.49 L 554.99 587.43 L 541.29 575.59 L 513.98 548.01 L 498.16 534.88 L 478.96 526.19 L 458.62 521.37 L 436.90 521.82 L 415.24 527.50 L 373.61 546.75 L 354.89 553.63 L 338.93 557.39 L 324.68 557.18 L 311.28 554.18 L 299.36 546.38 L 289.53 535.43 L 285.49 521.07 L 288.02 505.40 L 296.27 490.63 L 309.55 478.98 L 325.18 470.45 L 342.41 464.46 L 379.49 454.28 L 439.98 435.42 L 461.07 430.16 L 483.11 427.44 L 505.75 428.57 L 528.04 434.62 L 549.64 443.47 L 570.90 453.24 L 591.54 464.27 L 624.25 484.01 L 634.38 492.47 L 640.90 503.88 L 640.91 518.80 L 634.34 534.24 L 624.59 547.53 L 617.04 562.63 L 616.26 580.34 L 620.02 598.86 L 627.99 616.73 L 632.73 634.83 L 632.38 653.04 L 626.28 670.72 L 615.99 687.30 L 600.08 701.09 L 580.92 709.60 L 559.69 712.35 L 492.40 708.43 L 420.77 707.60 Z';

const BRASILIA_LAP_TIME_S = 171.038;

// 8 curvas + 4 retas (geografia). ehTrecho=true só nas curvas.
// Parcial pré-computada a partir do GPS real (lap 5, 4 parciais de tempo igual).
// Cálculo em /Users/imac/Documents/FAMRacing_assets/pistas/brasilia_real.json
// Boundaries t: 0.00 → 42.76 → 85.52 → 128.28 → 171.04s
//
// APEX DEFAULTS — PENDENCIAS_GATE.md P0 (DT 2026-04-26):
//   apexReference, apexStrategy, cornerType, nextStraightLength
//   foram preenchidos com DEFAULTS CONSERVADORES derivados:
//     • apexReference: ponto inicial = (x, y) do trecho (estimativa visual)
//     • apexStrategy: 'tardio' p/ curvas seguidas de reta longa, 'neutro' p/ resto
//     • cornerType: derivado do raio aproximado do path real
//     • nextStraightLength: medido aproximadamente do path SVG
//   Cada trecho leva uma TAG `_apex_calibration` indicando que o valor
//   é DEFAULT — Flavio confirma/move no configurador antes de track day.
const BRASILIA_SEGMENTS = [
  // P1 (0.00 - 42.76s)
  { ordem:  0, nome: 'CURVA 01',              tipo: SegmentTipo.CURVA, parcialId: 'P1', x: 145, y: 645, tNaVolta:  7.6, ehTrecho: true,
    apexReference: { x: 145, y: 645 }, apexStrategy: 'tardio',  cornerType: 'lenta',  nextStraightLength: 280, _apex_calibration: 'DEFAULT' },
  { ordem:  1, nome: 'RETA PRINCIPAL / BOX',  tipo: SegmentTipo.RETA,  parcialId: 'P1', x: 390, y: 630, tNaVolta: 98.0, ehTrecho: false },
  { ordem:  2, nome: 'MERGULHO DA BRUXA',     tipo: SegmentTipo.CURVA, parcialId: 'P1', x: 315, y: 305, tNaVolta: 16.5, ehTrecho: true,
    apexReference: { x: 315, y: 305 }, apexStrategy: 'neutro',  cornerType: 'rapida', nextStraightLength: 80,  _apex_calibration: 'DEFAULT' },
  { ordem:  3, nome: 'CURVA 2',               tipo: SegmentTipo.CURVA, parcialId: 'P1', x: 290, y:  85, tNaVolta: 21.1, ehTrecho: true,
    apexReference: { x: 290, y:  85 }, apexStrategy: 'tardio',  cornerType: 'media',  nextStraightLength: 220, _apex_calibration: 'DEFAULT' },
  // P2 (42.76 - 85.52s)
  { ordem:  4, nome: 'CURVA DA JUNÇÃO',       tipo: SegmentTipo.CURVA, parcialId: 'P2', x: 600, y: 330, tNaVolta: 31.0, ehTrecho: true,
    apexReference: { x: 600, y: 330 }, apexStrategy: 'neutro',  cornerType: 'media',  nextStraightLength: 180, _apex_calibration: 'DEFAULT' },
  { ordem:  5, nome: 'PISCINA',               tipo: SegmentTipo.RETA,  parcialId: 'P2', x: 460, y: 275, tNaVolta: 40.0, ehTrecho: false },
  // P3 (85.52 - 128.28s)
  { ordem:  6, nome: 'CURVA DA BRUXA',        tipo: SegmentTipo.CURVA, parcialId: 'P3', x: 225, y: 570, tNaVolta: 51.8, ehTrecho: true,
    apexReference: { x: 225, y: 570 }, apexStrategy: 'tardio',  cornerType: 'lenta',  nextStraightLength: 380, _apex_calibration: 'DEFAULT' },
  { ordem:  7, nome: 'RETA DO MILITAR',       tipo: SegmentTipo.RETA,  parcialId: 'P3', x: 155, y: 335, tNaVolta: 56.0, ehTrecho: false },
  // P4 (128.28 - 171.04s)
  { ordem:  8, nome: 'CURVA DO PLACAR',       tipo: SegmentTipo.CURVA, parcialId: 'P4', x: 335, y: 475, tNaVolta: 78.6, ehTrecho: true,
    apexReference: { x: 335, y: 475 }, apexStrategy: 'neutro',  cornerType: 'media',  nextStraightLength: 120, _apex_calibration: 'DEFAULT' },
  { ordem:  9, nome: 'CURVA "S"',             tipo: SegmentTipo.CURVA, parcialId: 'P4', x: 630, y: 525, tNaVolta: 89.2, ehTrecho: true,
    apexReference: { x: 630, y: 525 }, apexStrategy: 'duplo',   cornerType: 'rapida', nextStraightLength: 60,  _apex_calibration: 'DEFAULT' },
  { ordem: 10, nome: 'CURVA DA VITÓRIA',      tipo: SegmentTipo.CURVA, parcialId: 'P4', x: 645, y: 650, tNaVolta: 93.5, ehTrecho: true,
    apexReference: { x: 645, y: 650 }, apexStrategy: 'tardio',  cornerType: 'media',  nextStraightLength: 320, _apex_calibration: 'DEFAULT' },
  { ordem: 11, nome: 'RETA OPOSTA',           tipo: SegmentTipo.RETA,  parcialId: 'P4', x: 405, y: 555, tNaVolta: 75.0, ehTrecho: false },
];

// Parciais de Brasília: 4 janelas de tempo igual (25% cada) da volta de referência.
// Nomes descritivos úteis pro box ("Parcial 1 — saída box → Curva 2" etc.)
const BRASILIA_PARCIAIS = [
  { id: 'P1', nome: 'Parcial 1', tStart:   0.00, tEnd:  25.00, apelido: 'Saída do box' },
  { id: 'P2', nome: 'Parcial 2', tStart:  25.00, tEnd:  50.00, apelido: 'Junção'       },
  { id: 'P3', nome: 'Parcial 3', tStart:  50.00, tEnd:  75.00, apelido: 'Bruxa'        },
  { id: 'P4', nome: 'Parcial 4', tStart:  75.00, tEnd: 100.00, apelido: 'Placar → chegada' },
];

/**
 * Calcula pathStart/pathEnd (%) de cada trecho no path SVG.
 * @param {string} svgPath
 * @param {Array}  segments
 * @returns {Array}
 */
export function seedCalcSegmentPct(svgPath, segments) {
  const lookup = buildLookup(svgPath, 2000);
  const total = lookup.totalLength;
  const pcts = segments.map(s => {
    const { offset } = snap(lookup, s.x, s.y);
    return (offset / total) * 100;
  });
  const n = segments.length;
  return segments.map((s, i) => {
    const prev = pcts[(i - 1 + n) % n];
    const cur = pcts[i];
    const next = pcts[(i + 1) % n];
    let startMid = (prev + cur) / 2;
    if (prev > cur) startMid = ((prev + cur + 100) / 2) % 100;
    let endMid = (cur + next) / 2;
    if (cur > next) endMid = ((cur + next + 100) / 2) % 100;
    return {
      ...s,
      pathStart: Math.round(startMid * 100) / 100,
      pathEnd: Math.round(endMid * 100) / 100,
    };
  });
}

/**
 * Cadastra a pista de Brasília se ainda não existir.
 * Idempotente: se já existe (pelo apelido), não recria.
 */
export async function seedBrasilia() {
  const existing = await Tracks.getByApelido('Brasília');
  if (existing) {
    logger.debug('[seed] Brasília já cadastrada', { trackId: existing.id });
    return { track: existing, criado: false };
  }

  const track = await Tracks.create({
    nome: 'Autódromo Internacional Nelson Piquet',
    apelido: 'Brasília',
    pais: 'BR',
    cidade: 'Brasília',
    extensaoMetros: 5476,
    numeroCurvas: 8,
    sentido: 'anti-horário',
    imagemFundo: 'assets/pistas/brasilia.png',
    viewBox: { w: 823, h: 799 },
    svgPath: BRASILIA_PATH,
    lapRefSeg: BRASILIA_LAP_TIME_S,
    gpsRefUrl: 'assets/pistas/brasilia_real.json',
    linhaChegada: BRASILIA_LINHA_CHEGADA,
    geoAncoras: BRASILIA_GEO_ANCORAS,
    trechos: [],
    curvasLabels: [],
  });

  const layout = await TrackLayouts.create({
    trackId: track.id,
    nome: 'Principal',
    linhaChegada: BRASILIA_LINHA_CHEGADA,
    parciais: BRASILIA_PARCIAIS,
  });

  const segments = seedCalcSegmentPct(BRASILIA_PATH, BRASILIA_SEGMENTS).map(s => ({ ...s, layoutId: layout.id }));
  await TrackSegments.bulkCreate(segments);

  logger.info('[seed] Brasília cadastrada', {
    trackId: track.id,
    layoutId: layout.id,
    parciais: layout.parciais.length,
    trechos: segments.filter(s => s.ehTrecho).length,
    retas: segments.filter(s => !s.ehTrecho).length,
  });

  return { track, layout, segmentsCount: segments.length, criado: true };
}

/** Auto-seed na primeira execução. Chamado do main.js no bootstrap. */
export async function seedAllTracks() {
  return {
    brasilia: await seedBrasilia(),
  };
}
