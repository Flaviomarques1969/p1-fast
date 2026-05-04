// ═══════════════════════════════════════════════════════════
// PilotReaction — port Swift de src/domain/pilot-reaction.js
// ═══════════════════════════════════════════════════════════
// Pilot Reaction Learning Agent. Aprende reaction_time_ms por tupla
// (piloto, carro, gear, trecho) e calcula a compensação em RPM a
// aplicar no alvo visual.
//
// Modelo:
//   shift_visual_rpm = shift_optimal_rpm - reaction_compensation
//   reaction_compensation = reaction_time_ms * rpm_rise_rate / 1000
//
// Funções puras: operam sobre Dictionary<String, ReactionProfile>.
// Persistência fica em ReactionProfileRepository (MS-8.5).
//
// MS-8.1 (port 2026-05-04). Em Tier 0 (sem RPM real), o pipeline
// inteiro fica dormente — `shift-light-bridge` descarta samples sem RPM.

import Foundation

public enum PilotReactionConst {
    /// EWMA fator de suavização aplicado a observações novas.
    public static let alpha: Double = 0.15
    /// Mínimo de amostras para aplicar a compensação aprendida.
    public static let minSamples: Int = 10
    /// Reaction time em ms — clamp inferior.
    public static let rtMinMs: Double = 50
    /// Reaction time em ms — clamp superior.
    public static let rtMaxMs: Double = 400
    /// Reaction time default quando não há aprendizado.
    public static let defaultRtMs: Double = 250
    /// Janela usada no shift-event-detector pra cálculo de rpm_rise_rate.
    public static let windowBeforeS: Double = 0.2
}

public enum ReactionMode: String, Sendable, Codable {
    case assisted
    case learning
}

/// Evento de troca de marcha vindo do `shift-event-detector` (MS-8.3).
public struct ShiftEvent: Sendable, Equatable {
    public var pilotoId: String?
    public var carroId: String?
    public var sessaoId: String?
    public var trechoId: String?
    public var gearBefore: Int?
    public var gearAfter: Int?
    public var rpmAtShift: Double?
    public var rpmBefore: Double?
    public var rpmRiseRate: Double?
    public var targetVisualRpm: Double?
    public var targetOptimalRpm: Double?
    public var deltaRpm: Double?
    public var gearConfidence: Double?
    public var dataInconsistentFlag: Bool
    public var status: String?
    public var timestamp: Double?

    public init(
        pilotoId: String? = nil,
        carroId: String? = nil,
        sessaoId: String? = nil,
        trechoId: String? = nil,
        gearBefore: Int? = nil,
        gearAfter: Int? = nil,
        rpmAtShift: Double? = nil,
        rpmBefore: Double? = nil,
        rpmRiseRate: Double? = nil,
        targetVisualRpm: Double? = nil,
        targetOptimalRpm: Double? = nil,
        deltaRpm: Double? = nil,
        gearConfidence: Double? = nil,
        dataInconsistentFlag: Bool = false,
        status: String? = nil,
        timestamp: Double? = nil
    ) {
        self.pilotoId = pilotoId
        self.carroId = carroId
        self.sessaoId = sessaoId
        self.trechoId = trechoId
        self.gearBefore = gearBefore
        self.gearAfter = gearAfter
        self.rpmAtShift = rpmAtShift
        self.rpmBefore = rpmBefore
        self.rpmRiseRate = rpmRiseRate
        self.targetVisualRpm = targetVisualRpm
        self.targetOptimalRpm = targetOptimalRpm
        self.deltaRpm = deltaRpm
        self.gearConfidence = gearConfidence
        self.dataInconsistentFlag = dataInconsistentFlag
        self.status = status
        self.timestamp = timestamp
    }
}

/// Perfil aprendido para 1 tupla (piloto, carro, gear, trecho).
public struct ReactionProfile: Sendable, Equatable, Codable {
    public let key: String
    public var reactionTimeMs: Double
    public var sampleCount: Int
    public var lastUpdated: Double

    public init(key: String, reactionTimeMs: Double, sampleCount: Int, lastUpdated: Double) {
        self.key = key
        self.reactionTimeMs = reactionTimeMs
        self.sampleCount = sampleCount
        self.lastUpdated = lastUpdated
    }
}

public typealias ReactionProfiles = [String: ReactionProfile]

/// Origem da compensação retornada por `computeCompensation`.
public enum CompensationSource: String, Sendable {
    case exact              // (piloto, carro, gear, trecho)
    case pilotoCarroGear    = "piloto-carro-gear"
    case pilotoCarro        = "piloto-carro"
    case `default`          // fallback
    case learningMode       = "learning_mode"
    case invalidRate        = "invalid_rate"
}

public struct CompensationResult: Sendable, Equatable {
    public let rtMs: Double
    public let compensationRpm: Double
    public let source: CompensationSource
}

public enum PilotReaction {
    /// Constrói a chave da tupla (piloto, carro, gear, trecho).
    /// Campos ausentes viram "x" (paridade exata com JS).
    public static func tupleKey(
        pilotoId: String?,
        carroId: String?,
        gear: Int?,
        trechoId: String?
    ) -> String {
        let p = pilotoId ?? "x"
        let c = carroId ?? "x"
        let g = gear.map { "\($0)" } ?? "x"
        let t = trechoId ?? "x"
        return "\(p):\(c):\(g):\(t)"
    }

    /// Aprende a partir de 1 evento de troca. Aplica regras de aceitação:
    ///   - gear_confidence ≥ 0.8
    ///   - data_inconsistent_flag == false
    ///   - delta_rpm ≥ 0 (eventos 'early' não contam)
    ///   - reaction time observado válido (50-400ms)
    /// Retorna novo dicionário imutável — nunca muta o original.
    public static func learnFromEvent(
        _ event: ShiftEvent,
        profiles: ReactionProfiles
    ) -> ReactionProfiles {
        guard let conf = event.gearConfidence, conf >= 0.8 else { return profiles }
        if event.dataInconsistentFlag { return profiles }
        if let dr = event.deltaRpm, dr < 0 { return profiles } // early
        guard let observed = observedReactionMs(event) else { return profiles }

        let key = tupleKey(
            pilotoId: event.pilotoId,
            carroId: event.carroId,
            gear: event.gearAfter,
            trechoId: event.trechoId
        )
        let cur = profiles[key]
        let nextRt: Double
        if let c = cur, c.sampleCount > 0 {
            nextRt = c.reactionTimeMs * (1 - PilotReactionConst.alpha)
                   + observed * PilotReactionConst.alpha
        } else {
            nextRt = observed
        }
        let clamped = clampRt(nextRt)
        let next = ReactionProfile(
            key: key,
            reactionTimeMs: clamped,
            sampleCount: (cur?.sampleCount ?? 0) + 1,
            lastUpdated: event.timestamp ?? Date().timeIntervalSince1970 * 1000
        )
        var updated = profiles
        updated[key] = next
        return updated
    }

    /// Calcula compensação aplicada ao alvo visual da troca.
    /// Fallback hierárquico: exact → piloto-carro-gear → piloto-carro → default.
    /// Aplica compensação só com sample_count ≥ MIN_SAMPLES; senão default.
    /// Em modo `.learning` retorna 0 (sem antecipar).
    public static func computeCompensation(
        pilotoId: String?,
        carroId: String?,
        gear: Int?,
        trechoId: String?,
        rpmRiseRate: Double?,
        profiles: ReactionProfiles,
        mode: ReactionMode = .assisted
    ) -> CompensationResult {
        if mode != .assisted {
            return CompensationResult(rtMs: 0, compensationRpm: 0, source: .learningMode)
        }
        guard let rate = rpmRiseRate, rate.isFinite, rate > 0 else {
            return CompensationResult(rtMs: 0, compensationRpm: 0, source: .invalidRate)
        }
        let candidates: [(key: String, source: CompensationSource)] = [
            (tupleKey(pilotoId: pilotoId, carroId: carroId, gear: gear, trechoId: trechoId), .exact),
            (tupleKey(pilotoId: pilotoId, carroId: carroId, gear: gear, trechoId: nil), .pilotoCarroGear),
            (tupleKey(pilotoId: pilotoId, carroId: carroId, gear: nil, trechoId: nil), .pilotoCarro),
        ]
        var rt = PilotReactionConst.defaultRtMs
        var src: CompensationSource = .default
        for c in candidates {
            if let p = profiles[c.key],
               p.sampleCount >= PilotReactionConst.minSamples,
               p.reactionTimeMs.isFinite {
                rt = p.reactionTimeMs
                src = c.source
                break
            }
        }
        rt = clampRt(rt)
        return CompensationResult(rtMs: rt, compensationRpm: rt * rate / 1000, source: src)
    }
}

// MARK: - Internals

private func observedReactionMs(_ event: ShiftEvent) -> Double? {
    guard let rpmAt = event.rpmAtShift, rpmAt.isFinite,
          let target = event.targetVisualRpm, target.isFinite else { return nil }
    let deltaRpm = rpmAt - target
    if deltaRpm < 0 { return nil } // trocou antes do sinal — não conta
    var rate: Double? = (event.rpmRiseRate?.isFinite == true) ? event.rpmRiseRate : nil
    if rate == nil, let before = event.rpmBefore, before.isFinite {
        rate = (rpmAt - before) / PilotReactionConst.windowBeforeS
    }
    guard let r = rate, r.isFinite, r > 0 else { return nil }
    let ms = (deltaRpm / r) * 1000
    guard ms.isFinite, ms > 0 else { return nil }
    return clampRt(ms)
}

private func clampRt(_ rt: Double) -> Double {
    min(PilotReactionConst.rtMaxMs, max(PilotReactionConst.rtMinMs, rt))
}
