// ═══════════════════════════════════════════════════════════
// ContentView — root view
// ═══════════════════════════════════════════════════════════
// Sprint 1A.1: provou esqueleto + DB local (splash com "DB: ok").
// Sprint 1A.2 — Prompt #7: ThemeShowcaseView (componentes Padrão B).
// Sprint 1A.2 — Prompt #8 (este): HomeView é o root quando DB.ok.
//
// Splash continua sendo renderizado enquanto `database.status == .idle`
// (milissegundos) e quando `.failed` (estado de erro visível).
//
// Roteamento de modo (cheio vs vazio):
//   - Default → estado cheio com mock data (HomeData.mockFilled).
//   - Launch arg `--p1-empty` → estado vazio (onboarding).
//   - Launch arg `--p1-showcase` → ThemeShowcaseView (deprecada — só pra
//     debug rápido enquanto Sprint 1A.2 não fechar todos componentes).
//
// Sprint 1A.6 troca o mock pelo Repository real (GRDB → Supabase).

import SwiftUI

private enum HomeMode {
    case filled, empty, showcase

    static var fromLaunchArgs: HomeMode {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--p1-empty") { return .empty }
        if args.contains("--p1-showcase") { return .showcase }
        return .filled
    }
}

struct ContentView: View {
    @EnvironmentObject private var database: AppDatabase

    var body: some View {
        switch database.status {
        case .idle:
            Splash(stateLabel: "DB: subindo…", isError: false)
        case .ok:
            switch HomeMode.fromLaunchArgs {
            case .filled:   HomeView(state: .filled(HomeData.mockFilled))
            case .empty:    HomeView(state: .empty)
            case .showcase: ThemeShowcaseView()
            }
        case .failed(let message):
            Splash(stateLabel: "DB: falhou\n\(message)", isError: true)
        }
    }
}

private struct Splash: View {
    let stateLabel: String
    let isError: Bool

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            VStack(spacing: 4) {
                Text("P1 Fast")
                    .font(.system(size: 56, weight: .heavy, design: .default))
                    .tracking(-0.5)
                    .foregroundStyle(Color.text)
                Text("v\(Configuration.appVersion) · build \(Configuration.buildNumber)")
                    .font(.monoP1)
                    .foregroundStyle(Color.textMuted)
            }
            Spacer()
            Text(stateLabel)
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .multilineTextAlignment(.center)
                .foregroundStyle(isError ? Color.red : Color.text)
                .padding(.horizontal, Spacing.lg)
            Text(footerHint)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textFaint)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
                .padding(.bottom, Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
        .preferredColorScheme(.dark)
    }

    private var footerHint: String {
        let supa = Configuration.hasSupabaseCredentials ? "ok" : "não configurado"
        let daily = Configuration.hasDailyCredentials ? "ok" : "não configurado"
        return "Supabase: \(supa) · Daily.co: \(daily)"
    }
}

#Preview("ContentView — DB ok (Home cheio)") {
    let db = AppDatabase()
    return ContentView()
        .environmentObject(db)
        .task { await db.bootstrap() }
}

#Preview("Splash — idle") {
    Splash(stateLabel: "DB: subindo…", isError: false)
}
