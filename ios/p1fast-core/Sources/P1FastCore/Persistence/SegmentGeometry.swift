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
// ── Multi-apex 2026-05-05 (decisão Flávio) ─────────────────
// Curva pode ter de 0 a 3 ápices (chicane / S / curva composta).
// Forward-compat: blob ganha `apexPoints: [Point]?` (array novo). O
// par `apexX/apexY` (singular) continua escrito espelhando o primeiro
// elemento, mantendo leitores antigos funcionais. Em decode, se
// `apexPoints` existe ele vence; senão monta a partir de apexX/Y.

import Foundation

public enum SegmentGeometry {

    /// Ponto canônico minimal usado dentro do blob — par {x, y} JSON.
    /// Diferente de `TrackPoint` (typealias de `ApexReference`) só pra
    /// não vazar dependência circular do `Track.swift` aqui.
    public struct Point: Codable, Equatable, Sendable {
        public let x: Double
        public let y: Double
        public init(x: Double, y: Double) {
            self.x = x; self.y = y
        }
        public init(_ p: TrackPoint) { self.x = p.x; self.y = p.y }
        public var trackPoint: TrackPoint { TrackPoint(x: x, y: y) }
    }

    public struct Blob: Codable, Equatable, Sendable {
        public let x: Double
        public let y: Double
        public let tipo: String
        public let tNaVolta: Double?
        public let apexX: Double?
        public let apexY: Double?
        /// Lista canônica de 0..3 ápices. Quando nil, é blob legacy —
        /// `apexReferences` faz fallback pra apexX/apexY. Em writes
        /// novos, é sempre escrito (mesmo `[]`) e apexX/apexY espelha
        /// `apexPoints.first` pra retrocompat.
        public let apexPoints: [Point]?
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
            apexPoints: [Point]? = nil,
            apexStrategy: String? = nil, cornerType: String? = nil,
            nextStraightLength: Double? = nil, apexCalibration: String? = nil,
            entryX: Double? = nil, entryY: Double? = nil,
            brakingX: Double? = nil, brakingY: Double? = nil,
            exitX: Double? = nil, exitY: Double? = nil
        ) {
            self.x = x; self.y = y; self.tipo = tipo
            self.tNaVolta = tNaVolta
            self.apexX = apexX; self.apexY = apexY
            self.apexPoints = apexPoints
            self.apexStrategy = apexStrategy; self.cornerType = cornerType
            self.nextStraightLength = nextStraightLength
            self.apexCalibration = apexCalibration
            self.entryX = entryX; self.entryY = entryY
            self.brakingX = brakingX; self.brakingY = brakingY
            self.exitX = exitX; self.exitY = exitY
        }

        /// Lista efetiva de ápices (0..3). `apexPoints` vence quando
        /// presente; senão constrói singleton de apexX/apexY (legacy);
        /// senão devolve `[]`.
        public var apexReferences: [TrackPoint] {
            if let pts = apexPoints { return pts.map(\.trackPoint) }
            if let ax = apexX, let ay = apexY { return [TrackPoint(x: ax, y: ay)] }
            return []
        }

        /// Primeiro ápice (ou nil). Mantida pra consumidores que ainda
        /// trabalham com apex singular (ErrorClassifier, Track.swift,
        /// Detector). Migrar pra `apexReferences` quando suportarem
        /// múltiplos.
        public var apexReference: TrackPoint? {
            apexReferences.first
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
    /// `TrackSegment.apexReference` ainda é singular — quando virar lista
    /// (PR futuro), ajustar pra passar `apexPoints` direto. Por enquanto,
    /// se houver apex, vai como array de 1 elemento + apexX/Y espelhado.
    public static func encode(_ seg: TrackSegment) -> String? {
        let apexPoints: [Point]? = seg.apexReference.map { [Point(x: $0.x, y: $0.y)] }
        let blob = Blob(
            x: seg.x, y: seg.y,
            tipo: seg.tipo.rawValue,
            tNaVolta: seg.tNaVolta,
            apexX: seg.apexReference?.x, apexY: seg.apexReference?.y,
            apexPoints: apexPoints,
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

    /// Atualiza só os pontos canônicos no blob, preservando os demais
    /// campos. Usado pelo configurador visual MS-1.4. Ponto `nil`
    /// remove o campo (modo degradado — UI normalmente não permite).
    /// Quando `markCalibrated == true`, marca `apexCalibration = "CONFIRMED"`
    /// (sinalizando que Flávio passou pelo configurador). Caso contrário
    /// preserva o valor atual.
    ///
    /// Overload singular: atalho legado pra UI que ainda só edita 1 apex.
    /// Semântica preservada do contrato anterior: `apex == nil` MANTÉM o
    /// apex atual (não zera); passar valor SUBSTITUI por lista de 1.
    /// Quem quiser zerar usa a versão multi com `apexes: []`.
    public static func updateCanonicalPoints(
        in current: Blob,
        entry: TrackPoint?,
        braking: TrackPoint?,
        apex: TrackPoint?,
        exit: TrackPoint?,
        markCalibrated: Bool = false
    ) -> Blob {
        let apexes: [TrackPoint] = apex.map { [$0] } ?? current.apexReferences
        return updateCanonicalPoints(
            in: current,
            entry: entry, braking: braking, apexes: apexes, exit: exit,
            markCalibrated: markCalibrated
        )
    }

    /// Versão multi-apex (0..3). Sobrescreve `apexPoints` totalmente —
    /// passar `[]` zera os ápices do trecho. `apexX/apexY` espelha
    /// `apexes.first` pra retrocompat de leitor antigo.
    public static func updateCanonicalPoints(
        in current: Blob,
        entry: TrackPoint?,
        braking: TrackPoint?,
        apexes: [TrackPoint],
        exit: TrackPoint?,
        markCalibrated: Bool = false
    ) -> Blob {
        let clamped = Array(apexes.prefix(3))
        let points = clamped.map { Point(x: $0.x, y: $0.y) }
        return Blob(
            x: current.x, y: current.y, tipo: current.tipo,
            tNaVolta: current.tNaVolta,
            apexX: clamped.first?.x,
            apexY: clamped.first?.y,
            apexPoints: points,
            apexStrategy: current.apexStrategy,
            cornerType: current.cornerType,
            nextStraightLength: current.nextStraightLength,
            apexCalibration: markCalibrated ? "CONFIRMED" : current.apexCalibration,
            entryX: entry?.x, entryY: entry?.y,
            brakingX: braking?.x, brakingY: braking?.y,
            exitX: exit?.x, exitY: exit?.y
        )
    }
}
