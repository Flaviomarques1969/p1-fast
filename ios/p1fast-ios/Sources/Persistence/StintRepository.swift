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
// Voltas: na criação do stint só temos `voltas_planejadas`. As voltas
// REAIS são gravadas pelo PAINEL ao cruzar a linha de chegada, direto na
// nuvem, com origem='painel-ao-vivo' (web/cockpit/voltas-persister.js +
// migração 0040 — contagem real, autorização Flávio 10-11/06/2026).
// `finalize(...)` aqui só fecha a sessão (dataFim + status) e persiste
// segment_executions de eventos com volta conhecida.
//
// HISTÓRICO: a Sprint 1A.3 gerava voltas FAKE ao finalizar (gerador
// determinístico) — removido em 11/06/2026; inflava a vida útil e
// contaria 2× com a gravação real ligada.

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
                    // MS-4.5: cancelado_em vem do SELECT s.* — usamos pra
                    // mostrar tag "cancelado" e cor opaca na listagem.
                    canceladoEm: row["cancelado_em"],
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
    /// `eventoId` é OPCIONAL desde 15/06/2026: nil = Stint SOLTO (sem evento),
    /// decisão Flávio "o Stint pode ser livre". A coluna `evento_id` em
    /// `sessoes` já é nullable (ON DELETE SET NULL) e a tabela sincroniza com
    /// `time_id` direto — não depende de evento. Callers antigos que passam
    /// String seguem compilando (String coage pra String?).
    @discardableResult
    func create(eventoId: String?, pilotoId: String, objetivoTipo: String,
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

            // CONTAGEM REAL (autorização Flávio 10-11/06/2026): o app NÃO gera
            // mais voltas provisórias ao finalizar (mock da Sprint 1A.3). As
            // voltas DE VERDADE são gravadas pelo painel ao cruzar a linha de
            // chegada, direto na nuvem, com origem='painel-ao-vivo'
            // (web/cockpit/voltas-persister.js + migração 0040). O mock inflava
            // a vida útil e contaria 2× com a gravação real ligada.
            // Índice numero→voltaId fica vazio: segmentEvents sem volta local
            // continuam sendo ignorados pelo contrato existente (abaixo).
            let voltaIdByNumero: [Int: String] = [:]

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
            // Sem voltas geradas: ciclos do pneu passam a derivar das voltas
            // REAIS da nuvem (contagem real) — incremento local desligado.
            return (pid, 0)
        }

        // Sprint 1A.4 — auto-incrementa pneus.ciclos quando o stint tem
        // pneu montado. Desligado na contagem real (voltasGeradas é sempre 0;
        // o ciclo verdadeiro vem das voltas origem='painel-ao-vivo' na nuvem).
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

    // MARK: - MS-4 (StintPlan estendido)

    /// Lê um Sessao completo (com todos os campos novos do MS-4.1).
    /// Usado pela UI quando precisa dos campos extendidos (paradas_box,
    /// ia_ligada, mapa_ghost_ligado, licao_id, etc.). Os métodos
    /// `loadByEvento` e `fetchStint` continuam usando SQL manual sem os
    /// novos campos pra não quebrar a Stint legado.
    func fetchSessaoCompleta(id: String) async throws -> Sessao? {
        try await queue.read { db in
            try Sessao.fetchOne(db, key: id)
        }
    }

    /// Atualiza os campos novos do StintPlan (MS-4.1). Passar `nil` em
    /// qualquer parâmetro preserva o valor atual. Use `setStintParadas` /
    /// `setStintLicao` etc. se quiser mais explícito.
    ///
    /// Convenção: paradas vazias = `[]`, revezamento vazio = nil.
    func setStintExtensions(
        stintId: String,
        paradas: [ParadaBox]? = nil,
        iaLigada: Bool? = nil,
        mapaGhostLigado: Bool? = nil,
        licaoId: String?? = nil,
        pilotosRevezamento: [PilotoTurno]?? = nil,
        convidadoId: String?? = nil
    ) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            if let paradas = paradas { sessao.setParadasBox(paradas) }
            if let v = iaLigada { sessao.iaLigada = v }
            if let v = mapaGhostLigado { sessao.mapaGhostLigado = v }
            if case .some(let v) = licaoId { sessao.licaoId = v }
            if case .some(let v) = pilotosRevezamento { sessao.setPilotosRevezamento(v) }
            if case .some(let v) = convidadoId { sessao.convidadoId = v }
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: sessao.id, op: .update, record: sessao)
        }
    }

    /// Cancela um stint marcando `cancelado_em = now()` + `status = 'cancelada'`.
    /// NÃO deleta a row (Q24 da rodada 1 — Flávio quer histórico preservado).
    /// No-op se o stint não existir.
    func cancel(stintId: String) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var sessao = try Sessao.fetchOne(db, key: stintId) else { return }
            sessao.canceladoEm = now
            sessao.status = "cancelada"
            sessao.updatedAt = now
            sessao.syncedAt = nil
            try sessao.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "sessoes", rowId: sessao.id, op: .update, record: sessao)
        }
    }

    /// Detecta se o evento permite revezamento de pilotos (endurance).
    /// Regra (Q2.2): se `eventos.tipo` contém "endurance" (case-insensitive),
    /// retorna true. Em outros tipos (Track Day, Treino livre), retorna false.
    /// Usado pela `StintModalView` em MS-4.4 pra mostrar UI de revezamento.
    /// Lógica pura em `EnduranceDetection.tipoPermiteRevezamento` (testada
    /// em P1FastSmoke END-01..04).
    func eventoPermiteRevezamento(eventoId: String) async -> Bool {
        do {
            return try await queue.read { db in
                guard let evento = try Evento.fetchOne(db, key: eventoId) else { return false }
                return EnduranceDetection.tipoPermiteRevezamento(evento.tipo)
            }
        } catch {
            return false
        }
    }

    // MARK: - Sync legacy (mantido pra finalize compat)

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

    /// Status canônico — "ativa", "finalizada", "planejada", "cancelada".
    var status: String { sessao.status ?? "planejada" }

    var isFinalizado: Bool { status == "finalizada" }
    var isAtivo: Bool { status == "ativa" }
    /// MS-4.5: stint cancelado tem `cancelado_em` preenchido e
    /// `status='cancelada'`. NÃO some da listagem (decisão Q24).
    var isCancelado: Bool { sessao.canceladoEm != nil }
    /// Permite cancelar somente stints ativos (status='ativa').
    /// Stints já finalizados ou cancelados não podem voltar atrás.
    var podeCancelar: Bool { isAtivo && !isCancelado }

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

// ═══════════════════════════════════════════════════════════
// EnvelopeAprovacao — grava o envelope de segurança + plano na nuvem
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 15/06/2026 ("uma tela só" + "MIGRAR PARA PRODUÇÃO"): ao
// aprovar um Stint no celular, o app assume o papel que o computador fazia —
// grava uma linha em `envelopes_seguranca_stint` com o plano do stint
// (plano_stint). O painel da pista lê o plano do ÚLTIMO envelope do carro.
//
// MESMO contrato que web/cockpit/configuracao-stint.js (aprovarEnvelope):
//   - escrita DIRETA na nuvem (POST /rest/v1/envelopes_seguranca_stint),
//     fora da sincronização (a tabela não está em ALLOWED_TABLES);
//   - cabeçalhos Supabase iguais aos do resto do app (apikey + Bearer);
//   - a tabela está sem trava de linha (RLS desligada) — POST autenticado passa;
//   - plano-B idêntico ao da web: se o banco não tiver a coluna plano_stint
//     (PGRST204), regrava SEM o plano pra a aprovação não falhar, e devolve
//     `planoFicouSoLocal = true` pra a tela contar a verdade.
//
// Valores de segurança vêm de P1FastCore.EnvelopeDefaultBubi (PORT FIEL do
// perfil real do Bubi). Nada inventado aqui.
enum EnvelopeAprovacao {

    struct Resultado {
        /// `true` quando o banco não tinha a coluna plano_stint e o envelope
        /// foi gravado SEM o plano (o painel não vai armar o treino).
        let planoFicouSoLocal: Bool
        /// id do envelope criado (8 primeiros chars), pra mensagem da tela.
        let envelopeIdCurto: String
    }

    struct Falha: LocalizedError {
        let mensagem: String
        var errorDescription: String? { mensagem }
    }

    /// Corpo do POST — colunas snake_case da tabela. `vida_pneu_faixa` é
    /// OMITIDO de propósito (o celular ainda não pergunta a faixa de vida do
    /// pneu) → o banco usa o default '0-30'. `plano_stint` é opcional só pra o
    /// plano-B (quando nil, a chave some do JSON e o banco grava só o envelope).
    private struct Payload: Encodable {
        let carro_id: String
        let modo_stint: String
        let tipo_pneu: String
        let config_cambio: String
        let rpm_max_absoluto: Int
        let rpm_min_motor_celsius: Int
        let forca_lateral_max_g: Double
        let observacoes: String
        var plano_stint: PlanoStint?
    }

    /// Grava o envelope + plano. Lança `Falha` em erro de rede/HTTP que não
    /// seja o caso "banco sem a coluna" (esse é tratado pelo plano-B).
    static func gravar(carroId: String, tipoPneu: String, plano: PlanoStint) async throws -> Resultado {
        guard let base = Configuration.supabaseBaseUrl else {
            throw Falha(mensagem: "Nuvem não configurada (sem credenciais).")
        }
        let url = base.appendingPathComponent("rest/v1/envelopes_seguranca_stint")

        let tipo = tipoPneu.isEmpty ? "desconhecido" : tipoPneu
        let observacoes = "Envelope aprovado via app (celular). Máximo desempenho — "
            + "troca na potência máxima (\(EnvelopeDefaultBubi.picoPotenciaRpm) rpm), "
            + "teto \(EnvelopeDefaultBubi.redlineRpm)."

        var payload = Payload(
            carro_id: carroId,
            modo_stint: ModoStint.registro,
            tipo_pneu: tipo,
            config_cambio: "padrao",
            rpm_max_absoluto: EnvelopeDefaultBubi.rpmMaxAbsoluto,
            rpm_min_motor_celsius: EnvelopeDefaultBubi.rpmMinMotorCelsius,
            forca_lateral_max_g: EnvelopeDefaultBubi.forcaLateralMaxG,
            observacoes: observacoes,
            plano_stint: plano
        )

        let (data1, status1, body1) = try await post(url: url, payload: payload)
        if (200...299).contains(status1) {
            return Resultado(planoFicouSoLocal: false, envelopeIdCurto: idCurto(data1))
        }

        // Plano-B: banco sem a coluna plano_stint (migration 0042 não aplicada).
        // Mesma decisão da web: a aprovação NÃO pode falhar por causa do plano.
        if status1 == 400, body1.contains("PGRST204"), body1.contains("plano_stint") {
            payload.plano_stint = nil
            let (data2, status2, body2) = try await post(url: url, payload: payload)
            guard (200...299).contains(status2) else {
                throw Falha(mensagem: "HTTP \(status2): \(body2)")
            }
            return Resultado(planoFicouSoLocal: true, envelopeIdCurto: idCurto(data2))
        }

        throw Falha(mensagem: "HTTP \(status1): \(body1)")
    }

    private static func post(url: URL, payload: Payload) async throws -> (Data, Int, String) {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(Configuration.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(Configuration.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw Falha(mensagem: "Sem resposta da nuvem.")
        }
        let body = String(data: data, encoding: .utf8) ?? ""
        return (data, http.statusCode, body)
    }

    /// PostgREST com Prefer=return=representation devolve `[{ id, ... }]`.
    private static func idCurto(_ data: Data) -> String {
        if let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
           let id = arr.first?["id"] as? String {
            return String(id.prefix(8))
        }
        return "?"
    }
}
