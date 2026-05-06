// ═══════════════════════════════════════════════════════════
// SessionManager — ObservableObject de auth Supabase (MS-10 A.1)
// ═══════════════════════════════════════════════════════════
// Wrapper @MainActor sobre `SupabaseClient.auth`. Expõe estado
// observável pra SwiftUI (LoginView/ContentView nas sprints A.2/A.3).
// Auto-refresh é responsabilidade do SDK supabase-swift — esta
// camada apenas reflete o estado.
//
// Estados possíveis:
//   - `state == .unauthenticated`: sem session válida. UI mostra
//     LoginView.
//   - `state == .authenticated(user)`: session existe e o user está
//     carregado. UI mostra app normal.
//   - `state == .restoring`: carregando session do storage no boot.
//     UI mostra splash (não login flicker).
//
// Decisão A.1: NÃO injetar JWT em transport ainda (B faz isso). Aqui
// só estabelece a fonte da verdade. Repos seguem usando anon key até
// B mergear.

import Foundation
import Supabase

@MainActor
final class SessionManager: ObservableObject {

    enum State: Equatable {
        case restoring
        case unauthenticated
        case authenticated(userId: String, email: String?)
    }

    @Published private(set) var state: State = .restoring
    @Published private(set) var lastError: String?
    @Published private(set) var isWorking: Bool = false

    private let client: SupabaseClient?

    init(client: SupabaseClient? = SupabaseManager.shared) {
        self.client = client
    }

    /// `true` quando há session válida. Atalho pra @ViewBuilder.
    var isAuthenticated: Bool {
        if case .authenticated = state { return true }
        return false
    }

    /// `true` quando creds Supabase ausentes — UI deve mostrar banner
    /// "não configurado" em vez de LoginView funcional.
    var isClientReady: Bool { client != nil }

    /// Chamar 1 vez no boot do app. Tenta carregar session do storage
    /// do SDK (default UserDefaults). Auto-refresh roda em background.
    func bootstrap() async {
        guard let client else {
            state = .unauthenticated
            return
        }
        do {
            let session = try await client.auth.session
            applySession(session)
        } catch {
            // Sem session válida ou refresh falhou — só vai pra login.
            // Não-fatal: SDK limpa storage corrompido por conta própria.
            state = .unauthenticated
        }
    }

    func signIn(email: String, password: String) async {
        guard let client else { return }
        isWorking = true; lastError = nil
        defer { isWorking = false }
        do {
            let session = try await client.auth.signIn(email: email, password: password)
            applySession(session)
        } catch {
            state = .unauthenticated
            lastError = describeError(error)
        }
    }

    func signUp(email: String, password: String) async {
        guard let client else { return }
        isWorking = true; lastError = nil
        defer { isWorking = false }
        do {
            // signUp pode retornar session imediata OU exigir confirmação
            // de email — depende de config do projeto Supabase. Aqui
            // tentamos pegar session direto via getSession.
            _ = try await client.auth.signUp(email: email, password: password)
            do {
                let session = try await client.auth.session
                applySession(session)
            } catch {
                // Confirmação de email pendente — fica unauthenticated
                // com mensagem orientadora.
                state = .unauthenticated
                lastError = "Cadastro criado. Verifique seu email pra confirmar antes de entrar."
            }
        } catch {
            state = .unauthenticated
            lastError = describeError(error)
        }
    }

    func signOut() async {
        guard let client else { return }
        isWorking = true
        defer { isWorking = false }
        try? await client.auth.signOut()
        state = .unauthenticated
        lastError = nil
    }

    /// Token atual pra Sprint B usar no Authorization header. nil
    /// quando não autenticado ou refresh em andamento.
    func currentAccessToken() async -> String? {
        guard let client else { return nil }
        return try? await client.auth.session.accessToken
    }

    private func applySession(_ session: Session) {
        let user = session.user
        let email = user.email
        state = .authenticated(userId: user.id.uuidString, email: email)
    }

    private func describeError(_ error: Error) -> String {
        // SDK lança erros com `localizedDescription` legível. Mantém
        // simples — UI pode formatar/traduzir depois.
        let msg = (error as NSError).localizedDescription
        return msg.isEmpty ? "Não consegui completar a operação." : msg
    }
}
