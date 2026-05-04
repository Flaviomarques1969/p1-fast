// ═══════════════════════════════════════════════════════════
// GearEstimation — port Swift de:
//   src/domain/gear-estimation.js
//   src/domain/gear-signatures.js   (learnSignature)
// ═══════════════════════════════════════════════════════════
// Estima a marcha atual a partir de 1 sample (rpm + speed) usando
// `GearSignature` calibradas do carro. Pode considerar histórico
// recente (200ms) e accelLong para penalizar embreagem/neutro.
//
// MS-8.4 (port 2026-05-04). Consumido pelo shift-event-detector
// (MS-8.5) ao construir o evento.

import Foundation

public enum GearEstimationConst {
    public static let minSpeedKmh: Double         = 5
    public static let ratioTolPct: Double         = 0.08
    public static let historyWindowMs: Double     = 200
    public static let decelThresholdMs2: Double   = -0.5
    public static let learnMinSamples: Int        = 5
}

public enum GearMethod: String, Sendable, Codable {
    case rpmSpeed              = "rpm_speed"
    case rpmSpeedHistory       = "rpm_speed_history"
    case rpmSpeedHistoryAccel  = "rpm_speed_history_accel"
    case fallback
}

public struct GearEstimate: Sendable, Equatable {
    public let gear: Int?
    public let confidence: Double
    public let method: GearMethod
    public let reason: String?

    public init(gear: Int?, confidence: Double, method: GearMethod, reason: String? = nil) {
        self.gear = gear
        self.confidence = confidence
        self.method = method
        self.reason = reason
    }
}

/// Sample de gear-estimation: subset do que o detector ao vivo
/// passa pra cá (rpm/speed obrigatórios; tps/accel/timestamp opcionais).
public struct GearSampleInput: Sendable, Equatable {
    public var rpm: Double
    public var speed: Double                     // km/h
    public var tps: Double?
    public var accelLong: Double?                // accel.x
    public var timestamp: Double?

    public init(
        rpm: Double, speed: Double,
        tps: Double? = nil,
        accelLong: Double? = nil,
        timestamp: Double? = nil
    ) {
        self.rpm = rpm
        self.speed = speed
        self.tps = tps
        self.accelLong = accelLong
        self.timestamp = timestamp
    }
}

public enum GearEstimation {
    /// Estima marcha. Retorna `.fallback` quando faltam dados
    /// (sem calibração / sample inválido / speed < minSpeedKmh /
    /// nenhuma assinatura válida).
    public static func estimateGear(
        sample: GearSampleInput,
        history: [GearSampleInput] = [],
        signatures: [Int: GearSignature]
    ) -> GearEstimate {
        guard !signatures.isEmpty else {
            return GearEstimate(gear: nil, confidence: 0, method: .fallback, reason: "no calibration")
        }
        guard sample.rpm.isFinite, sample.speed.isFinite else {
            return GearEstimate(gear: nil, confidence: 0, method: .fallback, reason: "invalid sample")
        }
        guard sample.speed >= GearEstimationConst.minSpeedKmh else {
            return GearEstimate(gear: nil, confidence: 0, method: .fallback, reason: "speed below threshold")
        }

        let accelLong = sample.accelLong
        let decelerating = (accelLong ?? 0) < GearEstimationConst.decelThresholdMs2 && accelLong != nil
        let useAccel = accelLong != nil

        // Histórico recente (média + variância de ratios)
        var ratio = sample.rpm / sample.speed
        var ratioVariance: Double = 0
        var useHistory = false
        if let ts = sample.timestamp, !history.isEmpty {
            let cutoff = ts - GearEstimationConst.historyWindowMs
            let recent = history.filter { h in
                guard let hts = h.timestamp, hts >= cutoff,
                      h.rpm.isFinite, h.speed.isFinite,
                      h.speed >= GearEstimationConst.minSpeedKmh else { return false }
                return true
            }
            if recent.count >= 2 {
                var ratios = recent.map { $0.rpm / $0.speed }
                ratios.append(sample.rpm / sample.speed)
                let mean = ratios.reduce(0, +) / Double(ratios.count)
                let v = ratios.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(ratios.count)
                ratio = mean
                ratioVariance = v
                useHistory = true
            }
        }

        // Encontrar melhor + segundo melhor por distância normalizada
        var bestGear: Int? = nil
        var bestDist = Double.infinity
        var secondDist = Double.infinity
        for (g, sig) in signatures {
            guard sig.rpmSpeedRatio.isFinite, sig.rpmSpeedRatio > 0 else { continue }
            let dist = abs(ratio - sig.rpmSpeedRatio) / sig.rpmSpeedRatio
            if dist < bestDist {
                secondDist = bestDist
                bestDist = dist
                bestGear = g
            } else if dist < secondDist {
                secondDist = dist
            }
        }

        guard let gear = bestGear else {
            return GearEstimate(gear: nil, confidence: 0, method: .fallback, reason: "no valid signatures")
        }

        // Confiança base
        var conf = max(0, 1 - bestDist / GearEstimationConst.ratioTolPct)

        // Penalidade quando segundo melhor está perto
        if secondDist.isFinite {
            let margin = (secondDist - bestDist) / max(bestDist, 1e-6)
            if margin < 0.5 {
                conf *= 0.7 + 0.3 * (margin / 0.5)
            }
        }

        // Penalidade por variância alta no histórico
        if useHistory && ratioVariance > 0 {
            let cv = sqrt(ratioVariance) / max(ratio, 1e-6)
            if cv > 0.03 {
                conf *= max(0.3, 1 - (cv - 0.03) * 5)
            }
        }

        var reason: String? = nil
        if let tps = sample.tps, tps == 0, decelerating {
            conf *= 0.5
            reason = "tps=0 + decelerating: possible clutch/neutral"
        }

        conf = max(0, min(1, conf))
        // Round 3 casas (paridade JS .toFixed(3))
        conf = (conf * 1000).rounded() / 1000

        let method: GearMethod
        if useHistory && useAccel { method = .rpmSpeedHistoryAccel }
        else if useHistory        { method = .rpmSpeedHistory }
        else                      { method = .rpmSpeed }

        return GearEstimate(gear: gear, confidence: conf, method: method, reason: reason)
    }

    /// Aprende `GearSignature` de uma marcha a partir de samples
    /// estabilizados (carro andando constante naquela marcha).
    /// Trim 10% extremos antes de calcular média + std.
    /// Port de `gear-signatures.js learnSignature`.
    public static func learnSignature(_ samples: [GearSampleInput]) -> LearnSignatureResult {
        let valid = samples.filter { s in
            s.rpm.isFinite && s.rpm > 0 && s.speed.isFinite && s.speed >= GearEstimationConst.minSpeedKmh
        }
        if valid.count < GearEstimationConst.learnMinSamples {
            return LearnSignatureResult(
                signature: nil,
                sampleCount: valid.count,
                reason: "insufficient samples"
            )
        }
        let ratios = valid.map { $0.rpm / $0.speed }.sorted()
        let trim = Int(Double(ratios.count) * 0.1)
        let trimmed: [Double] = trim > 0
            ? Array(ratios[trim..<(ratios.count - trim)])
            : ratios
        let mean = trimmed.reduce(0, +) / Double(trimmed.count)
        let variance = trimmed.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(trimmed.count)
        return LearnSignatureResult(
            signature: GearSignature(
                rpmSpeedRatio: mean,
                rpmSpeedRatioStd: sqrt(variance),
                sampleCount: valid.count
            ),
            sampleCount: valid.count,
            reason: nil
        )
    }
}

public struct LearnSignatureResult: Sendable, Equatable {
    public let signature: GearSignature?
    public let sampleCount: Int
    public let reason: String?
}
