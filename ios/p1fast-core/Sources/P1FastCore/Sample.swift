// ═══════════════════════════════════════════════════════════
// Sample — port Swift da amostra canônica do pipeline
// ═══════════════════════════════════════════════════════════
// Port de src/pipeline/mobile-telemetry.js typedef Sample.
// TELEMETRY_ENGINEERING_RULES Regra 1: origem + timestamp dual
// (t epoch ms, tMono monotonic ms) + unidade + escala + qualidade.
//
// Decisão Swift: separamos Sample em variantes por canal (GPS, IMU,
// Engine) usando enum associated values. Mantém type-safety; conversão
// pra dicionário plano só na hora de serializar pro backend.

import Foundation

/// Source canônico — TelemetryTimebase usa pra freshness diferente.
public struct SourceTags {
    public static let gps = "cockpit-mobile"   // GPS @ ~1Hz, freshness 1500ms
    public static let imu = "iphone-imu"        // CoreMotion @ 50-100Hz, freshness 200ms
    public static let racebox = "racebox-gnss"
    public static let raceboxImu = "racebox-imu"
    public static let t4000 = "t4000"
    public static let mock = "mock"
}

/// Amostra canônica multi-fonte. Mantém shape-flat porque é o contrato
/// com o pipeline JS — fields opcionais conforme a fonte.
public struct Sample: Codable, Sendable {
    public let t: Int64           // Date.now() epoch ms
    public let tMono: Double      // performance.now / CACurrentMediaTime ms
    public let source: String
    public let signalQuality: String   // legacy: GOOD/DEGRADED/BAD/LOST

    // GPS
    public var lat: Double?
    public var lng: Double?
    public var alt: Double?
    public var speed: Double?     // m/s
    public var kmh: Double?
    public var course: Double?
    public var acc: Double?       // GPS accuracy (m)

    // IMU
    public var accX: Double?
    public var accY: Double?
    public var accZ: Double?
    public var accLong: Double?   // calibrado pro frame do veículo (m/s²)
    public var accLat: Double?
    public var accVert: Double?
    public var gyroAlpha: Double?
    public var gyroBeta: Double?
    public var gyroGamma: Double?
    public var heading: Double?

    // Engine (T4000)
    public var rpm: Double?
    public var oilPressure: Double?
    public var oilTemp: Double?
    public var waterTemp: Double?
    public var iat: Double?           // Intake Air Temperature (°C). OBD-II PID 0x0F.
    public var lambda: Double?
    public var tps: Double?
    public var map: Double?
    public var batteryVoltage: Double?
    public var speedCan: Double?
    public var gear: Int?
    public var yawRate: Double?

    public init(
        t: Int64,
        tMono: Double,
        source: String,
        signalQuality: String = "GOOD"
    ) {
        self.t = t
        self.tMono = tMono
        self.source = source
        self.signalQuality = signalQuality
    }

    /// Quality canônica derivada do signalQuality + GPS accuracy.
    public var quality: Quality {
        if source == SourceTags.gps || source == SourceTags.racebox {
            return Quality.fromGpsAccuracy(acc)
        }
        return Quality.fromSignalQuality(signalQuality)
    }
}

/// Helpers de tempo — equivalente a Date.now() / performance.now() do JS.
public enum Clock {
    /// Epoch ms (Date.now equivalente). Pode pular com sync NTP — usar só pra timestamp auditorial.
    public static var now: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
    /// Monotonic ms (performance.now equivalente). Imune a NTP — usar pra deltas.
    /// CACurrentMediaTime() retorna segundos desde boot; multiplicamos por 1000.
    public static var nowMono: Double {
        // ProcessInfo.systemUptime é monotonic e retorna segundos.
        return ProcessInfo.processInfo.systemUptime * 1000.0
    }
}
