// ═══════════════════════════════════════════════════════════
// SupabaseManager — singleton do SupabaseClient (MS-10 Sprint A.1)
// ═══════════════════════════════════════════════════════════
// Wrapper simples sobre o SDK supabase-swift 2.46.0. Lê URL+anon
// key da Configuration (vindo de SUPABASE_URL/SUPABASE_ANON_KEY do
// xcconfig). Quando creds estão ausentes ou são placeholders, o
// `client` é `nil` — caller fica sem auth e mostra estado "não
// configurado" na UI.
//
// Storage do session: default do SDK = UserDefaults. Suficiente pra
// MVP. Migrar pra Keychain se virar requisito de compliance — basta
// implementar `AuthLocalStorage` e passar em `SupabaseClientOptions`.

import Foundation
import Supabase

enum SupabaseManager {
    /// Cliente compartilhado. nil quando creds não populadas.
    /// Lazy + atomic — primeira leitura constrói, próximas reusam.
    static let shared: SupabaseClient? = {
        guard
            let baseUrl = Configuration.supabaseBaseUrl,
            !Configuration.supabaseAnonKey.isEmpty,
            Configuration.supabaseAnonKey != "REPLACE_ME"
        else {
            return nil
        }
        return SupabaseClient(
            supabaseURL: baseUrl,
            supabaseKey: Configuration.supabaseAnonKey
        )
    }()

    /// `true` quando o cliente foi construído com sucesso. UI usa pra
    /// decidir entre tela de login funcional e banner "não configurado".
    static var isReady: Bool { shared != nil }
}
