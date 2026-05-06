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

import Foundation

public enum SegmentExecutionMapper {
    /// Mapeia 1 evento `DetectorSegmentEndEvent` → 1 `SegmentExecution`
    /// pronto pra inserir em GRDB.
    public static func fromEvent(
        _ event: DetectorSegmentEndEvent,
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
            createdAt: createdAt,
            syncedAt: nil
        )
    }
}
