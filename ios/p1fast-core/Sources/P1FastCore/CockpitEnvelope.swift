// ═══════════════════════════════════════════════════════════
// CockpitEnvelope — contrato MS-2.8 iOS↔Windows
// ═══════════════════════════════════════════════════════════
// Espelha bit-a-bit o `TransportEnvelope` definido em
// `web/cockpit/transport.js` (ADR-023 amendment 2).
//
// O iPhone publica em DOIS canais simultâneos:
//   1. TCP socket local 127.0.0.1:5050 (cabo USB via iproxy) — primário
//   2. Supabase Realtime canal `live-stint-{stintId}` — fallback
//
// O cockpit (notebook Windows) consome ambos via TransportSelector e
// usa o source pra distinguir IMU/GPS vs heartbeat.

import Foundation

/// Origem do pacote dentro do envelope. String exatamente igual ao
/// contrato JS (`'iphone-imu'`, `'heartbeat'`).
public enum CockpitEnvelopeSource: String, Codable, Sendable, Equatable {
    case iphoneImu = "iphone-imu"
    case heartbeat
}

/// Payload do `iphone-imu` — agregado a 10 Hz pelo Kalman.
///
/// Coordenadas em viewBox (ex.: 823×799 pra Brasília) — use
/// `Projector.metersToViewBox` pra converter `EnrichedSample.xM/yM`.
/// `accLong`/`accLat` ficam 0.0 enquanto a calibração de frame
/// do iPhone não é feita (LiveTelemetryRecorder.swift:11).
/// `gapDurationMs` é 0 quando não há gap (vez de null) pra preservar
/// type-safety no contrato.
public struct CockpitImuGpsPayload: Codable, Sendable, Equatable {
    public let x: Double
    public let y: Double
    public let accLong: Double
    public let accLat: Double
    public let speedKmh: Double
    public let heading: Double
    public let gapDurationMs: Double

    public init(
        x: Double,
        y: Double,
        accLong: Double,
        accLat: Double,
        speedKmh: Double,
        heading: Double,
        gapDurationMs: Double
    ) {
        self.x = x
        self.y = y
        self.accLong = accLong
        self.accLat = accLat
        self.speedKmh = speedKmh
        self.heading = heading
        self.gapDurationMs = gapDurationMs
    }
}

/// Envelope completo. JSON exatamente como o cockpit espera.
public struct CockpitEnvelope: Codable, Sendable, Equatable {
    public let tMono: Double
    public let source: CockpitEnvelopeSource
    public let payload: CockpitImuGpsPayload?

    public init(tMono: Double, source: CockpitEnvelopeSource, payload: CockpitImuGpsPayload?) {
        self.tMono = tMono
        self.source = source
        self.payload = payload
    }

    public static func imuGps(tMono: Double, payload: CockpitImuGpsPayload) -> CockpitEnvelope {
        CockpitEnvelope(tMono: tMono, source: .iphoneImu, payload: payload)
    }

    public static func heartbeat(tMono: Double) -> CockpitEnvelope {
        CockpitEnvelope(tMono: tMono, source: .heartbeat, payload: nil)
    }

    private enum CodingKeys: String, CodingKey {
        case tMono, source, payload
    }

    /// Encode custom — força `"payload": null` explícito quando heartbeat
    /// (default do JSONEncoder OMITE chaves opcionais nil; o cockpit
    /// recebe `payload: null` no contrato JS, mantemos paridade).
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(tMono, forKey: .tMono)
        try container.encode(source, forKey: .source)
        if let payload {
            try container.encode(payload, forKey: .payload)
        } else {
            try container.encodeNil(forKey: .payload)
        }
    }
}
