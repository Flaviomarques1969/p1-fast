// ═══════════════════════════════════════════════════════════
// PassageiroRepository — CRUD de passageiros do time
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #13. Espelha o padrão de PilotoRepository
// (mesmo time-tenant, mesma estrutura). Schema canônico v1 só
// guarda `nome` — altura/peso do mockup ficam pra próxima migração.
//
// MS-10 C.3: time_id vem de TeamContext.currentTeamId. Sem login,
// reload retorna lista vazia, mutações lançam erro orientador.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PassageiroRepository: ObservableObject {
    @Published private(set) var passageiros: [Passageiro] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + recarrega lista. Idempotente.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await reload()
        } catch {
            print("PassageiroRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega a lista a partir do GRDB. Ordenado por nome.
    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.passageiros = []
            return
        }
        let rows = try await queue.read { db in
            try Passageiro
                .filter(Column("time_id") == teamId)
                .order(Column("nome").asc)
                .fetchAll(db)
        }
        self.passageiros = rows
    }

    /// Cria passageiro novo. Retorna o ID gerado.
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
            throw NSError(domain: "PassageiroRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de cadastrar passageiros."])
        }
        let passageiroId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            try Passageiro(
                id: passageiroId,
                timeId: teamId,
                nome: nome,
                alturaCm: alturaCm,
                pesoKg: pesoKg,
                nascimento: nascimento,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        try await reload()
        return passageiroId
    }

    func update(passageiro: Passageiro) async throws {
        var copy = passageiro
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            try copy.update(db)
        }
        try await reload()
    }

    func delete(passageiroId: String) async throws {
        try await queue.write { db in
            _ = try Passageiro.deleteOne(db, key: passageiroId)
        }
        try await reload()
    }

    func find(id: String) -> Passageiro? {
        passageiros.first(where: { $0.id == id })
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
}
