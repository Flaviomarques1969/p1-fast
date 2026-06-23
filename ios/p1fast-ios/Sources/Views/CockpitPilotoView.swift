// ═══════════════════════════════════════════════════════════
// CockpitPilotoView — o MESMO cockpit do piloto, no iPhone
// ═══════════════════════════════════════════════════════════
// Mostra, dentro do app, a tela IDÊNTICA à que o piloto vê: o cockpit web
// canônico (web/cockpit) embutido no bundle (Resources/Cockpit) e servido
// por um scheme próprio (cockpit://) num WKWebView real.
//
// Por que a vitrine e não a página ao vivo: index-t3000.html é a página do
// NOTEBOOK (lê a injeção pela USB via "Autorizar", WebSerial) — não roda no
// iPhone. A vitrine roda sozinha, offline, em loop de demonstração, com a luz
// de marcha e a lógica REAIS. Espelhar o carro AO VIVO é o passo seguinte
// (depende do notebook transmitindo pra nuvem + um viewer assinante).
//
// O app é retrato-travado e o cockpit é paisagem (tela de 10,5"). Por isso a
// tela GIRA o conteúdo: vire o celular de lado e o cockpit fica em pé, cheio.

import SwiftUI
import WebKit

struct CockpitPilotoView: View {
    let onClose: () -> Void
    /// Ângulo do giro pra paisagem. Ajustado conforme o lado pra onde o
    /// celular é virado (o app não gira sozinho — é travado em retrato).
    @State private var angle: Double = 90

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .topLeading) {
                CockpitWebView()
                voltarBotao
                    .padding(.top, 14)
                    .padding(.leading, 16)
            }
            .frame(width: h, height: w)        // canvas em paisagem (lado longo = largura)
            .rotationEffect(.degrees(angle))
            .frame(width: w, height: h)        // recoloca centralizado no container retrato
        }
        .background(Color.black)
        .ignoresSafeArea()
        .navigationBarBackButtonHidden(true)
        .onAppear { UIDevice.current.beginGeneratingDeviceOrientationNotifications() }
        .onDisappear { UIDevice.current.endGeneratingDeviceOrientationNotifications() }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            switch UIDevice.current.orientation {
            case .landscapeLeft:  angle = 90
            case .landscapeRight: angle = -90
            default: break        // retrato/face up/down: mantém o último giro de paisagem
            }
        }
    }

    private var voltarBotao: some View {
        Button(action: onClose) {
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
        // Registra o scheme ANTES de criar a WebView (regra do WKWebView).
        config.setURLSchemeHandler(CockpitSchemeHandler(), forURLScheme: CockpitSchemeHandler.scheme)

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { wv.isInspectable = true }  // permite inspecionar pelo Safari em dev

        if let url = URL(string: "\(CockpitSchemeHandler.scheme)://app/cockpit-app.html") {
            wv.load(URLRequest(url: url))
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// ─────────── Servidor local dos arquivos do cockpit ───────────
// Serve Resources/Cockpit/* sob o scheme cockpit://. Um scheme próprio (em vez
// de file://) dá uma origem válida — sem isso os `import` dos módulos ES
// quebrariam por CORS de file://.

final class CockpitSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "cockpit"

    /// Pasta Cockpit dentro do bundle do app (referência de pasta azul).
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
            // Arquivo ausente (ex.: o fetch opcional dos nomes de curva): 404
            // limpo. O JS da vitrine já tem fallback offline pra esse caso.
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
        case "js":   return "text/javascript; charset=utf-8"   // type="module" exige MIME de JS
        case "css":  return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg":  return "image/svg+xml"
        default:     return "application/octet-stream"
        }
    }
}

#Preview("Cockpit do Piloto") {
    CockpitPilotoView(onClose: {})
}
