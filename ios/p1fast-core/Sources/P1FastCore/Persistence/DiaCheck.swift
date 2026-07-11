import Foundation
import GRDB

// ════════════════════════════════════════════════════════════════════════
// Marcação do checklist do DIA do evento (tabela dia_check, migration v38).
// Âncora = evento + dia: uma marca por (evento, dia, item). Feito? quem
// fez/conferiu? quando? Alimenta o finalizar e a regra de pendência
// (obrigatório não feito). Local; sync pra nuvem fica pra depois.
//
// IRMÃO de `StintCheck.swift` (marca por stint). Aqui a chave é evento+dia.
// ════════════════════════════════════════════════════════════════════════

public struct MarcaChecklistDia: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    /// Evento ao qual o dia pertence.
    public var eventoId: String
    /// O dia do evento, no formato "AAAA-MM-DD".
    public var dia: String
    /// Id do item no catálogo (ex.: "ini-01", "fim-01").
    public var itemId: String
    public var feito: Bool
    /// Quem marcou (id do membro da equipe). nil = ainda sem dono.
    public var feitoPor: String?
    public var feitoPapel: String?
    public var feitoEm: Int64?
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "dia_check"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case eventoId = "evento_id"
        case dia
        case itemId = "item_id"
        case feito
        case feitoPor = "feito_por"
        case feitoPapel = "feito_papel"
        case feitoEm = "feito_em"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String = UUID().uuidString, timeId: String, eventoId: String, dia: String, itemId: String,
                feito: Bool, feitoPor: String? = nil, feitoPapel: String? = nil, feitoEm: Int64? = nil,
                updatedAt: Int64 = DB.nowMs(), syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.eventoId = eventoId; self.dia = dia; self.itemId = itemId
        self.feito = feito; self.feitoPor = feitoPor; self.feitoPapel = feitoPapel; self.feitoEm = feitoEm
        self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}
