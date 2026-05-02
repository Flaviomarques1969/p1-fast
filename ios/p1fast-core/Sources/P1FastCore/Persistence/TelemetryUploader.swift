// ═══════════════════════════════════════════════════════════
// TelemetryUploader — drena telemetry_samples → Edge Function `ingest`
// ═══════════════════════════════════════════════════════════
// Caminho SEPARADO do SyncDrainer (ADR-014: telemetry append-only não
// passa por sync_queue). Lê telemetry_samples WHERE uploaded_at IS NULL,
// agrupa em chunks, envia, marca uploaded_at.
//
// Lógica pura (sem URLSession). Recebe TelemetryTransport injetado pelo
// p1fast-ios com cliente HTTP real.

import Foundation
import GRDB

// ─── Shape do POST pra Edge Function ingest ──────────────
public struct IngestRequestSample: Codable, Equatable {
    public let t: Int64
    public let tMono: Double
    public let source: String
    public let signalQuality: String
    public let seq: Int64?
    /// Resto dos campos do payload (lat, lng, ax, ay, gx etc).
    public let extras: [String: AnyCodable]?

    public init(t: Int64, tMono: Double, source: String, signalQuality: String,
                seq: Int64? = nil, extras: [String: AnyCodable]? = nil) {
        self.t = t; self.tMono = tMono; self.source = source
        self.signalQuality = signalQuality; self.seq = seq; self.extras = extras
    }
}

public struct IngestRequest: Codable {
    public let sessionId: String
    public let chunkId: String
    public let samples: [IngestRequestSample]

    public init(sessionId: String, chunkId: String, samples: [IngestRequestSample]) {
        self.sessionId = sessionId
        self.chunkId = chunkId
        self.samples = samples
    }
}

public struct IngestResult: Codable, Equatable {
    public let accepted: Int
    public let rejected: Int

    public init(accepted: Int, rejected: Int) {
        self.accepted = accepted; self.rejected = rejected
    }
}

public protocol TelemetryTransport {
    func upload(_ request: IngestRequest) throws -> IngestResult
}

// ─── UploaderOutcome ─────────────────────────────────────
public struct UploaderOutcome: Equatable {
    public let processedCount: Int
    public let acceptedCount: Int
    public let rejectedCount: Int
    public let chunksUploaded: Int

    public init(processedCount: Int, acceptedCount: Int, rejectedCount: Int, chunksUploaded: Int) {
        self.processedCount = processedCount
        self.acceptedCount = acceptedCount
        self.rejectedCount = rejectedCount
        self.chunksUploaded = chunksUploaded
    }
}

// ─── TelemetryUploader ───────────────────────────────────
public enum TelemetryUploader {
    /// Chunk size alinhado com BATCH_SIZE da Edge Function ingest (1000).
    public static let defaultChunkSize = 1000

    /// Drena telemetry_samples não enviados pra uma sessão específica.
    /// - Parameters:
    ///   - queue: GRDB queue
    ///   - sessionId: filtra só esta sessão (nil = qualquer pendente)
    ///   - transport: cliente HTTP real ou mock
    ///   - chunkSize: rows por request (default 1000)
    /// - Returns: estatísticas
    public static func upload(
        _ queue: DatabaseQueue,
        sessionId: String? = nil,
        transport: TelemetryTransport,
        chunkSize: Int = defaultChunkSize
    ) throws -> UploaderOutcome {
        // 1. Pega rows não-enviadas (uploaded_at IS NULL), ordem por seq
        let rows: [TelemetrySample] = try queue.read { db in
            var query = TelemetrySample
                .filter(Column("uploaded_at") == nil)
                .order(Column("sessao_id").asc, Column("seq").asc)
                .limit(chunkSize * 10)  // pega até 10 chunks de uma vez
            if let sid = sessionId {
                query = query.filter(Column("sessao_id") == sid)
            }
            return try query.fetchAll(db)
        }

        if rows.isEmpty {
            return UploaderOutcome(processedCount: 0, acceptedCount: 0, rejectedCount: 0, chunksUploaded: 0)
        }

        // 2. Agrupa por session + chunkifica
        var totalAccepted = 0
        var totalRejected = 0
        var chunksUploaded = 0

        let bySession = Dictionary(grouping: rows, by: { $0.sessaoId })

        for (sid, sessionRows) in bySession {
            // Chunkifica por chunkSize
            for chunk in sessionRows.chunked(into: chunkSize) {
                let chunkId = "\(sid)-\(chunk.first?.seq ?? 0)-\(chunk.last?.seq ?? 0)"
                let samples = chunk.map { row -> IngestRequestSample in
                    // Decoda payload pra extras
                    let extras = decodePayload(row.payload)
                    let source = (extras?["source"]?.value as? String) ?? "unknown"
                    let signalQuality = (extras?["signalQuality"]?.value as? String) ?? "UNKNOWN"
                    return IngestRequestSample(
                        t: row.t,
                        tMono: row.tMono ?? 0,
                        source: source,
                        signalQuality: signalQuality,
                        seq: row.seq,
                        extras: extras
                    )
                }

                let req = IngestRequest(sessionId: sid, chunkId: chunkId, samples: samples)
                let result = try transport.upload(req)
                chunksUploaded += 1
                totalAccepted += result.accepted
                totalRejected += result.rejected

                // Marca uploaded_at no que foi aceito (assume ordem preservada;
                // se rejected > 0 sobrescreve TUDO igual — é append-only, seq
                // é sequencial, qualquer rejeição local indica corrupção que
                // requer investigação humana, não retry automático).
                if result.accepted > 0 {
                    let ids = chunk.compactMap { $0.id }
                    try queue.write { db in
                        let now = DB.nowMs()
                        for id in ids {
                            try db.execute(
                                sql: "UPDATE telemetry_samples SET uploaded_at = ? WHERE id = ?",
                                arguments: [now, id]
                            )
                        }
                    }
                }
            }
        }

        return UploaderOutcome(
            processedCount: rows.count,
            acceptedCount: totalAccepted,
            rejectedCount: totalRejected,
            chunksUploaded: chunksUploaded
        )
    }

    /// Conta quantos samples ainda estão pendentes (debug/UI).
    public static func pendingCount(_ queue: DatabaseQueue, sessionId: String? = nil) throws -> Int {
        try queue.read { db in
            if let sid = sessionId {
                return try Int.fetchOne(
                    db,
                    sql: "SELECT COUNT(*) FROM telemetry_samples WHERE uploaded_at IS NULL AND sessao_id = ?",
                    arguments: [sid]
                ) ?? 0
            }
            return try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM telemetry_samples WHERE uploaded_at IS NULL"
            ) ?? 0
        }
    }

    // MARK: - Internal

    private static func decodePayload(_ json: String?) -> [String: AnyCodable]? {
        guard let json = json,
              let data = json.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        var out: [String: AnyCodable] = [:]
        for (k, v) in raw { out[k] = AnyCodable(v) }
        return out
    }
}

// ─── Helper: chunkifica array ────────────────────────────
extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
