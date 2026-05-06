// ═══════════════════════════════════════════════════════════
// Smoke E2E do detector Edge Function (PLANO_FASE_1.md MS-3.2)
// ═══════════════════════════════════════════════════════════
// Roda direto no Deno (sem Edge Runtime) chamando `runDetector`
// puro. Fixture sintética: pista retangular 1000×500, linha de
// chegada vertical em x=200 cortando a aresta superior, 1
// segment "curva-1" cobrindo 30..50% do path. Stream de samples
// dá 2 voltas no sentido horário, mergulhando velocidade dentro
// do segment pra exercitar velMinima/apexActual.
//
// Como rodar (na raiz do repo):
//   deno test --allow-net=deno.land supabase/functions/detector/detector_test.ts
//
// Independente da Edge Runtime: `runDetector` vive em pipeline.ts
// e não toca Supabase. O endpoint (index.ts) só adiciona auth +
// JSON I/O em volta.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runDetector } from "./pipeline.ts";
import type { DetectorSample, LinhaChegada, TrackSegmentInput } from "./detector.ts";

// Pista: retângulo 1000×500. Sentido horário começando em (0,0).
const PATH = "M 0 0 L 1000 0 L 1000 500 L 0 500 Z";

// Linha de chegada vertical cortando a aresta de cima em x=200.
const LINHA: LinhaChegada = { x1: 200, y1: -30, x2: 200, y2: 30 };

// Perímetro = 1000+500+1000+500 = 3000.
// Aresta de cima vai de offset 0 a 1000.
// Curva-1 ocupa offsets 900..1100 ⇒ 30%..36.67%.
const SEGMENTS: TrackSegmentInput[] = [
  { id: "curva-1", pathStart: 30, pathEnd: 36.67, parcialId: "P1" },
];

/**
 * Gera samples em sentido horário no perímetro do retângulo.
 * Velocidade base = 50 m/s, mergulha pra 12 m/s no apex (offset 1000)
 * pra exercitar a detecção de velMinima dentro do segment.
 */
function geraVoltasSamples(numVoltas: number, samplesPorVolta: number, t0: number): DetectorSample[] {
  const out: DetectorSample[] = [];
  const perim = 3000;
  let t = t0;
  for (let v = 0; v < numVoltas; v++) {
    for (let i = 0; i < samplesPorVolta; i++) {
      const offset = (i / samplesPorVolta) * perim;
      let x: number, y: number;
      if (offset < 1000)             { x = offset; y = 0; }
      else if (offset < 1500)        { x = 1000; y = offset - 1000; }
      else if (offset < 2500)        { x = 1000 - (offset - 1500); y = 500; }
      else                           { x = 0; y = 500 - (offset - 2500); }
      // velocidade: 50 normal, mergulha em torno do offset 1000 (apex sintético).
      const dist = Math.abs(offset - 1000);
      const speed = dist < 100 ? 12 + (dist / 100) * 38 : 50;
      out.push({ x, y, t, tMono: t, speed });
      t += 100; // 10 Hz
    }
  }
  // Sample final pra fechar a 2ª volta cruzando linha de novo.
  out.push({ x: 250, y: 0, t, tMono: t, speed: 50 });
  return out;
}

Deno.test("DET-01: 2 voltas detectadas com tempos > 0", () => {
  const samples = geraVoltasSamples(2, 60, 0);
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: SEGMENTS,
    samples,
  });
  assertEquals(r.stats.samplesIn, samples.length);
  // 2 voltas completas = 2 fechamentos. A primeira cruzada apenas inicia voltaAtual,
  // só fecha lap quando há voltaAtual ativa — então 2 voltas completas = 2 emit lap
  // a partir da 3ª cruzada. Aqui esperamos 2.
  assertEquals(r.laps.length, 2, `lapCount esperado 2, recebido ${r.laps.length}`);
  for (const lap of r.laps) {
    assert(lap.tempoMs > 0, "tempoMs > 0");
    assert(lap.numero >= 1, "numero >= 1");
  }
});

Deno.test("DET-02: segment curva-1 detectado com velMinima ≈ 12 m/s", () => {
  const samples = geraVoltasSamples(2, 120, 0);
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: SEGMENTS,
    samples,
  });
  assert(r.segments.length >= 2, `esperado >= 2 segments fechados, recebido ${r.segments.length}`);
  for (const s of r.segments) {
    assertEquals(s.segmentId, "curva-1");
    assert(s.velMinima != null, "velMinima setado");
    assert(s.velMinima! < 20, `velMinima ${s.velMinima} esperada < 20 m/s (apex sintético em 12)`);
    assert(s.apexActual != null, "apexActual setado");
  }
});

Deno.test("DET-03: temposPorTrecho preenchido na lap completa", () => {
  const samples = geraVoltasSamples(2, 120, 0);
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: SEGMENTS,
    samples,
  });
  assert(r.laps.length >= 1, "pelo menos 1 lap fechado");
  const tt = r.laps[0].temposPorTrecho;
  assert(tt["curva-1"] != null && tt["curva-1"]! > 0, "tempoTrecho curva-1 > 0");
});

Deno.test("DET-04: sem segments, lap ainda detecta", () => {
  const samples = geraVoltasSamples(2, 60, 0);
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: [],
    samples,
  });
  assertEquals(r.laps.length, 2);
  assertEquals(r.segments.length, 0);
});

Deno.test("DET-05: samples sem x/y são ignorados sem quebrar", () => {
  const baseline = geraVoltasSamples(1, 60, 0);
  const comNulos: DetectorSample[] = [
    { x: null, y: null, t: -200, tMono: -200, speed: 0 },
    { x: 0, y: 0, t: -100, tMono: -100, speed: 0 },
    ...baseline,
  ];
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: SEGMENTS,
    samples: comNulos,
  });
  assert(r.stats.samplesIn === comNulos.length, "samplesIn conta TODOS os recebidos");
  // Nulos não geram lap espúrio. 1 volta sintética = 1 lap ou 0 (depende do
  // cruzamento do start). O importante é não quebrar.
  assert(r.laps.length <= 1);
});

Deno.test("DET-06: snap fora da pista descarta sample (snapMaxDist)", () => {
  const fora: DetectorSample[] = [
    { x: 9999, y: 9999, t: 0, tMono: 0, speed: 50 },
    { x: 9999, y: 8000, t: 100, tMono: 100, speed: 50 },
  ];
  const r = runDetector({
    svgPath: PATH,
    linhaChegada: LINHA,
    segments: SEGMENTS,
    samples: fora,
    snapMaxDist: 80,
  });
  assertEquals(r.laps.length, 0);
  assertEquals(r.segments.length, 0);
});
