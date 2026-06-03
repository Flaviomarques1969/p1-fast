// ═══════════════════════════════════════════════════════════
// EventoResumo / DiaResumo — port Swift de
//   src/domain/evento-resumo.js (camada pura, sem IO)
// ═══════════════════════════════════════════════════════════
// Lê stints e calcula totais e melhores tempos por dia e por evento.
// Usado pelo card de evento e pelo relatório pós-evento.
//
// Quality:
//   MEDIDO    — tudo veio de telemetria real (`lapsExecutados`)
//   ESTIMADO  — tudo veio de `voltasPlanejadas` (sem telemetria)
//   PARCIAL   — mistura
//   VAZIO     — sem stints
//
// MS-6.6 (port 2026-05-04). A versão JS `enriquecerEventosComLapsReais`
// é IO Dexie — não portada. Em iOS o caller faz o equivalente via
// GRDB (lap_repository fetchByCarroDia).

import Foundation

public enum ResumoQuality: String, Sendable, Codable, CaseIterable {
    case medido    = "MEDIDO"
    case parcial   = "PARCIAL"
    case estimado  = "ESTIMADO"
    case vazio     = "VAZIO"
}

/// Lap executado durante o stint — entra no resumo.
public struct StintLap: Sendable, Equatable {
    public let id: String?
    public let tempoMs: Double
    public let valida: Bool

    public init(id: String? = nil, tempoMs: Double, valida: Bool = true) {
        self.id = id; self.tempoMs = tempoMs; self.valida = valida
    }
}

/// Stint mínimo pro resumo. Caller traz `lapsExecutados` se houver
/// telemetria; senão preenche `voltasPlanejadas` (manual).
public struct StintInput: Sendable, Equatable {
    public let id: String?
    public let lapsExecutados: [StintLap]?
    public let voltasPlanejadas: Int?

    public init(id: String? = nil, lapsExecutados: [StintLap]? = nil, voltasPlanejadas: Int? = nil) {
        self.id = id
        self.lapsExecutados = lapsExecutados
        self.voltasPlanejadas = voltasPlanejadas
    }
}

public struct StintResumo: Sendable, Equatable {
    public let voltas: Int
    public let voltasTotais: Int
    public let melhorMs: Double?
    public let melhorLapId: String?
    public let quality: ResumoQuality

    public init(voltas: Int, voltasTotais: Int, melhorMs: Double?, melhorLapId: String?, quality: ResumoQuality) {
        self.voltas = voltas; self.voltasTotais = voltasTotais
        self.melhorMs = melhorMs; self.melhorLapId = melhorLapId
        self.quality = quality
    }
}

public struct DiaResumo: Sendable, Equatable {
    public let voltas: Int
    public let melhorMs: Double?
    public let melhorLapId: String?
    public let melhorStintId: String?
    public let quality: ResumoQuality
    public let calculadoEm: Double          // ms epoch
}

public struct EventoDiaResumo: Sendable, Equatable {
    public let id: String
    public let data: String?               // ISO YYYY-MM-DD

    public init(id: String, data: String? = nil) {
        self.id = id; self.data = data
    }
}

public struct EventoResumoInput: Sendable, Equatable {
    public let dias: [EventoDiaResumo]
    public let stintsByDia: [String: [StintInput]]

    public init(dias: [EventoDiaResumo], stintsByDia: [String: [StintInput]]) {
        self.dias = dias; self.stintsByDia = stintsByDia
    }
}

public struct EventoResumoResult: Sendable, Equatable {
    public let voltasTotal: Int
    public let melhorMsGlobal: Double?
    public let melhorMsPorDia: [String: Double?]
    public let quality: ResumoQuality
    public let calculadoEm: Double
}

public enum EventoResumo {
    /// Resumo de 1 stint.
    public static func calcularStintResumo(_ stint: StintInput?) -> StintResumo {
        guard let stint else { return vazioStint() }
        if let laps = stint.lapsExecutados, !laps.isEmpty {
            let validas = laps.filter { $0.valida && $0.tempoMs.isFinite && $0.tempoMs > 0 }
            let best = melhorDosLaps(validas)
            return StintResumo(
                voltas: validas.count,
                voltasTotais: laps.count,
                melhorMs: best.tempoMs,
                melhorLapId: best.lapId,
                quality: .medido
            )
        }
        if let v = stint.voltasPlanejadas, v > 0 {
            return StintResumo(
                voltas: v, voltasTotais: v,
                melhorMs: nil, melhorLapId: nil,
                quality: .estimado
            )
        }
        return vazioStint()
    }

    /// Resumo de um dia (lista de stints).
    public static func calcularDiaResumo(_ stints: [StintInput], now: Double = Date().timeIntervalSince1970 * 1000) -> DiaResumo {
        guard !stints.isEmpty else {
            return DiaResumo(
                voltas: 0, melhorMs: nil, melhorLapId: nil, melhorStintId: nil,
                quality: .vazio, calculadoEm: now
            )
        }
        var voltas = 0
        var melhorMs: Double? = nil
        var melhorLapId: String? = nil
        var melhorStintId: String? = nil
        var temMedido = false
        var temEstimado = false
        for s in stints {
            let r = calcularStintResumo(s)
            voltas += r.voltas
            if let m = r.melhorMs, melhorMs == nil || m < (melhorMs ?? .infinity) {
                melhorMs = m
                melhorLapId = r.melhorLapId
                melhorStintId = s.id
            }
            switch r.quality {
            case .medido:   temMedido = true
            case .estimado: temEstimado = true
            default: break
            }
        }
        let quality: ResumoQuality
        if temMedido && temEstimado    { quality = .parcial }
        else if temMedido              { quality = .medido }
        else if temEstimado            { quality = .estimado }
        else                           { quality = .vazio }
        return DiaResumo(
            voltas: voltas,
            melhorMs: melhorMs,
            melhorLapId: melhorLapId,
            melhorStintId: melhorStintId,
            quality: quality,
            calculadoEm: now
        )
    }

    /// Resumo de evento (lista de dias × stintsByDia).
    public static func calcularEventoResumo(
        _ evento: EventoResumoInput,
        now: Double = Date().timeIntervalSince1970 * 1000
    ) -> EventoResumoResult {
        guard !evento.dias.isEmpty else {
            return EventoResumoResult(
                voltasTotal: 0, melhorMsGlobal: nil,
                melhorMsPorDia: [:], quality: .vazio, calculadoEm: now
            )
        }
        var voltasTotal = 0
        var melhorMsGlobal: Double? = nil
        var melhorMsPorDia: [String: Double?] = [:]
        var qualidades: [ResumoQuality] = []
        for d in evento.dias {
            let stints = evento.stintsByDia[d.id] ?? []
            let dr = calcularDiaResumo(stints, now: now)
            voltasTotal += dr.voltas
            melhorMsPorDia.updateValue(dr.melhorMs, forKey: d.id)
            if let m = dr.melhorMs, melhorMsGlobal == nil || m < (melhorMsGlobal ?? .infinity) {
                melhorMsGlobal = m
            }
            qualidades.append(dr.quality)
        }
        let naoVazias = qualidades.filter { $0 != .vazio }
        let quality: ResumoQuality
        if naoVazias.isEmpty                        { quality = .vazio }
        else if naoVazias.allSatisfy({ $0 == .medido })   { quality = .medido }
        else if naoVazias.allSatisfy({ $0 == .estimado }) { quality = .estimado }
        else                                        { quality = .parcial }
        return EventoResumoResult(
            voltasTotal: voltasTotal,
            melhorMsGlobal: melhorMsGlobal,
            melhorMsPorDia: melhorMsPorDia,
            quality: quality,
            calculadoEm: now
        )
    }
}

// MARK: - Helpers

private func vazioStint() -> StintResumo {
    StintResumo(
        voltas: 0, voltasTotais: 0,
        melhorMs: nil, melhorLapId: nil,
        quality: .vazio
    )
}

private func melhorDosLaps(_ laps: [StintLap]) -> (tempoMs: Double?, lapId: String?) {
    var best: Double? = nil
    var bestId: String? = nil
    for l in laps {
        guard l.valida, l.tempoMs.isFinite, l.tempoMs > 0 else { continue }
        if best == nil || l.tempoMs < (best ?? .infinity) {
            best = l.tempoMs
            bestId = l.id
        }
    }
    return (best, bestId)
}
