// ═══════════════════════════════════════════════════════════
// MotorAnaliseStint — Bloco 5 do Plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Funções puras que apoiam a aba "Motor" do Command Box · Visão
// Engenheiro:
//
//   • `histogramaRpmPorFaixa(rpms:, faixas:)` — quanto tempo (em
//     amostras) o motor passou em cada faixa de RPM.
//   • `bandaIdealCelta()` — janela de operação ideal do Celta Bubi
//     (4.500–6.300 RPM, da curva oficial).
//   • `fracaoNaBanda(...)` — qual fração do stint ficou na banda.
//   • `topOportunidadesMotor(...)` — ranking de trechos pelo delta
//     acumulado (usado pra alimentar o painel C de sugestões).
//   • `pendenciaMotorAutomatica(...)` — quando o histórico de um
//     trecho mostra motor caindo (vindo do `detectarMotorDecaindo`
//     do TS), gera uma sugestão de pendência pronta pro Command Box.

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Histograma de RPM
// ─────────────────────────────────────────────────────────────

/// Conta quantas amostras caíram em cada faixa de RPM. A faixa é
/// `[min, max)` (inclusive no início, exclusive no fim). Amostras
/// abaixo da menor ou acima da maior caem na faixa mais próxima.
///
/// `faixas` precisa estar ordenado por `min` crescente.
public func histogramaRpmPorFaixa(rpms: [Double], faixas: [(min: Double, max: Double)]) -> [Int] {
    guard !faixas.isEmpty else { return [] }
    var contagem = Array(repeating: 0, count: faixas.count)
    for rpm in rpms {
        var encontrou = false
        for (i, f) in faixas.enumerated() {
            if rpm >= f.min && rpm < f.max {
                contagem[i] += 1
                encontrou = true
                break
            }
        }
        if !encontrou {
            // Cai na faixa mais próxima (primeira ou última)
            if rpm < faixas.first!.min {
                contagem[0] += 1
            } else {
                contagem[faixas.count - 1] += 1
            }
        }
    }
    return contagem
}

/// Faixas de 500 RPM padrão pro Celta (1.500 a 7.000 RPM).
public let faixasRpm500: [(min: Double, max: Double)] = [
    (1500, 2000), (2000, 2500), (2500, 3000), (3000, 3500),
    (3500, 4000), (4000, 4500), (4500, 5000), (5000, 5500),
    (5500, 6000), (6000, 6500), (6500, 7000),
]

// ─────────────────────────────────────────────────────────────
// MARK: - Banda ideal Celta
// ─────────────────────────────────────────────────────────────

/// Janela ótima de operação do Celta Bubi pela curva oficial: 4.500
/// a 6.300 RPM (HP ≥ 100). Fonte:
/// `docs/dyno/CELTA_BUBI_MARQUES_DYNO_2026-05-18.md` §3.
public func bandaIdealCelta() -> (min: Double, max: Double) {
    (4500, 6300)
}

/// Fração do stint em que o motor ficou dentro da banda ideal.
/// Devolve um valor entre 0 e 1.
public func fracaoNaBanda(rpms: [Double], banda: (min: Double, max: Double)) -> Double {
    guard !rpms.isEmpty else { return 0 }
    let dentro = rpms.filter { $0 >= banda.min && $0 < banda.max }.count
    return Double(dentro) / Double(rpms.count)
}

// ─────────────────────────────────────────────────────────────
// MARK: - Top oportunidades por trecho
// ─────────────────────────────────────────────────────────────

public struct OportunidadeMotor: Sendable, Equatable, Codable {
    public let trechoId: String
    public let deltaAcumuladoMs2: Double
    public let causaProvavel: String

    public init(trechoId: String, deltaAcumuladoMs2: Double, causaProvavel: String) {
        self.trechoId = trechoId
        self.deltaAcumuladoMs2 = deltaAcumuladoMs2
        self.causaProvavel = causaProvavel
    }
}

/// Ordena oportunidades por delta decrescente. Filtra entradas com
/// delta < `minimoMs2` (ruído baixo). Top N (default 3).
public func topOportunidadesMotor(
    _ entradas: [OportunidadeMotor],
    minimoMs2: Double = 0.3,
    topN: Int = 3
) -> [OportunidadeMotor] {
    let filtrado = entradas.filter { $0.deltaAcumuladoMs2 >= minimoMs2 }
    let ordenado = filtrado.sorted { $0.deltaAcumuladoMs2 > $1.deltaAcumuladoMs2 }
    return Array(ordenado.prefix(topN))
}

// ─────────────────────────────────────────────────────────────
// MARK: - Pendência automática (motor caindo)
// ─────────────────────────────────────────────────────────────

public struct PendenciaSugerida: Sendable, Equatable, Codable {
    public let trechoId: String
    public let titulo: String
    public let descricao: String
    public let severidade: String      // "alta" | "media" | "baixa"

    public init(trechoId: String, titulo: String, descricao: String, severidade: String) {
        self.trechoId = trechoId
        self.titulo = titulo
        self.descricao = descricao
        self.severidade = severidade
    }
}

/// Quando o histórico de um trecho mostra delta crescente em 3
/// stints seguidos (fator ≥ 1.30), gera pendência sugerida. Senão
/// devolve nil.
public func pendenciaMotorAutomatica(
    trechoId: String,
    deltasOrdenadosNoTempo: [Double]
) -> PendenciaSugerida? {
    guard deltasOrdenadosNoTempo.count >= 3 else { return nil }
    let janela = Array(deltasOrdenadosNoTempo.suffix(3))
    // Tem que ser monótono crescente
    for i in 1..<janela.count {
        if janela[i] < janela[i - 1] { return nil }
    }
    let primeiro = janela[0]
    let ultimo = janela[janela.count - 1]
    guard primeiro > 0 else { return nil }
    let fator = ultimo / primeiro
    guard fator >= 1.30 else { return nil }
    return PendenciaSugerida(
        trechoId: trechoId,
        titulo: "Motor caindo no trecho \(trechoId)",
        descricao: "Delta cresceu \(Int((fator - 1) * 100))% em 3 stints. Sugerir checar vela, filtro de ar e óleo do motor.",
        severidade: fator >= 1.5 ? "alta" : "media"
    )
}
