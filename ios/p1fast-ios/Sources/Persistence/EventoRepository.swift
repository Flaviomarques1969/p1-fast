// ═══════════════════════════════════════════════════════════
// EventoRepository — CRUD de eventos sobre o DatabaseQueue local
// ═══════════════════════════════════════════════════════════
// Mesmo padrão do CarroRepository (Sprint 1A.2 · Prompt #9):
// fina camada acima do GRDB. Sincronização com Supabase fica pro
// Sprint 1A.6 (sync drainer já implementado em p1fast-core, falta
// HTTP transport — sub-prompt C).
//
// Time-tenancy: time_id vem de TeamContext.currentTeamId (MS-10 C.3).
// Sem login, reload deixa lista vazia. `bootstrap()` é idempotente —
// pode ser chamado em paralelo com CarroRepository.bootstrap() sem race.
//
// "Stints" hoje = sessoes. O fluxo de criação chega no Sprint 1A.3
// (mockup-stint.html, ver docs/SPRINT_1A3_DESIGN.md). Pra essa Sprint
// 1A.2 #10 a tela de detalhe consome `EventoMockSummary` enquanto a
// tabela `sessoes` permanece vazia.
//
// Seed: na primeira abertura (DB vazio em `eventos`) o bootstrap
// insere a pista "Brasília" + 3 eventos canônicos do mockup
// (1 ativo hoje + 2 passados). Faz o screenshot do PR ter dado real
// sem precisar de fixture específica de teste.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class EventoRepository: ObservableObject {
    /// ID estável da pista padrão "Brasília" — único traçado catalogado
    /// hoje no produto. Alinha com `SeedBrasilia.trk_brasilia` em
    /// P1FastCore (mas a Repo só insere a linha na tabela `tracks`,
    /// não popula layouts/segments — aqueles vêm na Sprint 1A.3 quando
    /// o cockpit começar a desenhar a pista).
    static let brasiliaTrackId = "trk_brasilia"

    /// IDs estáveis dos 3 eventos seedados — pareiam com
    /// `EventoMockSummary.canonicos`. Trocar IDs aqui exige trocar lá.
    static let seedAtivoId = "evt-mock-2026-05-02"
    static let seedPassado1Id = "evt-mock-2026-04-25"
    static let seedPassado2Id = "evt-mock-2026-03-28"

    @Published private(set) var eventos: [EventoView] = []
    /// Resumo agregado por evento_id ({ stints, voltas, melhorVoltaMs }).
    /// Pre-computado em `reload()` pra UI não recalcular por renda.
    @Published private(set) var sumarioPorEvento: [String: EventoSumario] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time + pista padrão + seed inicial (se DB de eventos
    /// estiver vazio) e recarrega lista. Idempotente — chamar várias
    /// vezes é seguro (cada `ensureX` checa antes de inserir).
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await ensureBrasiliaTrack()
            try await seedMockEventosIfEmpty()
            try await reload()
        } catch {
            // Não derruba o app — UI mostra lista vazia se a leitura falhar.
            print("EventoRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.eventos = []
            self.sumarioPorEvento = [:]
            return
        }
        let rows: [(Evento, String?, String?)] = try await queue.read { db in
            // LEFT JOIN tracks pra trazer apelido + nome_oficial sem
            // segundo round-trip. Lista costuma ter <50 eventos — overhead
            // negligenciável e fica consistente com o estilo "SQL bruto"
            // já usado em CarroRepository pra contagens.
            let sql = """
                SELECT e.*, t.apelido AS track_apelido, t.nome_oficial AS track_nome_oficial
                FROM eventos e
                LEFT JOIN tracks t ON t.id = e.track_id
                WHERE e.time_id = ?
                ORDER BY e.data_evento DESC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [teamId]).map { row in
                let evento = Evento(
                    id: row["id"],
                    timeId: row["time_id"],
                    trackId: row["track_id"],
                    tipo: row["tipo"],
                    dataEvento: row["data_evento"],
                    status: row["status"],
                    createdAt: row["created_at"],
                    updatedAt: row["updated_at"],
                    syncedAt: row["synced_at"]
                )
                let apelido: String? = row["track_apelido"]
                let oficial: String? = row["track_nome_oficial"]
                return (evento, apelido, oficial)
            }
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
        self.eventos = rows.map { EventoView(evento: $0.0, pistaApelido: $0.1, pistaLayoutNome: $0.2) }
        self.sumarioPorEvento = sumarios
    }

    /// Cria um evento novo. Retorna o ID gerado.
    @discardableResult
    func create(trackId: String?, tipo: String?, dataEvento: Int64,
                status: String? = "planejado") async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "EventoRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de criar eventos."])
        }
        let eventoId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            let ev = Evento(
                id: eventoId,
                timeId: teamId,
                trackId: trackId,
                tipo: tipo,
                dataEvento: dataEvento,
                status: status,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            )
            try ev.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "eventos", rowId: eventoId, op: .insert, record: ev)
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
            try SyncQueue.enqueueRecord(db, tableName: "eventos", rowId: copy.id, op: .update, record: copy)
        }
        try await reload()
    }

    func delete(eventoId: String) async throws {
        try await queue.write { db in
            _ = try Evento.deleteOne(db, key: eventoId)
            try SyncQueue.enqueueRecord(db, tableName: "eventos", rowId: eventoId, op: .delete, record: Evento?.none)
        }
        try await reload()
    }

    /// Lista os stints (sessoes) de um evento, mais recentes primeiro.
    /// Hoje retorna vazio pros eventos seedados — Sprint 1A.3 começa a
    /// popular. UI da detalhe consulta `EventoMockSummary` em paralelo.
    func listStints(eventoId: String) async throws -> [Sessao] {
        try await queue.read { db in
            try Sessao
                .filter(Column("evento_id") == eventoId)
                .order(Column("data_inicio").desc)
                .fetchAll(db)
        }
    }

    /// Detecta se há um evento "ativo hoje" — `data_evento` cai no dia atual.
    /// UI da lista destaca esse card em accent.
    func eventoAtivoHoje() -> EventoView? {
        let cal = Calendar.current
        let hoje = cal.startOfDay(for: Date())
        let amanha = cal.date(byAdding: .day, value: 1, to: hoje)!
        let inicio = Int64(hoje.timeIntervalSince1970 * 1000)
        let fim = Int64(amanha.timeIntervalSince1970 * 1000)
        return eventos.first(where: { $0.evento.dataEvento >= inicio && $0.evento.dataEvento < fim })
    }

    /// Próximo evento futuro (data_evento > final do dia de hoje).
    func proximoEvento() -> EventoView? {
        let cal = Calendar.current
        let amanha = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: Date()))!
        let inicio = Int64(amanha.timeIntervalSince1970 * 1000)
        return eventos
            .filter { $0.evento.dataEvento >= inicio }
            .min(by: { $0.evento.dataEvento < $1.evento.dataEvento })
    }

    /// Look-up O(N) pelo ID — usado pelo detalhe pra reidratar após
    /// reload do repo (sheet/edit não pode segurar ref forte do struct).
    func find(id: String) -> EventoView? {
        eventos.first(where: { $0.id == id })
    }

    // MARK: - Internas (idempotentes)

    private func ensureLocalTime() async throws {
        guard let teamId = TeamContext.currentTeamId else { return }
        try await queue.write { db in
            let exists = try Time.fetchOne(db, key: teamId) != nil
            guard !exists else { return }
            try Time(
                id: teamId,
                nome: "Equipe pessoal",
                criadoPor: nil
            ).insert(db)
        }
    }

    /// Cria a pista "Brasília · Auto. Int. Nelson Piquet" se não existir.
    /// Mantemos o ID alinhado com `SeedBrasilia.trk_brasilia` pra que,
    /// quando Sprint 1A.3 começar a popular sessoes/voltas com seg refs,
    /// não haja conflito.
    private func ensureBrasiliaTrack() async throws {
        try await queue.write { db in
            let exists = try TrackRow.fetchOne(db, key: Self.brasiliaTrackId) != nil
            guard !exists else { return }
            try TrackRow(
                id: Self.brasiliaTrackId,
                apelido: "Brasília",
                nomeOficial: "Auto. Int. Nelson Piquet"
            ).insert(db)
        }
    }

    /// Insere os 3 eventos canônicos do mockup-eventos-lista (1 ativo +
    /// 2 passados) se a tabela `eventos` estiver vazia. Datas batem 1:1
    /// com `_design-reference/mockup-eventos-lista.html`.
    private func seedMockEventosIfEmpty() async throws {
        guard let teamId = TeamContext.currentTeamId else { return }
        try await queue.write { db in
            let total = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM eventos WHERE time_id = ?",
                                          arguments: [teamId]) ?? 0
            guard total == 0 else { return }
            let now = DB.nowMs()
            let entries: [(String, String, String?)] = [
                (Self.seedAtivoId,    "2026-05-02", "track-day"),
                (Self.seedPassado1Id, "2026-04-25", "track-day"),
                (Self.seedPassado2Id, "2026-03-28", "track-day"),
            ]
            for (id, dataISO, tipo) in entries {
                let dataMs = EventoRepository.isoToMs(dataISO)
                try Evento(
                    id: id,
                    timeId: teamId,
                    trackId: Self.brasiliaTrackId,
                    tipo: tipo,
                    dataEvento: dataMs,
                    status: "planejado",
                    createdAt: now,
                    updatedAt: now,
                    syncedAt: nil
                ).insert(db)
            }
        }
    }

    /// Converte `yyyy-MM-dd` em meia-noite **local** pra Int64 ms.
    /// Usar timezone local (e não UTC) é importante: a UI formata
    /// `data_evento` com `TimeZone.current`, então gravar em UTC
    /// causaria drift de 1 dia em fusos negativos (ex: 02-mai UTC
    /// vira 01-mai em GMT-3).
    ///
    /// `nonisolated` porque é puro (DateFormatter local) e precisa
    /// rodar dentro de `queue.write { ... }` (contexto não-MainActor).
    nonisolated static func isoToMs(_ iso: String) -> Int64 {
        let f = DateFormatter()
        f.timeZone = .current
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        guard let date = f.date(from: iso) else { return 0 }
        return Int64(date.timeIntervalSince1970 * 1000)
    }
}

/// Composição "evento + nome da pista" pronta pra View consumir sem
/// precisar fazer outro fetch. Stints/voltas/melhor volta vêm via
/// `sumarioPorEvento` (real do GRDB) ou `EventoMockSummary` (mock
/// canônico) enquanto Sprint 1A.3 não chega.
struct EventoView: Identifiable, Equatable {
    let evento: Evento
    /// `tracks.apelido` (ex: "Brasília"). Pode ser nil se evento não
    /// tem track_id ou track foi deletada — UI mostra "—" nesse caso.
    let pistaApelido: String?
    /// `tracks.nome_oficial` (ex: "Auto. Int. Nelson Piquet"). Mesmo
    /// fallback do apelido.
    let pistaLayoutNome: String?

    var id: String { evento.id }

    /// Apelido da pista ou placeholder pedagógico.
    var pistaDisplay: String { pistaApelido ?? "—" }

    /// Layout curto pra subtítulo do card (segundo segmento do mockup,
    /// "Sábado · Nelson Piquet"). Drop do prefixo "Auto." quando vier.
    var pistaLayoutShort: String {
        guard let nome = pistaLayoutNome else { return "" }
        let prefixos = ["Auto. Int. ", "Auto. ", "Autódromo Internacional ", "Autódromo "]
        for p in prefixos where nome.hasPrefix(p) {
            return String(nome.dropFirst(p.count))
        }
        return nome
    }

    static func == (lhs: EventoView, rhs: EventoView) -> Bool {
        lhs.evento.id == rhs.evento.id &&
        lhs.evento.dataEvento == rhs.evento.dataEvento &&
        lhs.evento.updatedAt == rhs.evento.updatedAt
    }
}

/// Resumo agregado de um evento (real, vindo do GRDB) — pré-computado
/// em `reload()`. Vazio (0/0/nil) pros eventos seedados; UI cai pro
/// `EventoMockSummary` quando isso acontece.
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
