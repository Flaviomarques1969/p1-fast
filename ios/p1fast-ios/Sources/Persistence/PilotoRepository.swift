// ═══════════════════════════════════════════════════════════
// PilotoRepository — CRUD de pilotos do time
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #12. Espelha o padrão de CarroRepository
// e EventoRepository: thin layer acima do GRDB. Sincronização com
// Supabase fica pro Sprint 1A.6 (drainer).
//
// MS-10 C.3: time_id vem de TeamContext.currentTeamId. Sem login,
// reload retorna lista vazia, mutações lançam erro orientador.
// Bootstrap idempotente — pode ser chamado em paralelo.
//
// Seed canônico: 2 pilotos canônicos (Flavio + Bruno) com IDs
// estáveis pareados ao EventoMockSummary. StintRepository (Prompt #11)
// originalmente seedava esses pilotos como atalho — agora a fonte da
// verdade é este repositório. StintRepository.seedPilotosIfEmpty foi
// removido pra evitar duplicação.
//
// Form atual: só `nome` (espelha o schema canônico v1). Altura/peso/
// idade do mockup ficam pra quando a tabela `pilotos` ganhar essas
// colunas (ADR pendente). user_id (FK auth.users) chega no Sprint 1A.6.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PilotoRepository: ObservableObject {
    /// IDs estáveis dos pilotos seedados — pareiam com
    /// `EventoMockSummary.canonicos`. StintRepository expõe aliases
    /// que apontam pra estes constantes.
    static let pilotoFlavioId = "piloto-mock-flavio"
    static let pilotoBrunoId = "piloto-mock-bruno"

    @Published private(set) var pilotos: [Piloto] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + 2 pilotos canônicos (idempotente). Chamar
    /// uma vez no boot do app antes de qualquer CRUD.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await seedCanonicalIfEmpty()
            try await reload()
        } catch {
            print("PilotoRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega a lista a partir do GRDB. Ordenado por nome
    /// (mockup-piloto-lista mostra alfabeticamente).
    func reload() async throws {
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

    /// Cria piloto novo. Retorna o ID gerado.
    /// Os 3 campos opcionais (altura/peso/nascimento) entraram no schema v2a
    /// (#16). Caller pode omitir tudo — todos default `nil`, salvos como NULL.
    @discardableResult
    func create(
        nome: String,
        alturaCm: Int? = nil,
        pesoKg: Double? = nil,
        nascimento: Int64? = nil
    ) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "PilotoRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de cadastrar pilotos."])
        }
        let pilotoId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            try Piloto(
                id: pilotoId,
                timeId: teamId,
                nome: nome,
                userId: nil,
                alturaCm: alturaCm,
                pesoKg: pesoKg,
                nascimento: nascimento,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        try await reload()
        return pilotoId
    }

    func update(piloto: Piloto) async throws {
        var copy = piloto
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            try copy.update(db)
        }
        try await reload()
    }

    func delete(pilotoId: String) async throws {
        try await queue.write { db in
            _ = try Piloto.deleteOne(db, key: pilotoId)
        }
        try await reload()
    }

    func find(id: String) -> Piloto? {
        pilotos.first(where: { $0.id == id })
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

    /// Insere os 2 pilotos canônicos (Flavio + Bruno) se a tabela
    /// `pilotos` estiver vazia para o time atual. Idempotente.
    private func seedCanonicalIfEmpty() async throws {
        guard let teamId = TeamContext.currentTeamId else { return }
        try await queue.write { db in
            let total = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pilotos WHERE time_id = ?",
                                          arguments: [teamId]) ?? 0
            guard total == 0 else { return }
            try Piloto(id: Self.pilotoFlavioId, timeId: teamId, nome: "Flavio Marx").insert(db)
            try Piloto(id: Self.pilotoBrunoId, timeId: teamId, nome: "Bruno Marx").insert(db)
        }
    }
}
