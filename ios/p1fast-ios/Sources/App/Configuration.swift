// ═══════════════════════════════════════════════════════════
// Configuration — leitura de credenciais e versão do bundle
// ═══════════════════════════════════════════════════════════
// SUPABASE_URL/ANON_KEY e DAILY_API_KEY entram pelo .env.xcconfig (gitignored)
// → propagam pro Info.plist via interpolação $(VAR) → leitura aqui.
// Nunca hardcode credencial em código.

import Foundation

public enum Configuration {
    public static var appVersion: String {
        infoString("CFBundleShortVersionString") ?? "0.0.0"
    }

    public static var buildNumber: String {
        infoString("CFBundleVersion") ?? "0"
    }

    public static var supabaseURL: String {
        infoString("SUPABASE_URL") ?? ""
    }

    public static var supabaseAnonKey: String {
        infoString("SUPABASE_ANON_KEY") ?? ""
    }

    public static var dailyAPIKey: String {
        infoString("DAILY_API_KEY") ?? ""
    }

    /// `true` quando a credencial vem do default do xcconfig (REPLACE_ME) ou
    /// está vazia. Útil pra UI mostrar estado "não configurado" e evitar
    /// requests inúteis pra example.supabase.co.
    public static var hasSupabaseCredentials: Bool {
        let url = supabaseURL
        let key = supabaseAnonKey
        guard !url.isEmpty, !key.isEmpty else { return false }
        return !url.contains("example.supabase.co") && key != "REPLACE_ME"
    }

    public static var hasDailyCredentials: Bool {
        let key = dailyAPIKey
        return !key.isEmpty && key != "REPLACE_ME"
    }

    private static func infoString(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
