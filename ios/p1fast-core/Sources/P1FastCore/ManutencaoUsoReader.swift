// ═══════════════════════════════════════════════════════════
// ManutencaoUsoReader — ponte entre o catálogo de consumíveis e os
// dados reais de pista (reforma 2026-05-31).
// ═══════════════════════════════════════════════════════════
// Lê o uso real de um carro a partir da tabela `sessoes`:
//   • HORAS de uso = SUM(data_fim - data_inicio) das sessões
//     encerradas e não canceladas no intervalo. Sessão ainda aberta
//     (sem data_fim) conta até `ateMs`.
//   • EVENTOS distintos no intervalo (pros limites "por evento").
//   • DIAS calendário entre os 2 instantes.
//
// Espelha o cálculo da função Manutenção de 18/05 (totalStints), mas
// com HORAS como unidade primária — que é o que o modelo do Celta usa
// (óleo 2h, arrefecimento 12h, velas 24h, fluido 2h). Função de leitura
// pura sobre GRDB — testável por p1fast-smoke com banco em memória.

import Foundation
import GRDB

public enum ManutencaoUsoReader {

    private static let msPorHora = 60.0 * 60.0 * 1000.0
    private static let msPorDia  = 24.0 * 60.0 * 60.0 * 1000.0

    /// Horas de uso somando as sessões do carro no intervalo
    /// [deMs, ateMs). Ignora sessões canceladas. Sessão sem `data_fim`
    /// (em aberto) conta até `ateMs`.
    public static func horasDeUso(_ db: Database, carroId: String, timeId: String,
                                  deMs: Int64, ateMs: Int64) throws -> Double {
        let ms = try Double.fetchOne(db, sql: """
            SELECT SUM(COALESCE(data_fim, ?) - data_inicio)
            FROM sessoes
            WHERE carro_id = ? AND time_id = ?
              AND data_inicio IS NOT NULL
              AND data_inicio >= ? AND data_inicio < ?
              AND cancelado_em IS NULL
        """, arguments: [ateMs, carroId, timeId, deMs, ateMs]) ?? 0
        return max(0, ms / msPorHora)
    }

    /// Eventos distintos em que o carro rodou no intervalo (pros limites
    /// de troca "por evento" / "a cada X eventos").
    public static func eventosDistintos(_ db: Database, carroId: String, timeId: String,
                                        deMs: Int64, ateMs: Int64) throws -> Int {
        try Int.fetchOne(db, sql: """
            SELECT COUNT(DISTINCT evento_id)
            FROM sessoes
            WHERE carro_id = ? AND time_id = ?
              AND data_inicio IS NOT NULL
              AND data_inicio >= ? AND data_inicio < ?
              AND cancelado_em IS NULL
              AND evento_id IS NOT NULL
        """, arguments: [carroId, timeId, deMs, ateMs]) ?? 0
    }

    /// Contador completo (horas + eventos + dias) entre dois instantes.
    public static func contador(_ db: Database, carroId: String, timeId: String,
                                deMs: Int64, ateMs: Int64) throws -> ContadorUso {
        let horas = try horasDeUso(db, carroId: carroId, timeId: timeId, deMs: deMs, ateMs: ateMs)
        let eventos = try eventosDistintos(db, carroId: carroId, timeId: timeId, deMs: deMs, ateMs: ateMs)
        let dias = max(0, Int(Double(ateMs - deMs) / msPorDia))
        return ContadorUso(horas: horas, eventos: eventos, dias: dias)
    }
}
