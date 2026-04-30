// ═══════════════════════════════════════════════════════════
// TelemetryTimebase — sincronização multi-fonte (P0)
// ═══════════════════════════════════════════════════════════
// docs/raceops/TELEMETRY_TIMEBASE_SPEC.md (Engenheiro-Chefe 2026-04-26):
// única autoridade pra "qual é o estado do carro no instante T?".
// Consome amostras de N providers (iPhone, RaceBox, T4000, mock),
// alinha por tMono (ADR-015), produz CarTelemetrySnapshot por instante.
//
// Antes deste módulo: cada provider escrevia no sampleStore independente,
// análises consumiam de UMA fonte só. Snapshots multi-fonte ficavam
// inconsistentes (RPM de 50ms atrás, GPS de 200ms atrás, IMU de 10ms).
//
// Não-objetivos:
//   • NÃO persiste — estado em memória. Amostras brutas continuam
//     em sampleStore (ADR-014).
//   • NÃO inventa valor. Canais sem amostra na janela viram null + MISSING.
//   • NÃO é insight. Snapshot é DADO consolidado; análise consome.

import { logger } from '../core/logger.js';
import { buildSnapshot } from './snapshot.js';
import { Quality, isOk } from '../domain/data-quality.js';

/** Buffer máximo por fonte — amostras mais antigas que isso são descartadas (FIFO). */
const BUFFER_MAX_AGE_MS = 10_000;

/** Janela móvel de latência (mediana das últimas K amostras). */
const LATENCY_WINDOW = 32;

/**
 * Política de freshness por fonte (em ms).
 * Após esse intervalo sem amostra nova, signalQuality vai pra DEGRADED;
 * após 3× freshness consecutivos, vira LOST.
 *
 * Valores derivados de TELEMETRY_TIMEBASE_SPEC.md §"Política de freshness".
 */
export const DEFAULT_FRESHNESS_MS = Object.freeze({
  'cockpit-mobile': 1500,   // GPS iPhone @ 1Hz
  'device':         1500,   // alias legado
  'iphone-imu':     200,    // CoreMotion @ 50-100Hz
  'racebox-gnss':   100,    // RaceBox GNSS @ 25Hz
  'racebox-imu':    50,     // RaceBox IMU @ 100Hz
  't4000':          50,     // T4000 CAN @ 100Hz
  'mock':           500,
});

/**
 * Source — wrapper por fonte com buffer e estatísticas.
 * Uma instância por provider attached.
 */
class Source {
  constructor({ source, expectedRateHz = 10, freshness = 500, channels = [] }) {
    this.source = source;
    this.expectedRateHz = expectedRateHz;
    this.freshness = freshness;
    this.channels = channels;
    /** @type {Array} amostras (recentes no fim) */
    this.buffer = [];
    /** mediana das últimas LATENCY_WINDOW latências, ms */
    this.latencyMedian = 0;
    /** stddev dos intervalos entre amostras consecutivas */
    this.jitter = 0;
    /** última amostra recebida (cache rápido) */
    this.lastSample = null;
    /** contador de amostras descartadas por OUT_OF_ORDER, DUPLICATE */
    this.discardedOutOfOrder = 0;
    this.discardedDuplicate = 0;
    /** janela de latências */
    this._latencies = [];
    /** janela de intervalos entre amostras */
    this._intervals = [];
  }

  ingest(sample) {
    const tMono = sample.tMono ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const tFonte = sample.t ?? tMono;

    // 1. Detectar fora de ordem / duplicado
    if (this.lastSample) {
      const lastT = this.lastSample.tMono;
      if (tMono < lastT) {
        this.discardedOutOfOrder++;
        const annotated = { ...sample, _quality: Quality.OUT_OF_ORDER };
        this._insertSorted(annotated);
        logger.debug('[timebase] out of order', { source: this.source, tMono, lastT });
        return { quality: Quality.OUT_OF_ORDER, accepted: true };
      }
      if (tMono === lastT) {
        this.discardedDuplicate++;
        return { quality: Quality.DUPLICATE, accepted: false };
      }
      // Atualiza jitter
      const interval = tMono - lastT;
      this._intervals.push(interval);
      if (this._intervals.length > LATENCY_WINDOW) this._intervals.shift();
      this.jitter = stddev(this._intervals);
    }

    // 2. Estimar latência (se houver tFonte ≠ tMono)
    if (Number.isFinite(tFonte) && Number.isFinite(tMono) && tFonte > 0 && tMono > 0) {
      const lat = Math.max(0, tMono - tFonte);
      this._latencies.push(lat);
      if (this._latencies.length > LATENCY_WINDOW) this._latencies.shift();
      this.latencyMedian = median(this._latencies);
    }

    const quality = sample._quality || sample.signalQuality || Quality.OK;
    const annotated = { ...sample, tMono, _quality: quality };
    this.buffer.push(annotated);
    this.lastSample = annotated;

    // 3. Garbage collect amostras antigas
    const cutoff = tMono - BUFFER_MAX_AGE_MS;
    while (this.buffer.length > 1 && this.buffer[0].tMono < cutoff) {
      this.buffer.shift();
    }

    return { quality, accepted: true };
  }

  _insertSorted(sample) {
    // Insere mantendo ordem cronológica (busca linear pelo fim — quase sempre próximo)
    let i = this.buffer.length - 1;
    while (i >= 0 && this.buffer[i].tMono > sample.tMono) i--;
    this.buffer.splice(i + 1, 0, sample);
  }

  /** Retorna amostra mais próxima de tMono, dentro de freshness. */
  nearest(tMono) {
    if (!this.buffer.length) return null;
    let best = null;
    let bestDelta = Infinity;
    // Busca linear do fim (otimização — snapshots normalmente pedem "agora")
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const s = this.buffer[i];
      const delta = Math.abs(s.tMono - tMono);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = s;
      }
      if (s.tMono < tMono - this.freshness) break;
    }
    return { sample: best, delta: bestDelta };
  }

  /** Status agregado da fonte. */
  status(now) {
    const last = this.lastSample;
    if (!last) {
      return { source: this.source, expectedRateHz: this.expectedRateHz, lastSampleAt: null, ratePerSec: 0, quality: Quality.MISSING, drift: 0, latencyEst: 0 };
    }
    const ageMs = now - last.tMono;
    let quality = last._quality || Quality.OK;
    if (ageMs > this.freshness * 3) quality = Quality.MISSING;
    else if (ageMs > this.freshness) quality = Quality.LATE;

    const intervalMean = this._intervals.length ? this._intervals.reduce((a, b) => a + b, 0) / this._intervals.length : 0;
    const ratePerSec = intervalMean > 0 ? 1000 / intervalMean : 0;

    return {
      source: this.source,
      expectedRateHz: this.expectedRateHz,
      lastSampleAt: last.tMono,
      ageMs,
      ratePerSec,
      quality,
      jitter: this.jitter,
      latencyEst: this.latencyMedian,
      bufferSize: this.buffer.length,
      discardedOutOfOrder: this.discardedOutOfOrder,
      discardedDuplicate: this.discardedDuplicate,
    };
  }
}

export class TelemetryTimebase {
  constructor({ snapshotBuilder = buildSnapshot } = {}) {
    /** @type {Map<string, Source>} */
    this.sources = new Map();
    this._buildSnapshot = snapshotBuilder;
    this._tickers = new Map();   // rateHz -> { interval, callbacks }
  }

  /** Registra uma fonte. Chamado uma vez por provider. */
  attachSource({ source, expectedRateHz = 10, freshness, channels = [] }) {
    if (!source) throw new Error('attachSource requer source');
    if (this.sources.has(source)) {
      logger.warn('[timebase] re-attaching source', { source });
    }
    const fresh = freshness != null ? freshness : (DEFAULT_FRESHNESS_MS[source] ?? 500);
    this.sources.set(source, new Source({ source, expectedRateHz, freshness: fresh, channels }));
    logger.info('[timebase] source attached', { source, expectedRateHz, freshness: fresh, channels: channels.length });
  }

  detachSource(source) {
    this.sources.delete(source);
    logger.info('[timebase] source detached', { source });
  }

  /** Ingere uma amostra de qualquer provider. */
  ingest(sample) {
    if (!sample || !sample.source) {
      logger.warn('[timebase] sample sem source descartado');
      return null;
    }
    let src = this.sources.get(sample.source);
    if (!src) {
      // Auto-attach com defaults — provider que não declarou-se ainda
      this.attachSource({ source: sample.source });
      src = this.sources.get(sample.source);
    }
    return src.ingest(sample);
  }

  /** Snapshot consolidado em um instante. */
  snapshotAt(tMono) {
    const sourcesData = {};
    for (const [name, src] of this.sources) {
      const found = src.nearest(tMono);
      if (!found || !found.sample) {
        sourcesData[name] = { sample: null, quality: Quality.MISSING, ageMs: null };
        continue;
      }
      const { sample, delta } = found;
      let quality = sample._quality || Quality.OK;
      if (delta > src.freshness * 3) quality = Quality.MISSING;
      else if (delta > src.freshness) quality = Quality.LATE;
      else if (!isOk(quality)) quality = sample._quality;
      sourcesData[name] = { sample, quality, ageMs: delta };
    }
    return this._buildSnapshot({ tMono, sourcesData });
  }

  /** Snapshot "agora". */
  snapshotNow() {
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    return this.snapshotAt(now);
  }

  /** Subscreve em ticks consolidados (taxa do consumidor). */
  onTick(rateHz, callback) {
    if (!Number.isFinite(rateHz) || rateHz <= 0) throw new Error('rateHz inválido');
    if (typeof callback !== 'function') throw new Error('callback obrigatório');
    let entry = this._tickers.get(rateHz);
    if (!entry) {
      entry = { callbacks: new Set(), interval: null };
      const periodMs = 1000 / rateHz;
      entry.interval = setInterval(() => {
        const snap = this.snapshotNow();
        for (const cb of entry.callbacks) {
          try { cb(snap); } catch (e) { logger.error('[timebase] tick callback', { err: String(e) }); }
        }
      }, periodMs);
      this._tickers.set(rateHz, entry);
    }
    entry.callbacks.add(callback);
    return () => {
      entry.callbacks.delete(callback);
      if (entry.callbacks.size === 0) {
        clearInterval(entry.interval);
        this._tickers.delete(rateHz);
      }
    };
  }

  /** Status de cada fonte. */
  sourceStatus() {
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    const out = {};
    for (const [name, src] of this.sources) {
      out[name] = src.status(now);
    }
    return out;
  }

  /** Limpa estado (útil em testes). */
  reset() {
    for (const entry of this._tickers.values()) clearInterval(entry.interval);
    this._tickers.clear();
    this.sources.clear();
  }
}

// ─── Helpers numéricos ───────────────────────────────────────

function median(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Singleton padrão — caller pode criar instâncias próprias se preferir. */
export const timebase = new TelemetryTimebase();
