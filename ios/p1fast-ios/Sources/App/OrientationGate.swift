// ═══════════════════════════════════════════════════════════
// OrientationGate — detecta o GIRO físico do celular (à prova de trava)
// ═══════════════════════════════════════════════════════════
// Virar o celular pra paisagem abre o Cockpit do Piloto (sem botão); voltar
// fecha. A detecção é pela GRAVIDADE (CoreMotion deviceMotion.gravity), imune
// à trava de rotação e já isolada da aceleração do usuário (carro/mão).
//
// IMPORTANTE (defeito 23/06 "funciona e para"): o iOS DESLIGA o sensor quando
// o app vai pra segundo plano (tela travada, troca de app, dormir). Por isso
// RELIGAMOS o sensor toda vez que o app volta pra frente
// (UIApplication.didBecomeActiveNotification). Sem isso, depois de uma vez em
// segundo plano a detecção morre.
//
// No SIMULADOR não há sensores; lá caímos no UIDevice (responde ao ⌘←/→).
// Publicamos `landscapeAngle`: nil = retrato; +90/-90 = graus pra deixar o
// conteúdo EM PÉ. Histerese (entra >58°, sai <42°) evita tremular na fronteira.
//
// Log via os.Logger (aparece no idevicesyslog): prefixo "P1COCKPIT".

import SwiftUI
import UIKit
import CoreMotion
import os

final class OrientationGate: ObservableObject {
    static let shared = OrientationGate()

    /// nil = retrato; senão graus a girar o conteúdo pra ficar em pé (+90/-90).
    @Published private(set) var landscapeAngle: Double? = nil

    private let motion = CMMotionManager()
    private let log = Logger(subsystem: "com.flaviomarques.p1fast", category: "cockpit")
    private var started = false

    private init() {}

    func startMonitoring() {
        guard !started else { return }
        started = true

        // Religa o sensor sempre que o app volta pra frente (iOS pausa em 2º plano).
        NotificationCenter.default.addObserver(
            self, selector: #selector(appActive),
            name: UIApplication.didBecomeActiveNotification, object: nil)

        if !motion.isDeviceMotionAvailable {
            // SIMULADOR: UIDevice (uma vez só).
            UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            NotificationCenter.default.addObserver(
                self, selector: #selector(deviceChanged),
                name: UIDevice.orientationDidChangeNotification, object: nil)
            applyDevice(UIDevice.current.orientation)
            log.notice("P1COCKPIT startMonitoring: SEM deviceMotion -> UIDevice (simulador)")
        }
        startMotion()
    }

    @objc private func appActive() {
        log.notice("P1COCKPIT appActive -> religar sensor")
        startMotion()
    }

    /// (Re)inicia o sensor de gravidade. Idempotente: não duplica se já roda.
    private func startMotion() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 0.1
        motion.startDeviceMotionUpdates(to: .main) { [weak self] m, _ in
            guard let self, let g = m?.gravity else { return }
            self.applyGravity(x: g.x, y: g.y)
        }
        log.notice("P1COCKPIT deviceMotion (gravidade) LIGADO")
    }

    // ── Caminho simulador (UIDevice) ─────────────────────────────────────
    @objc private func deviceChanged() { applyDevice(UIDevice.current.orientation) }

    private func applyDevice(_ o: UIDeviceOrientation) {
        switch o {
        case .landscapeLeft:  setAngle(90,  src: "device.landscapeLeft")
        case .landscapeRight: setAngle(-90, src: "device.landscapeRight")
        case .portrait, .portraitUpsideDown: setAngle(nil, src: "device.portrait")
        default: break
        }
    }

    // ── Caminho aparelho (gravidade) com HISTERESE ───────────────────────
    private func applyGravity(x: Double, y: Double) {
        let phi = atan2(x, -y) * 180 / .pi
        let a = abs(phi)
        let emPaisagem = (landscapeAngle != nil)
        let angle: Double?
        if emPaisagem {
            if a < 42 || a > 138 { angle = nil }
            else { angle = phi > 0 ? -90 : 90 }
        } else {
            if a > 58 && a < 122 { angle = phi > 0 ? -90 : 90 }
            else { angle = nil }
        }
        setAngle(angle, src: "gravity")
    }

    private func setAngle(_ angle: Double?, src: String) {
        guard angle != landscapeAngle else { return }
        landscapeAngle = angle
        log.notice("P1COCKPIT landscapeAngle=\(angle ?? -999, privacy: .public) (\(src, privacy: .public))")
    }
}
