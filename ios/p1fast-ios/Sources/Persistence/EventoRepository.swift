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
    static let brasiliaTrackId = "e8335412-3312-54fe-b634-db2d02c7fa81"

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

    // MARK: - S8 #18 — Histórico do piloto naquela pista por carro

    /// Resumo de uso de um carro do time numa pista específica, do ponto
    /// de vista do piloto logado. Usado no detalhe de evento futuro pra
    /// mostrar "No Celta — sua melhor volta foi 1:38.142 (15/03)".
    struct CarroPistaResumo: Identifiable, Equatable {
        var id: String { carroId }
        let carroId: String
        let carroApelido: String
        /// Nº de voltas válidas que esse carro já deu nessa pista, pelo piloto.
        let voltasValidas: Int
        /// Melhor volta em ms (nil → "Primeira vez nesse autódromo").
        let melhorVoltaMs: Int?
        /// Quando rolou a melhor volta (ms). Nil quando não há voltas.
        let melhorVoltaQuandoMs: Int64?
        /// Velocidade máxima em km/h (vmax registrada nas execuções). Nil
        /// quando não há dado.
        let vmaxKmh: Double?
    }

    /// S8 #18 — Carrega o histórico do piloto atual em uma pista, separado
    /// por carro. Inclui TODOS os carros do time (recomendação P3 #18:
    /// mostrar todos, mesmo os que nunca correram ali — caem como
    /// "Primeira vez nesse autódromo").
    func loadHistoricoPilotoNaPista(trackId: String) async throws -> [CarroPistaResumo] {
        guard let teamId = TeamContext.currentTeamId else { return [] }
        let pilotoId = TeamContext.currentPilotoId
        return try await queue.read { db -> [CarroPistaResumo] in
            // 1) Todos os carros do time.
            let carros = try Carro
                .filter(Column("time_id") == teamId)
                .order(Column("created_at").desc)
                .fetchAll(db)

            // 2) Pra cada carro, agrega voltas válidas + melhor volta +
            //    vmax em sessões do mesmo carro vinculadas a eventos da
            //    pista alvo e do piloto logado (quando há piloto).
            var resultado: [CarroPistaResumo] = []
            for c in carros {
                let pilotoFiltro = pilotoId != nil ? "AND s.piloto_id = ?" : ""
                var args: [DatabaseValueConvertible] = [c.id, trackId, teamId]
                if let pid = pilotoId { args.append(pid) }

                let voltasRow = try Row.fetchOne(db, sql: """
                    SELECT COUNT(*) AS voltas, MIN(v.tempo_ms) AS melhor,
                           MIN(v.inicio_at) AS quando_min
                    FROM voltas v
                    JOIN sessoes s ON s.id = v.sessao_id
                    JOIN eventos e ON e.id = s.evento_id
                    WHERE s.carro_id = ?
                      AND e.track_id = ?
                      AND v.time_id = ?
                      AND v.valida = 1
                      AND v.tempo_ms IS NOT NULL
                      \(pilotoFiltro)
                    """, arguments: StatementArguments(args))
                let voltas = (voltasRow?["voltas"] as Int?) ?? 0
                let melhor = voltasRow?["melhor"] as Int?
                // Quando da melhor volta (usa inicio_at da volta com tempo mínimo)
                let quandoArgs = StatementArguments([c.id, trackId, teamId] + (pilotoId.map { [$0] } ?? []))
                let quando: Int64? = melhor != nil
                    ? try Int64.fetchOne(db, sql: """
                        SELECT v.inicio_at
                        FROM voltas v
                        JOIN sessoes s ON s.id = v.sessao_id
                        JOIN eventos e ON e.id = s.evento_id
                        WHERE s.carro_id = ?
                          AND e.track_id = ?
                          AND v.time_id = ?
                          AND v.valida = 1
                          AND v.tempo_ms = \(melhor!)
                          \(pilotoFiltro)
                        ORDER BY v.inicio_at DESC LIMIT 1
                        """, arguments: quandoArgs)
                    : nil

                let vmaxArgs = StatementArguments([c.id, trackId, teamId] + (pilotoId.map { [$0] } ?? []))
                let vmaxRow = try Row.fetchOne(db, sql: """
                    SELECT MAX(se.velocidade_max) AS vmax
                    FROM segment_executions se
                    JOIN sessoes s ON s.id = se.sessao_id
                    JOIN eventos e ON e.id = s.evento_id
                    WHERE s.carro_id = ?
                      AND e.track_id = ?
                      AND s.time_id = ?
                      \(pilotoFiltro)
                    """, arguments: vmaxArgs)
                let vmax: Double? = vmaxRow?["vmax"]

                resultado.append(CarroPistaResumo(
                    carroId: c.id,
                    carroApelido: c.apelido,
                    voltasValidas: voltas,
                    melhorVoltaMs: melhor,
                    melhorVoltaQuandoMs: quando,
                    vmaxKmh: vmax
                ))
            }
            return resultado
        }
    }

    /// Input pra criação de um dia filho do evento. Caller informa rótulo
    /// e tipo (ambos opcionais — rótulo nil exibe "Dia de pista DD"; tipo
    /// nil deixa em branco). Data e ordem são derivadas do período.
    struct EventoDiaInput {
        let rotulo: String?
        let tipo: String?

        init(rotulo: String? = nil, tipo: String? = nil) {
            self.rotulo = rotulo
            self.tipo = tipo
        }
    }

    /// Cria um evento novo COM período (data início + fim) e N dias filhos.
    /// 2026-05-16 — substitui a API antiga de 1 data só. dataInicio e
    /// dataFim em ms desde 1970, dia (00:00 local — fuso responsabilidade
    /// do caller). `dias.count` deve casar com (dataFim - dataInicio + 1).
    ///
    /// Retorna o ID do evento criado. Os dias ficam acessíveis via
    /// `listDias(eventoId:)`.
    @discardableResult
    func create(trackId: String?,
                dataInicio: Int64,
                dataFim: Int64,
                dias: [EventoDiaInput],
                status: String? = "planejado") async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "EventoRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de criar eventos."])
        }
        guard !dias.isEmpty else {
            throw NSError(domain: "EventoRepository", code: -2, userInfo: [NSLocalizedDescriptionKey: "Evento precisa de pelo menos 1 dia."])
        }
        let eventoId = UUID().uuidString
        let now = DB.nowMs()
        let umDiaMs: Int64 = 24 * 60 * 60 * 1000

        // 2026-05-16 (regra Flávio): não permitir dois eventos da mesma
        // equipe na mesma pista com algum dia coincidente. Equipe aqui
        // representa o usuário do app (dev tem 1 usuário = 1 equipe).
        let novosDias: [Int64] = (0..<dias.count).map { dataInicio + Int64($0) * umDiaMs }
        if let clash = try await proximoEventoChocando(teamId: teamId, trackId: trackId, dias: novosDias) {
            let dataChoque = Self.dataChoqueFormatada(ms: clash)
            throw NSError(domain: "EventoRepository", code: -3, userInfo: [
                NSLocalizedDescriptionKey: "Já existe outro evento nessa pista no dia \(dataChoque). Não dá pra cadastrar duplicado — abra o evento que já existe ou escolha outra data."
            ])
        }

        try await queue.write { db in
            let ev = Evento(
                id: eventoId,
                timeId: teamId,
                trackId: trackId,
                tipo: nil,                // tipo agora é por dia (P3)
                dataEvento: dataInicio,
                dataFim: dataFim,
                status: status,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            )
            try ev.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "eventos", rowId: eventoId, op: .insert, record: ev)

            for (idx, input) in dias.enumerated() {
                let diaMs = dataInicio + Int64(idx) * umDiaMs
                let diaId = UUID().uuidString
                let dia = EventoDia(
                    id: diaId,
                    timeId: teamId,
                    eventoId: eventoId,
                    dataDia: diaMs,
                    rotulo: input.rotulo,
                    tipo: input.tipo,
                    ordem: idx,
                    createdAt: now,
                    updatedAt: now,
                    syncedAt: nil
                )
                try dia.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "evento_dias", rowId: diaId, op: .insert, record: dia)
            }
        }
        try await reload()
        return eventoId
    }

    /// Retorna o data_dia (em ms) do primeiro choque encontrado, ou nil
    /// se não há conflito. Choque = mesmo time + mesma pista + algum
    /// data_dia coincidente com a lista de novos dias.
    private func proximoEventoChocando(teamId: String, trackId: String?, dias: [Int64]) async throws -> Int64? {
        guard !dias.isEmpty else { return nil }
        return try await queue.read { db in
            let placeholders = dias.map { _ in "?" }.joined(separator: ",")
            var args: [DatabaseValueConvertible?] = [teamId]
            let trackClause: String
            if let trackId {
                trackClause = "AND e.track_id = ?"
                args.append(trackId)
            } else {
                trackClause = "AND e.track_id IS NULL"
            }
            args.append(contentsOf: dias.map { $0 as DatabaseValueConvertible? })
            let sql = """
                SELECT ed.data_dia
                FROM evento_dias ed
                JOIN eventos e ON e.id = ed.evento_id
                WHERE e.time_id = ?
                \(trackClause)
                AND ed.data_dia IN (\(placeholders))
                ORDER BY ed.data_dia ASC
                LIMIT 1
            """
            return try Int64.fetchOne(db, sql: sql, arguments: StatementArguments(args))
        }
    }

    private static func dataChoqueFormatada(ms: Int64) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: Date(timeIntervalSince1970: TimeInterval(ms) / 1000))
    }

    /// Lista os dias filhos de um evento, em ordem cronológica.
    func listDias(eventoId: String) async throws -> [EventoDia] {
        try await queue.read { db in
            try EventoDia
                .filter(Column("evento_id") == eventoId)
                .order(Column("ordem").asc)
                .fetchAll(db)
        }
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
                nomeOficial: "Auto. Int. Nelson Piquet",
                cidade: "Brasília" // S4 rodada 1
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
