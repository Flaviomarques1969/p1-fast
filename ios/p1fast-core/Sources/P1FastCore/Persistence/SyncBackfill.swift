// ═══════════════════════════════════════════════════════════
// SyncBackfill — enfileira retroativamente rows com synced_at IS NULL
// ═══════════════════════════════════════════════════════════
// Bug Sprint E (2026-05-07): repos foram cabeados pra chamar
// `SyncQueue.enqueueRecord` após mutações, mas até esse fix as rows
// criadas em versões anteriores ficaram com `synced_at = NULL` e
// jamais entraram na fila. Este helper roda 1× no boot do app: pra
// cada tabela suportada, lista rows pendentes (synced_at IS NULL),
// confere que não há entrada equivalente em `sync_queue` e enfileira
// como `op=insert`.
//
// Idempotente: a checagem `EXISTS sync_queue WHERE table_name=? AND row_id=?`
// evita duplicar enqueue. Roda barato — 1 query por tabela.

import Foundation
import GRDB

public enum SyncBackfill {
    /// Tabelas que entram no backfill, na ordem de dependência (parents
    /// primeiro pra que o servidor não rejeite por FK quando o drainer
    /// processar em ordem de `created_at`). Usa só o nome — o backfill
    /// serializa a row via `Row.fetchAll` direto, sem precisar do tipo.
    // `times` NÃO entra: criação/atualização do time só pelo RPC
    // `ensure_personal_team` (MS-10 C.1) — bypass via sync genérico
    // bate em `table-nao-permitida` por design da Edge Function. Local
    // tem 2 rows (mock + time real), ambas com synced_at NULL — nunca
    // serão preenchidas, mas o backfill checa `NOT EXISTS sync_queue`
    // e ignora.
    private static let supportedTables: [String] = [
        "carros",
        "configuracoes",
        "eventos",
        "pilotos",
        "passageiros",
        "combustiveis",
        "pneus",
        "evento_pendencias",
        "sessoes",
        "voltas",
        "segment_executions",
    ]

    /// Roda o backfill. Retorna o nº total de rows enfileiradas (0 quando
    /// banco está limpo OU já foi backfilled). Não-fatal — qualquer
    /// erro é logado e o backfill continua nas outras tabelas.
    @discardableResult
    public static func run(_ queue: DatabaseQueue) throws -> Int {
        var totalEnfileirado = 0
        for tableName in supportedTables {
            do {
                let n = try backfillTable(queue, tableName: tableName)
                totalEnfileirado += n
            } catch {
                print("SyncBackfill[\(tableName)] error: \(error)")
            }
        }
        return totalEnfileirado
    }

    /// Sentinela do time mock local. Rows com esse `time_id` vêm de
    /// seeds locais (Flavio/Bruno mocks, Etanol/V-Power mocks, eventos
    /// mock) e NÃO devem ir pro servidor — o user pode nem ter acesso
    /// a esse time. Filtro explícito no backfill evita poluir a fila
    /// com rows que sempre serão rejeitadas com `not-member-of-time`.
    public static let LOCAL_DEFAULT_TEAM = "local-default-team"

    /// Tabelas que TÊM coluna `time_id` direto. Pra essas, filtramos
    /// rows com `time_id = LOCAL_DEFAULT_TEAM` no backfill. Tabelas
    /// sem `time_id` direto (evento_pendencias, sessoes, voltas,
    /// segment_executions) não precisam — herdam membership via FK e
    /// só vão pra fila se o parent já não for mock.
    private static let tablesWithTimeId: Set<String> = [
        "carros", "configuracoes", "pilotos", "passageiros",
        "combustiveis", "pneus", "eventos",
    ]

    private static func backfillTable(
        _ queue: DatabaseQueue,
        tableName: String
    ) throws -> Int {
        try queue.write { db in
            // SELECT id da tabela onde synced_at é NULL e ainda não há
            // row equivalente em sync_queue. JSON encoding via SELECT *
            // (PostgREST aceita o shape literal das colunas).
            let mockFilter = tablesWithTimeId.contains(tableName)
                ? "AND time_id != '\(LOCAL_DEFAULT_TEAM)'"
                : ""
            let pending = try Row.fetchAll(db, sql: """
                SELECT * FROM \(tableName)
                WHERE synced_at IS NULL
                  \(mockFilter)
                  AND NOT EXISTS (
                    SELECT 1 FROM sync_queue
                    WHERE sync_queue.table_name = ?
                      AND sync_queue.row_id = \(tableName).id
                  )
                """, arguments: [tableName])

            guard !pending.isEmpty else { return 0 }
            for row in pending {
                let rowId: String = row["id"]
                // Serializa a row do GRDB pra JSON manualmente — cada
                // chave do Row é nome de coluna Postgres (snake_case já),
                // então é compatível direto.
                var dict: [String: Any] = [:]
                for col in row.columnNames {
                    dict[col] = row[col] as DatabaseValueConvertible? ?? NSNull()
                }
                let payloadStr = try jsonString(from: dict)
                try SyncQueue.enqueue(db, tableName: tableName, rowId: rowId, op: .insert, payload: payloadStr)
            }
            return pending.count
        }
    }

    private static func jsonString(from dict: [String: Any]) throws -> String {
        // JSONSerialization aceita NSNumber/NSNull/String/Array/Dict.
        // GRDB DatabaseValueConvertible vira tipo nativo via subscript.
        var converted: [String: Any] = [:]
        for (k, v) in dict {
            converted[k] = jsonSafeValue(v)
        }
        let data = try JSONSerialization.data(withJSONObject: converted, options: [.sortedKeys])
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    private static func jsonSafeValue(_ v: Any) -> Any {
        if v is NSNull { return NSNull() }
        if let s = v as? String { return s }
        if let i = v as? Int64 { return NSNumber(value: i) }
        if let i = v as? Int { return NSNumber(value: i) }
        if let d = v as? Double { return NSNumber(value: d) }
        if let b = v as? Bool { return NSNumber(value: b) }
        // Fallback: string
        return String(describing: v)
    }
}
