// ═══════════════════════════════════════════════════════════
// StintRepository — CRUD de stints (sessoes) + voltas no GRDB
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #11. Mesmo padrão do CarroRepository e
// EventoRepository: fina camada acima do GRDB. Sincronização com
// Supabase fica pro Sprint 1A.6 (sync drainer já implementado em
// p1fast-core, falta HTTP transport).
//
// Time-tenancy: time_id vem de TeamContext.currentTeamId (MS-10 C.3).
// Sem login, listagens vazias e mutações lançam erro orientador.
// Bootstrap idempotente — pode ser chamado em paralelo.
//
// Pilotos: a fonte da verdade é PilotoRepository (Prompt #12). Aqui
// só queryamos `pilotos` pra alimentar o picker do StintModal — seed
// canônico (Flavio + Bruno) vive em PilotoRepository.bootstrap.
// Callers que precisam dos IDs canônicos referenciam `PilotoRepository.*`
// direto (Sprint 1A.4 #16 removeu os aliases que existiam aqui).
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
    @Published private(set) var pilotos: [Piloto] = []
    /// Stints fetchados do GRDB pelo último `loadByEvento(...)`. Reseta
    /// a cada chamada — é "scoped state" do detalhe de um evento.
    @Published private(set) var stintsPorEvento: [Stint] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + recarrega lista de pilotos. O seed dos
    /// pilotos canônicos é responsabilidade de `PilotoRepository`
    /// (rodar `PilotoRepository.bootstrap()` antes deste no boot).
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await reloadPilotos()
        } catch {
            print("StintRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega só a lista de pilotos. UI do StintModal usa essa
    /// `@Published` array como fonte do picker.
    func reloadPilotos() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.pilotos = []
            return
        }
        let rows = try await queue.read { db in
            try Piloto
                .filter(Column("time_id") == teamId)
                .order(Column("nome").asc)
                .fetchAll(db)
        }
        self.pilotos = rows
    }

    /// Carrega todos os stints (sessoes) de um evento, mais recentes
    /// primeiro, com a contagem de voltas reais embutida em cada item.
    func loadByEvento(eventoId: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.stintsPorEvento = []
            return
        }
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
            return try Row.fetchAll(db, sql: sql, arguments: [eventoId, teamId]).map { row in
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
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "StintRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de criar stints."])
        }
        let stintId = UUID().uuidString
        let now = DB.nowMs()
        let objetivoComposto = composeObjetivo(tipo: objetivoTipo, licao: licaoFocada)
        try await queue.write { db in
            let sessao = Sessao(
                id: stintId,
                timeId: teamId,
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
            )
            try sessao.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: stintId, op: .insert, record: sessao)
        }
        return stintId
    }

    /// Finaliza um stint: grava as voltas geradas (mockadas pra Sprint
    /// 1A.3 — random determinístico em torno de uma média), atualiza
    /// `sessao.dataFim` e marca status='finalizada'.
    ///
    /// MS-2.5 (#?): aceita `segmentEvents` opcional vindo do `Detector`
    /// ao vivo. Cada evento vira uma row em `segment_executions` com o
    /// trio Vmin georef (`vmin_kmh = velMinima * 3.6`, `vmin_x/y` do
    /// `apexActual`). Schema PG/GRDB já tem as 3 colunas (#92, migration
    /// 0007 aplicada em prod 2026-05-06). Sem eventos, `finalize`
    /// continua compatível com chamadas antigas.
    ///
    /// Retorna o stint atualizado (com voltas reais já contadas).
    @discardableResult
    func finalize(
        stintId: String,
        mediaVoltaMs: Int = 103_500,
        segmentEvents: [DetectorSegmentEndEvent] = []
    ) async throws -> Stint {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "StintRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de finalizar stints."])
        }
        let now = DB.nowMs()
        // Devolve (pneu_id, qtVoltas) pra incrementar ciclos do pneu APÓS o
        // commit da escrita — incrementarCiclos abre transação própria.
        let (pneuIdMontado, voltasGeradas): (String?, Int) = try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return (nil, 0) }
            let planejadas = sessao.voltasPlanejadas ?? 0

            // Gera N voltas com tempos plausíveis em torno da média (±5%).
            // Deterministic-ish: usa stintId hash como seed pra mesma sessao
            // dar sempre os mesmos tempos no preview.
            // Mantém um índice numero→voltaId pra mapear segmentEvents abaixo.
            var voltaIdByNumero: [Int: String] = [:]
            let seed = abs(stintId.hashValue)
            for i in 0..<planejadas {
                let jitter = Int(((seed &+ i &* 9973) % 200) - 100) * mediaVoltaMs / 5_000
                // Volta 1 = aquecimento (mais lenta); volta 2+ = perto da média.
                let base = (i == 0) ? mediaVoltaMs + 1500 : mediaVoltaMs
                let tempoMs = base + jitter
                let voltaId = UUID().uuidString
                let numero = i + 1
                let volta = Volta(
                    id: voltaId,
                    timeId: teamId,
                    sessaoId: stintId,
                    numero: numero,
                    tempoMs: tempoMs,
                    temposPorParcial: nil,
                    valida: true,
                    motivoInvalidacao: nil,
                    inicioAt: nil
                )
                try volta.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "voltas", rowId: voltaId, op: .insert, record: volta)
                voltaIdByNumero[numero] = voltaId
            }

            // MS-2.5: persiste 1 SegmentExecution por DetectorSegmentEndEvent.
            // Lógica de mapeamento (m/s → km/h, vmin trio, velocidadeMax) vive
            // em `SegmentExecutionMapper` (core, testado via smoke). Aqui só
            // associa lapNumero → voltaId e insere.
            //
            // Eventos sem lapNumero conhecido OU com lapNumero fora da gama
            // de voltas geradas são silenciosamente ignorados — não há
            // contrato de banco pra associá-los a uma volta.
            for ev in segmentEvents {
                guard let lapNumero = ev.lapNumero,
                      let voltaId = voltaIdByNumero[lapNumero] else { continue }
                let segExec = SegmentExecutionMapper.fromEvent(
                    ev,
                    timeId: teamId,
                    sessaoId: stintId,
                    voltaId: voltaId
                )
                try segExec.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "segment_executions", rowId: segExec.id, op: .insert, record: segExec)
            }

            let pid = sessao.pneuId
            sessao.status = "finalizada"
            sessao.dataFim = now
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: stintId, op: .update, record: sessao)
            return (pid, planejadas)
        }

        // Sprint 1A.4 — auto-incrementa pneus.ciclos quando o stint tem
        // pneu montado. No-op silencioso se pneu_id == nil.
        if let pneuIdMontado, voltasGeradas > 0 {
            try await incrementarCiclos(pneuId: pneuIdMontado, by: voltasGeradas)
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
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: sessao.id, op: .update, record: sessao)
        }
    }

    func find(stintId: String) -> Stint? {
        stintsPorEvento.first(where: { $0.id == stintId })
    }

    // MARK: - Selectors (Sprint 1A.4 — Prompt #17)

    /// Atualiza apenas o `pneu_id` do stint. Passar `nil` desvincula. Usado
    /// pelo `PneuPickerView` no `StintModalView` (Configuração → Pneu
    /// montado). Não bloqueia status — caller decide a regra (UI mantém
    /// edição livre em planejado/ativo e read-only em finalizado).
    func setPneu(stintId: String, pneuId: String?) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            sessao.pneuId = pneuId
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: sessao.id, op: .update, record: sessao)
        }
    }

    /// Atualiza `combustivel_id` + `qt_combustivel_litros` do stint. Cada
    /// um pode ficar `nil` independentemente — usuário pode preencher só a
    /// quantidade ou só o tipo. Mesma regra de status do `setPneu`.
    func setCombustivel(stintId: String, combustivelId: String?, litros: Double?) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            sessao.combustivelId = combustivelId
            sessao.qtCombustivelLitros = litros
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: sessao.id, op: .update, record: sessao)
        }
    }

    /// Soma `voltas` em `pneus.ciclos`. Chamado automaticamente pelo
    /// `finalize(...)` quando o stint tem pneu_id != nil. Idempotência fica
    /// pro caller — chamar duas vezes vai dobrar `ciclos`. No-op quando
    /// `voltas <= 0` ou pneu não existe (protege contra stints fantasmas).
    func incrementarCiclos(pneuId: String, by voltas: Int) async throws {
        guard voltas > 0 else { return }
        let now = DB.nowMs()
        try await queue.write { db in
            guard var pneu = try Pneu.fetchOne(db, key: pneuId) else { return }
            pneu.ciclos += voltas
            pneu.updatedAt = now
            pneu.syncedAt = nil
            try pneu.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "pneus", rowId: pneu.id, op: .update, record: pneu)
        }
    }

    // MARK: - Internas

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
