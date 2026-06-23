// ═══════════════════════════════════════════════════════════
// OrientationGate — paisagem SÓ pra o Cockpit do Piloto
// ═══════════════════════════════════════════════════════════
// O app é travado em retrato. Esta classe é o ÚNICO ponto que destrava a
// paisagem, e só enquanto o cockpit está no ar. O AppDelegate abaixo lê o flag
// em application(_:supportedInterfaceOrientationsFor:) — é o iOS quem rotaciona
// a tela de verdade (rotação NATIVA), então o WKWebView do cockpit recebe um
// frame paisagem real e o conteúdo se centraliza sozinho, sem rotationEffect.
//
// Fluxo (app travado não gira sozinho ao virar o aparelho):
//   1. Observa UIDevice.orientationDidChangeNotification (a orientação FÍSICA
//      chega mesmo com o app travado).
//   2. Aparelho foi pra paisagem  → allowsLandscape = true + força reavaliação
//      → iOS gira a tela do cockpit pra paisagem.
//   3. Aparelho voltou pra retrato → allowsLandscape = false + força reavaliação
//      → iOS volta pra retrato e o cover do cockpit some.

import SwiftUI
import UIKit

final class OrientationGate: ObservableObject {
    static let shared = OrientationGate()

    /// Quando true, o AppDelegate libera paisagem. Default false = app travado.
    @Published private(set) var allowsLandscape = false
    /// True quando o aparelho está FISICAMENTE de lado (qualquer lado). SwiftUI
    /// usa isso pra mostrar/esconder o cover do cockpit.
    @Published private(set) var deviceIsLandscape = false

    private init() {}

    /// Conjunto que o AppDelegate devolve ao iOS. Travado = só retrato.
    var supportedMask: UIInterfaceOrientationMask {
        allowsLandscape ? .landscape : .portrait
    }

    /// Re-pede a rotação com o cover JÁ na tela (chamado no .onAppear da
    /// CockpitPilotoView). No 1º disparo o cover ainda não era o controller
    /// topo; aqui ele é, então o iOS reavalia e gira de verdade.
    func reassert() {
        Self.requestGeometryRefresh(toLandscape: allowsLandscape)
    }

    private func setLandscapeAllowed(_ allowed: Bool) {
        guard allowsLandscape != allowed else { return }
        allowsLandscape = allowed
        Self.requestGeometryRefresh(toLandscape: allowed)
    }

    // ── Monitoramento físico — chamar UMA vez (idempotente) ──────────────
    private var started = false
    func startMonitoring() {
        guard !started else { return }
        started = true
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(
            self, selector: #selector(orientationChanged),
            name: UIDevice.orientationDidChangeNotification, object: nil)
        evaluate(UIDevice.current.orientation)   // estado inicial (pode subir deitado)
    }

    @objc private func orientationChanged() {
        evaluate(UIDevice.current.orientation)
    }

    private func evaluate(_ o: UIDeviceOrientation) {
        let landscape: Bool
        switch o {
        case .landscapeLeft, .landscapeRight: landscape = true
        case .portrait, .portraitUpsideDown:  landscape = false
        default: return   // faceUp/faceDown/unknown: mantém estado, não oscila
        }
        guard landscape != deviceIsLandscape else { return }
        // Libera a paisagem ANTES de publicar deviceIsLandscape, pra a tela já
        // poder girar quando o cover aparecer.
        setLandscapeAllowed(landscape)
        deviceIsLandscape = landscape
    }

    // ── Força o iOS a reavaliar a orientação suportada (iOS 16+) ─────────
    // Roda no PRÓXIMO ciclo da main (async) pra acontecer DEPOIS de o SwiftUI
    // ter apresentado/atualizado o cover — senão o pedido corre com a
    // apresentação e o iOS ignora a rotação.
    private static func requestGeometryRefresh(toLandscape: Bool) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene }).first else { return }
            for window in scene.windows {
                if let root = window.rootViewController {
                    topMost(from: root).setNeedsUpdateOfSupportedInterfaceOrientations()
                }
            }
            let prefs = UIWindowScene.GeometryPreferences.iOS(
                interfaceOrientations: toLandscape ? .landscape : .portrait)
            scene.requestGeometryUpdate(prefs) { _ in
                // Erro aqui é normal numa corrida com o AppDelegate; o
                // setNeedsUpdate acima já garante a reavaliação. Ignorar é seguro.
            }
        }
    }

    private static func topMost(from vc: UIViewController) -> UIViewController {
        var current = vc
        while let presented = current.presentedViewController { current = presented }
        return current
    }
}

/// AppDelegate mínimo — existe SÓ pra responder a orientação suportada.
/// O app não tinha AppDelegate; é adicionado via @UIApplicationDelegateAdaptor.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        // Fonte ÚNICA da verdade: app travado em retrato, exceto quando o gate
        // libera (cockpit no ar).
        OrientationGate.shared.supportedMask
    }
}
