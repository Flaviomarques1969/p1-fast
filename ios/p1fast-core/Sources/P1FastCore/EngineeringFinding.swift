// ═══════════════════════════════════════════════════════════
// EngineeringFinding / Recommendation — tipos da Camada 2
// ═══════════════════════════════════════════════════════════
// MS-16.3 (Command Box Engenharia — Camada 2 Calibration Engine).
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 (Camada 2 — Calibration Engine).
//
// Finding = fato observado pela camada determinística (CalibrationRule).
//   • Imutável depois de emitido. Insert-only em Supabase (ADR-014 padrão).
//   • Carrega evidência objetiva: canais usados, janela temporal, métricas.
//
// Recommendation = sugestão de ajuste derivada de 1+ findings.
//   • Tem lifecycle: pendente → aprovada / editada / rejeitada.
//   • SEMPRE atravessa decisão humana (engenheiro / chefe / piloto via D17).
//   • Sistema NUNCA aplica automaticamente (princípio §9 do doc auditoria).

import Foundation

public enum FindingSeveridade: String, Codable, Sendable, CaseIterable {
    case info
    case atencao
    case alta
}

public enum FindingConfianca: String, Codable, Sendable, CaseIterable {
    case alta = "Alta"
    case media = "Média"
    case baixa = "Baixa"
}

public enum FindingRisco: String, Codable, Sendable, CaseIterable {
    case alto
    case medio
    case baixo
}

public enum FindingEscopo: String, Codable, Sendable, CaseIterable {
    case stint
    case lap
    case segment
    case cell
}

public enum RecommendationDecisao: String, Codable, Sendable, CaseIterable {
    case pendente
    case aprovada
    case editada
    case rejeitada
}

/// Achado objetivo da Camada 2. Append-only no schema.
/// Estrutura paralela à `Alert` da Camada 1 mas com ciclo de vida mais rico.
public struct EngineeringFinding: Codable, Sendable, Equatable {
    public let id: String
    public let ruleId: String
    public let severidade: FindingSeveridade
    public let titulo: String
    public let descricao: String
    public let escopo: FindingEscopo
    public let segmentId: String?
    public let lapNumero: Int?
    /// Métrica → valor numérico (canais usados como evidência).
    public let evidencia: [String: Double]
    /// Linhas humanas de evidência ("λ médio 1.07 alvo 0.88, 3 voltas").
    public let evidenciaTexto: [String]
    public let confianca: FindingConfianca
    public let t: Int64
    public let tMono: Double

    public init(
        id: String, ruleId: String, severidade: FindingSeveridade,
        titulo: String, descricao: String, escopo: FindingEscopo,
        segmentId: String? = nil, lapNumero: Int? = nil,
        evidencia: [String: Double], evidenciaTexto: [String],
        confianca: FindingConfianca, t: Int64, tMono: Double
    ) {
        self.id = id
        self.ruleId = ruleId
        self.severidade = severidade
        self.titulo = titulo
        self.descricao = descricao
        self.escopo = escopo
        self.segmentId = segmentId
        self.lapNumero = lapNumero
        self.evidencia = evidencia
        self.evidenciaTexto = evidenciaTexto
        self.confianca = confianca
        self.t = t
        self.tMono = tMono
    }
}

/// Sugestão de ajuste derivada de findings — campo central da UI engenheiro.
/// Mutável apenas no campo `decisao` + `decisaoEm` + `payloadEditado`.
public struct EngineeringRecommendation: Codable, Sendable, Equatable {
    public let id: String
    public let findingIds: [String]
    public let ruleId: String
    public let titulo: String
    public let racional: String
    public let prioridade: String
    public let ajustes: [Ajuste]
    public let naoMexer: [String]
    public let comoValidar: String
    public let confianca: FindingConfianca
    public let risco: FindingRisco
    public let evidencia: [String]
    public let decisao: RecommendationDecisao
    public let decisaoEm: Int64?
    public let decisaoPor: String?
    public let payloadEditadoJson: String?
    public let t: Int64
    public let tMono: Double

    public init(
        id: String, findingIds: [String], ruleId: String,
        titulo: String, racional: String, prioridade: String,
        ajustes: [Ajuste], naoMexer: [String], comoValidar: String,
        confianca: FindingConfianca, risco: FindingRisco,
        evidencia: [String],
        decisao: RecommendationDecisao = .pendente,
        decisaoEm: Int64? = nil, decisaoPor: String? = nil,
        payloadEditadoJson: String? = nil,
        t: Int64, tMono: Double
    ) {
        self.id = id
        self.findingIds = findingIds
        self.ruleId = ruleId
        self.titulo = titulo
        self.racional = racional
        self.prioridade = prioridade
        self.ajustes = ajustes
        self.naoMexer = naoMexer
        self.comoValidar = comoValidar
        self.confianca = confianca
        self.risco = risco
        self.evidencia = evidencia
        self.decisao = decisao
        self.decisaoEm = decisaoEm
        self.decisaoPor = decisaoPor
        self.payloadEditadoJson = payloadEditadoJson
        self.t = t
        self.tMono = tMono
    }
}

public struct Ajuste: Codable, Sendable, Equatable {
    public let campo: String        // "combustivel"
    public let de: String?          // valor atual
    public let para: String         // valor proposto
    public let motivo: String       // "λ médio 1.07 acima do alvo 0.88"
    public let risco: String?       // "detonação se atrasar muito"

    public init(campo: String, de: String?, para: String, motivo: String, risco: String?) {
        self.campo = campo; self.de = de; self.para = para
        self.motivo = motivo; self.risco = risco
    }
}
