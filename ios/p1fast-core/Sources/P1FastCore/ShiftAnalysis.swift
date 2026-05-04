// ═══════════════════════════════════════════════════════════
// ShiftAnalysis — port Swift de src/domain/shift-analysis.js
// ═══════════════════════════════════════════════════════════
// Classifica um ShiftEvent (do shift-event-detector — MS-8.3) e
// produz a frase pedagógica que vai pro card pós-sessão.
//
// Função pura. Em Tier 0 (sem RPM real) o pipeline inteiro fica
// dormente — `shift-light-bridge` descarta samples sem RPM.
//
// MS-8.2 (port 2026-05-04).

import Foundation

public enum ShiftClassification: String, Sendable, Codable, CaseIterable {
    case correct
    case early
    case late
    case insufficientData = "insufficient_data"
}

/// Carro envolvido na análise. Apenas tolerância RPM hoje — pode
/// crescer pra `redline_rpm`, `safety_margin_rpm` etc. quando
/// análises adicionais forem portadas.
public struct ShiftCarContext: Sendable, Equatable {
    public var toleranceRpm: Double?
    public init(toleranceRpm: Double? = nil) {
        self.toleranceRpm = toleranceRpm
    }
}

public struct ShiftAnalysisResult: Sendable, Equatable {
    public let classification: ShiftClassification
    public let lessonText: String

    public init(classification: ShiftClassification, lessonText: String) {
        self.classification = classification
        self.lessonText = lessonText
    }
}

public enum ShiftAnalysis {
    /// Confiança mínima da estimativa de marcha pra entrar em análise.
    public static let confidenceFloor: Double = 0.7
    /// Tolerância default em RPM quando o carro não tem `toleranceRpm`.
    public static let defaultToleranceRpm: Double = 150

    /// Frases canônicas (PT-BR), paridade exata com shift-analysis.js.
    public static let phrases: [ShiftClassification: String] = [
        .correct: "Boa troca. Motor permaneceu na faixa útil e a retomada foi consistente.",
        .early:   "Você trocou cedo demais. Motor caiu fora da faixa forte e a aceleração demorou a recuperar. Próxima sessão, segure mais a marcha em <TRECHO>.",
        .late:    "Você passou do ponto ideal. Aceleração já estava perdendo eficiência antes da troca. Próxima sessão, antecipe a troca em <TRECHO>.",
        .insufficientData: "Marcha estimada com pouca confiança. Sistema usou modo seguro. Mais voltas vão melhorar a precisão."
    ]

    /// Classifica um evento de troca contra o carro.
    public static func classifyEvent(_ event: ShiftEvent, car: ShiftCarContext = ShiftCarContext()) -> ShiftClassification {
        if event.dataInconsistentFlag { return .insufficientData }
        guard let conf = event.gearConfidence, conf.isFinite, conf >= confidenceFloor else {
            return .insufficientData
        }
        guard let delta = event.deltaRpm, delta.isFinite,
              let target = event.targetOptimalRpm, target.isFinite else {
            return .insufficientData
        }
        let tolerance = car.toleranceRpm ?? defaultToleranceRpm
        if abs(delta) <= tolerance { return .correct }
        if delta < -tolerance      { return .early }
        if delta > tolerance       { return .late }
        return .insufficientData
    }

    /// Substitui `<TRECHO>` na frase pedagógica. Sem trecho, remove o
    /// fragmento " em <TRECHO>." cleanly (paridade JS).
    public static func buildLessonText(
        classification: ShiftClassification,
        trechoName: String? = nil
    ) -> String {
        let tpl = phrases[classification] ?? phrases[.insufficientData]!
        guard tpl.contains("<TRECHO>") else { return tpl }
        if let raw = trechoName?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty {
            return tpl.replacingOccurrences(of: "<TRECHO>", with: raw)
        }
        return tpl
            .replacingOccurrences(of: " em <TRECHO>.", with: ".")
            .replacingOccurrences(of: " em <TRECHO>", with: "")
    }

    /// API top-level: classifica + monta lessonText.
    /// `trechoNameLookup` é opcional — recebe `trecho_id`, devolve nome.
    public static func analyzeEvent(
        _ event: ShiftEvent,
        car: ShiftCarContext = ShiftCarContext(),
        trechoNameLookup: ((String) -> String?)? = nil
    ) -> ShiftAnalysisResult {
        let classification = classifyEvent(event, car: car)
        var trechoName: String? = nil
        if let id = event.trechoId, let lookup = trechoNameLookup {
            trechoName = lookup(id)
        }
        let lessonText = buildLessonText(classification: classification, trechoName: trechoName)
        return ShiftAnalysisResult(classification: classification, lessonText: lessonText)
    }
}
