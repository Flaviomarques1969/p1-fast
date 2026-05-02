// ═══════════════════════════════════════════════════════════
// PullCursor — armazenamento dos cursors last_sync_at por tabela
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — sub-prompt E (de 5).
//
// Persiste em sync_meta(table_name, last_sync_at). Cliente envia
// last_sync_at como `since` pra Edge Function `pull`; quando recebe
// rows, atualiza o cursor com o `max_updated_at` da resposta.
//
// sync_meta vive na sync_queue migration (v1) — é local-only, sem
// counterpart no Postgres (não precisa, é pra rastrear sync OUT).

import Foundation
import GRDB

public struct SyncCursor: Codable, FetchableRecord, PersistableRecord {
    public var tableName: String
    public var lastSyncAt: Int64    // ms epoch — quando rodou o pull mais recente

    public static let databaseTableName = "sync_meta"
    enum CodingKeys: String, CodingKey {
        case tableName = "table_name"
        case lastSyncAt = "last_sync_at"
    }

    public init(tableName: String, lastSyncAt: Int64) {
        self.tableName = tableName
        self.lastSyncAt = lastSyncAt
    }
}

public enum PullCursor {
    /// Lê o cursor `last_sync_at` da tabela. 0 se nunca rodou pull.
    public static func get(_ db: Database, tableName: String) throws -> Int64 {
        try Int64.fetchOne(
            db,
            sql: "SELECT last_sync_at FROM sync_meta WHERE table_name = ?",
            arguments: [tableName]
        ) ?? 0
    }

    /// Atualiza o cursor — upsert por table_name.
    public static func set(_ db: Database, tableName: String, lastSyncAt: Int64) throws {
        try db.execute(sql: """
            INSERT INTO sync_meta (table_name, last_sync_at) VALUES (?, ?)
            ON CONFLICT (table_name) DO UPDATE SET last_sync_at = excluded.last_sync_at
            """,
            arguments: [tableName, lastSyncAt]
        )
    }

    /// Lê todos os cursors atuais (debug / UI "última sincronização").
    public static func all(_ db: Database) throws -> [SyncCursor] {
        try SyncCursor
            .order(Column("table_name").asc)
            .fetchAll(db)
    }

    /// Reseta tudo — usado em "logout" ou "fazer pull completo de novo".
    public static func resetAll(_ db: Database) throws {
        try db.execute(sql: "DELETE FROM sync_meta")
    }
}
