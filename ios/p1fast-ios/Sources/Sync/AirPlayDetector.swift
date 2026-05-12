// ═══════════════════════════════════════════════════════════
// AirPlayDetector — detecta espelhamento Apple TV (Q17)
// ═══════════════════════════════════════════════════════════
// MS-11.6. iOS não permite ATIVAR AirPlay programaticamente —
// limitação da plataforma. Mas conseguimos DETECTAR quando o
// usuário ativa espelhamento via Control Center, observando
// `UIScreen.screens.count > 1` ou notificações de tela conectada.
//
// Uso: cockpit ao detectar espelhamento muda layout pra modo
// Box Cockpit (Q17 do roteiro original — ADR-018 separa cockpit
// piloto vs box).
//
// Esta classe expõe @Published estaEspelhando : Bool. SwiftUI
// reage automático.

import Foundation

#if canImport(UIKit)
import UIKit
#endif

@MainActor
public final class AirPlayDetector: ObservableObject {
    @Published public private(set) var estaEspelhando: Bool = false

    private var observersInstalados: Bool = false

    public init() {
        avaliarEstado()
        instalarObservers()
    }

    deinit {
        // NotificationCenter remove automaticamente quando observer é desalocado
    }

    /// Re-checa estado atual. Pode ser chamado por views que quiserem
    /// confirmar antes de exibir modo Box Cockpit.
    public func recheck() {
        avaliarEstado()
    }

    private func instalarObservers() {
        guard !observersInstalados else { return }
        observersInstalados = true

        #if canImport(UIKit)
        let center = NotificationCenter.default
        center.addObserver(
            forName: UIScreen.didConnectNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.avaliarEstado() }
        }
        center.addObserver(
            forName: UIScreen.didDisconnectNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.avaliarEstado() }
        }
        center.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.avaliarEstado() }
        }
        #endif
    }

    private func avaliarEstado() {
        #if canImport(UIKit)
        // Espelhamento ativo quando há mais de 1 tela conectada.
        // Em iPad/iPhone normal, apenas 1 (built-in). Quando AirPlay
        // espelha pra Apple TV, vira 2.
        let telas = UIScreen.screens.count
        self.estaEspelhando = telas > 1
        #else
        self.estaEspelhando = false
        #endif
    }
}
