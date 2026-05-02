// ═══════════════════════════════════════════════════════════
// EventoRepository — CRUD de eventos sobre o DatabaseQueue local
// ═══════════════════════════════════════════════════════════
// Mesmo padrão do CarroRepository (PR #21 da queue, Prompt #9):
// fina camada acima do GRDB. Sincronização com Supabase fica pro
// Sprint 1A.6 (sync drainer já implementado em p1fast-core, falta
// HTTP transport — sub-prompt C).
//
// Time-tenancy: usa o mesmo `local-default-team` do CarroRepository.
// EventoRepository.bootstrap() é idempotente — pode ser chamado em
// paralelo com CarroRepository.bootstrap().
//
// "Stints" hoje = sessoes. Catálogo de stints separado virá no
// Sprint 1A.3 (ver docs/SPRINT_1A3_DESIGN.md).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class EventoRepository: ObservableObject {
    /// Mesmo ID do CarroRepository (single-tenant até 1A.6).
    static let localTimeId = "local-default-team"

    @Published private(set) var eventos: [Evento] = []
    /// Resumo agregado por evento_id: { stints, voltas, melhorVoltaMs }.
    @Published private(set) var sumarioPorEvento: [String: EventoSumario] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante que existe um time local + recarrega lista. Chamar uma vez no boot.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await reload()
        } catch {
            print("EventoRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        let rows = try await queue.read { db in
            try Evento
                .filter(Column("time_id") == Self.localTimeId)
                .order(Column("data_evento").desc)
                .fetchAll(db)
        }
        let sumarios = try await queue.read { db -> [String: EventoSumario] in
            // stints = COUNT(sessoes), voltas = COUNT(voltas), melhor = MIN(tempo_ms valida=1)
            let sql = """
                SELECT
                    s.evento_id                            AS evento_id,
                    COUNT(DISTINCT s.id)                   AS stints,
                    COUNT(v.id)                            AS voltas,
                    MIN(CASE WHEN v.valida = 1 THEN v.tempo_ms END) AS melhor_ms
                FROM sessoes s
                LEFT JOIN voltas v ON v.sessao_id = s.id
                WHERE s.evento_id IS NOT NULL
                GROUP BY s.evento_id
            """
            return try Row.fetchAll(db, sql: sql).reduce(into: [:]) { acc, row in
                let eId: String = row[0]
                acc[eId] = EventoSumario(
                    stints: row[1],
                    voltas: row[2],
                    melhorVoltaMs: row[3]
                )
            }
        }
        self.eventos = rows
        self.sumarioPorEvento = sumarios
    }

    /// Cria um evento novo. Retorna o ID gerado.
    @discardableResult
    func create(trackId: String?, tipo: String?, dataEvento: Int64,
                status: String? = "planejado") async throws -> String {
        let eventoId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            try Evento(
                id: eventoId,
                timeId: Self.localTimeId,
                trackId: trackId,
                tipo: tipo,
                dataEvento: dataEvento,
                status: status,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        try await reload()
        return eventoId
    }

    func update(evento: Evento) async throws {
        var copy = evento
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            try copy.update(db)
        }
        try await reload()
    }

    func delete(eventoId: String) async throws {
        try await queue.write { db in
            _ = try Evento.deleteOne(db, key: eventoId)
        }
        try await reload()
    }

    /// Lista os stints (sessoes) de um evento, mais recentes primeiro.
    func listStints(eventoId: String) async throws -> [Sessao] {
        try await queue.read { db in
            try Sessao
                .filter(Column("evento_id") == eventoId)
                .order(Column("data_inicio").desc)
                .fetchAll(db)
        }
    }

    /// Detecta se há um evento "ativo hoje" — `data_evento` cai no dia atual.
    /// UI usa isso pra destacar em accent.
    func eventoAtivoHoje() -> Evento? {
        let cal = Calendar.current
        let hoje = cal.startOfDay(for: Date())
        let amanha = cal.date(byAdding: .day, value: 1, to: hoje)!
        let inicio = Int64(hoje.timeIntervalSince1970 * 1000)
        let fim = Int64(amanha.timeIntervalSince1970 * 1000)
        return eventos.first(where: { $0.dataEvento >= inicio && $0.dataEvento < fim })
    }

    /// Próximo evento futuro (data_evento >= amanhã). UI mostra como "próximo".
    func proximoEvento() -> Evento? {
        let cal = Calendar.current
        let amanha = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: Date()))!
        let inicio = Int64(amanha.timeIntervalSince1970 * 1000)
        return eventos
            .filter { $0.dataEvento >= inicio }
            .min(by: { $0.dataEvento < $1.dataEvento })
    }

    private func ensureLocalTime() async throws {
        try await queue.write { db in
            let exists = try Time.fetchOne(db, key: Self.localTimeId) != nil
            guard !exists else { return }
            try Time(
                id: Self.localTimeId,
                nome: "Time local",
                criadoPor: nil
            ).insert(db)
        }
    }
}

/// Resumo agregado de um evento — pré-computado em `reload()` pra UI
/// não recalcular toda vez que renderiza a lista.
struct EventoSumario: Equatable {
    let stints: Int
    let voltas: Int
    /// Melhor volta (em ms) — nil se nenhuma volta válida ainda.
    let melhorVoltaMs: Int?

    /// Formatação canônica "M:SS.mmm" (1:42.318) — usar no card.
    func melhorVoltaFormatado() -> String? {
        guard let ms = melhorVoltaMs else { return nil }
        let minutos = ms / 60_000
        let segundos = (ms % 60_000) / 1000
        let milisseg = ms % 1000
        return String(format: "%d:%02d.%03d", minutos, segundos, milisseg)
    }
}
