// ═══════════════════════════════════════════════════════════
// PneuRepository — CRUD de pneus por carro
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #14. Pneus têm FK obrigatória pra `carros`,
// então o estado é mantido como `[carroId: [Pneu]]` em vez de uma
// lista flat (cada CarroModalView observa só os pneus do seu carro).
//
// Sem seed canônico — pneus são per-carro do usuário, então qualquer
// seed seria ruído (diferente de combustíveis/pilotos, que fazem
// sentido pré-popular). Bootstrap só garante o time local + hidrata.
//
// MS-10 C.3: time_id vem de TeamContext.currentTeamId. Sem login,
// loadAll deixa o map vazio.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PneuRepository: ObservableObject {
    @Published private(set) var pneusByCarroId: [String: [Pneu]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + hidrata `pneusByCarroId` com tudo que existe.
    /// Idempotente — pode ser chamado várias vezes sem efeito colateral.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            await loadAll()
        } catch {
            print("PneuRepository.bootstrap failed: \(error)")
        }
    }

    /// Lê os pneus de um carro específico direto do GRDB. Usa o map em
    /// memória como atalho quando já estiver hidratado.
    func list(carroId: String) async throws -> [Pneu] {
        try await queue.read { db in
            try Pneu
                .filter(Column("carro_id") == carroId)
                .order(Column("created_at").asc)
                .fetchAll(db)
        }
    }

    /// Recarrega todos os pneus do time atual e reconstrói o map por carro.
    func loadAll() async {
        guard let teamId = TeamContext.currentTeamId else {
            self.pneusByCarroId = [:]
            return
        }
        do {
            let rows = try await queue.read { db in
                try Pneu
                    .filter(Column("time_id") == teamId)
                    .order(Column("created_at").asc)
                    .fetchAll(db)
            }
            self.pneusByCarroId = Dictionary(grouping: rows, by: { $0.carroId })
        } catch {
            print("PneuRepository.loadAll failed: \(error)")
        }
    }

    /// Insere ou atualiza um pneu (UUID já preenchido pelo caller).
    /// Refresca o map em memória depois.
    func upsert(_ pneu: Pneu) async throws {
        var copy = pneu
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            let exists = try Pneu.fetchOne(db, key: copy.id) != nil
            try copy.save(db)
            try SyncQueue.enqueueRecord(
                db, tableName: "pneus", rowId: copy.id,
                op: exists ? .update : .insert, record: copy
            )
        }
        await loadAll()
    }

    /// Apaga um pneu pelo ID. Refresca o map em memória depois.
    func delete(id: String) async throws {
        try await queue.write { db in
            _ = try Pneu.deleteOne(db, key: id)
            try SyncQueue.enqueueRecord(db, tableName: "pneus", rowId: id, op: .delete, record: Pneu?.none)
        }
        await loadAll()
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
