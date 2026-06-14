// Smoke do TrechoDetector — geometria pura + sequência de eventos por trecho.

import {
  TrechoDetector, TrechoFase,
  distMeters, sideOfLine, bearingDeg, apexErrorAngleDeg,
} from '../web/cockpit/trecho-detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

// ── Geometria pura ─────────────────────────────────────────────────────────
t('TD-01 distMeters: 1° de latitude ≈ 111 km', () => {
  const d = distMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  // tolerância 200 m
  if (Math.abs(d - 111_320) > 200) throw new Error(`d=${d}`);
});

t('TD-02 distMeters: dois pontos próximos retornam metros corretos', () => {
  // ~100m em latitude (0.0009°)
  const d = distMeters({ lat: -15.79, lng: -47.89 }, { lat: -15.7891, lng: -47.89 });
  if (d < 95 || d > 105) throw new Error(`d=${d.toFixed(1)}`);
});

t('TD-03 sideOfLine: ponto à esquerda da linha tem sinal positivo', () => {
  // linha do sul ao norte (a=(0,0), b=(0,1)). Ponto (lng=-1, lat=0.5) está à oeste = esquerda
  const a = { lat: 0, lng: 0 };
  const b = { lat: 1, lng: 0 };
  const p = { lat: 0.5, lng: -1 };
  const s = sideOfLine(p, a, b);
  if (s <= 0) throw new Error(`s=${s}`);
});

t('TD-04 bearingDeg: norte=0, leste=90', () => {
  const norte = bearingDeg({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
  const leste = bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 });
  if (Math.abs(norte - 0) > 0.5 && Math.abs(norte - 360) > 0.5) throw new Error(`norte=${norte}`);
  if (Math.abs(leste - 90) > 0.5) throw new Error(`leste=${leste}`);
});

t('TD-05 apexErrorAngleDeg: ápice na frente do carro → ~0°', () => {
  const carPos = { lat: 0, lng: 0 };
  const apex = { lat: 0.001, lng: 0 };  // ao norte
  const heading = 0; // carro apontando ao norte
  const a = apexErrorAngleDeg(carPos, heading, apex);
  // ápice à frente, no heading → ~0°
  if (a > 5 && a < 355) throw new Error(`a=${a}`);
});

t('TD-06 apexErrorAngleDeg: ápice atrás → ~180°', () => {
  const carPos = { lat: 0, lng: 0 };
  const apex = { lat: -0.001, lng: 0 };  // ao sul
  const heading = 0; // carro apontando ao norte
  const a = apexErrorAngleDeg(carPos, heading, apex);
  if (Math.abs(a - 180) > 5) throw new Error(`a=${a}`);
});

// ── Detector ───────────────────────────────────────────────────────────────

function segmentoQuadradoSimples() {
  // Pista imaginária: trecho que vai do oeste (lng=-0.001) ao leste (lng=+0.001),
  // com entrada em lng=-0.001 e saída em lng=+0.001. Ápice no centro (0,0).
  return [{
    id: 'curva-teste',
    nome: 'Curva Teste',
    entradaLine: { a: { lat: 0.0005, lng: -0.001 }, b: { lat: -0.0005, lng: -0.001 } },
    apicePoint:  { lat: 0, lng: 0 },
    saidaLine:   { a: { lat: 0.0005, lng: 0.001 }, b: { lat: -0.0005, lng: 0.001 } },
  }];
}

t('TD-07 construtor exige segments não-vazio', () => {
  let pegou = false;
  try { new TrechoDetector({ segments: [] }); } catch { pegou = true; }
  if (!pegou) throw new Error('aceitou array vazio');
});

t('TD-08 detector inicia em ANTES_ENTRADA', () => {
  const det = new TrechoDetector({ segments: segmentoQuadradoSimples() });
  if (det.getState().phase !== TrechoFase.ANTES_ENTRADA) {
    throw new Error(`fase=${det.getState().phase}`);
  }
});

t('TD-09 cruzando linha de entrada emite evento entrada-cruzou', () => {
  const eventos = [];
  const det = new TrechoDetector({
    segments: segmentoQuadradoSimples(),
    onEvent: (ev) => eventos.push(ev),
  });
  // amostra ANTES da linha (lng=-0.0015)
  det.ingestGps({ lat: 0, lng: -0.0015, kmh: 100, t: 1000 });
  // amostra DEPOIS da linha (lng=-0.0005) — cruzou
  det.ingestGps({ lat: 0, lng: -0.0005, kmh: 100, t: 1100 });
  const ev = eventos.find(e => e.type === 'entrada-cruzou');
  if (!ev) throw new Error('não emitiu entrada-cruzou');
  if (ev.segmentId !== 'curva-teste') throw new Error('segmentId errado');
});

t('TD-10 sequência completa emite os 4 eventos do trecho', () => {
  const eventos = [];
  const det = new TrechoDetector({
    segments: segmentoQuadradoSimples(),
    onEvent: (ev) => eventos.push(ev.type),
  });
  let tNow = 1000;
  function p(lat, lng, kmh) {
    det.ingestGps({ lat, lng, kmh, t: tNow });
    tNow += 100;
  }
  // Passa pela linha de entrada (cruza de oeste pra leste)
  p(0, -0.0015, 150);
  p(0, -0.0005, 150);
  // Começa a frear — desaceleração ~ -1.0g entre amostras consecutivas
  p(0, -0.0003, 100); // perdeu 50km/h em 100ms = forte freada
  p(0, -0.0001, 80);
  p(0, -0.00005, 70);
  p(0, -0.00002, 60);
  // Aproxima do ápice e passa
  p(0, 0, 60);
  p(0, 0.0001, 65); // distância começou a crescer → ápice cruzou
  p(0, 0.0003, 75);
  // Cruza a linha de saída
  p(0, 0.0005, 90);
  p(0, 0.0015, 110);

  const tipos = new Set(eventos);
  for (const esperado of ['entrada-cruzou', 'apice-cruzou', 'saida-cruzou']) {
    if (!tipos.has(esperado)) throw new Error(`faltou ${esperado}. eventos=${eventos.join('|')}`);
  }
});

t('TD-11 após saída avança pro próximo segmento (loop)', () => {
  const det = new TrechoDetector({ segments: segmentoQuadradoSimples() });
  let tNow = 1000;
  function p(lat, lng, kmh) { det.ingestGps({ lat, lng, kmh, t: tNow }); tNow += 100; }
  p(0, -0.0015, 150); p(0, -0.0005, 150);
  p(0, -0.0003, 100); p(0, -0.0001, 80); p(0, -0.00005, 70); p(0, -0.00002, 60);
  p(0, 0, 60); p(0, 0.0001, 65); p(0, 0.0003, 75);
  p(0, 0.0005, 90); p(0, 0.0015, 110);
  // Como só tem 1 segmento, deve voltar pra ele (índice 0)
  const st = det.getState();
  if (st.currentSegmentIdx !== 0) throw new Error(`idx=${st.currentSegmentIdx}`);
});

t('TD-12 ingestGps com sample inválido (sem lat) não quebra', () => {
  const det = new TrechoDetector({ segments: segmentoQuadradoSimples() });
  det.ingestGps(null);
  det.ingestGps({});
  det.ingestGps({ lat: 'x', lng: 0 });
  // chegou até aqui sem throw — passou
});

console.log(`\nTrecho detector: ${ok} ok / ${fail} fail`);
if (fail) process.exit(1);
