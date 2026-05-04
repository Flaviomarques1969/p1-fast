// ═══════════════════════════════════════════════════════════
// ErrorTaxonomy + ToleranceFromDyno — port Swift de:
//   src/domain/error-taxonomy.js
//   src/domain/tolerance-from-dyno.js
// ═══════════════════════════════════════════════════════════
// Taxonomia: extension do ErrorClassifier (MS-1.2). 10 rótulos
// extras de DETALHE (linha/corda/estabilidade) + categoria por
// rótulo. NÃO substitui o classificador base — enriquece análise
// pós-volta no box. Frases do cockpit não vêm daqui.
//
// ToleranceFromDyno: calcula tolerance_rpm automática baseada na
// "janela útil" da curva de dyno (RPMs com potência ≥ 95% do pico).
// Resultado clampeado em [80, 250].
//
// MS-6.3 (port 2026-05-04). Camada pura.

import Foundation

// MARK: - ErrorTaxonomy (extension de ErrorClassifier)

/// 10 rótulos de detalhe pedagógico (linha/corda/estabilidade).
/// Coexistem com os 16 do `ErroTipo` — alguns trechos podem ter
/// principal (de ErroTipo) + secundárias (destes).
public enum ErroTipoExtra: String, Sendable, Codable, CaseIterable {
    case pegouCorda          = "pegou-corda"
    case naoPegouCorda       = "nao-pegou-corda"
    case usouPistaToda       = "usou-pista-toda"
    case freadaInstavel      = "freada-instavel"
    case entradaSuja         = "entrada-suja"
    case saidaRasgada        = "saida-rasgada"
    case trailBrakingOk      = "trail-braking-ok"
    case corrigiuLinha       = "corrigiu-linha"
    case abortouCurva        = "abortou-curva"
    case exploracaoOk        = "exploracao-ok"
}

public enum CategoriaErro: String, Sendable, Codable, CaseIterable {
    case frenagem
    case entrada
    case linha
    case saida
    case geral
}

public enum ErrorTaxonomy {
    /// Categoria de cada rótulo (ErroTipo + ErroTipoExtra). Paridade
    /// exata com `CategoriaErro` em `error-taxonomy.js`.
    public static func categoriaForRaw(_ raw: String) -> CategoriaErro {
        switch raw {
        // frenagem
        case "freou-cedo", "freou-tarde-demais", "boa-frenagem",
             "freada-instavel", "trail-braking-ok":
            return .frenagem
        // entrada
        case "entrou-forte-demais", "entrou-timido", "entrada-suja":
            return .entrada
        // linha
        case "pegou-corda", "nao-pegou-corda", "manteve-linha",
             "usou-pista-toda", "corrigiu-linha", "abortou-curva":
            return .linha
        // saida
        case "perdeu-rotacao", "matou-saida", "perdeu-tracao",
             "saiu-forte", "saida-rasgada":
            return .saida
        default:
            return .geral
        }
    }

    public static func categoria(_ tipo: ErroTipo) -> CategoriaErro {
        categoriaForRaw(tipo.rawValue)
    }

    public static func categoria(_ extra: ErroTipoExtra) -> CategoriaErro {
        categoriaForRaw(extra.rawValue)
    }

    /// PT-BR labels dos 10 rótulos extras.
    public static func label(_ extra: ErroTipoExtra) -> String {
        switch extra {
        case .pegouCorda:        return "Pegou a corda"
        case .naoPegouCorda:     return "Não pegou corda"
        case .usouPistaToda:     return "Usou pista toda"
        case .freadaInstavel:    return "Freada instável"
        case .entradaSuja:       return "Entrada suja"
        case .saidaRasgada:      return "Saída rasgada"
        case .trailBrakingOk:    return "Trail braking ok"
        case .corrigiuLinha:     return "Corrigiu linha"
        case .abortouCurva:      return "Abortou curva"
        case .exploracaoOk:      return "Exploração ok"
        }
    }

    /// Input enriquecido pra `classifyDetails` — todos opcionais
    /// (ausência = sem rótulo).
    public struct DetailsInput: Sendable, Equatable {
        public var aderenciaCorda: Double?    // 0..1
        public var estabilidadeFrear: Double? // 0..1
        public var aberturaLinha: Double?     // 0..1
        public var abortou: Bool
        public var corrigiu: Bool
        public var trail: Bool

        public init(
            aderenciaCorda: Double? = nil,
            estabilidadeFrear: Double? = nil,
            aberturaLinha: Double? = nil,
            abortou: Bool = false,
            corrigiu: Bool = false,
            trail: Bool = false
        ) {
            self.aderenciaCorda = aderenciaCorda
            self.estabilidadeFrear = estabilidadeFrear
            self.aberturaLinha = aberturaLinha
            self.abortou = abortou
            self.corrigiu = corrigiu
            self.trail = trail
        }
    }

    /// Classifica detalhes adicionais de UM trecho. Retorna lista
    /// (pode ser vazia). Paridade exata JS.
    public static func classifyDetails(_ exec: DetailsInput) -> [ErroTipoExtra] {
        var out: [ErroTipoExtra] = []
        if let a = exec.aderenciaCorda {
            if a >= 0.8        { out.append(.pegouCorda) }
            else if a <= 0.35  { out.append(.naoPegouCorda) }
        }
        if let e = exec.estabilidadeFrear, e <= 0.4 {
            out.append(.freadaInstavel)
        }
        if let l = exec.aberturaLinha {
            if l >= 0.85       { out.append(.usouPistaToda) }
            else if l <= 0.4   { out.append(.entradaSuja) }
        }
        if exec.abortou  { out.append(.abortouCurva) }
        if exec.corrigiu { out.append(.corrigiuLinha) }
        if exec.trail    { out.append(.trailBrakingOk) }
        return out
    }
}

// MARK: - ToleranceFromDyno

public enum ToleranceFromDyno {
    public static let peakThresholdPct: Double = 0.95
    public static let tolMin: Double = 80
    public static let tolMax: Double = 250

    public enum Error: Swift.Error, Equatable, Sendable {
        case curveTooShort
    }

    /// Calcula tolerance_rpm automática a partir da curva de dyno.
    /// Janela útil = RPMs com potência ≥ 95% do pico.
    /// tolerance_rpm = janela_util_largura × percent/100, clampeado [80, 250].
    /// Lança em curva < 3 pontos. Pico inválido ou janela < 2 pontos
    /// devolve `tolMin`.
    public static func compute(curve: [DynoPoint], percent: Double = 5) throws -> Double {
        guard curve.count >= 3 else { throw Error.curveTooShort }
        let sorted = curve.sorted { $0.rpm < $1.rpm }
        var peakP = -Double.infinity
        for p in sorted where p.powerKw.isFinite && p.powerKw > peakP {
            peakP = p.powerKw
        }
        guard peakP.isFinite, peakP > 0 else { return tolMin }
        let thr = peakP * peakThresholdPct
        let inside = sorted.filter { $0.powerKw.isFinite && $0.powerKw >= thr }
        guard inside.count >= 2 else { return tolMin }
        let lo = inside.first!.rpm
        let hi = inside.last!.rpm
        let window = max(0, hi - lo)
        let tol = (window * (percent / 100)).rounded()
        return max(tolMin, min(tolMax, tol))
    }
}
