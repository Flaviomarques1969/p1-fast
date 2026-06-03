// ═══════════════════════════════════════════════════════════
// PerfilCorrenteService — "quem é o piloto logado"
// ═══════════════════════════════════════════════════════════
// Pendência 4 da reformulação Autódromos (Flávio 2026-05-17):
// "Pelo login. Quem fez login no aparelho é piloto. Se a pessoa
// não estiver classificada como piloto, não pode planejar stint
// — exceto se for chefe de equipe."
//
// Cruza o user_id da sessão Supabase com:
//   - `pilotos.user_id` (legado, ainda usado)
//   - `pessoas.user_id` (Fase A da unificação multi-papel)
//
// Quando achar pessoa cadastrada vinculada ao login, expõe nome e
// papéis. Quem usa: AutodromoDetalheView (recorde pessoal),
// MeuPerfilView (mostra/permite vincular), StintModalView
// (bloqueia planejamento se não for piloto nem chefe).

import Foundation
import GRDB
import P1FastCore

enum PerfilCorrenteService {
    struct Identidade: Equatable {
        let userId: String
        let pilotoId: String?
        let pessoaId: String?
        let nome: String?
        let papeis: Set<PapelPessoa>

        var podePlanejarStint: Bool {
            papeis.contains(.piloto) || papeis.contains(.chefeEquipe)
        }
    }

    /// Identifica o piloto a partir do user_id atual.
    /// Retorna nil quando ninguém está logado, ou Identidade com
    /// pilotoId/pessoaId/papeis nil quando ainda não há vínculo no
    /// banco local. UI usa esse estado pra pedir o vínculo manual.
    static func identidadeAtual(userId: String?, queue: DatabaseQueue) async throws -> Identidade? {
        guard let uid = userId else { return nil }
        return try await queue.read { db -> Identidade in
            // Procura piloto pelo user_id
            let pilotoRow = try Piloto
                .filter(Column("user_id") == uid)
                .fetchOne(db)
            // Procura pessoa (unificação multi-papel) pelo user_id
            let pessoaRow = try Pessoa
                .filter(Column("user_id") == uid)
                .fetchOne(db)
            // Papéis vinculados — só faz sentido pra pessoa
            var papeis: Set<PapelPessoa> = []
            if let pid = pessoaRow?.id {
                let rows = try PessoaPapel
                    .filter(Column("pessoa_id") == pid)
                    .fetchAll(db)
                papeis = Set(rows.compactMap { $0.papelEnum })
            }
            // Se há piloto mas não há pessoa, sabemos que ele é piloto.
            if pessoaRow == nil && pilotoRow != nil {
                papeis.insert(.piloto)
            }
            return Identidade(
                userId: uid,
                pilotoId: pilotoRow?.id,
                pessoaId: pessoaRow?.id,
                nome: pessoaRow?.nome ?? pilotoRow?.nome,
                papeis: papeis
            )
        }
    }

    /// Vincula uma pessoa cadastrada ao user_id do login atual.
    /// Usado pela tela "Meu perfil" quando o gestor escolhe quem é ele.
    /// Salva user_id em `pessoas.user_id` da pessoa selecionada.
    /// Também atualiza `pilotos.user_id` quando há piloto com o mesmo nome
    /// (legado pré-unificação).
    static func vincularPessoa(pessoaId: String, userId: String, queue: DatabaseQueue) async throws {
        try await queue.write { db in
            // Remove vínculo anterior (caso o user já tivesse outra pessoa).
            try db.execute(sql: """
                UPDATE pessoas SET user_id = NULL, updated_at = ?
                WHERE user_id = ? AND id != ?
            """, arguments: [DB.nowMs(), userId, pessoaId])

            // Aplica novo vínculo na pessoa escolhida.
            try db.execute(sql: """
                UPDATE pessoas SET user_id = ?, updated_at = ?
                WHERE id = ?
            """, arguments: [userId, DB.nowMs(), pessoaId])

            // Best-effort: vincula também no piloto legado de mesmo nome.
            try db.execute(sql: """
                UPDATE pilotos SET user_id = ?, updated_at = ?
                WHERE user_id IS NULL
                  AND nome = (SELECT nome FROM pessoas WHERE id = ?)
            """, arguments: [userId, DB.nowMs(), pessoaId])
        }
    }

    /// Lista pessoas do time elegíveis pra serem o "eu" (todas as cadastradas).
    static func pessoasDoTime(queue: DatabaseQueue) async throws -> [Pessoa] {
        guard let teamId = TeamContext.currentTeamId else { return [] }
        return try await queue.read { db in
            try Pessoa.filter(Column("time_id") == teamId)
                .order(Column("nome").asc).fetchAll(db)
        }
    }

    /// Quando ainda não há pessoas cadastradas (modelo unificado), oferece
    /// pilotos legados como alternativa. UI pode oferecer "criar pessoa a
    /// partir do piloto" — fica pra rodada futura. Por ora retornamos a lista
    /// pra UI mostrar "vincule via Pessoas".
    static func pilotosDoTime(queue: DatabaseQueue) async throws -> [Piloto] {
        guard let teamId = TeamContext.currentTeamId else { return [] }
        return try await queue.read { db in
            try Piloto.filter(Column("time_id") == teamId)
                .order(Column("nome").asc).fetchAll(db)
        }
    }
}
