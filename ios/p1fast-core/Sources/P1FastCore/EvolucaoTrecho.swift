// ═══════════════════════════════════════════════════════════
// EvolucaoTrecho — Bloco 6 do Plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Linha do tempo dos últimos N eventos por trecho, pra a tela
// "Sua evolução" no painel do carro. Cada ponto carrega tempo,
// melhor da sessão e evento de origem.

import Foundation

public struct PontoEvolucao: Sendable, Equatable, Codable {
    public let eventoId: String
    public let dataIso: String
    public let tempoMelhorS: Double

    public init(eventoId: String, dataIso: String, tempoMelhorS: Double) {
        self.eventoId = eventoId
        self.dataIso = dataIso
        self.tempoMelhorS = tempoMelhorS
    }
}

public struct LinhaEvolucao: Sendable, Equatable, Codable {
    public let trechoId: String
    public let pontos: [PontoEvolucao]      // ordem cronológica
    public let melhorAbsolutoS: Double      // menor tempoMelhorS da janela
    public let ultimoS: Double              // tempoMelhorS do último ponto
    public let tendencia: String            // "melhorando" | "regredindo" | "estavel"

    public init(trechoId: String, pontos: [PontoEvolucao],
                melhorAbsolutoS: Double, ultimoS: Double, tendencia: String) {
        self.trechoId = trechoId
        self.pontos = pontos
        self.melhorAbsolutoS = melhorAbsolutoS
        self.ultimoS = ultimoS
        self.tendencia = tendencia
    }
}

/// Monta linha do tempo dos últimos `janela` eventos pra um trecho.
/// Tendência: olha os últimos 3 pontos — se 2 ou mais melhoraram em
/// relação ao anterior, "melhorando"; se 2 ou mais regrediram,
/// "regredindo"; caso contrário "estavel".
public func montarLinhaEvolucao(
    trechoId: String,
    historico: [PontoEvolucao],
    janela: Int = 5
) -> LinhaEvolucao? {
    guard !historico.isEmpty else { return nil }
    let ordenado = historico.sorted { $0.dataIso < $1.dataIso }
    let pontos = Array(ordenado.suffix(janela))

    let melhor = pontos.map { $0.tempoMelhorS }.min() ?? 0
    let ultimo = pontos.last!.tempoMelhorS

    var tendencia = "estavel"
    if pontos.count >= 3 {
        let ultimos = Array(pontos.suffix(3))
        var melhorias = 0
        var regressoes = 0
        for i in 1..<ultimos.count {
            if ultimos[i].tempoMelhorS < ultimos[i - 1].tempoMelhorS - 0.05 {
                melhorias += 1
            } else if ultimos[i].tempoMelhorS > ultimos[i - 1].tempoMelhorS + 0.05 {
                regressoes += 1
            }
        }
        if melhorias >= 2 { tendencia = "melhorando" }
        else if regressoes >= 2 { tendencia = "regredindo" }
    }

    return LinhaEvolucao(
        trechoId: trechoId,
        pontos: pontos,
        melhorAbsolutoS: melhor,
        ultimoS: ultimo,
        tendencia: tendencia
    )
}

// ─────────────────────────────────────────────────────────────
// MARK: - Estoque para sugestões
// ─────────────────────────────────────────────────────────────

public struct DisponibilidadeEstoque: Sendable, Equatable, Codable {
    public let item: String        // "vela", "filtro de ar", "óleo motor", ...
    public let quantidade: Int     // unidades disponíveis no estoque
    public let localPrincipal: String?

    public init(item: String, quantidade: Int, localPrincipal: String?) {
        self.item = item
        self.quantidade = quantidade
        self.localPrincipal = localPrincipal
    }
}

/// Cruza uma pendência sugerida com o estoque atual. Devolve uma
/// nota humana — "tem 4 velas no Box", "sem vela em estoque" — pra
/// renderizar como badge ao lado da sugestão na tela do Debrief.
public func badgeEstoqueParaPendencia(
    pendencia: PendenciaSugerida,
    estoque: [DisponibilidadeEstoque]
) -> String {
    // Heurística: procura no estoque a primeira palavra-chave conhecida
    // mencionada na descrição da pendência.
    let keywords = ["vela", "filtro", "óleo", "pneu", "embreagem"]
    let descLower = pendencia.descricao.lowercased()
    for k in keywords {
        if descLower.contains(k) {
            if let item = estoque.first(where: { $0.item.lowercased().contains(k) }) {
                if item.quantidade > 0 {
                    let onde = item.localPrincipal ?? "estoque"
                    return "\(item.quantidade) \(item.item) em \(onde)"
                } else {
                    return "Sem \(item.item) em estoque"
                }
            } else {
                return "Sem \(k) no cadastro de estoque"
            }
        }
    }
    return "Sem item correspondente no estoque"
}
