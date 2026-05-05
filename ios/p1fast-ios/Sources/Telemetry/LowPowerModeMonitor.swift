// ═══════════════════════════════════════════════════════════
// LowPowerModeMonitor — observa ProcessInfo.isLowPowerModeEnabled
// ═══════════════════════════════════════════════════════════
// MS-2.2: iPhone em modo de baixa energia derruba IMU pra ~50 Hz e
// GPS pra ~0.5 Hz. Captura ainda funciona, mas perde fidelidade.
// Esta classe expõe @Published Bool pra UI mostrar aviso e pra
// telemetria persistir o estado da amostra (se vier a importar).
//
// NÃO desliga nada automaticamente. NÃO força saída do low power
// (impossível via API pública). Apenas observa.

import Foundation
import Combine

@MainActor
final class LowPowerModeMonitor: ObservableObject {
    @Published private(set) var isLowPowerMode: Bool

    private var observer: NSObjectProtocol?

    init() {
        self.isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        observer = NotificationCenter.default.addObserver(
            forName: .NSProcessInfoPowerStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
            }
        }
    }

    deinit {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
