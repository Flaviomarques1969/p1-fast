// ═══════════════════════════════════════════════════════════
// ContentView — splash mínimo "Hello P1 Fast"
// ═══════════════════════════════════════════════════════════
// Sprint 1A.1: prova que o esqueleto compila, abre, monta DB local
// e mostra status. Texto puro, sem ícone (regra do mockup canônico).
// Padrão visual final (Padrão B) chega no Sprint 1A.2 (Prompt #7+).

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var database: AppDatabase

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 4) {
                Text("P1 Fast")
                    .font(.system(size: 56, weight: .heavy, design: .default))
                    .tracking(-0.5)
                Text("v\(Configuration.appVersion) · build \(Configuration.buildNumber)")
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            statusLine
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Text(footerHint)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
    }

    @ViewBuilder
    private var statusLine: some View {
        switch database.status {
        case .idle:
            Text("DB: subindo…")
                .foregroundStyle(.secondary)
        case .ok(let tables):
            Text("DB: ok · Tabelas: \(tables)")
                .foregroundStyle(.primary)
        case .failed(let message):
            Text("DB: falhou\n\(message)")
                .foregroundStyle(.red)
        }
    }

    private var footerHint: String {
        let supa = Configuration.hasSupabaseCredentials ? "ok" : "não configurado"
        let daily = Configuration.hasDailyCredentials ? "ok" : "não configurado"
        return "Supabase: \(supa) · Daily.co: \(daily)"
    }
}

#Preview {
    let db = AppDatabase()
    return ContentView()
        .environmentObject(db)
        .task { await db.bootstrap() }
}
