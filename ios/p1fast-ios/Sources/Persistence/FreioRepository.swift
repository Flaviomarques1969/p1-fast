// ═══════════════════════════════════════════════════════════
// FreioRepository — CRUD de itens de freio por carro
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 19/06/2026: freio/pastilha ganha "cadastro próprio
// igual pneu". Este repo espelha o PneuRepository — itens têm FK
// obrigatória pra `carros`, então o estado é `[carroId: [Freio]]`
// (cada CarroModalView observa só os freios do seu carro).
//
// Sem seed canônico — itens de freio são per-carro do usuário, então
// qualquer seed seria ruído. Bootstrap só garante o time local + hidrata.
//
// time_id vem de TeamContext.currentTeamId. Sem login, loadAll deixa
// o map vazio. Toda mutação enfileira na sync_queue (vai pra nuvem).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class FreioRepository: ObservableObject {
    @Published private(set) var freiosByCarroId: [String: [Freio]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Garante time local + hidrata `freiosByCarroId` com tudo que existe.
    /// Idempotente — pode ser chamado várias vezes sem efeito colateral.
    func bootstrap() async {
        do {
            try await ensureLocalTime()
            await loadAll()
        } catch {
            print("FreioRepository.bootstrap failed: \(error)")
        }
    }

    /// Lê os freios de um carro específico direto do GRDB.
    func list(carroId: String) async throws -> [Freio] {
        try await queue.read { db in
            try Freio
                .filter(Column("carro_id") == carroId)
                .order(Column("created_at").asc)
                .fetchAll(db)
        }
    }

    /// Recarrega todos os freios do time atual e reconstrói o map por carro.
    func loadAll() async {
        guard let teamId = TeamContext.currentTeamId else {
            self.freiosByCarroId = [:]
            return
        }
        do {
            let rows = try await queue.read { db in
                try Freio
                    .filter(Column("time_id") == teamId)
                    .order(Column("created_at").asc)
                    .fetchAll(db)
            }
            self.freiosByCarroId = Dictionary(grouping: rows, by: { $0.carroId })
        } catch {
            print("FreioRepository.loadAll failed: \(error)")
        }
    }

    /// Insere ou atualiza um item de freio (UUID já preenchido pelo caller).
    /// Refresca o map em memória depois.
    func upsert(_ freio: Freio) async throws {
        var copy = freio
        copy.updatedAt = DB.nowMs()
        copy.syncedAt = nil
        try await queue.write { db in
            let exists = try Freio.fetchOne(db, key: copy.id) != nil
            try copy.save(db)
            try SyncQueue.enqueueRecord(
                db, tableName: "freios", rowId: copy.id,
                op: exists ? .update : .insert, record: copy
            )
        }
        await loadAll()
    }

    /// Apaga um item pelo ID. Refresca o map em memória depois.
    func delete(id: String) async throws {
        try await queue.write { db in
            _ = try Freio.deleteOne(db, key: id)
            try SyncQueue.enqueueRecord(db, tableName: "freios", rowId: id, op: .delete, record: Freio?.none)
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

// MARK: - Tipos de freio (catálogo real, não inventado)
// Espelha a área "Freios" de CatalogoConsumiveisCelta (P1FastCore):
// pastilhas, discos, fluido_freio. O código é gravado em `Freio.tipo`;
// o rótulo é o que aparece pro Flávio.
enum FreioTipo: String, CaseIterable, Identifiable {
    case pastilhas
    case discos
    case fluidoFreio = "fluido_freio"

    var id: String { rawValue }

    var rotulo: String {
        switch self {
        case .pastilhas:  return "Pastilha"
        case .discos:     return "Disco"
        case .fluidoFreio: return "Fluido"
        }
    }

    /// Rótulo a partir do código gravado (tolerante a valor desconhecido).
    static func rotulo(de codigo: String?) -> String {
        guard let codigo, let t = FreioTipo(rawValue: codigo) else { return "Freio" }
        return t.rotulo
    }
}
