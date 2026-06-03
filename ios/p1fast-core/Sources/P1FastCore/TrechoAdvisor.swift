// ═══════════════════════════════════════════════════════════
// TrechoAdvisor — 1 conselho por trecho (Comando GO 2026-05-24)
// ═══════════════════════════════════════════════════════════
// Port Swift de `src/domain/trecho-advisor.js` (regra dura Padrão B).
//
// Recebe execuções de UM trecho na ordem cronológica das voltas e
// devolve UM texto curto comparando a última passagem com a melhor
// observada no mesmo stint. Quando todas as colunas comparáveis
// estão dentro de 0.15 km/h da melhor, considera "melhor passagem
// registrada nesta sessão". Quando só há 1 passagem, devolve
// "primeira passagem registrada".
//
// API espelha o JS pra paridade de testes:
//   TrechoAdvisor.conselho(trechoNome:, execucoes:, voltaNumeroById:)
//
// `voltaNumeroById` é aceito por simetria com a versão da UI, mas a
// V1 não usa o número da volta — futuras versões podem citar "Volta 3
// foi sua melhor; volta 5 perdeu...".

import Foundation

public enum TrechoAdvisor {
    /// Mesmo array ordenado do JS — empata por prioridade descendente.
    private static let indicadores: [(chave: KeyPath<SegmentExecution, Double?>, label: String, causa: String)] = [
        (\SegmentExecution.vminKmh,       "Vmin",           "Velocidade no apex baixa demais."),
        (\SegmentExecution.vPaceKmh,      "Pace",           "Pouca aceleração na saída."),
        (\SegmentExecution.vSaidaPicoKmh, "V saída pico",   "Não puxou tudo na reta seguinte."),
        (\SegmentExecution.vEntradaKmh,   "Entrada",        "Entrou comportado demais — freou antes do necessário."),
        (\SegmentExecution.vFreadaKmh,    "Freada",         "Freou cedo demais."),
        (\SegmentExecution.vChegadaKmh,   "V chegada",      "Reta anterior não foi puxada até o fim."),
    ]

    public static func conselho(
        trechoNome: String,
        execucoes: [SegmentExecution],
        voltaNumeroById: [String: Int] = [:]
    ) -> String? {
        guard !execucoes.isEmpty else { return nil }
        if execucoes.count == 1 {
            return "\(trechoNome): primeira passagem registrada. Sem comparativo."
        }
        let melhor = bestPerIndicator(execucoes)
        guard let ultima = execucoes.last else { return nil }

        var pior: (delta: Double, label: String, causa: String)?
        for ind in indicadores {
            guard let valor = ultima[keyPath: ind.chave], let ref = melhor[ind.chave] else { continue }
            let delta = ref - valor
            if delta <= 0.15 { continue }
            if pior == nil || delta > pior!.delta {
                pior = (delta, ind.label, ind.causa)
            }
        }
        guard let p = pior else {
            return "\(trechoNome): melhor passagem registrada nesta sessão."
        }
        let deltaTxt = String(format: "%.1f", p.delta)
        return "\(trechoNome): \(p.label) \(deltaTxt) km/h abaixo da sua melhor. \(p.causa)"
    }

    private static func bestPerIndicator(_ execucoes: [SegmentExecution]) -> [KeyPath<SegmentExecution, Double?>: Double] {
        var out: [KeyPath<SegmentExecution, Double?>: Double] = [:]
        for ind in indicadores {
            let valores = execucoes.compactMap { $0[keyPath: ind.chave] }
            if let m = valores.max() {
                out[ind.chave] = m
            }
        }
        return out
    }
}
