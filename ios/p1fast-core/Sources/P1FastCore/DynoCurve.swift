// ═══════════════════════════════════════════════════════════
// DynoCurve — curva consultável do motor (Bloco 2)
// 2026-05-18 — Plano Piloto + Engenheiro.
// ═══════════════════════════════════════════════════════════
// Estrutura amigável pra consulta da curva de dinamômetro: dado um RPM,
// devolve torque (N·m) e potência (HP) interpolando linearmente entre
// amostras vizinhas. Picos de torque e potência são identificados na
// carga e ficam disponíveis como atalhos.
//
// É a fonte oficial usada por:
//   • `aceleracaoTeorica(...)` (mesmo Bloco 2) pra calcular quanto o
//     carro deveria estar acelerando em cada instante.
//   • Bloco 3 (Edge Function trecho-analisar) — port TS espelhado.
//   • Bloco 5 (Command Box · Visão Engenheiro · aba Motor) — pra desenhar
//     histograma de tempo por faixa de RPM com banda ideal sobreposta.
//
// Existe outra struct `DynoPoint` em `ShiftTarget.swift` carregando só
// `{ rpm, power_kw }`. É o formato bruto usado pelo `DynoCsvParser` e
// pelo shift-light. O `DynoCurve` aqui é uma camada por cima, com mais
// informação (torque calculado, picos pré-resolvidos). O adapter
// `ParsedDynoCurve.asDynoCurve(label:)` faz a ponte (P_kW → T_Nm).

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - DynoSample
// ─────────────────────────────────────────────────────────────

/// Uma amostra da curva de dinamômetro com torque (N·m) e potência (HP)
/// já calculados. As 3 grandezas se relacionam por
/// `P_kW = T_Nm × RPM / 9549` e `P_HP = P_kW / 0,7457`.
public struct DynoSample: Sendable, Equatable, Codable {
    public let rpm: Double
    public let torqueNm: Double
    public let powerHp: Double

    public init(rpm: Double, torqueNm: Double, powerHp: Double) {
        self.rpm = rpm
        self.torqueNm = torqueNm
        self.powerHp = powerHp
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - DynoCurve
// ─────────────────────────────────────────────────────────────

/// Curva consultável do motor. As amostras ficam ordenadas por RPM
/// crescente na construção. Pra valores entre amostras vizinhas usa
/// interpolação linear; pra valores fora dos extremos faz clamp.
public struct DynoCurve: Sendable, Equatable, Codable {
    public let label: String
    public let samples: [DynoSample]

    public init(label: String, samples: [DynoSample]) {
        self.label = label
        self.samples = samples.sorted { $0.rpm < $1.rpm }
    }

    /// Torque (N·m) interpolado linearmente em `rpm`. Clamp nos extremos.
    /// Retorna 0 se a curva estiver vazia.
    public func torqueAt(rpm: Double) -> Double {
        guard let first = samples.first, let last = samples.last else { return 0 }
        if rpm <= first.rpm { return first.torqueNm }
        if rpm >= last.rpm { return last.torqueNm }
        for i in 0..<(samples.count - 1) {
            let a = samples[i]
            let b = samples[i + 1]
            if rpm >= a.rpm && rpm <= b.rpm {
                let denom = b.rpm - a.rpm
                if denom == 0 { return a.torqueNm }
                let t = (rpm - a.rpm) / denom
                return a.torqueNm + t * (b.torqueNm - a.torqueNm)
            }
        }
        return last.torqueNm
    }

    /// Potência (HP) interpolada linearmente em `rpm`. Clamp nos extremos.
    /// Retorna 0 se a curva estiver vazia.
    public func powerHpAt(rpm: Double) -> Double {
        guard let first = samples.first, let last = samples.last else { return 0 }
        if rpm <= first.rpm { return first.powerHp }
        if rpm >= last.rpm { return last.powerHp }
        for i in 0..<(samples.count - 1) {
            let a = samples[i]
            let b = samples[i + 1]
            if rpm >= a.rpm && rpm <= b.rpm {
                let denom = b.rpm - a.rpm
                if denom == 0 { return a.powerHp }
                let t = (rpm - a.rpm) / denom
                return a.powerHp + t * (b.powerHp - a.powerHp)
            }
        }
        return last.powerHp
    }

    /// Amostra com maior torqueNm. Retorna nil se curva vazia.
    public var peakTorque: DynoSample? {
        samples.max(by: { $0.torqueNm < $1.torqueNm })
    }

    /// Amostra com maior powerHp. Retorna nil se curva vazia.
    public var peakPower: DynoSample? {
        samples.max(by: { $0.powerHp < $1.powerHp })
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Adapter ParsedDynoCurve → DynoCurve
// ─────────────────────────────────────────────────────────────

extension ParsedDynoCurve {
    /// Converte uma curva crua (`ParsedDynoCurve` com `points: [DynoPoint]`)
    /// numa `DynoCurve` calculando torque (N·m) a partir de potência (kW)
    /// e RPM via `T = P_kW × 9549 / RPM`. Potência (HP) sai de
    /// `P_HP = P_kW / 0,7457`.
    ///
    /// Pontos com RPM ≤ 0 são descartados (não dá pra dividir por zero).
    public func asDynoCurve(label: String) -> DynoCurve {
        let samples: [DynoSample] = points.compactMap { p in
            guard p.rpm > 0 else { return nil }
            let torqueNm = p.powerKw * 9549.0 / p.rpm
            let powerHp = p.powerKw / DynoCsvParser.hpToKw
            return DynoSample(rpm: p.rpm, torqueNm: torqueNm, powerHp: powerHp)
        }
        return DynoCurve(label: label, samples: samples)
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Constante Celta Bubi (registro oficial 2026-05-18)
// ─────────────────────────────────────────────────────────────

extension DynoCurve {
    /// Curva oficial do Celta Bubi medida em 2026-05-18 (motor Onix 1.4
    /// + câmbio Celta 1.0). 79 pontos, RPM 2500 → 6400 a cada 50 RPM.
    /// Valores corrigidos SAE J1349. Pico de potência 122,8 HP @ 6050 RPM,
    /// pico de torque 162,1 N·m @ 5200 RPM. Faixa ótima de pista
    /// 4.500–6.300 RPM. **Não passar de 6.350 RPM** (queda abrupta).
    ///
    /// Fonte canônica: `docs/dyno/CELTA_BUBI_MARQUES_DYNO_2026-05-18.md`.
    public static let celtaBubi2026_05_18: DynoCurve = DynoCurve(
        label: "Celta Bubi 2026-05-18 (motor Onix 1.4 + câmbio Celta 1.0)",
        samples: [
            DynoSample(rpm: 2500, torqueNm: -2.2, powerHp: -0.8),
            DynoSample(rpm: 2550, torqueNm: 112.5, powerHp: 40.3),
            DynoSample(rpm: 2600, torqueNm: 143.9, powerHp: 52.5),
            DynoSample(rpm: 2650, torqueNm: 156.3, powerHp: 58.2),
            DynoSample(rpm: 2700, torqueNm: 159.1, powerHp: 60.3),
            DynoSample(rpm: 2750, torqueNm: 159.1, powerHp: 61.5),
            DynoSample(rpm: 2800, torqueNm: 159.7, powerHp: 62.8),
            DynoSample(rpm: 2850, torqueNm: 160.3, powerHp: 64.2),
            DynoSample(rpm: 2900, torqueNm: 160.6, powerHp: 65.4),
            DynoSample(rpm: 2950, torqueNm: 160.3, powerHp: 66.4),
            DynoSample(rpm: 3000, torqueNm: 159.2, powerHp: 67.1),
            DynoSample(rpm: 3050, torqueNm: 158.5, powerHp: 67.9),
            DynoSample(rpm: 3100, torqueNm: 158.1, powerHp: 68.8),
            DynoSample(rpm: 3150, torqueNm: 158.2, powerHp: 70.0),
            DynoSample(rpm: 3200, torqueNm: 158.2, powerHp: 71.1),
            DynoSample(rpm: 3250, torqueNm: 158.7, powerHp: 72.4),
            DynoSample(rpm: 3300, torqueNm: 159.6, powerHp: 74.0),
            DynoSample(rpm: 3350, torqueNm: 160.2, powerHp: 75.4),
            DynoSample(rpm: 3400, torqueNm: 160.1, powerHp: 76.4),
            DynoSample(rpm: 3450, torqueNm: 159.0, powerHp: 77.0),
            DynoSample(rpm: 3500, torqueNm: 157.9, powerHp: 77.6),
            DynoSample(rpm: 3550, torqueNm: 157.4, powerHp: 78.5),
            DynoSample(rpm: 3600, torqueNm: 157.5, powerHp: 79.7),
            DynoSample(rpm: 3650, torqueNm: 157.9, powerHp: 81.0),
            DynoSample(rpm: 3700, torqueNm: 158.5, powerHp: 82.4),
            DynoSample(rpm: 3750, torqueNm: 158.9, powerHp: 83.7),
            DynoSample(rpm: 3800, torqueNm: 159.4, powerHp: 85.1),
            DynoSample(rpm: 3850, torqueNm: 159.7, powerHp: 86.4),
            DynoSample(rpm: 3900, torqueNm: 160.0, powerHp: 87.7),
            DynoSample(rpm: 3950, torqueNm: 160.2, powerHp: 88.9),
            DynoSample(rpm: 4000, torqueNm: 160.2, powerHp: 90.0),
            DynoSample(rpm: 4050, torqueNm: 160.3, powerHp: 91.2),
            DynoSample(rpm: 4100, torqueNm: 160.4, powerHp: 92.3),
            DynoSample(rpm: 4150, torqueNm: 160.5, powerHp: 93.4),
            DynoSample(rpm: 4200, torqueNm: 160.5, powerHp: 94.5),
            DynoSample(rpm: 4250, torqueNm: 160.4, powerHp: 95.5),
            DynoSample(rpm: 4300, torqueNm: 160.0, powerHp: 96.5),
            DynoSample(rpm: 4350, torqueNm: 159.7, powerHp: 97.4),
            DynoSample(rpm: 4400, torqueNm: 159.3, powerHp: 98.4),
            DynoSample(rpm: 4450, torqueNm: 158.9, powerHp: 99.2),
            DynoSample(rpm: 4500, torqueNm: 158.6, powerHp: 99.9),
            DynoSample(rpm: 4550, torqueNm: 158.2, powerHp: 100.7),
            DynoSample(rpm: 4600, torqueNm: 158.0, powerHp: 101.6),
            DynoSample(rpm: 4650, torqueNm: 158.0, powerHp: 102.7),
            DynoSample(rpm: 4700, torqueNm: 158.1, powerHp: 103.8),
            DynoSample(rpm: 4750, torqueNm: 158.1, powerHp: 104.8),
            DynoSample(rpm: 4800, torqueNm: 158.0, powerHp: 105.8),
            DynoSample(rpm: 4850, torqueNm: 158.1, powerHp: 106.9),
            DynoSample(rpm: 4900, torqueNm: 158.2, powerHp: 108.0),
            DynoSample(rpm: 4950, torqueNm: 159.7, powerHp: 110.0),
            DynoSample(rpm: 5000, torqueNm: 160.9, powerHp: 112.4),
            DynoSample(rpm: 5050, torqueNm: 161.2, powerHp: 114.1),
            DynoSample(rpm: 5100, torqueNm: 161.7, powerHp: 115.7),
            DynoSample(rpm: 5150, torqueNm: 161.3, powerHp: 116.5),
            DynoSample(rpm: 5200, torqueNm: 162.1, powerHp: 117.8),
            DynoSample(rpm: 5250, torqueNm: 160.5, powerHp: 118.0),
            DynoSample(rpm: 5300, torqueNm: 160.0, powerHp: 118.9),
            DynoSample(rpm: 5350, torqueNm: 159.0, powerHp: 119.4),
            DynoSample(rpm: 5400, torqueNm: 157.8, powerHp: 119.5),
            DynoSample(rpm: 5450, torqueNm: 157.0, powerHp: 120.0),
            DynoSample(rpm: 5500, torqueNm: 156.1, powerHp: 120.4),
            DynoSample(rpm: 5550, torqueNm: 154.8, powerHp: 120.5),
            DynoSample(rpm: 5600, torqueNm: 153.6, powerHp: 120.6),
            DynoSample(rpm: 5650, torqueNm: 152.9, powerHp: 121.2),
            DynoSample(rpm: 5700, torqueNm: 152.1, powerHp: 121.6),
            DynoSample(rpm: 5750, torqueNm: 150.8, powerHp: 121.6),
            DynoSample(rpm: 5800, torqueNm: 149.7, powerHp: 121.8),
            DynoSample(rpm: 5850, torqueNm: 148.6, powerHp: 122.0),
            DynoSample(rpm: 5900, torqueNm: 147.5, powerHp: 122.2),
            DynoSample(rpm: 5950, torqueNm: 146.4, powerHp: 122.3),
            DynoSample(rpm: 6000, torqueNm: 145.6, powerHp: 122.7),
            DynoSample(rpm: 6050, torqueNm: 144.5, powerHp: 122.8),
            DynoSample(rpm: 6100, torqueNm: 142.1, powerHp: 121.7),
            DynoSample(rpm: 6150, torqueNm: 138.5, powerHp: 119.7),
            DynoSample(rpm: 6200, torqueNm: 136.3, powerHp: 118.7),
            DynoSample(rpm: 6250, torqueNm: 135.2, powerHp: 118.7),
            DynoSample(rpm: 6300, torqueNm: 130.1, powerHp: 115.1),
            DynoSample(rpm: 6350, torqueNm: 114.4, powerHp: 102.0),
            DynoSample(rpm: 6400, torqueNm: 78.7, powerHp: 70.8),
        ]
    )
}
