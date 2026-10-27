// ═══════════════════════════════════════════════════════════
// Voltas gravadas — página da volta + comparação entre 2 voltas
// ═══════════════════════════════════════════════════════════
// Item 6 da ordem do GPS (Flávio 27/10/2026, painel p1fast-gps-funcoes-0850):
// "Celular: página da volta dentro do app e comparação entre duas voltas".
//
// A tela é a página web/volta/pagina-volta.html, embutida no bundle
// (Resources/Cockpit/web/volta, cópia IDÊNTICA — a catraca
// tests/node-smoke-pagina-volta.mjs confere arquivo por arquivo pelo grafo de
// imports) e servida pelo MESMO scheme cockpit:// do Cockpit do Piloto. Toda a
// conta mora no cérebro (cerebro-pagina-volta.js); aqui só se mostra.
// Diferente do cockpit, esta tela é INTERATIVA: rola, toca na sessão, na volta,
// escolhe as 2 voltas para comparar.

import SwiftUI
import WebKit
import UIKit

struct PaginaVoltaView: View {
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onClose) {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 15, weight: .bold))
                        Text("Início")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.md)
            PaginaVoltaWebView()
        }
        .background(Color.black.ignoresSafeArea())
    }
}

// ─────────── WKWebView interativo que serve a página embutida ───────────

private struct PaginaVoltaWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(CockpitSchemeHandler(), forURLScheme: CockpitSchemeHandler.scheme)

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.scrollView.bouncesZoom = false
        wv.scrollView.minimumZoomScale = 1
        wv.scrollView.maximumZoomScale = 1
        wv.scrollView.pinchGestureRecognizer?.isEnabled = false
        if #available(iOS 16.4, *) { wv.isInspectable = true }

        if let url = URL(string: "cockpit://app/web/volta/pagina-volta.html") {
            wv.load(URLRequest(url: url))
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

#Preview("Voltas gravadas") {
    PaginaVoltaView(onClose: {})
}
