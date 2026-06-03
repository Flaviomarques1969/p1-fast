// ═══════════════════════════════════════════════════════════
// VoltaVideoRepository — triagem volta-por-volta da gravação
// ═══════════════════════════════════════════════════════════
// F4 etapa 2 (registro em `docs/FRENTES_POS_MS4.md`). Repository
// iOS-side pra `volta_video`. Espelha o padrão de outros Repositories
// do app (CombustivelRepository, PneuRepository, etc.).
//
// Métodos principais:
//   - indexar(stream, volta, tInicioMs, tFimMs) — chamado pelo
//     indexador F4.3 quando o Detector cruza a linha de chegada.
//     1:1 com voltas — UNIQUE constraint no banco protege duplicatas.
//   - listByStint(sessaoId) — alimenta a tela de triagem F4.4.
//   - triar(voltaVideoId, status, triadaPor) — F4.4 grava decisão.
//   - countPendentesByEvento(eventoId) — F4.5 decide se bloqueia
//     próximo stint.
//
// Sincronização com Supabase: cada mutação enfileira via SyncQueue
// (mesmo padrão de StintRepository.setStintExtensions).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class VoltaVideoRepository: ObservableObject {
    /// Voltas indexadas do stint atualmente sendo triado (alimenta a UI).
    @Published private(set) var voltasDoStint: [VoltaVideo] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Registra uma volta dentro da gravação. Chamado pelo indexador
    /// (F4.3) quando o Detector emite `onLap`. Tier 0: o `tInicioMs` é
    /// o offset desde `video_streams.started_at` na hora que a volta
    /// começou (cruzou a linha de chegada anterior). `tFimMs` é o offset
    /// na hora que a volta foi fechada.
    ///
    /// Idempotente por `volta_id` — segunda chamada com mesma `voltaId`
    /// lança erro (UNIQUE no banco). Caller deve checar `existsForVolta`
    /// antes se quiser reentrância.
    @discardableResult
    func indexar(videoStreamId: String, voltaId: String,
                 tInicioMs: Int, tFimMs: Int) async throws -> VoltaVideo {
        guard let teamId = TeamContext.currentTeamId else {
            throw NSError(domain: "VoltaVideoRepository", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Sem equipe associada — faça login antes de indexar voltas."])
        }
        let now = DB.nowMs()
        let row = VoltaVideo(
            id: UUID().uuidString,
            timeId: teamId,
            videoStreamId: videoStreamId,
            voltaId: voltaId,
            tInicioMs: tInicioMs,
            tFimMs: tFimMs,
            createdAt: now,
            updatedAt: now,
            syncedAt: nil
        )
        try await queue.write { db in
            try row.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "volta_video", rowId: row.id, op: .insert, record: row)
        }
        return row
    }

    /// Lê todas as voltas indexadas de um stint, ordenadas por t_inicio_ms.
    /// Atualiza `voltasDoStint` pra UI consumir.
    func loadByStint(sessaoId: String) async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.voltasDoStint = []
            return
        }
        let rows: [VoltaVideo] = try await queue.read { db in
            // volta_video.video_stream_id → video_streams.id (sessao_id)
            // Join inline pra filtrar pelo sessao_id (1 stream por sessao).
            let sql = """
                SELECT vv.*
                FROM volta_video vv
                JOIN video_streams vs ON vs.id = vv.video_stream_id
                WHERE vs.sessao_id = ? AND vv.time_id = ?
                ORDER BY vv.t_inicio_ms ASC
            """
            return try VoltaVideo.fetchAll(db, sql: sql, arguments: [sessaoId, teamId])
        }
        self.voltasDoStint = rows
    }

    /// Marca uma volta como mantida ou descartada. Atualiza `triada_em`
    /// e `triada_por` pra rastrear quem decidiu. `triadaPor` é o user_id
    /// do Supabase Auth (TeamContext.currentUserId).
    func triar(voltaVideoId: String, status: TriagemStatus,
               triadaPor: String?) async throws {
        let now = DB.nowMs()
        try await queue.write { db in
            guard var row = try VoltaVideo.fetchOne(db, key: voltaVideoId) else {
                throw NSError(domain: "VoltaVideoRepository", code: -2,
                              userInfo: [NSLocalizedDescriptionKey: "Volta não encontrada: \(voltaVideoId)"])
            }
            row.triagemStatus = status.rawValue
            row.triadaPor = triadaPor
            row.triadaEm = now
            row.updatedAt = now
            row.syncedAt = nil
            try row.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "volta_video", rowId: row.id, op: .update, record: row)
        }
    }

    /// Conta quantas voltas de um evento ainda estão pendentes de triagem.
    /// Usado pelo F4.5 pra decidir se bloqueia o início de um novo stint.
    func countPendentesByEvento(eventoId: String) async throws -> Int {
        guard let teamId = TeamContext.currentTeamId else { return 0 }
        return try await queue.read { db in
            let sql = """
                SELECT COUNT(*)
                FROM volta_video vv
                JOIN video_streams vs ON vs.id = vv.video_stream_id
                JOIN sessoes s ON s.id = vs.sessao_id
                WHERE s.evento_id = ? AND vv.time_id = ?
                  AND vv.triagem_status = 'pendente'
            """
            return try Int.fetchOne(db, sql: sql, arguments: [eventoId, teamId]) ?? 0
        }
    }

    // MARK: - S6 (rodada 1): lookup pra player de vídeo

    /// S6 da rodada 1 (2026-05-12): retorna a VoltaVideo mantida (triada
    /// como mantida) pra uma volta específica. Nil quando não há gravação
    /// indexada ou foi descartada. Usado no card de detalhe da volta pra
    /// decidir se mostra o player ou um estado "sem gravação".
    func findMantidaForVolta(voltaId: String) async throws -> VoltaVideo? {
        try await queue.read { db in
            try VoltaVideo
                .filter(Column("volta_id") == voltaId)
                .filter(Column("triagem_status") == TriagemStatus.mantida.rawValue)
                .fetchOne(db)
        }
    }

    /// S6 da rodada 1: VideoStream associado a uma VoltaVideo. Carrega o
    /// VideoStream pra ler `dailyRoomUrl` + `startedAt` no player.
    func loadStream(videoStreamId: String) async throws -> VideoStream? {
        try await queue.read { db in
            try VideoStream.fetchOne(db, key: videoStreamId)
        }
    }

    /// S6 da rodada 1: mapa voltaId → status visível ("mantida") pra o
    /// PosStintView decidir se mostra o indicador de vídeo na linha
    /// daquela volta. Lê em batch — uma única consulta pra todas as
    /// voltas do stint.
    func mapaMantidasPorStint(sessaoId: String) async throws -> [String: VoltaVideo] {
        guard let teamId = TeamContext.currentTeamId else { return [:] }
        let rows: [VoltaVideo] = try await queue.read { db in
            let sql = """
                SELECT vv.*
                FROM volta_video vv
                JOIN video_streams vs ON vs.id = vv.video_stream_id
                WHERE vs.sessao_id = ? AND vv.time_id = ?
                  AND vv.triagem_status = 'mantida'
            """
            return try VoltaVideo.fetchAll(db, sql: sql, arguments: [sessaoId, teamId])
        }
        var m: [String: VoltaVideo] = [:]
        for r in rows { m[r.voltaId] = r }
        return m
    }

    /// Confere se uma volta já foi indexada. Útil pro indexador F4.3
    /// não duplicar quando o Detector emite mais de uma vez na mesma
    /// volta (caso o stream caia e volte).
    func existsForVolta(voltaId: String) async throws -> Bool {
        try await queue.read { db in
            try VoltaVideo
                .filter(Column("volta_id") == voltaId)
                .fetchCount(db) > 0
        }
    }

    // MARK: - F4.5: bloqueio do próximo stint

    /// Coleta o estado de pendentes por stint anterior do evento (usado
    /// pela TriagemPolicy). Cada row do retorno representa um stint que
    /// ainda tem voltas pendentes de triagem.
    func pendentesPorStint(eventoId: String) async throws -> [StintComPendentes] {
        guard let teamId = TeamContext.currentTeamId else { return [] }
        return try await queue.read { db in
            let sql = """
                SELECT s.id AS stint_id,
                       s.created_at AS criado_em_ms,
                       COUNT(vv.id) AS pendentes
                FROM volta_video vv
                JOIN video_streams vs ON vs.id = vv.video_stream_id
                JOIN sessoes s ON s.id = vs.sessao_id
                WHERE s.evento_id = ?
                  AND vv.time_id = ?
                  AND vv.triagem_status = 'pendente'
                GROUP BY s.id
                HAVING pendentes > 0
                ORDER BY s.created_at ASC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [eventoId, teamId]).map { row in
                StintComPendentes(
                    stintId: row["stint_id"],
                    criadoEmMs: row["criado_em_ms"] ?? 0,
                    voltasPendentes: row["pendentes"] ?? 0
                )
            }
        }
    }

    /// Avalia se o usuário pode iniciar um stint novo neste evento.
    /// Aplica TriagemPolicy. `hoje` permite injetar pra teste.
    func avaliarBloqueio(eventoId: String, hoje: Date = Date()) async throws -> BloqueioTriagemResultado {
        let pendentes = try await pendentesPorStint(eventoId: eventoId)
        return TriagemPolicy.avaliar(pendentes: pendentes, hoje: hoje)
    }

    /// Marca todas as voltas pendentes de uma lista de stints como
    /// descartadas. Usado pela rotina de auto-descarte (stints de dias
    /// anteriores) e pelo botão "marcar todas como descartadas" da UI
    /// quando a pessoa decide passar batido.
    @discardableResult
    func autoDescartarPendentes(stintIds: [String]) async throws -> Int {
        guard !stintIds.isEmpty, let teamId = TeamContext.currentTeamId else { return 0 }
        let now = DB.nowMs()
        let placeholders = stintIds.map { _ in "?" }.joined(separator: ",")
        var affected = 0
        try await queue.write { db in
            let sql = """
                UPDATE volta_video
                SET triagem_status = 'descartada',
                    triada_em = ?,
                    updated_at = ?,
                    synced_at = NULL
                WHERE triagem_status = 'pendente'
                  AND time_id = ?
                  AND video_stream_id IN (
                      SELECT vs.id FROM video_streams vs
                      WHERE vs.sessao_id IN (\(placeholders))
                  )
            """
            var args: [DatabaseValueConvertible] = [now, now, teamId]
            args.append(contentsOf: stintIds.map { $0 as DatabaseValueConvertible })
            try db.execute(sql: sql, arguments: StatementArguments(args))
            affected = db.changesCount
            // Enfileira sync drainer pra cada row alterada — query lista
            // os ids afetados pra enfileirar individualmente.
            if affected > 0 {
                let rowsSql = """
                    SELECT vv.id FROM volta_video vv
                    JOIN video_streams vs ON vs.id = vv.video_stream_id
                    WHERE vv.triagem_status = 'descartada'
                      AND vv.triada_em = ?
                      AND vv.time_id = ?
                      AND vs.sessao_id IN (\(placeholders))
                """
                var qargs: [DatabaseValueConvertible] = [now, teamId]
                qargs.append(contentsOf: stintIds.map { $0 as DatabaseValueConvertible })
                let ids = try String.fetchAll(db, sql: rowsSql, arguments: StatementArguments(qargs))
                for id in ids {
                    if let row = try VoltaVideo.fetchOne(db, key: id) {
                        try SyncQueue.enqueueRecord(db, tableName: "volta_video", rowId: id, op: .update, record: row)
                    }
                }
            }
        }
        return affected
    }
}
