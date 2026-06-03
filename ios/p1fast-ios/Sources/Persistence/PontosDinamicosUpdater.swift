// ═══════════════════════════════════════════════════════════
// PontosDinamicosUpdater — atualiza melhor passagem por trecho
// ═══════════════════════════════════════════════════════════
// Pendência 1 da reformulação Autódromos (Flávio 2026-05-17): a alma
// do sistema. Sempre que o piloto FECHA a passagem pelo ponto de saída
// do trecho, o aplicativo compara com a melhor passagem registrada
// (por carro+configuração); se for melhor, atualiza os 3 pontos
// dinâmicos (V-min, ponto de frenagem, PAce).
//
// Disparo: ao finalizar o stint, processa cada execução de trecho
// gravada (`segment_executions`) e faz o batimento. Pra cada uma:
//   1. Lê melhor passagem atual de (segment, carro, configuracao)
//   2. Se a execução for mais rápida, atualiza/insere o registro
//   3. Atualiza contador de voltas consideradas
//
// Aproximação inicial pra frenagem e PAce: usa a faixa geográfica
// de ENTRADA (proxy do ponto de frenagem) e a faixa de SAÍDA (proxy
// do PAce). Quando o aplicativo tiver telemetria fatiada por trecho
// (futuro), refina com dados reais. V-min vem direto do detector
// (já gravado em `segment_executions.vmin_kmh / vmin_x / vmin_y`).

import Foundation
import GRDB
import P1FastCore

enum PontosDinamicosUpdater {
    /// Processa todas as execuções de trecho de um stint finalizado.
    /// Atualiza `segment_pontos_dinamicos` com a melhor passagem por
    /// (segmento, carro, configuração). Idempotente: rodar 2× não faz
    /// estrago.
    static func processarStintFinalizado(stintId: String, queue: DatabaseQueue) async throws {
        let resumo = try await queue.read { db -> (Sessao?, [SegmentExecution]) in
            let sessao = try Sessao.fetchOne(db, key: stintId)
            let execs = try SegmentExecution
                .filter(Column("sessao_id") == stintId)
                .fetchAll(db)
            return (sessao, execs)
        }

        guard let sessao = resumo.0,
              let carroId = sessao.carroId,
              let cfgId = sessao.configuracaoId else {
            // Sem carro ou configuração não dá pra atribuir os pontos
            // a um (carro+config) específico — pulamos silenciosamente.
            return
        }
        let timeId = sessao.timeId
        let execs = resumo.1

        guard !execs.isEmpty else { return }

        for exec in execs {
            guard let segmentId = exec.segmentId else { continue }
            try await processarUmaPassagem(
                exec: exec,
                segmentId: segmentId,
                carroId: carroId,
                configuracaoId: cfgId,
                timeId: timeId,
                queue: queue
            )
        }
    }

    /// Processa UMA execução de trecho. Lê melhor passagem atual,
    /// compara, atualiza se for menor.
    private static func processarUmaPassagem(
        exec: SegmentExecution,
        segmentId: String,
        carroId: String,
        configuracaoId: String,
        timeId: String,
        queue: DatabaseQueue
    ) async throws {
        try await queue.write { db in
            // 1. Conta voltas válidas com esse carro+config nesse segmento
            //    (pra populá `voltas_consideradas`).
            let voltasConsideradas = try Int.fetchOne(db, sql: """
                SELECT COUNT(DISTINCT se.volta_id)
                FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                JOIN voltas v ON v.id = se.volta_id
                WHERE se.segment_id = ?
                  AND s.carro_id = ?
                  AND s.configuracao_id = ?
                  AND v.valida = 1
            """, arguments: [segmentId, carroId, configuracaoId]) ?? 0

            // 2. Busca melhor passagem atual.
            let atual = try SegmentPontosDinamicos
                .filter(Column("segment_id") == segmentId)
                .filter(Column("carro_id") == carroId)
                .filter(Column("configuracao_id") == configuracaoId)
                .fetchOne(db)

            // 3. Decide se atualiza.
            let novoTempoMs = exec.tempoMs ?? Int.max
            if let atual {
                if novoTempoMs >= atual.tempoMs {
                    // Não é melhor que a atual — só atualiza contador de
                    // voltas consideradas (decisão E2 — gatilho dos 3 voltas).
                    if voltasConsideradas != atual.voltasConsideradas {
                        var copia = atual
                        copia.voltasConsideradas = voltasConsideradas
                        copia.updatedAt = DB.nowMs()
                        try copia.update(db)
                    }
                    return
                }
            }

            // 4. Calcula frenagem e PAce. Aproximação inicial:
            //    frenagem = posição da faixa de ENTRADA do trecho
            //    pace      = posição da faixa de SAÍDA do trecho
            // (V-min vem direto do detector — já está em exec.vminKmh/X/Y.)
            let entrada = try TrackSegmentFaixa
                .filter(Column("segment_id") == segmentId)
                .filter(Column("tipo") == "entrada")
                .fetchOne(db)
            let saida = try TrackSegmentFaixa
                .filter(Column("segment_id") == segmentId)
                .filter(Column("tipo") == "saida")
                .fetchOne(db)

            // 5. Faz upsert.
            let id = atual?.id ?? UUID().uuidString.lowercased()
            let agora = DB.nowMs()
            var registro = SegmentPontosDinamicos(
                id: id,
                timeId: timeId,
                segmentId: segmentId,
                carroId: carroId,
                configuracaoId: configuracaoId,
                tempoMs: novoTempoMs == Int.max ? 0 : novoTempoMs,
                vminKmh: exec.vminKmh,
                vminX: exec.vminX,
                vminY: exec.vminY,
                frenagemX: entrada?.x,
                frenagemY: entrada?.y,
                paceX: saida?.x,
                paceY: saida?.y,
                voltasConsideradas: voltasConsideradas,
                fonteVoltaId: exec.voltaId,
                createdAt: atual?.createdAt ?? agora,
                updatedAt: agora
            )
            try registro.save(db)
        }
    }
}
