// ═══════════════════════════════════════════════════════════
// ManutencaoInteligencia — Bloco 5 da função Manutenção
// (2026-05-18 "go")
// ═══════════════════════════════════════════════════════════
// Combina ManutencaoRepository + StintRepository + TrackRepository
// pra calcular:
//   • contador desde a última troca (km de rua + km de pista + horas
//     de stint + dias)
//   • duração entre 2 trocas consecutivas (mesma estrutura)
//   • média aprendida (mediaDuracoes do domain puro)
//
// Funções rodam em await — fazem leituras GRDB. Aceitam `Manutencao`
// arrays já carregados pra evitar dupla consulta.

import Foundation
import GRDB
import P1FastCore

enum ManutencaoInteligencia {

    // MARK: - Contador desde a última troca

    /// Quanto rodou desde a última troca registrada daquele item.
    /// Se `historico` está vazio, retorna zero (sem trocas — contador
    /// não rodou ainda).
    @MainActor
    static func contadorDesdeUltimaTroca(
        carroId: String,
        itemCodigo: String,
        historico: [Manutencao],
        stintRepo: StintRepository,
        trackRepo: TrackRepository
    ) async -> ContadorVida {
        guard let ultima = historico.last else { return .zero }
        let agoraMs = DB.nowMs()
        return await calcularUso(
            carroId: carroId,
            deMs: ultima.ocorridoEm, ateMs: agoraMs,
            kmCarroFinal: nil,
            kmCarroInicial: ultima.kmCarro,
            stintRepo: stintRepo,
            trackRepo: trackRepo
        )
    }

    // MARK: - Duração entre 2 trocas consecutivas

    /// Calcula a duração entre 2 manutenções consecutivas (M_{i-1} → M_i)
    /// — quanto rodou nesse intervalo. Bloco 5 usa pra média aprendida.
    @MainActor
    static func duracaoEntreTrocas(
        carroId: String,
        anterior: Manutencao,
        atual: Manutencao,
        stintRepo: StintRepository,
        trackRepo: TrackRepository
    ) async -> DuracaoEntreTrocas {
        let uso = await calcularUso(
            carroId: carroId,
            deMs: anterior.ocorridoEm,
            ateMs: atual.ocorridoEm,
            kmCarroFinal: atual.kmCarro,
            kmCarroInicial: anterior.kmCarro,
            stintRepo: stintRepo,
            trackRepo: trackRepo
        )
        return DuracaoEntreTrocas(
            kmRua: uso.kmRua > 0 ? uso.kmRua : nil,
            kmPista: uso.kmPista,
            horas: uso.horas,
            dias: uso.dias
        )
    }

    /// Média aprendida sobre todos os intervalos consecutivos do
    /// histórico (em ordem crescente — primeiro elemento é o mais
    /// antigo). Retorna nil se há menos de 2 registros.
    @MainActor
    static func mediaEntreTrocas(
        carroId: String,
        historico: [Manutencao],
        stintRepo: StintRepository,
        trackRepo: TrackRepository
    ) async -> DuracaoEntreTrocas? {
        guard historico.count >= 2 else { return nil }
        var duracoes: [DuracaoEntreTrocas] = []
        for i in 1..<historico.count {
            let d = await duracaoEntreTrocas(
                carroId: carroId,
                anterior: historico[i - 1],
                atual: historico[i],
                stintRepo: stintRepo,
                trackRepo: trackRepo
            )
            duracoes.append(d)
        }
        return mediaDuracoes(duracoes)
    }

    // MARK: - Núcleo: cálculo de uso entre 2 timestamps

    @MainActor
    private static func calcularUso(
        carroId: String,
        deMs: Int64, ateMs: Int64,
        kmCarroFinal: Double?,
        kmCarroInicial: Double?,
        stintRepo: StintRepository,
        trackRepo: TrackRepository
    ) async -> ContadorVida {
        let dias = max(0, Int(round(Double(ateMs - deMs) / (24.0 * 60.0 * 60.0 * 1000.0))))

        // Diferença de km de rua se ambas pontas estão preenchidas
        let kmRua: Double
        if let inicio = kmCarroInicial, let fim = kmCarroFinal, fim >= inicio {
            kmRua = fim - inicio
        } else {
            kmRua = 0
        }

        // Soma horas de stint + km de pista (voltas × extensao_metros)
        // via SQL direto. Mais barato e exato do que carregar listas.
        let queue = stintRepo.queue
        let (horas, kmPista) = await Self.totalStints(
            carroId: carroId, deMs: deMs, ateMs: ateMs,
            queue: queue
        )

        return ContadorVida(
            kmRua: kmRua,
            kmPista: kmPista,
            horas: horas,
            dias: dias
        )
    }

    /// SQL puro: soma duração e km de pista no intervalo.
    private static func totalStints(
        carroId: String, deMs: Int64, ateMs: Int64,
        queue: DatabaseQueue
    ) async -> (horas: Double, kmPista: Double) {
        guard let teamId = TeamContext.currentTeamId else {
            return (0, 0)
        }
        do {
            return try await queue.read { db -> (Double, Double) in
                // Horas: SUM(data_fim - data_inicio) sobre sessões
                // encerradas do carro no intervalo. Considera só sessões
                // com data_inicio ≥ deMs E (data_fim ≤ ateMs OU
                // data_fim NULL e data_inicio < ateMs).
                let horasMs = try Double.fetchOne(db, sql: """
                    SELECT SUM(COALESCE(data_fim, ?) - data_inicio)
                    FROM sessoes
                    WHERE carro_id = ? AND time_id = ?
                      AND data_inicio IS NOT NULL
                      AND data_inicio >= ? AND data_inicio < ?
                      AND cancelado_em IS NULL
                """, arguments: [ateMs, carroId, teamId, deMs, ateMs]) ?? 0
                let horas = max(0, horasMs / (60.0 * 60.0 * 1000.0))

                // Km de pista: soma (voltas × extensao_metros / 1000) por
                // sessão, agrupado por track via evento.
                let kmPistaMetros = try Double.fetchOne(db, sql: """
                    SELECT SUM(
                        (SELECT COUNT(*) FROM voltas v WHERE v.sessao_id = s.id AND v.valida = 1)
                        * COALESCE(t.extensao_metros, 0)
                    )
                    FROM sessoes s
                    LEFT JOIN eventos e ON e.id = s.evento_id
                    LEFT JOIN tracks t ON t.id = e.track_id
                    WHERE s.carro_id = ? AND s.time_id = ?
                      AND s.data_inicio IS NOT NULL
                      AND s.data_inicio >= ? AND s.data_inicio < ?
                """, arguments: [carroId, teamId, deMs, ateMs]) ?? 0
                let kmPista = max(0, kmPistaMetros / 1000.0)

                return (horas, kmPista)
            }
        } catch {
            print("ManutencaoInteligencia.totalStints failed: \(error)")
            return (0, 0)
        }
    }
}
