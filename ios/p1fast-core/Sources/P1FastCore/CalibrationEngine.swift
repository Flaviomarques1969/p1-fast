// ═══════════════════════════════════════════════════════════
// CalibrationEngine — motor da Camada 2 (engenharia codificada)
// ═══════════════════════════════════════════════════════════
// MS-16.3 (Command Box Engenharia — Camada 2).
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 (Camada 2 — Calibration Engine).
// Resolve gap G3.
//
// Princípio (ADR-008):
//   • Camada 1 (Critical Rules + Cross Validation) decide CRÍTICO.
//   • Camada 2 (este motor) opera sobre VehicleContext mantido pelo
//     VehicleContextAggregator (MS-16.2). Produz Findings determinísticos
//     com confiança quantificada. NUNCA usa IA aqui.
//   • Camada 3 (Senior Advisor IA, MS-16.4) consome Findings + contexto +
//     stint history e produz recomendações narrativas. Decide humano.
//
// Cooldown por regra previne flood (idem CriticalRules.cooldownMs). Cada
// regra declara `minConsecutiveLaps` e `minSamples` próprios — sem
// quórum, não dispara.
//
// MVP rules (D6 Flávio 2026-05-13):
//   1. fuel-lean-sustained-load
//   2. water-temp-drift-no-cooling
//   3. vmin-progressive-loss-segment
//
// Rules adicionais entram em sub-sprints futuros (catálogo completo no
// §5.1 do doc audit). Gate D5 (mapa carregado) abre rules específicas
// de célula RPM × MAP (MS-16.9 opcional).

import Foundation

/// Cada CalibrationRule é uma hipótese codificada — quórum + evidência →
/// finding + recommendation determinísticos. Implementações concretas em
/// arquivos próprios na pasta Rules/.
public protocol CalibrationRule {
    /// ID estável usado em logs, persistência e feedback loop.
    var id: String { get }

    /// Cooldown entre disparos da mesma regra (ms).
    var cooldownMs: Double { get }

    /// Avalia o contexto e retorna finding se condição satisfeita.
    /// Implementação responsável por checar quality dos canais usados.
    func evaluate(context: VehicleContext, now: () -> Double) -> EngineeringFinding?

    /// A partir de um finding, propõe recommendation (ajustes + risco +
    /// como validar). Retorna nil se finding não tem força suficiente
    /// pra recommendation (ex.: confianca .baixa abaixo do limiar).
    func proposeRecommendation(from finding: EngineeringFinding,
                               context: VehicleContext) -> EngineeringRecommendation?
}

public final class CalibrationEngine {
    private let rules: [CalibrationRule]
    private let minConfidenceForRecommendation: FindingConfianca
    private var lastFiredAt: [String: Double] = [:]

    public init(
        rules: [CalibrationRule] = CalibrationEngine.defaultRules,
        minConfidenceForRecommendation: FindingConfianca = .media
    ) {
        self.rules = rules
        self.minConfidenceForRecommendation = minConfidenceForRecommendation
    }

    /// Avalia todas as regras contra o contexto atual. Findings emitidos
    /// respeitam cooldown por regra. `now` injetado pra testes determinísticos.
    public func evaluate(context: VehicleContext, now: () -> Double) -> [EngineeringFinding] {
        var out: [EngineeringFinding] = []
        for rule in rules {
            if let last = lastFiredAt[rule.id],
               (now() - last) < rule.cooldownMs {
                continue
            }
            if let finding = rule.evaluate(context: context, now: now) {
                lastFiredAt[rule.id] = now()
                out.append(finding)
            }
        }
        return out
    }

    /// Pra cada finding, deriva recommendation se confianca ≥ threshold (D7).
    public func proposeRecommendations(findings: [EngineeringFinding],
                                       context: VehicleContext) -> [EngineeringRecommendation] {
        var out: [EngineeringRecommendation] = []
        for finding in findings {
            guard finding.confianca.severity >= minConfidenceForRecommendation.severity else {
                continue
            }
            guard let rule = rules.first(where: { $0.id == finding.ruleId }) else { continue }
            if let rec = rule.proposeRecommendation(from: finding, context: context) {
                out.append(rec)
            }
        }
        return out
    }

    /// Limpa cooldowns — útil em testes e na transição stint→stint.
    public func reset() {
        lastFiredAt.removeAll()
    }

    public static var defaultRules: [CalibrationRule] {
        [
            FuelLeanSustainedLoadRule(),
            WaterTempDriftNoCoolingRule(),
            VminProgressiveLossSegmentRule(),
        ]
    }
}

/// Helper: severidade ordenada de FindingConfianca pra comparação.
extension FindingConfianca {
    public var severity: Int {
        switch self {
        case .baixa: return 0
        case .media: return 1
        case .alta: return 2
        }
    }
}

/// Helper interno: gera UUID-like determinístico-em-testes via injection.
/// Por enquanto usa Foundation.UUID.uuidString — caller injeta em testes
/// via wrapper se precisar reprodutibilidade total.
@inline(__always)
func newFindingId() -> String {
    return "fin-" + UUID().uuidString.lowercased().prefix(8).description
}

@inline(__always)
func newRecommendationId() -> String {
    return "rec-" + UUID().uuidString.lowercased().prefix(8).description
}
