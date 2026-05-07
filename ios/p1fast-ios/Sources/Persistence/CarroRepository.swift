// ═══════════════════════════════════════════════════════════
// CarroRepository — CRUD de carros sobre o DatabaseQueue local
// ═══════════════════════════════════════════════════════════
// Fina camada acima do GRDB (P1FastCore.DB). Sincronização com
// Supabase fica pro Sprint 1A.6 (sync drainer). Por enquanto tudo
// vive só no SQLite do device.
//
// Time-tenancy: schema requer `time_id` em todo carro/configuracao.
// MS-10 C.3: time_id vem de `TeamContext.currentTeamId` (populado
// pelo SessionManager após login + RPC ensure_personal_team).
// Quando nil (sem login), reload retorna lista vazia e mutações
// viram no-op. `ensureLocalTime` cria o registro local em `times`
// pra atender a FK na primeira escrita.
//
// Thread-safety: GRDB DatabaseQueue serializa I/O. As funções `read*`
// rodam async e não bloqueiam o UI thread.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class CarroRepository: ObservableObject {
    @Published private(set) var carros: [Carro] = []
    @Published private(set) var stintsPorCarro: [String: Int] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante que existe um time local + recarrega lista. Chamar uma vez
    /// no boot, depois a UI usa `reload()` quando precisar refresh manual.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            try await reload()
        } catch {
            // Não derruba o app — UI mostra lista vazia.
            print("CarroRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.carros = []
            self.stintsPorCarro = [:]
            return
        }
        let rows = try await queue.read { db in
            try Carro
                .filter(Column("time_id") == teamId)
                .order(Column("created_at").desc)
                .fetchAll(db)
        }
        let counts = try await queue.read { db -> [String: Int] in
            // Conta sessões por carro (aproximação de "stints" enquanto a tabela
            // de stints não chegou — Sprint 1A.3). Hoje retorna 0 pra todos.
            let sql = """
                SELECT carro_id, COUNT(*) FROM sessoes
                WHERE carro_id IS NOT NULL
                GROUP BY carro_id
            """
            return try Row.fetchAll(db, sql: sql).reduce(into: [:]) { acc, row in
                acc[row[0]] = row[1]
            }
        }
        self.carros = rows
        self.stintsPorCarro = counts
    }

    /// Cria um carro novo + uma `Configuracao` vazia (placeholder de
    /// setup base). Retorna o ID gerado.
    @discardableResult
    func create(apelido: String, modelo: String?, categoria: String?, cor: String?) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "CarroRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de cadastrar carros."])
        }
        let carroId = UUID().uuidString
        let configId = UUID().uuidString
        let now = DB.nowMs()
        try await queue.write { db in
            try Carro(
                id: carroId,
                timeId: teamId,
                apelido: apelido,
                modelo: modelo,
                categoria: categoria,
                cor: cor,
                fonteTemperatura: .motor,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
            try Configuracao(
                id: configId,
                timeId: teamId,
                carroId: carroId,
                nome: "Setup base",
                dataAplicacao: now,
                overrides: nil,
                temperaturaIdealRange: nil,
                createdAt: now,
                updatedAt: now,
                syncedAt: nil
            ).insert(db)
        }
        try await reload()
        return carroId
    }

    func update(carro: Carro) async throws {
        var copy = carro
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            try copy.update(db)
        }
        try await reload()
    }

    func delete(carroId: String) async throws {
        try await queue.write { db in
            _ = try Carro.deleteOne(db, key: carroId)
        }
        try await reload()
    }

    /// Lê a Configuracao "Setup base" do carro (a primeira criada com ele).
    func loadConfiguracao(carroId: String) async throws -> Configuracao? {
        try await queue.read { db in
            try Configuracao
                .filter(Column("carro_id") == carroId)
                .order(Column("created_at").asc)
                .fetchOne(db)
        }
    }

    /// Persiste o JSON de overrides na Configuracao "Setup base".
    func saveOverrides(carroId: String, overridesJSON: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "CarroRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de salvar."])
        }
        try await queue.write { db in
            let row = try Configuracao
                .filter(Column("carro_id") == carroId)
                .order(Column("created_at").asc)
                .fetchOne(db)
            if var c = row {
                c.overrides = overridesJSON
                c.updatedAt = DB.nowMs()
                c.syncedAt = nil
                try c.update(db)
            } else {
                try Configuracao(
                    id: UUID().uuidString,
                    timeId: teamId,
                    carroId: carroId,
                    nome: "Setup base",
                    dataAplicacao: DB.nowMs(),
                    overrides: overridesJSON,
                    temperaturaIdealRange: nil
                ).insert(db)
            }
        }
    }

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
