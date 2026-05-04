// ═══════════════════════════════════════════════════════════
// PlannedVsExecuted — port Swift de
//   src/domain/planned-vs-executed.js
// ═══════════════════════════════════════════════════════════
// Avaliação pedagógica do plano: para cada foco do plano (1 por
// PARCIAL), analisa as execuções reais e emite veredicto:
//   CONSEGUIU / PARCIAL / TENTOU_FALHOU / ERRADO / SEM_DADOS
//
// MS-6.4 (port 2026-05-04). Camada pura — caller traz plan + laps
// + benchmark.

import Foundation

public enum PvEResultado: String, Sendable, Codable, CaseIterable {
    case conseguiu     = "conseguiu"
    case parcial       = "parcial"
    case tentouFalhou  = "tentou-falhou"
    case errado        = "errado"
    case semDados      = "sem-dados"
}

public struct PlanFoco: Sendable, Equatable {
    public let parcialId: String
    public let parcialNome: String
    public let acaoPrincipal: String?
    public let justificativa: String?

    public init(
        parcialId: String, parcialNome: String,
        acaoPrincipal: String? = nil, justificativa: String? = nil
    ) {
        self.parcialId = parcialId
        self.parcialNome = parcialNome
        self.acaoPrincipal = acaoPrincipal
        self.justificativa = justificativa
    }
}

public struct PedagogicalPlan: Sendable, Equatable {
    public let metaPrincipal: String?
    public let criterioSucesso: String?
    public let focos: [PlanFoco]

    public init(
        metaPrincipal: String? = nil,
        criterioSucesso: String? = nil,
        focos: [PlanFoco]
    ) {
        self.metaPrincipal = metaPrincipal
        self.criterioSucesso = criterioSucesso
        self.focos = focos
    }
}

public struct PvELap: Sendable, Equatable {
    public let id: String
    public let numero: Int?
    public let valida: Bool
    public let temposPorParcial: [String: Double?]

    public init(id: String, numero: Int? = nil, valida: Bool, temposPorParcial: [String: Double?] = [:]) {
        self.id = id
        self.numero = numero
        self.valida = valida
        self.temposPorParcial = temposPorParcial
    }
}

public struct PvEExecucao: Sendable, Equatable {
    public let lapId: String
    public let numero: Int?
    public let tempoMs: Double?
    public let classificacaoPrincipal: ErroTipo?
}

public struct PvEFocoResult: Sendable, Equatable {
    public let parcialId: String
    public let parcialNome: String
    public let acaoAlvo: String?
    public let justificativa: String?
    public let execucoes: [PvEExecucao]
    public let resultado: PvEResultado
    public let proximaAcao: String?
}

public struct PvEResult: Sendable, Equatable {
    public let metaPrincipal: String?
    public let criterioSucesso: String?
    public let focos: [PvEFocoResult]
}

private struct AcaoMapping {
    let alinhadas: [ErroTipo]
    let tentativas: [ErroTipo]
}

public enum PlannedVsExecuted {

    /// Avalia o plano contra as voltas + benchmark. `nil` se plan inválido.
    public static func evaluate(
        plan: PedagogicalPlan?,
        laps: [PvELap],
        benchmark: BenchmarkResult?
    ) -> PvEResult? {
        guard let plan else { return nil }
        let validLaps = laps.filter(\.valida)
        var focos: [PvEFocoResult] = []
        for foco in plan.focos {
            let mapping = mapAcao(foco.acaoPrincipal)
            let execucoes: [PvEExecucao] = validLaps.map { l in
                let tempoExec = l.temposPorParcial[foco.parcialId] ?? nil
                let tempoRef = benchmark?.melhorPorParcial[foco.parcialId]??.tempoMs
                let principal: ErroTipo? = {
                    guard let ref = tempoRef, ref > 0,
                          let exec = tempoExec, exec > 0 else { return nil }
                    let dTempo = (exec - ref) / ref
                    if dTempo <= 0.01      { return .manteveLinha }
                    else if dTempo <= 0.03 { return .boaFrenagem }
                    else                   { return nil }
                }()
                return PvEExecucao(
                    lapId: l.id, numero: l.numero,
                    tempoMs: tempoExec, classificacaoPrincipal: principal
                )
            }
            let classificados = execucoes.compactMap { ex -> ErroTipo? in
                ex.classificacaoPrincipal
            }
            let resultado = julgar(mapping: mapping, classificados: classificados)
            let proxima = sugerirProxima(resultado: resultado, foco: foco)
            focos.append(PvEFocoResult(
                parcialId: foco.parcialId,
                parcialNome: foco.parcialNome,
                acaoAlvo: foco.acaoPrincipal,
                justificativa: foco.justificativa,
                execucoes: execucoes,
                resultado: resultado,
                proximaAcao: proxima
            ))
        }
        return PvEResult(
            metaPrincipal: plan.metaPrincipal,
            criterioSucesso: plan.criterioSucesso,
            focos: focos
        )
    }
}

// MARK: - Mapping ações → ErroTipo

private func acaoMap() -> [(key: String, mapping: AcaoMapping)] {
    [
        ("atrasar frenagem",
            AcaoMapping(alinhadas: [.boaFrenagem, .manteveLinha], tentativas: [.freouTardeDemais])),
        ("antecipar frenagem",
            AcaoMapping(alinhadas: [.manteveLinha, .boaFrenagem], tentativas: [.freouCedo])),
        ("acelerar mais cedo",
            AcaoMapping(alinhadas: [.saiuForte, .manteveLinha], tentativas: [.perdeuTracao])),
        ("saída mais forte",
            AcaoMapping(alinhadas: [.saiuForte, .manteveLinha], tentativas: [.perdeuTracao])),
        ("entrar mais forte",
            AcaoMapping(alinhadas: [.boaFrenagem, .manteveLinha], tentativas: [.entrouForteDemais])),
        ("manter linha",
            AcaoMapping(alinhadas: [.manteveLinha], tentativas: [])),
        ("reduzir tempo",
            AcaoMapping(alinhadas: [.manteveLinha, .boaFrenagem, .saiuForte], tentativas: [])),
        ("trabalhar execução",
            AcaoMapping(alinhadas: [.manteveLinha, .boaFrenagem, .saiuForte], tentativas: [])),
        ("focar em",
            AcaoMapping(alinhadas: [.manteveLinha, .boaFrenagem, .saiuForte], tentativas: [])),
    ]
}

private func mapAcao(_ acao: String?) -> AcaoMapping? {
    guard let raw = acao?.lowercased() else { return nil }
    for (key, mapping) in acaoMap() where raw.contains(key) {
        return mapping
    }
    return nil
}

private func julgar(mapping: AcaoMapping?, classificados: [ErroTipo]) -> PvEResultado {
    if classificados.isEmpty { return .semDados }
    guard let mapping else {
        let ok = classificados.filter { $0 == .manteveLinha }.count
        let pct = Double(ok) / Double(classificados.count)
        if pct >= 0.6 { return .parcial }
        return .semDados
    }
    let n = Double(classificados.count)
    let alinhadas = classificados.filter { mapping.alinhadas.contains($0) }.count
    let tentativas = classificados.filter { mapping.tentativas.contains($0) }.count
    let pctAlinhadas = Double(alinhadas) / n
    let pctTentativas = Double(tentativas) / n
    if pctAlinhadas >= 0.6 { return .conseguiu }
    if pctAlinhadas >= 0.3 { return .parcial }
    if pctTentativas >= 0.4 { return .tentouFalhou }
    return .errado
}

private func sugerirProxima(resultado: PvEResultado, foco: PlanFoco) -> String {
    let alvo = foco.parcialNome.isEmpty ? foco.parcialId : foco.parcialNome
    switch resultado {
    case .conseguiu:     return "manter \(alvo) — ação consolidada"
    case .parcial:       return "repetir ação em \(alvo) com mais consistência"
    case .tentouFalhou:  return "executou a ideia mas errou dose — ajustar intensidade em \(alvo)"
    case .errado:        return "reavaliar ação planejada em \(alvo)"
    case .semDados:      return "coletar mais voltas válidas em \(alvo)"
    }
}
