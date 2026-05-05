// ═══════════════════════════════════════════════════════════
// TelemetryWriter — serializa Sample → telemetry_samples row
// ═══════════════════════════════════════════════════════════
// Lógica pura, sem CoreMotion. p1fast-ios chama isso no flush
// do LiveTelemetryRecorder. Smoke testa headless via makeTestDB.
//
// ADR-014: telemetry_samples é append-only e NÃO passa por
// sync_queue — quem dreia pro Supabase é o TelemetryUploader.
//
// Shape do payload: JSON do Sample inteiro. Edge Function ingest
// lê t/tMono/source/signalQuality direto e o resto via extras.
//
// API síncrona em cima de queue.write — caller em main thread
// (recorder, UI) deve envolver em Task pra não bloquear.

import Foundation
import GRDB

public enum TelemetryWriter {

    /// Anexa um lote de Sample no telemetry_samples para uma sessão.
    /// Sequência dos seq vem do caller (recorder mantém contador).
    /// Retorna quantas linhas foram inseridas.
    @discardableResult
    public static func appendBatch(
        queue: DatabaseQueue,
        sessaoId: String,
        timeId: String,
        samples: [Sample],
        startSeq: Int
    ) throws -> Int {
        guard !samples.isEmpty else { return 0 }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

        return try queue.write { db in
            var seq = startSeq
            for sample in samples {
                let data = try encoder.encode(sample)
                guard let payload = String(data: data, encoding: .utf8) else {
                    throw TelemetryWriterError.serializationFailed
                }
                try TelemetrySample(
                    timeId: timeId,
                    sessaoId: sessaoId,
                    seq: seq,
                    t: sample.t,
                    tMono: sample.tMono,
                    payload: payload
                ).insert(db)
                seq += 1
            }
            return samples.count
        }
    }

    /// Conta linhas pra uma sessão. Útil pra UI mostrar contador
    /// pós-stop sem alimentar lista inteira.
    public static func sampleCount(
        queue: DatabaseQueue,
        sessaoId: String
    ) throws -> Int {
        try queue.read { db in
            try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM telemetry_samples WHERE sessao_id = ?
            """, arguments: [sessaoId]) ?? 0
        }
    }
}

public enum TelemetryWriterError: Error, LocalizedError {
    case serializationFailed

    public var errorDescription: String? {
        switch self {
        case .serializationFailed: return "Falha ao serializar Sample em UTF-8."
        }
    }
}
