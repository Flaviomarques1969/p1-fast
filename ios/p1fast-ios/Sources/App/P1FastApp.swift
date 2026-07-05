// ═══════════════════════════════════════════════════════════
// P1FastApp — entry point SwiftUI
// ═══════════════════════════════════════════════════════════
// [HARNESS TEMPORÁRIO 05/07 — abre direto na SetupAvancadoView pra o Flávio
//  ver a seção "Alertas". REVERTER pro original após o screenshot.]

import SwiftUI
import P1FastCore

@main
struct P1FastApp: App {
    @StateObject private var repo = P1FastApp.makeRepo()

    static func makeRepo() -> CarroRepository {
        CarroRepository(queue: try! P1FastCore.DB.makeMemoryQueue())
    }

    var body: some Scene {
        WindowGroup {
            SetupAvancadoView(carroId: "harness-demo", onClose: {})
                .environmentObject(repo)
                .task { await repo.bootstrap() }
        }
    }
}
