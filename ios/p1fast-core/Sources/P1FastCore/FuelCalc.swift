// ═══════════════════════════════════════════════════════════
// FuelCalc — port Swift de src/domain/fuel-calc.js
// ═══════════════════════════════════════════════════════════
// Piloto vê combustível em VOLTAS (não em litros) — decisão Flavio
// 2026-04-23. Retorna também litros restantes e % do tanque.
//
// Decisão Swift: dois enums separados para Disponivel + Razao em vez
// do hack "disponivel: true | false | 'parcial'" do JS. Mantém os
// mesmos 3 estados, sem perder type-safety.

import Foundation

public enum FuelCalc {

    public enum Disponivel: String, Codable, Sendable {
        case sim
        case parcial
        case nao
    }

    public struct Env: Sendable {
        public let tanqueLitros: Double?
        public let combustivelInicialL: Double?
        public let consumoMedioLVolta: Double?
        public init(tanqueLitros: Double? = nil,
                    combustivelInicialL: Double? = nil,
                    consumoMedioLVolta: Double? = nil) {
            self.tanqueLitros = tanqueLitros
            self.combustivelInicialL = combustivelInicialL
            self.consumoMedioLVolta = consumoMedioLVolta
        }
    }

    public struct Result: Sendable {
        public let disponivel: Disponivel
        public let razao: String?
        public let combustivelInicialL: Double?
        public let tanqueLitros: Double?
        public let consumoMedioLVolta: Double?
        public let consumidoL: Double?
        public let restanteL: Double?
        public let voltasRestantes: Int?
        public let pctTanque: Int?
        public let label: String?
    }

    public static func calcular(env: Env, voltasAndadas: Int = 0) -> Result {
        guard let inicial = env.combustivelInicialL else {
            return Result(disponivel: .nao, razao: "sem-combustivel-inicial",
                          combustivelInicialL: nil, tanqueLitros: env.tanqueLitros,
                          consumoMedioLVolta: nil, consumidoL: nil, restanteL: nil,
                          voltasRestantes: nil, pctTanque: nil, label: nil)
        }
        guard let consumo = env.consumoMedioLVolta, consumo > 0 else {
            let pct: Int? = (env.tanqueLitros ?? 0) > 0
                ? Int((inicial / env.tanqueLitros!) * 100 + 0.5)
                : nil
            return Result(disponivel: .parcial, razao: "sem-consumo-medio",
                          combustivelInicialL: inicial, tanqueLitros: env.tanqueLitros,
                          consumoMedioLVolta: nil, consumidoL: nil, restanteL: nil,
                          voltasRestantes: nil, pctTanque: pct, label: nil)
        }

        let consumidoL = consumo * Double(voltasAndadas)
        let restanteL = max(0, inicial - consumidoL)
        let voltasRestantes = Int((restanteL / consumo).rounded(.down))
        let pctTanque: Int? = (env.tanqueLitros ?? 0) > 0
            ? Int((restanteL / env.tanqueLitros!) * 100 + 0.5)
            : nil

        return Result(
            disponivel: .sim,
            razao: nil,
            combustivelInicialL: inicial,
            tanqueLitros: env.tanqueLitros,
            consumoMedioLVolta: consumo,
            consumidoL: round(consumidoL * 100) / 100,
            restanteL: round(restanteL * 100) / 100,
            voltasRestantes: voltasRestantes,
            pctTanque: pctTanque,
            label: "\(voltasRestantes)v"
        )
    }

    // ── Progresso do stint ──

    public struct LapInfo: Sendable {
        public let valida: Bool
        public let tempoMs: Double?
        public init(valida: Bool, tempoMs: Double? = nil) {
            self.valida = valida; self.tempoMs = tempoMs
        }
    }

    public struct StintPlan: Sendable {
        public let nVoltasAlvo: Int?
        public init(nVoltasAlvo: Int? = nil) { self.nVoltasAlvo = nVoltasAlvo }
    }

    public struct ProgressoStint: Sendable {
        public let voltasFeitas: Int
        public let voltasAlvo: Int?
        public let voltasRestantes: Int?
        public let pctCompleto: Int?
        public let ritmoMedioMs: Int?
        public let melhorMs: Double?
        public let deltaStintMs: Int?
        public let validas: Int
    }

    public static func calcularProgressoStint(laps: [LapInfo], plan: StintPlan?) -> ProgressoStint {
        let validas = laps.filter { $0.valida && $0.tempoMs != nil }
        let voltasFeitas = laps.count
        let voltasAlvo = plan?.nVoltasAlvo
        let pctCompleto: Int? = voltasAlvo.map {
            min(100, Int((Double(voltasFeitas) / Double($0)) * 100 + 0.5))
        }
        let voltasRestantes: Int? = voltasAlvo.map { max(0, $0 - voltasFeitas) }

        var ritmoMedioMs: Int? = nil
        var melhorMs: Double? = nil
        if !validas.isEmpty {
            let tempos = validas.compactMap { $0.tempoMs }.sorted()
            if !tempos.isEmpty {
                let soma = tempos.reduce(0, +)
                ritmoMedioMs = Int((soma / Double(tempos.count)).rounded())
                melhorMs = tempos[0]
            }
        }
        let deltaStintMs: Int? = (ritmoMedioMs != nil && melhorMs != nil)
            ? ritmoMedioMs! - Int(melhorMs!)
            : nil

        return ProgressoStint(
            voltasFeitas: voltasFeitas,
            voltasAlvo: voltasAlvo,
            voltasRestantes: voltasRestantes,
            pctCompleto: pctCompleto,
            ritmoMedioMs: ritmoMedioMs,
            melhorMs: melhorMs,
            deltaStintMs: deltaStintMs,
            validas: validas.count
        )
    }
}
