// ═══════════════════════════════════════════════════════════
// BuscaPrecoMLView — preço de referência do Mercado Livre
// ═══════════════════════════════════════════════════════════
// Abre a busca do Mercado Livre num navegador embutido REAL (WKWebView,
// o mesmo motor do Safari). Como é navegador de verdade, o ML não
// bloqueia (a API/raspagem crua tomava 403). Lê o preço dos anúncios
// ATIVOS (ignora os sem preço) e oferece o valor como referência.
// De graça, sem servidor e sem serviço pago. 2026-06-01, Flávio.

import SwiftUI
import WebKit

struct BuscaPrecoMLView: View {
    /// Texto da busca (nome ou código da peça).
    let termo: String
    /// Devolve o preço escolhido, em centavos.
    let onUsar: (Int) -> Void
    let onClose: () -> Void

    @State private var precoCentavos: Int?
    @State private var carregando = true

    private var urlBusca: URL {
        let q = termo.trimmingCharacters(in: .whitespacesAndNewlines)
        let enc = q.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? q
        return URL(string: "https://lista.mercadolivre.com.br/\(enc)")
            ?? URL(string: "https://www.mercadolivre.com.br")!
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                MLWebView(
                    url: urlBusca,
                    onPreco: { c in
                        if precoCentavos == nil { precoCentavos = c }
                        carregando = false
                    },
                    onFim: { carregando = false }
                )
                .ignoresSafeArea(edges: .bottom)

                rodape
            }
            .navigationTitle("Preço no Mercado Livre")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fechar", action: onClose).foregroundStyle(Color.text)
                }
            }
            .preferredColorScheme(.dark)
        }
    }

    @ViewBuilder private var rodape: some View {
        VStack(spacing: 8) {
            if let c = precoCentavos {
                Text("Preço de referência encontrado")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
                HStack {
                    Text(MoedaBR.formatar(centavos: c))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(Color.text)
                    Spacer()
                    Button {
                        onUsar(c)
                        onClose()
                    } label: {
                        Text("Usar este preço")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.onAccent)
                            .padding(.horizontal, 18).padding(.vertical, 12)
                            .background(Capsule().fill(Color.accent))
                    }
                    .buttonStyle(.plain)
                }
            } else if carregando {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Procurando o preço...")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.textMuted)
                }
            } else {
                Text("Não consegui ler o preço sozinho. Toque num produto na tela pra ver o valor e digite no cadastro.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
    }
}

// ─────────────── WKWebView que lê os preços ───────────────
private struct MLWebView: UIViewRepresentable {
    let url: URL
    let onPreco: (Int) -> Void
    let onFim: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let wv = WKWebView()
        wv.navigationDelegate = context.coordinator
        wv.load(URLRequest(url: url))
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPreco: onPreco, onFim: onFim) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let onPreco: (Int) -> Void
        private let onFim: () -> Void
        private var jaLeu = false

        init(onPreco: @escaping (Int) -> Void, onFim: @escaping () -> Void) {
            self.onPreco = onPreco
            self.onFim = onFim
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            extrair(webView, tentativa: 0)
        }

        /// Lê os preços renderizados na página (parte inteira + centavos).
        /// Tenta algumas vezes porque o conteúdo do ML carrega aos poucos.
        private func extrair(_ webView: WKWebView, tentativa: Int) {
            let js = """
            (function(){
              var els = document.querySelectorAll('.andes-money-amount__fraction');
              var out = [];
              for (var i = 0; i < els.length && out.length < 6; i++) {
                var f = els[i].textContent.replace(/\\D/g, '');
                if (!f) continue;
                var parent = els[i].parentElement;
                var centsEl = parent ? parent.querySelector('.andes-money-amount__cents') : null;
                var c = centsEl ? centsEl.textContent.replace(/\\D/g, '') : '';
                var val = parseInt(f, 10) * 100 + (c ? parseInt((c + '00').slice(0, 2), 10) : 0);
                if (val > 0) out.push(val);
              }
              return JSON.stringify(out);
            })();
            """
            webView.evaluateJavaScript(js) { [weak self] result, _ in
                guard let self else { return }
                if let s = result as? String,
                   let data = s.data(using: .utf8),
                   let arr = try? JSONDecoder().decode([Int].self, from: data),
                   !arr.isEmpty {
                    if !self.jaLeu {
                        self.jaLeu = true
                        let ordenados = arr.sorted()
                        let mediana = ordenados[ordenados.count / 2]
                        self.onPreco(mediana)
                    }
                } else if tentativa < 6 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        self.extrair(webView, tentativa: tentativa + 1)
                    }
                } else {
                    self.onFim()
                }
            }
        }
    }
}
