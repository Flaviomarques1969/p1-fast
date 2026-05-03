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
// Sincronização com Supabase fica pro Sprint 1A.6 (drainer).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PneuRepository: ObservableObject {
    /// Mesmo ID dos outros repos (single-tenant até 1A.6).
    static let localTimeId = "local-default-team"

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

    /// Recarrega todos os pneus do time local e reconstrói o map por carro.
    func loadAll() async {
        do {
            let rows = try await queue.read { db in
                try Pneu
                    .filter(Column("time_id") == Self.localTimeId)
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
            try copy.save(db)
        }
        await loadAll()
    }

    /// Apaga um pneu pelo ID. Refresca o map em memória depois.
    func delete(id: String) async throws {
        try await queue.write { db in
            _ = try Pneu.deleteOne(db, key: id)
        }
        await loadAll()
    }

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
