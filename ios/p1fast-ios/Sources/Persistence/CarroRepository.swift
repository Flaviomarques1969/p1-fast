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
import Supabase
import UIKit

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

    let queue: DatabaseQueue

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
        // Pre-fetch das fotos: SEM esperar (Flávio 2026-05-17 — aplicativo
        // estava lento no boot porque downloads sequenciais da rede
        // travavam a tela inicial). Roda em background concorrente —
        // fotos chegam aos poucos enquanto o gestor já usa o app.
        let carrosSnapshot = carros
        Task.detached(priority: .background) { [weak self] in
            await self?.prefetchFotosLocais(carros: carrosSnapshot)
        }
    }

    /// Baixa e cacheia localmente todas as fotos dos carros do time que
    /// ainda não estão no disco. Best-effort: erros individuais não
    /// quebram nada — próxima abertura do app tenta de novo. Downloads
    /// rodam em paralelo (TaskGroup) pra não enfileirar.
    nonisolated private func prefetchFotosLocais(carros: [Carro]) async {
        await withTaskGroup(of: Void.self) { group in
            for carro in carros {
                guard let url = Self.fotoPublicURLStatic(carro.fotoUrl) else { continue }
                let local = Self.fotoLocalURL(carroId: carro.id)
                if FileManager.default.fileExists(atPath: local.path) { continue }
                let id = carro.id
                group.addTask {
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        Self.salvarFotoLocal(carroId: id, data: data)
                    } catch {
                        NSLog("[CarroRepository.prefetchFotosLocais] FAIL carro=\(id): \(error)")
                    }
                }
            }
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

    // MARK: - S2 Parte B — Foto do carro (Supabase Storage + cache local)

    /// Diretório local pra cache das fotos de carro (Documents/carro-fotos-cache).
    /// Diferente do Cache do iOS (que pode ser apagado a qualquer hora) —
    /// Documents é estável e backup-friendly. Tamanho controlado pela
    /// compressão JPEG no app (~500KB por carro × ≤10 carros = ~5MB).
    nonisolated static var fotoCacheDir: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("carro-fotos-cache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Caminho local da foto de um carro específico. Não garante que existe.
    nonisolated static func fotoLocalURL(carroId: String, ext: String = "jpg") -> URL {
        fotoCacheDir.appendingPathComponent("\(carroId).\(ext)")
    }

    /// Salva bytes da foto no cache local. Sobrescreve se já existir.
    nonisolated static func salvarFotoLocal(carroId: String, data: Data, ext: String = "jpg") {
        let url = fotoLocalURL(carroId: carroId, ext: ext)
        do {
            try data.write(to: url, options: .atomic)
            NSLog("[CarroRepository] salvou foto local em \(url.path) (\(data.count)B)")
        } catch {
            NSLog("[CarroRepository] FAIL salvar foto local: \(error)")
        }
    }

    /// Apaga a foto local (no remove ou troca).
    nonisolated static func apagarFotoLocal(carroId: String) {
        let url = fotoLocalURL(carroId: carroId)
        try? FileManager.default.removeItem(at: url)
    }

    /// Carrega UIImage do disco local. Nil quando não existe — caller cai
    /// pra AsyncImage do servidor e, ao receber, deve chamar
    /// `salvarFotoLocal` pra popular o cache.
    nonisolated static func carregarFotoLocal(carroId: String) -> UIImage? {
        let url = fotoLocalURL(carroId: carroId)
        guard FileManager.default.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }


    /// Sobe a foto do carro pro bucket `carro-fotos` do Supabase Storage.
    /// - Parameters:
    ///   - carroId: id do carro alvo.
    ///   - imageData: bytes da imagem JÁ comprimida (caller cuida da compressão,
    ///     normalmente via `UIImage.jpegData(compressionQuality: 0.6)`).
    ///     Alvo recomendado ≤ 500KB. Hard cap do bucket é 1MB.
    ///   - contentType: "image/jpeg" ou "image/png".
    /// - Returns: o `key` salvo em `carros.foto_url` (path dentro do bucket).
    ///
    /// Estrutura do path no bucket: `{time_id}/{carro_id}.jpg|png`.
    /// Policies do bucket (migration 0020) garantem que só membros do
    /// time podem escrever na pasta do próprio time.
    @discardableResult
    func uploadFoto(carroId: String, imageData: Data, contentType: String = "image/jpeg") async throws -> String {
        NSLog("[CarroRepository.uploadFoto] start — carroId=\(carroId), bytes=\(imageData.count), type=\(contentType)")
        guard let teamId = TeamContext.currentTeamId else {
            NSLog("[CarroRepository.uploadFoto] ERRO: sem teamId (currentTeamId nil)")
            throw NSError(domain: "CarroRepository", code: -1, userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de subir foto."])
        }
        guard let client = SupabaseManager.shared else {
            NSLog("[CarroRepository.uploadFoto] ERRO: SupabaseManager.shared é nil")
            throw NSError(domain: "CarroRepository", code: -2, userInfo: [NSLocalizedDescriptionKey: "Servidor não configurado — não é possível subir foto."])
        }
        let ext = contentType.lowercased().contains("png") ? "png" : "jpg"
        let key = "\(teamId)/\(carroId).\(ext)"
        NSLog("[CarroRepository.uploadFoto] subindo pra bucket=carro-fotos, key=\(key)")
        do {
            _ = try await client.storage
                .from("carro-fotos")
                .upload(
                    key,
                    data: imageData,
                    options: FileOptions(contentType: contentType, upsert: true)
                )
            NSLog("[CarroRepository.uploadFoto] storage upload OK")
        } catch {
            NSLog("[CarroRepository.uploadFoto] storage upload FAIL: \(error)")
            throw error
        }
        // Cache local IMEDIATAMENTE — próxima abertura mostra do disco
        // sem latência de rede (UX "foto já está lá").
        Self.salvarFotoLocal(carroId: carroId, data: imageData, ext: ext)
        try await queue.write { db in
            guard var carro = try Carro.fetchOne(db, key: carroId) else { return }
            carro.fotoUrl = key
            carro.updatedAt = DB.nowMs()
            carro.syncedAt = nil
            try carro.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "carros", rowId: carroId, op: .update, record: carro)
        }
        NSLog("[CarroRepository.uploadFoto] gravou foto_url no banco local — recarregando lista")
        try await reload()
        NSLog("[CarroRepository.uploadFoto] FIM ok — key=\(key)")
        return key
    }

    /// Apaga a foto do carro do bucket + zera `foto_url` no banco local.
    /// No-op se o carro não tinha foto.
    func removeFoto(carroId: String) async throws {
        guard let client = SupabaseManager.shared else {
            throw NSError(domain: "CarroRepository", code: -2, userInfo: [NSLocalizedDescriptionKey: "Servidor não configurado."])
        }
        let key = try await queue.read { db in
            try Carro.fetchOne(db, key: carroId)?.fotoUrl
        }
        guard let key = key, !key.isEmpty else { return }
        _ = try await client.storage.from("carro-fotos").remove(paths: [key])
        Self.apagarFotoLocal(carroId: carroId)
        try await queue.write { db in
            guard var carro = try Carro.fetchOne(db, key: carroId) else { return }
            carro.fotoUrl = nil
            carro.updatedAt = DB.nowMs()
            carro.syncedAt = nil
            try carro.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "carros", rowId: carroId, op: .update, record: carro)
        }
        try await reload()
    }

    /// URL pública pra exibir a foto via `AsyncImage`. Nil quando a foto
    /// não existe ou o cliente Supabase não foi configurado.
    /// Como o bucket é `public=true`, a URL serve direta — sem signed URL.
    nonisolated func fotoPublicURL(_ fotoUrl: String?) -> URL? {
        Self.fotoPublicURLStatic(fotoUrl)
    }

    /// Versão estática reutilizável pelo `prefetchFotosLocais` que roda
    /// em `Task.detached` (não pode tocar self isolado em MainActor).
    nonisolated static func fotoPublicURLStatic(_ fotoUrl: String?) -> URL? {
        guard let fotoUrl = fotoUrl, !fotoUrl.isEmpty else { return nil }
        guard let client = SupabaseManager.shared else { return nil }
        return try? client.storage.from("carro-fotos").getPublicURL(path: fotoUrl)
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
