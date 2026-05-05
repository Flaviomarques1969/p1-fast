// ═══════════════════════════════════════════════════════════
// LiveKalmanProcessor — MS-2.7 PR C
// ═══════════════════════════════════════════════════════════
// Consome o stream de Sample do LiveTelemetryRecorder (MS-2.1) via o
// callback onSample, alimenta KalmanINSGPS (PR A, #99) e persiste cada
// EnrichedSample em telemetry_samples_enriched (PR B, #100) por
// EnrichedTelemetryWriter.
//
// Modelo de execução:
//   - onSample roda no MainActor (recorder.append está em @MainActor).
//   - process() é síncrono e barato (~µs) — Kalman puro + push em buffer.
//   - flush é detached pra utility queue, exatamente como TelemetryWriter
//     no recorder, e roda em batches de flushBatchSize OU a cada
//     flushIntervalS — paridade direta com o pipeline raw.
//
// Sequência:
//   - seq do enriched é incrementado por sample que produz EnrichedSample
//     (ou seja, por IMU+GPS — predict/update). Não tem paridade 1-pra-1
//     com seq do telemetry_samples raw, mas é monotônico crescente por
//     sessão e suficiente pra ordenar leitura.
//
// Falha de flush:
//   - Mesmo padrão do recorder: re-injeta batch no início do buffer e
//     retoma seq, expondo last error. Sem retry agressivo — UI mostra.

import Foundation
import Combine
import GRDB
import P1FastCore

@MainActor
final class LiveKalmanProcessor: ObservableObject {

    // MARK: - Published (UI)
    @Published private(set) var enrichedCount: Int = 0
    @Published private(set) var lastError: String?
    @Published private(set) var hasFix: Bool = false

    // MARK: - Config
    private let queue: DatabaseQueue
    private let sessaoId: String
    private let timeId: String
    private let flushBatchSize: Int
    private let flushIntervalS: TimeInterval

    // MARK: - Internals
    private let kalman: KalmanINSGPS
    private var buffer: [EnrichedSample] = []
    private var seq: Int = 0
    private var flushTimer: Timer?
    private weak var recorder: LiveTelemetryRecorder?
    private var sampleHandlerCancel: (() -> Void)?

    init(
        queue: DatabaseQueue,
        sessaoId: String,
        timeId: String,
        kalman: KalmanINSGPS = KalmanINSGPS(),
        flushBatchSize: Int = 100,
        flushIntervalS: TimeInterval = 1.0
    ) {
        self.queue = queue
        self.sessaoId = sessaoId
        self.timeId = timeId
        self.kalman = kalman
        self.flushBatchSize = flushBatchSize
        self.flushIntervalS = flushIntervalS
    }

    deinit {
        flushTimer?.invalidate()
    }

    // MARK: - Plug com o recorder

    /// Conecta o processor ao recorder via addSampleHandler. Idempotente
    /// — chamadas repetidas cancelam o registro anterior antes de
    /// re-registrar. O recorder pode estar rodando ou não; o handler só
    /// dispara em append.
    func attach(to recorder: LiveTelemetryRecorder) {
        sampleHandlerCancel?()
        self.recorder = recorder
        sampleHandlerCancel = recorder.addSampleHandler { [weak self] s in
            self?.process(s)
        }
        scheduleFlushTimer()
    }

    /// Cancela o handler do recorder e fecha buffer com flush final.
    func detach() async {
        flushTimer?.invalidate()
        flushTimer = nil
        sampleHandlerCancel?()
        sampleHandlerCancel = nil
        recorder = nil
        await flush()
    }

    // MARK: - Pipeline core

    /// Processa um Sample raw vindo do recorder. IMU → predict, GPS →
    /// update. Cada chamada empurra exatamente um EnrichedSample no
    /// buffer (mesmo no pré-fix, pra UI ter cadência igual à raw).
    func process(_ s: Sample) {
        let enriched: EnrichedSample
        switch s.source {
        case SourceTags.imu:
            enriched = kalman.predict(sample: s)
        case SourceTags.gps, SourceTags.racebox:
            enriched = kalman.update(sample: s)
        default:
            // Fontes T4000/etc não alimentam Kalman INS-GPS. Ignora.
            return
        }
        if enriched.sourceKalman { hasFix = true }
        buffer.append(enriched)
        enrichedCount += 1
        if buffer.count >= flushBatchSize {
            Task { await flush() }
        }
    }

    // MARK: - Flush

    private func scheduleFlushTimer() {
        flushTimer?.invalidate()
        flushTimer = Timer.scheduledTimer(withTimeInterval: flushIntervalS, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.flush() }
        }
    }

    private func flush() async {
        guard !buffer.isEmpty else { return }
        let batch = buffer
        let startSeq = seq
        buffer.removeAll(keepingCapacity: true)
        seq += batch.count
        let q = queue
        let sId = sessaoId
        let tId = timeId
        let result: Result<Int, Error> = await Task.detached(priority: .utility) {
            do {
                let n = try EnrichedTelemetryWriter.appendBatch(
                    queue: q, sessaoId: sId, timeId: tId,
                    samples: batch, startSeq: startSeq
                )
                return .success(n)
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success: break
        case .failure(let err):
            lastError = "enriched flush falhou: \(err.localizedDescription)"
            buffer.insert(contentsOf: batch, at: 0)
            seq = startSeq
        }
    }
}
