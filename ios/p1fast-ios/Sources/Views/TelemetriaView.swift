// ═══════════════════════════════════════════════════════════
// TelemetriaView — UI mínima de captura ao vivo (MS-2.1)
// ═══════════════════════════════════════════════════════════
// Botão REC/STOP + indicador de Hz/jitter/sample count. Cria uma
// sessao "telemetria-demo-<ts>" descartável só pra ter um sessao_id
// que satisfaz a FK de telemetry_samples.
//
// NÃO amarra ao fluxo real de stint (isso é MS-2.3). NÃO usa
// background mode (MS-2.2). NÃO conecta ao Detector (MS-2.6).
//
// Acesso: launch arg `--p1-telemetria` ou rota direta.

import SwiftUI
import GRDB
import P1FastCore

struct TelemetriaView: View {
    let queue: DatabaseQueue

    @StateObject private var recorder: LiveTelemetryRecorder
    @StateObject private var lowPower = LowPowerModeMonitor()
    @State private var sessaoId: String
    @State private var startedAt: Date?
    @State private var ticker = Date()
    @State private var elapsedS: TimeInterval = 0
    @State private var lastStopCount: Int = 0

    init(queue: DatabaseQueue) {
        self.queue = queue
        let id = "telemetria-demo-\(Int(Date().timeIntervalSince1970))"
        _sessaoId = State(initialValue: id)
        _recorder = StateObject(wrappedValue: LiveTelemetryRecorder(
            queue: queue,
            sessaoId: id,
            timeId: "local-default-team"
        ))
    }

    var body: some View {
        VStack(spacing: Spacing.lg) {
            header
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
            row("Amostras gravadas", "\(recorder.sampleCount)")
            row("IMU", String(format: "%.1f Hz · jitter %.2f ms",
                              recorder.imuHz, recorder.imuJitterMs))
            row("GPS", String(format: "%.1f Hz · jitter %.0f ms",
                              recorder.gpsHz, recorder.gpsJitterMs))
            if let err = recorder.lastError {
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
        Button(action: toggle) {
            Text(recorder.running ? "PARAR" : "INICIAR")
                .font(Font.titleP1)
                .foregroundColor(.surface)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(recorder.running ? Color.rec : Color.accent)
                .cornerRadius(Radius.md)
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Sessão: \(sessaoId)")
                .font(Font.captionP1)
                .foregroundColor(.textFaint)
            if lastStopCount > 0 {
                Text("Última captura: \(lastStopCount) amostras gravadas em telemetry_samples")
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

    // MARK: - Actions

    private func toggle() {
        if recorder.running {
            Task {
                await recorder.stop()
                lastStopCount = recorder.sampleCount
                startedAt = nil
                elapsedS = 0
            }
        } else {
            Task {
                await ensureSessao()
                recorder.start()
                startedAt = Date()
            }
        }
    }

    /// Cria a sessao demo idempotente. Time `local-default-team` é
    /// criado pelos repos canônicos no boot do app — aqui só inserimos
    /// a Sessao (FK pro time já existe).
    private func ensureSessao() async {
        do {
            try await queue.write { db in
                if try Sessao.fetchOne(db, key: sessaoId) == nil {
                    try Sessao(
                        id: sessaoId,
                        timeId: "local-default-team",
                        eventoId: nil,
                        carroId: nil,
                        pilotoId: nil,
                        configuracaoId: nil,
                        status: "ativa",
                        dataInicio: DB.nowMs(),
                        dataFim: nil,
                        voltasPlanejadas: 0,
                        objetivo: "Telemetria demo (MS-2.1)"
                    ).insert(db)
                }
            }
        } catch {
            recorder.objectWillChange.send()
        }
    }

    private func format(_ s: TimeInterval) -> String {
        String(format: "%.1f", s)
    }
}
