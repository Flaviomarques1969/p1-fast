// ═══════════════════════════════════════════════════════════
// DB — DatabaseQueue factory (SQLite local via GRDB)
// ═══════════════════════════════════════════════════════════
// Espelho do Postgres do Supabase (supabase/migrations/0001_initial.sql).
// Cada row da nuvem tem 1:1 local com colunas compatíveis. Coluna
// `synced_at INTEGER NULL` em todas as tabelas exceto telemetry_samples
// (ADR-014: append-only, sync por batch).
//
// Sync drainer NÃO está aqui — Sprint 1A.6. Aqui só schema + helpers
// de marcação (markSynced, listPending) + sync_queue local.

import Foundation
import GRDB

public enum DB {
    /// Cria DatabaseQueue em arquivo. Aplica migrações.
    /// `path` é caminho absoluto pro .sqlite no sandbox do app.
    public static func makeQueue(path: String) throws -> DatabaseQueue {
        var config = Configuration()
        config.foreignKeysEnabled = true
        let queue = try DatabaseQueue(path: path, configuration: config)
        try migrator.migrate(queue)
        return queue
    }

    /// Cria DatabaseQueue em memória — usado em testes.
    public static func makeMemoryQueue() throws -> DatabaseQueue {
        var config = Configuration()
        config.foreignKeysEnabled = true
        let queue = try DatabaseQueue(configuration: config)
        try migrator.migrate(queue)
        return queue
    }

    /// DatabaseMigrator com versões registradas em Migrations.swift.
    public static var migrator: DatabaseMigrator {
        var m = DatabaseMigrator()
        Migrations.register(into: &m)
        return m
    }

    /// Epoch ms do "agora". Usado pra preencher created_at/updated_at/synced_at.
    public static func nowMs() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }
}
