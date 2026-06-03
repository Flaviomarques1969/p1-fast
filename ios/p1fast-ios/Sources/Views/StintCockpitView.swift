// ═══════════════════════════════════════════════════════════
// StintCockpitView — vista do cockpit do piloto durante o stint
// ═══════════════════════════════════════════════════════════
// 2026-05-16: rodada B — modo celular limpo + ajuste manual de
// enquadramento. Tela pura (sem botões) por padrão. Toque triplo
// no canto superior direito abre modo engenharia com:
//   - botões de ajuste fino do enquadramento (setas, zoom, reset)
//   - botão SALVAR pra persistir o ajuste em UserDefaults
//   - botão ENCERRAR STINT pra emergência (no produto final esse
//     encerramento vai ser automático quando GPS detectar carro
//     parado na zona dos boxes do mapa).
//
// 2026-05-16 noite — rodada C: ponte JS↔Swift via CockpitDataBinder.
// ENTRADA/ÁPICE/SAÍDA/FREIO recebem dados ao vivo do GPS + Kalman +
// Detector. Cinco campos sem dado real (delta, frase, stint-bar, msg
// da equipe, halo) ficam neutros/escondidos via CSS injetado.

import SwiftUI
import P1FastCore
import WebKit

// ─────────────────────────────────────────────────────────────
// Persistência do ajuste de enquadramento do cockpit.
// ─────────────────────────────────────────────────────────────
private enum CockpitAjusteUD {
    static let escalaKey = "p1.cockpit.escalaExtra.v1"
    static let dxKey = "p1.cockpit.offsetX.v1"
    static let dyKey = "p1.cockpit.offsetY.v1"

    static func carregar() -> (escala: Double, dx: Double, dy: Double) {
        let ud = UserDefaults.standard
        let escala = (ud.object(forKey: escalaKey) as? Double) ?? 1.0
        let dx = (ud.object(forKey: dxKey) as? Double) ?? 0
        let dy = (ud.object(forKey: dyKey) as? Double) ?? 0
        return (escala, dx, dy)
    }

    static func salvar(escala: Double, dx: Double, dy: Double) {
        let ud = UserDefaults.standard
        ud.set(escala, forKey: escalaKey)
        ud.set(dx, forKey: dxKey)
        ud.set(dy, forKey: dyKey)
    }
}

struct StintCockpitView: View {
    @EnvironmentObject private var coordinator: StintCaptureCoordinator
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var trackRepo: TrackRepository
    /// Pendência 2 da reformulação Autódromos (Flávio 2026-05-17):
    /// faixa de aguardo no topo do cockpit enquanto o aplicativo ainda
    /// não tem 3 voltas válidas com o carro+config do stint.
    @State private var voltasContadasParaPontosDinamicos: Int = 0

    // Rodada C — ponte JS↔Swift. Binder vive enquanto a tela existe.
    // Atacha ao coordinator depois do `start(...)` (processor/bridge
    // só existem após a captura ligar).
    @StateObject private var binder = CockpitDataBinder()

    let stintId: String
    let contextoLinha: String
    let onFinalized: (String) -> Void
    let onCancel: () -> Void

    @State private var encerrando = false
    @State private var encerrarErro: String?
    @State private var mostrarEngenharia = false

    // Ajuste de enquadramento — começa carregando o que foi salvo.
    @State private var escalaExtra: Double
    @State private var offsetX: Double
    @State private var offsetY: Double
    @State private var ajusteSalvoFeedback = false

    init(
        stintId: String,
        contextoLinha: String,
        onFinalized: @escaping (String) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.stintId = stintId
        self.contextoLinha = contextoLinha
        self.onFinalized = onFinalized
        self.onCancel = onCancel
        // 2026-05-21 (Flávio): IGNORA valores antigos do UserDefaults
        // (de quando o modo engenharia existia). Cockpit sempre centralizado
        // com escala calculada pela viewport. Tirei a leitura do ajuste salvo
        // porque sessões anteriores podiam ter deslocado o cockpit pro canto.
        _escalaExtra = State(initialValue: 1.0)
        _offsetX = State(initialValue: 0)
        _offsetY = State(initialValue: 0)
        // Limpa do UserDefaults pra não persistir valores antigos.
        UserDefaults.standard.removeObject(forKey: CockpitAjusteUD.escalaKey)
        UserDefaults.standard.removeObject(forKey: CockpitAjusteUD.dxKey)
        UserDefaults.standard.removeObject(forKey: CockpitAjusteUD.dyKey)
    }

    var body: some View {
        ZStack {
            CockpitWebView(
                escalaExtra: escalaExtra,
                offsetX: offsetX,
                offsetY: offsetY,
                binder: binder
            )
            .ignoresSafeArea()

            if mostrarEngenharia {
                painelEngenharia
            }
        }
        .overlay(alignment: .top) {
            faixaAguardoPontosDinamicos
        }
        // 2026-05-21 (Flávio): tela do cockpit é FIXA — só visualização.
        // Sem zona invisível de 3 toques, sem modo engenharia. Pra sair
        // o usuário gira o iPhone pra vertical (StintRodandoView troca
        // pra StintCaptureView que tem ENCERRAR STINT).
        .preferredColorScheme(.dark)
        .task { ligarCaptura() }
        .task(id: stintId) { await atualizarContadorVoltasParaPontos() }
        .statusBar(hidden: true)
        // OrientationLock controlado pelo StintRodandoView (wrapper). Esta
        // view não força orientação — quem decide é o iPhone real.
    }

    /// Pendência 2 — faixa fina no topo. Aparece enquanto faltam voltas
    /// pra ativar o cálculo dos pontos dinâmicos do carro+config atuais.
    /// Some quando completa 3 voltas válidas.
    @ViewBuilder
    private var faixaAguardoPontosDinamicos: some View {
        if voltasContadasParaPontosDinamicos < 3 {
            Text("Aguardando completar 3 voltas para os dados — \(voltasContadasParaPontosDinamicos)/3")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Color.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 4)
                .background(
                    Capsule().fill(Color.atencao.opacity(0.85))
                )
                .padding(.top, 6)
        }
    }

    /// Conta voltas válidas com carro+config do stint atual, no time atual.
    @MainActor
    private func atualizarContadorVoltasParaPontos() async {
        do {
            let sessao = try await stintRepo.fetchSessaoCompleta(id: stintId)
            guard let cid = sessao?.carroId, let cfg = sessao?.configuracaoId else {
                voltasContadasParaPontosDinamicos = 0
                return
            }
            let q = stintRepo.queue
            let n = try await q.read { db in
                try Int.fetchOne(db, sql: """
                    SELECT COUNT(*) FROM voltas v
                    JOIN sessoes s ON s.id = v.sessao_id
                    WHERE s.carro_id = ? AND s.configuracao_id = ? AND v.valida = 1
                """, arguments: [cid, cfg]) ?? 0
            }
            voltasContadasParaPontosDinamicos = n
        } catch {
            voltasContadasParaPontosDinamicos = 0
        }
    }

    // ─────────────────────────────────────────────────────────
    // Painel do modo engenharia
    // ─────────────────────────────────────────────────────────
    private var painelEngenharia: some View {
        VStack(spacing: 12) {
            // Linha de cima: ajuste de posição + zoom + reset + salvar
            HStack(spacing: 6) {
                ajusteBotao("←") { offsetX -= 10 }
                ajusteBotao("→") { offsetX += 10 }
                ajusteBotao("↑") { offsetY -= 10 }
                ajusteBotao("↓") { offsetY += 10 }
                ajusteBotao("−") { escalaExtra = max(0.30, escalaExtra - 0.02) }
                ajusteBotao("+") { escalaExtra = min(3.00, escalaExtra + 0.02) }
                ajusteBotao("↺") {
                    escalaExtra = 1.0
                    offsetX = 0
                    offsetY = 0
                }
                Button(action: salvarAjuste) {
                    Text(ajusteSalvoFeedback ? "✓ salvo" : "salvar")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.accent)
                        )
                }
                .buttonStyle(.plain)
            }

            // Texto pequeno com valores atuais (referência).
            Text(String(
                format: "zoom %.2f · esq/dir %+.0f · cima/baixo %+.0f",
                escalaExtra, offsetX, offsetY
            ))
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundStyle(Color.textFaint)

            Spacer()

            // Botões de encerrar e cancelar na base.
            if let erro = encerrarErro {
                Text(erro)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color.surface.opacity(0.85)))
            }

            Button(action: encerrar) {
                Text(encerrando ? "Encerrando…" : "ENCERRAR STINT")
                    .font(.system(size: 16, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(Color.onAccent)
                    .frame(maxWidth: 360, minHeight: 52)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.rec)
                    )
            }
            .buttonStyle(.plain)
            .disabled(encerrando)

            Button(action: onCancel) {
                Text("Cancelar (sem encerrar)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.textFaint)
                    .padding(.vertical, 5)
                    .padding(.horizontal, 12)
                    .background(Capsule().fill(Color.surface.opacity(0.7)))
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 12)
        .padding(.bottom, 18)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func ajusteBotao(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.text)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surface.opacity(0.85))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func salvarAjuste() {
        CockpitAjusteUD.salvar(escala: escalaExtra, dx: offsetX, dy: offsetY)
        ajusteSalvoFeedback = true
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run { ajusteSalvoFeedback = false }
        }
    }

    private func ligarCaptura() {
        guard !coordinator.running else {
            // Stint já estava ativo (volta na tela): ainda assim conecta
            // o binder ao coordinator atual pra esta tela receber dados.
            binder.attach(coordinator: coordinator)
            return
        }
        // Rodada C: passa o trackBundle pro Detector ligar. Se a pista
        // não estiver cadastrada no banco local (`currentTrack()` = nil),
        // segue em modo "C1 puro" — ENTRADA mostra velocidade atual,
        // outros campos ficam em "—".
        let bundle = trackRepo.currentTrack()
        coordinator.start(
            stintId: stintId,
            trackBundle: bundle
        )
        binder.attach(coordinator: coordinator)
    }

    private func encerrar() {
        guard !encerrando else { return }
        encerrando = true
        encerrarErro = nil
        Task {
            // Desconecta o binder antes de parar — evita receber eventos
            // depois que o processor/bridge sumiram.
            binder.detach()
            let events = await coordinator.stop()
            do {
                _ = try await stintRepo.finalize(stintId: stintId, segmentEvents: events)
                await MainActor.run {
                    encerrando = false
                    onFinalized(stintId)
                }
            } catch {
                await MainActor.run {
                    encerrando = false
                    encerrarErro = "Não consegui finalizar: \(error.localizedDescription)"
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// CockpitWebView — wrapper UIViewRepresentable do WKWebView que
// carrega o HTML canônico do bundle do app. Aceita parâmetros
// de ajuste manual; updateUIView reaplica o ajuste via JS.
// ─────────────────────────────────────────────────────────────
private struct CockpitWebView: UIViewRepresentable {
    let escalaExtra: Double
    let offsetX: Double
    let offsetY: Double
    let binder: CockpitDataBinder

    // Script base injetado no .atDocumentStart:
    //  - Substitui o viewport meta do canônico (que declara largura 956pt)
    //    pela largura real do iPhone — sem isso a escala automática não
    //    funciona, porque window.innerWidth devolveria 956 e não a tela.
    //  - Esconde elementos de apoio do mockup (legenda, controles de demo,
    //    shift light, alertas críticos vermelhos).
    //  - Remove moldura/sombra/anel/margem do "aparelho desenhado".
    //  - Define window.p1Calibrar(escalaExtra, dx, dy) que o Swift chama
    //    cada vez que o ajuste muda no painel.
    //  - Rodada C: define window.p1AtualizarCockpit({...}) que o
    //    CockpitDataBinder chama 10x/s pra atualizar ENTRADA, ÁPICE,
    //    SAÍDA, FREIO. Esconde/neutraliza 5 campos sem dado real
    //    (delta, frase pedagógica, stint-bar, mensagem da equipe, halo).
    private static let modoCelularCSS = """
    (function(){
      function ajustarViewport(){
        var meta = document.querySelector('meta[name="viewport"]');
        if(!meta){
          meta = document.createElement('meta');
          meta.setAttribute('name','viewport');
          (document.head || document.documentElement).appendChild(meta);
        }
        meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
      }
      ajustarViewport();

      var css = [
        '.shift-light{display:none !important;}',
        '.alert-bloco[data-tipo="grave"]{display:none !important;}',
        '.fire-overlay{display:none !important;}',
        '.legend{display:none !important;}',
        '.controls{display:none !important;}',
        'html,body{padding:0 !important;margin:0 !important;overflow:hidden !important;background:#000 !important;height:100% !important;width:100% !important;display:block !important;}',
        '.device{border-radius:0 !important;border:0 !important;box-shadow:none !important;position:absolute !important;left:0 !important;top:0 !important;transform-origin:0 0 !important;}',
        /* Rodada C3 — neutraliza 5 campos sem dado real. */
        /* Esconde a mensagem azul (Pneu DD...) — só volta com Realtime (rodada H). */
        '.alert-bloco{display:none !important;}',
        /* Esconde delta + frase pedagógica — só voltam com banco de melhor volta (rodada F) e frases oficiais (rodada G). */
        '.info-bloco{display:none !important;}',
        /* Esconde stint bar — depende de histórico de voltas (rodada F). */
        '.stint-bar{display:none !important;}',
        /* Halo sempre neutro até a rodada F decidir recorde/pior. */
        '.device{--halo-cor: transparent !important; background:#0c0f14 !important;}'
      ].join('');
      var style = document.createElement('style');
      style.id = 'p1fast-modo-celular';
      style.appendChild(document.createTextNode(css));
      (document.head || document.documentElement).appendChild(style);

      window.__p1Ajuste = { escalaExtra: 1.0, offsetX: 0, offsetY: 0 };
      window.p1Calibrar = function(escalaExtra, offsetX, offsetY){
        window.__p1Ajuste = {
          escalaExtra: escalaExtra,
          offsetX: offsetX,
          offsetY: offsetY
        };
        aplicarTransform();
      };
      function aplicarTransform(){
        var device = document.getElementById('device');
        if(!device) return false;
        var w = window.innerWidth || document.documentElement.clientWidth;
        var h = window.innerHeight || document.documentElement.clientHeight;
        // Só aplica se a janela já tem tamanho real. Senão, retorna false
        // pro polling continuar tentando.
        if(w < 100 || h < 100) return false;
        var escalaBase = Math.min(w / 956, h / 440);
        var escalaFinal = escalaBase * window.__p1Ajuste.escalaExtra;
        // Calcula offset em pixels reais da viewport pra centralizar o
        // cockpit. Evita translate em % que dependia do tamanho do próprio
        // elemento — mais previsível.
        var translateX = (w - 956 * escalaFinal) / 2 + window.__p1Ajuste.offsetX;
        var translateY = (h - 440 * escalaFinal) / 2 + window.__p1Ajuste.offsetY;
        device.style.transform =
          'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + escalaFinal + ')';
        return true;
      }
      // Polling a cada 30ms por até 18 segundos até conseguir aplicar.
      // O script injeta em .atDocumentStart e o WebView pode levar um tempo
      // pra reportar o tamanho real (window.innerWidth volta 0 no início).
      var tentativas = 0;
      function tentarAplicar(){
        if(aplicarTransform()) return;
        if(tentativas++ < 600) setTimeout(tentarAplicar, 30);
      }
      tentarAplicar();
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', aplicarTransform);
      }
      window.addEventListener('load', aplicarTransform);
      // 2026-05-21 (Flávio): resize/ResizeObserver removidos — estavam
      // re-aplicando transform em cada toque na tela (clicks geram tap
      // events que afetam viewport temporariamente no WebKit), o que
      // fazia o conteúdo "pular". Mantemos só orientationchange e o
      // polling inicial — tamanho real do WebView estabiliza em <500ms.
      window.addEventListener('orientationchange', aplicarTransform);

      // Para todos os simuladores internos do mockup canônico depois da
      // página carregar. O mockup dispara auto-loop de shift light, mensagens
      // e troca de halo automaticamente — no celular isso brigaria com os
      // dados reais que a rodada C vai injetar. Limpamos todos os timers
      // ativos da página assim que o load termina. Os timers nossos (do
      // aplicativo) são adicionados DEPOIS deste ponto, então não são afetados.
      function pararSimuladores(){
        try {
          var idMax = window.setTimeout(function(){}, 0);
          for(var i = 0; i <= idMax; i++){
            window.clearTimeout(i);
            window.clearInterval(i);
          }
          var device = document.getElementById('device');
          if(device){
            device.dataset.shiftFire = 'idle';
            device.dataset.msgState = 'oculta';
          }
        } catch(e) {}
      }
      if(document.readyState === 'complete'){
        pararSimuladores();
      } else {
        window.addEventListener('load', pararSimuladores);
      }

      // ─────────────────────────────────────────────────────────
      // Rodada C — ponte de dados ao vivo.
      // window.p1AtualizarCockpit({ entradaKmh, apiceKmh, saidaKmh, freioMetrosAtual })
      // O Swift (CockpitDataBinder) chama esta função até 10x/s.
      // Cada campo aceita número ou null. null → mostra "—".
      // ─────────────────────────────────────────────────────────
      function escolherPontos(){
        return {
          entrada: document.querySelector('.apex__ponto:nth-child(1) .apex__valor'),
          freio:   document.querySelector('.apex__ponto[data-papel="freio"] .apex__valor'),
          apice:   document.querySelector('.apex__ponto:nth-child(3) .apex__valor'),
          saida:   document.querySelector('.apex__ponto:nth-child(4) .apex__valor')
        };
      }
      var pontosCache = null;
      function pontos(){
        if(pontosCache && pontosCache.entrada && pontosCache.entrada.isConnected) return pontosCache;
        pontosCache = escolherPontos();
        return pontosCache;
      }
      function formatarKmh(v){
        if(v === null || v === undefined || isNaN(v)){
          return '—';
        }
        return Math.round(v) + '<small>km/h</small>';
      }
      function formatarFreioM(atual){
        if(atual === null || atual === undefined || isNaN(atual)){
          return '—';
        }
        return Math.round(atual) + '<small>m</small>';
      }
      window.p1AtualizarCockpit = function(estado){
        try {
          var p = pontos();
          if(estado.hasOwnProperty('entradaKmh') && p.entrada){
            p.entrada.innerHTML = formatarKmh(estado.entradaKmh);
          }
          if(estado.hasOwnProperty('apiceKmh') && p.apice){
            p.apice.innerHTML = formatarKmh(estado.apiceKmh);
          }
          if(estado.hasOwnProperty('saidaKmh') && p.saida){
            p.saida.innerHTML = formatarKmh(estado.saidaKmh);
          }
          if(estado.hasOwnProperty('freioMetrosAtual') && p.freio){
            p.freio.innerHTML = formatarFreioM(estado.freioMetrosAtual);
          }
        } catch(e) {
          // Falha silenciosa — Swift não trata erro deste lado, e
          // qualquer exceção aqui só serviria pra poluir o console.
        }
      };
      // Inicializa cockpit com 4 campos em "—" — placeholders honestos
      // até o primeiro EnrichedSample chegar (Fase 1 a pé: <1s após
      // abrir a tela).
      function inicializarVazio(){
        try {
          window.p1AtualizarCockpit({
            entradaKmh: null, apiceKmh: null,
            saidaKmh: null, freioMetrosAtual: null
          });
        } catch(e) {}
      }
      if(document.readyState === 'complete'){
        inicializarVazio();
      } else {
        window.addEventListener('load', inicializarVazio);
      }

      // Log mínimo pro Swift saber que a ponte está viva (visto no
      // log de syslog do dispositivo quando o cockpit abre).
      try {
        if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.p1Bridge){
          window.webkit.messageHandlers.p1Bridge.postMessage({ tipo: 'ponte-pronta' });
        }
      } catch(e) {}
    })();
    """

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let userScript = WKUserScript(
            source: Self.modoCelularCSS,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(userScript)
        // Rodada C — handler que recebe mensagens do JS (só pra log
        // "ponte pronta" hoje; espaço pra futuras chamadas JS→Swift).
        config.userContentController.add(context.coordinator, name: "p1Bridge")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bouncesZoom = false
        webView.backgroundColor = UIColor.black
        webView.isOpaque = false
        webView.scrollView.backgroundColor = UIColor.black
        // Rodada C — entrega a referência do WebView pro binder, que
        // a partir daqui pode chamar evaluateJavaScript a cada novo
        // EnrichedSample / segmentStart / segmentEnd.
        binder.setWebView(webView)
        carregar(webView: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.ajusteAtual = (escalaExtra, offsetX, offsetY)
        let js = "if(window.p1Calibrar) window.p1Calibrar(\(escalaExtra), \(offsetX), \(offsetY));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        // Quando a tela é destruída, remove o handler e desliga o binder
        // pra evitar callbacks numa view morta.
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "p1Bridge")
        coordinator.parent.binder.setWebView(nil)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: CockpitWebView
        var ajusteAtual: (escala: Double, dx: Double, dy: Double)

        init(parent: CockpitWebView) {
            self.parent = parent
            self.ajusteAtual = (parent.escalaExtra, parent.offsetX, parent.offsetY)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Quando a página termina de carregar, reaplica o ajuste atual.
            // Isso garante o auto-enquadramento sem depender só do JS interno
            // de polling — fecha o gap entre o load e o primeiro frame.
            let a = ajusteAtual
            let js = "if(window.p1Calibrar) window.p1Calibrar(\(a.escala), \(a.dx), \(a.dy));"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }

        // Rodada C — recebe mensagens do JS. Hoje só "ponte-pronta"
        // pra confirmar no log que a página carregou e a função
        // p1AtualizarCockpit existe. Futuro: cliques, status, etc.
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            #if DEBUG
            print("[CockpitBridge] mensagem JS:", message.body)
            #endif
        }
    }

    private func carregar(webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "cockpit-piloto", withExtension: "html") else {
            webView.loadHTMLString(
                "<html><body style='background:#000;color:#fff;font-family:system-ui;padding:20px'>cockpit-piloto.html não foi encontrado no pacote do app. Próxima rodada conserta.</body></html>",
                baseURL: nil
            )
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
}
