// ═══════════════════════════════════════════════════════════
// PathMapper — port Swift de src/telemetry/path-mapper.js
// ═══════════════════════════════════════════════════════════
// Geometria sobre o pistaPath calibrado (apenas M/L/Z).
//
// • parsePath(d)        — extrai vértices do SVG path
// • pathLength(pts)     — perímetro (soma de hipotenusas)
// • buildLookup(d, n)   — pré-amostra em N pontos equidistantes
// • snap(lookup, x, y)  — projeta GPS no path mais próximo
// • parcialFromOffset   — converte offset → parcial via pathStart/pathEnd
// • segmentsIntersect   — cruzamento de segmentos (detector de linha)
//
// `Lookup` é classe (referência) porque o JS muta `_lastIdx` para
// busca incremental ~10× — manter mesma semântica em Swift exige
// mutabilidade compartilhada entre chamadas de snap.

import Foundation

public enum PathMapper {

    public struct Point: Equatable, Codable, Sendable {
        public let x: Double
        public let y: Double
        public init(x: Double, y: Double) { self.x = x; self.y = y }
    }

    public struct LookupPoint: Codable, Sendable {
        public let x: Double
        public let y: Double
        public let offset: Double
    }

    public final class Lookup {
        public let points: [LookupPoint]
        public let totalLength: Double
        public var lastIdx: Int? = nil
        public init(points: [LookupPoint], totalLength: Double) {
            self.points = points
            self.totalLength = totalLength
        }
    }

    public struct SnapResult: Equatable, Codable, Sendable {
        public let offset: Double
        public let dist: Double
        public let x: Double
        public let y: Double
    }

    private static let snapWindow: Int = 60
    private static let snapGoodDist: Double = 30  // unidades viewBox

    /// Parse simplificado de path d="M x y L x y L x y ... Z".
    public static func parsePath(_ d: String) -> [Point] {
        var pts: [Point] = []
        // Tokeniza: cada comando começa com M/L/Z.
        var tokens: [String] = []
        var current = ""
        for ch in d {
            if "MLZmlz".contains(ch) {
                if !current.isEmpty { tokens.append(current) }
                current = String(ch)
            } else {
                current.append(ch)
            }
        }
        if !current.isEmpty { tokens.append(current) }

        for raw in tokens {
            guard let first = raw.first else { continue }
            let cmd = Character(first.uppercased())
            let rest = raw.dropFirst().trimmingCharacters(in: .whitespaces)
            if cmd == "M" || cmd == "L" {
                let nums = rest
                    .split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\t" || $0 == "\n" })
                    .compactMap { Double($0) }
                var i = 0
                while i + 1 < nums.count {
                    pts.append(Point(x: nums[i], y: nums[i + 1]))
                    i += 2
                }
            } else if cmd == "Z" {
                if let first = pts.first { pts.append(first) }
            }
        }
        return pts
    }

    /// Soma de distâncias entre vértices sequenciais (perímetro).
    public static func pathLength(_ pts: [Point]) -> Double {
        var total: Double = 0
        for i in 1..<pts.count {
            let dx = pts[i].x - pts[i - 1].x
            let dy = pts[i].y - pts[i - 1].y
            total += (dx * dx + dy * dy).squareRoot()
        }
        return total
    }

    /// Pré-amostra o path em N pontos igualmente espaçados.
    public static func buildLookup(_ d: String, samples: Int = 2000) -> Lookup {
        let pts = parsePath(d)
        let totalLen = pathLength(pts)
        var cum: [Double] = [0]
        for i in 1..<pts.count {
            let dx = pts[i].x - pts[i - 1].x
            let dy = pts[i].y - pts[i - 1].y
            cum.append(cum[i - 1] + (dx * dx + dy * dy).squareRoot())
        }
        let step = samples > 0 ? totalLen / Double(samples) : 0
        var out: [LookupPoint] = []
        var vi = 0
        for s in 0...samples {
            let targetLen = Double(s) * step
            while vi < cum.count - 1 && cum[vi + 1] < targetLen { vi += 1 }
            let segStart = cum[vi]
            let segEnd = (vi + 1 < cum.count) ? cum[vi + 1] : segStart
            let segLen = segEnd - segStart
            let t = segLen > 0 ? (targetLen - segStart) / segLen : 0
            let p0 = pts[vi]
            let p1 = (vi + 1 < pts.count) ? pts[vi + 1] : p0
            out.append(LookupPoint(
                x: p0.x + (p1.x - p0.x) * t,
                y: p0.y + (p1.y - p0.y) * t,
                offset: targetLen
            ))
        }
        return Lookup(points: out, totalLength: totalLen)
    }

    /// Projeta (x,y) no ponto mais próximo do path.
    /// Usa busca incremental em volta de `lookup.lastIdx` se disponível.
    public static func snap(_ lookup: Lookup, x: Double, y: Double) -> SnapResult {
        let pts = lookup.points
        let n = pts.count

        // Busca incremental
        if let last = lookup.lastIdx {
            let start = max(0, last - snapWindow)
            let end   = min(n, last + snapWindow)
            var bestD2 = Double.infinity
            var bestIdx = -1
            for i in start..<end {
                let p = pts[i]
                let dx = p.x - x
                let dy = p.y - y
                let d2 = dx * dx + dy * dy
                if d2 < bestD2 {
                    bestD2 = d2
                    bestIdx = i
                }
            }
            if bestIdx >= 0 {
                let dist = bestD2.squareRoot()
                if dist < snapGoodDist {
                    lookup.lastIdx = bestIdx
                    let p = pts[bestIdx]
                    return SnapResult(offset: p.offset, dist: dist, x: p.x, y: p.y)
                }
            }
        }

        // Fallback O(N)
        var bestD2 = Double.infinity
        var bestIdx = 0
        for i in 0..<n {
            let p = pts[i]
            let dx = p.x - x
            let dy = p.y - y
            let d2 = dx * dx + dy * dy
            if d2 < bestD2 {
                bestD2 = d2
                bestIdx = i
            }
        }
        lookup.lastIdx = bestIdx
        let p = pts[bestIdx]
        return SnapResult(offset: p.offset, dist: bestD2.squareRoot(), x: p.x, y: p.y)
    }

    /// Mapeia offset → parcialId via pathStart/pathEnd dos segments.
    public struct SegmentBounds: Sendable {
        public let parcialId: String
        public let pathStart: Double
        public let pathEnd: Double
        public init(parcialId: String, pathStart: Double, pathEnd: Double) {
            self.parcialId = parcialId
            self.pathStart = pathStart
            self.pathEnd = pathEnd
        }
    }

    public static func parcialFromOffset(offset: Double, totalLength: Double, segments: [SegmentBounds]) -> String? {
        guard !segments.isEmpty else { return nil }
        let pct = totalLength > 0 ? (offset / totalLength) * 100.0 : 0
        return segments.first(where: { pct >= $0.pathStart && pct < $0.pathEnd })?.parcialId
    }

    /// Verifica se 2 segmentos AB e CD se cruzam (CCW classic).
    public static func segmentsIntersect(_ A: Point, _ B: Point, _ C: Point, _ D: Point) -> Bool {
        func ccw(_ P: Point, _ Q: Point, _ R: Point) -> Bool {
            return (R.y - P.y) * (Q.x - P.x) > (Q.y - P.y) * (R.x - P.x)
        }
        return ccw(A, C, D) != ccw(B, C, D) && ccw(A, B, C) != ccw(A, B, D)
    }
}
