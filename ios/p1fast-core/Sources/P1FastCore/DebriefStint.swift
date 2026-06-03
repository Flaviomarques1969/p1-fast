// ═══════════════════════════════════════════════════════════
// DebriefStint — Bloco 6 do Plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Funções puras para montar o relatório de pós-stint:
//
//   • Top 3 oportunidades (já tem `topOportunidadesMotor` no Bloco 5).
//   • Comparação trecho-a-trecho contra o melhor stint anterior:
//     onde melhorou / regrediu / igualou.
//   • Plano sugerido pro próximo stint (sequência de focos).
//
// Não toca IO — quem persiste é o caller. Toda massa de dados é
// passada por parâmetro pra ficar fácil de testar.

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Tempo por trecho (entrada do debrief)
// ─────────────────────────────────────────────────────────────

/// Par (trechoId, tempo em segundos) — saída do `segment_executions`.
public struct TempoTrecho: Sendable, Equatable, Codable {
    public let trechoId: String
    public let tempoS: Double

    public init(trechoId: String, tempoS: Double) {
        self.trechoId = trechoId
        self.tempoS = tempoS
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Comparação por trecho
// ─────────────────────────────────────────────────────────────

public enum ResultadoTrecho: String, Sendable, Equatable, Codable {
    case melhorou
    case regrediu
    case igualou
    case novo            // não tinha no histórico
}

public struct DiffTrecho: Sendable, Equatable, Codable {
    public let trechoId: String
    public let tempoAtualS: Double
    public let melhorAnteriorS: Double?
    public let deltaS: Double         // negativo = melhorou; positivo = regrediu
    public let resultado: ResultadoTrecho

    public init(trechoId: String, tempoAtualS: Double, melhorAnteriorS: Double?,
                deltaS: Double, resultado: ResultadoTrecho) {
        self.trechoId = trechoId
        self.tempoAtualS = tempoAtualS
        self.melhorAnteriorS = melhorAnteriorS
        self.deltaS = deltaS
        self.resultado = resultado
    }
}

/// Compara tempos atuais com o melhor histórico (best por trecho).
/// Empate dentro de `tolS` (default 0,02 s) entra como `igualou`.
public func compararContraMelhor(
    atuais: [TempoTrecho],
    melhorPorTrecho: [String: Double],
    tolS: Double = 0.02
) -> [DiffTrecho] {
    return atuais.map { a in
        guard let m = melhorPorTrecho[a.trechoId] else {
            return DiffTrecho(
                trechoId: a.trechoId, tempoAtualS: a.tempoS,
                melhorAnteriorS: nil, deltaS: 0, resultado: .novo
            )
        }
        let delta = a.tempoS - m
        let resultado: ResultadoTrecho
        if abs(delta) <= tolS {
            resultado = .igualou
        } else if delta < 0 {
            resultado = .melhorou
        } else {
            resultado = .regrediu
        }
        return DiffTrecho(
            trechoId: a.trechoId, tempoAtualS: a.tempoS,
            melhorAnteriorS: m, deltaS: delta, resultado: resultado
        )
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Plano pro próximo stint
// ─────────────────────────────────────────────────────────────

public struct ItemPlano: Sendable, Equatable, Codable {
    public let trechoId: String
    public let acao: String       // descrição curta da ação sugerida
    public let prioridade: Int    // 1 = maior

    public init(trechoId: String, acao: String, prioridade: Int) {
        self.trechoId = trechoId
        self.acao = acao
        self.prioridade = prioridade
    }
}

/// Monta o plano pro próximo stint a partir das oportunidades + os
/// trechos que regrediram. Junta as duas listas, ordena por gravidade
/// e limita ao `topN`.
public func planoProximoStint(
    oportunidades: [OportunidadeMotor],
    regressoes: [DiffTrecho],
    topN: Int = 3
) -> [ItemPlano] {
    var itens: [(prioridade: Double, item: ItemPlano)] = []

    for o in oportunidades {
        let acao = sugerirAcao(causa: o.causaProvavel)
        itens.append((
            prioridade: o.deltaAcumuladoMs2,
            item: ItemPlano(trechoId: o.trechoId, acao: acao, prioridade: 0)
        ))
    }
    for r in regressoes where r.resultado == .regrediu {
        itens.append((
            prioridade: r.deltaS * 5,  // 1 s de regressão pesa como 5 m/s² de delta
            item: ItemPlano(trechoId: r.trechoId,
                            acao: "Recuperar tempo no trecho (regredido +\(String(format: "%.2f", r.deltaS)) s).",
                            prioridade: 0)
        ))
    }
    let ordenado = itens.sorted { $0.prioridade > $1.prioridade }
    let top = ordenado.prefix(topN)
    return top.enumerated().map { (idx, par) in
        ItemPlano(trechoId: par.item.trechoId, acao: par.item.acao, prioridade: idx + 1)
    }
}

/// Mapa de causa → frase pro plano. Mantém linguagem simples.
public func sugerirAcao(causa: String) -> String {
    switch causa {
    case "motor_abaixo":         return "Carro caindo de potência — checar vela, filtro e óleo."
    case "marcha_baixa":         return "Sair da curva em marcha 1 acima — manter motor na banda 4.500-6.300 RPM."
    case "pedal_parcial":        return "Pedal até o fundo na saída — confirmação técnica do limite."
    case "cambio_escorregando":  return "Mecânica: checar embreagem e câmbio."
    default:                     return "Estudar trecho com o engenheiro."
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Resumo do debrief
// ─────────────────────────────────────────────────────────────

public struct ResumoDebrief: Sendable, Equatable, Codable {
    public let stintId: String
    public let tempoTotalS: Double
    public let tempoMelhorAnteriorS: Double?
    public let deltaTotalS: Double
    public let trechosMelhoraram: [DiffTrecho]
    public let trechosRegrediram: [DiffTrecho]
    public let trechosIgualaram: [DiffTrecho]
    public let topOportunidades: [OportunidadeMotor]
    public let plano: [ItemPlano]
    public let pendenciasSugeridas: [PendenciaSugerida]

    public init(stintId: String, tempoTotalS: Double, tempoMelhorAnteriorS: Double?,
                deltaTotalS: Double, trechosMelhoraram: [DiffTrecho],
                trechosRegrediram: [DiffTrecho], trechosIgualaram: [DiffTrecho],
                topOportunidades: [OportunidadeMotor], plano: [ItemPlano],
                pendenciasSugeridas: [PendenciaSugerida]) {
        self.stintId = stintId
        self.tempoTotalS = tempoTotalS
        self.tempoMelhorAnteriorS = tempoMelhorAnteriorS
        self.deltaTotalS = deltaTotalS
        self.trechosMelhoraram = trechosMelhoraram
        self.trechosRegrediram = trechosRegrediram
        self.trechosIgualaram = trechosIgualaram
        self.topOportunidades = topOportunidades
        self.plano = plano
        self.pendenciasSugeridas = pendenciasSugeridas
    }
}

/// Monta o debrief completo. Recebe tudo por parâmetro pra ficar
/// 100% testável.
public func montarDebrief(
    stintId: String,
    temposAtuais: [TempoTrecho],
    melhorPorTrecho: [String: Double],
    melhorVoltaAnteriorS: Double?,
    oportunidades: [OportunidadeMotor],
    pendenciasSugeridas: [PendenciaSugerida]
) -> ResumoDebrief {
    let diffs = compararContraMelhor(atuais: temposAtuais, melhorPorTrecho: melhorPorTrecho)
    let tempoAtual = temposAtuais.reduce(0) { $0 + $1.tempoS }
    let deltaTotal: Double
    if let m = melhorVoltaAnteriorS {
        deltaTotal = tempoAtual - m
    } else {
        deltaTotal = 0
    }
    let top = topOportunidadesMotor(oportunidades)
    let plano = planoProximoStint(oportunidades: top, regressoes: diffs)
    return ResumoDebrief(
        stintId: stintId,
        tempoTotalS: tempoAtual,
        tempoMelhorAnteriorS: melhorVoltaAnteriorS,
        deltaTotalS: deltaTotal,
        trechosMelhoraram: diffs.filter { $0.resultado == .melhorou },
        trechosRegrediram: diffs.filter { $0.resultado == .regrediu },
        trechosIgualaram: diffs.filter { $0.resultado == .igualou },
        topOportunidades: top,
        plano: plano,
        pendenciasSugeridas: pendenciasSugeridas
    )
}
