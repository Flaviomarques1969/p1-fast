// ═══════════════════════════════════════════════════════════
// detector pipeline puro — entrada deno test
// ═══════════════════════════════════════════════════════════
// Vive separado de `index.ts` (Edge Function) pra que o smoke E2E
// possa importar sem precisar puxar a runtime do Supabase
// (supabase-js → @types/node etc.).

import {
  Detector,
  type DetectorLapEvent,
  type DetectorSample,
  type DetectorSegmentEndEvent,
  type LinhaChegada,
  type TrackSegmentInput,
} from "./detector.ts";

export interface DetectorBody {
  svgPath: string;
  linhaChegada: LinhaChegada;
  segments?: TrackSegmentInput[];
  samples: DetectorSample[];
  snapMaxDist?: number;
}

export interface DetectorResponse {
  laps: DetectorLapEvent[];
  segments: DetectorSegmentEndEvent[];
  stats: {
    samplesIn: number;
    lapCount: number;
    segmentCount: number;
  };
}

export function runDetector(body: DetectorBody): DetectorResponse {
  const det = new Detector({
    svgPath: body.svgPath,
    linhaChegada: body.linhaChegada,
    segments: body.segments ?? [],
    snapMaxDist: body.snapMaxDist ?? 80,
  });
  const laps: DetectorLapEvent[] = [];
  const segments: DetectorSegmentEndEvent[] = [];
  det.onLap((ev) => laps.push(ev));
  det.onSegmentEnd((ev) => segments.push(ev));
  for (const s of body.samples) det.consume(s);
  return {
    laps,
    segments,
    stats: {
      samplesIn: body.samples.length,
      lapCount: laps.length,
      segmentCount: segments.length,
    },
  };
}

// deno-lint-ignore no-explicit-any
export function validateBody(b: any): { ok: true; body: DetectorBody } | { ok: false; reason: string } {
  if (typeof b !== "object" || b === null) return { ok: false, reason: "body-invalid" };
  if (typeof b.svgPath !== "string" || b.svgPath.length === 0) return { ok: false, reason: "svgPath-required" };
  if (typeof b.linhaChegada !== "object" || b.linhaChegada === null) return { ok: false, reason: "linhaChegada-required" };
  for (const k of ["x1", "y1", "x2", "y2"]) {
    if (typeof b.linhaChegada[k] !== "number") return { ok: false, reason: `linhaChegada.${k}-must-be-number` };
  }
  if (b.segments != null && !Array.isArray(b.segments)) return { ok: false, reason: "segments-must-be-array" };
  if (!Array.isArray(b.samples)) return { ok: false, reason: "samples-must-be-array" };
  return { ok: true, body: b as DetectorBody };
}
