// ═══════════════════════════════════════════════════════════
// Track / TrackLayout / TrackSegment — shapes Swift (sem persistência)
// ═══════════════════════════════════════════════════════════
// Port de:
//   src/domain/track.js
//   src/domain/track-layout.js
//   src/domain/track-segment.js
//
// Apenas value types (struct/enum). Persistência (Dexie/CoreData/SwiftData)
// será camada separada — esses shapes ficam puros pra serem testados em
// smoke + serializados via Codable pros backends Vercel.

import Foundation

public enum SegmentTipo: String, Codable, Sendable {
    case curva
    case reta
}

public enum ApexStrategy: String, Codable, Sendable {
    case antecipado
    case neutro
    case tardio
    case duplo
}

public enum CornerType: String, Codable, Sendable {
    case lenta
    case media
    case rapida
}

public struct ApexReference: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

/// Alias semântico para os 4 pontos canônicos do trecho (entryPoint,
/// brakingPoint, apexReference, exitPoint). Estrutura é a mesma de
/// `ApexReference` ({ x, y } no viewBox do mapa). Decisão Flávio
/// 2026-04-25 — port pro Swift em MS-1.1 (2026-05-03).
public typealias TrackPoint = ApexReference

/// 12 classificações canônicas de apex (port de
/// `src/domain/track-segment.js` `ApexClassification`). Usadas pelo
/// `error-classifier` (MS-1.2) ao confrontar `apexActual` (execução)
/// contra `apexReference` (referência).
public enum ApexClassification: String, Codable, Sendable, CaseIterable {
    case correto                    = "apex-correto"
    case antecipado                 = "apex-antecipado"
    case tardio                     = "apex-tardio"
    case perdidoFora                = "apex-perdido-fora"
    case internoDemais              = "apex-interno-demais"
    case duplo                      = "apex-duplo"
    case sacrificadoIntencional     = "apex-sacrificado-intencional"
    case prejudicandoSaida          = "apex-prejudicando-saida"
    case bomAceleracaoTardia        = "apex-bom-aceleracao-tardia"
    case entradaBoaApexRuim         = "entrada-boa-apex-ruim"
    case apexBomSaidaRuim           = "apex-bom-saida-ruim"
    case entradaRuimApexComprometido = "entrada-ruim-apex-comprometido"
}

public struct LinhaChegada: Codable, Sendable, Equatable {
    public var x1: Double
    public var y1: Double
    public var x2: Double
    public var y2: Double
}

public struct GeoAncora: Codable, Sendable, Equatable {
    public var lat: Double
    public var lng: Double
    public var x: Double
    public var y: Double
}

public struct Parcial: Codable, Sendable, Equatable {
    public var id: String          // "P1", "P2", ...
    public var nome: String        // "Parcial 1"
    public var apelido: String?    // "Saída do box"
    public var tStart: Double      // % do tempo total (0..100)
    public var tEnd: Double

    public init(id: String, nome: String, apelido: String? = nil, tStart: Double, tEnd: Double) {
        self.id = id
        self.nome = nome
        self.apelido = apelido
        self.tStart = tStart
        self.tEnd = tEnd
    }
}

public struct ViewBox: Codable, Sendable, Equatable {
    public var w: Double
    public var h: Double
}

public struct Track: Codable, Sendable, Equatable {
    public var id: String
    public var nome: String              // nome oficial completo
    public var apelido: String           // "Brasília"
    public var pais: String              // "BR"
    public var cidade: String?
    public var extensaoMetros: Double?
    public var numeroCurvas: Int?
    public var sentido: String?          // "horário" | "anti-horário"
    public var imagemFundo: String?
    public var viewBox: ViewBox?
    public var svgPath: String?
    public var linhaChegada: LinhaChegada?
    public var geoAncoras: [GeoAncora]
    public var lapRefSeg: Double?
}

public struct TrackLayout: Codable, Sendable, Equatable {
    public var id: String
    public var trackId: String
    public var nome: String              // "Principal"
    public var linhaChegada: LinhaChegada?
    public var parciais: [Parcial]
}

public struct TrackSegment: Codable, Sendable, Equatable {
    public var id: String
    public var layoutId: String
    public var ordem: Int
    public var nome: String
    public var tipo: SegmentTipo
    public var ehTrecho: Bool            // true só pra curvas
    public var parcialId: String         // "P1".."P4"
    public var x: Double                 // ponto central no viewBox
    public var y: Double
    public var tNaVolta: Double?         // segundos no lap de referência
    // Campos do trecho (curva)
    public var apexReference: ApexReference?
    public var apexStrategy: ApexStrategy?
    public var apexClassificationDefault: ApexClassification?
    public var cornerType: CornerType?
    public var nextStraightLength: Double?
    public var apexCalibration: String?  // "DEFAULT" | "CONFIRMED"
    // 4 pontos canônicos do trecho (Flavio 2026-04-25, port em MS-1.1).
    // Todos opcionais — análise opera em modo degradado se faltarem.
    // entryPoint   — Vmax PRÉ-FREIO. Define INÍCIO do trecho.
    // brakingPoint — onde o piloto começa a frear.
    // exitPoint    — define FIM do trecho (início da reta seguinte).
    public var entryPoint: TrackPoint?
    public var brakingPoint: TrackPoint?
    public var exitPoint: TrackPoint?
    // Calculados pelo seed
    public var pathStart: Double?        // % do path SVG
    public var pathEnd: Double?

    public init(
        id: String,
        layoutId: String,
        ordem: Int,
        nome: String,
        tipo: SegmentTipo,
        ehTrecho: Bool,
        parcialId: String,
        x: Double,
        y: Double,
        tNaVolta: Double? = nil,
        apexReference: ApexReference? = nil,
        apexStrategy: ApexStrategy? = nil,
        apexClassificationDefault: ApexClassification? = nil,
        cornerType: CornerType? = nil,
        nextStraightLength: Double? = nil,
        apexCalibration: String? = nil,
        entryPoint: TrackPoint? = nil,
        brakingPoint: TrackPoint? = nil,
        exitPoint: TrackPoint? = nil,
        pathStart: Double? = nil,
        pathEnd: Double? = nil
    ) {
        self.id = id
        self.layoutId = layoutId
        self.ordem = ordem
        self.nome = nome
        self.tipo = tipo
        self.ehTrecho = ehTrecho
        self.parcialId = parcialId
        self.x = x
        self.y = y
        self.tNaVolta = tNaVolta
        self.apexReference = apexReference
        self.apexStrategy = apexStrategy
        self.apexClassificationDefault = apexClassificationDefault
        self.cornerType = cornerType
        self.nextStraightLength = nextStraightLength
        self.apexCalibration = apexCalibration
        self.entryPoint = entryPoint
        self.brakingPoint = brakingPoint
        self.exitPoint = exitPoint
        self.pathStart = pathStart
        self.pathEnd = pathEnd
    }
}

extension TrackSegment {
    /// Indica se o trecho está cadastrado o suficiente para análise plena
    /// de apex. Sem isto, análise opera em modo degradado.
    /// Port de `TrackSegments.hasFullApexCadastro` (track-segment.js).
    public var hasFullApexCadastro: Bool {
        ehTrecho
            && apexReference != nil
            && apexStrategy != nil
            && cornerType != nil
    }

    /// Indica se o trecho tem os 4 pontos canônicos cadastrados
    /// (entryPoint=Vmax pré-freio, brakingPoint, apexReference, exitPoint).
    /// Quando true, o detector pode medir velocidade pré-freio, ponto de
    /// freio, apex e saída pelo mesmo trecho. Sem isso → modo degradado.
    /// Port de `TrackSegments.hasFullPointCadastro` (track-segment.js).
    public var hasFullPointCadastro: Bool {
        ehTrecho
            && entryPoint != nil
            && brakingPoint != nil
            && apexReference != nil
            && exitPoint != nil
    }

    /// Atualiza um dos 4 pontos canônicos (ou o apexReference) movendo-o
    /// pra `coord` novo. Usado pelo configurador de pista quando o
    /// piloto arrasta o marcador no mapa. `coord = nil` limpa o ponto.
    /// Port de `TrackSegments.setPonto` (track-segment.js).
    public enum CanonicalPoint: String, Sendable {
        case entryPoint
        case brakingPoint
        case apexReference
        case exitPoint
    }

    public func setting(_ ponto: CanonicalPoint, to coord: TrackPoint?) -> TrackSegment {
        var copy = self
        switch ponto {
        case .entryPoint:    copy.entryPoint    = coord
        case .brakingPoint:  copy.brakingPoint  = coord
        case .apexReference: copy.apexReference = coord
        case .exitPoint:     copy.exitPoint     = coord
        }
        return copy
    }
}

extension TrackLayout {
    /// Divide a volta em N parciais de tempo igual.
    public static func parciaisIguais(n: Int = 4) -> [Parcial] {
        precondition(n >= 1, "n >= 1")
        let passo = 100.0 / Double(n)
        return (0..<n).map { i in
            Parcial(
                id: "P\(i+1)",
                nome: "Parcial \(i+1)",
                apelido: nil,
                tStart: Double(i) * passo,
                tEnd: Double(i+1) * passo
            )
        }
    }
}
