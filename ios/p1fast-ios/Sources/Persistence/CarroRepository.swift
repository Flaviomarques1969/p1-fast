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

// MARK: - CarroMetricas (S2 — rodada 1, 2026-05-12)

/// Métricas agregadas exibidas no card do carro:
/// - `kmRodada` é uma ESTIMATIVA, calculada por
///   Σ((vmin + vmax)/2 × tempo) sobre `segment_executions` do carro.
///   Nil quando não há nenhuma execução de trecho registrada.
/// - `vmaxKmh` é a maior `segment_executions.velocidade_max` do carro
///   (já gravada em km/h pelo `SegmentExecutionMapper`). Nil sem dado.
/// - `autodromosCount` = nº de `eventos.track_id` distintos onde o
///   carro participou. 0 se nunca foi a evento ligado a autódromo.
struct CarroMetricas: Equatable {
    let kmRodada: Double?
    let vmaxKmh: Double?
    let autodromosCount: Int

    static let vazio = CarroMetricas(kmRodada: nil, vmaxKmh: nil, autodromosCount: 0)
}

@MainActor
final class CarroRepository: ObservableObject {
    @Published private(set) var carros: [Carro] = []
    @Published private(set) var stintsPorCarro: [String: Int] = [:]
    @Published private(set) var metricasPorCarro: [String: CarroMetricas] = [:]

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
            self.metricasPorCarro = [:]
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
        try await loadMetricas(teamId: teamId)
    }

    /// S2 — agrega as 3 métricas exibidas no card (km estimada, vmax km/h,
    /// nº de autódromos visitados). Roda 3 consultas por carro. Volume
    /// esperado é baixo (≤10 carros, ≤100 eventos por carro) — sem cache.
    private func loadMetricas(teamId: String) async throws {
        guard !carros.isEmpty else {
            self.metricasPorCarro = [:]
            return
        }
        let carroIds = carros.map(\.id)
        let result = try await queue.read { db -> [String: CarroMetricas] in
            var acc: [String: CarroMetricas] = [:]
            for carroId in carroIds {
                let vmaxRow = try Row.fetchOne(db, sql: """
                    SELECT MAX(se.velocidade_max) AS v
                    FROM segment_executions se
                    JOIN sessoes s ON s.id = se.sessao_id
                    WHERE s.carro_id = ? AND s.time_id = ?
                    """, arguments: [carroId, teamId])
                let vmax: Double? = vmaxRow?["v"]

                let autoRow = try Row.fetchOne(db, sql: """
                    SELECT COUNT(DISTINCT e.track_id) AS n
                    FROM eventos e
                    JOIN sessoes s ON s.evento_id = e.id
                    WHERE s.carro_id = ? AND s.time_id = ? AND e.track_id IS NOT NULL
                    """, arguments: [carroId, teamId])
                let autodromos: Int = (autoRow?["n"] as Int?) ?? 0

                // Estimativa: somatório de ((vmin + vmax)/2) × tempo_h por trecho.
                // Quando vmin é NULL (execuções pré-MS-2.5), usa 60% de vmax como
                // proxy (fator típico de uso em pista). É APROXIMAÇÃO — não tem
                // odômetro real. Quando o T4000 chegar, substituir por valor exato.
                let kmRow = try Row.fetchOne(db, sql: """
                    SELECT SUM(
                        ((COALESCE(se.vmin_kmh, se.velocidade_max * 0.6) + se.velocidade_max) / 2.0)
                        * (se.tempo_ms / 3600000.0)
                    ) AS km
                    FROM segment_executions se
                    JOIN sessoes s ON s.id = se.sessao_id
                    WHERE s.carro_id = ? AND s.time_id = ?
                      AND se.velocidade_max IS NOT NULL AND se.tempo_ms IS NOT NULL
                    """, arguments: [carroId, teamId])
                let km: Double? = kmRow?["km"]

                acc[carroId] = CarroMetricas(
                    kmRodada: km,
                    vmaxKmh: vmax,
                    autodromosCount: autodromos
                )
            }
            return acc
        }
        self.metricasPorCarro = result
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
            let carro = Carro(
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
            )
            try carro.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "carros", rowId: carroId, op: .insert, record: carro)

            let config = Configuracao(
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
            )
            try config.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "configuracoes", rowId: configId, op: .insert, record: config)
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
            try SyncQueue.enqueueRecord(db, tableName: "carros", rowId: copy.id, op: .update, record: copy)
        }
        try await reload()
    }

    func delete(carroId: String) async throws {
        try await queue.write { db in
            _ = try Carro.deleteOne(db, key: carroId)
            try SyncQueue.enqueueRecord(db, tableName: "carros", rowId: carroId, op: .delete, record: Carro?.none)
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
                try SyncQueue.enqueueRecord(db, tableName: "configuracoes", rowId: c.id, op: .update, record: c)
            } else {
                let novo = Configuracao(
                    id: UUID().uuidString,
                    timeId: teamId,
                    carroId: carroId,
                    nome: "Setup base",
                    dataAplicacao: DB.nowMs(),
                    overrides: overridesJSON,
                    temperaturaIdealRange: nil
                )
                try novo.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "configuracoes", rowId: novo.id, op: .insert, record: novo)
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
