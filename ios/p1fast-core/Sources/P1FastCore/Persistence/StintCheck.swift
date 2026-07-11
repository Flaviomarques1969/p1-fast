import Foundation
import GRDB

// ════════════════════════════════════════════════════════════════════════
// Marcação do checklist dentro de um stint (tabela stint_check, migration v37).
// Uma marca por (stint, item): feito? quem fez/conferiu? quando?
// Alimenta o finalizar e a regra de pendência (obrigatório não feito).
// ════════════════════════════════════════════════════════════════════════

public struct MarcaChecklistStint: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var stintId: String
    /// Id do item no catálogo (ex.: "pre-01").
    public var itemId: String
    public var feito: Bool
    /// Quem marcou (id do membro da equipe). nil = ainda sem dono.
    public var feitoPor: String?
    public var feitoPapel: String?
    public var feitoEm: Int64?
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "stint_check"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case stintId = "stint_id"
        case itemId = "item_id"
        case feito
        case feitoPor = "feito_por"
        case feitoPapel = "feito_papel"
        case feitoEm = "feito_em"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String = UUID().uuidString, timeId: String, stintId: String, itemId: String,
                feito: Bool, feitoPor: String? = nil, feitoPapel: String? = nil, feitoEm: Int64? = nil,
                updatedAt: Int64 = DB.nowMs(), syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.stintId = stintId; self.itemId = itemId
        self.feito = feito; self.feitoPor = feitoPor; self.feitoPapel = feitoPapel; self.feitoEm = feitoEm
        self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}
