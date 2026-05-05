// ═══════════════════════════════════════════════════════════
// LiveDetectorBridge — MS-2.6 (PLANO_FASE_1)
// ═══════════════════════════════════════════════════════════
// Pluga o stream do LiveTelemetryRecorder no `Detector` ao vivo via
// addSampleHandler. Apenas samples GPS atravessam — projetados pelo
// `SampleDetectorAdapter` (p1fast-core, testado em smoke).
//
// O `Detector` é injetado pronto pelo caller (TelemetriaView/StintRepo
// futuro) — esta classe não decide configuração de pista. Caller
// escolhe quando criar (.init(svgPath, linhaChegada, segments)) e
// onde plugar listeners (onLap, onSegmentStart, onSegmentEnd).
//
// Co-existência com LiveKalmanProcessor: ambos chamam
// `recorder.addSampleHandler` — handlers são independentes e o ciclo
// de vida (attach/detach) controla cada um por sua conta. Nada
// impede ter os dois plugados simultaneamente.

import Foundation
import P1FastCore

@MainActor
final class LiveDetectorBridge: ObservableObject {
    @Published private(set) var consumed: Int = 0
    @Published private(set) var skipped: Int = 0

    private let detector: Detector
    private let track: Track
    private weak var recorder: LiveTelemetryRecorder?
    private var sampleHandlerCancel: (() -> Void)?

    init(detector: Detector, track: Track) {
        self.detector = detector
        self.track = track
    }

    /// Conecta o bridge ao recorder. Idempotente.
    func attach(to recorder: LiveTelemetryRecorder) {
        sampleHandlerCancel?()
        self.recorder = recorder
        sampleHandlerCancel = recorder.addSampleHandler { [weak self] s in
            self?.process(s)
        }
    }

    func detach() {
        sampleHandlerCancel?()
        sampleHandlerCancel = nil
        recorder = nil
    }

    private func process(_ s: Sample) {
        if let ds = SampleDetectorAdapter.detectorSample(from: s, track: track) {
            detector.consume(ds)
            consumed += 1
        } else {
            skipped += 1
        }
    }
}
