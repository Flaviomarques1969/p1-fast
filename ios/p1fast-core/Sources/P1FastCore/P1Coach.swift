// ═══════════════════════════════════════════════════════════
// P1Coach — port Swift de src/domain/p1-coach.js
// ═══════════════════════════════════════════════════════════
// Motor pedagógico do P1 Track Learning. Quando piloto entra no
// modo "Aprendizado com IA", o coach:
//   1. Filtra LessonLibrary por cornerType + foco
//   2. Verifica requiredSignals
//   3. Elege UMA lição por curva (maxPerCorner=1)
//   4. Emite mensagens curtas (CoachPhrases) na fase certa
//   5. Respeita cooldown e CRITICAL alerts (caller faz pause)

import Foundation

public enum FaseCurvaJS: String, Sendable {
    case inicio
    case meio
    case fim

    public var phase: Phase {
        switch self {
        case .inicio: return .entrada
        case .meio:   return .apex
        case .fim:    return .saida
        }
    }
}

public struct CoachSegment: Sendable {
    public let id: String
    public let ehTrecho: Bool
    public let cornerType: CornerTypeMatch?
    public init(id: String, ehTrecho: Bool, cornerType: CornerTypeMatch?) {
        self.id = id; self.ehTrecho = ehTrecho; self.cornerType = cornerType
    }
}

public struct CoachSnapshot: Sendable {
    public let t: Double
    public let tMono: Double
    public init(t: Double, tMono: Double) { self.t = t; self.tMono = tMono }
}

public struct CoachMessage: Sendable, Equatable {
    public let lessonId: String
    public let code: String
    public let text: String
    public let phase: Phase
    public let confidence: Confidence
    public let t: Double
    public let tMono: Double
    public let cornerType: CornerTypeMatch
    public let segmentId: String
}

public struct StintLearningSession: Sendable {
    public var active: Bool
    public var focusPhase: Phase?
    public var focusLessonId: String?
    public var segmentId: String?
    public var startedAt: Double
    public var laps: Int

    public static let inactive = StintLearningSession(
        active: false, focusPhase: nil, focusLessonId: nil,
        segmentId: nil, startedAt: 0, laps: 0
    )
}

public final class P1Coach {

    public static let defaultCooldownMs: Double = 3500
    public static let defaultMaxPerCorner: Int = 1
    public static let lowConfRequiresUserPick: Bool = true

    public typealias Listener = (CoachMessage) -> Void

    public var onMessage: Listener?
    public var cooldownMs: Double
    public var maxPerCorner: Int

    private var lastEmitAt: Double? = nil
    private var currentSegmentId: String? = nil
    private var messagesThisCorner: Int = 0
    private var activeLessonForCorner: Lesson? = nil
    private var paused: Bool = false

    public private(set) var learningSession: StintLearningSession = .inactive

    public init(onMessage: Listener? = nil,
                cooldownMs: Double = defaultCooldownMs,
                maxPerCorner: Int = defaultMaxPerCorner) {
        self.onMessage = onMessage
        self.cooldownMs = cooldownMs
        self.maxPerCorner = maxPerCorner
    }

    // ── ciclo "Aprendizado com IA" ──

    public func startLearningSession(focusPhase: Phase? = nil,
                                     focusLessonId: String? = nil,
                                     segmentId: String? = nil) {
        if let lid = focusLessonId, LessonLibrary.byId(lid) == nil {
            preconditionFailure("focusLessonId desconhecido: \(lid)")
        }
        learningSession = StintLearningSession(
            active: true,
            focusPhase: focusPhase,
            focusLessonId: focusLessonId,
            segmentId: segmentId,
            startedAt: Double(Clock.now),
            laps: 0
        )
        activeLessonForCorner = nil
        messagesThisCorner = 0
    }

    @discardableResult
    public func endLearningSession() -> StintLearningSession {
        let finished = learningSession
        learningSession = .inactive
        return finished
    }

    public func pause()  { paused = true }
    public func resume() { paused = false }

    public func onSegmentEnter(_ segment: CoachSegment, availableSignals: Set<String>) {
        if !segment.ehTrecho {
            currentSegmentId = nil
            activeLessonForCorner = nil
            return
        }
        currentSegmentId = segment.id
        messagesThisCorner = 0
        activeLessonForCorner = electLesson(segment: segment, signals: availableSignals)
    }

    public func onSegmentExit() {
        currentSegmentId = nil
        activeLessonForCorner = nil
        messagesThisCorner = 0
    }

    public func onLapEnd() {
        if learningSession.active { learningSession.laps += 1 }
    }

    private func electLesson(segment: CoachSegment, signals: Set<String>) -> Lesson? {
        guard let cornerType = segment.cornerType else { return nil }
        let focusLessonId = learningSession.focusLessonId
        let focusPhase = learningSession.focusPhase
        let userPicked = (focusLessonId != nil) || (focusPhase != nil)

        if let fid = focusLessonId, let l = LessonLibrary.byId(fid) {
            if l.active && l.applicableCornerTypes.contains(cornerType)
                && l.canActivate(stringSignals: signals) {
                return l
            }
            return nil
        }

        var pool = LessonLibrary.active
            .filter { $0.applicableCornerTypes.contains(cornerType) }
            .filter { $0.canActivate(stringSignals: signals) }

        if Self.lowConfRequiresUserPick && !userPicked {
            pool = pool.filter { $0.successCriteria.confidence != .baixa }
        }

        if let fp = focusPhase {
            let focused = pool.filter { ($0.phaseWeights[fp] ?? 0) >= 0.5 }
            if !focused.isEmpty { pool = focused }
        }

        guard !pool.isEmpty else { return nil }

        pool.sort { (a, b) in
            if let fp = focusPhase {
                let wa = a.phaseWeights[fp] ?? 0
                let wb = b.phaseWeights[fp] ?? 0
                if wa != wb { return wa > wb }
            }
            return a.id < b.id
        }
        return pool.first
    }

    @discardableResult
    public func consume(faseCurva: FaseCurvaJS,
                        snapshot: CoachSnapshot,
                        signals: Set<String>) -> CoachMessage? {
        if paused { return nil }
        if !learningSession.active { return nil }
        guard let lesson = activeLessonForCorner, let segId = currentSegmentId else { return nil }
        if messagesThisCorner >= maxPerCorner { return nil }

        let phase = faseCurva.phase
        if !lesson.canActivate(stringSignals: signals) { return nil }

        let weight = lesson.phaseWeights[phase] ?? 0
        if weight < 0.2 { return nil }

        if let fp = learningSession.focusPhase, phase != fp { return nil }

        if let last = lastEmitAt, snapshot.tMono - last < cooldownMs { return nil }

        guard let code = pickMessageCode(lesson: lesson, phase: phase) else { return nil }
        guard let text = CoachPhrases.getPhrase(code) else { return nil }

        let msg = CoachMessage(
            lessonId: lesson.id,
            code: code, text: text,
            phase: phase,
            confidence: lesson.successCriteria.confidence,
            t: snapshot.t,
            tMono: snapshot.tMono,
            cornerType: lesson.applicableCornerTypes.first ?? .lenta,
            segmentId: segId
        )

        lastEmitAt = snapshot.tMono
        messagesThisCorner += 1
        onMessage?(msg)
        return msg
    }

    private func pickMessageCode(lesson: Lesson, phase: Phase) -> String? {
        let codes = lesson.preferredMessageCodes
        guard !codes.isEmpty else { return nil }
        let rawIdx: Int
        switch phase {
        case .entrada: rawIdx = 0
        case .apex:    rawIdx = min(1, codes.count - 1)
        case .saida:   rawIdx = min(2, codes.count - 1)
        }
        return rawIdx < codes.count ? codes[rawIdx] : codes[0]
    }

    // ── helper: derivar Set<String> de sinais a partir de snapshot canônico ──

    public struct SnapshotSignalsInput {
        public var kmh: Double?
        public var lat: Double?
        public var lng: Double?
        public var course: Double?
        public var heading: Double?
        public var accLong: Double?
        public var accLat: Double?
        public var gyroAlpha: Double?
        public var tps: Double?
        public var rpm: Double?
        public var map: Double?
        public var lambda: Double?
        public var steeringAngle: Double?
        public var brakePressure: Double?
        public var slipRatio: Double?
        public var trajetoriaMatch: Double?
        public init(kmh: Double? = nil, lat: Double? = nil, lng: Double? = nil,
                    course: Double? = nil, heading: Double? = nil,
                    accLong: Double? = nil, accLat: Double? = nil, gyroAlpha: Double? = nil,
                    tps: Double? = nil, rpm: Double? = nil, map: Double? = nil, lambda: Double? = nil,
                    steeringAngle: Double? = nil, brakePressure: Double? = nil,
                    slipRatio: Double? = nil, trajetoriaMatch: Double? = nil) {
            self.kmh = kmh; self.lat = lat; self.lng = lng
            self.course = course; self.heading = heading
            self.accLong = accLong; self.accLat = accLat; self.gyroAlpha = gyroAlpha
            self.tps = tps; self.rpm = rpm; self.map = map; self.lambda = lambda
            self.steeringAngle = steeringAngle; self.brakePressure = brakePressure
            self.slipRatio = slipRatio; self.trajetoriaMatch = trajetoriaMatch
        }
    }

    public struct FaseStatsInput {
        public var velEntrada: Double?
        public var velMinima: Double?
        public var velSaida: Double?
        public var apexT: Double?
        public var apexKmh: Double?
        public init(velEntrada: Double? = nil, velMinima: Double? = nil,
                    velSaida: Double? = nil, apexT: Double? = nil, apexKmh: Double? = nil) {
            self.velEntrada = velEntrada; self.velMinima = velMinima
            self.velSaida = velSaida; self.apexT = apexT; self.apexKmh = apexKmh
        }
    }

    public static func signalsFromSnapshot(_ snap: SnapshotSignalsInput,
                                           faseStats: FaseStatsInput? = nil) -> Set<String> {
        var s = Set<String>()
        if snap.kmh != nil       { s.insert("kmh") }
        if snap.lat != nil       { s.insert("lat") }
        if snap.lng != nil       { s.insert("lng") }
        if snap.course != nil    { s.insert("course") }
        if snap.heading != nil   { s.insert("heading") }
        if snap.accLong != nil   { s.insert("accLong") }
        if snap.accLat != nil    { s.insert("accLat") }
        if snap.gyroAlpha != nil { s.insert("gyroAlpha") }
        if snap.tps != nil       { s.insert("tps") }
        if snap.rpm != nil       { s.insert("rpm") }
        if snap.map != nil       { s.insert("map") }
        if snap.lambda != nil    { s.insert("lambda") }
        if snap.steeringAngle != nil { s.insert("steering.angle") }
        if snap.brakePressure != nil { s.insert("brake.pressure") }
        if snap.slipRatio != nil     { s.insert("slip.ratio") }
        if snap.trajetoriaMatch != nil { s.insert("trajetoria") }
        if let f = faseStats {
            s.insert("phase")
            if f.velEntrada != nil { s.insert("velEntrada") }
            if f.velMinima != nil  { s.insert("velMinima") }
            if f.velSaida != nil   { s.insert("velSaida") }
            if f.apexT != nil      { s.insert("apexT") }
            if f.apexKmh != nil    { s.insert("apexKmh") }
        }
        return s
    }
}
