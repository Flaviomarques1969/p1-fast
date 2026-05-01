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
    public var cornerType: CornerType?
    public var nextStraightLength: Double?
    public var apexCalibration: String?  // "DEFAULT" | "CONFIRMED"
    // Calculados pelo seed
    public var pathStart: Double?        // % do path SVG
    public var pathEnd: Double?
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
