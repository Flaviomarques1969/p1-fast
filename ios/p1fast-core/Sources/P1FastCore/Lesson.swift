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

public enum Signal: String, Codable, Sendable {
    case lat, lng, kmh, course, heading
    case accLong, accLat, gyroAlpha
    case tps, rpm, map, lambda
    case velMinima, phase, apexKmh, trajetoria
}

public enum LessonCategory: String, Codable, Sendable {
    case referencia, velocidade, transicao, racing, mental, fundamentos
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

    /// Pode ser ativada com este conjunto de sinais disponíveis?
    public func canActivate(signals: Set<Signal>) -> Bool {
        return requiredSignals.allSatisfy { signals.contains($0) }
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
            category: .fundamentos, level: .intro,
            shortDescription: "Olhar pro próximo ponto, não pro capô.",
            objective: "Antecipar entrada de curva pelo olhar; trajetória mais limpa.",
            phaseWeights: [.entrada: 0.5, .apex: 0.3, .saida: 0.2],
            requiredSignals: [.kmh, .heading],
            optionalSignals: [.lat, .lng],
            applicableCornerTypes: [.lenta, .media, .rapida],
            preferredMessageCodes: ["M040", "M041", "M042"],
            successCriteria: SuccessCriteria(metric: "estabilidade da heading na entrada", confidence: .baixa),
            active: true
        ),
        Lesson(
            id: "L006-trail-braking-suave",
            title: "Trail Braking Suave",
            category: .transicao, level: .avancado,
            shortDescription: "Soltar freio gradualmente entrando na curva.",
            objective: "Reduzir frenagem progressivamente do início ao apex.",
            phaseWeights: [.entrada: 0.7, .apex: 0.3],
            requiredSignals: [.accLong, .kmh, .phase],
            optionalSignals: [],
            applicableCornerTypes: [.lenta, .media],
            preferredMessageCodes: ["M050", "M051", "M052"],
            successCriteria: SuccessCriteria(metric: "accLong cresce monotônico do início ao apex", confidence: .media),
            active: true
        ),
        Lesson(
            id: "L007-curva-cega",
            title: "Curva Cega",
            category: .referencia, level: .padrao,
            shortDescription: "Trajetória correta sem ver o apex.",
            objective: "Manter linha em curvas com apex oculto via referência fixa.",
            phaseWeights: [.entrada: 0.5, .apex: 0.5],
            requiredSignals: [.lat, .lng, .kmh, .heading],
            optionalSignals: [.trajetoria],
            applicableCornerTypes: [.media, .rapida],
            preferredMessageCodes: ["M060", "M061", "M062"],
            successCriteria: SuccessCriteria(metric: "desvio < 5m do traçado de referência em 2 de 3 voltas", confidence: .baixa),
            active: true
        ),
    ]

    /// Apenas as ativas (todas as 7 do MVP).
    public static var active: [Lesson] { mvp.filter(\.active) }

    /// Lookup por id.
    public static func byId(_ id: String) -> Lesson? {
        mvp.first { $0.id == id }
    }
}
