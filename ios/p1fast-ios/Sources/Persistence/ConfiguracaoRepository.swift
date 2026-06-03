// ═══════════════════════════════════════════════════════════
// ConfiguracaoRepository — CRUD da "Configuração do carro"
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). Cada carro pode ter
// várias configurações cadastradas. Uma delas é marcada como "ativa"
// (a "atual" do carro). O piloto pré-escolhe carro+configuração no
// plano do evento; antes de iniciar o stint pode trocar.
//
// Decisões aplicadas:
//   A1: 5 elementos + AERO (3 marcadores: assoalho reto, difusor, splitter).
//   A2 + Q1: várias configs salvas; sempre 1 marcada como atual; piloto
//            troca pela tela do carro OU antes do stint.
//   A3: configs antigas NÃO somem — histórico vivo, vinculadas às voltas.
//   A4: nome manual livre.
//
// Local-only. Sincronização com servidor oficial fica pra rodada futura
// (produção protegida).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class ConfiguracaoRepository: ObservableObject {
    @Published private(set) var configuracoes: [Configuracao] = []

    let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    // MARK: - Bootstrap / reload

    func bootstrap() async {
        do {
            try await reload()
        } catch {
            print("ConfiguracaoRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.configuracoes = []
            return
        }
        let rows = try await queue.read { db in
            try Configuracao
                .filter(Column("time_id") == teamId)
                .order(Column("carro_id"), Column("created_at").desc)
                .fetchAll(db)
        }
        self.configuracoes = rows
    }

    /// Configurações de um carro específico (mais recente primeiro). A ativa,
    /// quando existe, vai no topo independente da data de criação.
    func paraCarro(_ carroId: String) -> [Configuracao] {
        let doCarro = configuracoes.filter { $0.carroId == carroId }
        return doCarro.sorted { a, b in
            if a.ativa != b.ativa { return a.ativa && !b.ativa }
            return a.createdAt > b.createdAt
        }
    }

    /// Retorna a configuração marcada como "atual" do carro (ou nil).
    func ativaDoCarro(_ carroId: String) -> Configuracao? {
        configuracoes.first { $0.carroId == carroId && $0.ativa }
    }

    // MARK: - Criar

    @discardableResult
    func criar(carroId: String,
               nome: String?,
               motor: String?,
               pneusMedida: String?,
               pneusMarca: String?,
               tipoPneu: TipoPneu?,
               cambio: String?,
               aeroAssoalhoReto: Bool,
               aeroDifusor: Bool,
               aeroSplitter: Bool,
               marcarComoAtiva: Bool) async throws -> Configuracao {
        guard let teamId = TeamContext.currentTeamId else {
            throw ConfiguracaoRepoErro.semTime
        }
        let id = UUID().uuidString.lowercased()
        let agora = DB.nowMs()
        var nova = Configuracao(
            id: id, timeId: teamId, carroId: carroId,
            nome: nome,
            motor: motor, pneusMedida: pneusMedida, pneusMarca: pneusMarca,
            tipoPneu: tipoPneu?.rawValue, cambio: cambio,
            aeroAssoalhoReto: aeroAssoalhoReto,
            aeroDifusor: aeroDifusor,
            aeroSplitter: aeroSplitter,
            ativa: marcarComoAtiva,
            createdAt: agora, updatedAt: agora
        )
        try await queue.write { db in
            if marcarComoAtiva {
                try db.execute(sql: """
                    UPDATE configuracoes SET ativa = 0, updated_at = ?
                    WHERE carro_id = ? AND ativa = 1;
                """, arguments: [agora, carroId])
            }
            try nova.insert(db)
        }
        try await reload()
        return nova
    }

    // MARK: - Atualizar

    func atualizar(_ cfg: Configuracao,
                   nome: String?,
                   motor: String?,
                   pneusMedida: String?,
                   pneusMarca: String?,
                   tipoPneu: TipoPneu?,
                   cambio: String?,
                   aeroAssoalhoReto: Bool,
                   aeroDifusor: Bool,
                   aeroSplitter: Bool) async throws {
        var copia = cfg
        copia.nome = nome
        copia.motor = motor
        copia.pneusMedida = pneusMedida
        copia.pneusMarca = pneusMarca
        copia.tipoPneu = tipoPneu?.rawValue
        copia.cambio = cambio
        copia.aeroAssoalhoReto = aeroAssoalhoReto
        copia.aeroDifusor = aeroDifusor
        copia.aeroSplitter = aeroSplitter
        copia.updatedAt = DB.nowMs()
        try await queue.write { db in
            try copia.update(db)
        }
        try await reload()
    }

    /// Marca uma configuração como atual do carro. Desativa as outras
    /// do MESMO carro pra garantir 0 ou 1 ativa por carro.
    func marcarComoAtiva(_ cfg: Configuracao) async throws {
        let agora = DB.nowMs()
        try await queue.write { db in
            try db.execute(sql: """
                UPDATE configuracoes SET ativa = 0, updated_at = ?
                WHERE carro_id = ? AND ativa = 1;
            """, arguments: [agora, cfg.carroId])
            try db.execute(sql: """
                UPDATE configuracoes SET ativa = 1, updated_at = ?
                WHERE id = ?;
            """, arguments: [agora, cfg.id])
        }
        try await reload()
    }

    /// Duplica uma configuração existente (mantém todos os campos, gera
    /// id novo e nome com sufixo " (cópia)"). Útil pra "criar nova
    /// adicionando ou mudando algum item" (Q1 do Flávio).
    @discardableResult
    func duplicar(_ cfg: Configuracao) async throws -> Configuracao {
        let baseNome = (cfg.nome?.trimmingCharacters(in: .whitespaces).isEmpty == false)
            ? cfg.nome! : cfg.resumoLegivel
        return try await criar(
            carroId: cfg.carroId,
            nome: "\(baseNome) (cópia)",
            motor: cfg.motor,
            pneusMedida: cfg.pneusMedida,
            pneusMarca: cfg.pneusMarca,
            tipoPneu: cfg.tipoPneuEnum,
            cambio: cfg.cambio,
            aeroAssoalhoReto: cfg.aeroAssoalhoReto,
            aeroDifusor: cfg.aeroDifusor,
            aeroSplitter: cfg.aeroSplitter,
            marcarComoAtiva: false
        )
    }

    /// Apaga uma configuração. Cuidado: voltas vinculadas a ela perdem
    /// o vínculo (FK ON DELETE SET NULL no schema base). UI deve avisar
    /// quando a config tem voltas dependentes.
    func apagar(_ cfg: Configuracao) async throws {
        try await queue.write { db in
            _ = try Configuracao.deleteOne(db, key: cfg.id)
        }
        try await reload()
    }

    /// Quantas voltas estão vinculadas a essa configuração. Usado pela
    /// UI pra mostrar "5 voltas registradas com esta config" e avisar
    /// antes de apagar.
    func voltasVinculadas(_ cfgId: String) async throws -> Int {
        try await queue.read { db in
            try Int.fetchOne(db, sql: """
                SELECT COUNT(v.id) FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                WHERE s.configuracao_id = ?
            """, arguments: [cfgId]) ?? 0
        }
    }
}

enum ConfiguracaoRepoErro: Error, LocalizedError {
    case semTime

    var errorDescription: String? {
        switch self {
        case .semTime: return "Sem time logado — entre na conta antes de cadastrar configuração."
        }
    }
}
