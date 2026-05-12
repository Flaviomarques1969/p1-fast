// ═══════════════════════════════════════════════════════════
// StintEditPermission — regra de quem pode editar/cancelar
// ═══════════════════════════════════════════════════════════
// MS-4.6. Decisão Q23+Q2.3: só piloto principal do stint, pilotos
// em revezamento (endurance) e papel "chefe_equipe" podem editar.
// Admin do time também pode (mantém retrocompat — owner do workspace
// continua tendo poder total mesmo sem ter sido marcado chefe).
//
// Esta função é PURA — entrada→saída, sem efeitos. Testada isolada
// em P1FastSmoke (PERM-01..06). UI consume passando currentUserId,
// role e os ids do stint.
//
// Quando F1 (Pessoas multi-papel) chegar, currentUserId aqui passa a
// ser o id da Pessoa (substitui pilotoId/user_id auth). Função
// continua igual — só a fonte do dado muda.

import Foundation

public enum StintEditPermission {
    /// Retorna true se o usuário tem permissão pra editar/cancelar o stint.
    ///
    /// - Parameters:
    ///   - currentUserId: id da pessoa logada (ou pilotoId enquanto F1 não chega)
    ///   - currentRole: papel no time. Aceita "admin", "membro", "chefe_equipe".
    ///   - pilotoId: piloto principal do stint
    ///   - pilotosRevezamento: lista de turnos pra endurance (ou nil)
    public static func podeEditar(
        currentUserId: String?,
        currentRole: String?,
        pilotoId: String?,
        pilotosRevezamento: [PilotoTurno]?
    ) -> Bool {
        // Admin + chefe_equipe: passe livre
        if let r = currentRole, (r == "admin" || r == "chefe_equipe") {
            return true
        }
        // Piloto principal
        if let uid = currentUserId, let pid = pilotoId, uid == pid {
            return true
        }
        // Piloto em revezamento (endurance)
        if let uid = currentUserId, let turnos = pilotosRevezamento {
            if turnos.contains(where: { $0.pilotoId == uid }) {
                return true
            }
        }
        return false
    }
}
