// ═══════════════════════════════════════════════════════════
// Cockpit do Piloto — aparece ao VIRAR o celular de lado
// ═══════════════════════════════════════════════════════════
// Comportamento (decisão Flávio 22/06): NÃO tem botão. Em qualquer tela do
// app, vire o celular pra paisagem → o cockpit cobre a tela; volte pra
// vertical → some e você está onde estava (o app por baixo nunca desmonta).
//
// COMO O GIRO FUNCIONA: o app fica TRAVADO em retrato. O OrientationGate
// detecta o giro FÍSICO pelo acelerômetro e o ContentView SOBREPÕE esta tela.
// Aqui a gente gira o conteúdo na mão (rotationEffect) pelo ângulo que o gate
// mandou, e centraliza no CENTRO FÍSICO da tela (ignorando a área segura, pra
// o centro não escorregar pro lado por causa do entalhe). Confiável no
// aparelho real, sem depender da rotação nativa do iOS.
//
// O cockpit é o painel APROVADO da web (cockpit-volta-real.html), embutido no
// bundle (Resources/Cockpit) e servido por scheme próprio (cockpit://) num
// WKWebView. Roda a volta real (replay) com luz de marcha, cluster de sensores,
// luzes de freio, ápice, frase do coach e mensagens críticas.

import SwiftUI
import WebKit
import UIKit

struct CockpitPilotoView: View {
    /// Graus pra girar o conteúdo e deixá-lo EM PÉ na paisagem (+90/-90).
    /// Default 90 só pro atalho de teste (--p1-cockpit).
    var angle: Double = 90
    /// Botão "Voltar" só no atalho de teste; no fluxo por giro fica nil.
    var onClose: (() -> Void)? = nil

    var body: some View {
        // Centralizado na TELA FÍSICA (ignoresSafeArea) com folga SIMÉTRICA igual
        // nos 4 lados: como o painel tem a mesma proporção da tela, uma borda fina
        // e IGUAL mantém o todo CENTRADO (sem jogar pra um lado) e tira as pontas
        // (ex.: SAÍDA) de cima da quina arredondada/ilha do iPhone.
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let p = cockpitFolga             // folga simétrica p/ as pontas não baterem na borda física
            ZStack {
                Color.black
                ZStack(alignment: .topLeading) {
                    CockpitWebView()
                    if let onClose {
                        voltarBotao(onClose)
                            .padding(.top, 14)
                            .padding(.leading, 16)
                    }
                }
                .frame(width: max(h - 2 * p, 0), height: max(w - 2 * p, 0))
                .rotationEffect(.degrees(angle))
                .frame(width: w, height: h)
            }
            .frame(width: w, height: h)
        }
        .ignoresSafeArea()
        .statusBarHidden(true)
    }

    /// Folga simétrica (pontos) pra as pontas do painel não ficarem sob a quina
    /// arredondada/ilha do iPhone. Ajuste fino aqui se o Flávio pedir mais/menos.
    /// 46→18 (Flávio 11/07): explorar a tela toda; o canto arredondado do próprio
    /// painel absorve a quina do aparelho.
    private var cockpitFolga: CGFloat { 18 }

    private func voltarBotao(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .bold))
                Text("Voltar")
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Capsule().fill(Color.black.opacity(0.55)))
            .overlay(Capsule().stroke(Color.white.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// ─────────── WKWebView que serve o cockpit embutido ───────────

private struct CockpitWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(CockpitSchemeHandler(), forURLScheme: CockpitSchemeHandler.scheme)

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        wv.scrollView.bouncesZoom = false
        wv.scrollView.minimumZoomScale = 1
        wv.scrollView.maximumZoomScale = 1
        wv.scrollView.pinchGestureRecognizer?.isEnabled = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        // É um PAINEL fixo (só mostra) — sem zoom, sem arrastar, sem toque.
        // Isso resolve o "parece uma imagem que dá pra dar zoom".
        wv.isUserInteractionEnabled = false
        if #available(iOS 16.4, *) { wv.isInspectable = true }

        if let url = URL(string: "\(CockpitSchemeHandler.scheme)://app/cockpit-app.html") {
            wv.load(URLRequest(url: url))
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// ─────────── Servidor local dos arquivos do cockpit ───────────
// Serve Resources/Cockpit/* sob o scheme cockpit://. Um scheme próprio (em vez
// de file://) dá uma origem válida — sem isso os `import` ES e os `fetch()`
// dos JSON quebrariam por CORS de file://.

final class CockpitSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "cockpit"

    private static let root: URL? =
        Bundle.main.resourceURL?.appendingPathComponent("Cockpit", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let root = Self.root else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        var rel = url.path
        if rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty { rel = "cockpit-app.html" }

        let fileURL = root.appendingPathComponent(rel)
        guard let data = try? Data(contentsOf: fileURL) else {
            let resp = HTTPURLResponse(url: url, statusCode: 404,
                                       httpVersion: "HTTP/1.1", headerFields: nil)!
            task.didReceive(resp)
            task.didFinish()
            return
        }

        let resp = HTTPURLResponse(
            url: url, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.mime(for: fileURL.pathExtension),
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
            ])!
        task.didReceive(resp)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js":   return "text/javascript; charset=utf-8"
        case "css":  return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg":  return "image/svg+xml"
        default:     return "application/octet-stream"
        }
    }
}

#Preview("Cockpit do Piloto") {
    CockpitPilotoView(angle: 90, onClose: {})
}
