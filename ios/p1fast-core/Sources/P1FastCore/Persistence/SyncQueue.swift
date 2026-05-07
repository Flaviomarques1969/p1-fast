// ═══════════════════════════════════════════════════════════
// SyncQueue — fila local de mutações pendentes pra Supabase
// ═══════════════════════════════════════════════════════════
// Espelha o conceito do `syncQueue` do Dexie (ADR-009): toda mutação
// local que NÃO seja telemetry_samples enfileira aqui pra replay
// posterior. Drainer é Sprint 1A.6 — aqui só schema + helpers.

import Foundation
import GRDB

public enum SyncOp: String, Codable {
    case insert, update, delete
}

public struct SyncQueueItem: Codable, FetchableRecord, PersistableRecord {
    public var id: Int64?
    public var tableName: String
    public var rowId: String
    public var op: SyncOp
    public var payload: String?
    public var attempts: Int
    public var createdAt: Int64

    public static let databaseTableName = "sync_queue"
    enum CodingKeys: String, CodingKey {
        case id
        case tableName = "table_name"
        case rowId = "row_id"
        case op, payload, attempts
        case createdAt = "created_at"
    }

    public init(id: Int64? = nil, tableName: String, rowId: String, op: SyncOp,
                payload: String? = nil, attempts: Int = 0, createdAt: Int64 = DB.nowMs()) {
        self.id = id; self.tableName = tableName; self.rowId = rowId; self.op = op
        self.payload = payload; self.attempts = attempts; self.createdAt = createdAt
    }

    public mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
}

public enum SyncQueue {
    /// Enfileira uma mutação local pra replay futuro.
    public static func enqueue(_ db: Database, tableName: String, rowId: String,
                               op: SyncOp, payload: String? = nil) throws {
        var item = SyncQueueItem(tableName: tableName, rowId: rowId, op: op, payload: payload)
        try item.insert(db)
    }

    /// Marca um registro como sincronizado (synced_at = now).
    /// Não é aplicável a `telemetry_samples` (ADR-014).
    public static func markSynced(_ db: Database, tableName: String, rowId: String,
                                  at: Int64? = nil) throws {
        let ts = at ?? DB.nowMs()
        // tableName é controlado pela aplicação (não vem de input externo).
        // Mesmo assim usamos quoting básico via raw SQL parametrizado pra ID.
        let sql = "UPDATE \(tableName) SET synced_at = ? WHERE id = ?"
        try db.execute(sql: sql, arguments: [ts, rowId])
    }

    /// Lista registros de uma tabela ainda não sincronizados (synced_at IS NULL).
    public static func listPending<T: FetchableRecord & TableRecord>(
        _ db: Database, type: T.Type
    ) throws -> [T] {
        let sql = "SELECT * FROM \(T.databaseTableName) WHERE synced_at IS NULL ORDER BY created_at ASC"
        return try T.fetchAll(db, sql: sql)
    }

    /// Conta itens pendentes na sync_queue.
    public static func pendingCount(_ db: Database) throws -> Int {
        try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_queue") ?? 0
    }

    /// Drena (remove) um item da fila — usado pelo drainer futuro após sucesso remoto.
    public static func drain(_ db: Database, id: Int64) throws {
        try db.execute(sql: "DELETE FROM sync_queue WHERE id = ?", arguments: [id])
    }

    /// Incrementa attempts num item da fila — usado quando o drainer falha temporário.
    public static func incrementAttempts(_ db: Database, id: Int64) throws {
        try db.execute(sql: "UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?",
                       arguments: [id])
    }

    /// Serializa um GRDB record (Codable) em JSON e enfileira como
    /// mutação pendente. Encoder usa CodingKeys snake_case definidos
    /// nos modelos — o que sai bate com o shape esperado pela Edge
    /// Function `sync` (e por tabelas Postgres). Para `op == .delete`
    /// passe `record == nil` — o drainer só usa `rowId` nesse caso.
    public static func enqueueRecord<T: Codable>(
        _ db: Database,
        tableName: String,
        rowId: String,
        op: SyncOp,
        record: T?
    ) throws {
        let payloadStr: String?
        if op == .delete || record == nil {
            payloadStr = nil
        } else {
            let data = try Self.payloadEncoder.encode(record)
            payloadStr = String(data: data, encoding: .utf8)
        }
        try Self.enqueue(db, tableName: tableName, rowId: rowId, op: op, payload: payloadStr)
    }

    /// Encoder dedicado pra payload de sync_queue. Não muda o
    /// keyEncodingStrategy — modelos definem CodingKeys snake_case
    /// explicitamente, então o JSON já sai no shape do Postgres.
    private static let payloadEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()
}
