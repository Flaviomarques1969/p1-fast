import Foundation
import GRDB
import CryptoKit

// ════════════════════════════════════════════════════════════════════════
// Equipe do box — membro com papel único + PIN de 4 dígitos.
//
// Decisão Flávio 23/06/2026: entrada do app por PIN simples (4 dígitos), pra
// saber "quem é quem" no box. Cada membro tem UM papel (Piloto, Mecânico,
// Engenheiro, Chefe de equipe, Visitante = convidado). O PIN NUNCA é guardado
// em texto — só o hash (SHA-256 com sal por membro). Segurança leve, à altura
// de uma ferramenta interna de box (não protege dado sensível).
//
// Tabela: equipe_membros (migration v36). Local; sync pra nuvem fica pra depois.
// ════════════════════════════════════════════════════════════════════════

/// Um membro da equipe do box (pessoa + papel + PIN).
public struct EquipeMembro: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var nome: String
    /// Papel único do membro — `PapelPessoa.rawValue`.
    public var papel: String
    /// Hash do PIN (SHA-256, sal = id do membro). nil = ainda sem PIN definido.
    public var pinHash: String?
    /// Quando o PIN foi definido/trocado (ms epoch).
    public var pinSetEm: Int64?
    /// Soft-delete: false = removido da equipe (não apaga o histórico).
    public var ativo: Bool
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "equipe_membros"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome
        case papel
        case pinHash = "pin_hash"
        case pinSetEm = "pin_set_em"
        case ativo
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String = UUID().uuidString,
                timeId: String,
                nome: String,
                papel: PapelPessoa,
                pinHash: String? = nil,
                pinSetEm: Int64? = nil,
                ativo: Bool = true,
                createdAt: Int64 = DB.nowMs(),
                updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id
        self.timeId = timeId
        self.nome = nome
        self.papel = papel.rawValue
        self.pinHash = pinHash
        self.pinSetEm = pinSetEm
        self.ativo = ativo
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.syncedAt = syncedAt
    }

    /// Papel como enum, sem comparar string no caller.
    public var papelEnum: PapelPessoa? { PapelPessoa(rawValue: papel) }

    /// Já tem PIN definido?
    public var temPin: Bool { pinHash != nil }
}

/// Regras do PIN: validação, hash (com sal por membro) e conferência.
/// O sal é o id do membro, então o MESMO PIN em pessoas diferentes vira
/// hashes diferentes — ninguém descobre o PIN de outro comparando hashes.
public enum PinSeguranca {

    /// Um PIN válido tem exatamente 4 dígitos numéricos.
    public static func pinValido(_ pin: String) -> Bool {
        pin.count == 4 && pin.allSatisfy { $0.isNumber }
    }

    /// Hash hex (SHA-256) de `sal:pin`. 64 caracteres.
    public static func hash(pin: String, salt: String) -> String {
        let digest = SHA256.hash(data: Data("\(salt):\(pin)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// Confere um PIN digitado contra o hash guardado (mesmo sal).
    public static func confere(pin: String, hash: String, salt: String) -> Bool {
        guard pinValido(pin) else { return false }
        return self.hash(pin: pin, salt: salt) == hash
    }
}
