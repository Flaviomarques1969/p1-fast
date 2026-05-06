// ═══════════════════════════════════════════════════════════
// EnrichedTelemetryWriter — persiste EnrichedSample em batch
// ═══════════════════════════════════════════════════════════
// Saída do KalmanINSGPS (PR A) gravada em telemetry_samples_enriched
// (PR B). Append-only ADR-014. Lógica pura, sem CoreMotion — caller
// (LiveKalmanProcessor em p1fast-ios) envolve em Task pra não bloquear
// main thread.

import Foundation
import GRDB

public enum EnrichedTelemetryWriter {

    /// Anexa um lote de EnrichedSample para uma sessão. Sequência dos
    /// seq vem do caller (LiveKalmanProcessor mantém contador, paralelo
    /// ao TelemetryWriter). Retorna quantas linhas foram inseridas.
    @discardableResult
    public static func appendBatch(
        queue: DatabaseQueue,
        sessaoId: String,
        timeId: String,
        samples: [EnrichedSample],
        startSeq: Int
    ) throws -> Int {
        guard !samples.isEmpty else { return 0 }

        return try queue.write { db in
            var seq = startSeq
            for s in samples {
                try TelemetrySampleEnriched(
                    timeId: timeId,
                    sessaoId: sessaoId,
                    seq: seq,
                    t: s.t,
                    tMono: s.tMono,
                    xM: s.xM,
                    yM: s.yM,
                    vxMps: s.vxMps,
                    vyMps: s.vyMps,
                    headingDeg: s.headingDeg,
                    posSigmaM: s.posSigmaM,
                    sourceKalman: s.sourceKalman,
                    gapDurationMs: s.gapDurationMs
                ).insert(db)
                seq += 1
            }
            return samples.count
        }
    }

    /// Conta linhas pra uma sessão. Útil pra UI mostrar contador
    /// pós-stop ou comparar com TelemetryWriter.sampleCount (raw).
    public static func sampleCount(
        queue: DatabaseQueue,
        sessaoId: String
    ) throws -> Int {
        try queue.read { db in
            try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM telemetry_samples_enriched WHERE sessao_id = ?
            """, arguments: [sessaoId]) ?? 0
        }
    }
}
