// ═══════════════════════════════════════════════════════════
// StintRodandoView — alterna pela orientação da janela do app
// ═══════════════════════════════════════════════════════════
// 2026-05-21 (Flávio v2): troquei UIDevice.current.orientation por
// UIWindowScene.interfaceOrientation. Razão: quando o aplicativo
// FORÇA rotação via requestGeometryUpdate (sem o iPhone girar
// fisicamente), UIDevice.orientation NÃO atualiza — continua
// reportando a orientação do device físico. UIWindowScene
// .interfaceOrientation reflete o que o usuário VÊ na tela.
//
// Também adicionei polling em 0.1/0.3/0.7/1.2s no onAppear pra
// pegar o momento em que o iOS termina de rotacionar a janela.
// SwiftUI nem sempre dispara onReceive(orientationDidChange) quando
// a rotação foi forçada por código.

import SwiftUI
import UIKit
import P1FastCore

struct StintRodandoView: View {
    let stintId: String
    let contextoLinha: String
    let onFinalized: (String) -> Void
    let onCancel: () -> Void

    @State private var isLandscape: Bool = StintRodandoView.deteccaoInicial()

    var body: some View {
        Group {
            if isLandscape {
                StintCockpitView(
                    stintId: stintId,
                    contextoLinha: contextoLinha,
                    onFinalized: onFinalized,
                    onCancel: onCancel
                )
            } else {
                StintCaptureView(
                    stintId: stintId,
                    contextoLinha: contextoLinha,
                    onFinalized: onFinalized,
                    onCancel: onCancel
                )
            }
        }
        .onAppear {
            OrientationLock.set(.allButUpsideDown)
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            // Polling agressivo nos primeiros 1,5 segundos pra pegar o
            // momento em que o iOS termina de aplicar a rotação forçada.
            atualizarOrientacao()
            for delay in [0.1, 0.25, 0.5, 0.9, 1.4] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    atualizarOrientacao()
                }
            }
        }
        .onDisappear {
            UIDevice.current.endGeneratingDeviceOrientationNotifications()
            OrientationLock.set(.portrait)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            atualizarOrientacao()
        }
    }

    /// Detecção inicial usada no @State default. Usa o tamanho da tela
    /// porque na hora do init a interfaceOrientation pode ainda estar
    /// no estado anterior à rotação forçada.
    private static func deteccaoInicial() -> Bool {
        let bounds = UIScreen.main.bounds
        return bounds.width > bounds.height
    }

    /// Atualiza isLandscape lendo a orientação da JANELA (o que está na
    /// tela), não do device físico. Esta é a chave: quando o iOS força
    /// rotação via OrientationLock, a interfaceOrientation muda mas o
    /// device físico continua em portrait. Antes eu usava UIDevice.
    private func atualizarOrientacao() {
        let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first
        guard let scene = scene else { return }
        let interfaceOrient = scene.interfaceOrientation
        // Fallback duplo: se interfaceOrientation está unknown, usa
        // o tamanho da janela como dica.
        let novaLandscape: Bool
        if interfaceOrient.isLandscape {
            novaLandscape = true
        } else if interfaceOrient.isPortrait {
            novaLandscape = false
        } else {
            novaLandscape = scene.screen.bounds.width > scene.screen.bounds.height
        }
        if novaLandscape != isLandscape {
            isLandscape = novaLandscape
        }
    }
}
