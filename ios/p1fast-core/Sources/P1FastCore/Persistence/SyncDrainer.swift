// ═══════════════════════════════════════════════════════════
// SyncDrainer — drena sync_queue local → Edge Function `sync` remota
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — sub-prompt B (de 5).
// Ver docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md.
//
// Lógica pura — não conhece URLSession nem Reachability. Recebe um
// SyncTransport (protocol) que é injetado pelo p1fast-ios com um
// cliente HTTP real. Aqui só:
//   1. Busca lote de pendentes da sync_queue (limit configurável)
//   2. Converte SyncQueueItem → SyncRequestRow (shape da Edge Function)
//   3. Chama transport.send(rows)
//   4. Pra cada accepted: markSynced + drain(id)
//   5. Pra cada rejected: incrementAttempts + grava last_error
//   6. attempts ≥ maxAttempts → row vira dead-letter (estado `failed`)
//
// Telemetria NÃO passa por aqui (ADR-014, vai por TelemetryUploader).

import Foundation
import GRDB

// ─── Shape esperado pela Edge Function `sync` ────────────
public struct SyncRequestRow: Codable, Equatable {
    public let table_name: String
    public let op: String
    public let row_id: String?
    public let payload: [String: AnyCodable]?
    public let client_updated_at: Int64?

    public init(table_name: String, op: String, row_id: String? = nil,
                payload: [String: AnyCodable]? = nil, client_updated_at: Int64? = nil) {
        self.table_name = table_name
        self.op = op
        self.row_id = row_id
        self.payload = payload
        self.client_updated_at = client_updated_at
    }
}

public struct SyncRejected: Codable, Equatable {
    public let row_id: String?
    public let table_name: String
    public let reason: String

    public init(row_id: String?, table_name: String, reason: String) {
        self.row_id = row_id
        self.table_name = table_name
        self.reason = reason
    }
}

public struct SyncResult: Codable, Equatable {
    public let accepted: [String]
    public let rejected: [SyncRejected]

    public init(accepted: [String], rejected: [SyncRejected]) {
        self.accepted = accepted
        self.rejected = rejected
    }
}

// Helper pra payloads heterogêneos sem virar tipo abstrato horrível.
public struct AnyCodable: Codable, Equatable {
    public let value: Any

    public init(_ value: Any) { self.value = value }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(String.self) { self.value = v; return }
        if let v = try? c.decode(Int64.self)  { self.value = v; return }
        if let v = try? c.decode(Double.self) { self.value = v; return }
        if let v = try? c.decode(Bool.self)   { self.value = v; return }
        if c.decodeNil()                       { self.value = NSNull(); return }
        throw DecodingError.typeMismatch(AnyCodable.self,
            DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "tipo não suportado"))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case let v as String: try c.encode(v)
        case let v as Int:    try c.encode(Int64(v))
        case let v as Int64:  try c.encode(v)
        case let v as Double: try c.encode(v)
        case let v as Bool:   try c.encode(v)
        case is NSNull:       try c.encodeNil()
        default:
            try c.encode(String(describing: value))
        }
    }

    public static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        // Comparação simplificada via String — suficiente pra equality
        // em testes; produção não compara payloads diretamente.
        String(describing: lhs.value) == String(describing: rhs.value)
    }
}

// ─── Transport: abstrai HTTP pro p1fast-ios injetar URLSession ──
public protocol SyncTransport {
    func send(_ rows: [SyncRequestRow]) throws -> SyncResult
}

// ─── DrainOutcome ────────────────────────────────────────
public struct DrainOutcome: Equatable {
    public let processedCount: Int
    public let acceptedCount: Int
    public let rejectedCount: Int
    public let deadLetteredCount: Int

    public init(processedCount: Int, acceptedCount: Int, rejectedCount: Int, deadLetteredCount: Int) {
        self.processedCount = processedCount
        self.acceptedCount = acceptedCount
        self.rejectedCount = rejectedCount
        self.deadLetteredCount = deadLetteredCount
    }
}

// ─── SyncDrainer — entry point ───────────────────────────
public enum SyncDrainer {
    /// Drena um lote de pendentes da sync_queue.
    /// - Parameters:
    ///   - queue: GRDB DatabaseQueue do app
    ///   - transport: implementação que envia pra Edge Function
    ///   - batchSize: máximo de rows por chamada (alinhado com MAX_ROWS_PER_REQUEST=500 da Edge Function)
    ///   - maxAttempts: quantas tentativas antes de dead-letter (default 5)
    /// - Returns: estatísticas do que foi feito.
    public static func drainBatch(
        _ queue: DatabaseQueue,
        transport: SyncTransport,
        batchSize: Int = 50,
        maxAttempts: Int = 5
    ) throws -> DrainOutcome {
        // 1. Pega lote de pendentes (attempts < maxAttempts, ordem por created_at)
        let pendentes: [SyncQueueItem] = try queue.read { db in
            try SyncQueueItem
                .filter(Column("attempts") < maxAttempts)
                .order(Column("created_at").asc)
                .limit(batchSize)
                .fetchAll(db)
        }

        if pendentes.isEmpty {
            return DrainOutcome(processedCount: 0, acceptedCount: 0, rejectedCount: 0, deadLetteredCount: 0)
        }

        // 2. Converte pra SyncRequestRow (decoda payload JSON pra dict).
        // Sempre envia row_id (mesmo em insert) — Edge Function ecoa em
        // `rejected.row_id`, que o drainer usa pra associar item local +
        // incrementar attempts. Sem isso, rejected de inserts vinha com
        // row_id=null e o lookup pulava silenciosamente, deixando a fila
        // travada em attempts=0 indefinidamente.
        let rows: [SyncRequestRow] = pendentes.map { item in
            let payloadDict = decodePayload(item.payload)
            return SyncRequestRow(
                table_name: item.tableName,
                op: item.op.rawValue,
                row_id: item.rowId,
                payload: item.op == .delete ? nil : payloadDict,
                // Pra LWW: client_updated_at = quando a row foi enfileirada localmente.
                // Em ms epoch (compatível com server.updated_at que vai ser ms também).
                client_updated_at: item.op == .update ? item.createdAt : nil
            )
        }

        // 3. Chama transport (pode lançar — transport-level error trata fora)
        let result = try transport.send(rows)

        // 4. Aplica resultado: accepted → markSynced + drain; rejected → incrementAttempts
        var acceptedCount = 0
        var rejectedCount = 0
        var deadLetteredCount = 0

        try queue.write { db in
            for row_id in result.accepted {
                // UUID()/uuidString em Swift produz uppercase; Postgres
                // normaliza UUIDs em colunas `uuid` pra lowercase no
                // select. Comparação case-insensitive evita mismatch
                // silencioso (drainer "sucede" mas nada drena, fila
                // estática indefinidamente). markSynced usa item.rowId
                // (LOCAL) — preserva case do SQLite, senão
                // WHERE id = ? não acha row.
                guard let item = pendentes.first(where: {
                    $0.rowId.caseInsensitiveCompare(row_id) == .orderedSame
                }) else { continue }
                if item.op != .delete {
                    try? SyncQueue.markSynced(db, tableName: item.tableName, rowId: item.rowId)
                }
                if let id = item.id { try SyncQueue.drain(db, id: id) }
                acceptedCount += 1
            }

            for rej in result.rejected {
                // Defensivo (Bug B): se row_id vier null, associa pela
                // primeira pendente da mesma tabela. Match também
                // case-insensitive no row_id quando presente.
                let item: SyncQueueItem?
                if let row_id = rej.row_id {
                    item = pendentes.first(where: {
                        $0.rowId.caseInsensitiveCompare(row_id) == .orderedSame
                    })
                } else {
                    item = pendentes.first(where: { $0.tableName == rej.table_name })
                }
                guard let item, let id = item.id else { continue }
                try SyncQueue.incrementAttempts(db, id: id)
                rejectedCount += 1
                // Verifica se virou dead-letter (próxima tentativa atingiria maxAttempts)
                let updated = try SyncQueueItem
                    .filter(Column("id") == id).fetchOne(db)
                if let u = updated, u.attempts >= maxAttempts {
                    deadLetteredCount += 1
                }
            }
        }

        return DrainOutcome(
            processedCount: pendentes.count,
            acceptedCount: acceptedCount,
            rejectedCount: rejectedCount,
            deadLetteredCount: deadLetteredCount
        )
    }

    /// Conta quantos itens estão dead-letter (attempts >= maxAttempts).
    public static func deadLetterCount(_ queue: DatabaseQueue, maxAttempts: Int = 5) throws -> Int {
        try queue.read { db in
            try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM sync_queue WHERE attempts >= ?",
                arguments: [maxAttempts]
            ) ?? 0
        }
    }

    // MARK: - Internal helpers

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
