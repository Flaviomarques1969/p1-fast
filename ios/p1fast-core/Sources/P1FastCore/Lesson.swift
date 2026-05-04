// ═══════════════════════════════════════════════════════════
// Lesson — biblioteca canônica das 7 lições MVP
// ═══════════════════════════════════════════════════════════
// Port reduzido de src/data/lesson-library.js + lesson-schema.js.
// Cobre os campos necessários pra UI listar e pro P1 Coach eleger:
// id/título/categoria/phaseWeights/requiredSignals/cornerTypes.
//
// Critério MVP (Flavio 2026-04-30): apenas comportamento do piloto
// dentro do carro. Setup mecânico / racecraft agressivo / aerodinâmica
// ficam fora. 7 lições ativas com pipeline iPhone-only viável.

import Foundation

public enum Phase: String, Codable, Sendable {
    case entrada
    case apex
    case saida
}

public enum CornerTypeMatch: String, Codable, Sendable {
    case lenta
    case media
    case rapida
}

public enum Signal: String, Codable, Sendable, CaseIterable {
    // MVP iPhone (mobile-telemetry.js)
    case lat, lng, kmh, course, heading
    case accLong, accLat, gyroAlpha
    // Fase de curva (já calculada em fase-curva.js)
    case phase, velEntrada, velMinima, velSaida, apexT, apexKmh
    // Cross-volta (path-mapper / projector)
    case trajetoria
    // Fase 2: T4000 CAN (BLOCKERS E2)
    case tps, rpm, map, lambda
    // Fase 2: sensores que ainda não existem (rawValue com ponto = paridade JS)
    case steeringAngle = "steering.angle"
    case brakePressure = "brake.pressure"
    case slipRatio = "slip.ratio"
}

public enum LessonCategory: String, Codable, Sendable, CaseIterable {
    case referencia    // pontos fixos (frear, virar, acelerar)
    case velocidade    // V-min, gestão de velocidade
    case transicao     // freio↔acelerador, suavidade
    case controle      // sub/sobresterço, recuperação
    case visao         // olhar, antecipação
    case superficie    // pista/zebra/grip
}

public enum LessonLevel: String, Codable, Sendable {
    case intro, padrao, avancado
}

public enum Confidence: String, Codable, Sendable {
    case alta, media, baixa
}

public struct SuccessCriteria: Codable, Sendable {
    public let metric: String
    public let confidence: Confidence

    public init(metric: String, confidence: Confidence) {
        self.metric = metric
        self.confidence = confidence
    }
}

public struct Lesson: Codable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let category: LessonCategory
    public let level: LessonLevel
    public let shortDescription: String
    public let objective: String
    public let phaseWeights: [Phase: Double]
    public let requiredSignals: [Signal]
    public let optionalSignals: [Signal]
    public let applicableCornerTypes: [CornerTypeMatch]
    public let preferredMessageCodes: [String]
    public let successCriteria: SuccessCriteria
    public let active: Bool

    public init(
        id: String,
        title: String,
        category: LessonCategory,
        level: LessonLevel,
        shortDescription: String,
        objective: String,
        phaseWeights: [Phase: Double],
        requiredSignals: [Signal],
        optionalSignals: [Signal],
        applicableCornerTypes: [CornerTypeMatch],
        preferredMessageCodes: [String],
        successCriteria: SuccessCriteria,
        active: Bool
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.level = level
        self.shortDescription = shortDescription
        self.objective = objective
        self.phaseWeights = phaseWeights
        self.requiredSignals = requiredSignals
        self.optionalSignals = optionalSignals
        self.applicableCornerTypes = applicableCornerTypes
        self.preferredMessageCodes = preferredMessageCodes
        self.successCriteria = successCriteria
        self.active = active
    }

    /// Pode ser ativada com este conjunto de sinais disponíveis?
    public func canActivate(signals: Set<Signal>) -> Bool {
        return requiredSignals.allSatisfy { signals.contains($0) }
    }

    /// Variante para sinais expressos como String (caminho usado pelo
    /// P1Coach que recebe sinais de signalsFromSnapshot).
    public func canActivate(stringSignals: Set<String>) -> Bool {
        return requiredSignals.allSatisfy { stringSignals.contains($0.rawValue) }
    }
}

public enum LessonLibrary {
    /// 7 lições MVP ativas — comportamento do piloto, pipeline iPhone-only.
    public static let mvp: [Lesson] = [
        Lesson(
            id: "L001-referencia-fixa",
            title: "Referência Fixa",
            category: .referencia, level: .intro,
            shortDescription: "Frear, virar e acelerar sempre nos mesmos pontos.",
            objective: "Reduzir variabilidade de pontos de freio, giro e tração entre voltas.",
            phaseWeights: [.entrada: 0.6, .apex: 0.2, .saida: 0.2],
            requiredSignals: [.lat, .lng, .kmh],
            optionalSignals: [.accLong, .trajetoria],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M001", "M002", "M003"],
            successCriteria: SuccessCriteria(metric: "desvio-ponto-freio < 8m em 3 de 4 voltas seguidas", confidence: .alta),
            active: true
        ),
        Lesson(
            id: "L002-v-min",
            title: "V-Min",
            category: .velocidade, level: .intro,
            shortDescription: "Manter velocidade mínima alta e consistente no apex.",
            objective: "Elevar velMinima média e reduzir desvio entre voltas válidas.",
            phaseWeights: [.apex: 1.0],
            requiredSignals: [.kmh, .velMinima, .phase],
            optionalSignals: [.apexKmh],
            applicableCornerTypes: [.lenta, .media],
            preferredMessageCodes: ["M010", "M011", "M012"],
            successCriteria: SuccessCriteria(metric: "velMinima média + desvio < 1.5km/h em 3 voltas", confidence: .alta),
            active: true
        ),
        Lesson(
            id: "L003-transicao-freio-acelerador",
            title: "Transição Freio-Acelerador",
            category: .transicao, level: .padrao,
            shortDescription: "Sem coast longo entre soltar freio e abrir acelerador.",
            objective: "Minimizar janela de aceleração ≈ 0 entre apex e saída.",
            phaseWeights: [.entrada: 0.3, .apex: 0.4, .saida: 0.3],
            requiredSignals: [.accLong, .kmh, .phase],
            optionalSignals: [.tps],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M020", "M021", "M022"],
            successCriteria: SuccessCriteria(metric: "janela coast (|accLong|<0.05g) < 250ms no MEIO", confidence: .media),
            active: true
        ),
        Lesson(
            id: "L004-acelerador-progressivo",
            title: "Acelerador Progressivo",
            category: .transicao, level: .padrao,
            shortDescription: "Abrir o gás suave, sem bate-bate na saída.",
            objective: "Curva de accLong na saída crescente sem oscilação.",
            phaseWeights: [.saida: 1.0],
            requiredSignals: [.accLong, .kmh, .phase],
            optionalSignals: [.tps, .rpm],
            applicableCornerTypes: [.lenta, .media],
            preferredMessageCodes: ["M030", "M031", "M032"],
            successCriteria: SuccessCriteria(metric: "derivada de accLong na SAIDA com 0 reversões", confidence: .media),
            active: true
        ),
        Lesson(
            id: "L005-linha-de-visao",
            title: "Linha de Visão",
            category: .visao, level: .intro,
            shortDescription: "Olhar adiante, antecipar o apex e a saída.",
            objective: "Reduzir correções tardias de heading dentro da curva.",
            phaseWeights: [.entrada: 0.7, .apex: 0.3],
            requiredSignals: [.heading, .gyroAlpha, .phase],
            optionalSignals: [.trajetoria],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M040", "M041", "M042"],
            successCriteria: SuccessCriteria(metric: "pico de gyroYaw após apex < 0.6× pico antes do apex", confidence: .baixa),
            active: true
        ),
        Lesson(
            id: "L006-controle-subesterco",
            title: "Controle de Subesterço",
            category: .controle, level: .padrao,
            shortDescription: "Carro empurra: aliviar e abrir, não insistir.",
            objective: "Detectar entrada com aderência insuficiente e treinar a recuperação.",
            phaseWeights: [.apex: 0.5, .saida: 0.5],
            requiredSignals: [.accLat, .kmh, .gyroAlpha, .phase],
            optionalSignals: [.steeringAngle],
            applicableCornerTypes: [.media, .rapida],
            preferredMessageCodes: ["M050", "M051", "M052"],
            successCriteria: SuccessCriteria(metric: "accLat saturado + yaw abaixo do esperado para velocidade", confidence: .media),
            active: true
        ),
        Lesson(
            id: "L007-curva-cega",
            title: "Curva Cega",
            category: .referencia, level: .padrao,
            shortDescription: "Comprometer trajetória mesmo sem ver a saída.",
            objective: "Manter ponto de freio e giro em curvas sem visibilidade total.",
            phaseWeights: [.entrada: 1.0],
            requiredSignals: [.lat, .lng, .kmh],
            optionalSignals: [.heading, .trajetoria],
            applicableCornerTypes: [.lenta, .media],
            preferredMessageCodes: ["M060", "M061", "M062"],
            successCriteria: SuccessCriteria(metric: "desvio entrada < 5m vs voltas-ref em curvas marcadas como cegas", confidence: .alta),
            active: true
        ),
    ]

    /// 5 lições avançadas (Fase 2 antiga). `active: false` até sensores chegarem.
    /// Decisão Flávio 2026-05-03: tudo entra em Fase 1, mas estas dependem
    /// de STEERING / SLIP_RATIO / BRAKE_PRESSURE que ainda não estão no snapshot.
    public static let phase2: [Lesson] = [
        Lesson(
            id: "L101-volante-continuo",
            title: "Volante Contínuo",
            category: .controle, level: .avancado,
            shortDescription: "Sem corrigir, sem rasgar — entrada em arco único.",
            objective: "Reduzir reversões de ângulo de volante na entrada e apex.",
            phaseWeights: [.entrada: 0.5, .apex: 0.5],
            requiredSignals: [.steeringAngle, .phase],
            optionalSignals: [.gyroAlpha],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M100", "M101", "M102"],
            successCriteria: SuccessCriteria(metric: "reversões de sinal de dSteering/dt = 0 entre INICIO e MEIO", confidence: .alta),
            active: false
        ),
        Lesson(
            id: "L102-circulo-de-grip",
            title: "Círculo de Grip",
            category: .controle, level: .avancado,
            shortDescription: "Somar lat e long sem perder o envelope.",
            objective: "Treinar uso da reserva de aderência sem saturar lat ou long.",
            phaseWeights: [.entrada: 0.4, .apex: 0.3, .saida: 0.3],
            requiredSignals: [.accLat, .accLong, .phase],
            optionalSignals: [.slipRatio],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M110", "M111", "M112"],
            successCriteria: SuccessCriteria(metric: "sqrt(accLat² + accLong²) ≤ envelope sem saturar eixo isolado", confidence: .media),
            active: false
        ),
        Lesson(
            id: "L103-pneu-arrastando",
            title: "Pneu Arrastando",
            category: .superficie, level: .avancado,
            shortDescription: "Entrar travado/derrapando custa mais que parece.",
            objective: "Detectar e reduzir slip de entrada sob frenagem.",
            phaseWeights: [.entrada: 1.0],
            requiredSignals: [.slipRatio, .kmh, .phase],
            optionalSignals: [.brakePressure],
            applicableCornerTypes: [.lenta, .media],
            preferredMessageCodes: ["M120", "M121", "M122"],
            successCriteria: SuccessCriteria(metric: "slip > limiar por menos de 200ms na frenagem", confidence: .baixa),
            active: false
        ),
        Lesson(
            id: "L104-controle-sobresterco",
            title: "Controle de Sobresterço",
            category: .controle, level: .avancado,
            shortDescription: "Saída solta na traseira — antecipar a correção.",
            objective: "Reduzir tempo entre início do escorregamento e correção do volante.",
            phaseWeights: [.apex: 0.3, .saida: 0.7],
            requiredSignals: [.gyroAlpha, .accLat, .steeringAngle, .phase],
            optionalSignals: [.tps],
            applicableCornerTypes: [.media, .rapida],
            preferredMessageCodes: ["M130", "M131", "M132"],
            successCriteria: SuccessCriteria(metric: "latência yaw→correção volante < 250ms", confidence: .media),
            active: false
        ),
        Lesson(
            id: "L105-uso-seguro-zebra",
            title: "Uso Seguro de Zebra",
            category: .superficie, level: .avancado,
            shortDescription: "Pisar na zebra sem desestabilizar o carro.",
            objective: "Identificar quando a zebra ajuda e quando rouba aderência.",
            phaseWeights: [.apex: 0.6, .saida: 0.4],
            requiredSignals: [.lat, .lng, .accLat, .gyroAlpha],
            optionalSignals: [.kmh],
            applicableCornerTypes: [.media, .rapida],
            preferredMessageCodes: ["M140", "M141", "M142"],
            successCriteria: SuccessCriteria(metric: "pulso vertical sem perda lateral > 3% no MEIO/FIM", confidence: .media),
            active: false
        ),
    ]

    /// Catálogo completo (12) — paridade com JS LESSON_LIBRARY.
    public static var all: [Lesson] { mvp + phase2 }

    /// Apenas as ativas — hoje exatamente os 7 MVP.
    public static var active: [Lesson] { mvp.filter(\.active) }

    /// Lookup por id sobre o catálogo completo (paridade JS getLesson).
    public static func byId(_ id: String) -> Lesson? {
        all.first { $0.id == id }
    }

    public static func byCategory(_ cat: LessonCategory) -> [Lesson] {
        all.filter { $0.category == cat }
    }

    public static func forCornerType(_ ct: CornerTypeMatch) -> [Lesson] {
        all.filter { $0.applicableCornerTypes.contains(ct) }
    }
}

// ═══════════════════════════════════════════════════════════
// LessonSchema — validação canônica (paridade JS lesson-schema.js)
// ═══════════════════════════════════════════════════════════

public struct LessonSchemaError: Error, CustomStringConvertible, Equatable {
    public let lessonId: String?
    public let message: String
    public var description: String {
        if let lessonId { return "\(lessonId): \(message)" }
        return message
    }
    public init(lessonId: String?, _ message: String) {
        self.lessonId = lessonId
        self.message = message
    }
}

extension Lesson {
    /// Regex `^L[0-9]{3}-[a-z0-9-]+$` (paridade JS).
    /// Slug aceita lower-case ASCII + dígito + hífen.
    public static func isValidId(_ id: String) -> Bool {
        guard id.count >= 5, id.first == "L" else { return false }
        let chars = Array(id)
        // L + 3 dígitos + '-' + slug
        for i in 1...3 {
            guard chars[i].isASCII, chars[i].isNumber else { return false }
        }
        guard chars[4] == "-" else { return false }
        let slug = chars[5...]
        guard !slug.isEmpty else { return false }
        for c in slug {
            let isLower = c.isASCII && c.isLetter && c.isLowercase
            let isDigit = c.isASCII && c.isNumber
            let isHyphen = c == "-"
            if !(isLower || isDigit || isHyphen) { return false }
        }
        return true
    }

    /// Regex `^M[0-9]{3}$` (paridade JS).
    public static func isValidMessageCode(_ code: String) -> Bool {
        guard code.count == 4, code.first == "M" else { return false }
        return code.dropFirst().allSatisfy { $0.isASCII && $0.isNumber }
    }

    /// Valida a lição contra o schema (paridade JS validateLesson).
    /// Lança `LessonSchemaError` com mensagem específica.
    public func validate() throws {
        guard !id.isEmpty else {
            throw LessonSchemaError(lessonId: nil, "lesson.id obrigatório")
        }
        guard Lesson.isValidId(id) else {
            throw LessonSchemaError(lessonId: id, "lesson.id formato inválido (esperado L### e slug)")
        }
        guard !title.isEmpty else {
            throw LessonSchemaError(lessonId: id, "title obrigatório")
        }
        guard !shortDescription.isEmpty else {
            throw LessonSchemaError(lessonId: id, "shortDescription obrigatória")
        }
        guard !objective.isEmpty else {
            throw LessonSchemaError(lessonId: id, "objective obrigatório")
        }

        guard !phaseWeights.isEmpty else {
            throw LessonSchemaError(lessonId: id, "phaseWeights obrigatório")
        }
        var sum = 0.0
        for (_, v) in phaseWeights {
            guard v >= 0, v <= 1 else {
                throw LessonSchemaError(lessonId: id, "phaseWeights devem ser 0..1")
            }
            sum += v
        }
        guard abs(sum - 1.0) <= 0.001 else {
            let s = String(format: "%.3f", sum)
            throw LessonSchemaError(lessonId: id, "phaseWeights deve somar 1.0 (somou \(s))")
        }

        guard !requiredSignals.isEmpty else {
            throw LessonSchemaError(lessonId: id, "requiredSignals deve ter ao menos 1")
        }

        guard !applicableCornerTypes.isEmpty else {
            throw LessonSchemaError(lessonId: id, "applicableCornerTypes deve ter ao menos 1")
        }

        guard !preferredMessageCodes.isEmpty else {
            throw LessonSchemaError(lessonId: id, "preferredMessageCodes deve ter ao menos 1")
        }
        for code in preferredMessageCodes {
            guard Lesson.isValidMessageCode(code) else {
                throw LessonSchemaError(lessonId: id, "messageCode inválido: \(code) (esperado M###)")
            }
        }

        guard !successCriteria.metric.isEmpty else {
            throw LessonSchemaError(lessonId: id, "successCriteria.metric obrigatório")
        }
    }
}
