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
    /// MS-2.6.c: JSON serializado de [GeoAncora]. Hidratado por TrackRepository
    /// pra `Track.geoAncoras` no domínio. Pode ser nil — pista cadastrada sem
    /// âncoras geo opera só em frame SVG.
    public var geoAncoras: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "tracks"
    enum CodingKeys: String, CodingKey {
        case id, apelido
        case nomeOficial = "nome_oficial"
        case geoAncoras = "geo_ancoras"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, apelido: String, nomeOficial: String? = nil,
                geoAncoras: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.apelido = apelido; self.nomeOficial = nomeOficial
        self.geoAncoras = geoAncoras
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
    /// MS-2.6.c: JSON serializado de ViewBox `{w, h}`. Casa com svgPath:
    /// dimensões do plano onde o SVG path foi calibrado.
    public var viewBox: String?
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
        case viewBox = "view_box"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, trackId: String, nome: String, parciais: String? = nil,
                svgPath: String? = nil, linhaChegada: String? = nil,
                viewBox: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.trackId = trackId; self.nome = nome
        self.parciais = parciais; self.svgPath = svgPath; self.linhaChegada = linhaChegada
        self.viewBox = viewBox
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
    /// MS-11.1: token único pra link público de vídeo. Vale o dia inteiro
    /// do evento (Q2.4). Quem tem o link consegue ver todos os streams
    /// do evento sem login.
    public var linkPublicoVideoToken: String?
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
        case linkPublicoVideoToken = "link_publico_video_token"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, trackId: String? = nil, tipo: String? = nil,
                dataEvento: Int64, status: String? = "planejado",
                linkPublicoVideoToken: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.trackId = trackId; self.tipo = tipo
        self.dataEvento = dataEvento; self.status = status
        self.linkPublicoVideoToken = linkPublicoVideoToken
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }
}

// MARK: - video_streams (MS-11.1)

/// Status canônico do stream de vídeo. Espelha o CHECK no Postgres.
public enum VideoStreamStatus: String, Codable, Sendable {
    case iniciando
    case aoVivo = "ao_vivo"
    case semSinal = "sem_sinal"
    case encerrado
    case falha
}

/// Transmissão de vídeo de um stint via Daily.co (1:1 com sessoes).
/// Persistido em `video_streams`. Decisões em rodadas 1+2 de 2026-05-11.
/// ADR-024 escolheu Daily.co como serviço.
public struct VideoStream: Codable, FetchableRecord, PersistableRecord {
    public var id: String
    public var timeId: String
    public var sessaoId: String
    public var dailyRoomUrl: String
    public var dailyRoomName: String
    public var status: String
    public var startedAt: Int64?
    public var endedAt: Int64?
    public var ultimaHeartbeat: Int64?
    public var bateriaInicio: Int?
    public var bateriaFim: Int?
    public var motivoEncerramento: String?
    public var createdAt: Int64
    public var updatedAt: Int64
    public var syncedAt: Int64?

    public static let databaseTableName = "video_streams"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case sessaoId = "sessao_id"
        case dailyRoomUrl = "daily_room_url"
        case dailyRoomName = "daily_room_name"
        case status
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case ultimaHeartbeat = "ultima_heartbeat"
        case bateriaInicio = "bateria_inicio"
        case bateriaFim = "bateria_fim"
        case motivoEncerramento = "motivo_encerramento"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    public init(id: String, timeId: String, sessaoId: String,
                dailyRoomUrl: String, dailyRoomName: String,
                status: String = VideoStreamStatus.iniciando.rawValue,
                startedAt: Int64? = nil, endedAt: Int64? = nil,
                ultimaHeartbeat: Int64? = nil,
                bateriaInicio: Int? = nil, bateriaFim: Int? = nil,
                motivoEncerramento: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId
        self.dailyRoomUrl = dailyRoomUrl; self.dailyRoomName = dailyRoomName
        self.status = status
        self.startedAt = startedAt; self.endedAt = endedAt
        self.ultimaHeartbeat = ultimaHeartbeat
        self.bateriaInicio = bateriaInicio; self.bateriaFim = bateriaFim
        self.motivoEncerramento = motivoEncerramento
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }

    /// Indica que o stream parou de receber heartbeat há mais de N segundos.
    /// Caller passa now; helper retorna se há sinal recente. Útil pra UI
    /// do Command Box decidir se mostra última imagem congelada (Q16).
    public func hasSinalRecente(now: Int64 = DB.nowMs(), thresholdMs: Int64 = 10_000) -> Bool {
        guard let hb = ultimaHeartbeat else { return false }
        return (now - hb) < thresholdMs
    }
}

// MARK: - paradas e revezamento (auxiliares de Sessao)

/// Parada planejada no box dentro do StintPlan (MS-4.1).
/// Persistido como JSON em `sessoes.paradas_box`. Motivo aparece no Command Box
/// e na lista de checklist piscando na volta anterior (decisão Q7 + Q2.1).
public struct ParadaBox: Codable, Equatable, Hashable, Sendable {
    public let volta: Int
    public let motivo: String

    public init(volta: Int, motivo: String) {
        self.volta = volta
        self.motivo = motivo
    }
}

/// Turno de revezamento em eventos endurance (MS-4.4).
/// Persistido como JSON em `sessoes.pilotos_revezamento`. Nulo quando
/// o evento não é endurance (decisão Q8 + Q2.2).
public struct PilotoTurno: Codable, Equatable, Hashable, Sendable {
    public let pilotoId: String
    public let voltaInicio: Int
    public let voltaFim: Int

    public init(pilotoId: String, voltaInicio: Int, voltaFim: Int) {
        self.pilotoId = pilotoId
        self.voltaInicio = voltaInicio
        self.voltaFim = voltaFim
    }

    enum CodingKeys: String, CodingKey {
        case pilotoId = "piloto_id"
        case voltaInicio = "volta_inicio"
        case voltaFim = "volta_fim"
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
    // ── MS-4.1 (v14) — novos campos pra StintPlan ──────────
    /// JSON serializado de `[ParadaBox]`. Use `paradasBox` getter pra decodificar.
    public var paradasBoxJson: String
    public var iaLigada: Bool
    public var mapaGhostLigado: Bool
    public var licaoId: String?
    public var canceladoEm: Int64?
    /// JSON serializado de `[PilotoTurno]?` (nil quando não é endurance).
    public var pilotosRevezamentoJson: String?
    public var convidadoId: String?
    // ───────────────────────────────────────────────────────
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
        case paradasBoxJson = "paradas_box"
        case iaLigada = "ia_ligada"
        case mapaGhostLigado = "mapa_ghost_ligado"
        case licaoId = "licao_id"
        case canceladoEm = "cancelado_em"
        case pilotosRevezamentoJson = "pilotos_revezamento"
        case convidadoId = "convidado_id"
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
                paradasBoxJson: String = "[]",
                iaLigada: Bool = false,
                mapaGhostLigado: Bool = false,
                licaoId: String? = nil,
                canceladoEm: Int64? = nil,
                pilotosRevezamentoJson: String? = nil,
                convidadoId: String? = nil,
                createdAt: Int64 = DB.nowMs(), updatedAt: Int64 = DB.nowMs(),
                syncedAt: Int64? = nil) {
        self.id = id; self.timeId = timeId; self.eventoId = eventoId
        self.carroId = carroId; self.pilotoId = pilotoId; self.configuracaoId = configuracaoId
        self.status = status; self.dataInicio = dataInicio; self.dataFim = dataFim
        self.voltasPlanejadas = voltasPlanejadas; self.objetivo = objetivo
        self.pneuId = pneuId; self.combustivelId = combustivelId
        self.qtCombustivelLitros = qtCombustivelLitros
        self.paradasBoxJson = paradasBoxJson
        self.iaLigada = iaLigada
        self.mapaGhostLigado = mapaGhostLigado
        self.licaoId = licaoId
        self.canceladoEm = canceladoEm
        self.pilotosRevezamentoJson = pilotosRevezamentoJson
        self.convidadoId = convidadoId
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.syncedAt = syncedAt
    }

    // MARK: - JSON helpers (MS-4.1)

    /// Decodifica `paradasBoxJson` para `[ParadaBox]`. Retorna lista vazia se
    /// o JSON for inválido ou ausente (campo NOT NULL DEFAULT '[]').
    public var paradasBox: [ParadaBox] {
        guard let data = paradasBoxJson.data(using: .utf8),
              let lista = try? JSONDecoder().decode([ParadaBox].self, from: data) else {
            return []
        }
        return lista
    }

    /// Decodifica `pilotosRevezamentoJson` para `[PilotoTurno]?`. Retorna nil
    /// se o campo estiver nil ou se o JSON for inválido.
    public var pilotosRevezamento: [PilotoTurno]? {
        guard let json = pilotosRevezamentoJson,
              let data = json.data(using: .utf8),
              let lista = try? JSONDecoder().decode([PilotoTurno].self, from: data) else {
            return nil
        }
        return lista
    }

    /// Substitui a lista de paradas no campo JSON. Use no Repository
    /// antes de persistir.
    public mutating func setParadasBox(_ paradas: [ParadaBox]) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        if let data = try? encoder.encode(paradas),
           let json = String(data: data, encoding: .utf8) {
            self.paradasBoxJson = json
        }
    }

    /// Substitui a lista de turnos no campo JSON. Passar nil limpa o campo.
    public mutating func setPilotosRevezamento(_ turnos: [PilotoTurno]?) {
        guard let turnos = turnos else {
            self.pilotosRevezamentoJson = nil
            return
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        if let data = try? encoder.encode(turnos),
           let json = String(data: data, encoding: .utf8) {
            self.pilotosRevezamentoJson = json
        }
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

// MARK: - telemetry_samples_enriched (MS-2.7 PR B, ADR-014: SEM synced_at)
//
// Saída do KalmanINSGPS (PR A) persistida por sample. Estado 2D em
// frame local + heading compass + posSigma + flag sourceKalman.
// Append-only — nunca update/delete. Sync remoto por batch (volume
// proibitivo a 10 Hz contínuo).
public struct TelemetrySampleEnriched: Codable, FetchableRecord, PersistableRecord {
    public var id: Int64?
    public var timeId: String
    public var sessaoId: String
    public var seq: Int
    public var t: Int64
    public var tMono: Double?
    public var xM: Double
    public var yM: Double
    public var vxMps: Double
    public var vyMps: Double
    public var headingDeg: Double
    public var posSigmaM: Double
    public var sourceKalman: Bool
    public var uploadedAt: Int64?
    /// A-07: ms desde o último GPS update válido. Setado APENAS no
    /// sample que disparou reset de covariância (gap > 5s). NULL na
    /// esmagadora maioria das amostras. Usado pela UI pra mostrar
    /// aviso e pelo debrief pra filtrar runs com captura interrompida.
    /// Ver migration v9 e PR #117.
    public var gapDurationMs: Double?

    public static let databaseTableName = "telemetry_samples_enriched"
    enum CodingKeys: String, CodingKey {
        case id
        case timeId = "time_id"
        case sessaoId = "sessao_id"
        case seq, t
        case tMono = "t_mono"
        case xM = "x_m"
        case yM = "y_m"
        case vxMps = "vx_mps"
        case vyMps = "vy_mps"
        case headingDeg = "heading_deg"
        case posSigmaM = "pos_sigma_m"
        case sourceKalman = "source_kalman"
        case uploadedAt = "uploaded_at"
        case gapDurationMs = "gap_duration_ms"
    }

    public init(id: Int64? = nil, timeId: String, sessaoId: String, seq: Int,
                t: Int64, tMono: Double? = nil,
                xM: Double, yM: Double,
                vxMps: Double, vyMps: Double,
                headingDeg: Double, posSigmaM: Double,
                sourceKalman: Bool,
                uploadedAt: Int64? = nil,
                gapDurationMs: Double? = nil) {
        self.id = id; self.timeId = timeId; self.sessaoId = sessaoId; self.seq = seq
        self.t = t; self.tMono = tMono
        self.xM = xM; self.yM = yM
        self.vxMps = vxMps; self.vyMps = vyMps
        self.headingDeg = headingDeg; self.posSigmaM = posSigmaM
        self.sourceKalman = sourceKalman
        self.uploadedAt = uploadedAt
        self.gapDurationMs = gapDurationMs
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
