// ═══════════════════════════════════════════════════════════
// Cockpit do Piloto — aparece ao VIRAR o celular de lado
// ═══════════════════════════════════════════════════════════
// Comportamento (decisão Flávio 22/06): NÃO tem botão. Em qualquer tela do
// app, vire o celular pra paisagem → o cockpit do piloto cobre a tela; volte
// pra vertical → some e você está exatamente onde estava (o app por baixo
// nunca é desmontado, então o estado é preservado).
//
// COMO O GIRO FUNCIONA: rotação NATIVA do iOS. O app é travado em retrato, mas
// o OrientationGate (+ AppDelegate) destrava a paisagem só pra esta tela e o
// iOS gira de verdade. Por isso o WKWebView recebe um frame paisagem REAL e o
// cockpit se centraliza sozinho — sem girar a view na mão (que ficava torto).
// A apresentação (fullScreenCover dirigido pelo giro físico) vive no ContentView.
//
// O cockpit é o painel APROVADO da web (web/cockpit/cockpit-volta-real.html),
// embutido no bundle (Resources/Cockpit) e servido por um scheme próprio
// (cockpit://) num WKWebView real. Roda a sua volta real (replay) com a luz de
// marcha, cluster de sensores, luzes de freio, ápice, frase do coach e
// mensagens críticas. Espelhar o carro AO VIVO é o passo seguinte.

import SwiftUI
import WebKit
import UIKit

struct CockpitPilotoView: View {
    /// Botão "Voltar" só aparece quando há onClose (atalho de teste no
    /// simulador, --p1-cockpit). No fluxo por giro fica nil = sem botão.
    var onClose: (() -> Void)? = nil

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Fundo preto cobre entalhe (ilha dinâmica) e cantos.
            Color.black.ignoresSafeArea()

            // O WKWebView respeita a área segura → o cockpit fica centralizado
            // na parte visível, livre do entalhe e do indicador de baixo, e
            // equilibrado nos dois lados na horizontal. Sem rotação, sem frame
            // trocado: o iOS já entregou a janela em paisagem nativa.
            CockpitWebView()

            if let onClose {
                voltarBotao(onClose)
                    .padding(.top, 14)
                    .padding(.leading, 16)
            }
        }
        .statusBarHidden(true)                     // tira o relógio que invadia o cockpit
        .preferredColorScheme(.dark)
        // Com o cover JÁ na tela, re-pede a rotação pro iOS girar na hora
        // (sem o atraso de quando o pedido sai antes do cover existir).
        .onAppear { OrientationGate.shared.reassert() }
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
// de file://) dá uma origem válida — sem isso os `import` dos módulos ES e os
// fetch() dos JSON quebrariam por CORS de file://.

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
