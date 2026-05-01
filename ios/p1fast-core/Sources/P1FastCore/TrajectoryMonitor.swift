// ═══════════════════════════════════════════════════════════
// TrajectoryMonitor — port Swift de src/domain/trajectory-monitor.js
// ═══════════════════════════════════════════════════════════
// Avaliação de desvio em metros vs volta de referência. Fecha o loop
// de L001 (Referência Fixa) e L007 (Curva Cega) do P1 Coach.
//
// Detecções espelham a lógica JS:
//   • freio   = 1ª amostra com accLong < -0.20g
//               OU (sem IMU) queda sustentada de kmh
//   • giro    = 1ª amostra com |gyroAlpha| > 15°/s
//               OU mudança de course além de 6°
//   • tração  = 1ª amostra após apex com accLong > +0.15g
//
// `Confidence` reusa o enum de Lesson.swift.

import Foundation

public enum TrajectoryMonitorConst {
    public static let brakeGThreshold: Double    = -0.20
    public static let throttleGThreshold: Double = +0.15
    public static let yawThresholdDegS: Double   = 15
    public static let courseDeltaDeg: Double     = 6
    public static let kmhDropPerSec: Double      = 8
    public static let minSamples: Int            = 4
    public static let mPerDegLat: Double         = 111000
}

public enum TrajectoryMonitor_ {

    public struct InputSample: Sendable {
        public let t: Double
        public let lat: Double?
        public let lng: Double?
        public let kmh: Double?
        public let accLong: Double?
        public let gyroAlpha: Double?
        public let course: Double?
        public init(t: Double, lat: Double? = nil, lng: Double? = nil,
                    kmh: Double? = nil, accLong: Double? = nil,
                    gyroAlpha: Double? = nil, course: Double? = nil) {
            self.t = t; self.lat = lat; self.lng = lng
            self.kmh = kmh; self.accLong = accLong
            self.gyroAlpha = gyroAlpha; self.course = course
        }
    }

    public struct Coord: Sendable {
        public let lat: Double?
        public let lng: Double?
    }

    /// Distância plana lat/lng → metros (válido escala autódromo <5km).
    public static func distanceMetersGeo(_ a: InputSample?, _ b: InputSample?) -> Double? {
        guard let a, let b,
              let aLat = a.lat, let aLng = a.lng,
              let bLat = b.lat, let bLng = b.lng,
              aLat.isFinite, aLng.isFinite, bLat.isFinite, bLng.isFinite
        else { return nil }
        let dLat = (bLat - aLat) * TrajectoryMonitorConst.mPerDegLat
        let cosLat = cos(aLat * .pi / 180)
        let dLng = (bLng - aLng) * TrajectoryMonitorConst.mPerDegLat * cosLat
        return (dLat * dLat + dLng * dLng).squareRoot()
    }

    /// Versão para coords arbitrárias (não dentro de InputSample).
    public static func distanceMetersGeo(_ a: (lat: Double, lng: Double)?, _ b: (lat: Double, lng: Double)?) -> Double? {
        guard let a, let b else { return nil }
        let dLat = (b.lat - a.lat) * TrajectoryMonitorConst.mPerDegLat
        let cosLat = cos(a.lat * .pi / 180)
        let dLng = (b.lng - a.lng) * TrajectoryMonitorConst.mPerDegLat * cosLat
        return (dLat * dLat + dLng * dLng).squareRoot()
    }

    public static func findApexIndex(_ samples: [InputSample]) -> Int {
        guard samples.count >= TrajectoryMonitorConst.minSamples else { return -1 }
        var best = -1
        var vMin = Double.infinity
        for (i, s) in samples.enumerated() {
            if let k = s.kmh, k.isFinite, k < vMin {
                vMin = k
                best = i
            }
        }
        return best
    }

    public static func findBrakingIndex(_ samples: [InputSample]) -> Int {
        guard samples.count >= TrajectoryMonitorConst.minSamples else { return -1 }
        let temAcc = samples.contains { $0.accLong != nil && ($0.accLong?.isFinite ?? false) }
        if temAcc {
            for (i, s) in samples.enumerated() {
                if let a = s.accLong, a.isFinite, a < TrajectoryMonitorConst.brakeGThreshold {
                    return i
                }
            }
            return -1
        }
        // Fallback sem IMU
        var consecutivos = 0
        for i in 1..<samples.count {
            guard let k0 = samples[i - 1].kmh, let k1 = samples[i].kmh else {
                consecutivos = 0; continue
            }
            let dt = (samples[i].t - samples[i - 1].t) / 1000.0
            if dt <= 0 { consecutivos = 0; continue }
            let queda = (k0 - k1) / dt
            if queda > TrajectoryMonitorConst.kmhDropPerSec {
                consecutivos += 1
                if consecutivos >= 2 { return i - 1 }
            } else {
                consecutivos = 0
            }
        }
        return -1
    }

    public static func findTurnInIndex(_ samples: [InputSample]) -> Int {
        guard samples.count >= TrajectoryMonitorConst.minSamples else { return -1 }
        let temGyro = samples.contains { $0.gyroAlpha != nil && ($0.gyroAlpha?.isFinite ?? false) }
        if temGyro {
            for (i, s) in samples.enumerated() {
                if let g = s.gyroAlpha, g.isFinite, abs(g) > TrajectoryMonitorConst.yawThresholdDegS {
                    return i
                }
            }
            return -1
        }
        // Fallback via course
        for i in 1..<samples.count {
            guard let c0 = samples[i - 1].course, let c1 = samples[i].course else { continue }
            var d = abs(c1 - c0)
            if d > 180 { d = 360 - d }
            if d > TrajectoryMonitorConst.courseDeltaDeg { return i }
        }
        return -1
    }

    public static func findThrottleIndex(_ samples: [InputSample], apexIdx: Int) -> Int {
        guard samples.count >= TrajectoryMonitorConst.minSamples else { return -1 }
        let start = apexIdx >= 0 ? apexIdx : 0
        for i in start..<samples.count {
            if let a = samples[i].accLong, a.isFinite, a > TrajectoryMonitorConst.throttleGThreshold {
                return i
            }
        }
        return -1
    }

    public struct Report: Sendable {
        public let disponivel: Bool
        public let razao: String?
        public let brakingPointDeviationM: Double?
        public let turnInPointDeviationM: Double?
        public let throttlePointDeviationM: Double?
        public let entryDeviationM: Double?
        public let apexDeviationM: Double?
        public let confidence: Confidence
        public let debug: Debug

        public init(disponivel: Bool, razao: String?,
                    brakingPointDeviationM: Double?, turnInPointDeviationM: Double?,
                    throttlePointDeviationM: Double?, entryDeviationM: Double?,
                    apexDeviationM: Double?,
                    confidence: Confidence, debug: Debug) {
            self.disponivel = disponivel
            self.razao = razao
            self.brakingPointDeviationM = brakingPointDeviationM
            self.turnInPointDeviationM = turnInPointDeviationM
            self.throttlePointDeviationM = throttlePointDeviationM
            self.entryDeviationM = entryDeviationM
            self.apexDeviationM = apexDeviationM
            self.confidence = confidence
            self.debug = debug
        }

        public struct Debug: Sendable {
            public let apexIdx: Int
            public let refApexIdx: Int
            public let brakingIdx: Int
            public let refBrakingIdx: Int
            public let turnInIdx: Int
            public let refTurnInIdx: Int
            public let throttleIdx: Int
            public let refThrottleIdx: Int
            public init(apexIdx: Int, refApexIdx: Int,
                        brakingIdx: Int, refBrakingIdx: Int,
                        turnInIdx: Int, refTurnInIdx: Int,
                        throttleIdx: Int, refThrottleIdx: Int) {
                self.apexIdx = apexIdx
                self.refApexIdx = refApexIdx
                self.brakingIdx = brakingIdx
                self.refBrakingIdx = refBrakingIdx
                self.turnInIdx = turnInIdx
                self.refTurnInIdx = refTurnInIdx
                self.throttleIdx = throttleIdx
                self.refThrottleIdx = refThrottleIdx
            }
        }

        static func empty(_ razao: String) -> Report {
            Report(
                disponivel: false, razao: razao,
                brakingPointDeviationM: nil, turnInPointDeviationM: nil,
                throttlePointDeviationM: nil, entryDeviationM: nil, apexDeviationM: nil,
                confidence: .baixa,
                debug: Debug(apexIdx: -1, refApexIdx: -1,
                             brakingIdx: -1, refBrakingIdx: -1,
                             turnInIdx: -1, refTurnInIdx: -1,
                             throttleIdx: -1, refThrottleIdx: -1)
            )
        }
    }

    public static func evaluateSegmentTrajectory(samples: [InputSample], refSamples: [InputSample]) -> Report {
        guard samples.count >= TrajectoryMonitorConst.minSamples else {
            return Report.empty("sem-amostras-atuais")
        }
        guard refSamples.count >= TrajectoryMonitorConst.minSamples else {
            return Report.empty("sem-amostras-referencia")
        }

        let apexIdx       = findApexIndex(samples)
        let refApexIdx    = findApexIndex(refSamples)
        let brakingIdx    = findBrakingIndex(samples)
        let refBrakingIdx = findBrakingIndex(refSamples)
        let turnInIdx     = findTurnInIndex(samples)
        let refTurnInIdx  = findTurnInIndex(refSamples)
        let throttleIdx   = findThrottleIndex(samples, apexIdx: apexIdx)
        let refThrottleIdx = findThrottleIndex(refSamples, apexIdx: refApexIdx)

        func safeDist(_ idxA: Int, _ arrA: [InputSample], _ idxB: Int, _ arrB: [InputSample]) -> Double? {
            if idxA < 0 || idxB < 0 { return nil }
            return distanceMetersGeo(arrA[idxA], arrB[idxB])
        }

        let detectados = [brakingIdx, refBrakingIdx, turnInIdx, refTurnInIdx,
                          throttleIdx, refThrottleIdx].filter { $0 >= 0 }.count
        let confidence: Confidence = detectados >= 5 ? .alta
                                   : detectados >= 3 ? .media
                                   : .baixa

        return Report(
            disponivel: true, razao: nil,
            brakingPointDeviationM:  safeDist(brakingIdx, samples, refBrakingIdx, refSamples),
            turnInPointDeviationM:   safeDist(turnInIdx, samples, refTurnInIdx, refSamples),
            throttlePointDeviationM: safeDist(throttleIdx, samples, refThrottleIdx, refSamples),
            entryDeviationM:         distanceMetersGeo(samples.first, refSamples.first),
            apexDeviationM:          safeDist(apexIdx, samples, refApexIdx, refSamples),
            confidence: confidence,
            debug: Report.Debug(
                apexIdx: apexIdx, refApexIdx: refApexIdx,
                brakingIdx: brakingIdx, refBrakingIdx: refBrakingIdx,
                turnInIdx: turnInIdx, refTurnInIdx: refTurnInIdx,
                throttleIdx: throttleIdx, refThrottleIdx: refThrottleIdx
            )
        )
    }

    public struct LessonOutcome: Sendable {
        public let cumpriu: Bool
        public let hits: Int
        public let total: Int
        public let mediaM: Double?
        public let razao: String?
    }

    public static func evaluateReferenciaFixa(_ reports: [Report],
                                              toleranciaM: Double = 8,
                                              exigidasN: Int = 3,
                                              janelaM: Int = 4) -> LessonOutcome {
        let ultimas = Array(reports.suffix(janelaM))
        var hits = 0, com = 0
        var soma: Double = 0
        for r in ultimas {
            guard let d = r.brakingPointDeviationM else { continue }
            com += 1
            soma += d
            if d < toleranciaM { hits += 1 }
        }
        let media: Double? = com > 0 ? (soma / Double(com) * 10).rounded() / 10 : nil
        return LessonOutcome(cumpriu: hits >= exigidasN, hits: hits,
                             total: ultimas.count, mediaM: media, razao: nil)
    }

    public static func evaluateCurvaCega(_ reports: [Report],
                                         toleranciaM: Double = 5,
                                         exigidasN: Int = 2,
                                         janelaM: Int = 3) -> LessonOutcome {
        let ultimas = Array(reports.suffix(janelaM))
        var hits = 0, com = 0
        var soma: Double = 0
        for r in ultimas {
            guard let d = r.entryDeviationM else { continue }
            com += 1
            soma += d
            if d < toleranciaM { hits += 1 }
        }
        let media: Double? = com > 0 ? (soma / Double(com) * 10).rounded() / 10 : nil
        return LessonOutcome(cumpriu: hits >= exigidasN, hits: hits,
                             total: ultimas.count, mediaM: media, razao: nil)
    }
}

/// Wrapper de instância que mantém histórico por trecho.
public final class TrajectoryMonitor {
    private var bySegment: [String: [TrajectoryMonitor_.Report]] = [:]
    public init() {}

    @discardableResult
    public func recordSegment(segmentId: String,
                              samples: [TrajectoryMonitor_.InputSample],
                              refSamples: [TrajectoryMonitor_.InputSample]) -> TrajectoryMonitor_.Report {
        precondition(!segmentId.isEmpty, "recordSegment: segmentId obrigatório")
        let report = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: samples, refSamples: refSamples)
        var arr = bySegment[segmentId] ?? []
        arr.append(report)
        bySegment[segmentId] = arr
        return report
    }

    public func getHistory(_ segmentId: String) -> [TrajectoryMonitor_.Report] {
        return bySegment[segmentId] ?? []
    }

    public func evaluateLesson(lessonId: String, segmentId: String) -> TrajectoryMonitor_.LessonOutcome {
        let reports = getHistory(segmentId)
        switch lessonId {
        case "L001-referencia-fixa":
            return TrajectoryMonitor_.evaluateReferenciaFixa(reports)
        case "L007-curva-cega":
            return TrajectoryMonitor_.evaluateCurvaCega(reports)
        default:
            return TrajectoryMonitor_.LessonOutcome(
                cumpriu: false, hits: 0, total: reports.count,
                mediaM: nil, razao: "lesson-sem-avaliador"
            )
        }
    }

    public func reset() { bySegment.removeAll() }
}
