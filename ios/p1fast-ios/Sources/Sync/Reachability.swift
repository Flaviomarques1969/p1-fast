// ═══════════════════════════════════════════════════════════
// Reachability — wrapper @Published do NWPathMonitor
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — Prompt #23. Detecta online/offline via Network.framework
// (mais confiável que SCNetworkReachability deprecado). Publica
// transições no MainActor pra SyncCoordinator escutar via
// objectWillChange ou Combine.
//
// V1 considera "reachable" = qualquer conexão (wifi, cellular, ethernet).
// Ignora isExpensive/isConstrained — V2 pode pausar telemetry em
// Low Data Mode.

import Foundation
import Network
import Combine

@MainActor
public final class Reachability: ObservableObject {
    @Published public private(set) var isReachable: Bool = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.flaviomarques.p1fast.reachability")

    public init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let now = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                if self.isReachable != now {
                    self.isReachable = now
                }
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
