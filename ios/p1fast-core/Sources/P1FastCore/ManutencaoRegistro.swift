// ═══════════════════════════════════════════════════════════
// ManutencaoRegistro — registro de uma troca + histórico/aprendizado
// (reforma 2026-05-31).
// ═══════════════════════════════════════════════════════════
// Modelo GRDB da tabela `manutencoes` (migration v19) + leitura do
// histórico de um item, que liga TUDO:
//   catálogo (regra) + uso real (horas das sessões) + histórico de
//   trocas → status atual + média de vida aprendida (preditivo).
//
// Local — sync pra nuvem fica pra rodada futura.

import Foundation
import GRDB

/// Uma troca registrada de um consumível.
public struct ManutencaoRegistro: Codable, FetchableRecord, PersistableRecord, Identifiable, Sendable {
    public var id: String
    public var timeId: String
    public var carroId: String
    public var itemCodigo: String
    public var ocorridoEm: Int64
    public var marca: String?
    public var modelo: String?
    public var especificacao: String?
    public var observacao: String?
    public var fotoUrl: String?
    /// Pros itens de validade (cinto, extintor…): data da etiqueta (ms).
    public var validadeEtiqueta: Int64?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "manutencoes"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case carroId = "carro_id"
        case itemCodigo = "item_codigo"
        case ocorridoEm = "ocorrido_em"
        case marca, modelo, especificacao, observacao
        case fotoUrl = "foto_url"
        case validadeEtiqueta = "validade_etiqueta"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, carroId: String, itemCodigo: String,
                ocorridoEm: Int64, marca: String? = nil, modelo: String? = nil,
                especificacao: String? = nil, observacao: String? = nil, fotoUrl: String? = nil,
                validadeEtiqueta: Int64? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(), syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.carroId = carroId; self.itemCodigo = itemCodigo
        self.ocorridoEm = ocorridoEm; self.marca = marca; self.modelo = modelo
        self.especificacao = especificacao; self.observacao = observacao; self.fotoUrl = fotoUrl
        self.validadeEtiqueta = validadeEtiqueta
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

/// Leitura do histórico e cálculo de status/aprendizado por item.
public enum ManutencaoHistorico {

    /// Histórico de um item naquele carro, cronológico crescente
    /// (mais antigo → mais novo).
    public static func historico(_ db: Database, carroId: String, timeId: String,
                                 itemCodigo: String) throws -> [ManutencaoRegistro] {
        try ManutencaoRegistro
            .filter(sql: "carro_id = ? AND time_id = ? AND item_codigo = ?",
                    arguments: [carroId, timeId, itemCodigo])
            .order(sql: "ocorrido_em ASC")
            .fetchAll(db)
    }

    /// Uso acumulado (horas/eventos/dias) desde a última troca registrada.
    /// Sem histórico → zero (o contador ainda não começou).
    public static func contadorDesdeUltima(_ db: Database, carroId: String, timeId: String,
                                           itemCodigo: String, agoraMs: Int64) throws -> ContadorUso {
        let h = try historico(db, carroId: carroId, timeId: timeId, itemCodigo: itemCodigo)
        guard let ultima = h.last else { return .zero }
        return try ManutencaoUsoReader.contador(db, carroId: carroId, timeId: timeId,
                                                deMs: ultima.ocorridoEm, ateMs: agoraMs)
    }

    /// Média de vida aprendida (em HORAS) entre trocas consecutivas.
    /// nil se houver menos de 2 trocas (ainda não dá pra aprender).
    public static func mediaHorasAprendida(_ db: Database, carroId: String, timeId: String,
                                           itemCodigo: String) throws -> Double? {
        let h = try historico(db, carroId: carroId, timeId: timeId, itemCodigo: itemCodigo)
        guard h.count >= 2 else { return nil }
        var duracoes: [DuracaoTroca] = []
        for i in 1..<h.count {
            let c = try ManutencaoUsoReader.contador(db, carroId: carroId, timeId: timeId,
                                                     deMs: h[i - 1].ocorridoEm, ateMs: h[i].ocorridoEm)
            duracoes.append(DuracaoTroca(horas: c.horas, eventos: c.eventos, dias: c.dias))
        }
        let media = mediaDuracoes(duracoes)
        return media.horas > 0 ? media.horas : nil
    }

    /// Status atual de um consumível: combina a regra do catálogo com o
    /// uso real, a média aprendida e a validade da última troca.
    public static func status(_ db: Database, item: ConsumivelDef,
                              carroId: String, timeId: String, agoraMs: Int64) throws -> StatusManutencao {
        let contador = try contadorDesdeUltima(db, carroId: carroId, timeId: timeId,
                                               itemCodigo: item.codigo, agoraMs: agoraMs)
        let media = try mediaHorasAprendida(db, carroId: carroId, timeId: timeId, itemCodigo: item.codigo)
        let h = try historico(db, carroId: carroId, timeId: timeId, itemCodigo: item.codigo)
        let diasAteValidade: Int? = h.last?.validadeEtiqueta.map {
            Int(Double($0 - agoraMs) / (24.0 * 60.0 * 60.0 * 1000.0))
        }
        return avaliarTroca(troca: item.troca, contador: contador,
                            diasAteValidade: diasAteValidade, mediaHorasAprendida: media)
    }
}
