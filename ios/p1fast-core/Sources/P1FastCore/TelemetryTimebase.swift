// ═══════════════════════════════════════════════════════════
// TelemetryTimebase — porte Swift de src/telemetry/timebase.js
// ═══════════════════════════════════════════════════════════
// MS-16.1 (Command Box Engenharia — Camada 1 Engine Core).
// docs/COMMAND_BOX_ENGENHARIA.md §1.1 e §5.1.
// docs/telemetry/TELEMETRY_TIMEBASE_SPEC.md (Engenheiro-Chefe 2026-04-26).
//
// Sincronização multi-fonte: consome amostras de N providers, alinha por
// tMono (ADR-015), produz Snapshot consolidado em qualquer instante T.
// Acopla com SnapshotBuilder (Snapshot.swift) já portado.
//
// Não-objetivos:
//   • NÃO persiste (estado em memória; rows brutas continuam em SQLite — ADR-014).
//   • NÃO inventa valor (canais sem amostra na janela → MISSING).
//   • NÃO é insight (snapshot é DADO consolidado; análise consome).
//
// Paridade exata com timebase.js:
//   • DEFAULT_FRESHNESS_MS por fonte (cockpit-mobile=1500, iphone-imu=200,
//     racebox-gnss=100, racebox-imu=50, t4000=50, mock=500, device=1500).
//   • LATENCY_WINDOW = 32 (mediana de latência + stddev de intervalos).
//   • BUFFER_MAX_AGE_MS = 10_000 (GC FIFO).
//   • Detecção OUT_OF_ORDER (tMono retroativo): aceita, marca, insere sorted.
//   • Detecção DUPLICATE (tMono igual): descarta, accepted=false.
//   • Sinal LATE: idade > freshness e ≤ 3×freshness.
//   • Sinal MISSING: idade > 3×freshness.

import Foundation

/// Política default de freshness por fonte (ms).
/// Paridade JS timebase.DEFAULT_FRESHNESS_MS.
public let TIMEBASE_DEFAULT_FRESHNESS_MS: [String: Double] = [
    SourceTags.gps:        1500,   // cockpit-mobile (GPS iPhone @ 1Hz)
    "device":              1500,   // alias legado
    SourceTags.imu:         200,   // iphone-imu (CoreMotion 50-100Hz)
    SourceTags.racebox:     100,   // racebox-gnss (25Hz)
    SourceTags.raceboxImu:   50,   // racebox-imu (100Hz)
    SourceTags.t4000:        50,   // t4000 CAN (~100Hz)
    SourceTags.mock:        500,
]

public let TIMEBASE_BUFFER_MAX_AGE_MS: Double = 10_000
public let TIMEBASE_LATENCY_WINDOW: Int = 32

public struct TimebaseIngestResult: Sendable, Equatable {
    public let quality: Quality
    public let accepted: Bool

    public init(quality: Quality, accepted: Bool) {
        self.quality = quality
        self.accepted = accepted
    }
}

public struct TimebaseSourceStats: Sendable, Equatable {
    public let source: String
    public let expectedRateHz: Double
    public let lastSampleTMono: Double?
    public let ageMs: Double
    public let ratePerSec: Double
    public let quality: Quality
    public let jitter: Double
    public let latencyMedianMs: Double
    public let bufferSize: Int
    public let discardedOutOfOrder: Int
    public let discardedDuplicate: Int

    public init(
        source: String,
        expectedRateHz: Double,
        lastSampleTMono: Double?,
        ageMs: Double,
        ratePerSec: Double,
        quality: Quality,
        jitter: Double,
        latencyMedianMs: Double,
        bufferSize: Int,
        discardedOutOfOrder: Int,
        discardedDuplicate: Int
    ) {
        self.source = source
        self.expectedRateHz = expectedRateHz
        self.lastSampleTMono = lastSampleTMono
        self.ageMs = ageMs
        self.ratePerSec = ratePerSec
        self.quality = quality
        self.jitter = jitter
        self.latencyMedianMs = latencyMedianMs
        self.bufferSize = bufferSize
        self.discardedOutOfOrder = discardedOutOfOrder
        self.discardedDuplicate = discardedDuplicate
    }
}

public typealias TimebaseStats = [String: TimebaseSourceStats]

/// Wrapper interno por fonte com buffer + estatísticas. Equivalente
/// à classe `Source` em timebase.js.
private final class TimebaseSource {
    let source: String
    let expectedRateHz: Double
    let freshness: Double
    let channels: [String]

    /// Buffer cronológico (recentes no fim). Cada item carrega a Quality
    /// associada (.outOfOrder em entradas atrasadas; .ok / signalQuality-
    /// derived no fluxo normal).
    var buffer: [(sample: Sample, quality: Quality, tMono: Double)] = []
    var latencyMedian: Double = 0
    var jitter: Double = 0
    var lastSample: (sample: Sample, quality: Quality, tMono: Double)?
    var discardedOutOfOrder: Int = 0
    var discardedDuplicate: Int = 0
    var latencies: [Double] = []
    var intervals: [Double] = []

    init(source: String, expectedRateHz: Double, freshness: Double, channels: [String]) {
        self.source = source
        self.expectedRateHz = expectedRateHz
        self.freshness = freshness
        self.channels = channels
    }

    func ingest(_ sample: Sample) -> TimebaseIngestResult {
        let tMono = sample.tMono
        let tFonte = Double(sample.t)

        // 1. OUT_OF_ORDER / DUPLICATE
        if let last = lastSample {
            let lastT = last.tMono
            if tMono < lastT {
                discardedOutOfOrder += 1
                let entry = (sample: sample, quality: Quality.outOfOrder, tMono: tMono)
                insertSorted(entry)
                return TimebaseIngestResult(quality: .outOfOrder, accepted: true)
            }
            if tMono == lastT {
                discardedDuplicate += 1
                return TimebaseIngestResult(quality: .duplicate, accepted: false)
            }
            // Atualiza jitter
            let interval = tMono - lastT
            intervals.append(interval)
            if intervals.count > TIMEBASE_LATENCY_WINDOW { intervals.removeFirst() }
            jitter = stddev(intervals)
        }

        // 2. Latência (mediana móvel — só faz sentido quando t é timestamp da fonte)
        if tFonte.isFinite && tMono.isFinite && tFonte > 0 && tMono > 0 {
            let lat = max(0, tMono - tFonte)
            latencies.append(lat)
            if latencies.count > TIMEBASE_LATENCY_WINDOW { latencies.removeFirst() }
            latencyMedian = median(latencies)
        }

        // 3. Quality derivada do sample (signalQuality + GPS accuracy)
        let quality = sample.quality
        let entry = (sample: sample, quality: quality, tMono: tMono)
        buffer.append(entry)
        lastSample = entry

        // 4. GC — descarta amostras muito antigas
        let cutoff = tMono - TIMEBASE_BUFFER_MAX_AGE_MS
        while buffer.count > 1 && buffer[0].tMono < cutoff {
            buffer.removeFirst()
        }

        return TimebaseIngestResult(quality: quality, accepted: true)
    }

    private func insertSorted(_ entry: (sample: Sample, quality: Quality, tMono: Double)) {
        var i = buffer.count - 1
        while i >= 0 && buffer[i].tMono > entry.tMono { i -= 1 }
        buffer.insert(entry, at: i + 1)
    }

    func nearest(_ tMono: Double) -> (sample: Sample, quality: Quality, delta: Double)? {
        guard !buffer.isEmpty else { return nil }
        var bestIdx = -1
        var bestDelta = Double.infinity
        // Busca linear do fim — snapshots normalmente pedem "agora".
        for i in stride(from: buffer.count - 1, through: 0, by: -1) {
            let entry = buffer[i]
            let delta = abs(entry.tMono - tMono)
            if delta < bestDelta {
                bestDelta = delta
                bestIdx = i
            }
            if entry.tMono < tMono - freshness { break }
        }
        guard bestIdx >= 0 else { return nil }
        let best = buffer[bestIdx]
        return (best.sample, best.quality, bestDelta)
    }

    func stats(now: Double) -> TimebaseSourceStats {
        guard let last = lastSample else {
            return TimebaseSourceStats(
                source: source,
                expectedRateHz: expectedRateHz,
                lastSampleTMono: nil,
                ageMs: 0,
                ratePerSec: 0,
                quality: .missing,
                jitter: 0,
                latencyMedianMs: 0,
                bufferSize: 0,
                discardedOutOfOrder: 0,
                discardedDuplicate: 0
            )
        }
        let ageMs = now - last.tMono
        var quality = last.quality
        if ageMs > freshness * 3 { quality = .missing }
        else if ageMs > freshness { quality = .late }

        let intervalMean = intervals.isEmpty ? 0 : intervals.reduce(0, +) / Double(intervals.count)
        let ratePerSec = intervalMean > 0 ? 1000 / intervalMean : 0

        return TimebaseSourceStats(
            source: source,
            expectedRateHz: expectedRateHz,
            lastSampleTMono: last.tMono,
            ageMs: ageMs,
            ratePerSec: ratePerSec,
            quality: quality,
            jitter: jitter,
            latencyMedianMs: latencyMedian,
            bufferSize: buffer.count,
            discardedOutOfOrder: discardedOutOfOrder,
            discardedDuplicate: discardedDuplicate
        )
    }
}

/// Sincroniza N fontes de telemetria por tMono e produz Snapshots.
/// Paridade JS `class TelemetryTimebase`.
public final class TelemetryTimebase {
    public typealias SnapshotBuilderFn = (Double, [String: SourcePacket]) -> Snapshot

    private var sources: [String: TimebaseSource] = [:]
    private let nowProvider: () -> Double
    private let snapshotBuilder: SnapshotBuilderFn

    public init(
        now: @escaping () -> Double = { Clock.nowMono },
        snapshotBuilder: SnapshotBuilderFn? = nil
    ) {
        self.nowProvider = now
        self.snapshotBuilder = snapshotBuilder ?? { tMono, data in
            SnapshotBuilder.build(tMono: tMono, sourcesData: data)
        }
    }

    /// Registra uma fonte. Chamado uma vez por provider. Re-attach permitido
    /// (reseta o buffer da fonte). Retorna `true` se foi novo attach.
    @discardableResult
    public func attachSource(
        source: String,
        expectedRateHz: Double = 10,
        freshnessMs: Double? = nil,
        channels: [String] = []
    ) -> Bool {
        let fresh = freshnessMs ?? (TIMEBASE_DEFAULT_FRESHNESS_MS[source] ?? 500)
        let isNew = sources[source] == nil
        sources[source] = TimebaseSource(
            source: source,
            expectedRateHz: expectedRateHz,
            freshness: fresh,
            channels: channels
        )
        return isNew
    }

    public func detachSource(_ source: String) {
        sources.removeValue(forKey: source)
    }

    /// Ingere uma amostra de qualquer provider. Auto-attach com defaults
    /// se a fonte não foi registrada ainda — paridade JS.
    @discardableResult
    public func ingest(_ sample: Sample) -> TimebaseIngestResult? {
        if sample.source.isEmpty { return nil }
        if sources[sample.source] == nil {
            attachSource(source: sample.source)
        }
        return sources[sample.source]?.ingest(sample)
    }

    /// Snapshot consolidado em um instante T.
    /// Canais sem amostra → omitidos de `sourcesData` (equivalente a
    /// `sample: nil` em JS — SnapshotBuilder lida com ausência via .missing).
    public func snapshotAt(tMono: Double) -> Snapshot {
        var sourcesData: [String: SourcePacket] = [:]
        for (name, src) in sources {
            guard let near = src.nearest(tMono) else { continue }
            var quality = near.quality
            if near.delta > src.freshness * 3 { quality = .missing }
            else if near.delta > src.freshness { quality = .late }
            sourcesData[name] = SourcePacket(
                sample: near.sample,
                quality: quality,
                ageMs: near.delta
            )
        }
        return snapshotBuilder(tMono, sourcesData)
    }

    /// Snapshot no "agora" (via injetor de clock).
    public func snapshotNow() -> Snapshot {
        return snapshotAt(tMono: nowProvider())
    }

    /// Status agregado por fonte.
    public func stats() -> TimebaseStats {
        let n = nowProvider()
        var out: TimebaseStats = [:]
        for (name, src) in sources {
            out[name] = src.stats(now: n)
        }
        return out
    }

    /// Limpa estado — útil em testes.
    public func reset() {
        sources.removeAll()
    }

    /// Quantidade de fontes registradas.
    public var sourceCount: Int { sources.count }
}

// ─── Helpers numéricos ──────────────────────────────────────

private func median(_ arr: [Double]) -> Double {
    if arr.isEmpty { return 0 }
    let sorted = arr.sorted()
    let mid = sorted.count >> 1
    if sorted.count % 2 == 0 {
        return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
}

private func stddev(_ arr: [Double]) -> Double {
    if arr.count < 2 { return 0 }
    let mean = arr.reduce(0, +) / Double(arr.count)
    let variance = arr.reduce(0.0) { acc, v in acc + (v - mean) * (v - mean) } / Double(arr.count)
    return sqrt(variance)
}
