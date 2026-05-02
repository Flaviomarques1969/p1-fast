// ═══════════════════════════════════════════════════════════
// ContentView — root view
// ═══════════════════════════════════════════════════════════
// Sprint 1A.1: provou esqueleto + DB local (splash com "DB: ok").
// Sprint 1A.2 (este Prompt #7): troca o splash pela ThemeShowcaseView,
// galeria viva dos componentes Padrão B.
//
// Splash continua sendo renderizado enquanto `database.status == .idle`
// (millisegundos) e quando `.failed` (estado de erro visível). Em `.ok`
// o app entra direto na showcase — sem ícone, texto puro.
// Quando HomeView/EventosView aterrissarem (Prompts #8-#10), trocamos
// a showcase pela tela real.

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var database: AppDatabase

    var body: some View {
        switch database.status {
        case .idle:
            Splash(stateLabel: "DB: subindo…", isError: false)
        case .ok:
            ThemeShowcaseView()
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

#Preview("ContentView — DB ok (showcase)") {
    let db = AppDatabase()
    return ContentView()
        .environmentObject(db)
        .task { await db.bootstrap() }
}

#Preview("Splash — idle") {
    Splash(stateLabel: "DB: subindo…", isError: false)
}
