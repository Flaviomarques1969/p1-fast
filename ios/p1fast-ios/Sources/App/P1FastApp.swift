// ═══════════════════════════════════════════════════════════
// P1FastApp — entry point SwiftUI
// ═══════════════════════════════════════════════════════════
// Esqueleto mínimo do app real. Boots o DatabaseQueue do P1FastCore
// (GRDB local) na inicialização e oferece via @Environment pra views.
// Tela única "Hello P1 Fast" — Sprint 1A.1 fecha quando a tela
// mostra "P1 Fast vX.Y.Z · DB: ok · Tabelas: N".

import SwiftUI

@main
struct P1FastApp: App {
    @StateObject private var database = AppDatabase()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(database)
                .task { await database.bootstrap() }
        }
    }
}
