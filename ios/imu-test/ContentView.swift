// ═══════════════════════════════════════════════════════════
// ContentView — UMA tela: 4 KPIs + leituras vivas + 2 botões
// ═══════════════════════════════════════════════════════════
// Sem ícones. Texto puro. Layout vertical SwiftUI.

import SwiftUI

struct ContentView: View {
    @StateObject private var capture = CaptureService()
    @State private var shareURL: URL?
    @State private var showShare = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header

            // ── 4 KPIs ─────────────────────────────
            HStack(spacing: 16) {
                kpi(label: "IMU Hz",       value: fmt(capture.imuHz, "%.1f"),  ok: capture.imuHz >= 50)
                kpi(label: "IMU jitter ms",value: fmt(capture.imuJitterMs, "%.1f"), ok: capture.imuJitterMs < 5)
            }
            HStack(spacing: 16) {
                kpi(label: "GPS Hz",       value: fmt(capture.gpsHz, "%.2f"),  ok: capture.gpsHz >= 1)
                kpi(label: "GPS jitter ms",value: fmt(capture.gpsJitterMs, "%.0f"), ok: capture.gpsJitterMs < 200)
            }

            // ── leituras vivas ─────────────────────
            VStack(alignment: .leading, spacing: 8) {
                Text("LEITURAS").font(.caption).foregroundColor(.secondary)
                row("accLong",  fmt(capture.lastImu?.accLong, "%.3f m/s²"))
                row("accLat",   fmt(capture.lastImu?.accLat,  "%.3f m/s²"))
                row("accVert",  fmt(capture.lastImu?.accVert, "%.3f m/s²"))
                row("lat",      fmt(capture.lastGps?.lat,     "%.6f"))
                row("lng",      fmt(capture.lastGps?.lng,     "%.6f"))
                row("speed",    fmt(capture.lastGps?.speed,   "%.2f m/s"))
                row("gpsAcc",   fmt(capture.lastGps?.gpsAcc,  "%.1f m"))
                row("amostras", "\(capture.sampleCount)")
            }
            .padding(12)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(8)

            Text(capture.permissionStatus)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()

            // ── botões ─────────────────────────────
            HStack(spacing: 12) {
                Button(capture.running ? "PARAR" : "INICIAR") {
                    capture.running ? capture.stop() : capture.start()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)

                Button("EXPORTAR CSV") {
                    if let url = capture.exportCSV() {
                        shareURL = url
                        showShare = true
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
                .disabled(capture.sampleCount == 0)
            }
        }
        .padding(20)
        .sheet(isPresented: $showShare) {
            if let url = shareURL {
                ShareSheet(items: [url])
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("P1 FAST · IMU TEST").font(.caption).foregroundColor(.secondary)
            Text("Validação ADR-018").font(.title2).bold()
        }
    }

    private func kpi(label: String, value: String, ok: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundColor(.secondary)
            Text(value).font(.system(.title, design: .rounded)).bold()
                .foregroundColor(ok ? .green : .orange)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k).foregroundColor(.secondary)
            Spacer()
            Text(v).font(.system(.body, design: .monospaced))
        }
    }

    private func fmt(_ v: Double, _ pat: String) -> String {
        String(format: pat, v)
    }
    private func fmt(_ v: Double?, _ pat: String) -> String {
        guard let v else { return "—" }
        return String(format: pat, v)
    }
}

import UIKit
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

#Preview {
    ContentView()
}
