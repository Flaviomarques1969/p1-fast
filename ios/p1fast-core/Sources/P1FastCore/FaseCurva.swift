// ═══════════════════════════════════════════════════════════
// FaseCurva — port Swift de src/telemetry/fase-curva.js
// ═══════════════════════════════════════════════════════════
// Dada uma sequência densa de samples (t/kmh/accLong/accLat),
// classifica em 3 fases: INICIO (entrada/frenagem), MEIO
// (apoio/apex), FIM (saída/retomada).
//
// Método híbrido espelhado do JS:
//   • com accLong → cortes nos pontos onde accLong cruza
//     LIMIAR_FREIO_G (-0.35g) e LIMIAR_ACEL_G (+0.25g)
//   • sem accLong → fallback 1/3 1/3 1/3 por tempo
//
// API close-to-JS. `Result.total` é um Block sintético construído
// a partir de todas as samples — divergência intencional do JS,
// que faz spread de stats. Em Swift mantém simetria.

import Foundation

public enum Fase: String, Codable, Sendable {
    case inicio
    case meio
    case fim
}

public enum FaseCurva {

    public static let limiarFreioG: Double = -0.35
    public static let limiarAcelG:  Double = +0.25
    /// Não usado no algoritmo — mantido por paridade com a constante do JS.
    public static let estavelG:     Double = 0.15

    public struct InputSample: Codable, Sendable {
        public let t: Double
        public let kmh: Double?
        public let accLong: Double?
        public let accLat: Double?
        public init(t: Double, kmh: Double? = nil, accLong: Double? = nil, accLat: Double? = nil) {
            self.t = t
            self.kmh = kmh
            self.accLong = accLong
            self.accLat = accLat
        }
    }

    public struct Stats: Codable, Sendable {
        public let velEntrada: Double?
        public let velSaida: Double?
        public let velMinima: Double?
        public let velMaxima: Double?
        public let accLongPeak: Double?   // assinado (preserva sinal do pico em magnitude)
        public let accLatPeak: Double?    // assinado
        public let apexT: Double?
        public let apexIdx: Int?
        public let apexKmh: Double?
    }

    public struct Block: Codable, Sendable {
        public let samples: [InputSample]
        public let stats: Stats
        public let duracaoMs: Double
    }

    public enum Metodo: String, Codable, Sendable {
        case sinais
        case fallback33 = "fallback-33"
    }

    public struct Result: Codable, Sendable {
        public let inicio: Block
        public let meio: Block
        public let fim: Block
        public let total: Block
        public let metodo: Metodo
    }

    /// Espelha `classificarFases(samples)` do JS.
    /// Retorna `nil` se `samples` estiver vazio.
    public static func classificar(_ samples: [InputSample]) -> Result? {
        guard !samples.isEmpty else { return nil }
        guard let cortes = detectarCortes(samples) else { return nil }

        let inicio = samples.filter { $0.t <= cortes.c1 }
        let meio   = samples.filter { $0.t >  cortes.c1 && $0.t <= cortes.c2 }
        let fim    = samples.filter { $0.t >  cortes.c2 }

        let temAcc = samples.contains { $0.accLong != nil }
        return Result(
            inicio: makeBlock(inicio),
            meio:   makeBlock(meio),
            fim:    makeBlock(fim),
            total:  makeBlock(samples),
            metodo: temAcc ? .sinais : .fallback33
        )
    }

    // ── internos ──

    private struct Cortes { let c1: Double; let c2: Double }

    private static func detectarCortes(_ samples: [InputSample]) -> Cortes? {
        let temAcc = samples.contains { $0.accLong != nil }
        guard let fb = fallbackPorTempo(samples) else { return nil }

        if !temAcc { return fb }

        var c1: Double? = nil
        var c2: Double? = nil
        for s in samples {
            if c1 == nil, let a = s.accLong, a > limiarFreioG {
                c1 = s.t
            }
            if c1 != nil, c2 == nil, let a = s.accLong, a > limiarAcelG {
                c2 = s.t
            }
        }
        return Cortes(c1: c1 ?? fb.c1, c2: c2 ?? fb.c2)
    }

    private static func fallbackPorTempo(_ samples: [InputSample]) -> Cortes? {
        guard let first = samples.first, let last = samples.last else { return nil }
        let total = last.t - first.t
        return Cortes(c1: first.t + total / 3.0, c2: first.t + 2.0 * total / 3.0)
    }

    private static func makeBlock(_ samples: [InputSample]) -> Block {
        let s = stats(samples)
        let dur: Double
        if let first = samples.first, let last = samples.last {
            dur = last.t - first.t
        } else {
            dur = 0
        }
        return Block(samples: samples, stats: s, duracaoMs: dur)
    }

    private static func stats(_ samples: [InputSample]) -> Stats {
        var velMin =  Double.infinity
        var velMax = -Double.infinity
        var accLongPeak: Double = 0
        var accLatPeak:  Double = 0
        var apexIdx: Int? = nil
        var apexT:   Double? = nil
        var apexKmh: Double? = nil

        for (i, s) in samples.enumerated() {
            if let k = s.kmh {
                if k < velMin {
                    velMin = k
                    apexIdx = i
                    apexT = s.t
                    apexKmh = k
                }
                if k > velMax { velMax = k }
            }
            if let a = s.accLong, abs(a) > abs(accLongPeak) { accLongPeak = a }
            if let a = s.accLat,  abs(a) > abs(accLatPeak)  { accLatPeak  = a }
        }

        return Stats(
            velEntrada: samples.first?.kmh,
            velSaida:   samples.last?.kmh,
            velMinima:  velMin.isFinite ? velMin : nil,
            velMaxima:  velMax.isFinite ? velMax : nil,
            accLongPeak: accLongPeak == 0 ? nil : accLongPeak,
            accLatPeak:  accLatPeak  == 0 ? nil : accLatPeak,
            apexT: apexT,
            apexIdx: apexIdx,
            apexKmh: apexKmh
        )
    }
}
