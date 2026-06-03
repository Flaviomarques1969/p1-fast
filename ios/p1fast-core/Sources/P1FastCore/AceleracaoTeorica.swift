// ═══════════════════════════════════════════════════════════
// AceleracaoTeorica — Bloco 2 do Plano Piloto + Engenheiro
// 2026-05-18 — função pura.
// ═══════════════════════════════════════════════════════════
// Calcula a aceleração longitudinal (m/s²) que o carro DEVERIA estar
// entregando em pleno acelerador, dada a curva oficial do motor + o
// cadastro técnico do carro + as condições do dia.
//
// Modelo simplificado de pista (sem perdas de transmissão extras, sem
// aderência, sem inclinação): a curva do dinamômetro já reflete a
// potência na roda corrigida SAE J1349.
//
//   F_tração   = T(rpm) × relMarcha × relFinal / raioPneu
//   F_arrasto  = ½ × ρ × CdA × v²
//   F_rolamento = Crr × massa × g
//   F_líquida  = F_tração − F_arrasto − F_rolamento
//   a          = F_líquida / massa
//
// Defaults pra Brasília (Flávio confirmou 2026-05-18):
//   • CdA = 0,65 m² (Celta com kit aerodinâmico de pista)
//   • Crr = 0,013 (pneu slick em asfalto morno)
//   • ρ   = 1,10 kg/m³ (densidade do ar em Brasília, ~1.100 m altitude)
//
// Bloco 3 (Edge Function trecho-analisar) usa exatamente a mesma
// fórmula em TypeScript — a função aqui é a referência canônica.

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Constantes
// ─────────────────────────────────────────────────────────────

/// Aceleração da gravidade em m/s² (padrão internacional).
public let gravidadeMs2: Double = 9.80665

// ─────────────────────────────────────────────────────────────
// MARK: - ResistenciaConfig
// ─────────────────────────────────────────────────────────────

/// Conjunto de parâmetros de resistência ao avanço. Reusável por carro,
/// por pista e por dia (densidade do ar varia com altitude/temperatura).
public struct ResistenciaConfig: Sendable, Equatable, Codable {
    /// Produto coeficiente de arrasto × área frontal (m²). Quanto maior,
    /// mais o ar "segura" o carro em alta velocidade.
    public let cda: Double

    /// Coeficiente de resistência de rolamento (adimensional). Pneu de
    /// pista bom: ~0,012. Pneu de rua: ~0,015. Vai como força = Crr × peso.
    public let crr: Double

    /// Densidade do ar em kg/m³. Em Brasília (altitude ~1.100 m) fica
    /// ~1,10. Ao nível do mar fica ~1,225.
    public let densidadeArKgm3: Double

    public init(cda: Double, crr: Double, densidadeArKgm3: Double) {
        self.cda = cda
        self.crr = crr
        self.densidadeArKgm3 = densidadeArKgm3
    }

    /// Defaults pra Brasília — Celta Bubi confirmado pelo Flávio em
    /// 2026-05-18. Trocar quando rodarmos em pista ao nível do mar
    /// (Interlagos, Velocitta) ou quando medirmos CdA no túnel de vento.
    public static let brasiliaDefault = ResistenciaConfig(
        cda: 0.65, crr: 0.013, densidadeArKgm3: 1.10
    )
}

// ─────────────────────────────────────────────────────────────
// MARK: - AceleracaoTeoricaResultado
// ─────────────────────────────────────────────────────────────

/// Resultado completo de uma consulta de aceleração teórica. Carrega
/// não só o número final (`m_s2`) como também as 3 forças intermediárias,
/// pra UI/auditoria conseguir explicar "perdeu X N pro vento, Y N pro
/// rolamento".
public struct AceleracaoTeoricaResultado: Sendable, Equatable {
    /// Torque do motor (N·m) na rotação consultada.
    public let torqueMotorNm: Double

    /// Força de tração total na roda traseira (N) antes de descontar
    /// resistências.
    public let forcaTracaoN: Double

    /// Força de arrasto aerodinâmico (N). Positiva = atrapalha.
    public let forcaArrastoN: Double

    /// Força de rolamento dos pneus (N). Positiva = atrapalha.
    public let forcaRolamentoN: Double

    /// Força líquida (N) = tração − arrasto − rolamento. Pode ser negativa
    /// se as resistências superarem a tração.
    public let forcaLiquidaN: Double

    /// Aceleração teórica (m/s²). Negativa = desacelerando mesmo em pleno
    /// acelerador (cenário raro: cair em RPM baixíssimo com marcha alta).
    public let aceleracaoMs2: Double
}

// ─────────────────────────────────────────────────────────────
// MARK: - Função principal
// ─────────────────────────────────────────────────────────────

/// Calcula a aceleração teórica do carro em pleno acelerador no instante
/// consultado. Retorna nil se a configuração for inválida (relação ≤ 0,
/// raio do pneu ≤ 0, massa ≤ 0).
///
/// - parameters:
///   - rpm: rotação do motor no instante (RPM).
///   - relacaoMarcha: relação da marcha selecionada (ex.: 3,92 = 1ª).
///   - relacaoFinal: relação do diferencial (ex.: 4,27).
///   - raioPneuM: raio dinâmico do pneu em metros (ex.: 0,289 m).
///   - massaKg: massa total do carro + piloto + combustível em kg.
///   - velocidadeKmh: velocidade longitudinal em km/h.
///   - curva: curva consultável do motor (`DynoCurve.celtaBubi2026_05_18`
///     pro Celta Bubi).
///   - resistencia: parâmetros de arrasto/rolamento (default Brasília).
public func aceleracaoTeorica(
    rpm: Double,
    relacaoMarcha: Double,
    relacaoFinal: Double,
    raioPneuM: Double,
    massaKg: Double,
    velocidadeKmh: Double,
    curva: DynoCurve,
    resistencia: ResistenciaConfig = .brasiliaDefault
) -> AceleracaoTeoricaResultado? {
    guard relacaoMarcha > 0, relacaoFinal > 0, raioPneuM > 0, massaKg > 0 else {
        return nil
    }
    let torqueMotorNm = curva.torqueAt(rpm: rpm)
    let forcaTracaoN = torqueMotorNm * relacaoMarcha * relacaoFinal / raioPneuM

    let velocidadeMs = max(0, velocidadeKmh) / 3.6
    let forcaArrastoN =
        0.5 * resistencia.densidadeArKgm3 * resistencia.cda
        * velocidadeMs * velocidadeMs

    let forcaRolamentoN = resistencia.crr * massaKg * gravidadeMs2

    let forcaLiquidaN = forcaTracaoN - forcaArrastoN - forcaRolamentoN
    let aceleracaoMs2 = forcaLiquidaN / massaKg

    return AceleracaoTeoricaResultado(
        torqueMotorNm: torqueMotorNm,
        forcaTracaoN: forcaTracaoN,
        forcaArrastoN: forcaArrastoN,
        forcaRolamentoN: forcaRolamentoN,
        forcaLiquidaN: forcaLiquidaN,
        aceleracaoMs2: aceleracaoMs2
    )
}
