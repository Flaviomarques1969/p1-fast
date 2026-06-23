// ═══════════════════════════════════════════════════════════
// Cockpit do Piloto — aparece ao VIRAR o celular de lado
// ═══════════════════════════════════════════════════════════
// Comportamento (decisão Flávio 22/06): NÃO tem botão. Em qualquer tela do
// app, vire o celular pra paisagem → o cockpit do piloto cobre a tela; volte
// pra vertical → some e você está exatamente onde estava (o app por baixo
// nunca é desmontado, então o estado é preservado).
//
// O cockpit em si é o MESMO da web (web/cockpit), embutido no bundle
// (Resources/Cockpit) e servido por um scheme próprio (cockpit://) num
// WKWebView real. Roda sozinho, offline, em loop de demonstração, com a luz
// de marcha e a lógica REAIS. Espelhar o carro AO VIVO é o passo seguinte
// (depende do notebook transmitindo pra nuvem + um viewer assinante).
//
// O app é retrato-travado: o cockpit não "gira" pela rotação do iOS — a gente
// detecta a posição física do aparelho e gira o conteúdo na mão pra ele ficar
// em pé na paisagem, pra qualquer lado que o celular seja virado.

import SwiftUI
import WebKit
import UIKit

// ─────────── Gatilho global por giro ───────────
// Embrulha o app inteiro: mostra o cockpit por cima quando o aparelho está
// em paisagem; esconde quando volta pra retrato.

struct CockpitOrientationGate<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @State private var paisagem = false

    var body: some View {
        ZStack {
            content()
            if paisagem {
                CockpitPilotoView()           // sem botão: sai virando o celular
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.22), value: paisagem)
        .onAppear {
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            avaliar(UIDevice.current.orientation)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            avaliar(UIDevice.current.orientation)
        }
    }

    private func avaliar(_ o: UIDeviceOrientation) {
        switch o {
        case .landscapeLeft, .landscapeRight: paisagem = true
        case .portrait, .portraitUpsideDown:  paisagem = false
        default: break   // faceUp/faceDown/unknown: mantém o estado atual
        }
    }
}

// ─────────── A tela do cockpit (girada pra paisagem) ───────────

struct CockpitPilotoView: View {
    /// Quando presente, mostra um botão "Voltar" (usado só pelo atalho de
    /// teste no simulador). Como overlay de giro, fica nil = sem botão.
    var onClose: (() -> Void)? = nil
    /// Ângulo do giro pra paisagem — ajustado pro lado pra onde o celular é
    /// virado, pra o cockpit ficar em pé dos dois lados.
    @State private var angle: Double = 90

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .topLeading) {
                CockpitWebView()
                if let onClose {
                    voltarBotao(onClose)
                        .padding(.top, 14)
                        .padding(.leading, 16)
                }
            }
            .frame(width: h, height: w)        // canvas em paisagem (lado longo = largura)
            .rotationEffect(.degrees(angle))
            .frame(width: w, height: h)        // recoloca centralizado no container retrato
        }
        .background(Color.black)
        .ignoresSafeArea()
        .onAppear {
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            aplicarAngulo(UIDevice.current.orientation)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            aplicarAngulo(UIDevice.current.orientation)
        }
    }

    private func aplicarAngulo(_ o: UIDeviceOrientation) {
        switch o {
        case .landscapeLeft:  angle = 90
        case .landscapeRight: angle = -90
        default: break        // mantém o último giro de paisagem
        }
    }

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
