// ═══════════════════════════════════════════════════════════
// TeamContext — leitura sync do time_id atual (MS-10 Sprint C.3)
// ═══════════════════════════════════════════════════════════
// SessionManager (MainActor) é a fonte da verdade — ele preenche
// `currentTeamId` após cada applySession via RPC ensure_personal_team
// e persiste em UserDefaults. Os repositórios (GRDB) rodam em
// queues background e não podem hop pro MainActor a cada operação,
// então leem direto de UserDefaults com a mesma chave.
//
// Não é dual-write: SessionManager grava, repositórios só leem.

import Foundation

enum TeamContext {
    /// Mesma chave usada por SessionManager pra persistir o UUID.
    static let storageKey = "p1fast.currentTeamId"

    /// UUID do time pessoal do user logado, ou nil quando ainda não
    /// houve login bem-sucedido (ou logout limpou). Repositórios
    /// devem retornar coleção vazia / no-op quando nil.
    static var currentTeamId: String? {
        UserDefaults.standard.string(forKey: storageKey)
    }
}
