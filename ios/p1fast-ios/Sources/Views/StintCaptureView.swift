// ═══════════════════════════════════════════════════════════
// StintCaptureView — UI mínima de stint ativo (MS-2.5 wire)
// ═══════════════════════════════════════════════════════════
// Mostrada após StintModalView.onCreated. Liga o
// StintCaptureCoordinator no .task com o stintId recém-criado +
// trackBundle do TrackRepository, exibe métricas vivas (sample
// count, IMU/GPS Hz, fix, voltas, segments capturados) e oferece
// botão "ENCERRAR STINT" que dispara stop → finalize.
//
// `finalize(stintId:, segmentEvents:)` aceita o segundo param
// desde MS-2.5 #111. Sem coordinator, segmentEvents sempre era
// `[]`. Esta view é o caller real que liga produção a esse
// parâmetro.
//
// Visual deliberadamente simples — MS-13 (CockpitDevice 956×440)
// é a UI canônica final. Aqui é função, não forma: REC + métricas
// + ENCERRAR. Cabe num iPhone portrait sem layout especial.

import SwiftUI
import P1FastCore

struct StintCaptureView: View {
    @EnvironmentObject private var coordinator: StintCaptureCoordinator
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var trackRepo: TrackRepository

    let stintId: String
    let contextoLinha: String
    /// Disparado depois que captura para e finalize roda. Caller usa
    /// pra abrir PosStintView com o mesmo stintId.
    let onFinalized: (String) -> Void
    /// Disparado se o usuário cancelar antes mesmo da captura conseguir
    /// armar (ex: trackBundle sem GRDB). UI fecha sem finalize.
    let onCancel: () -> Void

    @State private var encerrando = false
    @State private var encerrarErro: String?
    @State private var blink = false

    var body: some View {
        VStack(spacing: Spacing.lg) {
            header
            if let gapMs = coordinator.processor?.lastGapDurationMs {
                gapBanner(gapMs: gapMs)
            }
            metrics
            actionStack
            Spacer(minLength: 0)
            footer
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .task { ligarCaptura() }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
                blink = true
            }
        }
    }

    // MARK: - Sub-views

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Stint ativo")
            Text("Captura ao vivo")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            if !contextoLinha.isEmpty {
                Text(contextoLinha)
                    .font(.system(size: 13, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textMuted)
            }
            if !coordinator.hasTrackBundle {
                Text("Pista não cadastrada — sem detector de voltas. Captura raw + Kalman segue.")
                    .font(Font.captionP1)
                    .foregroundStyle(Color.atencao)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var metrics: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            statusRow
            row("Amostras raw", "\(coordinator.recorder?.sampleCount ?? 0)")
            row(
                "Amostras enriched",
                "\(coordinator.processor?.enrichedCount ?? 0)\((coordinator.processor?.hasFix ?? false) ? " · fix" : "")"
            )
            if coordinator.hasTrackBundle {
                row(
                    "Voltas",
                    coordinator.lapCount > 0
                        ? "\(coordinator.lapCount)" + (coordinator.lastLapMs.map { String(format: " · última %.2fs", $0 / 1000) } ?? "")
                        : "—"
                )
                row("Segments capturados", "\(coordinator.capturedSegmentCount)")
            }
            row(
                "IMU",
                String(format: "%.1f Hz · jitter %.2f ms",
                       coordinator.recorder?.imuHz ?? 0,
                       coordinator.recorder?.imuJitterMs ?? 0)
            )
            row(
                "GPS",
                String(format: "%.1f Hz · jitter %.0f ms",
                       coordinator.recorder?.gpsHz ?? 0,
                       coordinator.recorder?.gpsJitterMs ?? 0)
            )
            if let err = coordinator.recorder?.lastError ?? coordinator.processor?.lastError {
                Text(err)
                    .font(Font.captionP1)
                    .foregroundStyle(Color.rec)
            }
        }
        .padding(Spacing.md)
        .background(Color.surfaceRaised)
        .cornerRadius(Radius.md)
    }

    /// A-07: aviso pro piloto que houve interrupção de captura. Exibido
    /// até o user dar dismiss (botão "ok"). Sample já foi gravado com
    /// gap_duration_ms != NULL, então debrief vê depois.
    private func gapBanner(gapMs: Double) -> some View {
        let segs = String(format: "%.1f", gapMs / 1000.0)
        return HStack(alignment: .top, spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Captura interrompida \(segs) s")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("Posição re-ancorada com o GPS atual. Voltas anteriores ao gap continuam válidas.")
                    .font(Font.captionP1)
                    .foregroundStyle(Color.textMuted)
            }
            Spacer()
            Button(action: { coordinator.processor?.acknowledgeGap() }) {
                Text("ok")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.atencao)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.atencao.opacity(0.6), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.md)
        .background(Color.surfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.atencao.opacity(0.5), lineWidth: 1)
        )
        .cornerRadius(Radius.md)
    }

    private var statusRow: some View {
        HStack {
            Text("Estado")
                .font(Font.bodyP1)
                .foregroundStyle(Color.textMuted)
            Spacer()
            HStack(spacing: 8) {
                Circle()
                    .fill(Color.rec)
                    .frame(width: 10, height: 10)
                    .opacity(coordinator.running ? (blink ? 1.0 : 0.3) : 0.2)
                Text(coordinator.running ? "REC" : "STOP")
                    .font(Font.bodyP1)
                    .foregroundStyle(coordinator.running ? Color.rec : Color.textMuted)
            }
        }
    }

    private var actionStack: some View {
        VStack(spacing: Spacing.sm) {
            Button(action: encerrar) {
                Text(encerrando ? "Encerrando…" : "ENCERRAR STINT")
                    .font(Font.titleP1)
                    .foregroundStyle(Color.surface)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(encerrando ? Color.textFaint : Color.rec)
                    .cornerRadius(Radius.md)
            }
            .disabled(encerrando)

            if let erro = encerrarErro {
                Text(erro)
                    .font(Font.captionP1)
                    .foregroundStyle(Color.rec)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Stint: \(stintId.prefix(8))…")
                .font(Font.captionP1)
                .foregroundStyle(Color.textFaint)
            Button(action: cancelar) {
                Text("Cancelar (sem encerrar)")
                    .font(Font.captionP1)
                    .foregroundStyle(Color.textMuted)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(Font.bodyP1).foregroundStyle(Color.textMuted)
            Spacer()
            Text(value).font(Font.bodyP1).foregroundStyle(Color.text)
        }
    }

    // MARK: - Actions

    private func ligarCaptura() {
        guard !coordinator.running else { return }
        coordinator.start(
            stintId: stintId,
            trackBundle: trackRepo.currentTrack()
        )
    }

    private func encerrar() {
        guard !encerrando else { return }
        encerrando = true
        encerrarErro = nil
        Task {
            let events = await coordinator.stop()
            do {
                _ = try await stintRepo.finalize(stintId: stintId, segmentEvents: events)
                encerrando = false
                onFinalized(stintId)
            } catch {
                encerrando = false
                encerrarErro = "Não consegui finalizar: \(error.localizedDescription)"
            }
        }
    }

    private func cancelar() {
        Task {
            _ = await coordinator.stop()
            onCancel()
        }
    }
}
