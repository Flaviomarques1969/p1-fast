// ═══════════════════════════════════════════════════════════
// AppDatabase — boot do DatabaseQueue local (GRDB) no sandbox do app
// ═══════════════════════════════════════════════════════════
// Reutiliza P1FastCore.DB.makeQueue. Arquivo SQLite vive em
// Documents/p1fast.sqlite. Schema é aplicado por DatabaseMigrator
// (v1_initial → 21 tabelas espelho do Postgres).
// Sync drainer pra Supabase virá no Sprint 1A.6.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class AppDatabase: ObservableObject {
    enum Status: Equatable {
        case idle
        case ok(tables: Int)
        case failed(message: String)
    }

    @Published private(set) var status: Status = .idle
    private(set) var queue: DatabaseQueue?

    func bootstrap() async {
        if case .ok = status { return }
        do {
            let url = try Self.databaseURL()
            let q = try DB.makeQueue(path: url.path)
            let count = try await q.read { db -> Int in
                // Exclui sqlite_* (internas SQLite) e grdb_migrations (controle
                // do DatabaseMigrator) — contamos só tabelas do schema do produto.
                try Int.fetchOne(db, sql: """
                    SELECT COUNT(*) FROM sqlite_master
                    WHERE type = 'table'
                      AND name NOT LIKE 'sqlite_%'
                      AND name != 'grdb_migrations';
                """) ?? 0
            }
            // Onda 4 (2026-05-24): apaga itens dead-letter da fila de envio
            // (>=5 tentativas) no boot. O drainer já para de tentar, mas os
            // itens ficam acumulando. Hoje há ~213 itens parados desde stints
            // antigos com voltas sintéticas que o servidor rejeita.
            try await q.write { db in
                _ = try P1FastCore.SyncQueue.purgeDeadLetters(db)
            }
            self.queue = q
            self.status = .ok(tables: count)
        } catch {
            self.status = .failed(message: String(describing: error))
        }
    }

    /// Retorna o path absoluto pro arquivo SQLite no sandbox do app
    /// (`<app>/Documents/p1fast.sqlite`). Cria o diretório se faltar.
    static func databaseURL() throws -> URL {
        let fm = FileManager.default
        let docs = try fm.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return docs.appendingPathComponent("p1fast.sqlite")
    }
}
