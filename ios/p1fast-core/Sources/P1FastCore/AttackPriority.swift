// ═══════════════════════════════════════════════════════════
// AttackPriority — port Swift de
//   src/domain/attack-priority.js
// ═══════════════════════════════════════════════════════════
// Prioridade técnica de ataque por PARCIAL e por TRECHO.
//
// Fórmula:
//   impactoMs  = média(tempo das últimas válidas) - melhor
//   fatorRepet = 1.0 alta | 0.8 media | 0.5 baixa | 0.7 indefinido
//   prioridade = impactoMs × fatorRepet
//
// Justificativa: atacar parcial inconsistente arrisca perder o que
// tá bom — consolidar consistência primeiro.
//
// MS-6.5 (port 2026-05-04). Camada pura. Caller traz benchmark
// (MS-6.1) + repetibilidade (MS-6.2).

import Foundation

public struct AttackRankingItem: Sendable, Equatable {
    public let parcialId: String?         // nil quando ranking é por trecho
    public let parcialNome: String?
    public let parcialApelido: String?
    public let trechoId: String?           // nil quando ranking é por parcial
    public let trechoNome: String?
    public let impactoMs: Double
    public let prioridade: Double          // 1 casa decimal
    public let repetibilidadeCategoria: Repeatability.Categoria
    public let repetibilidadeIndex: Double?
    public let razao: String
    public let tempoMedio: Double
    public let tempoMelhor: Double
    public let amostras: Int?              // só preenchido em ranking por trecho
}

public struct AttackPriorityResult: Sendable, Equatable {
    public let ranking: [AttackRankingItem]
    public let top3: [AttackRankingItem]
}

public enum AttackPriority {
    public static let fatorRepetibilidade: [Repeatability.Categoria: Double] = [
        .alta: 1.0, .media: 0.8, .baixa: 0.5, .indefinido: 0.7
    ]

    /// Compute por PARCIAL.
    public static func compute(
        laps: [PvELap],
        benchmark: BenchmarkResult?,
        repetibilidadeSummary: Repeatability.Summary?
    ) -> AttackPriorityResult {
        guard let benchmark = benchmark, !benchmark.parciais.isEmpty else {
            return AttackPriorityResult(ranking: [], top3: [])
        }
        let validas = laps.filter(\.valida)
        var ranking: [AttackRankingItem] = []
        for p in benchmark.parciais {
            let tempos = validas.map { $0.temposPorParcial[p.id] ?? nil }
            guard let m = meanPositive(tempos) else { continue }
            guard let melhor = benchmark.melhorPorParcial[p.id] ?? nil else { continue }
            let melhorMs = melhor.tempoMs
            let impactoMs = m - melhorMs
            let repIndex = repetibilidadeSummary?.porParcial[p.id]??.index
            let cat = Repeatability.categoria(repIndex)
            let fator = fatorRepetibilidade[cat] ?? 0.7
            let prioridade = impactoMs * fator
            let razao = razaoForCategoria(cat, isTrecho: false)
            ranking.append(AttackRankingItem(
                parcialId: p.id,
                parcialNome: p.nome,
                parcialApelido: p.apelido,
                trechoId: nil, trechoNome: nil,
                impactoMs: impactoMs.rounded(),
                prioridade: (prioridade * 10).rounded() / 10,
                repetibilidadeCategoria: cat,
                repetibilidadeIndex: repIndex,
                razao: razao,
                tempoMedio: m.rounded(),
                tempoMelhor: melhorMs,
                amostras: nil
            ))
        }
        ranking.sort { $0.prioridade > $1.prioridade }
        return AttackPriorityResult(ranking: ranking, top3: Array(ranking.prefix(3)))
    }

    /// Lap mínimo para ranking por trecho — caller traz `temposPorTrecho`.
    public struct LapPorTrecho: Sendable, Equatable {
        public let id: String
        public let valida: Bool
        public let temposPorTrecho: [String: Double?]

        public init(id: String, valida: Bool, temposPorTrecho: [String: Double?] = [:]) {
            self.id = id; self.valida = valida; self.temposPorTrecho = temposPorTrecho
        }
    }

    public struct MelhorTrecho: Sendable, Equatable {
        public let tempoMs: Double
        public init(tempoMs: Double) { self.tempoMs = tempoMs }
    }

    /// Compute por TRECHO (gate 2026-04-24, CORNER_ANALYSIS_RULES).
    /// Trecho = TrackSegment com `ehTrecho=true`. Ranking por trecho
    /// individual em vez de parcial agregada.
    public static func computeForTrechos(
        laps: [LapPorTrecho],
        trechos: [TrackSegment],
        melhorPorTrecho: [String: MelhorTrecho],
        repetibilidadePorTrecho: [String: Repeatability.Result?]? = nil
    ) -> AttackPriorityResult {
        guard !trechos.isEmpty else {
            return AttackPriorityResult(ranking: [], top3: [])
        }
        let validas = laps.filter(\.valida)
        var ranking: [AttackRankingItem] = []
        for t in trechos {
            let tempos = validas.map { $0.temposPorTrecho[t.id] ?? nil }
            guard let m = meanPositive(tempos) else { continue }
            guard let melhor = melhorPorTrecho[t.id] else { continue }
            let impactoMs = m - melhor.tempoMs
            let repIndex = repetibilidadePorTrecho?[t.id]??.index
            let cat: Repeatability.Categoria = repIndex != nil
                ? Repeatability.categoria(repIndex)
                : .indefinido
            let fator = fatorRepetibilidade[cat] ?? 0.7
            let prioridade = impactoMs * fator
            let razao = razaoForCategoria(cat, isTrecho: true)
            let amostras = tempos.compactMap { $0 }.count
            ranking.append(AttackRankingItem(
                parcialId: t.parcialId,
                parcialNome: nil, parcialApelido: nil,
                trechoId: t.id,
                trechoNome: t.nome,
                impactoMs: impactoMs.rounded(),
                prioridade: (prioridade * 10).rounded() / 10,
                repetibilidadeCategoria: cat,
                repetibilidadeIndex: repIndex,
                razao: razao,
                tempoMedio: m.rounded(),
                tempoMelhor: melhor.tempoMs,
                amostras: amostras
            ))
        }
        ranking.sort { $0.prioridade > $1.prioridade }
        return AttackPriorityResult(ranking: ranking, top3: Array(ranking.prefix(3)))
    }
}

// MARK: - Helpers

private func meanPositive(_ vs: [Double?]) -> Double? {
    let valid = vs.compactMap { $0 }.filter { $0.isFinite && $0 > 0 }
    guard !valid.isEmpty else { return nil }
    return valid.reduce(0, +) / Double(valid.count)
}

private func razaoForCategoria(_ cat: Repeatability.Categoria, isTrecho: Bool) -> String {
    switch cat {
    case .baixa: return "inconsistente — consolidar antes"
    case .media: return "potencial moderado"
    case .alta:  return "consistente e acima do melhor — atacável"
    case .indefinido:
        return isTrecho
            ? "sem dados de repetibilidade — usar com cautela"
            : "sem dados suficientes"
    }
}
