// ═══════════════════════════════════════════════════════════
// SegmentGeometry — encode/decode JSON da coluna `geometria`
// ═══════════════════════════════════════════════════════════
// Coluna `track_segments.geometria` (TEXT) armazena geometria do trecho
// como JSON. Inclui x/y do centro, tipo, tNaVolta, apex strategy,
// cornerType e os 4 pontos canônicos (entryPoint, brakingPoint,
// apexReference, exitPoint — MS-1.1, decisão Flávio 2026-04-25).
//
// Pure Swift — sem dependência GRDB / iOS / SwiftUI. Smoke valida
// round-trip TrackSegment ↔ JSON ↔ TrackSegment.
//
// Decisão: `apexReference` aparece tanto como apexX/apexY (campos
// raiz, paridade com schema antigo) quanto via `entryPoint/brakingPoint/
// exitPoint`. Update do configurador MS-1.4 escreve em ambos lados.

import Foundation

public enum SegmentGeometry {

    public struct Blob: Codable, Equatable, Sendable {
        public let x: Double
        public let y: Double
        public let tipo: String
        public let tNaVolta: Double?
        public let apexX: Double?
        public let apexY: Double?
        public let apexStrategy: String?
        public let cornerType: String?
        public let nextStraightLength: Double?
        public let apexCalibration: String?
        // 4 pontos canônicos. Todos opcionais — pista degradada opera sem.
        public let entryX: Double?
        public let entryY: Double?
        public let brakingX: Double?
        public let brakingY: Double?
        public let exitX: Double?
        public let exitY: Double?

        public init(
            x: Double, y: Double, tipo: String,
            tNaVolta: Double? = nil,
            apexX: Double? = nil, apexY: Double? = nil,
            apexStrategy: String? = nil, cornerType: String? = nil,
            nextStraightLength: Double? = nil, apexCalibration: String? = nil,
            entryX: Double? = nil, entryY: Double? = nil,
            brakingX: Double? = nil, brakingY: Double? = nil,
            exitX: Double? = nil, exitY: Double? = nil
        ) {
            self.x = x; self.y = y; self.tipo = tipo
            self.tNaVolta = tNaVolta
            self.apexX = apexX; self.apexY = apexY
            self.apexStrategy = apexStrategy; self.cornerType = cornerType
            self.nextStraightLength = nextStraightLength
            self.apexCalibration = apexCalibration
            self.entryX = entryX; self.entryY = entryY
            self.brakingX = brakingX; self.brakingY = brakingY
            self.exitX = exitX; self.exitY = exitY
        }

        /// Reconstrói TrackPoint pra apexReference (se presente).
        public var apexReference: TrackPoint? {
            guard let ax = apexX, let ay = apexY else { return nil }
            return TrackPoint(x: ax, y: ay)
        }
        public var entryPoint: TrackPoint? {
            guard let x = entryX, let y = entryY else { return nil }
            return TrackPoint(x: x, y: y)
        }
        public var brakingPoint: TrackPoint? {
            guard let x = brakingX, let y = brakingY else { return nil }
            return TrackPoint(x: x, y: y)
        }
        public var exitPoint: TrackPoint? {
            guard let x = exitX, let y = exitY else { return nil }
            return TrackPoint(x: x, y: y)
        }
    }

    private static let jsonEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    /// Encode de TrackSegment → Blob → JSON (pra coluna `geometria`).
    public static func encode(_ seg: TrackSegment) -> String? {
        let blob = Blob(
            x: seg.x, y: seg.y,
            tipo: seg.tipo.rawValue,
            tNaVolta: seg.tNaVolta,
            apexX: seg.apexReference?.x, apexY: seg.apexReference?.y,
            apexStrategy: seg.apexStrategy?.rawValue,
            cornerType: seg.cornerType?.rawValue,
            nextStraightLength: seg.nextStraightLength,
            apexCalibration: seg.apexCalibration,
            entryX: seg.entryPoint?.x, entryY: seg.entryPoint?.y,
            brakingX: seg.brakingPoint?.x, brakingY: seg.brakingPoint?.y,
            exitX: seg.exitPoint?.x, exitY: seg.exitPoint?.y
        )
        return encode(blob)
    }

    public static func encode(_ blob: Blob) -> String? {
        guard let data = try? jsonEncoder.encode(blob) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Decode JSON → Blob. Retorna nil se vazio ou malformado (estado
    /// válido — pista pode estar em bootstrap).
    public static func decode(_ json: String?) -> Blob? {
        guard let json, let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Blob.self, from: data)
    }

    /// Atualiza só os 4 pontos canônicos no blob, preservando os demais
    /// campos. Usado pelo configurador visual MS-1.4. Ponto `nil`
    /// remove o campo (modo degradado — UI normalmente não permite).
    public static func updateCanonicalPoints(
        in current: Blob,
        entry: TrackPoint?,
        braking: TrackPoint?,
        apex: TrackPoint?,
        exit: TrackPoint?
    ) -> Blob {
        Blob(
            x: current.x, y: current.y, tipo: current.tipo,
            tNaVolta: current.tNaVolta,
            apexX: apex?.x ?? current.apexX,
            apexY: apex?.y ?? current.apexY,
            apexStrategy: current.apexStrategy,
            cornerType: current.cornerType,
            nextStraightLength: current.nextStraightLength,
            apexCalibration: current.apexCalibration,
            entryX: entry?.x, entryY: entry?.y,
            brakingX: braking?.x, brakingY: braking?.y,
            exitX: exit?.x, exitY: exit?.y
        )
    }
}
