// ═══════════════════════════════════════════════════════════
// PecaModels — modelos da função Estoque (peças por carro)
// Trazido da versão de 2026-05-17 (ambiente infallible-snyder-198a08)
// pra versão oficial em 2026-05-31. Tabelas: pecas / pecas_locais /
// pecas_movimentacoes (migration v26_pecas + v27_pecas_preco).
// ═══════════════════════════════════════════════════════════

import Foundation
import GRDB

public enum PecaArea: String, Codable, CaseIterable, Sendable {
    case motor          = "Motor"
    case cambio         = "Câmbio"
    case embreagem      = "Embreagem"
    case suspensao      = "Suspensão"
    case freios         = "Freios"
    case direcao        = "Direção"
    case eletrica       = "Elétrica"
    case refrigeracao   = "Refrigeração"
    case escape         = "Escape"
    case carroceria     = "Carroceria"
    case pneus          = "Pneus"
    case rodas          = "Rodas"
    case ferramentas    = "Ferramentas de manutenção"
    case acessorios     = "Acessórios"
}

/// Tipo da peça: componente do carro ou ferramenta específica de
/// manutenção daquele carro (ex.: extrator do balancinho do 1.4 Onix).
public enum PecaTipo: String, Codable, CaseIterable, Sendable {
    case componente = "componente"
    case ferramenta = "ferramenta"
}

public struct Peca: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var timeId: String
    public var carroId: String
    public var nome: String
    public var codigo: String?
    public var area: String
    public var tipo: String
    public var especificacao: String?
    public var fotoUrl: String?
    public var quantidade: Int          // 0 quando "só sei a especificação"
    public var precoUnitarioCents: Int? // preço unitário em centavos (R$); nil = sem preço
    public var localId: String?
    public var observacoes: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pecas"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case carroId = "carro_id"
        case nome, codigo, area, tipo, especificacao
        case fotoUrl = "foto_url"
        case quantidade
        case precoUnitarioCents = "preco_unitario_cents"
        case localId = "local_id"
        case observacoes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, carroId: String, nome: String,
                codigo: String? = nil, area: PecaArea, tipo: PecaTipo = .componente,
                especificacao: String? = nil, fotoUrl: String? = nil,
                quantidade: Int = 0, precoUnitarioCents: Int? = nil,
                localId: String? = nil,
                observacoes: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.carroId = carroId
        self.nome = nome; self.codigo = codigo
        self.area = area.rawValue; self.tipo = tipo.rawValue
        self.especificacao = especificacao
        self.fotoUrl = fotoUrl; self.quantidade = quantidade
        self.precoUnitarioCents = precoUnitarioCents
        self.localId = localId; self.observacoes = observacoes
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }

    /// Valor total desta linha (preço × quantidade) em centavos. nil sem preço.
    public var valorTotalCents: Int? {
        guard let p = precoUnitarioCents else { return nil }
        return p * quantidade
    }
}

public struct PecaLocal: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var timeId: String
    public var nome: String
    public var descricao: String?
    public var ordem: Int
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pecas_locais"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome, descricao, ordem
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String,
                descricao: String? = nil, ordem: Int = 0,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome
        self.descricao = descricao; self.ordem = ordem
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

public struct PecaMovimentacao: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var timeId: String
    public var pecaId: String
    public var delta: Int            // +1 ou −1
    public var observacao: String?
    public var ocorridoEm: Int64
    public var createdAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pecas_movimentacoes"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case pecaId = "peca_id"
        case delta, observacao
        case ocorridoEm = "ocorrido_em"
        case createdAt = "created_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, pecaId: String,
                delta: Int, observacao: String? = nil,
                ocorridoEm: Int64 = DB.nowMs(),
                createdAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.pecaId = pecaId
        self.delta = delta; self.observacao = observacao
        self.ocorridoEm = ocorridoEm
        self.createdAt = createdAt; self.syncedAt = syncedAt
    }
}
