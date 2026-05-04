// ═══════════════════════════════════════════════════════════
// Score + Benchmark — port Swift de:
//   src/domain/score.js
//   src/domain/benchmark.js (camada pura, sem IO)
// ═══════════════════════════════════════════════════════════
// Score: cálculo de score numérico bruto e compensado.
//   • Bruto: (melhor / atual) × 100, clamp 0..100.
//   • Compensado: pondera por parciais, com peso opcional e
//     fator-contexto (ar, umidade).
//
// Benchmark: dado um conjunto de voltas válidas + lista de parciais,
// computa melhor volta, melhor por parcial e ideal teórica
// (soma das melhores parciais — possivelmente de voltas diferentes).
//
// Camada pura: nenhuma chamada a DB/Dexie/GRDB. O caller iOS
// (StintRepository, BenchmarkRepository) coleta laps válidas via
// GRDB e chama Benchmark.compute(...).
//
// MS-6.1 (port 2026-05-04). Base do debrief pós-stint (MS-6).

import Foundation

// MARK: - Score

public enum Scores {
    /// Score bruto de volta vs melhor volta.
    /// 100 = empatou. 95 = 5% mais lento. 0 = sem ref / inválido.
    /// Arredondado a 1 casa decimal.
    public static func lap(tempoAtualMs: Double?, melhorTempoMs: Double?) -> Double? {
        guard let atual = tempoAtualMs, let melhor = melhorTempoMs,
              atual.isFinite, melhor.isFinite,
              atual > 0, melhor > 0 else { return nil }
        let raw = (melhor / atual) * 100
        let clamped = max(0, min(100, raw))
        return (clamped * 10).rounded() / 10
    }

    /// Score bruto de parcial/trecho vs melhor do mesmo.
    public static func trecho(tempoAtualMs: Double?, melhorTempoMs: Double?) -> Double? {
        lap(tempoAtualMs: tempoAtualMs, melhorTempoMs: melhorTempoMs)
    }

    /// Categoria a partir do score numérico.
    public static func categoria(_ score: Double?) -> ScoreCategoria {
        guard let s = score else { return .indefinido }
        if s >= 98 { return .excelente }
        if s >= 95 { return .bom }
        if s >= 90 { return .medio }
        return .ruim
    }

    /// Resultado de fromLap — score por parcial + score da volta.
    public struct FromLapResult: Sendable, Equatable {
        public let volta: Double?
        public let porParcial: [String: Double?]
    }

    /// Calcula scores por parcial + volta dado um Lap e um Benchmark.
    public static func fromLap(_ input: ScoreLapInput, benchmark: BenchmarkResult) -> FromLapResult {
        var porParcial: [String: Double?] = [:]
        for (parcialId, best) in benchmark.melhorPorParcial {
            let actual = input.temposPorParcial[parcialId] ?? nil
            porParcial[parcialId] = trecho(
                tempoAtualMs: actual,
                melhorTempoMs: best?.tempoMs
            )
        }
        return FromLapResult(
            volta: Scores.lap(tempoAtualMs: input.tempoMs, melhorTempoMs: benchmark.melhorVolta?.tempoMs),
            porParcial: porParcial
        )
    }

    /// SCORE COMPENSADO por parciais.
    /// - weights: distribuição opcional. Sem pesos → distribui igual.
    /// - contexto: ajusta fator (ar, umidade).
    public static func compensado(
        lap: ScoreLapInput,
        benchmark: BenchmarkResult,
        weights: [String: Double]? = nil,
        contextoLap: ScoreContexto? = nil,
        contextoRef: ScoreContexto? = nil
    ) -> ScoreCompensado? {
        let parciaisIds = Array(benchmark.melhorPorParcial.keys)
        guard !parciaisIds.isEmpty else { return nil }

        let pesos: [String: Double] = weights ?? Dictionary(
            uniqueKeysWithValues: parciaisIds.map { ($0, 100.0 / Double(parciaisIds.count)) }
        )

        let presentes = parciaisIds.filter { lap.temposPorParcial[$0] ?? nil != nil }
        if presentes.isEmpty { return nil }

        var breakdown: [String: Double?] = [:]
        var somaPesada: Double = 0
        var somaPesosValidos: Double = 0
        for id in parciaisIds {
            let t = lap.temposPorParcial[id] ?? nil
            let m = benchmark.melhorPorParcial[id]??.tempoMs
            let sc = trecho(tempoAtualMs: t, melhorTempoMs: m)
            breakdown[id] = sc
            if let s = sc, let w = pesos[id] {
                somaPesada += s * w
                somaPesosValidos += w
            }
        }
        if somaPesosValidos == 0 { return nil }

        let scoreRaw = somaPesada / somaPesosValidos
        let fator = fatorContexto(lap: contextoLap, ref: contextoRef)
        let scoreFinal = max(0, min(100, ((scoreRaw * fator) * 10).rounded() / 10))

        // Explicação
        let presentesValidos: [(String, Double)] = presentes.compactMap { id in
            (breakdown[id] ?? nil).map { (id, $0) }
        }.sorted { $0.1 < $1.1 }
        let parcial = presentes.count < parciaisIds.count
        var explicacao: String? = nil
        if !presentesValidos.isEmpty {
            let pior = presentesValidos.first!
            let melhor = presentesValidos.last!
            let diff = melhor.1 - pior.1
            if diff < 2                 { explicacao = "consistente em todas as parciais" }
            else if pior.1 < 90         { explicacao = "\(pior.0) puxou pra baixo" }
            else if melhor.1 >= 98      { explicacao = "\(melhor.0) excelente" }
            else                        { explicacao = "\(melhor.0) forte, \(pior.0) pode melhorar" }
        }
        if parcial {
            explicacao = "dados parciais: \(presentes.count)/\(parciaisIds.count) parciais"
        }

        return ScoreCompensado(
            score: scoreFinal,
            breakdown: breakdown,
            parciaisConsideradas: presentes.count,
            totalParciais: parciaisIds.count,
            parcial: parcial,
            fatorContexto: fator,
            explicacao: explicacao,
            weights: pesos
        )
    }
}

public enum ScoreCategoria: String, Sendable, Codable {
    case excelente
    case bom
    case medio
    case ruim
    case indefinido
}

public struct ScoreLapInput: Sendable, Equatable {
    public let id: String?
    public let tempoMs: Double?
    public let temposPorParcial: [String: Double?]

    public init(id: String? = nil, tempoMs: Double?, temposPorParcial: [String: Double?] = [:]) {
        self.id = id
        self.tempoMs = tempoMs
        self.temposPorParcial = temposPorParcial
    }
}

public struct ScoreContexto: Sendable, Equatable {
    public let temperaturaAr: Double?
    public let umidade: Double?
    public init(temperaturaAr: Double? = nil, umidade: Double? = nil) {
        self.temperaturaAr = temperaturaAr
        self.umidade = umidade
    }
}

public struct ScoreCompensado: Sendable, Equatable {
    public let score: Double
    public let breakdown: [String: Double?]
    public let parciaisConsideradas: Int
    public let totalParciais: Int
    public let parcial: Bool
    public let fatorContexto: Double
    public let explicacao: String?
    public let weights: [String: Double]
}

private func fatorContexto(lap: ScoreContexto?, ref: ScoreContexto?) -> Double {
    guard let lap, let ref else { return 1.0 }
    var fator: Double = 1.0
    if let lapTar = lap.temperaturaAr, let refTar = ref.temperaturaAr,
       abs(lapTar - refTar) > 10 {
        fator *= 1.02
    }
    if let lapU = lap.umidade, let refU = ref.umidade,
       abs(lapU - refU) > 20 {
        fator *= 1.01
    }
    return fator
}

// MARK: - Benchmark (camada pura)

/// Lap mínimo para benchmark — caller filtra `valida == true` antes.
public struct BenchmarkLapInput: Sendable, Equatable {
    public let id: String
    public let tempoMs: Double
    public let numero: Int?
    public let sessionId: String?
    public let inicioAt: Double?            // ms epoch
    public let temposPorParcial: [String: Double?]

    public init(
        id: String, tempoMs: Double, numero: Int? = nil,
        sessionId: String? = nil, inicioAt: Double? = nil,
        temposPorParcial: [String: Double?] = [:]
    ) {
        self.id = id
        self.tempoMs = tempoMs
        self.numero = numero
        self.sessionId = sessionId
        self.inicioAt = inicioAt
        self.temposPorParcial = temposPorParcial
    }
}

public struct BenchmarkBestLap: Sendable, Equatable {
    public let id: String
    public let tempoMs: Double
    public let numero: Int?
    public let sessionId: String?
    public let dia: String?

    public init(id: String, tempoMs: Double, numero: Int? = nil,
                sessionId: String? = nil, dia: String? = nil) {
        self.id = id; self.tempoMs = tempoMs; self.numero = numero
        self.sessionId = sessionId; self.dia = dia
    }
}

public struct BenchmarkBestParcial: Sendable, Equatable {
    public let tempoMs: Double
    public let lapId: String
    public let numero: Int?

    public init(tempoMs: Double, lapId: String, numero: Int? = nil) {
        self.tempoMs = tempoMs; self.lapId = lapId; self.numero = numero
    }
}

public struct BenchmarkScope: Sendable, Equatable {
    public let carId: String
    public let trackId: String
    public let carConfigurationId: String?
    public let dia: String?

    public init(carId: String, trackId: String,
                carConfigurationId: String? = nil, dia: String? = nil) {
        self.carId = carId; self.trackId = trackId
        self.carConfigurationId = carConfigurationId; self.dia = dia
    }
}

public struct BenchmarkResult: Sendable, Equatable {
    public let scope: BenchmarkScope
    public let parciais: [Parcial]
    public let voltasConsideradas: Int
    public let melhorVolta: BenchmarkBestLap?
    public let melhorPorParcial: [String: BenchmarkBestParcial?]
    public let idealTeoricaMs: Double?
    public let ganhoTeoricoMs: Double?

    public init(scope: BenchmarkScope, parciais: [Parcial],
                voltasConsideradas: Int,
                melhorVolta: BenchmarkBestLap?,
                melhorPorParcial: [String: BenchmarkBestParcial?],
                idealTeoricaMs: Double?, ganhoTeoricoMs: Double?) {
        self.scope = scope; self.parciais = parciais
        self.voltasConsideradas = voltasConsideradas
        self.melhorVolta = melhorVolta
        self.melhorPorParcial = melhorPorParcial
        self.idealTeoricaMs = idealTeoricaMs
        self.ganhoTeoricoMs = ganhoTeoricoMs
    }
}

public enum Benchmark {
    /// Computa o benchmark a partir dos laps já coletados pelo caller.
    /// Caller é responsável por filtrar `valida == true` e o escopo
    /// (mesmo carId, trackId, carConfigurationId, dia).
    public static func compute(
        scope: BenchmarkScope,
        parciais: [Parcial],
        laps: [BenchmarkLapInput]
    ) -> BenchmarkResult? {
        guard !laps.isEmpty else { return nil }

        let melhor = laps.min { $0.tempoMs < $1.tempoMs }!
        let melhorVolta = BenchmarkBestLap(
            id: melhor.id,
            tempoMs: melhor.tempoMs,
            numero: melhor.numero,
            sessionId: melhor.sessionId,
            dia: melhor.inicioAt.map(dayKey)
        )

        var melhorPorParcial: [String: BenchmarkBestParcial?] = [:]
        for p in parciais {
            // Pega lapsValidos para esta parcial (tempo > 0)
            let lapsComTempo: [(BenchmarkLapInput, Double)] = laps.compactMap { lap in
                guard let v = lap.temposPorParcial[p.id] ?? nil, v > 0 else { return nil }
                return (lap, v)
            }
            if let best = lapsComTempo.min(by: { $0.1 < $1.1 }) {
                melhorPorParcial[p.id] = BenchmarkBestParcial(
                    tempoMs: best.1, lapId: best.0.id, numero: best.0.numero
                )
            } else {
                // Swift: atribuir `nil` em [String: V?] REMOVE a chave.
                // Pra preservar a chave com valor nil, usar updateValue(.some(nil), ...).
                melhorPorParcial.updateValue(BenchmarkBestParcial?.none, forKey: p.id)
            }
        }

        let todasCompletas = !parciais.isEmpty
            && parciais.allSatisfy { melhorPorParcial[$0.id] ?? nil != nil }
        let idealTeoricaMs: Double? = todasCompletas
            ? parciais.reduce(0) { $0 + (melhorPorParcial[$1.id]??.tempoMs ?? 0) }
            : nil
        let ganhoTeoricoMs: Double? = idealTeoricaMs.map { melhorVolta.tempoMs - $0 }

        return BenchmarkResult(
            scope: scope,
            parciais: parciais,
            voltasConsideradas: laps.count,
            melhorVolta: melhorVolta,
            melhorPorParcial: melhorPorParcial,
            idealTeoricaMs: idealTeoricaMs,
            ganhoTeoricoMs: ganhoTeoricoMs
        )
    }

    /// Chave do dia "YYYY-MM-DD" a partir de timestamp em ms (UTC).
    /// Paridade com `dayKey(timestamp)` em benchmark.js — mas usa
    /// timezone do dispositivo (igual ao Date JS).
    public static func dayKey(_ msEpoch: Double) -> String {
        let date = Date(timeIntervalSince1970: msEpoch / 1000)
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone.current
        return fmt.string(from: date)
    }
}
