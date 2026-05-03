// ═══════════════════════════════════════════════════════════
// Models — Codable + FetchableRecord + PersistableRecord
// ═══════════════════════════════════════════════════════════
// Mapa 1:1 com o schema Postgres (supabase/migrations/0001_initial.sql).
// Cobre as tabelas relevantes da Sprint 1A.1: garagem, sessões, voltas,
// telemetria + tabelas-foundation (times, tracks). Demais tabelas
// (passageiros, pneus, combustiveis, mensagens, trofeus_ganhos) podem
// ganhar struct conforme demanda — schema já existe no DB.
//
// JSON columns (parciais, posicao, overrides, payload, etc.) são `String?`
// — caller (re)serializa via JSONSerialization. Mantém GRDB simples.
//
// Booleans são Bool no Swift mas armazenados como INTEGER 0/1 no SQLite —
// GRDB converte automático.
//
// Naming: `TrackRow`/`TrackLayoutRow`/`TrackSegmentRow` ganham sufixo `Row`
// porque há domain types `Track`/`TrackLayout`/`TrackSegment` em Track.swift
// (shapes puros sem persistência). Demais tabelas (Carro, Sessao, Volta…)
// são nomes únicos — sem sufixo.
//
// `synced_at: Int64?` é nil quando o registro local ainda não foi enviado
// pro Supabase. SyncQueue.markSynced() seta o timestamp.

import Foundation
import GRDB

// MARK: - times
public struct Time: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var nome: String
    public var criadoPor: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "times"
    enum CodingKeys: String, CodingKey {
        case id, nome
        case criadoPor = "criado_por"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, nome: String, criadoPor: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.nome = nome; self.criadoPor = criadoPor
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - tracks
public struct TrackRow: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var apelido: String
    public var nomeOficial: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "tracks"
    enum CodingKeys: String, CodingKey {
        case id, apelido
        case nomeOficial = "nome_oficial"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, apelido: String, nomeOficial: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.apelido = apelido; self.nomeOficial = nomeOficial
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - track_layouts
public struct TrackLayoutRow: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var trackId: String
    public var nome: String
    public var parciais: String?
    public var svgPath: String?
    public var linhaChegada: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "track_layouts"
    enum CodingKeys: String, CodingKey {
        case id
        case trackId = "track_id"
        case nome, parciais
        case svgPath = "svg_path"
        case linhaChegada = "linha_chegada"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, trackId: String, nome: String, parciais: String? = nil,
                svgPath: String? = nil, linhaChegada: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.trackId = trackId; self.nome = nome
        self.parciais = parciais; self.svgPath = svgPath; self.linhaChegada = linhaChegada
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - track_segments
public struct TrackSegmentRow: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var layoutId: String
    public var parcialId: String?
    public var ordem: Int
    public var ehTrecho: Bool
    public var nome: String?
    public var geometria: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "track_segments"
    enum CodingKeys: String, CodingKey {
        case id
        case layoutId = "layout_id"
        case parcialId = "parcial_id"
        case ordem
        case ehTrecho = "eh_trecho"
        case nome, geometria
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, layoutId: String, parcialId: String? = nil, ordem: Int,
                ehTrecho: Bool = true, nome: String? = nil, geometria: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.layoutId = layoutId; self.parcialId = parcialId
        self.ordem = ordem; self.ehTrecho = ehTrecho; self.nome = nome; self.geometria = geometria
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - marcos
public struct Marco: Codable, FetchableRecord, PersistableRecord {
    public enum Tipo: String, Codable {
        case largada, chegada
        case pitIn = "pit-in"
        case pitOut = "pit-out"
        case sinalizacao, box
    }

    public var id: String
    public var layoutId: String
    public var tipo: Tipo
    public var posicao: String
    public var label: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "marcos"
    enum CodingKeys: String, CodingKey {
        case id
        case layoutId = "layout_id"
        case tipo, posicao, label
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, layoutId: String, tipo: Tipo, posicao: String, label: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.layoutId = layoutId; self.tipo = tipo
        self.posicao = posicao; self.label = label
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - retas_especiais
public struct RetaEspecial: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String?
    public var trackId: String
    public var segmentId: String
    public var tempoMedioMs: Int?
    public var autoDetectada: Bool
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "retas_especiais"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case trackId = "track_id"
        case segmentId = "segment_id"
        case tempoMedioMs = "tempo_medio_ms"
        case autoDetectada = "auto_detectada"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String? = nil, trackId: String, segmentId: String,
                tempoMedioMs: Int? = nil, autoDetectada: Bool = false,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.trackId = trackId; self.segmentId = segmentId
        self.tempoMedioMs = tempoMedioMs; self.autoDetectada = autoDetectada
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - carros
public struct Carro: Codable, FetchableRecord, PersistableRecord {
    public enum FonteTemperatura: String, Codable {
        case motor, pneu, ambos
    }

    public var id: String
    public var timeId: String
    public var apelido: String
    public var modelo: String?
    public var categoria: String?
    public var cor: String?
    public var fonteTemperatura: FonteTemperatura
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "carros"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case apelido, modelo, categoria, cor
        case fonteTemperatura = "fonte_temperatura"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, apelido: String, modelo: String? = nil,
                categoria: String? = nil, cor: String? = nil,
                fonteTemperatura: FonteTemperatura = .motor,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.apelido = apelido
        self.modelo = modelo; self.categoria = categoria; self.cor = cor
        self.fonteTemperatura = fonteTemperatura
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - configuracoes
public struct Configuracao: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var carroId: String
    public var nome: String?
    public var dataAplicacao: Int64?
    public var overrides: String?
    public var temperaturaIdealRange: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "configuracoes"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case carroId = "carro_id"
        case nome
        case dataAplicacao = "data_aplicacao"
        case overrides
        case temperaturaIdealRange = "temperatura_ideal_range"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, carroId: String, nome: String? = nil,
                dataAplicacao: Int64? = nil, overrides: String? = nil,
                temperaturaIdealRange: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.carroId = carroId; self.nome = nome
        self.dataAplicacao = dataAplicacao; self.overrides = overrides
        self.temperaturaIdealRange = temperaturaIdealRange
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - pilotos
public struct Piloto: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var nome: String
    public var userId: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pilotos"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome
        case userId = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String, userId: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome; self.userId = userId
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - passageiros
public struct Passageiro: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var nome: String
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "passageiros"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - eventos
public struct Evento: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var trackId: String?
    public var tipo: String?
    public var dataEvento: Int64
    public var status: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "eventos"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case trackId = "track_id"
        case tipo
        case dataEvento = "data_evento"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, trackId: String? = nil, tipo: String? = nil,
                dataEvento: Int64, status: String? = "planejado",
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.trackId = trackId; self.tipo = tipo
        self.dataEvento = dataEvento; self.status = status
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - sessoes
public struct Sessao: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var eventoId: String?
    public var carroId: String?
    public var pilotoId: String?
    public var configuracaoId: String?
    public var status: String?
    public var dataInicio: Int64?
    public var dataFim: Int64?
    public var voltasPlanejadas: Int?
    public var objetivo: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "sessoes"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case eventoId = "evento_id"
        case carroId = "carro_id"
        case pilotoId = "piloto_id"
        case configuracaoId = "configuracao_id"
        case status
        case dataInicio = "data_inicio"
        case dataFim = "data_fim"
        case voltasPlanejadas = "voltas_planejadas"
        case objetivo
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, eventoId: String? = nil, carroId: String? = nil,
                pilotoId: String? = nil, configuracaoId: String? = nil,
                status: String? = "planejada", dataInicio: Int64? = nil, dataFim: Int64? = nil,
                voltasPlanejadas: Int? = nil, objetivo: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.eventoId = eventoId
        self.carroId = carroId; self.pilotoId = pilotoId; self.configuracaoId = configuracaoId
        self.status = status; self.dataInicio = dataInicio; self.dataFim = dataFim
        self.voltasPlanejadas = voltasPlanejadas; self.objetivo = objetivo
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - voltas
public struct Volta: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var sessaoId: String
    public var numero: Int
    public var tempoMs: Int?
    public var temposPorParcial: String?
    public var valida: Bool
    public var motivoInvalidacao: String?
    public var inicioAt: Int64?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "voltas"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case sessaoId = "sessao_id"
        case numero
        case tempoMs = "tempo_ms"
        case temposPorParcial = "tempos_por_parcial"
        case valida
        case motivoInvalidacao = "motivo_invalidacao"
        case inicioAt = "inicio_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, sessaoId: String, numero: Int,
                tempoMs: Int? = nil, temposPorParcial: String? = nil, valida: Bool = true,
                motivoInvalidacao: String? = nil, inicioAt: Int64? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId; self.numero = numero
        self.tempoMs = tempoMs; self.temposPorParcial = temposPorParcial; self.valida = valida
        self.motivoInvalidacao = motivoInvalidacao; self.inicioAt = inicioAt
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - segment_executions
public struct SegmentExecution: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var sessaoId: String
    public var voltaId: String
    public var segmentId: String?
    public var tempoMs: Int?
    public var velocidadeMax: Double?
    public var createdAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "segment_executions"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case sessaoId = "sessao_id"
        case voltaId = "volta_id"
        case segmentId = "segment_id"
        case tempoMs = "tempo_ms"
        case velocidadeMax = "velocidade_max"
        case createdAt = "created_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, sessaoId: String, voltaId: String,
                segmentId: String? = nil, tempoMs: Int? = nil, velocidadeMax: Double? = nil,
                createdAt: Int64 = DB.nowMs(), syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId; self.voltaId = voltaId
        self.segmentId = segmentId; self.tempoMs = tempoMs; self.velocidadeMax = velocidadeMax
        self.createdAt = createdAt; self.syncedAt = syncedAt
    }
}

// MARK: - telemetry_samples (ADR-014: SEM synced_at)
public struct TelemetrySample: Codable, FetchableRecord, PersistableRecord {
    public var id: Int64?
    public var timeId: String
    public var sessaoId: String
    public var seq: Int
    public var t: Int64
    public var tMono: Double?
    public var payload: String
    public var uploadedAt: Int64?

    public static let databaseTableName = "telemetry_samples"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case sessaoId = "sessao_id"
        case seq, t
        case tMono = "t_mono"
        case payload
        case uploadedAt = "uploaded_at"
    }

    public init(id: Int64? = nil, timeId: String, sessaoId: String, seq: Int,
                t: Int64, tMono: Double? = nil, payload: String,
                uploadedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId; self.seq = seq
        self.t = t; self.tMono = tMono; self.payload = payload
        self.uploadedAt = uploadedAt
    }

    public mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
}
