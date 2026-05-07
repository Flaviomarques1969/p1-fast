// ═══════════════════════════════════════════════════════════
// CombustivelRepository — CRUD de combustíveis do time
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #15. Espelha o padrão de PilotoRepository
// (mesmo time-tenant, mesma estrutura). Sincronização com Supabase
// fica pro Sprint 1A.6 (drainer).
//
// Mapeamento de campos (decisão do prompt #15):
//   - mockup "Nome do tipo"  → combustiveis.nome      (NOT NULL)
//   - mockup "Observação"    → combustiveis.tipo      (texto livre, opcional)
//   - octanagem fica fora do form v1 (HelperNote no cadastro avisa).
// Schema canônico v1 não muda — sem migration nova neste PR.
//
// Seed mínimo: 2 combustíveis canônicos ("Etanol comum" + "Gasolina
// aditivada Shell V-Power"). Idempotente — só insere se a tabela
// estiver vazia, mesmo padrão dos pilotos.
//
// IDs estáveis dos seeds são úteis pra tests/screenshots determinís-
// ticos e pra acoplar futuro seletor de stint (Prompt #11/#16).
//
// MS-10 C.3: time_id vem de TeamContext.currentTeamId. Sem login,
// reload retorna lista vazia, mutações lançam erro orientador.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class CombustivelRepository: ObservableObject {
    /// IDs estáveis dos combustíveis seedados — úteis pra screenshots
    /// determinísticos e pra futuro seletor "Tipo abastecido" do
    /// stint (mockup-combustivel-lista é stint-selector na origem).
    static let etanolId = "combustivel-mock-etanol"
    static let gasolinaId = "combustivel-mock-gasolina"

    @Published private(set) var combustiveis: [Combustivel] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + 2 combustíveis canônicos (idempotente).
    /// Chamar uma vez no boot do app antes de qualquer CRUD.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await seedCanonicalIfEmpty()
            try await reload()
        } catch {
            print("CombustivelRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega a lista a partir do GRDB. Ordenado por nome
    /// (mockup-combustivel-lista mostra alfabeticamente).
    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.combustiveis = []
            return
        }
        let rows = try await queue.read { db in
            try Combustivel
                .filter(Column("time_id") == teamId)
                .order(Column("nome").asc)
                .fetchAll(db)
        }
        self.combustiveis = rows
    }

    /// Cria combustível novo. Retorna o ID gerado.
    @discardableResult
    func create(nome: String, observacao: String? = nil) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "CombustivelRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de cadastrar combustíveis."])
        }
        let id = UUID().uuidString
        let now = DB.nowMs()
        let tipo = observacao?.trimmingCharacters(in: .whitespacesAndNewlines)
        try await queue.write { db in
            try Combustivel(
                id: id,
                timeId: teamId,
                nome: nome,
                tipo: (tipo?.isEmpty ?? true) ? nil : tipo,
                octanagem: nil,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        try await reload()
        return id
    }

    func update(combustivel: Combustivel) async throws {
        var copy = combustivel
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            try copy.update(db)
        }
        try await reload()
    }

    func delete(combustivelId: String) async throws {
        try await queue.write { db in
            _ = try Combustivel.deleteOne(db, key: combustivelId)
        }
        try await reload()
    }

    func find(id: String) -> Combustivel? {
        combustiveis.first(where: { $0.id == id })
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

    /// Insere os 2 combustíveis canônicos se a tabela estiver vazia
    /// pro time atual (mesmo padrão dos pilotos). O segundo carrega
    /// `tipo` como observação pra exercitar o campo.
    private func seedCanonicalIfEmpty() async throws {
        guard let teamId = TeamContext.currentTeamId else { return }
        try await queue.write { db in
            let total = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM combustiveis WHERE time_id = ?",
                                          arguments: [teamId]) ?? 0
            guard total == 0 else { return }
            try Combustivel(
                id: Self.etanolId,
                timeId: teamId,
                nome: "Etanol comum",
                tipo: nil
            ).insert(db)
            try Combustivel(
                id: Self.gasolinaId,
                timeId: teamId,
                nome: "Gasolina aditivada Shell V-Power",
                tipo: "Quando o etanol não está disponível"
            ).insert(db)
        }
    }
}
