// ═══════════════════════════════════════════════════════════
// CockpitDataBinder — Rodada C do Cockpit do piloto (2026-05-16)
// ═══════════════════════════════════════════════════════════
// Ponte entre o StintCaptureCoordinator (Swift) e o cockpit-piloto.html
// dentro do WKWebView (JavaScript). Função única: empurrar os dados ao
// vivo (velocidade do GPS, eventos do Detector) pra dentro da página.
//
// Conexão:
//   - StintCockpitView cria o binder (StateObject), passa pro
//     CockpitWebView, que devolve referência fraca ao WKWebView via
//     `setWebView(_:)` no momento que o makeUIView é chamado.
//   - StintCockpitView chama `attach(coordinator:)` depois do
//     `coordinator.start(...)` — momento em que `processor`/`bridge` já
//     existem.
//
// O binder NUNCA toca o HTML canônico (`cockpit-piloto.html`). Toda
// atualização entra pela função `window.p1AtualizarCockpit({...})`
// definida no user script injetado pelo CockpitWebView.

import Foundation
import WebKit
import P1FastCore

@MainActor
final class CockpitDataBinder: ObservableObject {

    // MARK: - Estado interno

    private weak var webView: WKWebView?
    private weak var coordinator: StintCaptureCoordinator?

    // Cancelables dos handlers registrados em processor/bridge.
    private var enrichedCancel: (() -> Void)?
    private var segStartCancel: (() -> Void)?
    private var segEndCancel: (() -> Void)?

    // Throttle do envio de velocidade pro WebView (10 Hz = a cadência
    // do EnrichedSample). Sem throttle, JS recebe ~100 chamadas/s no
    // ramo IMU — desperdício, e WebView fica lento pra atualizar.
    private static let intervaloMinimoMs: Double = 100   // 10 Hz
    private var ultimoEnvioMs: Double = 0

    // Snapshot mais recente — usado pra acumular múltiplas mudanças
    // num único `evaluateJavaScript`.
    private var entradaKmh: Double?
    private var apiceKmh: Double?
    private var saidaKmh: Double?
    private var freioMetros: Double?

    // MARK: - Ciclo de vida

    /// Chamado pelo CockpitWebView no `makeUIView` (e em dismantle com nil).
    func setWebView(_ webView: WKWebView?) {
        self.webView = webView
        if webView != nil {
            // Quando a WebView nasce, manda o estado atual (ainda que vazio).
            enviarSnapshot()
        }
    }

    /// Liga handlers no coordinator (que já chamou `start(...)`).
    /// Idempotente: chamadas repetidas re-registram (cancela antes).
    func attach(coordinator: StintCaptureCoordinator) {
        self.coordinator = coordinator
        cancelarHandlers()

        // EnrichedSample (10 Hz) → ENTRADA mostra velocidade atual SEM
        // depender de detector. Em C1 (sem mapa), esse é o único dado.
        // Em C2 (com mapa), continua valendo até o detector entrar num
        // trecho — aí o `segmentStart` congela ENTRADA, e voltamos a
        // mostrar velocidade atual quando o trecho termina.
        if let processor = coordinator.processor {
            enrichedCancel = processor.addEnrichedHandler { [weak self] sample in
                Task { @MainActor in
                    self?.onEnrichedSample(sample)
                }
            }
        }

        // Eventos do detector de trecho. Só existem se o trackBundle
        // foi passado pro coordinator (`hasTrackBundle == true`).
        if let detector = coordinator.bridge?.detector {
            segStartCancel = detector.onSegmentStart { [weak self] ev in
                Task { @MainActor in
                    self?.onSegmentStart(ev)
                }
            }
            segEndCancel = detector.onSegmentEnd { [weak self] ev in
                Task { @MainActor in
                    self?.onSegmentEnd(ev)
                }
            }
        }
    }

    /// Solta handlers e limpa snapshot. Chamado pelo StintCockpitView no
    /// onDisappear (e no encerramento do stint).
    func detach() {
        cancelarHandlers()
        coordinator = nil
        entradaKmh = nil
        apiceKmh = nil
        saidaKmh = nil
        freioMetros = nil
    }

    private func cancelarHandlers() {
        enrichedCancel?(); enrichedCancel = nil
        segStartCancel?(); segStartCancel = nil
        segEndCancel?(); segEndCancel = nil
    }

    // MARK: - Handlers

    private func onEnrichedSample(_ s: EnrichedSample) {
        // Velocidade vetorial (vx, vy em m/s) → módulo em km/h.
        let velMps = (s.vxMps * s.vxMps + s.vyMps * s.vyMps).squareRoot()
        let velKmh = velMps * 3.6

        // Se o stint NÃO tem mapa carregado (modo C1 puro), ENTRADA = vel
        // atual em tempo real. Se TEM mapa, ENTRADA fica congelada pelo
        // último segmentStart — não mexemos aqui.
        if coordinator?.hasTrackBundle == false {
            entradaKmh = velKmh
        }

        // Throttle de envio — só atualiza JS no máx 10 vezes por segundo.
        let agoraMs = s.tMono
        if agoraMs - ultimoEnvioMs < Self.intervaloMinimoMs {
            return
        }
        ultimoEnvioMs = agoraMs
        enviarSnapshot()
    }

    private func onSegmentStart(_ ev: DetectorSegmentStartEvent) {
        // Entrada num trecho — congela ENTRADA, zera ÁPICE e SAÍDA do
        // trecho anterior. FREIO é populado pelo detector quando ele
        // detecta queda de velocidade > 3 m/s — vem no segmentEnd
        // (`pontoFrenagem`), não no segmentStart. Por ora deixamos FREIO
        // limpo na entrada e atualizamos no segmentEnd da próxima curva
        // (que carrega o pontoFrenagem dessa entrada).
        if let v = ev.velEntrada {
            entradaKmh = v * 3.6
        }
        apiceKmh = nil
        saidaKmh = nil
        enviarSnapshot()
    }

    private func onSegmentEnd(_ ev: DetectorSegmentEndEvent) {
        // Saída do trecho — popula ÁPICE (menor velocidade dentro do
        // trecho) e SAÍDA (velocidade no instante de saída).
        if let v = ev.velMinima { apiceKmh = v * 3.6 }
        if let v = ev.velSaida { saidaKmh = v * 3.6 }
        enviarSnapshot()
    }

    // MARK: - Envio pro JS

    private func enviarSnapshot() {
        guard let webView = webView else { return }
        let payload: [String: Any] = [
            "entradaKmh": entradaKmh.map { round($0) } ?? NSNull(),
            "apiceKmh": apiceKmh.map { round($0) } ?? NSNull(),
            "saidaKmh": saidaKmh.map { round($0) } ?? NSNull(),
            "freioMetrosAtual": freioMetros.map { round($0) } ?? NSNull()
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "if(window.p1AtualizarCockpit) window.p1AtualizarCockpit(\(json));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Análise por trecho (Bloco 4)

    /// Empurra a resposta da Edge Function `trecho-analisar` pro WebView.
    /// Adiciona ao `window.p1AtualizarCockpit` os campos `analise*` —
    /// front-end consome esses campos pra colorir o trecho que acabou
    /// de cruzar e mostrar a frase / top oportunidade.
    func exibirAnalise(_ resp: TrechoAnaliseResponse) {
        guard let webView = webView else { return }
        let payload: [String: Any] = [
            "analiseTrechoId": resp.trechoId,
            "analiseCor": resp.cor,
            "analiseFrase": resp.frase,
            "analiseCausa": resp.causaProvavel,
            "analiseGanhoSeg": resp.topOportunidade.ganhoEstimadoSeg,
            "analiseEvidencia": resp.evidencia,
            "analiseCriarPendencia": resp.criarPendencia,
            "analiseSugestaoPendencia": resp.sugestaoPendencia ?? NSNull(),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "if(window.p1AtualizarCockpit) window.p1AtualizarCockpit(\(json));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
}
