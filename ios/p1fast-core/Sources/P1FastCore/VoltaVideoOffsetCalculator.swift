// ═══════════════════════════════════════════════════════════
// VoltaVideoOffsetCalculator — cálculo puro de offsets pra triagem
// ═══════════════════════════════════════════════════════════
// F4 etapa 3 — lógica pura testável. Converte `DetectorLapEvent`
// (timestamps absolutos do Detector) em `(tInicioMs, tFimMs)`
// relativos ao `started_at` do stream Daily.co. Sem estado, sem IO.
//
// Garantias:
//   - tInicioMs >= 0 (clamp em zero pra eventos anteriores ao start
//     do stream — corner case quando voltas em curso entram pro
//     buffer antes do stream abrir).
//   - tFimMs > tInicioMs (clamp em tInicioMs+1 pra respeitar o
//     CHECK do banco; corner case quando ev.fimAt < ev.inicioAt
//     por ruído de relógio).
//
// Unidade: milissegundos em todos os parâmetros e retornos.

import Foundation

public enum VoltaVideoOffsetCalculator {

    /// Calcula offset (início, fim) da volta dentro da gravação.
    /// - Parameters:
    ///   - streamStartedAtMs: timestamp em ms do start do stream.
    ///   - evInicioAtMs: `DetectorLapEvent.inicioAt`.
    ///   - evFimAtMs: `DetectorLapEvent.fimAt`.
    /// - Returns: par `(tInicioMs, tFimMs)` válido pra inserir em
    ///   `volta_video` (sempre satisfaz CHECK do banco).
    public static func compute(
        streamStartedAtMs: Int64,
        evInicioAtMs: Double,
        evFimAtMs: Double
    ) -> (tInicioMs: Int, tFimMs: Int) {
        let start = Double(streamStartedAtMs)
        let tInicio = Int(max(0.0, evInicioAtMs - start))
        // CHECK no banco exige tFim > tInicio. Se o ruído de relógio
        // fizer fim <= inicio, garante 1 ms de duração mínima.
        let tFim = Int(max(Double(tInicio + 1), evFimAtMs - start))
        return (tInicio, tFim)
    }
}
