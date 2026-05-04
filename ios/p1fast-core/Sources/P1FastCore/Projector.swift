// ═══════════════════════════════════════════════════════════
// Projector — lat/lng → x/y do viewBox (T-003 / A-003)
// ═══════════════════════════════════════════════════════════
// Port direto de src/telemetry/projector.js (paridade 2026-05-04).
//
// Resolve o gap: Provider emite lat/lng mas Detector espera x/y em
// coordenadas do viewBox. Sem isto o pipeline morre em H03.
//
// Algoritmo: duas âncoras (lat, lng, x, y) definem uma transformação
// afim 2D (escala + rotação + translação). Para áreas <5km a curvatura
// terrestre é irrelevante — autódromo cabe.
//
// Representação complexa:
//   A = vetor lat/lng→metros locais (anchor1 - anchor0)
//   B = vetor viewBox             (anchor1 - anchor0)
//   k = B / A  (multiplicação complexa)
//   sample → metros locais → multiplica por k → soma anchor0.x/y

import Foundation

public enum Projector {
    /// Metros por grau de latitude (constante esférica média).
    public static let mPerDegLat: Double = 111_000

    public struct ViewBoxPoint: Equatable, Sendable {
        public let x: Double
        public let y: Double
        public init(x: Double, y: Double) { self.x = x; self.y = y }
    }

    struct LocalMeters: Equatable {
        let mx: Double
        let my: Double
    }

    /// Converte (lat, lng) em metros locais relativos a `origin`.
    /// y invertido pra casar com viewBox (y cresce pra baixo).
    static func latlngToMeters(lat: Double, lng: Double, origin: GeoAncora) -> LocalMeters {
        let dLat = lat - origin.lat
        let dLng = lng - origin.lng
        let cosLat = cos(origin.lat * .pi / 180.0)
        return LocalMeters(
            mx: dLng * mPerDegLat * cosLat,
            my: -dLat * mPerDegLat
        )
    }

    /// Projeta (lat, lng) de um sample para coordenadas do viewBox usando
    /// as âncoras geográficas do `Track`. Retorna nil se:
    /// - track tem < 2 âncoras
    /// - âncoras coincidem (transformação degenerada)
    /// - lat ou lng não-finitos
    public static func projectToViewBox(
        lat: Double?,
        lng: Double?,
        track: Track
    ) -> ViewBoxPoint? {
        return projectToViewBox(lat: lat, lng: lng, anchors: track.geoAncoras)
    }

    /// Variante usada quando o caller só tem o array de âncoras.
    public static func projectToViewBox(
        lat: Double?,
        lng: Double?,
        anchors: [GeoAncora]
    ) -> ViewBoxPoint? {
        guard anchors.count >= 2 else { return nil }
        guard let lat, let lng, lat.isFinite, lng.isFinite else { return nil }

        let a0 = anchors[0]
        let a1 = anchors[1]

        let A = latlngToMeters(lat: a1.lat, lng: a1.lng, origin: a0)
        let bx = a1.x - a0.x
        let by = a1.y - a0.y

        let denom = A.mx * A.mx + A.my * A.my
        if denom < 1e-9 { return nil } // âncoras coincidentes

        // k = B / A no plano complexo
        let kx = (bx * A.mx + by * A.my) / denom
        let ky = (by * A.mx - bx * A.my) / denom

        let P = latlngToMeters(lat: lat, lng: lng, origin: a0)

        // (Px + iPy) * (kx + iky) = (Px*kx - Py*ky) + i(Px*ky + Py*kx)
        let x = a0.x + (P.mx * kx - P.my * ky)
        let y = a0.y + (P.mx * ky + P.my * kx)
        return ViewBoxPoint(x: x, y: y)
    }
}
