// ═══════════════════════════════════════════════════════════
// PassageiroRepository — CRUD de passageiros do time
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #13. Espelha o padrão de PilotoRepository
// (mesmo time-tenant, mesma estrutura). Schema canônico v1 só
// guarda `nome` — altura/peso do mockup ficam pra próxima migração.
//
// Sem seed canônico — mockup-passageiro-lista mostra "Bruno Marx"
// e "Alain Mesquita" mas isso é placeholder ilustrativo. App real
// começa com lista vazia (estado canônico do mockup).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PassageiroRepository: ObservableObject {
    /// Mesmo ID dos outros repos (single-tenant até 1A.6).
    static let localTimeId = "local-default-team"

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
        let rows = try await queue.read { db in
            try Passageiro
                .filter(Column("time_id") == Self.localTimeId)
                .order(Column("nome").asc)
                .fetchAll(db)
        }
        self.passageiros = rows
    }

    /// Cria passageiro novo. Retorna o ID gerado.
    @discardableResult
    func create(nome: String) async throws -> String {
        let passageiroId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            try Passageiro(
                id: passageiroId,
                timeId: Self.localTimeId,
                nome: nome,
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
