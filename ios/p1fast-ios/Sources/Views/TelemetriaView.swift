// ═══════════════════════════════════════════════════════════
// TelemetriaView — UI de captura ao vivo
// ═══════════════════════════════════════════════════════════
// Botão REC/STOP + indicadores Hz/jitter/sample count + métricas do
// pipeline Kalman (enriched count + fix) + Detector ao vivo (samples
// consumed/skipped + lap count). Cria uma sessao
// "telemetria-demo-<ts>" descartável só pra ter um sessao_id que
// satisfaz a FK de telemetry_samples / telemetry_samples_enriched.
//
// MS-2.1 #93: LiveTelemetryRecorder.
// MS-2.3 #102: LiveKalmanProcessor plugado via attach(to:) no INICIAR.
// MS-2.6 #103: SampleDetectorAdapter + LiveDetectorBridge.
// MS-2.6.b (este): plug do bridge na view, com Detector demo
// configurado a partir de SeedBrasilia.make() — Track + linhaChegada
// + 12 segments. Trocar por TrackRepository.currentTrack quando
// MS-2.6.c expor a API. Lap count vem direto do detector via onLap.
//
// NÃO amarra ao fluxo real de stint (MS-2.5).
//
// Acesso: launch arg `--p1-telemetria`.

import SwiftUI
import GRDB
import P1FastCore

struct TelemetriaView: View {
    let queue: DatabaseQueue

    @StateObject private var recorder: LiveTelemetryRecorder
    @StateObject private var processor: LiveKalmanProcessor
    @StateObject private var bridge: LiveDetectorBridge
    @StateObject private var lowPower = LowPowerModeMonitor()
    @State private var sessaoId: String
    @State private var startedAt: Date?
    @State private var ticker = Date()
    @State private var elapsedS: TimeInterval = 0
    @State private var lastStopCount: Int = 0
    @State private var lastEnrichedCount: Int = 0
    @State private var lapCount: Int = 0
    @State private var lastLapMs: Double? = nil
    @State private var sessaoErro: String?
    @State private var lapCancel: (() -> Void)? = nil

    init(
        queue: DatabaseQueue,
        trackBundle: (track: P1FastCore.Track, layout: P1FastCore.TrackLayout, segments: [P1FastCore.TrackSegment])? = nil
    ) {
        self.queue = queue
        let id = "telemetria-demo-\(Int(Date().timeIntervalSince1970))"
        _sessaoId = State(initialValue: id)
        _recorder = StateObject(wrappedValue: LiveTelemetryRecorder(
            queue: queue,
            sessaoId: id,
            timeId: "local-default-team"
        ))
        _processor = StateObject(wrappedValue: LiveKalmanProcessor(
            queue: queue,
            sessaoId: id,
            timeId: "local-default-team"
        ))
        // MS-2.6.c: caller (ContentView) passa o bundle vindo de
        // TrackRepository.currentTrack quando disponível. Se nil (ex.: repo
        // ainda não bootstrapou), fallback pro hardcode SeedBrasilia. Em
        // multi-track, o seletor de pista vive no caller.
        let bundle = trackBundle ?? SeedBrasilia.make()
        let detector = Detector(
            svgPath: bundle.track.svgPath ?? "",
            linhaChegada: bundle.track.linhaChegada,
            segments: bundle.segments
        )
        _bridge = StateObject(wrappedValue: LiveDetectorBridge(
            detector: detector,
            track: bundle.track
        ))
    }

    var body: some View {
        VStack(spacing: Spacing.lg) {
            header
            if let err = sessaoErro { sessaoErroBanner(err) }
            if lowPower.isLowPowerMode { lowPowerWarning }
            metrics
            actionButton
            Spacer()
            footer
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface.ignoresSafeArea())
        .task { await ensureSessao() }
        .onReceive(Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()) { now in
            ticker = now
            if let started = startedAt {
                elapsedS = now.timeIntervalSince(started)
            }
        }
    }

    // MARK: - Sub-views

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Telemetria — captura ao vivo")
                .font(Font.titleP1)
                .foregroundColor(.text)
            Text("MS-2.1 · CoreMotion 100Hz + GPS 1Hz")
                .font(Font.captionP1)
                .foregroundColor(.textMuted)
            Text(recorder.permissionStatus)
                .font(Font.captionP1)
                .foregroundColor(.textFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sessaoErroBanner(_ msg: String) -> some View {
        Text("Falha ao preparar sessão demo: \(msg). INICIAR não vai funcionar até resolver.")
            .font(Font.captionP1)
            .foregroundColor(.rec)
            .padding(Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceRaised)
            .cornerRadius(Radius.sm)
    }

    private var lowPowerWarning: some View {
        Text("Low Power Mode ativo — IMU e GPS podem cair em frequência. Desligue em Ajustes pra captura completa.")
            .font(Font.captionP1)
            .foregroundColor(.atencao)
            .padding(Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceRaised)
            .cornerRadius(Radius.sm)
    }

    private var metrics: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            row("Estado", recorder.running ? "● REC \(format(elapsedS))s" : "STOP")
            row("Amostras raw", "\(recorder.sampleCount)")
            row("Amostras enriched", "\(processor.enrichedCount)\(processor.hasFix ? " · fix" : "")")
            row("Detector", "\(bridge.consumed) ok · \(bridge.skipped) skip")
            row("Voltas", lapCount > 0
                ? "\(lapCount)" + (lastLapMs.map { String(format: " · última %.2fs", $0 / 1000) } ?? "")
                : "—")
            row("IMU", String(format: "%.1f Hz · jitter %.2f ms",
                              recorder.imuHz, recorder.imuJitterMs))
            row("GPS", String(format: "%.1f Hz · jitter %.0f ms",
                              recorder.gpsHz, recorder.gpsJitterMs))
            row("Background", backgroundLabel)
            if let err = recorder.lastError ?? processor.lastError {
                Text(err)
                    .font(Font.captionP1)
                    .foregroundColor(.rec)
            }
        }
        .padding(Spacing.md)
        .background(Color.surfaceRaised)
        .cornerRadius(Radius.md)
    }

    private var actionButton: some View {
        let bloqueado = sessaoErro != nil && !recorder.running
        return Button(action: toggle) {
            Text(recorder.running ? "PARAR" : "INICIAR")
                .font(Font.titleP1)
                .foregroundColor(.surface)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(bloqueado ? Color.textFaint
                            : recorder.running ? Color.rec : Color.accent)
                .cornerRadius(Radius.md)
        }
        .disabled(bloqueado)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Sessão: \(sessaoId)")
                .font(Font.captionP1)
                .foregroundColor(.textFaint)
            if lastStopCount > 0 {
                Text("Última captura: \(lastStopCount) amostras raw · \(lastEnrichedCount) enriched")
                    .font(Font.captionP1)
                    .foregroundColor(.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(Font.bodyP1).foregroundColor(.textMuted)
            Spacer()
            Text(value).font(Font.bodyP1).foregroundColor(.text)
        }
    }

    /// Field test 2026-05-06 mostrou IMU 14 Hz médio numa sessão de
    /// 2h porque app foi pra background — iOS pausa CoreMotion mesmo
    /// com UIBackgroundModes.location ativo. Esta linha torna o
    /// evento visível em tempo real.
    private var backgroundLabel: String {
        if recorder.isInBackground { return "● em background agora" }
        let n = recorder.backgroundTransitionCount
        if n == 0 { return "—" }
        if let lastMs = recorder.lastBackgroundDurationMs {
            return String(format: "%d evento%@ · último %.1fs", n, n == 1 ? "" : "s", lastMs / 1000.0)
        }
        return "\(n) evento\(n == 1 ? "" : "s")"
    }

    // MARK: - Actions

    private func toggle() {
        if recorder.running {
            Task {
                await recorder.stop()
                await processor.detach()
                bridge.detach()
                lapCancel?()
                lapCancel = nil
                lastStopCount = recorder.sampleCount
                lastEnrichedCount = processor.enrichedCount
                startedAt = nil
                elapsedS = 0
            }
        } else {
            Task {
                await ensureSessao()
                processor.attach(to: recorder)
                bridge.attach(to: recorder)
                lapCancel?()
                lapCancel = bridge.detector.onLap { ev in
                    Task { @MainActor in
                        lapCount = ev.numero
                        lastLapMs = ev.tempoMs
                    }
                }
                recorder.start()
                startedAt = Date()
            }
        }
    }

    /// Cria a sessao demo idempotente. Garante o Time canônico
    /// `local-default-team` antes da Sessao — TelemetriaView pode rodar
    /// independente de qual repo bootstrapa o team primeiro (race com
    /// `.task` do ContentView). Mesmo padrão do
    /// PilotoRepository/PassageiroRepository: Time idempotente local.
    ///
    /// FB-02: erro vai pro estado `sessaoErro` que renderiza banner
    /// vermelho e desabilita INICIAR. Engolir silenciosamente fazia o
    /// debugging ficar confuso (FK violation no flush mascarava raiz).
    private func ensureSessao() async {
        do {
            try await queue.write { db in
                // 1) Time canônico — idempotente.
                let timeId = "local-default-team"
                if try Time.fetchOne(db, key: timeId) == nil {
                    try Time(
                        id: timeId,
                        nome: "Time local",
                        criadoPor: nil
                    ).insert(db)
                }
                // 2) Sessao demo — idempotente.
                if try Sessao.fetchOne(db, key: sessaoId) == nil {
                    try Sessao(
                        id: sessaoId,
                        timeId: timeId,
                        eventoId: nil,
                        carroId: nil,
                        pilotoId: nil,
                        configuracaoId: nil,
                        status: "ativa",
                        dataInicio: DB.nowMs(),
                        dataFim: nil,
                        // CHECK constraint exige NULL ou >= 1; 0 não é
                        // válido. Sessão demo de telemetria não tem
                        // voltas planejadas — fica NULL.
                        voltasPlanejadas: nil,
                        objetivo: "Telemetria demo (MS-2.1)"
                    ).insert(db)
                }
            }
            sessaoErro = nil
        } catch {
            sessaoErro = error.localizedDescription
        }
    }

    private func format(_ s: TimeInterval) -> String {
        String(format: "%.1f", s)
    }
}
