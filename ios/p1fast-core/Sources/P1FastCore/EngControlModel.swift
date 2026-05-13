// ═══════════════════════════════════════════════════════════
// EngControlModel — modelo lógico de slider + knob (domain puro)
// ═══════════════════════════════════════════════════════════
// MS-16.5 (Command Box Engenharia — Tab Engenharia UI domain).
// docs/COMMAND_BOX_ENGENHARIA.md §6 MS-16.5 + §11 D17 (gating
// por papel × velocidade) + §11 D19 (latência slider→propagação).
//
// Modelo puro Swift sem UIKit/SwiftUI: representa o estado lógico
// de um controle tátil (slider linear ou knob rotativo), com regras
// de range, snap, e permissão. SwiftUI View consome via observer.
// Permite testar a lógica em smokes CLI sem Xcode.

import Foundation

/// Tipo de controle tátil.
public enum EngControlKind: String, Codable, Sendable, CaseIterable {
    case slider   // linear, deslizar — ajustes percentuais (-10% a +10%)
    case knob     // rotativo, girar — varreduras de célula, ângulo
    case toggle   // binário on/off — flag módulo engenharia, mostrar overlay
}

/// Papel da pessoa que está operando o controle (D17 fechada).
public enum EngControlPapel: String, Codable, Sendable, CaseIterable {
    case chefe       // livre sempre
    case engenheiro  // livre sempre
    case mecanico    // livre quando carro parado (paridade D17 piloto pra rules de simulação)
    case piloto      // só com carro parado
    case readonly    // não pode operar (mãe, amigos)
}

/// Resultado de tentativa de mudar valor — `accepted=false` quando
/// permissão nega ou range inválido.
public struct EngControlChangeResult: Sendable, Equatable {
    public let accepted: Bool
    public let value: Double
    public let motivo: String?

    public init(accepted: Bool, value: Double, motivo: String? = nil) {
        self.accepted = accepted
        self.value = value
        self.motivo = motivo
    }
}

/// Modelo de um controle. Imutável em cada operação; mutações retornam
/// nova instância via `with(...)` style.
public struct EngControlModel: Sendable, Equatable {
    public let kind: EngControlKind
    public let id: String
    public let titulo: String
    public let min: Double
    public let max: Double
    public let step: Double         // incremento mínimo do snap
    public let value: Double
    public let unidade: String?     // "%", "rpm", "bar" — só pra UI

    public init(
        kind: EngControlKind,
        id: String,
        titulo: String,
        min: Double,
        max: Double,
        step: Double = 0.1,
        value: Double,
        unidade: String? = nil
    ) {
        self.kind = kind
        self.id = id
        self.titulo = titulo
        self.min = min
        self.max = max
        self.step = step
        self.value = Self.clampAndSnap(value, min: min, max: max, step: step)
        self.unidade = unidade
    }

    /// Helper de clamp + snap pro valor inicial.
    private static func clampAndSnap(_ value: Double, min: Double, max: Double, step: Double) -> Double {
        let clamped = Swift.max(min, Swift.min(max, value))
        if step <= 0 { return clamped }
        let snapped = (clamped / step).rounded() * step
        return Swift.max(min, Swift.min(max, snapped))
    }

    /// Tenta mudar o valor pra um novo. Retorna result. Mantém imutabilidade —
    /// instância retornada via `withValue`.
    public func tryChange(to newValue: Double,
                          papel: EngControlPapel,
                          carroParado: Bool) -> EngControlChangeResult {
        // Permission gating (D17)
        if !canOperate(papel: papel, carroParado: carroParado) {
            return EngControlChangeResult(
                accepted: false,
                value: self.value,
                motivo: papel == .piloto
                    ? "carro andando — operação bloqueada pro piloto (D17)"
                    : "papel \(papel.rawValue) sem permissão"
            )
        }
        if !newValue.isFinite {
            return EngControlChangeResult(accepted: false, value: self.value,
                                          motivo: "valor não-finito")
        }
        let snapped = Self.clampAndSnap(newValue, min: min, max: max, step: step)
        return EngControlChangeResult(accepted: true, value: snapped, motivo: nil)
    }

    /// Retorna instância nova com value atualizado (depois de tryChange aprovado).
    public func withValue(_ newValue: Double) -> EngControlModel {
        EngControlModel(kind: kind, id: id, titulo: titulo,
                        min: min, max: max, step: step, value: newValue,
                        unidade: unidade)
    }

    /// Verifica se papel pode operar agora (D17 fechada).
    public func canOperate(papel: EngControlPapel, carroParado: Bool) -> Bool {
        switch papel {
        case .chefe, .engenheiro:
            return true             // livres sempre
        case .mecanico:
            return carroParado      // mecânico no carro = só parado
        case .piloto:
            return carroParado      // piloto = só parado (D17 fechada)
        case .readonly:
            return false
        }
    }
}

/// Helper: factory comum pra slider de combustível ±10%.
extension EngControlModel {
    public static func fuelAdjustmentSlider(value: Double = 0) -> EngControlModel {
        EngControlModel(
            kind: .slider, id: "fuel-adj", titulo: "Ajuste combustível",
            min: -10.0, max: 10.0, step: 0.5,
            value: value, unidade: "%"
        )
    }

    public static func rpmTargetKnob(value: Double = 5800,
                                     redline: Double = 7500) -> EngControlModel {
        EngControlModel(
            kind: .knob, id: "rpm-target", titulo: "RPM alvo",
            min: 1000, max: redline, step: 100,
            value: value, unidade: "rpm"
        )
    }

    public static func moduloEngenhariaToggle(value: Bool) -> EngControlModel {
        EngControlModel(
            kind: .toggle, id: "modulo-eng-ativado",
            titulo: "Módulo engenharia ativado",
            min: 0, max: 1, step: 1,
            value: value ? 1 : 0,
            unidade: nil
        )
    }
}

// ═══════════════════════════════════════════════════════════
// EngineeringDecision — lifecycle de RecommendationDecisao
// ═══════════════════════════════════════════════════════════
// Aplica regras de transição válidas (pendente → aprovada/editada/rejeitada)
// + permissão por papel (D17 fechada, D8 default chefe/admin pode rejeitar).
//
// docs/COMMAND_BOX_ENGENHARIA.md §11 D17 + D18 + D8.

public enum DecisionPermissionError: Error, Equatable, Sendable {
    case papelInsuficiente(papel: EngControlPapel)
    case carroAndando            // piloto só pode operar parado
    case transicaoInvalida(de: RecommendationDecisao, para: RecommendationDecisao)
    case decisaoFinalizada       // já foi aprovada/editada/rejeitada
}

public enum EngineeringDecisionPolicy {
    /// Verifica se papel + estado do carro permitem decidir esta transição.
    /// D8 default proposto: chefe + engenheiro + admin podem aprovar/rejeitar.
    /// Piloto pode aprovar (D17 "se estiver parado pode") mas não rejeitar.
    public static func canDecide(
        papel: EngControlPapel,
        carroParado: Bool,
        para decisao: RecommendationDecisao
    ) -> Result<Void, DecisionPermissionError> {
        // Piloto: só com carro parado
        if papel == .piloto && !carroParado {
            return .failure(.carroAndando)
        }
        // Readonly nunca decide
        if papel == .readonly {
            return .failure(.papelInsuficiente(papel: papel))
        }
        // Piloto não rejeita — só chefe/engenheiro (D17 stretch)
        if papel == .piloto && decisao == .rejeitada {
            return .failure(.papelInsuficiente(papel: papel))
        }
        // Mecânico só "aprova procedimento" — não toma decisão de setup
        if papel == .mecanico && (decisao == .rejeitada || decisao == .editada) {
            return .failure(.papelInsuficiente(papel: papel))
        }
        return .success(())
    }

    /// Transições válidas: pendente → qualquer outra. Demais → bloqueia
    /// (decisão é final por design; revogação vira nova recommendation).
    public static func transitionAllowed(
        from current: RecommendationDecisao,
        to next: RecommendationDecisao
    ) -> Result<Void, DecisionPermissionError> {
        if current != .pendente {
            return .failure(.decisaoFinalizada)
        }
        if next == .pendente {
            return .failure(.transicaoInvalida(de: current, para: next))
        }
        return .success(())
    }

    /// Aplica decisão combinada (papel + estado + transição). Resultado
    /// agrega ambas checagens.
    public static func authorize(
        papel: EngControlPapel,
        carroParado: Bool,
        from current: RecommendationDecisao,
        to next: RecommendationDecisao
    ) -> Result<Void, DecisionPermissionError> {
        if case .failure(let err) = transitionAllowed(from: current, to: next) {
            return .failure(err)
        }
        return canDecide(papel: papel, carroParado: carroParado, para: next)
    }
}
