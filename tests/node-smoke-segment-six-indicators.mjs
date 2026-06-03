// Smoke Node dos 6 indicadores por trecho (Comando GO 2026-05-24)
// ───────────────────────────────────────────────────────────────
// Prova que o Detector emite vChegada, vFreada, tFreada,
// tempoFreadaApiceMs, tempoApiceSaidaMs no `segmentEnd` e que dispara
// `segmentPostBurst` com vSaidaPico/tSaidaPico após ~2.4 s da saída.

import { Detector } from '../src/telemetry/detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Geometria mínima: pista circular fake. Path 1000 unidades, segmento
// "S" cobre offset 250-500 (25%-50%). Pra evitar imprecisões do snap
// incremental nos cantos, usamos um path único reto com pontos bem
// espaçados — cada consume bate exatamente em um sample do lookup.
const svgPath = 'M 0 0 L 1000 0';
const linhaChegada = { x1: -5, y1: -5, x2: -5, y2: 5 };
const seg = { id: 'S', nome: 'CURVA S', pathStart: 25, pathEnd: 50 };

function passagem({
  vChegada = 60,            // m/s (216 km/h)
  vEntrada = 50,            // m/s
  vApice = 30,              // m/s (108 km/h)
  vSaida = 40,              // m/s
  vSaidaPicoTeorico = 55,   // m/s — pico após sair do segmento
}) {
  const d = new Detector({ svgPath, linhaChegada, segments: [seg] });
  const ends = [];
  const postBursts = [];
  d.onSegmentEnd((ev) => ends.push(ev));
  d.onSegmentPostBurst((ev) => postBursts.push(ev));

  // Pré-segmento: 6 samples no offset 0..240 (0-24%), em 3 s reais.
  const t0 = 10_000;
  let t = t0;
  for (let i = 0; i < 6; i++) {
    const x = i * 40; // 0, 40, 80, 120, 160, 200 → offset 0..200 = 0..20%
    d.consume({ x, y: 0, t, speed: vChegada });
    t += 500;
  }
  // Entrada no segmento (offset 260 = 26%). t ≈ 13000.
  d.consume({ x: 260, y: 0, t, speed: vEntrada });
  t += 200;
  // Freada forte 1 sample depois: dv > 3 dentro do segmento.
  d.consume({ x: 310, y: 0, t, speed: vEntrada - 8 });
  t += 200;
  // Ápice — velocidade mínima
  d.consume({ x: 360, y: 0, t, speed: vApice });
  const tApice = t;
  t += 200;
  // Saindo do segmento — velocidade subindo
  d.consume({ x: 410, y: 0, t, speed: vApice + 5 });
  t += 200;
  // Última amostra dentro (49%)
  d.consume({ x: 490, y: 0, t, speed: vSaida });
  const tSaida = t;
  t += 200;
  // Pós-saída (51% → 100%) — fora de qualquer segmento.
  d.consume({ x: 510, y: 0, t, speed: vSaida + 4 });
  t += 500;
  d.consume({ x: 560, y: 0, t, speed: vSaidaPicoTeorico });
  t += 500;
  d.consume({ x: 610, y: 0, t, speed: vSaidaPicoTeorico - 2 });
  t += 1500;
  // Por aqui já passamos 2.4 s da saída → post-burst flush.
  d.consume({ x: 760, y: 0, t, speed: vSaidaPicoTeorico - 5 });

  return { ends, postBursts, tApice, tSaida };
}

t('vChegada vem do buffer rolling (≈ velocidade ~1.2 s antes da entrada)', () => {
  const { ends } = passagem({ vChegada: 60 });
  if (ends.length !== 1) throw new Error('esperava 1 segmentEnd, veio ' + ends.length);
  const ev = ends[0];
  if (ev.vChegada == null) throw new Error('vChegada veio null');
  if (Math.abs(ev.vChegada - 60) > 0.001) throw new Error('vChegada esperado ~60 m/s, veio ' + ev.vChegada);
});

t('vFreada vem de pontoFrenagem.velPre (sample anterior à freada)', () => {
  const { ends } = passagem({ vEntrada: 50 });
  const ev = ends[0];
  if (ev.vFreada == null) throw new Error('vFreada veio null — freada não detectada');
  // velPre é a velocidade do sample anterior à detecção. Pela
  // sequência: entrada (50) → freou (42), velPre deve ser 50.
  if (Math.abs(ev.vFreada - 50) > 0.001) throw new Error('vFreada esperado ~50, veio ' + ev.vFreada);
  if (ev.tFreada == null) throw new Error('tFreada veio null');
});

t('tempoFreadaApiceMs e tempoApiceSaidaMs são derivados corretamente', () => {
  const { ends } = passagem({});
  const ev = ends[0];
  if (ev.tempoFreadaApiceMs == null) throw new Error('tempoFreadaApiceMs null');
  if (ev.tempoApiceSaidaMs == null) throw new Error('tempoApiceSaidaMs null');
  if (ev.tempoFreadaApiceMs <= 0) throw new Error('tempoFreadaApiceMs <= 0: ' + ev.tempoFreadaApiceMs);
  if (ev.tempoApiceSaidaMs <= 0) throw new Error('tempoApiceSaidaMs <= 0: ' + ev.tempoApiceSaidaMs);
});

t('onSegmentPostBurst emite após ~2.4 s com vSaidaPico = pico observado', () => {
  const { postBursts } = passagem({ vSaidaPicoTeorico: 55 });
  if (postBursts.length < 1) throw new Error('esperava ≥1 postBurst, veio ' + postBursts.length);
  const pb = postBursts[postBursts.length - 1];
  if (pb.vSaidaPico == null) throw new Error('vSaidaPico null');
  if (Math.abs(pb.vSaidaPico - 55) > 0.001) throw new Error('vSaidaPico esperado ~55, veio ' + pb.vSaidaPico);
  if (pb.segmentId !== 'S') throw new Error('segmentId errado: ' + pb.segmentId);
  if (pb.tSaidaPico == null) throw new Error('tSaidaPico null');
});

t('velMinima (Vmin) e apexActual continuam sendo emitidos (não regredimos)', () => {
  const { ends } = passagem({ vApice: 30 });
  const ev = ends[0];
  if (ev.velMinima == null) throw new Error('velMinima null');
  if (Math.abs(ev.velMinima - 30) > 0.001) throw new Error('velMinima esperado ~30, veio ' + ev.velMinima);
  if (!ev.apexActual) throw new Error('apexActual ausente');
  if (typeof ev.apexActual.x !== 'number') throw new Error('apexActual.x não é número');
});

t('Conversão coerente: kmh ≈ m/s * 3.6 (sanity)', () => {
  // Cenário com vSaida baixo (30 m/s) pra que vSaidaPicoTeorico (39.5)
  // seja realmente o pico pós-saída.
  const { ends, postBursts } = passagem({
    vChegada: 43.3,
    vSaida: 30,
    vSaidaPicoTeorico: 39.5,
  });
  const ev = ends[0];
  const pb = postBursts[postBursts.length - 1];
  const vChegadaKmh = ev.vChegada * 3.6;
  const vSaidaPicoKmh = pb.vSaidaPico * 3.6;
  if (Math.abs(vChegadaKmh - 155.88) > 0.5) throw new Error('vChegadaKmh ~155.9 esperado, veio ' + vChegadaKmh);
  if (Math.abs(vSaidaPicoKmh - 142.2) > 0.5) throw new Error('vSaidaPicoKmh ~142.2 esperado, veio ' + vSaidaPicoKmh);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
