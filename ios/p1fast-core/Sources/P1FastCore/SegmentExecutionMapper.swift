// ═══════════════════════════════════════════════════════════
// SegmentExecutionMapper — DetectorSegmentEndEvent → SegmentExecution
// ═══════════════════════════════════════════════════════════
// MS-2.5: lógica pura de mapeamento entre o evento ao vivo do Detector
// e a row a ser persistida em `segment_executions`. Mantida no core
// (testável via smoke harness) — `StintRepository.finalize` (iOS) só
// chama esse mapper e insere via GRDB.
//
// Convenções:
// - Velocidades do Detector vêm em m/s (espelha JS canônico). Schema
//   SegmentExecution guarda km/h. Conversão * 3.6 aplicada aqui.
// - `velocidadeMax` = maior entre `velEntrada` e `velSaida`. Se ambos
//   nil (ou apenas -inf) → fica nil. Detector não reporta a velocidade
//   máxima dentro do segmento; aproximamos pelas pontas.
// - `vminKmh` ← `event.velMinima * 3.6` (ou nil).
// - `vminX/vminY` ← `event.apexActual.x/y` (ou nil).
// - `tempoMs` ← `Int(event.tempoMs.rounded())` (Detector usa Double).
// - `id` é gerado via UUID por padrão; caller pode injetar pra testes
//   determinísticos.
//
// 6 indicadores (Comando GO 2026-05-24):
// - vChegada → vEntrada → vFreada → vMin → vPace → vSaidaPico
// - Os 5 primeiros vêm de `DetectorSegmentEndEvent`. O sexto chega
//   no `DetectorSegmentPostBurstEvent` (emitido ~2.4 s após o fim do
//   segmento), por isso o mapper aceita o post-burst como argumento
//   opcional. Caller é responsável por parear segmentEnd + postBurst
//   pelo trio (segmentId, lapNumero) antes de chamar.

import Foundation

public enum SegmentExecutionMapper {
    /// Mapeia 1 evento `DetectorSegmentEndEvent` (+ opcionalmente o
    /// post-burst correspondente) → 1 `SegmentExecution` pronto pra
    /// inserir em GRDB.
    public static func fromEvent(
        _ event: DetectorSegmentEndEvent,
        postBurst: DetectorSegmentPostBurstEvent? = nil,
        timeId: String,
        sessaoId: String,
        voltaId: String,
        id: String = UUID().uuidString,
        createdAt: Int64 = DB.nowMs()
    ) -> SegmentExecution {
        let entrada = event.velEntrada ?? -.infinity
        let saida = event.velSaida ?? -.infinity
        let velMaxMs = max(entrada, saida)
        let velocidadeMaxKmh: Double? = velMaxMs.isFinite ? velMaxMs * 3.6 : nil
        let vminKmh: Double? = event.velMinima.map { $0 * 3.6 }
        let vChegadaKmh: Double? = event.vChegada.map { $0 * 3.6 }
        let vEntradaKmh: Double? = event.velEntrada.map { $0 * 3.6 }
        let vFreadaKmh: Double? = event.vFreada.map { $0 * 3.6 }
        let vPaceKmh: Double? = event.velSaida.map { $0 * 3.6 }
        let vSaidaPicoKmh: Double? = postBurst?.vSaidaPico.map { $0 * 3.6 }
        let tempoFreadaApiceMs: Int? = event.tempoFreadaApiceMs.map { Int($0.rounded()) }
        let tempoApiceSaidaMs: Int? = event.tempoApiceSaidaMs.map { Int($0.rounded()) }
        return SegmentExecution(
            id: id,
            timeId: timeId,
            sessaoId: sessaoId,
            voltaId: voltaId,
            segmentId: event.segmentId,
            tempoMs: Int(event.tempoMs.rounded()),
            velocidadeMax: velocidadeMaxKmh,
            vminKmh: vminKmh,
            vminX: event.apexActual?.x,
            vminY: event.apexActual?.y,
            vChegadaKmh: vChegadaKmh,
            vEntradaKmh: vEntradaKmh,
            vFreadaKmh: vFreadaKmh,
            vPaceKmh: vPaceKmh,
            vSaidaPicoKmh: vSaidaPicoKmh,
            tempoFreadaApiceMs: tempoFreadaApiceMs,
            tempoApiceSaidaMs: tempoApiceSaidaMs,
            createdAt: createdAt,
            syncedAt: nil
        )
    }

    /// Conveniência: pareia listas de eventos de saída + post-burst
    /// por `(segmentId, lapNumero)` e devolve a sequência merged. Eventos
    /// de saída sem post-burst correspondente seguem com `vSaidaPico=nil`
    /// (caso real quando o stint terminou antes do tracking pós-saída
    /// completar). Pareamento em O(n) usando dicionário.
    public static func mergePostBursts(
        ends: [DetectorSegmentEndEvent],
        postBursts: [DetectorSegmentPostBurstEvent]
    ) -> [(end: DetectorSegmentEndEvent, postBurst: DetectorSegmentPostBurstEvent?)] {
        var byKey: [String: DetectorSegmentPostBurstEvent] = [:]
        for pb in postBursts {
            let key = "\(pb.segmentId)|\(pb.lapNumero ?? -1)"
            byKey[key] = pb
        }
        return ends.map { e in
            let key = "\(e.segmentId)|\(e.lapNumero ?? -1)"
            return (end: e, postBurst: byKey[key])
        }
    }
}
