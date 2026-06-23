// ═══════════════════════════════════════════════════════════
// OrientationGate — detecta o GIRO físico do celular (à prova de trava)
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 22-23/06: virar o celular pra paisagem abre o Cockpit do
// Piloto (sem botão); voltar fecha. NO APARELHO REAL, depender da rotação
// nativa do iOS / das notificações de UIDevice falha (não dispara nada),
// principalmente com a TRAVA DE ROTAÇÃO ligada. Por isso a detecção é pela
// GRAVIDADE (CoreMotion deviceMotion.gravity) — já isolada da aceleração do
// usuário (carro/mão tremendo), imune à trava.
//
// No SIMULADOR não há sensores; lá caímos no UIDevice (responde ao ⌘←/→).
// Publicamos `landscapeAngle`:
//   - nil   = retrato (cockpit escondido)
//   - +90/-90 = graus pra girar o conteúdo e deixá-lo EM PÉ (sinal conferido
//     pela convenção do sensor da Apple: retrato em pé ≈ gravidade (0,-1)).
//
// HISTERESE: entra em paisagem só passando bem dos ~58°, volta a retrato só
// abaixo de ~42° — pra não ficar ligando/desligando numa inclinação do meio.
//
// NSLog "P1COCKPIT" pra diagnóstico no aparelho via idevicesyslog.

import SwiftUI
import UIKit
import CoreMotion

final class OrientationGate: ObservableObject {
    static let shared = OrientationGate()

    /// nil = retrato; senão graus a girar o conteúdo pra ficar em pé (+90/-90).
    @Published private(set) var landscapeAngle: Double? = nil

    private let motion = CMMotionManager()
    private var started = false

    private init() {}

    func startMonitoring() {
        guard !started else { return }
        started = true

        if motion.isDeviceMotionAvailable {
            // APARELHO: gravidade isolada da aceleração do usuário.
            motion.deviceMotionUpdateInterval = 0.1
            motion.startDeviceMotionUpdates(to: .main) { [weak self] m, _ in
                guard let self, let g = m?.gravity else { return }
                self.applyGravity(x: g.x, y: g.y)
            }
            NSLog("P1COCKPIT startMonitoring: deviceMotion (gravidade) LIGADO")
        } else {
            // SIMULADOR: UIDevice (responde ao ⌘←/→).
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            NotificationCenter.default.addObserver(
                self, selector: #selector(deviceChanged),
                name: UIDevice.orientationDidChangeNotification, object: nil)
            applyDevice(UIDevice.current.orientation)
            NSLog("P1COCKPIT startMonitoring: SEM deviceMotion -> UIDevice (simulador)")
        }
    }

    // ── Caminho simulador (UIDevice) ─────────────────────────────────────
    @objc private func deviceChanged() { applyDevice(UIDevice.current.orientation) }

    private func applyDevice(_ o: UIDeviceOrientation) {
        switch o {
        case .landscapeLeft:  setAngle(90,  src: "device.landscapeLeft")
        case .landscapeRight: setAngle(-90, src: "device.landscapeRight")
        case .portrait, .portraitUpsideDown: setAngle(nil, src: "device.portrait")
        default: break   // faceUp/faceDown/unknown: mantém
        }
    }

    // ── Caminho aparelho (gravidade) com HISTERESE ───────────────────────
    private func applyGravity(x: Double, y: Double) {
        let phi = atan2(x, -y) * 180 / .pi   // rotação do aparelho a partir do retrato
        let a = abs(phi)
        let emPaisagem = (landscapeAngle != nil)
        let angle: Double?
        if emPaisagem {
            // já está em paisagem: só volta a retrato caindo bem (histerese)
            if a < 42 || a > 138 { angle = nil }
            else { angle = phi > 0 ? -90 : 90 }
        } else {
            // está em retrato: só entra em paisagem passando bem dos 58
            if a > 58 && a < 122 { angle = phi > 0 ? -90 : 90 }
            else { angle = nil }
        }
        setAngle(angle, src: String(format: "gravity phi=%.0f x=%.2f y=%.2f", phi, x, y))
    }

    private func setAngle(_ angle: Double?, src: String) {
        guard angle != landscapeAngle else { return }
        landscapeAngle = angle
        NSLog("P1COCKPIT landscapeAngle=%@ (%@)",
              angle.map { String(format: "%.0f", $0) } ?? "nil", src)
    }
}
