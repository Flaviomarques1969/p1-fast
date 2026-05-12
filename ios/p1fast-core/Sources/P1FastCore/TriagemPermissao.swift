// ═══════════════════════════════════════════════════════════
// TriagemPermissao — regras puras de quem pode triar voltas
// ═══════════════════════════════════════════════════════════
// F4 etapa 6. Espelha a RLS do servidor (0017_volta_video_rls_refinada)
// para que a UI possa esconder/desabilitar o botão "Confirmar triagem"
// quando o usuário corrente não tem permissão.
//
// Decisão de produto (Flávio 2026-05-11, Q2.5):
//   Triagem só pode ser feita por:
//     - piloto da sessão (que pilotou o stint sendo triado)
//     - chefe da equipe (papel chefe_equipe em usuarios_time)
//     - admin do time
//
// Sem estado, sem IO. Caller passa contexto e a função decide.

import Foundation

/// Contexto do usuário pra decisão de permissão.
public struct UsuarioContexto: Sendable, Equatable {
    /// `auth.users.id` do Supabase Auth (UUID em string).
    public let userId: String?
    /// True se o user é admin do time corrente.
    public let isAdmin: Bool
    /// True se o user tem papel `chefe_equipe` no time corrente.
    public let isChefeEquipe: Bool

    public init(userId: String?, isAdmin: Bool, isChefeEquipe: Bool) {
        self.userId = userId
        self.isAdmin = isAdmin
        self.isChefeEquipe = isChefeEquipe
    }
}

public enum TriagemPermissao {

    /// Decide se um usuário pode triar uma volta gravada.
    /// - Parameters:
    ///   - usuario: contexto do usuário corrente.
    ///   - pilotoUserIdDaSessao: `pilotos.user_id` da sessão à qual a
    ///     volta pertence. Pode ser nil quando o piloto da sessão não
    ///     tem conta vinculada (caso comum em Tier 0).
    /// - Returns: true se o usuário pode marcar manter/descartar.
    public static func podeTriar(
        usuario: UsuarioContexto,
        pilotoUserIdDaSessao: String?
    ) -> Bool {
        // Admin e chefe sempre podem.
        if usuario.isAdmin || usuario.isChefeEquipe { return true }
        // Piloto só pode se for o piloto daquela sessão.
        guard let userId = usuario.userId,
              let pilotoId = pilotoUserIdDaSessao,
              !userId.isEmpty,
              userId == pilotoId else {
            return false
        }
        return true
    }

    /// Variante: avaliação em lote. Útil pra UI decidir se mostra o
    /// botão "Confirmar triagem" considerando a sessão sendo triada.
    public static func razaoBloqueio(
        usuario: UsuarioContexto,
        pilotoUserIdDaSessao: String?
    ) -> String? {
        if podeTriar(usuario: usuario, pilotoUserIdDaSessao: pilotoUserIdDaSessao) {
            return nil
        }
        if pilotoUserIdDaSessao == nil {
            return "Sem conta de piloto vinculada nessa sessão. Apenas chefe da equipe ou admin pode triar."
        }
        if usuario.userId == nil || usuario.userId?.isEmpty == true {
            return "Faça login pra triar voltas."
        }
        return "Só o piloto desta sessão ou o chefe da equipe pode triar essas voltas."
    }
}
