// ═══════════════════════════════════════════════════════════
// VoltaVideoIndexer — F4 etapa 3
// ═══════════════════════════════════════════════════════════
// Escuta `Detector.onLap` durante o stint ativo e indexa cada
// volta dentro da gravação Daily.co associada ao stream do MS-11.
//
// Pluga em 2 lugares:
//   - `attach(detector:, streamId:, streamStartedAtMs:)` — chamado
//     quando o StreamCoordinator vai pra .aoVivo. Registra listener
//     no Detector e guarda referência do stream + timestamp zero.
//   - `flush(voltas:)` — chamado depois que o StintRepository.finalize
//     criar as rows reais em `voltas`. O Indexer percorre o buffer
//     interno e associa cada DetectorLapEvent (por número) com a
//     volta correspondente (volta.numero == ev.numero), insere uma
//     row em `volta_video` via VoltaVideoRepository.indexar.
//
// Por que indexar depois e não durante:
//   `voltas.id` só existe depois do finalize. O Detector emite eventos
//   durante o stint ativo, mas as rows reais de `voltas` são criadas
//   no fim. O Indexer atua como buffer intermediário.
//
// Offsets:
//   tInicioMs = (ev.inicioAt - streamStartedAtMs) — onde a volta começa
//   tFimMs    = (ev.fimAt    - streamStartedAtMs) — onde a volta termina
//
// Ambos relativos ao started_at do stream Daily.co (Q15: heartbeat a
// cada 5s permite alinhar relógios com precisão de ~1-2s, suficiente
// pra triagem volta-por-volta — ver F4 risco 2 no doc de decisões).

import Foundation
import P1FastCore

@MainActor
final class VoltaVideoIndexer: ObservableObject {
    /// Cada DetectorLapEvent é convertido pra essa struct e fica no buffer
    /// até o flush. Mantemos `numero` pra fazer match com `voltas.numero`
    /// no momento da indexação real.
    private struct PendingLap {
        let numero: Int
        let tInicioMs: Int
        let tFimMs: Int
    }

    /// Métricas observáveis pela UI ou pra debug.
    @Published private(set) var bufferedCount: Int = 0
    @Published private(set) var indexedCount: Int = 0
    @Published private(set) var skippedCount: Int = 0

    private let repo: VoltaVideoRepository
    private var buffer: [PendingLap] = []
    private var lapListenerCancel: (() -> Void)?
    private var attachedStreamId: String?
    private var attachedStartedAtMs: Int64?

    init(repo: VoltaVideoRepository) {
        self.repo = repo
    }

    /// Conecta o indexer ao Detector. Idempotente — chamar 2× cancela o
    /// listener anterior e registra um novo. `streamStartedAtMs` é o
    /// timestamp em ms do momento que o stream Daily.co foi pra aoVivo
    /// (capturado pelo StreamCoordinator).
    func attach(detector: Detector, streamId: String, streamStartedAtMs: Int64) {
        lapListenerCancel?()
        self.attachedStreamId = streamId
        self.attachedStartedAtMs = streamStartedAtMs
        lapListenerCancel = detector.onLap { [weak self] ev in
            Task { @MainActor in
                self?.handleLap(ev)
            }
        }
    }

    /// Desliga o listener (chamado quando stream encerra ou stint cancelado).
    /// Não esvazia o buffer — `flush(voltas:)` ainda pode ser chamado depois.
    func detach() {
        lapListenerCancel?()
        lapListenerCancel = nil
    }

    /// Limpa o buffer sem indexar. Usado quando o stint foi cancelado e
    /// nada deve ser persistido. Mantém streamId/startedAt zerados.
    func discard() {
        buffer.removeAll()
        bufferedCount = 0
        attachedStreamId = nil
        attachedStartedAtMs = nil
    }

    /// Indexa cada volta do buffer associando por número. Voltas em `voltas`
    /// sem evento correspondente no buffer são ignoradas (silenciosamente).
    /// Eventos no buffer sem volta correspondente também são ignorados —
    /// significam que o Detector detectou voltas que o StintRepository.finalize
    /// não materializou (ex: stint cancelado no meio).
    ///
    /// Retorna quantas voltas foram efetivamente indexadas (úteis pra
    /// callers reportarem na UI).
    @discardableResult
    func flush(voltas: [Volta]) async throws -> Int {
        guard let streamId = attachedStreamId else {
            skippedCount += buffer.count
            buffer.removeAll()
            bufferedCount = 0
            return 0
        }

        // Mapeia volta.numero → voltas.id pra lookup O(1).
        let voltaIdByNumero: [Int: String] = Dictionary(uniqueKeysWithValues:
            voltas.compactMap { v -> (Int, String)? in (v.numero, v.id) }
        )

        var indexed = 0
        for pending in buffer {
            guard let voltaId = voltaIdByNumero[pending.numero] else {
                skippedCount += 1
                continue
            }
            // existsForVolta protege contra reentrância (stream caiu e voltou
            // e Detector reprocessou). Idempotente: se já está indexada,
            // pula sem erro.
            let jaIndexada = (try? await repo.existsForVolta(voltaId: voltaId)) ?? false
            if jaIndexada {
                skippedCount += 1
                continue
            }
            _ = try await repo.indexar(
                videoStreamId: streamId,
                voltaId: voltaId,
                tInicioMs: pending.tInicioMs,
                tFimMs: pending.tFimMs
            )
            indexed += 1
        }
        indexedCount += indexed
        buffer.removeAll()
        bufferedCount = 0
        return indexed
    }

    // MARK: - Internas

    private func handleLap(_ ev: DetectorLapEvent) {
        guard let startedAt = attachedStartedAtMs else { return }
        // Lógica de offset reside em VoltaVideoOffsetCalculator (core, puro,
        // testado em smoke). Aqui só repassa parâmetros.
        let (tInicio, tFim) = VoltaVideoOffsetCalculator.compute(
            streamStartedAtMs: startedAt,
            evInicioAtMs: ev.inicioAt,
            evFimAtMs: ev.fimAt
        )
        buffer.append(PendingLap(numero: ev.numero, tInicioMs: tInicio, tFimMs: tFim))
        bufferedCount = buffer.count
    }
}
