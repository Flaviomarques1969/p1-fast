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
    public var alturaCm: Int?
    public var pesoKg: Double?
    public var nascimento: Int64?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pilotos"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome
        case userId = "user_id"
        case alturaCm = "altura_cm"
        case pesoKg = "peso_kg"
        case nascimento
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String, userId: String? = nil,
                alturaCm: Int? = nil, pesoKg: Double? = nil, nascimento: Int64? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome; self.userId = userId
        self.alturaCm = alturaCm; self.pesoKg = pesoKg; self.nascimento = nascimento
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - passageiros
public struct Passageiro: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var nome: String
    public var alturaCm: Int?
    public var pesoKg: Double?
    public var nascimento: Int64?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "passageiros"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome
        case alturaCm = "altura_cm"
        case pesoKg = "peso_kg"
        case nascimento
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String,
                alturaCm: Int? = nil, pesoKg: Double? = nil, nascimento: Int64? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome
        self.alturaCm = alturaCm; self.pesoKg = pesoKg; self.nascimento = nascimento
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - combustiveis
public struct Combustivel: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var nome: String
    public var tipo: String?
    public var octanagem: Double?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "combustiveis"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case nome, tipo, octanagem
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, nome: String,
                tipo: String? = nil, octanagem: Double? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.nome = nome
        self.tipo = tipo; self.octanagem = octanagem
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - pneus
public struct Pneu: Codable, FetchableRecord, PersistableRecord {
    public enum Composto: String, Codable {
        case radial, slick, rua
    }

    public var id: String
    public var timeId: String
    public var carroId: String
    public var marca: String?
    public var modelo: String?
    public var medida: String?
    public var composto: Composto?
    public var ciclos: Int
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pneus"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case carroId = "carro_id"
        case marca, modelo, medida, composto, ciclos
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, carroId: String,
                marca: String? = nil, modelo: String? = nil, medida: String? = nil,
                composto: Composto? = nil, ciclos: Int = 0,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.carroId = carroId
        self.marca = marca; self.modelo = modelo; self.medida = medida
        self.composto = composto; self.ciclos = ciclos
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
    public var pneuId: String?
    public var combustivelId: String?
    public var qtCombustivelLitros: Double?
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
        case pneuId = "pneu_id"
        case combustivelId = "combustivel_id"
        case qtCombustivelLitros = "qt_combustivel_litros"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, eventoId: String? = nil, carroId: String? = nil,
                pilotoId: String? = nil, configuracaoId: String? = nil,
                status: String? = "planejada", dataInicio: Int64? = nil, dataFim: Int64? = nil,
                voltasPlanejadas: Int? = nil, objetivo: String? = nil,
                pneuId: String? = nil, combustivelId: String? = nil,
                qtCombustivelLitros: Double? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.eventoId = eventoId
        self.carroId = carroId; self.pilotoId = pilotoId; self.configuracaoId = configuracaoId
        self.status = status; self.dataInicio = dataInicio; self.dataFim = dataFim
        self.voltasPlanejadas = voltasPlanejadas; self.objetivo = objetivo
        self.pneuId = pneuId; self.combustivelId = combustivelId
        self.qtCombustivelLitros = qtCombustivelLitros
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
    /// Vmin georef (MS-2.4): trio (kmh + x + y) do ponto onde a velocidade
    /// mínima foi observada nesta execução do trecho. Detector calcula em
    /// `DetectorSegmentEndEvent.velMinima` + `apexActual`; persistência
    /// entra em MS-2.5. Nullable — execuções pré-MS-2.5 ficam sem o trio.
    public var vminKmh: Double?
    public var vminX: Double?
    public var vminY: Double?
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
        case vminKmh = "vmin_kmh"
        case vminX = "vmin_x"
        case vminY = "vmin_y"
        case createdAt = "created_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, sessaoId: String, voltaId: String,
                segmentId: String? = nil, tempoMs: Int? = nil, velocidadeMax: Double? = nil,
                vminKmh: Double? = nil, vminX: Double? = nil, vminY: Double? = nil,
                createdAt: Int64 = DB.nowMs(), syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId; self.voltaId = voltaId
        self.segmentId = segmentId; self.tempoMs = tempoMs; self.velocidadeMax = velocidadeMax
        self.vminKmh = vminKmh; self.vminX = vminX; self.vminY = vminY
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

// MARK: - licoes (catálogo curado, GLOBAL — sem time_id)
public struct Licao: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var titulo: String
    public var descricao: String?
    public var categoria: String
    public var nivel: String
    public var fase: String?
    public var tipoCurva: String?
    public var sinaisRequeridos: String?  // JSON serializado pelo client
    public var ativa: Bool
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "licoes"
    enum CodingKeys: String, CodingKey {
        case id, titulo, descricao, categoria, nivel, fase
        case tipoCurva = "tipo_curva"
        case sinaisRequeridos = "sinais_requeridos"
        case ativa
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, titulo: String, descricao: String? = nil,
                categoria: String, nivel: String, fase: String? = nil,
                tipoCurva: String? = nil, sinaisRequeridos: String? = nil,
                ativa: Bool = true,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.titulo = titulo; self.descricao = descricao
        self.categoria = categoria; self.nivel = nivel; self.fase = fase
        self.tipoCurva = tipoCurva; self.sinaisRequeridos = sinaisRequeridos
        self.ativa = ativa
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - pendencias_template (catálogo curado, GLOBAL)
public struct PendenciaTemplate: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var grupoId: String
    public var grupoTitulo: String
    public var grupoNum: String
    public var titulo: String
    public var observacao: String?
    public var obrigatorio: Bool
    public var ordem: Int
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "pendencias_template"
    enum CodingKeys: String, CodingKey {
        case id
        case grupoId = "grupo_id"
        case grupoTitulo = "grupo_titulo"
        case grupoNum = "grupo_num"
        case titulo, observacao, obrigatorio, ordem
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, grupoId: String, grupoTitulo: String, grupoNum: String,
                titulo: String, observacao: String? = nil,
                obrigatorio: Bool = false, ordem: Int,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id
        self.grupoId = grupoId; self.grupoTitulo = grupoTitulo; self.grupoNum = grupoNum
        self.titulo = titulo; self.observacao = observacao
        self.obrigatorio = obrigatorio; self.ordem = ordem
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - evento_pendencias (instâncias por evento)
public struct EventoPendencia: Codable, FetchableRecord, PersistableRecord, Equatable {
    public var id: String
    public var eventoId: String
    public var templateId: String
    public var checado: Bool
    public var checadoAt: Int64?
    public var nota: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "evento_pendencias"
    enum CodingKeys: String, CodingKey {
        case id
        case eventoId = "evento_id"
        case templateId = "template_id"
        case checado
        case checadoAt = "checado_at"
        case nota
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, eventoId: String, templateId: String,
                checado: Bool = false, checadoAt: Int64? = nil, nota: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.eventoId = eventoId; self.templateId = templateId
        self.checado = checado; self.checadoAt = checadoAt; self.nota = nota
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}
