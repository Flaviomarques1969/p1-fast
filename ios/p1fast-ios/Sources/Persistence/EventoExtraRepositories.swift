// ═══════════════════════════════════════════════════════════
// EventoExtraRepositories — Ações a fazer + Pneus do evento
// ═══════════════════════════════════════════════════════════
// S8 da rodada 1 (2026-05-12). Dois Repositories curtos, no mesmo
// arquivo pra evitar explodir 2 arquivos extras no xcodeproj.
//
// AcaoFazerRepository (#22):
//   - Lista pessoal LIVRE por evento.
//   - filtra `feita_em IS NULL` no listar — itens marcados somem
//     na próxima abertura (decisão Flávio P3 #22).
//
// EventoPneuRepository (#23):
//   - Liga pneus a eventos onde foram usados.
//   - Mostrar lista por evento + adicionar pneu existente.
//   - Estrutura preparatória pra TPMS (pressão/temperatura atual).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class AcaoFazerRepository: ObservableObject {
    /// Map: eventoId → ações pendentes. UI consome direto.
    @Published private(set) var pendentesPorEvento: [String: [AcaoAFazer]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Carrega ações ainda não feitas de um evento e atualiza o cache.
    func loadPendentes(eventoId: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            pendentesPorEvento[eventoId] = []
            return
        }
        let rows = try await queue.read { db in
            try AcaoAFazer
                .filter(Column("evento_id") == eventoId)
                .filter(Column("time_id") == teamId)
                .filter(Column("feita_em") == nil)
                .order(Column("created_at").desc)
                .fetchAll(db)
        }
        pendentesPorEvento[eventoId] = rows
    }

    /// Adiciona uma ação livre ao evento.
    @discardableResult
    func adicionar(eventoId: String, descricao: String) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "AcaoFazerRepository", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de adicionar ações."])
        }
        let trimmed = descricao.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "AcaoFazerRepository", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "Descrição vazia."])
        }
        let id = UUID().uuidString
        let row = AcaoAFazer(
            id: id, timeId: teamId, eventoId: eventoId,
            pilotoId: TeamContext.currentPilotoId,
            descricao: trimmed
        )
        try await queue.write { db in
            try row.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "acoes_a_fazer", rowId: id, op: .insert, record: row)
        }
        try await loadPendentes(eventoId: eventoId)
        return id
    }

    /// Marca uma ação como feita. UI esconde da lista na próxima abertura.
    func marcarFeita(_ acaoId: String, eventoId: String) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var row = try AcaoAFazer.fetchOne(db, key: acaoId) else { return }
            row.feitaEm = now
            row.updatedAt = now
            row.syncedAt = nil
            try row.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "acoes_a_fazer", rowId: row.id, op: .update, record: row)
        }
        try await loadPendentes(eventoId: eventoId)
    }
}

@MainActor
final class EventoPneuRepository: ObservableObject {
    /// Map: eventoId → pneus alocados pra esse evento.
    @Published private(set) var pneusPorEvento: [String: [EventoPneu]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func load(eventoId: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            pneusPorEvento[eventoId] = []
            return
        }
        let rows = try await queue.read { db in
            try EventoPneu
                .filter(Column("evento_id") == eventoId)
                .filter(Column("time_id") == teamId)
                .order(Column("created_at").asc)
                .fetchAll(db)
        }
        pneusPorEvento[eventoId] = rows
    }

    /// Adiciona um pneu existente ao evento (no-op se já estiver).
    @discardableResult
    func adicionarPneuAoEvento(eventoId: String, pneuId: String) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "EventoPneuRepository", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada."])
        }
        let id = UUID().uuidString
        let row = EventoPneu(
            id: id, timeId: teamId, eventoId: eventoId, pneuId: pneuId
        )
        try await queue.write { db in
            // UNIQUE(evento_id, pneu_id) — se já existe, pula sem erro.
            let existe = try EventoPneu
                .filter(Column("evento_id") == eventoId)
                .filter(Column("pneu_id") == pneuId)
                .fetchCount(db) > 0
            guard !existe else { return }
            try row.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "evento_pneus", rowId: id, op: .insert, record: row)
        }
        try await load(eventoId: eventoId)
        return id
    }

    func removerPneuDoEvento(_ eventoPneuId: String, eventoId: String) async throws {
        try await queue.write { db in
            _ = try EventoPneu.deleteOne(db, key: eventoPneuId)
            try SyncQueue.enqueueRecord(db, tableName: "evento_pneus", rowId: eventoPneuId, op: .delete, record: EventoPneu?.none)
        }
        try await load(eventoId: eventoId)
    }
}

// MARK: - S7 #17 — Replicação de setup

@MainActor
final class EventoSetupReplicadoRepository: ObservableObject {
    /// Map: eventoId destino → setups replicados (mais recente primeiro).
    @Published private(set) var replicadosPorEvento: [String: [EventoSetupReplicado]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func load(eventoId: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            replicadosPorEvento[eventoId] = []
            return
        }
        let rows = try await queue.read { db in
            try EventoSetupReplicado
                .filter(Column("evento_id") == eventoId)
                .filter(Column("time_id") == teamId)
                .order(Column("created_at").desc)
                .fetchAll(db)
        }
        replicadosPorEvento[eventoId] = rows
    }

    /// Replica a configuração (overrides) da sessão de origem pro evento
    /// destino. P3 #17: "último vence" em conflito — sobrescreve o anterior
    /// pra mesmo (evento destino, origem volta).
    @discardableResult
    func replicar(
        eventoDestinoId: String,
        origemVoltaId: String,
        origemEventoId: String?,
        carroId: String?,
        overridesJson: String?
    ) async throws -> String {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "EventoSetupReplicadoRepository", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada."])
        }
        let id = UUID().uuidString
        let row = EventoSetupReplicado(
            id: id, timeId: teamId, eventoId: eventoDestinoId,
            origemVoltaId: origemVoltaId, origemEventoId: origemEventoId,
            carroId: carroId, overridesJson: overridesJson
        )
        try await queue.write { db in
            try row.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "evento_setup_replicado",
                                        rowId: id, op: .insert, record: row)
        }
        try await load(eventoId: eventoDestinoId)
        return id
    }

    func remover(_ replicadoId: String, eventoId: String) async throws {
        try await queue.write { db in
            _ = try EventoSetupReplicado.deleteOne(db, key: replicadoId)
            try SyncQueue.enqueueRecord(db, tableName: "evento_setup_replicado",
                                        rowId: replicadoId, op: .delete,
                                        record: EventoSetupReplicado?.none)
        }
        try await load(eventoId: eventoId)
    }
}
