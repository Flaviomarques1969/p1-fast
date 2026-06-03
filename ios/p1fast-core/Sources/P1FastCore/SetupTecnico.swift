// ═══════════════════════════════════════════════════════════
// SetupTecnico — helpers do Bloco 1 (Plano Piloto + Engenheiro)
// 2026-05-18 — Flávio aprovou os parâmetros e mandou seguir.
// ═══════════════════════════════════════════════════════════
// Helpers puros (sem IO) que dão suporte ao cadastro técnico do carro:
//
//   • raioPneuDePadrao(_:) — converte medida tipo "185/60 R14" em raio em
//     metros, pra usar no cálculo de aceleração teórica.
//   • pesoTotalStint(carroKg:pilotoKg:combustivelKg:) — soma o peso total
//     vivo durante o stint (carro pronto + piloto cadastrado + combustível
//     estimado).
//   • CeltaBubiCatalogo — valores iniciais conhecidos do câmbio Celta 1.0
//     PK6 (5 marchas H) + raio do pneu 185/60 R14 + massa de catálogo.
//
// Os valores podem ser sobrescritos no cadastro da Configuração ativa
// (UI do Bloco 1).

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Cálculo do raio do pneu a partir da medida padrão
// ─────────────────────────────────────────────────────────────

/// Resultado do parse de uma medida de pneu padrão "LARGURA/PERFIL R ARO".
public struct MedidaPneu: Sendable, Equatable, Hashable {
    /// Largura em milímetros (ex.: 185).
    public let larguraMm: Int
    /// Perfil (%) — altura do flanco como % da largura (ex.: 60).
    public let perfil: Int
    /// Diâmetro do aro em polegadas (ex.: 14).
    public let aroPolegadas: Int

    /// Raio dinâmico em metros. Aproximação:
    /// raio = (aro_pol × 25,4 mm) / 2 + (largura × perfil/100)
    /// resultado dividido por 1000 pra converter mm em metros.
    public var raioM: Double {
        let raioAroMm = Double(aroPolegadas) * 25.4 / 2.0
        let alturaFlancoMm = Double(larguraMm) * Double(perfil) / 100.0
        return (raioAroMm + alturaFlancoMm) / 1000.0
    }
}

/// Parser permissivo de medida padrão "185/60 R14" ou "185/60R14" (case
/// insensitive, espaços livres). Retorna nil quando não bate o padrão.
public func parseMedidaPneu(_ s: String) -> MedidaPneu? {
    let limpo = s.uppercased()
        .replacingOccurrences(of: " ", with: "")
    // Padrão: NNN/NN R NN (R opcional pode ter "ZR" também)
    // Captura 3 grupos numéricos
    let pattern = #"^(\d{2,3})/(\d{2,3})Z?R(\d{2,3})$"#
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: limpo,
                                       range: NSRange(limpo.startIndex..., in: limpo)),
          match.numberOfRanges == 4,
          let r1 = Range(match.range(at: 1), in: limpo),
          let r2 = Range(match.range(at: 2), in: limpo),
          let r3 = Range(match.range(at: 3), in: limpo),
          let largura = Int(limpo[r1]),
          let perfil = Int(limpo[r2]),
          let aro = Int(limpo[r3])
    else { return nil }
    return MedidaPneu(larguraMm: largura, perfil: perfil, aroPolegadas: aro)
}

// ─────────────────────────────────────────────────────────────
// MARK: - Cálculo do peso total do stint
// ─────────────────────────────────────────────────────────────

/// Peso total durante o stint (em kg).
///
/// `carroKg` — massa do carro pronto, sem piloto, sem combustível. Vem do
/// cadastro da Configuração ativa.
///
/// `pilotoKg` — peso do piloto cadastrado pro stint (vem do `Piloto.pesoKg`).
/// Quando nulo, soma só carro + combustível.
///
/// `combustivelKg` — estimativa de combustível pro evento. Default = 30 kg
/// (~40 litros de gasolina × densidade 0,75 kg/L).
///
/// Quando `carroKg` for nulo, devolve nil — sem massa do carro o cálculo
/// não faz sentido.
public func pesoTotalStint(carroKg: Double?,
                           pilotoKg: Double?,
                           combustivelKg: Double = 30.0) -> Double? {
    guard let carro = carroKg, carro > 0 else { return nil }
    let piloto = max(0, pilotoKg ?? 0)
    let combust = max(0, combustivelKg)
    return carro + piloto + combust
}

// ─────────────────────────────────────────────────────────────
// MARK: - Catálogo inicial do Celta Bubi (Flávio confirmou 2026-05-18)
// ─────────────────────────────────────────────────────────────

/// Valores iniciais conhecidos pra Configuração ativa do Celta Bubi (mesmo
/// carro chamado de "Bolinha"). Servem de seed na primeira execução com
/// `v33` aplicada. Flávio confirmou os números em 2026-05-18 ("relações
/// conhecidas do Celta 1.0", "peso do celta em 800. depois a gente
/// ajusta", pneu 185/60 R14 como hipótese inicial).
public enum CeltaBubiCatalogo: Sendable {
    /// Relação da 1ª marcha — catálogo Celta 1.0 transmissão F17 (5 marchas H).
    public static let relacaoMarcha1: Double = 3.92
    public static let relacaoMarcha2: Double = 2.05
    public static let relacaoMarcha3: Double = 1.36
    public static let relacaoMarcha4: Double = 0.95
    public static let relacaoMarcha5: Double = 0.76
    public static let relacaoFinal:   Double = 4.27

    /// Raio dinâmico do pneu 185/60 R14 em metros. ≈ 0,289 m.
    public static let raioPneuM: Double = MedidaPneu(
        larguraMm: 185, perfil: 60, aroPolegadas: 14
    ).raioM

    /// Massa do carro pronto (sem piloto, sem combustível). Flávio
    /// informou 800 kg, com nota "depois a gente ajusta" (pesagem real
    /// pendente).
    public static let massaCarroKg: Double = 800.0

    /// Medida do pneu como texto humano (compatível com o campo
    /// `pneusMedida` que já existe).
    public static let medidaPneuTexto = "185/60 R14"
}
