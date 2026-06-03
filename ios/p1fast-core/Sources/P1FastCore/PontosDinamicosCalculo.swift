// ═══════════════════════════════════════════════════════════
// PontosDinamicosCalculo — V-min/frenagem/PAce por trecho
// ═══════════════════════════════════════════════════════════
// Onda 5 da reformulação Autódromos (Flávio 2026-05-17).
// Calcula os 3 pontos dinâmicos da melhor passagem do trecho POR
// carro+configuração (decisão E1):
//   • V-min     = menor velocidade dentro do trecho
//   • Frenagem  = ponto onde piloto começou a frear (último V-max
//                  antes da queda contínua de velocidade)
//   • PAce      = ponto exato em que o acelerador volta a fundo
//                  ("ponto de aceleração") — primeiro V crescente
//                  contínuo após o V-min do trecho
//
// Mínimo 3 voltas pra ativar cálculo (decisão E2). Antes disso a UI
// mostra mensagem curta "Aguardando mais informações...".
//
// Esta camada é pura (sem GRDB, sem SwiftUI) — recebe `Sample`s já
// fatiados do trecho e devolve `PontosDinamicos`. Quem persiste o
// resultado é a camada iOS (Repository).

import Foundation

/// Resultado do cálculo de pontos dinâmicos para uma passagem do trecho.
public struct PontosDinamicos: Equatable, Sendable {
    public let vminKmh: Double?
    public let vminPos: PontoXY?
    public let frenagemPos: PontoXY?
    public let pacePos: PontoXY?

    public struct PontoXY: Equatable, Sendable {
        public let x: Double
        public let y: Double
        public init(x: Double, y: Double) { self.x = x; self.y = y }
    }

    public init(vminKmh: Double? = nil, vminPos: PontoXY? = nil,
                frenagemPos: PontoXY? = nil, pacePos: PontoXY? = nil) {
        self.vminKmh = vminKmh; self.vminPos = vminPos
        self.frenagemPos = frenagemPos; self.pacePos = pacePos
    }

    public static let vazio = PontosDinamicos()
}

/// Amostra mínima para calcular pontos dinâmicos. Mesmos campos que
/// `Sample` mas reduzida (não exige aceleração etc.). Caller passa
/// fatia do trecho já recortada.
public struct PassagemAmostra: Equatable, Sendable {
    public let t: Double
    public let x: Double
    public let y: Double
    public let speedKmh: Double

    public init(t: Double, x: Double, y: Double, speedKmh: Double) {
        self.t = t; self.x = x; self.y = y; self.speedKmh = speedKmh
    }
}

public enum PontosDinamicosCalculo {
    /// Quantidade mínima de voltas pra ativar o cálculo (decisão E2).
    public static let minVoltasParaCalcular: Int = 3

    /// Calcula os 3 pontos a partir de uma única passagem (já fatiada).
    /// Retorna `.vazio` se a passagem tiver menos de 3 amostras (ruído).
    public static func calcular(passagem: [PassagemAmostra]) -> PontosDinamicos {
        guard passagem.count >= 3 else { return .vazio }

        // V-min = menor velocidade da passagem.
        let idxVmin = passagem.indices.min(by: { passagem[$0].speedKmh < passagem[$1].speedKmh }) ?? 0
        let vmin = passagem[idxVmin]

        // Frenagem = último V-max antes do V-min (queda contínua até o V-min).
        // Heurística: andamos da posição (idxVmin - 1) para trás procurando
        // o pico de velocidade mais próximo (onde começou a desacelerar).
        var idxFrenagem: Int? = nil
        if idxVmin > 0 {
            var melhor = idxVmin - 1
            var velMelhor = passagem[melhor].speedKmh
            for k in stride(from: idxVmin - 1, through: 0, by: -1) {
                let v = passagem[k].speedKmh
                if v > velMelhor {
                    velMelhor = v
                    melhor = k
                } else if v < velMelhor - 1.0 {
                    // queda significativa — antes disso era subida; pico tá aqui.
                    break
                }
            }
            idxFrenagem = melhor
        }

        // PAce = primeiro V crescente contínuo após o V-min (≥ 5 km/h acima
        // do V-min e mantendo subida por pelo menos 2 amostras seguidas).
        var idxPAce: Int? = nil
        if idxVmin < passagem.count - 2 {
            for k in (idxVmin + 1)..<(passagem.count - 1) {
                let v = passagem[k].speedKmh
                let vProx = passagem[k + 1].speedKmh
                if v >= vmin.speedKmh + 5.0 && vProx > v {
                    idxPAce = k
                    break
                }
            }
        }

        return PontosDinamicos(
            vminKmh: vmin.speedKmh,
            vminPos: .init(x: vmin.x, y: vmin.y),
            frenagemPos: idxFrenagem.map { .init(x: passagem[$0].x, y: passagem[$0].y) },
            pacePos: idxPAce.map { .init(x: passagem[$0].x, y: passagem[$0].y) }
        )
    }
}
