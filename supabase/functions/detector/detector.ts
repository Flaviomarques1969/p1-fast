// ═══════════════════════════════════════════════════════════
// Detector (Deno port) — volta + parcial + segmento
// ═══════════════════════════════════════════════════════════
// Transcrição direta de src/telemetry/detector.js, sem o `logger`
// (Edge Function loga via console.error). Mantém paridade de
// comportamento — ver smoke `detector_test.ts`.
//
// Uso esperado (ver index.ts):
//   const det = new Detector({ svgPath, linhaChegada, segments });
//   det.onLap(ev => laps.push(ev));
//   det.onSegmentEnd(ev => ses.push(ev));
//   for (const s of samples) det.consume(s);

import { buildLookup, snap, segmentsIntersect, type Point, type PathLookup } from "./path-mapper.ts";

export interface DetectorSample {
  x?: number | null;
  y?: number | null;
  t: number;
  tMono?: number | null;
  speed?: number | null;
}

export interface LinhaChegada {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TrackSegmentInput {
  id: string;
  pathStart?: number | null; // % do path total (0..100)
  pathEnd?: number | null;
  parcialId?: string | null;
}

export interface BrakingPoint {
  offset: number;
  t: number;
  velPre: number;
}

export interface DetectorLapEvent {
  numero: number;
  inicioAt: number;
  fimAt: number;
  tempoMs: number;
  temposPorParcial: Record<string, number>;
  temposPorTrecho: Record<string, number>;
}

export interface DetectorSegmentStartEvent {
  segmentId: string;
  lapNumero?: number;
  entradaAt: number;
  velEntrada: number | null;
  offset: number;
}

export interface DetectorSegmentEndEvent {
  segmentId: string;
  lapNumero?: number;
  entradaAt: number;
  saidaAt: number;
  tempoMs: number;
  velEntrada: number | null;
  velMinima: number | null;
  velSaida: number | null;
  pontoFrenagem: BrakingPoint | null;
  apexT: number | null;
  apexOffset: number | null;
  apexActual: Point | null;
}

interface VoltaAtual {
  numero: number;
  inicioAt: number;
  inicioAtMono: number;
  temposPorParcial: Record<string, number>;
  temposPorTrecho: Record<string, number>;
}

interface UltimoPonto {
  x: number;
  y: number;
  t: number;
  tMono: number | null;
  speed: number | null;
  offset: number;
}

interface SegmentoAtual {
  segmentId: string;
  entradaAt: number;
  velEntrada: number | null;
  velMinima: number | null;
  pontoFrenagem: BrakingPoint | null;
  apexT: number | null;
  apexOffset: number | null;
  apexActual: Point | null;
}

export interface DetectorConfig {
  svgPath: string;
  linhaChegada: LinhaChegada;
  segments?: TrackSegmentInput[];
  snapMaxDist?: number;
}

type LapHandler = (ev: DetectorLapEvent) => void;
type SegStartHandler = (ev: DetectorSegmentStartEvent) => void;
type SegEndHandler = (ev: DetectorSegmentEndEvent) => void;

export class Detector {
  private lookup: PathLookup;
  private linhaChegada: LinhaChegada;
  private segments: TrackSegmentInput[];
  private snapMaxDist: number;

  private lapListeners = new Set<LapHandler>();
  private segStartListeners = new Set<SegStartHandler>();
  private segEndListeners = new Set<SegEndHandler>();

  lapCount = 0;
  private voltaAtual: VoltaAtual | null = null;
  private ultimoPonto: UltimoPonto | null = null;
  private segmentoAtual: SegmentoAtual | null = null;
  private parcialTimestamps: Record<string, number> = {};
  private currentParcial: string | null = null;

  constructor(cfg: DetectorConfig) {
    this.lookup = buildLookup(cfg.svgPath, 2000);
    this.linhaChegada = cfg.linhaChegada;
    this.segments = cfg.segments ?? [];
    this.snapMaxDist = cfg.snapMaxDist ?? 80;
  }

  onLap(cb: LapHandler): () => void {
    this.lapListeners.add(cb);
    return () => this.lapListeners.delete(cb);
  }

  onSegmentStart(cb: SegStartHandler): () => void {
    this.segStartListeners.add(cb);
    return () => this.segStartListeners.delete(cb);
  }

  onSegmentEnd(cb: SegEndHandler): () => void {
    this.segEndListeners.add(cb);
    return () => this.segEndListeners.delete(cb);
  }

  consume(sample: DetectorSample): void {
    if (sample.x == null || sample.y == null) return;
    const snapped = snap(this.lookup, sample.x, sample.y);
    if (snapped.dist > this.snapMaxDist) return;

    const point: UltimoPonto = {
      x: sample.x,
      y: sample.y,
      t: sample.t,
      tMono: sample.tMono ?? null,
      speed: sample.speed ?? null,
      offset: snapped.offset,
    };

    if (this.ultimoPonto && this.linhaChegada) {
      const lc = this.linhaChegada;
      const cruzou = segmentsIntersect(
        { x: this.ultimoPonto.x, y: this.ultimoPonto.y },
        { x: point.x, y: point.y },
        { x: lc.x1, y: lc.y1 },
        { x: lc.x2, y: lc.y2 },
      );
      if (cruzou) this.onLineCross(point);
    }

    this.updateSegment(point);
    this.ultimoPonto = point;
  }

  stats(): { lapCount: number; currentParcial: string | null; segmentoAtualId: string | null } {
    return {
      lapCount: this.lapCount,
      currentParcial: this.currentParcial,
      segmentoAtualId: this.segmentoAtual?.segmentId ?? null,
    };
  }

  private emitLap(ev: DetectorLapEvent): void {
    for (const cb of this.lapListeners) {
      try { cb(ev); } catch (err) { console.error("[detector] lap listener falhou", err); }
    }
  }

  private emitSegStart(ev: DetectorSegmentStartEvent): void {
    for (const cb of this.segStartListeners) {
      try { cb(ev); } catch (err) { console.error("[detector] segStart listener falhou", err); }
    }
  }

  private emitSegEnd(ev: DetectorSegmentEndEvent): void {
    for (const cb of this.segEndListeners) {
      try { cb(ev); } catch (err) { console.error("[detector] segEnd listener falhou", err); }
    }
  }

  private onLineCross(point: UltimoPonto): void {
    const tRef = point.tMono ?? point.t;
    this.lapCount++;
    if (this.voltaAtual) {
      if (this.currentParcial && this.parcialTimestamps[this.currentParcial] != null) {
        const dur = tRef - this.parcialTimestamps[this.currentParcial];
        this.voltaAtual.temposPorParcial[this.currentParcial] = dur;
      }
      const lap: DetectorLapEvent = {
        numero: this.voltaAtual.numero,
        inicioAt: this.voltaAtual.inicioAt,
        fimAt: point.t,
        tempoMs: tRef - this.voltaAtual.inicioAtMono,
        temposPorParcial: { ...this.voltaAtual.temposPorParcial },
        temposPorTrecho: { ...this.voltaAtual.temposPorTrecho },
      };
      this.emitLap(lap);
    }
    this.voltaAtual = {
      numero: this.lapCount,
      inicioAt: point.t,
      inicioAtMono: tRef,
      temposPorParcial: {},
      temposPorTrecho: {},
    };
    this.parcialTimestamps = {};
    this.currentParcial = null;
  }

  private onParcialChange(parcialNova: string, tRef: number): void {
    if (this.currentParcial && this.parcialTimestamps[this.currentParcial] != null && this.voltaAtual) {
      const dur = tRef - this.parcialTimestamps[this.currentParcial];
      this.voltaAtual.temposPorParcial[this.currentParcial] = dur;
    }
    this.parcialTimestamps[parcialNova] = tRef;
    this.currentParcial = parcialNova;
  }

  private updateSegment(point: UltimoPonto): void {
    if (this.segments.length === 0) return;
    const pctOffset = (point.offset / this.lookup.totalLength) * 100;
    const found = this.segments.find((s) =>
      s.pathStart != null &&
      s.pathEnd != null &&
      pctOffset >= s.pathStart &&
      pctOffset < s.pathEnd
    );

    if (found?.parcialId && found.parcialId !== this.currentParcial) {
      const tRef = point.tMono ?? point.t;
      this.onParcialChange(found.parcialId, tRef);
    }

    const fecharSegmentoAtual = (saidaPoint: UltimoPonto) => {
      if (!this.segmentoAtual) return;
      const se: DetectorSegmentEndEvent = {
        segmentId: this.segmentoAtual.segmentId,
        lapNumero: this.voltaAtual?.numero,
        entradaAt: this.segmentoAtual.entradaAt,
        saidaAt: saidaPoint.t,
        tempoMs: saidaPoint.t - this.segmentoAtual.entradaAt,
        velEntrada: this.segmentoAtual.velEntrada,
        velMinima: this.segmentoAtual.velMinima,
        velSaida: this.ultimoPonto?.speed ?? null,
        pontoFrenagem: this.segmentoAtual.pontoFrenagem,
        apexT: this.segmentoAtual.apexT,
        apexOffset: this.segmentoAtual.apexOffset,
        apexActual: this.segmentoAtual.apexActual,
      };
      if (this.voltaAtual) {
        this.voltaAtual.temposPorTrecho[this.segmentoAtual.segmentId] = se.tempoMs;
      }
      this.emitSegEnd(se);
    };

    if (found && (!this.segmentoAtual || this.segmentoAtual.segmentId !== found.id)) {
      if (this.segmentoAtual) fecharSegmentoAtual(point);
      this.segmentoAtual = {
        segmentId: found.id,
        entradaAt: point.t,
        velEntrada: point.speed,
        velMinima: point.speed,
        pontoFrenagem: null,
        apexT: point.t,
        apexOffset: point.offset,
        apexActual: { x: point.x, y: point.y },
      };
      this.emitSegStart({
        segmentId: found.id,
        lapNumero: this.voltaAtual?.numero,
        entradaAt: point.t,
        velEntrada: point.speed,
        offset: point.offset,
      });
    } else if (!found && this.segmentoAtual) {
      fecharSegmentoAtual(point);
      this.segmentoAtual = null;
    } else if (this.segmentoAtual) {
      if (point.speed != null && this.segmentoAtual.velMinima != null) {
        if (point.speed < this.segmentoAtual.velMinima) {
          this.segmentoAtual.velMinima = point.speed;
          this.segmentoAtual.apexT = point.t;
          this.segmentoAtual.apexOffset = point.offset;
          this.segmentoAtual.apexActual = { x: point.x, y: point.y };
        }
      }
      if (this.ultimoPonto && point.speed != null && this.ultimoPonto.speed != null) {
        const dv = this.ultimoPonto.speed - point.speed;
        const dt = (point.t - this.ultimoPonto.t) / 1000;
        if (dv > 3 && dt > 0 && !this.segmentoAtual.pontoFrenagem) {
          this.segmentoAtual.pontoFrenagem = {
            offset: point.offset,
            t: point.t,
            velPre: this.ultimoPonto.speed,
          };
        }
      }
    }
  }
}
