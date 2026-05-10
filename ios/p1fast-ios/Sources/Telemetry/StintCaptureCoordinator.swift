// ═══════════════════════════════════════════════════════════
// StintCaptureCoordinator — caller real do MS-2.5 finalize
// ═══════════════════════════════════════════════════════════
// Fecha o último elo do MS-2: durante um stint real, arma os 3
// stacks vivos (LiveTelemetryRecorder + LiveKalmanProcessor +
// LiveDetectorBridge) usando o sessao_id do stint como chave de
// telemetry_samples / telemetry_samples_enriched, bufferiza os
// `DetectorSegmentEndEvent` emitidos pelo Detector e devolve a
// lista no `stop()` pra que o caller passe pro StintRepository
// .finalize(stintId:, segmentEvents:) — assinatura aceita o
// parâmetro desde MS-2.5 #111.
//
// Antes deste coordinator, finalize sempre rodava com `[]` em
// produção (TelemetriaView usa sessao demo descartável, e o
// caller real do StintModalView só fechava o sheet sem ligar
// captura nenhuma). Por isso `segment_executions` ficava vazio
// na prática mesmo com migration 0007 e mapper testados.
//
// Tier 0 graceful degradation (feedback_p1fast_graceful_deg):
// `trackBundle` é opcional. Sem bundle (pista não cadastrada),
// captura raw + Kalman roda normal, mas Detector não é montado
// — finalize recebe `[]` e StintRepository segue o caminho
// histórico (voltas mock, sem segment_executions). Em campo
// real, bundle vem do TrackRepository.currentTrack(), populado
// pela MS-2.6.c (#112).
//
// Modelo de execução: instância única injetada no environment
// (ContentView). Cada `start(...)` constrói recorder/processor/
// bridge novos porque o sessaoId é parte da inicialização. Nunca
// duas capturas simultâneas — `start` durante captura ativa em
// outro stint dispara precondition failure.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class StintCaptureCoordinator: ObservableObject {

    // MARK: - Published (UI)

    @Published private(set) var running = false
    @Published private(set) var activeStintId: String?
    @Published private(set) var lapCount: Int = 0
    @Published private(set) var lastLapMs: Double?
    @Published private(set) var capturedSegmentCount: Int = 0
    @Published private(set) var lastError: String?
    @Published private(set) var hasTrackBundle: Bool = false

    // MARK: - Stacks vivos (recriados por start)

    private(set) var recorder: LiveTelemetryRecorder?
    private(set) var processor: LiveKalmanProcessor?
    private(set) var bridge: LiveDetectorBridge?

    // MARK: - Internals

    private let queue: DatabaseQueue
    private let timeId: String

    private var capturedEvents: [DetectorSegmentEndEvent] = []
    private var lapCancel: (() -> Void)?
    private var segEndCancel: (() -> Void)?

    // MS-2.8 — publish IMU/GPS pro cockpit Windows (cabo + Realtime)
    private var publisher: LiveTelemetryPublisher?
    private var rawHandlerCancel: (() -> Void)?
    private var enrichedHandlerCancel: (() -> Void)?
    private var heartbeatTimer: Timer?

    init(queue: DatabaseQueue, timeId: String? = nil) {
        self.queue = queue
        // MS-10 C.3: caller pode passar timeId explícito; default puxa
        // do TeamContext (alimentado pelo SessionManager). Vazio quando
        // não há login — captura vai falhar no FK do banco, comportamento
        // intencional pra forçar debug rápido.
        self.timeId = timeId ?? TeamContext.currentTeamId ?? ""
    }

    // MARK: - Controle

    /// Inicia a captura para um stint já criado (sessao em status='ativa').
    /// `trackBundle` é o resultado de `TrackRepository.currentTrack()` —
    /// passar nil quando a pista não está cadastrada (graceful degradation
    /// do Tier 0). Re-call com o mesmo stintId é no-op idempotente; com
    /// stintId diferente sob captura ativa dispara precondition failure
    /// (caller deve chamar `stop` antes).
    func start(
        stintId: String,
        trackBundle: (track: Track, layout: TrackLayout, segments: [TrackSegment])? = nil
    ) {
        if running, activeStintId == stintId { return }
        precondition(
            !running,
            "StintCaptureCoordinator: tentou iniciar stint \(stintId) com captura ativa em \(activeStintId ?? "?"). Pare a captura antes."
        )

        activeStintId = stintId
        capturedEvents = []
        capturedSegmentCount = 0
        lapCount = 0
        lastLapMs = nil
        lastError = nil
        hasTrackBundle = trackBundle != nil

        let rec = LiveTelemetryRecorder(queue: queue, sessaoId: stintId, timeId: timeId)
        let proc = LiveKalmanProcessor(queue: queue, sessaoId: stintId, timeId: timeId)
        proc.attach(to: rec)

        if let bundle = trackBundle {
            let detector = Detector(
                svgPath: bundle.track.svgPath ?? "",
                linhaChegada: bundle.track.linhaChegada,
                segments: bundle.segments
            )
            let br = LiveDetectorBridge(detector: detector, track: bundle.track)
            br.attach(to: rec)

            segEndCancel = detector.onSegmentEnd { [weak self] ev in
                Task { @MainActor in
                    guard let self else { return }
                    self.capturedEvents.append(ev)
                    self.capturedSegmentCount = self.capturedEvents.count
                }
            }
            lapCancel = detector.onLap { [weak self] ev in
                Task { @MainActor in
                    guard let self else { return }
                    self.lapCount = ev.numero
                    self.lastLapMs = ev.tempoMs
                }
            }

            self.bridge = br
        }

        recorder = rec
        processor = proc

        // MS-2.8: liga publisher se temos track (sem track, viewBox não
        // existe → publish não faz sentido; o cockpit ficaria mostrando
        // posição em coordenadas inválidas).
        if let bundle = trackBundle {
            var transports: [any CockpitTransport] = [LocalSocketCockpitTransport()]
            if let client = SupabaseManager.shared {
                transports.append(RealtimeCockpitTransport(client: client, stintId: stintId))
            }
            let pub = LiveTelemetryPublisher(
                transports: transports,
                track: bundle.track,
                stintId: stintId
            )
            publisher = pub
            Task { await pub.start() }

            // raw → publisher mantém último GPS/IMU
            rawHandlerCancel = rec.addSampleHandler { [weak pub] sample in
                Task { await pub?.ingestRawSample(sample) }
            }
            // enriched → publisher dispara envelope iphone-imu (10 Hz)
            enrichedHandlerCancel = proc.addEnrichedHandler { [weak pub] enriched in
                Task { await pub?.ingestEnriched(enriched) }
            }
            // heartbeat 1 Hz — Timer no MainActor agendado em RunLoop
            heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak pub] _ in
                Task { await pub?.sendHeartbeat() }
            }
        }

        rec.start()
        running = true
    }

    /// Para a captura, drena o buffer de DetectorSegmentEndEvents e
    /// devolve pra que o caller passe pro `StintRepository.finalize(
    /// stintId:, segmentEvents:)`. Chamadas repetidas após parar
    /// retornam `[]`.
    @discardableResult
    func stop() async -> [DetectorSegmentEndEvent] {
        guard running else { return [] }
        running = false

        let events = capturedEvents
        capturedEvents = []

        await recorder?.stop()
        await processor?.detach()
        bridge?.detach()

        // MS-2.8 cleanup
        heartbeatTimer?.invalidate(); heartbeatTimer = nil
        rawHandlerCancel?(); rawHandlerCancel = nil
        enrichedHandlerCancel?(); enrichedHandlerCancel = nil
        if let pub = publisher {
            await pub.stop()
        }
        publisher = nil

        lapCancel?(); lapCancel = nil
        segEndCancel?(); segEndCancel = nil

        recorder = nil
        processor = nil
        bridge = nil
        activeStintId = nil
        hasTrackBundle = false

        return events
    }
}
