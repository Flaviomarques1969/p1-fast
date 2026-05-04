// ═══════════════════════════════════════════════════════════
// ShiftTarget — port Swift de:
//   src/domain/shift-target.js
//   src/domain/safe-mode.js
//   src/domain/dyno-target-calculator.js
//   src/data/cars.js   (extensão shift-light)
// ═══════════════════════════════════════════════════════════
// Computa RPM alvo da próxima troca + visualRpm (com compensação do
// pilot-reaction). Decide entre: dyno (Bloco 6), learned (telemetria),
// safe.
//
// Em Tier 0 (sem RPM real) o pipeline fica dormente — bridge descarta
// samples sem RPM. Liga em MS-9 quando T4000 conectar.
//
// MS-8.3 (port 2026-05-04).

import Foundation

// MARK: - ShiftCar (extensão car.js + cars.js)

public enum CarShiftDefaults {
    public static let safetyMarginRpm: Double = 300
    public static let toleranceRpm: Double    = 150
}

/// Ponto da curva de dinamômetro: { rpm, power_kw }.
public struct DynoPoint: Sendable, Equatable, Codable {
    public let rpm: Double
    public let powerKw: Double
    public init(rpm: Double, powerKw: Double) {
        self.rpm = rpm
        self.powerKw = powerKw
    }

    private enum CodingKeys: String, CodingKey {
        case rpm
        case powerKw = "power_kw"
    }
}

/// Alvo aprendido por telemetria (uma entrada por marcha).
public struct LearnedTarget: Sendable, Equatable, Codable {
    public let optimalRpm: Double
    public let sampleCount: Int?
    public init(optimalRpm: Double, sampleCount: Int? = nil) {
        self.optimalRpm = optimalRpm
        self.sampleCount = sampleCount
    }

    private enum CodingKeys: String, CodingKey {
        case optimalRpm = "optimal_rpm"
        case sampleCount = "sample_count"
    }
}

/// Carro pra fins do shift-light. Os campos opcionais existem em
/// graceful degradation: sem dyno → safe; sem gear_ratios → fallback
/// 90% redline; sem nada → safe.
public struct ShiftCar: Sendable, Equatable {
    public var id: String?
    public var redlineRpm: Double         // obrigatório (lança em construção via validate)
    public var safetyMarginRpm: Double?
    public var toleranceRpm: Double?
    public var dynoCurve: [DynoPoint]?    // ordem qualquer
    public var gearRatios: [Double]?      // tamanho = nº de marchas
    public var finalDrive: Double?
    public var gearSignatures: [String: GearSignature]?
    public var learnedTargets: [Int: LearnedTarget]?

    public init(
        id: String? = nil,
        redlineRpm: Double,
        safetyMarginRpm: Double? = nil,
        toleranceRpm: Double? = nil,
        dynoCurve: [DynoPoint]? = nil,
        gearRatios: [Double]? = nil,
        finalDrive: Double? = nil,
        gearSignatures: [String: GearSignature]? = nil,
        learnedTargets: [Int: LearnedTarget]? = nil
    ) {
        self.id = id
        self.redlineRpm = redlineRpm
        self.safetyMarginRpm = safetyMarginRpm
        self.toleranceRpm = toleranceRpm
        self.dynoCurve = dynoCurve
        self.gearRatios = gearRatios
        self.finalDrive = finalDrive
        self.gearSignatures = gearSignatures
        self.learnedTargets = learnedTargets
    }

    public var hasDyno: Bool { (dynoCurve?.count ?? 0) > 0 }

    public var effectiveSafetyMargin: Double {
        safetyMarginRpm ?? CarShiftDefaults.safetyMarginRpm
    }

    public var effectiveToleranceRpm: Double {
        toleranceRpm ?? CarShiftDefaults.toleranceRpm
    }

    public func hasLearnedTarget(gear: Int) -> Bool {
        guard let lt = learnedTargets?[gear] else { return false }
        return lt.optimalRpm.isFinite
    }

    public func learnedTarget(gear: Int) -> LearnedTarget? {
        learnedTargets?[gear]
    }
}

/// Assinatura calibrada de rpm/speed por marcha. Usada pelo
/// `GearEstimation` (MS-8.4). Port de gear-signatures.js.
public struct GearSignature: Sendable, Equatable, Codable {
    public let rpmSpeedRatio: Double
    public let rpmSpeedRatioStd: Double?
    public let sampleCount: Int?

    public init(rpmSpeedRatio: Double, rpmSpeedRatioStd: Double? = nil, sampleCount: Int? = nil) {
        self.rpmSpeedRatio = rpmSpeedRatio
        self.rpmSpeedRatioStd = rpmSpeedRatioStd
        self.sampleCount = sampleCount
    }

    private enum CodingKeys: String, CodingKey {
        case rpmSpeedRatio = "rpm_speed_ratio"
        case rpmSpeedRatioStd = "rpm_speed_ratio_std"
        case sampleCount = "sample_count"
    }
}

// MARK: - safeTarget (safe-mode.js)

public enum ShiftSafeMode {
    /// Alvo conservador. Lança se redlineRpm inválido.
    public static func safeTarget(_ car: ShiftCar) throws -> Double {
        guard car.redlineRpm.isFinite, car.redlineRpm > 0 else {
            throw ShiftTargetError.invalidRedline
        }
        return car.redlineRpm - car.effectiveSafetyMargin
    }
}

// MARK: - dyno-target-calculator.js

public struct DynoOptimal: Sendable, Equatable {
    public let optimalRpm: Double
    public let source: ShiftSource
    public let reason: String?
}

public enum DynoTargetCalculator {
    public static func computeOptimalRpmPerGear(
        curve: [DynoPoint],
        gearRatios: [Double]?,
        redlineRpm: Double?
    ) throws -> [Int: DynoOptimal] {
        guard curve.count >= 3 else { throw ShiftTargetError.curveTooShort }
        let sorted = curve.sorted { $0.rpm < $1.rpm }
        let minRpm = sorted.first!.rpm
        let maxRpm = sorted.last!.rpm
        let usableMax = redlineRpm.map { min($0, maxRpm) } ?? maxRpm

        // Sem gear_ratios → fallback 90% do ref
        if (gearRatios?.count ?? 0) < 2 {
            let ref = redlineRpm ?? maxRpm
            let fallbackRpm = (ref * 0.9).rounded()
            let ng = gearRatios?.count ?? 5
            var result: [Int: DynoOptimal] = [:]
            for g in 1...ng {
                result[g] = DynoOptimal(
                    optimalRpm: fallbackRpm,
                    source: .fallback,
                    reason: "gear_ratios ausente ou insuficiente — usando 90% do redline/maxRpm"
                )
            }
            return result
        }

        let ratios = gearRatios!
        var result: [Int: DynoOptimal] = [:]
        for g in 0..<(ratios.count - 1) {
            let gN = ratios[g]
            let gN1 = ratios[g + 1]
            guard gN.isFinite, gN1.isFinite, gN > 0, gN1 > 0 else {
                result[g + 1] = DynoOptimal(
                    optimalRpm: peakPowerRpm(sorted).rounded(),
                    source: .fallback,
                    reason: "gear_ratio inválido na marcha \(g + 1)"
                )
                continue
            }
            let ratioFactor = gN1 / gN  // < 1
            var optimal: Double? = nil
            let stepCount = 200
            for i in 0...stepCount {
                let rpm = minRpm + (usableMax - minRpm) * Double(i) / Double(stepCount)
                let rpmAfter = rpm * ratioFactor
                if rpmAfter < minRpm { continue }
                guard let pCur = interpPower(sorted, rpm: rpm),
                      let pNext = interpPower(sorted, rpm: rpmAfter) else { continue }
                if pNext > pCur {
                    optimal = rpm.rounded()
                    break
                }
            }
            if let o = optimal {
                result[g + 1] = DynoOptimal(optimalRpm: o, source: .dyno, reason: nil)
            } else {
                result[g + 1] = DynoOptimal(
                    optimalRpm: peakPowerRpm(sorted).rounded(),
                    source: .dyno,
                    reason: "sem cruzamento — alvo no pico de potência"
                )
            }
        }
        // Última marcha: alvo no pico
        result[ratios.count] = DynoOptimal(
            optimalRpm: peakPowerRpm(sorted).rounded(),
            source: .dyno,
            reason: "última marcha — alvo no pico de potência"
        )
        return result
    }
}

private func interpPower(_ curve: [DynoPoint], rpm: Double) -> Double? {
    guard !curve.isEmpty else { return nil }
    if rpm <= curve.first!.rpm { return curve.first!.powerKw }
    if rpm >= curve.last!.rpm  { return curve.last!.powerKw }
    for i in 1..<curve.count {
        if curve[i].rpm >= rpm {
            let a = curve[i - 1], b = curve[i]
            let t = (rpm - a.rpm) / (b.rpm - a.rpm)
            return a.powerKw + t * (b.powerKw - a.powerKw)
        }
    }
    return nil
}

private func peakPowerRpm(_ curve: [DynoPoint]) -> Double {
    var best = curve[0]
    for p in curve where p.powerKw > best.powerKw { best = p }
    return best.rpm
}

// MARK: - shift-target.js

public enum ShiftSource: String, Sendable, Codable {
    case dyno
    case learned
    case safe
    case fallback
    case unavailable
}

public struct ShiftTargetResult: Sendable, Equatable {
    public let optimalRpm: Double?
    public let visualRpm: Double?
    public let source: ShiftSource
    public let reason: String?
    public let reactionSource: CompensationSource?
}

/// Contexto opcional de compensação por reação do piloto (Bloco 5).
public struct ShiftReactionContext: Sendable {
    public let pilotoId: String?
    public let carroId: String?
    public let trechoId: String?
    public let rpmRiseRate: Double?
    public let profiles: ReactionProfiles
    public init(
        pilotoId: String?,
        carroId: String?,
        trechoId: String?,
        rpmRiseRate: Double?,
        profiles: ReactionProfiles
    ) {
        self.pilotoId = pilotoId
        self.carroId = carroId
        self.trechoId = trechoId
        self.rpmRiseRate = rpmRiseRate
        self.profiles = profiles
    }
}

public enum ShiftTargetError: Error {
    case invalidRedline
    case curveTooShort
}

public enum ShiftTarget {
    public static let confidenceFloor: Double = 0.7

    public static func computeShiftTarget(
        car: ShiftCar?,
        gear: Int,
        gearConfidence: Double?,
        mode: ReactionMode = .assisted,
        learnedTargets: [Int: LearnedTarget]? = nil,
        reactionCtx: ShiftReactionContext? = nil
    ) throws -> ShiftTargetResult {
        guard let car else {
            return ShiftTargetResult(
                optimalRpm: nil, visualRpm: nil,
                source: .unavailable, reason: "no car",
                reactionSource: nil
            )
        }
        guard car.redlineRpm.isFinite, car.redlineRpm > 0 else {
            throw ShiftTargetError.invalidRedline
        }

        var optimalRpm: Double
        var source: ShiftSource
        var reason: String? = nil

        if let conf = gearConfidence, conf.isFinite, conf >= confidenceFloor {
            // Confiança OK — escolhe entre dyno / learned / safe
            if car.hasDyno, let curve = car.dynoCurve {
                let targets = (try? DynoTargetCalculator.computeOptimalRpmPerGear(
                    curve: curve, gearRatios: car.gearRatios, redlineRpm: car.redlineRpm
                )) ?? [:]
                if let t = targets[gear], t.optimalRpm.isFinite {
                    optimalRpm = t.optimalRpm
                    source = (t.source == .dyno) ? .dyno : .safe
                    reason = t.reason
                } else {
                    optimalRpm = try ShiftSafeMode.safeTarget(car)
                    source = .safe
                    reason = "dyno presente mas sem alvo para gear=\(gear)"
                }
            } else if let learnedFromCar = car.learnedTarget(gear: gear) {
                optimalRpm = learnedFromCar.optimalRpm
                source = .learned
            } else if let arg = learnedTargets?[gear], arg.optimalRpm.isFinite {
                optimalRpm = arg.optimalRpm
                source = .learned
            } else {
                optimalRpm = try ShiftSafeMode.safeTarget(car)
                source = .safe
                reason = "no dyno, no learned target"
            }
        } else {
            optimalRpm = try ShiftSafeMode.safeTarget(car)
            source = .safe
            reason = "gear_confidence below floor"
        }

        // visualRpm = optimalRpm - reaction_compensation (Bloco 5)
        var visualRpm = optimalRpm
        var reactionSource: CompensationSource? = nil
        if let ctx = reactionCtx {
            let comp = PilotReaction.computeCompensation(
                pilotoId: ctx.pilotoId,
                carroId: ctx.carroId,
                gear: gear,
                trechoId: ctx.trechoId,
                rpmRiseRate: ctx.rpmRiseRate,
                profiles: ctx.profiles,
                mode: mode
            )
            reactionSource = comp.source
            switch comp.source {
            case .default, .invalidRate, .learningMode:
                break // visual = optimal
            case .exact, .pilotoCarroGear, .pilotoCarro:
                visualRpm = optimalRpm - comp.compensationRpm
            }
        }

        return ShiftTargetResult(
            optimalRpm: optimalRpm,
            visualRpm: visualRpm,
            source: source,
            reason: reason,
            reactionSource: reactionSource
        )
    }
}
