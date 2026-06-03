// ═══════════════════════════════════════════════════════════
// OrientationLock — controla orientação permitida por tela
// ═══════════════════════════════════════════════════════════
// O app inteiro fica em vertical (portrait) por padrão. A tela
// do Cockpit do piloto (StintCockpitView) precisa horizontal —
// o canônico foi desenhado em 956×440, e o piloto monta o iPhone
// deitado no painel. Esta classe é o ponto único onde isso é
// controlado.
//
// Uso:
//   OrientationLock.set(.landscape)   // entra no cockpit
//   OrientationLock.set(.portrait)    // sai do cockpit
//
// O AppDelegate responde a `supportedInterfaceOrientationsFor`
// devolvendo o estado atual.

import UIKit

enum OrientationLock {
    static var allowed: UIInterfaceOrientationMask = .portrait

    static func set(_ mask: UIInterfaceOrientationMask) {
        allowed = mask
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else { return }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { _ in }
        UIViewController.attemptRotationToDeviceOrientation()
    }
}

final class P1FastAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.allowed
    }
}
