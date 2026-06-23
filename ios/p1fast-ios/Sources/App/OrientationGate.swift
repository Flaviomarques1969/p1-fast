// ═══════════════════════════════════════════════════════════
// OrientationGate — detecta o GIRO físico do celular (à prova de trava)
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 22-23/06: virar o celular pra paisagem abre o Cockpit do
// Piloto (sem botão); voltar fecha. NO APARELHO REAL, depender da rotação
// nativa do iOS / das notificações de UIDevice falha (não dispara nada),
// principalmente com a TRAVA DE ROTAÇÃO ligada. Por isso aqui a detecção é
// pelo ACELERÔMETRO (CoreMotion) — lê a gravidade direto, imune à trava.
//
// No SIMULADOR não há acelerômetro; lá caímos no UIDevice (que responde ao
// ⌘←/→). Em qualquer caso publicamos `landscapeAngle`:
//   - nil   = retrato (cockpit escondido)
//   - +90/-90 = graus pra girar o conteúdo e deixá-lo EM PÉ na paisagem.
//
// A apresentação (sobreposição) e o giro do conteúdo vivem em ContentView +
// CockpitPilotoView. O app fica TRAVADO em retrato (não usa rotação nativa).
//
// NSLog com prefixo "P1COCKPIT" pra diagnóstico no aparelho via idevicesyslog.

import SwiftUI
import UIKit
import CoreMotion

final class OrientationGate: ObservableObject {
    static let shared = OrientationGate()

    /// nil = retrato; senão, graus a girar o conteúdo pra ficar em pé (+90/-90).
    @Published private(set) var landscapeAngle: Double? = nil

    private let motion = CMMotionManager()
    private var started = false

    private init() {}

    func startMonitoring() {
        guard !started else { return }
        started = true

        if motion.isAccelerometerAvailable {
            // APARELHO: acelerômetro (imune à trava de rotação).
            motion.accelerometerUpdateInterval = 0.12
            motion.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
                guard let self, let a = data?.acceleration else { return }
                self.applyGravity(x: a.x, y: a.y)
            }
            NSLog("P1COCKPIT startMonitoring: acelerômetro LIGADO")
        } else {
            // SIMULADOR: UIDevice (responde ao ⌘←/→).
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            NotificationCenter.default.addObserver(
                self, selector: #selector(deviceChanged),
                name: UIDevice.orientationDidChangeNotification, object: nil)
            applyDevice(UIDevice.current.orientation)
            NSLog("P1COCKPIT startMonitoring: SEM acelerômetro -> UIDevice (simulador)")
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

    // ── Caminho aparelho (gravidade) ─────────────────────────────────────
    // Retrato em pé ≈ (x:0, y:-1). Em paisagem, |x| domina.
    // angle = -(rotação do aparelho) pra o conteúdo ficar EM PÉ. O sinal é
    // confirmado pelo log no aparelho (corrijo num toque se vier de cabeça
    // pra baixo).
    private func applyGravity(x: Double, y: Double) {
        let phiDeg = atan2(x, -y) * 180 / .pi      // rotação do aparelho a partir do retrato
        let a = abs(phiDeg)
        let angle: Double?
        if a < 50 {
            angle = nil                            // retrato
        } else if a > 130 {
            angle = nil                            // de cabeça pra baixo → trata como retrato
        } else {
            angle = phiDeg > 0 ? -90 : 90          // paisagem: gira o conteúdo ao contrário
        }
        setAngle(angle, src: String(format: "gravity phi=%.0f x=%.2f y=%.2f", phiDeg, x, y))
    }

    private func setAngle(_ angle: Double?, src: String) {
        guard angle != landscapeAngle else { return }
        landscapeAngle = angle
        NSLog("P1COCKPIT landscapeAngle=%@ (%@)",
              angle.map { String(format: "%.0f", $0) } ?? "nil", src)
    }
}
