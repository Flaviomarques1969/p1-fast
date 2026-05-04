// ═══════════════════════════════════════════════════════════
// ShiftEventDetector — port Swift de:
//   src/pipeline/shift-event-detector.js
// ═══════════════════════════════════════════════════════════
// Pipeline streaming que detecta eventos de troca de marcha
// (upshift/downshift) e emite ShiftEvent completo.
//
// Estado: idle → pending → cooldown → idle (ciclo).
// Em pending acumula janela `windowAfter` antes de emitir.
//
// MS-8.5 (port 2026-05-04). Fecha o pipeline shift-light em Swift
// junto com `ShiftLightBridge`. Em Tier 0 (sem RPM real) o bridge
// descarta samples sem RPM antes de chegarem aqui.

import Foundation

public enum ShiftDetectorConst {
    public static let windowBefore: Double  = 200   // ms
    public static let windowAfter: Double   = 200
    public static let rpmDrop: Double       = 800   // upshift mínimo
    public static let rpmRise: Double       = 600   // downshift mínimo
    public static let speedTolPct: Double   = 0.05  // 5%
    public static let cooldownMs: Double    = 400
    public static let maxDtMs: Double       = 250
    public static let tpsMin: Double        = 10
}

/// Sample alimentado pelo bridge — contrato do detector.
public struct ShiftDetectorSample: Sendable, Equatable {
    public var rpm: Double
    public var speed: Double         // km/h
    public var tps: Double?
    public var accelX: Double        // long
    public var accelY: Double
    public var accelZ: Double
    public var timestamp: Double     // ms

    public init(
        rpm: Double, speed: Double,
        tps: Double? = nil,
        accelX: Double = 0, accelY: Double = 0, accelZ: Double = 0,
        timestamp: Double
    ) {
        self.rpm = rpm
        self.speed = speed
        self.tps = tps
        self.accelX = accelX
        self.accelY = accelY
        self.accelZ = accelZ
        self.timestamp = timestamp
    }
}

public enum ShiftType: String, Sendable, Codable {
    case up
    case down
}

public enum ShiftMode: String, Sendable, Codable {
    case dynoCalibrated  = "DYNO_CALIBRATED"
    case telemetryLearned = "TELEMETRY_LEARNED"
    case safeMode        = "SAFE_MODE"
}

public struct ShiftEventEmitted: Sendable, Equatable {
    public var pilotoId: String?
    public var carroId: String?
    public var sessaoId: String?
    public var voltaId: String?
    public var trechoId: String?
    public var timestamp: Double
    public var rpmBefore: Double?
    public var rpmAtShift: Double?
    public var rpmAfter: Double?
    public var speedKmh: Double?
    public var tps: Double?
    public var gearBefore: Int?
    public var gearAfter: Int?
    public var gearConfidence: Double
    public var accelLongBefore: Double?
    public var accelLongDuring: Double?
    public var accelLongAfter: Double?
    public var targetOptimalRpm: Double?
    public var targetVisualRpm: Double?
    public var deltaRpm: Double?
    public var status: String        // "green" | "red" | "unknown"
    public var modeUsed: ShiftMode
    public var overrevFlag: Bool
    public var dataInconsistentFlag: Bool
    public var lessonText: String?
    public var dedupKey: String
}

public final class ShiftEventDetector {
    // Configuração
    public var pilotoId: String?
    public var carroId: String?
    public var sessaoId: String?
    public var car: ShiftCar?
    public var resolveTrecho: ((ShiftDetectorSample) -> String?)?
    public var onEvent: ((ShiftEventEmitted) -> Void)?

    // Estado interno
    private enum State { case idle, pending, cooldown }
    private var state: State = .idle
    private var buffer: [ShiftDetectorSample] = []
    private var pendingType: ShiftType?
    private var pendingAt: Double = 0
    private var pendingBefore: ShiftDetectorSample?
    private var pendingAtSample: ShiftDetectorSample?
    private var cooldownUntil: Double = 0
    private var seenKeys: Set<String> = []
    private var emittedEvents: [ShiftEventEmitted] = []

    public init(
        pilotoId: String? = nil,
        carroId: String? = nil,
        sessaoId: String? = nil,
        car: ShiftCar? = nil,
        onEvent: ((ShiftEventEmitted) -> Void)? = nil,
        resolveTrecho: ((ShiftDetectorSample) -> String?)? = nil
    ) {
        self.pilotoId = pilotoId
        self.carroId = carroId
        self.sessaoId = sessaoId
        self.car = car
        self.onEvent = onEvent
        self.resolveTrecho = resolveTrecho
    }

    public func pushSample(_ sample: ShiftDetectorSample) {
        guard sample.rpm.isFinite, sample.speed.isFinite, sample.timestamp.isFinite else { return }

        buffer.append(sample)
        let keepSince = sample.timestamp - (ShiftDetectorConst.windowBefore + ShiftDetectorConst.windowAfter + 500)
        while let first = buffer.first, first.timestamp < keepSince {
            buffer.removeFirst()
        }

        if state == .cooldown {
            if sample.timestamp >= cooldownUntil { state = .idle }
            else { return }
        }

        if state == .idle {
            guard buffer.count >= 2 else { return }
            let prev = buffer[buffer.count - 2]
            let cur = sample
            let dt = cur.timestamp - prev.timestamp
            guard dt > 0, dt <= ShiftDetectorConst.maxDtMs else { return }
            let dRpm = cur.rpm - prev.rpm
            let speedRel = abs(cur.speed - prev.speed) / max(prev.speed, 1)
            guard speedRel <= ShiftDetectorConst.speedTolPct else { return }
            let type: ShiftType?
            if dRpm <= -ShiftDetectorConst.rpmDrop      { type = .up }
            else if dRpm >= ShiftDetectorConst.rpmRise  { type = .down }
            else                                        { type = nil }
            guard let t = type else { return }
            pendingType = t
            pendingAt = cur.timestamp
            pendingBefore = prev
            pendingAtSample = cur
            state = .pending
            return
        }

        if state == .pending {
            let elapsed = sample.timestamp - pendingAt
            guard elapsed >= ShiftDetectorConst.windowAfter else { return }
            let event = buildEvent(finalSample: sample)
            pendingType = nil
            pendingBefore = nil
            pendingAtSample = nil
            cooldownUntil = sample.timestamp + ShiftDetectorConst.cooldownMs
            state = .cooldown
            if let ev = event {
                if !seenKeys.contains(ev.dedupKey) {
                    seenKeys.insert(ev.dedupKey)
                    emittedEvents.append(ev)
                    onEvent?(ev)
                }
            }
        }
    }

    public var emitted: [ShiftEventEmitted] { emittedEvents }
    public var debugState: String {
        switch state {
        case .idle: return "idle"
        case .pending: return "pending"
        case .cooldown: return "cooldown"
        }
    }

    // MARK: - Build event

    private func buildEvent(finalSample: ShiftDetectorSample) -> ShiftEventEmitted? {
        guard let type = pendingType,
              let before = pendingBefore,
              let at = pendingAtSample else { return nil }
        let after = finalSample

        let tps = at.tps
        if let t = tps, t < ShiftDetectorConst.tpsMin { return nil }

        let tCutBefore = at.timestamp - ShiftDetectorConst.windowBefore
        let beforeWindow = buffer.filter { $0.timestamp >= tCutBefore && $0.timestamp < at.timestamp }
        let afterWindow  = buffer.filter { $0.timestamp > at.timestamp && $0.timestamp <= after.timestamp }

        let rpmBeforeAvg = avg(beforeWindow.map(\.rpm))
        let rpmAfterAvg  = avg(afterWindow.map(\.rpm))
        // No upshift, rpm_at_shift é o rpm imediatamente antes da queda.
        // No downshift, é imediatamente após a subida.
        let rpmAtShift: Double = (type == .up) ? before.rpm : at.rpm

        // Estimativa de marcha (antes/depois) usando GearEstimation
        var gearBefore: GearEstimate? = nil
        var gearAfter: GearEstimate? = nil
        if let signatures = car?.gearSignatures, !signatures.isEmpty {
            let parsedSignatures: [Int: GearSignature] = signatures.reduce(into: [:]) { acc, kv in
                if let g = Int(kv.key) { acc[g] = kv.value }
            }
            let beforeInputs = beforeWindow.map { toGearInput($0) }
            let afterInputs  = afterWindow.map { toGearInput($0) }
            gearBefore = GearEstimation.estimateGear(
                sample: toGearInput(before),
                history: beforeInputs,
                signatures: parsedSignatures
            )
            gearAfter = GearEstimation.estimateGear(
                sample: toGearInput(after),
                history: afterInputs,
                signatures: parsedSignatures
            )
        }

        // ShiftTarget
        var targetOptimalRpm: Double? = nil
        var targetVisualRpm: Double? = nil
        if let car {
            let result = (try? ShiftTarget.computeShiftTarget(
                car: car,
                gear: gearBefore?.gear ?? 0,
                gearConfidence: gearBefore?.confidence
            ))
            if let r = result {
                targetOptimalRpm = r.optimalRpm
                targetVisualRpm = r.visualRpm
            }
        }
        let deltaRpm: Double? = (rpmAtShift.isFinite && targetOptimalRpm != nil)
            ? rpmAtShift - targetOptimalRpm!
            : nil

        let tolerance = car?.effectiveToleranceRpm ?? CarShiftDefaults.toleranceRpm
        let status: String
        if let d = deltaRpm {
            status = abs(d) <= tolerance ? "green" : "red"
        } else {
            status = "unknown"
        }

        var modeUsed: ShiftMode = .safeMode
        if let car, !(car.dynoCurve?.isEmpty ?? true) { modeUsed = .dynoCalibrated }
        else if (car?.learnedTargets?[gearBefore?.gear ?? -1]) != nil { modeUsed = .telemetryLearned }

        let overrevFlag: Bool = {
            guard let car, car.redlineRpm.isFinite else { return false }
            return rpmAtShift > car.redlineRpm
        }()

        let trechoId: String? = resolveTrecho?(at)

        let dataInconsistentFlag = (
            rpmBeforeAvg == nil
            || rpmAfterAvg == nil
            || !rpmAtShift.isFinite
            || tps == nil
        )

        let dedupKey = [
            sessaoId ?? "no-session",
            "\(at.timestamp)",
            gearBefore?.gear.map { "\($0)" } ?? "x",
            gearAfter?.gear.map { "\($0)" } ?? "x"
        ].joined(separator: ":")

        return ShiftEventEmitted(
            pilotoId: pilotoId,
            carroId: carroId,
            sessaoId: sessaoId,
            voltaId: nil,
            trechoId: trechoId,
            timestamp: at.timestamp,
            rpmBefore: rpmBeforeAvg.map { $0.rounded() },
            rpmAtShift: rpmAtShift.isFinite ? rpmAtShift.rounded() : nil,
            rpmAfter: rpmAfterAvg.map { $0.rounded() },
            speedKmh: at.speed.isFinite ? at.speed : nil,
            tps: tps,
            gearBefore: gearBefore?.gear,
            gearAfter: gearAfter?.gear,
            gearConfidence: gearAfter?.confidence ?? 0,
            accelLongBefore: avg(beforeWindow.map(\.accelX)),
            accelLongDuring: at.accelX.isFinite ? at.accelX : nil,
            accelLongAfter: avg(afterWindow.map(\.accelX)),
            targetOptimalRpm: targetOptimalRpm,
            targetVisualRpm: targetVisualRpm,
            deltaRpm: deltaRpm,
            status: status,
            modeUsed: modeUsed,
            overrevFlag: overrevFlag,
            dataInconsistentFlag: dataInconsistentFlag,
            lessonText: nil,
            dedupKey: dedupKey
        )
    }
}

// MARK: - Bridge (shift-light-bridge.js port)

/// Adapta o stream do MobileTelemetry (Sample canônico) para o
/// input do `ShiftEventDetector`. Sample sem RPM é descartado
/// (princípio "não fabricar dados" — Tier 0 dormente).
public final class ShiftLightBridge {
    public typealias RpmGetter = (ShiftBridgeSample) -> Double?
    public typealias TpsGetter = (ShiftBridgeSample) -> Double?

    private let detector: ShiftEventDetector
    private let getRpm: RpmGetter
    private let getTps: TpsGetter
    private var lastTs: Double = -1

    public init(
        detector: ShiftEventDetector,
        getRpm: @escaping RpmGetter,
        getTps: @escaping TpsGetter = { _ in nil }
    ) {
        self.detector = detector
        self.getRpm = getRpm
        self.getTps = getTps
    }

    public func onTelemetrySample(_ sample: ShiftBridgeSample) {
        let ts = sample.tMono ?? sample.t
        guard ts.isFinite, ts > lastTs else { return }
        lastTs = ts
        guard let rpm = getRpm(sample), rpm.isFinite, rpm > 0 else { return }
        let speed: Double?
        if let kmh = sample.kmh, kmh.isFinite { speed = kmh }
        else if let s = sample.speed, s.isFinite { speed = s * 3.6 }
        else { speed = nil }
        guard let sp = speed else { return }
        let tps = getTps(sample)
        let tpsFinite = (tps?.isFinite == true) ? tps : nil
        detector.pushSample(ShiftDetectorSample(
            rpm: rpm,
            speed: sp,
            tps: tpsFinite,
            accelX: sample.accX ?? 0,
            accelY: sample.accY ?? 0,
            accelZ: sample.accZ ?? 0,
            timestamp: ts
        ))
    }

    public func reset() { lastTs = -1 }
}

/// Sample canônico do bridge — paridade com o Sample JS do MobileTelemetry.
public struct ShiftBridgeSample: Sendable, Equatable {
    public var t: Double
    public var tMono: Double?
    public var kmh: Double?
    public var speed: Double?       // m/s
    public var accX: Double?
    public var accY: Double?
    public var accZ: Double?

    public init(
        t: Double, tMono: Double? = nil,
        kmh: Double? = nil, speed: Double? = nil,
        accX: Double? = nil, accY: Double? = nil, accZ: Double? = nil
    ) {
        self.t = t
        self.tMono = tMono
        self.kmh = kmh
        self.speed = speed
        self.accX = accX
        self.accY = accY
        self.accZ = accZ
    }
}

// MARK: - Helpers

private func avg(_ vals: [Double]) -> Double? {
    let valid = vals.filter { $0.isFinite }
    guard !valid.isEmpty else { return nil }
    return valid.reduce(0, +) / Double(valid.count)
}

private func toGearInput(_ s: ShiftDetectorSample) -> GearSampleInput {
    GearSampleInput(
        rpm: s.rpm, speed: s.speed,
        tps: s.tps, accelLong: s.accelX,
        timestamp: s.timestamp
    )
}
