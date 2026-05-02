// ═══════════════════════════════════════════════════════════
// PullExecutor — orquestra catch-up sync via Edge Function `pull`
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — fecha o loop do sub-prompt E.
//
// Fluxo:
//   1. Lê cursors atuais (PullCursor.get) das tabelas pedidas
//   2. Monta PullRequest { tables, since: { table → cursor } }
//   3. transport.pull(request) — devolve rows + max_updated_at por tabela
//   4. Pra cada tabela: aplica UPSERT das rows no GRDB local
//   5. Atualiza cursors (PullCursor.set com max_updated_at)
//   6. Se has_more: cliente chama de novo (loop externo)
//
// Lógica pura — não conhece URLSession. Recebe PullTransport injetado
// pelo p1fast-ios (sub-prompt C). Smoke testa com mock.

import Foundation
import GRDB

// ─── Shapes alinhados ao Edge Function `pull` ────────────
public struct PullRequest: Codable {
    public let tables: [String]
    public let since: [String: Int64]   // table_name → ms_epoch

    public init(tables: [String], since: [String: Int64]) {
        self.tables = tables
        self.since = since
    }
}

public struct PullResponse: Codable {
    public let rows: [String: [PullRow]]               // table_name → rows
    public let max_updated_at: [String: Int64]         // table_name → cursor
    public let has_more: [String: Bool]?               // table_name → bool

    public init(rows: [String: [PullRow]], max_updated_at: [String: Int64], has_more: [String: Bool]? = nil) {
        self.rows = rows
        self.max_updated_at = max_updated_at
        self.has_more = has_more
    }
}

/// Row genérica do pull — chave/valor JSON. Cada repositório decide
/// como mapear pra seu modelo Codable (PullExecutor só faz UPSERT raw).
public struct PullRow: Codable, Equatable {
    public let id: String
    public let updatedAtMs: Int64
    public let payload: [String: AnyCodable]

    public init(id: String, updatedAtMs: Int64, payload: [String: AnyCodable]) {
        self.id = id
        self.updatedAtMs = updatedAtMs
        self.payload = payload
    }

    enum CodingKeys: String, CodingKey {
        case id
        case updatedAtMs = "updated_at_ms"
        case payload
    }

    /// Decodifica de uma row crua do Postgres (com `id` + `updated_at` ISO + outros campos).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: DynamicCodingKey.self)
        var idStr: String?
        var updatedAtIso: String?
        var fields: [String: AnyCodable] = [:]

        for key in c.allKeys {
            if key.stringValue == "id" {
                idStr = try c.decode(String.self, forKey: key)
            } else if key.stringValue == "updated_at" {
                updatedAtIso = try c.decode(String.self, forKey: key)
            } else if let v = try? c.decode(String.self, forKey: key) {
                fields[key.stringValue] = AnyCodable(v)
            } else if let v = try? c.decode(Int64.self, forKey: key) {
                fields[key.stringValue] = AnyCodable(v)
            } else if let v = try? c.decode(Double.self, forKey: key) {
                fields[key.stringValue] = AnyCodable(v)
            } else if let v = try? c.decode(Bool.self, forKey: key) {
                fields[key.stringValue] = AnyCodable(v)
            }
            // Demais tipos (objetos JSON aninhados) ignorados — repositório
            // re-decodifica a row inteira pelo seu próprio modelo se precisar.
        }

        guard let id = idStr else {
            throw DecodingError.dataCorrupted(.init(codingPath: c.codingPath, debugDescription: "row sem id"))
        }
        let updatedMs: Int64 = updatedAtIso.flatMap { Self.parseIsoMs($0) } ?? 0
        self.id = id
        self.updatedAtMs = updatedMs
        self.payload = fields
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(id, forKey: DynamicCodingKey(stringValue: "id")!)
        try c.encode(updatedAtMs, forKey: DynamicCodingKey(stringValue: "updated_at_ms")!)
        for (k, v) in payload {
            try c.encode(v, forKey: DynamicCodingKey(stringValue: k)!)
        }
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static func parseIsoMs(_ iso: String) -> Int64? {
        if let d = isoFormatter.date(from: iso) {
            return Int64(d.timeIntervalSince1970 * 1000)
        }
        // Fallback sem fractional seconds.
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: iso) {
            return Int64(d.timeIntervalSince1970 * 1000)
        }
        return nil
    }
}

private struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

public protocol PullTransport {
    func pull(_ request: PullRequest) throws -> PullResponse
}

// ─── PullOutcome ─────────────────────────────────────────
public struct PullOutcome: Equatable {
    public let tables: [String]
    public let totalRowsApplied: Int
    public let cursorsAdvanced: Int
    public let tablesWithMore: [String]

    public init(tables: [String], totalRowsApplied: Int, cursorsAdvanced: Int, tablesWithMore: [String]) {
        self.tables = tables
        self.totalRowsApplied = totalRowsApplied
        self.cursorsAdvanced = cursorsAdvanced
        self.tablesWithMore = tablesWithMore
    }
}

// ─── PullExecutor ────────────────────────────────────────
public enum PullExecutor {
    /// Roda 1 ciclo de pull pra um conjunto de tabelas.
    /// - Returns: outcome com contagem de rows aplicadas e tabelas que ainda têm mais.
    /// O caller deve re-chamar até `tablesWithMore.isEmpty` pra esgotar.
    public static func runOnce(
        _ queue: DatabaseQueue,
        tables: [String],
        transport: PullTransport
    ) throws -> PullOutcome {
        // 1. Lê cursors atuais
        let since: [String: Int64] = try queue.read { db in
            var out: [String: Int64] = [:]
            for t in tables {
                out[t] = try PullCursor.get(db, tableName: t)
            }
            return out
        }

        // 2. Chama transport
        let request = PullRequest(tables: tables, since: since)
        let response = try transport.pull(request)

        // 3. Aplica rows (UPSERT por id) + atualiza cursors
        var totalApplied = 0
        var cursorsAdvanced = 0
        var withMore: [String] = []

        try queue.write { db in
            for table in tables {
                let rows = response.rows[table] ?? []
                for row in rows {
                    try upsert(db, table: table, row: row)
                    totalApplied += 1
                }

                // Atualiza cursor se tem max_updated_at e é maior que o atual
                if let newCursor = response.max_updated_at[table],
                   newCursor > (since[table] ?? 0) {
                    try PullCursor.set(db, tableName: table, lastSyncAt: newCursor)
                    cursorsAdvanced += 1
                }

                if response.has_more?[table] == true {
                    withMore.append(table)
                }
            }
        }

        return PullOutcome(
            tables: tables,
            totalRowsApplied: totalApplied,
            cursorsAdvanced: cursorsAdvanced,
            tablesWithMore: withMore
        )
    }

    // MARK: - UPSERT raw

    /// UPSERT genérico — gera SQL `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`.
    /// Marca `synced_at = now` automaticamente (row veio do server, está sincronizada).
    private static func upsert(_ db: Database, table: String, row: PullRow) throws {
        // Coleta colunas + valores. `id` sempre presente; outros vêm do payload.
        var columns: [String] = ["id"]
        var values: [DatabaseValueConvertible] = [row.id]

        for (k, v) in row.payload {
            // Skip se não for tipo simples (objetos viram JSON-encoded ainda no Edge).
            columns.append(k)
            values.append(toDatabaseValue(v.value))
        }

        // Adiciona synced_at = now (pra tabelas que têm a coluna).
        // Se não tiver (telemetry_samples, sync_meta), o SQL falha; nesse caso
        // tabela não devia estar na lista de pull.
        if hasColumn(db, table: table, column: "synced_at") {
            columns.append("synced_at")
            values.append(DB.nowMs())
        }

        let placeholders = Array(repeating: "?", count: columns.count).joined(separator: ", ")
        let columnList = columns.joined(separator: ", ")
        let updateAssigns = columns
            .filter { $0 != "id" }
            .map { "\($0) = excluded.\($0)" }
            .joined(separator: ", ")

        let sql = """
            INSERT INTO \(table) (\(columnList)) VALUES (\(placeholders))
            ON CONFLICT(id) DO UPDATE SET \(updateAssigns)
        """
        try db.execute(sql: sql, arguments: StatementArguments(values))
    }

    private static func hasColumn(_ db: Database, table: String, column: String) -> Bool {
        do {
            let rows = try Row.fetchAll(db, sql: "PRAGMA table_info(\(table))")
            return rows.contains(where: { ($0["name"] as String?) == column })
        } catch {
            return false
        }
    }

    private static func toDatabaseValue(_ v: Any) -> DatabaseValueConvertible {
        switch v {
        case let s as String: return s
        case let i as Int: return i
        case let i as Int64: return i
        case let d as Double: return d
        case let b as Bool: return b ? 1 : 0
        case is NSNull: return DatabaseValue.null
        default: return String(describing: v)
        }
    }
}
