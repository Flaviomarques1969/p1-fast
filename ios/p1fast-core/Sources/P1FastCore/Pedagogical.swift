// ═══════════════════════════════════════════════════════════
// Repeatability + PedagogicalDecider — port Swift de:
//   src/domain/repeatability.js
//   src/domain/pedagogical-decider.js
// ═══════════════════════════════════════════════════════════
// Repeatability: CV (coeficiente de variação) normalizado em
// índice 0..1 — separa "rápido aleatório" de "consistente".
//
// PedagogicalDecider: matriz 2x2 score × repetibilidade →
// MANTER / ATACAR / CONSOLIDAR / IGNORAR. Base da sugestão de
// próximo stint do debrief.
//
// MS-6.2 (port 2026-05-04). Camada pura: caller traz laps + parciais.

import Foundation

// MARK: - Repeatability

public enum Repeatability {
    public static let cvMaxDefault: Double = 0.05

    public struct Result: Sendable, Equatable {
        public let index: Double      // 0..1, 3 casas
        public let cv: Double         // coeficiente de variação, 4 casas
        public let mean: Double       // 2 casas
        public let stdev: Double      // 2 casas
        public let n: Int

        public init(index: Double, cv: Double, mean: Double, stdev: Double, n: Int) {
            self.index = index; self.cv = cv; self.mean = mean
            self.stdev = stdev; self.n = n
        }
    }

    public enum Categoria: String, Sendable, Codable {
        case alta
        case media
        case baixa
        case indefinido
    }

    public static func categoria(_ index: Double?) -> Categoria {
        guard let i = index else { return .indefinido }
        if i >= 0.85 { return .alta }
        if i >= 0.65 { return .media }
        return .baixa
    }

    /// Calcula CV e index a partir de uma série de valores positivos.
    /// Retorna nil se < 2 valores válidos.
    public static func fromSeries(_ values: [Double?], cvMax: Double = cvMaxDefault) -> Result? {
        let xs = values.compactMap { $0 }.filter { $0.isFinite && $0 > 0 }
        guard xs.count >= 2 else { return nil }
        let mu = xs.reduce(0, +) / Double(xs.count)
        let variance = xs.reduce(0.0) { $0 + ($1 - mu) * ($1 - mu) } / Double(xs.count - 1)
        let sd = variance.squareRoot()
        let cv = mu > 0 ? sd / mu : 0
        let index = max(0, min(1, 1 - cv / cvMax))
        return Result(
            index: (index * 1000).rounded() / 1000,
            cv: (cv * 10000).rounded() / 10000,
            mean: (mu * 100).rounded() / 100,
            stdev: (sd * 100).rounded() / 100,
            n: xs.count
        )
    }

    /// Lap mínimo para repeatability — caller filtra `valida == true` antes.
    public struct LapInput: Sendable, Equatable {
        public let valida: Bool
        public let tempoMs: Double?
        public let temposPorParcial: [String: Double?]

        public init(valida: Bool, tempoMs: Double?, temposPorParcial: [String: Double?] = [:]) {
            self.valida = valida; self.tempoMs = tempoMs
            self.temposPorParcial = temposPorParcial
        }
    }

    /// Repetibilidade do tempo de volta nas últimas N voltas válidas.
    public static func fromLaps(_ laps: [LapInput], N: Int = 5, cvMax: Double = cvMaxDefault) -> Result? {
        let validas = laps.filter(\.valida)
        let ultimas = Array(validas.suffix(N))
        return fromSeries(ultimas.map(\.tempoMs), cvMax: cvMax)
    }

    /// Repetibilidade da parcial nas últimas N voltas válidas.
    public static func fromParcial(_ laps: [LapInput], parcialId: String, N: Int = 5, cvMax: Double = cvMaxDefault) -> Result? {
        let validas = laps.filter(\.valida)
        let ultimas = Array(validas.suffix(N))
        let values = ultimas.map { $0.temposPorParcial[parcialId] ?? nil }
        return fromSeries(values, cvMax: cvMax)
    }

    public struct Summary: Sendable, Equatable {
        public let volta: Result?
        public let porParcial: [String: Result?]
        public let overall: Double?       // index médio dos disponíveis
    }

    /// Resumo: repet. de volta + por parcial + overall (média dos indices).
    public static func summary(laps: [LapInput], parciais: [Parcial], N: Int = 5) -> Summary {
        let volta = fromLaps(laps, N: N)
        var porParcial: [String: Result?] = [:]
        for p in parciais {
            porParcial.updateValue(fromParcial(laps, parcialId: p.id, N: N), forKey: p.id)
        }
        var indices: [Double] = []
        if let v = volta { indices.append(v.index) }
        for (_, r) in porParcial {
            if let r { indices.append(r.index) }
        }
        let overall: Double? = indices.isEmpty
            ? nil
            : ((indices.reduce(0, +) / Double(indices.count)) * 1000).rounded() / 1000
        return Summary(volta: volta, porParcial: porParcial, overall: overall)
    }
}

// MARK: - PedagogicalDecider

public enum Decisao: String, Sendable, Codable, CaseIterable {
    case manter
    case atacar
    case consolidar
    case ignorar
    case indefinido
}

public struct DecisaoResult: Sendable, Equatable {
    public let decisao: Decisao
    public let razao: String

    public init(decisao: Decisao, razao: String) {
        self.decisao = decisao; self.razao = razao
    }
}

public struct DecisaoPorParcial: Sendable, Equatable {
    public let parcialId: String
    public let parcialNome: String
    public let parcialApelido: String?
    public let decisao: Decisao
    public let razao: String
    public let score: Double?
    public let repetibilidade: Double?
}

public struct DecideForParciaisResult: Sendable, Equatable {
    public let porParcial: [String: DecisaoPorParcial]
    public let lista: [DecisaoPorParcial]
}

public struct DecisaoAgrupada: Sendable, Equatable {
    public let manter: [DecisaoPorParcial]
    public let atacar: [DecisaoPorParcial]
    public let consolidar: [DecisaoPorParcial]
    public let ignorar: [DecisaoPorParcial]
}

public enum PedagogicalDecider {
    public static let scoreAltoThreshold: Double = 95
    public static let repetAltaThreshold: Double = 0.85

    public static func razaoTexto(_ d: Decisao) -> String {
        switch d {
        case .manter:     return "trecho forte e consistente — proteger"
        case .atacar:     return "erro consistente — corrigir agora"
        case .consolidar: return "rápido mas aleatório — estabilizar antes de mexer"
        case .ignorar:    return "caótico e ruim — coletar mais dados antes"
        case .indefinido: return "dados insuficientes"
        }
    }

    /// Decisão de uma parcial isolada.
    public static func decide(score: Double?, repetibilidade: Double?) -> DecisaoResult {
        guard let s = score, let r = repetibilidade else {
            return DecisaoResult(decisao: .indefinido, razao: razaoTexto(.indefinido))
        }
        let scoreAlto = s >= scoreAltoThreshold
        let repetAlta = r >= repetAltaThreshold
        let d: Decisao
        if scoreAlto && repetAlta        { d = .manter }
        else if !scoreAlto && repetAlta  { d = .atacar }
        else if scoreAlto && !repetAlta  { d = .consolidar }
        else                             { d = .ignorar }
        return DecisaoResult(decisao: d, razao: razaoTexto(d))
    }

    /// Lap pra decideForParciais — caller traz scores por parcial e flag valida.
    public struct DecideLapInput: Sendable, Equatable {
        public let valida: Bool
        public let scoresPorParcial: [String: Double?]

        public init(valida: Bool, scoresPorParcial: [String: Double?] = [:]) {
            self.valida = valida; self.scoresPorParcial = scoresPorParcial
        }
    }

    /// Decide para todas as parciais. `repetibilidadePorParcial[id]` é
    /// o índice (0..1) — caller pode obter via `Repeatability.summary`.
    public static func decideForParciais(
        parciais: [Parcial],
        laps: [DecideLapInput],
        repetibilidadePorParcial: [String: Double?]
    ) -> DecideForParciaisResult {
        var porParcial: [String: DecisaoPorParcial] = [:]
        var lista: [DecisaoPorParcial] = []
        let validas = laps.filter(\.valida)
        for p in parciais {
            let scoresValidos: [Double] = validas.compactMap { $0.scoresPorParcial[p.id] ?? nil }
            let scoreMedio: Double? = scoresValidos.isEmpty
                ? nil
                : scoresValidos.reduce(0, +) / Double(scoresValidos.count)
            let repet = repetibilidadePorParcial[p.id] ?? nil
            let d = decide(score: scoreMedio, repetibilidade: repet)
            let dado = DecisaoPorParcial(
                parcialId: p.id,
                parcialNome: p.nome,
                parcialApelido: p.apelido,
                decisao: d.decisao,
                razao: d.razao,
                score: scoreMedio.map { ($0 * 10).rounded() / 10 },
                repetibilidade: repet
            )
            porParcial[p.id] = dado
            lista.append(dado)
        }
        return DecideForParciaisResult(porParcial: porParcial, lista: lista)
    }

    public static func agrupar(_ resultado: DecideForParciaisResult) -> DecisaoAgrupada {
        var manter: [DecisaoPorParcial] = []
        var atacar: [DecisaoPorParcial] = []
        var consolidar: [DecisaoPorParcial] = []
        var ignorar: [DecisaoPorParcial] = []
        for item in resultado.lista {
            switch item.decisao {
            case .manter:     manter.append(item)
            case .atacar:     atacar.append(item)
            case .consolidar: consolidar.append(item)
            case .ignorar:    ignorar.append(item)
            case .indefinido: break
            }
        }
        return DecisaoAgrupada(manter: manter, atacar: atacar, consolidar: consolidar, ignorar: ignorar)
    }
}
