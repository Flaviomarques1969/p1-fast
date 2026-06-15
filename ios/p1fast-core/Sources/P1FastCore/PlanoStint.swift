// ═══════════════════════════════════════════════════════════
// PlanoStint — o plano do stint que VIAJA com o envelope
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 15/06/2026: o PLANEJAMENTO do stint mora no CELULAR.
// Ao aprovar, o celular grava o plano JUNTO do envelope de segurança
// (coluna `plano_stint` JSONB, migration 0042) — mesmo papel que o
// computador (web/cockpit/configuracao-stint.js) fazia. O painel da
// pista lê esse plano pra armar o treino de técnica/foco.
//
// Este arquivo é o PORT FIEL do objeto que a web grava. Os nomes das
// chaves são EXATAMENTE os do JSON da web (camelCase: carroId,
// vidaPneuFaixa, aprovadoEm, tipoPneu) pra o painel ler sem tradução.
// Fonte: web/cockpit/configuracao-stint.js (planoCompleto, :180-205) +
// web/cockpit/shift-light-modos.js (ENVELOPE_DEFAULT_BUBI/PERFIL_BUBI).
//
// IMPORTANTE: nenhum valor aqui é inventado. Os números de segurança
// vêm do perfil real do Bubi (Celta 1.4, dinamômetro Lenza 2026-05-18).

import Foundation

/// Uma parada no box planejada — { volta, motivo }. Mesmo formato que o
/// app já usa em `ParadaBox` e que a web grava em `paradas[]`.
public struct PlanoParada: Codable, Equatable {
    public var volta: Int
    public var motivo: String

    public init(volta: Int, motivo: String) {
        self.volta = volta
        self.motivo = motivo
    }
}

/// O plano completo do stint, no formato que o painel da pista lê.
/// Chaves idênticas ao JSON da web (configuracao-stint.js planoCompleto).
public struct PlanoStint: Codable, Equatable {
    /// "livre" | "testar" | "treinar".
    public var proposito: String
    /// Parte do carro (testar) OU disciplina do treino (treinar). nil em livre.
    public var foco: String?
    /// Mapa ghost ligado na tela.
    public var ghost: Bool
    /// Voltas planejadas do stint.
    public var voltas: Int
    /// Paradas no box planejadas.
    public var paradas: [PlanoParada]
    public var carroId: String?
    public var piloto: String?
    public var autodromo: String?
    public var tipoPneu: String?
    public var vidaPneuFaixa: String?
    /// Modo do stint registrado no envelope. Hoje único: "agressivo"
    /// (= máximo desempenho — ver ModoStint.registro).
    public var modo: String
    /// Carimbo ISO8601 da aprovação. Só vale no dia da aprovação (o painel
    /// usa fuso Brasília pra decidir "é o plano de hoje").
    public var aprovadoEm: String

    public init(proposito: String,
                foco: String?,
                ghost: Bool,
                voltas: Int,
                paradas: [PlanoParada],
                carroId: String?,
                piloto: String?,
                autodromo: String?,
                tipoPneu: String?,
                vidaPneuFaixa: String?,
                modo: String = ModoStint.registro,
                aprovadoEm: String) {
        self.proposito = proposito
        self.foco = foco
        self.ghost = ghost
        self.voltas = voltas
        self.paradas = paradas
        self.carroId = carroId
        self.piloto = piloto
        self.autodromo = autodromo
        self.tipoPneu = tipoPneu
        self.vidaPneuFaixa = vidaPneuFaixa
        self.modo = modo
        self.aprovadoEm = aprovadoEm
    }
}

/// Modo do stint. Desde 14/06/2026 não há mais escolha de modo — é sempre
/// "máximo desempenho" (a luz troca na potência máxima e afina pelo menor
/// tempo de passagem). O valor gravado no banco continua sendo o legado
/// "agressivo" (a coluna modo_stint aceita os valores antigos).
/// Fonte: web/cockpit/configuracao-stint.js:18 (MODO_STINT_REGISTRO).
public enum ModoStint {
    public static let registro = "agressivo"
}

/// Valores DEFAULT de segurança do envelope do Bubi (Celta 1.4 motor Onix).
/// PORT FIEL de web/cockpit/shift-light-modos.js (ENVELOPE_DEFAULT_BUBI +
/// PERFIL_BUBI). NÃO inventar nem ajustar sem a curva de dinamômetro real.
public enum EnvelopeDefaultBubi {
    /// Teto duro de rotação, independente do modo (rpm).
    public static let rpmMaxAbsoluto = 6300
    /// Abaixo desta temperatura de motor (°C), rebaixa pra Normal automático.
    public static let rpmMinMotorCelsius = 80
    /// Nunca troca de marcha acima desta força lateral (g) — protege o eixo.
    public static let forcaLateralMaxG = 0.50
    /// Óleo acima disso (°C): alarma + reduz pra Durabilidade.
    public static let oleoMaxCelsius = 115
    /// Água acima disso (°C): alarma + reduz pra Durabilidade.
    public static let aguaMaxCelsius = 95

    /// Pico de potência do Bubi (rpm) — usado no texto de observações do
    /// envelope. Fonte: PERFIL_BUBI.picoPotenciaRpm.
    public static let picoPotenciaRpm = 6050
    /// Redline operacional do Bubi (rpm). Fonte: PERFIL_BUBI.redlineRpm.
    public static let redlineRpm = 6300
}

/// Normaliza o nome do tipo de pneu pro slug canônico que o painel usa.
/// PORT FIEL de web/cockpit/tipo-pneu-normalizer.js. Desconhecido vira o
/// próprio texto em minúsculas (mesma decisão da web — não derruba o fluxo).
public func normalizarTipoPneu(_ input: String?) -> String {
    guard let input, !input.trimmingCharacters(in: .whitespaces).isEmpty else {
        return "desconhecido"
    }
    let t = input.trimmingCharacters(in: .whitespaces).lowercased()

    // Sinônimos → canônico (espelha SINONIMOS do JS).
    let sinonimos: [(canonico: String, formas: [String])] = [
        ("radial-185-14", ["radial 185/14", "radial-185/14", "radial 185-14", "radial-185-14"]),
        ("semi-slick", ["semi slick", "semislick", "semi-slick"]),
        ("slick", ["slick"]),
        ("westlake-z108-185-60-r14", ["westlake z108 185/60 r14", "westlake-z108-185-60-r14"]),
    ]

    // Já é um slug canônico?
    if sinonimos.contains(where: { $0.canonico == t }) { return t }
    // Bate com alguma forma sinônima?
    for (canonico, formas) in sinonimos {
        if formas.map({ $0.lowercased() }).contains(t) { return canonico }
    }
    // Desconhecido: usa o texto como está (igual ao JS).
    return t
}
