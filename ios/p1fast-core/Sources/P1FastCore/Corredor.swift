// ═══════════════════════════════════════════════════════════
// Corredor — Traçado consolidado + corredor de tolerância (C1)
// ═══════════════════════════════════════════════════════════
// Port direto de src/telemetry/corredor.js (paridade 2026-05-04).
//
// Decisão de domínio 2026-04-23: match de SegmentExecution × TrackSegment
// NÃO usa % de sobreposição nem offset médio. Usa:
//   1. Traçado consolidado (média ponderada das últimas M voltas válidas + variância)
//   2. Corredor de tolerância (σ configurável por carro + pista)
//
// Se o sample sai do corredor → desvio/anomalia, NÃO cria novo match.
// Zebras, buracos, sobressaltos verticais NÃO são "suspeitos" — são pista.

import Foundation

public enum CorredorConfig {
    public static let lapsConsolidadasDefault: Int = 20
    public static let sigmaDefault: Double = 2.0
    public static let minPontos: Int = 5
}

/// Sample puro pra consolidar traçado — t (epoch/relativo) + x/y (pista local).
/// `tN` é o tempo normalizado na volta (0..1). Em `interpolarPorTN` usamos `t`.
public struct CorredorSample: Equatable, Sendable {
    public let t: Double
    public let x: Double
    public let y: Double
    public let tN: Double?

    public init(t: Double, x: Double, y: Double, tN: Double? = nil) {
        self.t = t; self.x = x; self.y = y; self.tN = tN
    }
}

public struct ConsolidadoPonto: Equatable, Sendable {
    public let tN: Double
    public let x: Double
    public let y: Double
    public let varX: Double
    public let varY: Double
    public let desvPad: Double
}

public struct Consolidado: Equatable, Sendable {
    public let pontos: [ConsolidadoPonto]
    public let nVoltas: Int

    public init(pontos: [ConsolidadoPonto], nVoltas: Int) {
        self.pontos = pontos
        self.nVoltas = nVoltas
    }
}

public struct DentroCorredorResult: Equatable, Sendable {
    public let dentro: Bool
    public let distancia: Double
    public let sigma: Double
    public let raio: Double
}

public enum CorredorMatch: Equatable, Sendable {
    case match(pct: Double, trechoId: String)
    case naoMatch(razao: String, pct: Double?)
}

public enum Corredor {
    /// Calcula traçado consolidado a partir de samples de múltiplas voltas.
    /// Cada volta deve ter samples ordenados por `t` (não por `tN`).
    /// `resolucao` define quantos pontos (default 200, igual JS).
    public static func consolidarTracado(
        voltasSamples: [[CorredorSample]],
        resolucao: Int = 200
    ) -> Consolidado {
        let voltas = voltasSamples.filter { $0.count >= CorredorConfig.minPontos }
        guard !voltas.isEmpty else { return Consolidado(pontos: [], nVoltas: 0) }
        guard resolucao >= 2 else { return Consolidado(pontos: [], nVoltas: voltas.count) }

        var pontos: [ConsolidadoPonto] = []
        pontos.reserveCapacity(resolucao)

        for i in 0..<resolucao {
            let tN = Double(i) / Double(resolucao - 1)
            var sx = 0.0, sy = 0.0
            var xs: [Double] = [], ys: [Double] = []
            for volta in voltas {
                guard let s = interpolarPorTN(samples: volta, tN: tN) else { continue }
                xs.append(s.x); ys.append(s.y)
                sx += s.x; sy += s.y
            }
            let n = xs.count
            if n == 0 { continue }
            let mx = sx / Double(n)
            let my = sy / Double(n)
            var vx = 0.0, vy = 0.0
            for k in 0..<n {
                vx += (xs[k] - mx) * (xs[k] - mx)
                vy += (ys[k] - my) * (ys[k] - my)
            }
            vx /= Double(n)
            vy /= Double(n)
            let desvPad = (vx + vy).squareRoot()
            pontos.append(ConsolidadoPonto(tN: tN, x: mx, y: my, varX: vx, varY: vy, desvPad: desvPad))
        }

        return Consolidado(pontos: pontos, nVoltas: voltas.count)
    }

    /// Interpola posição de uma volta no `tN` normalizado 0..1.
    /// Renormaliza usando t[0]=0 e t[last]=1.
    static func interpolarPorTN(samples: [CorredorSample], tN: Double) -> (x: Double, y: Double, tN: Double)? {
        guard samples.count >= 2 else { return nil }
        let t0 = samples[0].t
        let t1 = samples[samples.count - 1].t
        let total = t1 - t0
        guard total > 0 else { return nil }
        let alvoT = t0 + tN * total
        for i in 0..<(samples.count - 1) {
            let a = samples[i]
            let b = samples[i + 1]
            if a.t <= alvoT && b.t >= alvoT {
                let denom = (b.t - a.t) == 0 ? 1.0 : (b.t - a.t)
                let f = (alvoT - a.t) / denom
                return (x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tN: tN)
            }
        }
        let last = samples[samples.count - 1]
        return (x: last.x, y: last.y, tN: tN)
    }

    /// Verifica se um ponto {x,y} no instante tN está DENTRO do corredor
    /// do traçado consolidado.
    public static func dentroCorredor(
        ponto: CorredorSample,
        consolidado: Consolidado,
        sigma: Double = CorredorConfig.sigmaDefault
    ) -> DentroCorredorResult {
        guard !consolidado.pontos.isEmpty else {
            return DentroCorredorResult(dentro: true, distancia: 0, sigma: 0, raio: 0)
        }
        guard let centro = nearestByTN(pontos: consolidado.pontos, tN: ponto.tN ?? 0) else {
            return DentroCorredorResult(dentro: true, distancia: 0, sigma: 0, raio: 0)
        }
        let dx = ponto.x - centro.x
        let dy = ponto.y - centro.y
        let distancia = (dx * dx + dy * dy).squareRoot()
        // JS: Math.max(5, (centro.desvPad || 1) * sigma) — desvPad=0 cai pra 1
        let baseDesvPad = centro.desvPad == 0 ? 1.0 : centro.desvPad
        let raio = Swift.max(5.0, baseDesvPad * sigma)
        return DentroCorredorResult(dentro: distancia <= raio, distancia: distancia, sigma: sigma, raio: raio)
    }

    static func nearestByTN(pontos: [ConsolidadoPonto], tN: Double) -> ConsolidadoPonto? {
        var best: ConsolidadoPonto?
        var bestD = Double.infinity
        for p in pontos {
            let d = abs(p.tN - tN)
            if d < bestD { bestD = d; best = p }
        }
        return best
    }

    /// Match SegmentExecution × TrackSegment via corredor consolidado.
    /// Se ≥ pctMinimo dos samples cabem no corredor → match.
    /// Senão → não-match (NÃO cria novo match — decisão de domínio 2026-04-23).
    public static func matchSegmento(
        execSamples: [CorredorSample],
        trechoId: String?,
        consolidado: Consolidado,
        sigma: Double = CorredorConfig.sigmaDefault,
        pctMinimo: Double = 0.7
    ) -> CorredorMatch {
        guard !execSamples.isEmpty,
              let trechoId,
              !consolidado.pontos.isEmpty
        else {
            return .naoMatch(razao: "inputs-invalidos", pct: nil)
        }
        var dentro = 0
        for s in execSamples {
            if dentroCorredor(ponto: s, consolidado: consolidado, sigma: sigma).dentro {
                dentro += 1
            }
        }
        let pct = Double(dentro) / Double(execSamples.count)
        if pct >= pctMinimo {
            return .match(pct: pct, trechoId: trechoId)
        }
        return .naoMatch(razao: "fora-do-corredor", pct: pct)
    }
}
