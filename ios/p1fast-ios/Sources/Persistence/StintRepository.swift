// ═══════════════════════════════════════════════════════════
// StintRepository — CRUD de stints (sessoes) + voltas no GRDB
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #11. Mesmo padrão do CarroRepository e
// EventoRepository: fina camada acima do GRDB. Sincronização com
// Supabase fica pro Sprint 1A.6 (sync drainer já implementado em
// p1fast-core, falta HTTP transport).
//
// Time-tenancy: usa o mesmo `local-default-team` dos outros repos.
// Bootstrap idempotente — pode ser chamado em paralelo.
//
// Pilotos: como ainda não tem CRUD próprio (Prompt #12), o bootstrap
// seeda 2 pilotos canônicos ("Flavio Marx" + "Bruno Marx") pareados
// com EventoMockSummary. Substituídos pelo CRUD real quando Prompt #12
// chegar.
//
// Voltas: na criação do stint só temos `voltas_planejadas`. As linhas
// reais em `voltas` chegam quando o stint é finalizado — esse repo
// expõe `finalize(...)` que recebe a lista de tempos e grava todas as
// voltas + atualiza `sessao.dataFim` + status='finalizada'.
//
// Sprint 1A.3 trabalha com voltas FAKE (geradas ao finalizar com um
// gerador determinístico). Sprint 1B substitui pelo input do cockpit
// real (telemetria + cronômetro automatizado).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class StintRepository: ObservableObject {
    /// Mesmo ID dos outros repos (single-tenant até 1A.6).
    static let localTimeId = "local-default-team"

    /// IDs estáveis dos pilotos seedados — pareiam com
    /// `EventoMockSummary.canonicos` (Flavio = stints 1-3, Bruno = #4
    /// no evento de 25/04).
    static let pilotoFlavioId = "piloto-mock-flavio"
    static let pilotoBrunoId = "piloto-mock-bruno"

    @Published private(set) var pilotos: [Piloto] = []
    /// Stints fetchados do GRDB pelo último `loadByEvento(...)`. Reseta
    /// a cada chamada — é "scoped state" do detalhe de um evento.
    @Published private(set) var stintsPorEvento: [Stint] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + 2 pilotos canônicos (idempotente). Chamar
    /// uma vez no boot do app antes de qualquer CRUD de stint.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await seedPilotosIfEmpty()
            try await reloadPilotos()
        } catch {
            print("StintRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega só a lista de pilotos. UI do StintModal usa essa
    /// `@Published` array como fonte do picker.
    func reloadPilotos() async throws {
        let rows = try await queue.read { db in
            try Piloto
                .filter(Column("time_id") == Self.localTimeId)
                .order(Column("nome").asc)
                .fetchAll(db)
        }
        self.pilotos = rows
    }

    /// Carrega todos os stints (sessoes) de um evento, mais recentes
    /// primeiro, com a contagem de voltas reais embutida em cada item.
    func loadByEvento(eventoId: String) async throws {
        let rows: [(Sessao, Int, Int?, String?)] = try await queue.read { db in
            // sessoes + COUNT(voltas) + MIN(tempo_ms valida=1) + piloto.nome
            let sql = """
                SELECT s.*,
                       COUNT(v.id)                                AS voltas_count,
                       MIN(CASE WHEN v.valida = 1 THEN v.tempo_ms END) AS melhor_ms,
                       p.nome                                     AS piloto_nome
                FROM sessoes s
                LEFT JOIN voltas v ON v.sessao_id = s.id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                WHERE s.evento_id = ?
                  AND s.time_id = ?
                GROUP BY s.id
                ORDER BY s.data_inicio DESC, s.created_at DESC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [eventoId, Self.localTimeId]).map { row in
                let sessao = Sessao(
                    id: row["id"],
                    timeId: row["time_id"],
                    eventoId: row["evento_id"],
                    carroId: row["carro_id"],
                    pilotoId: row["piloto_id"],
                    configuracaoId: row["configuracao_id"],
                    status: row["status"],
                    dataInicio: row["data_inicio"],
                    dataFim: row["data_fim"],
                    voltasPlanejadas: row["voltas_planejadas"],
                    objetivo: row["objetivo"],
                    createdAt: row["created_at"],
                    updatedAt: row["updated_at"],
                    syncedAt: row["synced_at"]
                )
                let voltasCount: Int = row["voltas_count"] ?? 0
                let melhorMs: Int? = row["melhor_ms"]
                let pilotoNome: String? = row["piloto_nome"]
                return (sessao, voltasCount, melhorMs, pilotoNome)
            }
        }
        self.stintsPorEvento = rows.map { Stint(sessao: $0.0, voltasCount: $0.1, melhorVoltaMs: $0.2, pilotoNome: $0.3) }
    }

    /// Cria um stint (sessao) novo no estado "ativa". Retorna o ID.
    /// `objetivo` no schema canônico SEED_OBJETIVO_TIPOS (Aquecimento,
    /// Ataque, Consistência, Teste, Livre). `licaoFocada` é texto livre
    /// armazenado no mesmo campo `objetivo` separado por " · " — não
    /// temos coluna dedicada ainda (Sprint 1A.3 #16 entrega catálogo).
    @discardableResult
    func create(eventoId: String, pilotoId: String, objetivoTipo: String,
                licaoFocada: String, voltasPlanejadas: Int) async throws -> String {
        let stintId = UUID().uuidString
        let now = DB.nowMs()
        let objetivoComposto = composeObjetivo(tipo: objetivoTipo, licao: licaoFocada)
        try await queue.write { db in
            try Sessao(
                id: stintId,
                timeId: Self.localTimeId,
                eventoId: eventoId,
                carroId: nil,
                pilotoId: pilotoId,
                configuracaoId: nil,
                status: "ativa",
                dataInicio: now,
                dataFim: nil,
                voltasPlanejadas: voltasPlanejadas,
                objetivo: objetivoComposto,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        return stintId
    }

    /// Finaliza um stint: grava as voltas geradas (mockadas pra Sprint
    /// 1A.3 — random determinístico em torno de uma média), atualiza
    /// `sessao.dataFim` e marca status='finalizada'.
    ///
    /// Retorna o stint atualizado (com voltas reais já contadas).
    @discardableResult
    func finalize(stintId: String, mediaVoltaMs: Int = 103_500) async throws -> Stint {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            let planejadas = sessao.voltasPlanejadas ?? 0

            // Gera N voltas com tempos plausíveis em torno da média (±5%).
            // Deterministic-ish: usa stintId hash como seed pra mesma sessao
            // dar sempre os mesmos tempos no preview.
            let seed = abs(stintId.hashValue)
            for i in 0..<planejadas {
                let jitter = Int(((seed &+ i &* 9973) % 200) - 100) * mediaVoltaMs / 5_000
                // Volta 1 = aquecimento (mais lenta); volta 2+ = perto da média.
                let base = (i == 0) ? mediaVoltaMs + 1500 : mediaVoltaMs
                let tempoMs = base + jitter
                try Volta(
                    id: UUID().uuidString,
                    timeId: Self.localTimeId,
                    sessaoId: stintId,
                    numero: i + 1,
                    tempoMs: tempoMs,
                    temposPorParcial: nil,
                    valida: true,
                    motivoInvalidacao: nil,
                    inicioAt: nil
                ).insert(db)
            }

            sessao.status = "finalizada"
            sessao.dataFim = now
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
        }

        // Recarrega o stint pra UI receber tudo composto.
        return try await fetchStint(id: stintId)
    }

    /// Lê um stint específico decorado (com voltas count + melhor +
    /// nome do piloto). Usado pelo Pós-Stint pra renderizar header.
    func fetchStint(id: String) async throws -> Stint {
        try await queue.read { db in
            let sql = """
                SELECT s.*,
                       COUNT(v.id)                                AS voltas_count,
                       MIN(CASE WHEN v.valida = 1 THEN v.tempo_ms END) AS melhor_ms,
                       p.nome                                     AS piloto_nome
                FROM sessoes s
                LEFT JOIN voltas v ON v.sessao_id = s.id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                WHERE s.id = ?
                GROUP BY s.id
            """
            guard let row = try Row.fetchOne(db, sql: sql, arguments: [id]) else {
                throw StintRepoError.notFound(id)
            }
            let sessao = Sessao(
                id: row["id"],
                timeId: row["time_id"],
                eventoId: row["evento_id"],
                carroId: row["carro_id"],
                pilotoId: row["piloto_id"],
                configuracaoId: row["configuracao_id"],
                status: row["status"],
                dataInicio: row["data_inicio"],
                dataFim: row["data_fim"],
                voltasPlanejadas: row["voltas_planejadas"],
                objetivo: row["objetivo"],
                createdAt: row["created_at"],
                updatedAt: row["updated_at"],
                syncedAt: row["synced_at"]
            )
            let voltasCount: Int = row["voltas_count"] ?? 0
            let melhorMs: Int? = row["melhor_ms"]
            let pilotoNome: String? = row["piloto_nome"]
            return Stint(sessao: sessao, voltasCount: voltasCount, melhorVoltaMs: melhorMs, pilotoNome: pilotoNome)
        }
    }

    /// Lista todas as voltas de um stint, ordenadas por número.
    func voltas(stintId: String) async throws -> [Volta] {
        try await queue.read { db in
            try Volta
                .filter(Column("sessao_id") == stintId)
                .order(Column("numero").asc)
                .fetchAll(db)
        }
    }

    /// Atualiza só a nota do stint (campo `objetivo` — extender depois).
    /// Concatena com o objetivo+lição existente preservando o prefixo.
    func saveNota(stintId: String, nota: String) async throws {
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            let prefixo = sessao.objetivo ?? ""
            let separador = " · nota: "
            let semNotaAntiga = prefixo.components(separatedBy: separador).first ?? prefixo
            let trimmed = nota.trimmingCharacters(in: .whitespaces)
            sessao.objetivo = trimmed.isEmpty ? semNotaAntiga : "\(semNotaAntiga)\(separador)\(trimmed)"
            sessao.updatedAt = DB.nowMs()
            sessao.syncedAt = nil
            try sessao.update(db)
        }
    }

    func find(stintId: String) -> Stint? {
        stintsPorEvento.first(where: { $0.id == stintId })
    }

    // MARK: - Internas

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

    /// Insere os 2 pilotos canônicos do mockup-evento-detalhe se a
    /// tabela `pilotos` estiver vazia. Substituído pelo CRUD real quando
    /// Prompt #12 chegar.
    private func seedPilotosIfEmpty() async throws {
        try await queue.write { db in
            let total = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pilotos WHERE time_id = ?",
                                          arguments: [Self.localTimeId]) ?? 0
            guard total == 0 else { return }
            try Piloto(id: Self.pilotoFlavioId, timeId: Self.localTimeId, nome: "Flavio Marx").insert(db)
            try Piloto(id: Self.pilotoBrunoId, timeId: Self.localTimeId, nome: "Bruno Marx").insert(db)
        }
    }

    /// Compose `<tipo> · <licao>` no campo `objetivo` da sessao.
    /// Exemplo: "Ataque · V-Min · apex". Quando `licao` vazia, só `tipo`.
    private func composeObjetivo(tipo: String, licao: String) -> String {
        let trimmedLicao = licao.trimmingCharacters(in: .whitespaces)
        if trimmedLicao.isEmpty { return tipo }
        return "\(tipo) · \(trimmedLicao)"
    }
}

/// Composição "sessao + voltas count + melhor volta + piloto nome" pra
/// View consumir sem precisar joinar manualmente. Substitui o uso direto
/// de `Sessao` no UI layer.
struct Stint: Identifiable, Equatable {
    let sessao: Sessao
    let voltasCount: Int
    let melhorVoltaMs: Int?
    let pilotoNome: String?

    var id: String { sessao.id }

    static func == (lhs: Stint, rhs: Stint) -> Bool {
        lhs.sessao.id == rhs.sessao.id
            && lhs.voltasCount == rhs.voltasCount
            && lhs.melhorVoltaMs == rhs.melhorVoltaMs
            && lhs.pilotoNome == rhs.pilotoNome
            && lhs.sessao.updatedAt == rhs.sessao.updatedAt
    }

    /// Status canônico — "ativa", "finalizada", "planejada".
    var status: String { sessao.status ?? "planejada" }

    var isFinalizado: Bool { status == "finalizada" }
    var isAtivo: Bool { status == "ativa" }

    /// Decompose `objetivo` que foi gravado como `<tipo> · <licao>`.
    /// Retorna ("Ataque", "V-Min · apex") por exemplo. Quando não tem
    /// separador, todo o texto cai em `tipo`.
    var objetivoDecomposto: (tipo: String, licao: String) {
        let raw = sessao.objetivo ?? ""
        // Remove anexo de nota se houver (` · nota: ...`) — `saveNota` separa por isso.
        let semNota = raw.components(separatedBy: " · nota: ").first ?? raw
        let parts = semNota.split(separator: "·", maxSplits: 1, omittingEmptySubsequences: false).map {
            $0.trimmingCharacters(in: .whitespaces)
        }
        if parts.count == 2 { return (parts[0], parts[1]) }
        return (parts.first ?? "", "")
    }

    /// Extrai a nota livre que `saveNota` anexou após `· nota: `.
    var nota: String {
        let raw = sessao.objetivo ?? ""
        let parts = raw.components(separatedBy: " · nota: ")
        return parts.count > 1 ? parts.last ?? "" : ""
    }
}

enum StintRepoError: Error, LocalizedError {
    case notFound(String)

    var errorDescription: String? {
        switch self {
        case .notFound(let id): return "Stint \(id) não encontrado."
        }
    }
}

/// Catálogo dos 5 tipos canônicos de objetivo (espelho de
/// `SEED_OBJETIVO_TIPOS` em src/data/schemas.js). Match de duplicata
/// é case-insensitive — substituído por `objetivoTipos` runtime quando
/// CRUD de catálogos chegar (Prompt #16).
enum StintObjetivoTipos {
    static let canonicos: [String] = [
        "Aquecimento",
        "Ataque",
        "Consistência",
        "Teste",
        "Livre",
    ]
}
