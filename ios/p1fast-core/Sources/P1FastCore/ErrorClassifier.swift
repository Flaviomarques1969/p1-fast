// ═══════════════════════════════════════════════════════════
// ErrorClassifier — port Swift de src/domain/error-classifier.js
// ═══════════════════════════════════════════════════════════
// Transforma telemetria em LINGUAGEM DE PISTA.
//
// Taxonomia (16 rótulos): paridade exata com error-classifier.js,
// mantida em ErroTipo.rawValue.
//
// Regra ADR-010 / SPEC_COCKPIT: UMA classificação principal por trecho.
// Pode retornar secundária (consumida pelo box, nunca cockpit).
//
// MS-1.2 (port 2026-05-04). Análise de apex usa apexReference + 4
// pontos canônicos do TrackSegment portados em MS-1.1.

import Foundation

/// 16 classificações canônicas (raw values em paridade exata com JS).
public enum ErroTipo: String, Codable, Sendable, CaseIterable {
    case freouCedo            = "freou-cedo"
    case freouTardeDemais     = "freou-tarde-demais"
    case entrouForteDemais    = "entrou-forte-demais"
    case entrouTimido         = "entrou-timido"
    case perdeuRotacao        = "perdeu-rotacao"
    case matouSaida           = "matou-saida"
    case perdeuTracao         = "perdeu-tracao"
    case manteveLinha         = "manteve-linha"
    case saiuForte            = "saiu-forte"
    case boaFrenagem          = "boa-frenagem"
    case tempoMedio           = "tempo-medio"
    case apexPerdidoFora      = "apex-perdido-fora"
    case apexAntecipado       = "apex-antecipado"
    case apexTardio           = "apex-tardio"
    case apexInternoDemais    = "apex-interno-demais"
    case apexSacrificouSaida  = "apex-sacrificou-saida"
}

public enum ErroLabel {
    /// Linguagem humana de pista (PT-BR), paridade com `ErroLabel` JS.
    public static func humanize(_ tipo: ErroTipo) -> String {
        switch tipo {
        case .freouCedo:           return "Freou cedo"
        case .freouTardeDemais:    return "Freou tarde demais"
        case .entrouForteDemais:   return "Entrou forte demais"
        case .entrouTimido:        return "Entrou tímido"
        case .perdeuRotacao:       return "Perdeu rotação"
        case .matouSaida:          return "Matou a saída"
        case .perdeuTracao:        return "Perdeu tração"
        case .manteveLinha:        return "Manteve linha"
        case .saiuForte:           return "Saiu forte"
        case .boaFrenagem:         return "Boa frenagem"
        case .tempoMedio:          return "Ritmo médio"
        case .apexPerdidoFora:     return "Apex perdido por fora"
        case .apexAntecipado:      return "Apex antecipado"
        case .apexTardio:          return "Apex tardio"
        case .apexInternoDemais:   return "Apex interno demais"
        case .apexSacrificouSaida: return "Apex sacrificou saída"
        }
    }
}

/// Execução medida pelo detector ao vivo durante 1 trecho.
public struct SegmentExecutionInput: Sendable, Equatable {
    public var tempoMs: Double?
    public var velEntrada: Double?    // m/s no entryPoint (Vmax pré-freio)
    public var velMinima: Double?     // m/s no apex
    public var velSaida: Double?      // m/s no exitPoint
    public var apexActual: ApexReference?

    public init(
        tempoMs: Double? = nil,
        velEntrada: Double? = nil,
        velMinima: Double? = nil,
        velSaida: Double? = nil,
        apexActual: ApexReference? = nil
    ) {
        self.tempoMs = tempoMs
        self.velEntrada = velEntrada
        self.velMinima = velMinima
        self.velSaida = velSaida
        self.apexActual = apexActual
    }
}

/// Referência (PB do dia, PB all-time, ghost selecionado).
public struct SegmentReferenceInput: Sendable, Equatable {
    public var tempoMs: Double?       // melhor tempo
    public var velEntradaMedia: Double?
    public var velMinimaMedia: Double?
    public var velSaidaMedia: Double?
    public var apexReference: ApexReference?
    public var apexStrategy: ApexStrategy?
    public var nextStraightLength: Double?

    public init(
        tempoMs: Double? = nil,
        velEntradaMedia: Double? = nil,
        velMinimaMedia: Double? = nil,
        velSaidaMedia: Double? = nil,
        apexReference: ApexReference? = nil,
        apexStrategy: ApexStrategy? = nil,
        nextStraightLength: Double? = nil
    ) {
        self.tempoMs = tempoMs
        self.velEntradaMedia = velEntradaMedia
        self.velMinimaMedia = velMinimaMedia
        self.velSaidaMedia = velSaidaMedia
        self.apexReference = apexReference
        self.apexStrategy = apexStrategy
        self.nextStraightLength = nextStraightLength
    }
}

public struct Evidencia: Codable, Sendable, Equatable {
    public let metric: String
    public let delta: Double      // fração arredondada a 4 casas
    public let deltaPct: Double   // pct arredondado a 1 casa
    public let unit: String

    public init(metric: String, delta: Double, deltaPct: Double, unit: String) {
        self.metric = metric
        self.delta = delta
        self.deltaPct = deltaPct
        self.unit = unit
    }
}

public struct Classification: Sendable, Equatable {
    public let principal: ErroTipo?
    public let secundaria: ErroTipo?
    public let evidencias: [Evidencia]
    public let confianca: Double

    public init(
        principal: ErroTipo?,
        secundaria: ErroTipo?,
        evidencias: [Evidencia],
        confianca: Double
    ) {
        self.principal = principal
        self.secundaria = secundaria
        self.evidencias = evidencias
        self.confianca = confianca
    }
}

public enum ErrorClassifier {
    /// Tolerância lateral em metros (delta vs apex ideal).
    /// Apex "correto" = dentro de APEX_TOL_LATERAL_M.
    public static let apexTolLateralM: Double = 1.5
    public static let apexTolLongitudinalM: Double = 4.0

    /// Thresholds adimensionais (frações), paridade JS.
    public enum Threshold {
        public static let tempoBom: Double       = 0.01  // dentro de 1% do melhor
        public static let tempoRuim: Double      = 0.03  // acima de 3%
        public static let velSignificant: Double = 0.04  // 4% relevante
        public static let velForte: Double       = 0.07  // 7% muito forte
    }

    /// Classifica 1 execução de trecho vs referência.
    public static func classify(
        execution: SegmentExecutionInput,
        reference: SegmentReferenceInput
    ) -> Classification {
        var evidencias: [Evidencia] = []

        let dTempo   = delta(execution.tempoMs,    reference.tempoMs)
        let dEntrada = delta(execution.velEntrada, reference.velEntradaMedia)
        let dApice   = delta(execution.velMinima,  reference.velMinimaMedia)
        let dSaida   = delta(execution.velSaida,   reference.velSaidaMedia)

        push(&evidencias, "tempo",    dTempo,   "ms")
        push(&evidencias, "vEntrada", dEntrada, "m/s")
        push(&evidencias, "vApice",   dApice,   "m/s")
        push(&evidencias, "vSaida",   dSaida,   "m/s")

        // Análise de apex (opcional — só se cadastro existe)
        let apexInfo = classifyApex(
            actual: execution.apexActual,
            reference: reference.apexReference
        )
        if let info = apexInfo {
            push(&evidencias, "apexLateralM", info.distLateralM, "m")
        }

        // ─── Apex prejudicou a saída? ────────────────────────────
        if apexSacrificouSaida(apexInfo: apexInfo, dSaida: dSaida, reference: reference) {
            return emit(.apexSacrificouSaida, .matouSaida, evidencias, 0.8)
        }

        // ─── Apex perdido por fora (prioritário sobre velocidade) ───
        if let info = apexInfo, info.distLateralM > apexTolLateralM * 2 {
            return emit(.apexPerdidoFora, nil, evidencias, 0.75)
        }

        // ─── Acertos (prioridade positiva) ────────────────────────
        let tempoBom = (dTempo != nil) && (dTempo! <= Threshold.tempoBom)
        let saidaForte = (dSaida != nil) && (dSaida! >= Threshold.velForte)
        if saidaForte && tempoBom {
            return emit(.saiuForte, secundaria(tempoBom: tempoBom), evidencias, 0.9)
        }
        let entradaOk = (dEntrada != nil) && (abs(dEntrada!) < Threshold.velSignificant)
        let apiceOk   = (dApice   != nil) && (abs(dApice!)   < Threshold.velSignificant)
        if tempoBom && entradaOk && apiceOk {
            return emit(.manteveLinha, nil, evidencias, 0.85)
        }
        if tempoBom, let dA = dApice, dA >= -Threshold.velSignificant {
            return emit(.boaFrenagem, nil, evidencias, 0.8)
        }

        // ─── Erros (mais específico antes) ────────────────────────
        // Freou tarde demais: entrou alta + ápice MUITO baixo
        if let dE = dEntrada, dE >= Threshold.velSignificant,
           let dA = dApice,   dA <= -Threshold.velForte {
            return emit(.freouTardeDemais, nil, evidencias, 0.85)
        }
        // Entrou forte demais: vEntrada muito alta + tempo ruim
        if let dE = dEntrada, dE >= Threshold.velForte,
           let dT = dTempo,   dT > Threshold.tempoRuim {
            return emit(.entrouForteDemais, nil, evidencias, 0.8)
        }
        // Entrou tímido
        if let dE = dEntrada, dE <= -Threshold.velSignificant,
           let dT = dTempo,   dT > Threshold.tempoBom {
            return emit(.entrouTimido, nil, evidencias, 0.8)
        }
        // Freou cedo
        if let dA = dApice, dA <= -Threshold.velSignificant,
           let dT = dTempo, dT > Threshold.tempoRuim {
            return emit(.freouCedo, nil, evidencias, 0.7)
        }
        // Matou saída
        if let dS = dSaida, dS <= -Threshold.velSignificant,
           let dT = dTempo, dT > Threshold.tempoBom {
            return emit(.matouSaida, nil, evidencias, 0.8)
        }
        // Perdeu rotação
        if let dS = dSaida,   dS <= -Threshold.velSignificant,
           let dE = dEntrada, dE <= 0 {
            return emit(.perdeuRotacao, nil, evidencias, 0.6)
        }
        // Perdeu tração
        if let dS = dSaida, dS <= -Threshold.velForte,
           let dA = dApice, dA >= -Threshold.velSignificant {
            return emit(.perdeuTracao, nil, evidencias, 0.7)
        }

        // Default: manteve linha se tempo não explodiu
        if let dT = dTempo, dT <= Threshold.tempoRuim {
            return emit(.manteveLinha, nil, evidencias, 0.5)
        }

        return Classification(
            principal: nil, secundaria: nil,
            evidencias: evidencias, confianca: 0
        )
    }

    public static func humanize(_ tipo: ErroTipo) -> String {
        ErroLabel.humanize(tipo)
    }
}

// MARK: - Internals (parity com error-classifier.js)

private struct ApexAnalysis {
    let distLateralM: Double
    let deltaXM: Double
    let deltaYM: Double
}

/// Classifica apex a partir de actual vs reference. Retorna nil se
/// dado insuficiente. Sem direção tangente, distância total euclidiana
/// = |delta lateral| (substituir por projeção tangencial quando
/// reference tiver tangente cadastrada).
private func classifyApex(
    actual: ApexReference?,
    reference: ApexReference?
) -> ApexAnalysis? {
    guard let a = actual, let r = reference else { return nil }
    let dx = a.x - r.x
    let dy = a.y - r.y
    return ApexAnalysis(
        distLateralM: (dx * dx + dy * dy).squareRoot(),
        deltaXM: dx,
        deltaYM: dy
    )
}

/// Decide se o apex prejudicou a saída.
/// delta lateral OK + velSaida muito baixa + nextStraight >= 200m.
private func apexSacrificouSaida(
    apexInfo: ApexAnalysis?,
    dSaida: Double?,
    reference: SegmentReferenceInput
) -> Bool {
    guard let info = apexInfo else { return false }
    if info.distLateralM > ErrorClassifier.apexTolLateralM { return false }
    guard let dS = dSaida, dS < -0.04 else { return false }
    return (reference.nextStraightLength ?? 0) >= 200
}

private func delta(_ actual: Double?, _ ref: Double?) -> Double? {
    guard let a = actual, let r = ref, r != 0 else { return nil }
    return (a - r) / r
}

private func push(_ evs: inout [Evidencia], _ metric: String, _ deltaVal: Double?, _ unit: String) {
    guard let d = deltaVal else { return }
    let rounded = (d * 10000).rounded() / 10000
    let pct = (d * 1000).rounded() / 10
    evs.append(Evidencia(metric: metric, delta: rounded, deltaPct: pct, unit: unit))
}

private func secundaria(tempoBom: Bool) -> ErroTipo? {
    tempoBom ? .manteveLinha : nil
}

private func emit(
    _ principal: ErroTipo,
    _ secundaria: ErroTipo?,
    _ evidencias: [Evidencia],
    _ confianca: Double
) -> Classification {
    Classification(
        principal: principal,
        secundaria: secundaria,
        evidencias: evidencias,
        confianca: confianca
    )
}
