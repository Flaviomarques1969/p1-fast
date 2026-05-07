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
// Sprint B (#127): JWT do user vai no Authorization do transport.
// Sprint C.2 (#130): após login OK, chama RPC `ensure_personal_team`
// e cacheia o time_id retornado em UserDefaults (key
// `TeamContext.storageKey`). Sprint C.3 fez os repos lerem via
// `TeamContext.currentTeamId` — constante hardcoded foi removida.

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
    /// UUID do time pessoal do user logado, populado pela RPC
    /// `ensure_personal_team` após cada applySession. Persistido em
    /// UserDefaults pra sobreviver a relaunches offline (último valor
    /// conhecido vale até nova confirmação online).
    @Published private(set) var currentTeamId: String?

    private let client: SupabaseClient?

    init(client: SupabaseClient? = SupabaseManager.shared) {
        self.client = client
        self.currentTeamId = UserDefaults.standard.string(forKey: TeamContext.storageKey)
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
        currentTeamId = nil
        UserDefaults.standard.removeObject(forKey: TeamContext.storageKey)
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
        // Bootstrap do time pessoal em paralelo — não bloqueia UI.
        // Se falhar (offline, RPC indisponível) o currentTeamId em
        // cache vale até a próxima tentativa.
        Task { await self.ensurePersonalTeam() }
    }

    /// Chama `ensure_personal_team()` no servidor, persiste o UUID
    /// retornado em UserDefaults e atualiza `currentTeamId`. RPC é
    /// idempotente (migration 0011): se o user já é admin de algum
    /// time, devolve esse mesmo UUID. Erros são silenciados — usuário
    /// não tem ação útil; sync vai sinalizar no Sprint C.3.
    private func ensurePersonalTeam() async {
        guard let client else { return }
        do {
            let response = try await client.rpc("ensure_personal_team").execute()
            // RPC retorna uuid JSON-encoded como string ("\"uuid\"").
            let raw = String(data: response.data, encoding: .utf8) ?? ""
            let teamId = raw.trimmingCharacters(
                in: CharacterSet(charactersIn: "\"\n\r ")
            )
            guard !teamId.isEmpty else { return }
            currentTeamId = teamId
            UserDefaults.standard.set(teamId, forKey: TeamContext.storageKey)
        } catch {
            // Não-fatal. Mantém último valor cacheado.
        }
    }

    private func describeError(_ error: Error) -> String {
        // SDK lança erros com `localizedDescription` legível. Mantém
        // simples — UI pode formatar/traduzir depois.
        let msg = (error as NSError).localizedDescription
        return msg.isEmpty ? "Não consegui completar a operação." : msg
    }
}
