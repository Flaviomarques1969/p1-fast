// ═══════════════════════════════════════════════════════════
// CarTelemetrySnapshot — port do snapshot canônico
// ═══════════════════════════════════════════════════════════
// Port de src/telemetry/snapshot.js. Snapshot = estado consolidado
// num instante T, NÃO insight. Imutável. Campos não-disponíveis
// = nil (NUNCA 0, NUNCA "—"). Cada canal sabe a fonte de origem.

import Foundation

public struct EngineSnap: Codable, Sendable, Equatable {
    public var rpm: Double?
    public var tps: Double?
    public var map: Double?
    public var lambda: Double?
    public var oilPressure: Double?
    public var oilTemp: Double?
    public var waterTemp: Double?
    public var iat: Double?            // Intake Air Temperature (°C). T4000 OBD-II PID 0x0F.
    public var batteryVoltage: Double?
    public var fuelPressure: Double?
    public var gear: Int?
    public init(
        rpm: Double? = nil, tps: Double? = nil, map: Double? = nil, lambda: Double? = nil,
        oilPressure: Double? = nil, oilTemp: Double? = nil, waterTemp: Double? = nil,
        iat: Double? = nil,
        batteryVoltage: Double? = nil, fuelPressure: Double? = nil, gear: Int? = nil
    ) {
        self.rpm = rpm; self.tps = tps; self.map = map; self.lambda = lambda
        self.oilPressure = oilPressure; self.oilTemp = oilTemp; self.waterTemp = waterTemp
        self.iat = iat
        self.batteryVoltage = batteryVoltage; self.fuelPressure = fuelPressure; self.gear = gear
    }
}

public struct PositionSnap: Codable, Sendable, Equatable {
    public var lat: Double?
    public var lon: Double?
    public var alt: Double?
    public var localX: Double?
    public var localY: Double?
    public var heading: Double?
    public var gpsAccuracy: Double?
    public init(
        lat: Double? = nil, lon: Double? = nil, alt: Double? = nil,
        localX: Double? = nil, localY: Double? = nil,
        heading: Double? = nil, gpsAccuracy: Double? = nil
    ) {
        self.lat = lat; self.lon = lon; self.alt = alt
        self.localX = localX; self.localY = localY
        self.heading = heading; self.gpsAccuracy = gpsAccuracy
    }
}

public struct DynamicsSnap: Codable, Sendable, Equatable {
    public var accelLongitudinal: Double?
    public var accelLateral: Double?
    public var accelVertical: Double?
    public var yawRate: Double?
    public init(
        accelLongitudinal: Double? = nil, accelLateral: Double? = nil,
        accelVertical: Double? = nil, yawRate: Double? = nil
    ) {
        self.accelLongitudinal = accelLongitudinal
        self.accelLateral = accelLateral
        self.accelVertical = accelVertical
        self.yawRate = yawRate
    }
}

public struct VehicleSnap: Codable, Sendable, Equatable {
    public var speedCan: Double?      // m/s (T4000)
    public var speedGnss: Double?     // m/s (GPS)
    public var speedFused: Double?    // ponderada CAN/GNSS
    public init(speedCan: Double? = nil, speedGnss: Double? = nil, speedFused: Double? = nil) {
        self.speedCan = speedCan; self.speedGnss = speedGnss; self.speedFused = speedFused
    }
}

public struct SnapshotQuality: Codable, Sendable, Equatable {
    public var t4000: Quality
    public var racebox: Quality
    public var iphone: Quality
    public var sync: Quality
    public var confidence: String   // "Alta" | "Média" | "Baixa"
    public init(t4000: Quality, racebox: Quality, iphone: Quality, sync: Quality, confidence: String) {
        self.t4000 = t4000; self.racebox = racebox; self.iphone = iphone
        self.sync = sync; self.confidence = confidence
    }
}

public struct Snapshot: Codable, Sendable, Equatable {
    public let t: Int64
    public let tMono: Double
    public let engine: EngineSnap
    public let position: PositionSnap
    public let dynamics: DynamicsSnap
    public let vehicle: VehicleSnap
    public let quality: SnapshotQuality
    public init(
        t: Int64, tMono: Double,
        engine: EngineSnap, position: PositionSnap, dynamics: DynamicsSnap,
        vehicle: VehicleSnap, quality: SnapshotQuality
    ) {
        self.t = t; self.tMono = tMono
        self.engine = engine; self.position = position; self.dynamics = dynamics
        self.vehicle = vehicle; self.quality = quality
    }
}

/// Source-data-package alimentando o builder. Mesmo shape do JS:
///   sourcesData[source] = { sample, quality, ageMs }
public struct SourcePacket: Sendable {
    public let sample: Sample
    public let quality: Quality
    public let ageMs: Double
    public init(sample: Sample, quality: Quality = .ok, ageMs: Double = 0) {
        self.sample = sample
        self.quality = quality
        self.ageMs = ageMs
    }
}

/// Builder — input por fonte → snapshot consolidado.
public enum SnapshotBuilder {
    public static func build(tMono: Double, sourcesData: [String: SourcePacket]) -> Snapshot {
        let t = Clock.now

        let t4000     = sourcesData[SourceTags.t4000]
        let racebox   = sourcesData[SourceTags.racebox]
        let cockpit   = sourcesData[SourceTags.gps]
        let iphoneImu = sourcesData[SourceTags.imu]
        let raceboxIm = sourcesData[SourceTags.raceboxImu]

        let engine = pickEngine(t4000)
        let positionSrc = bestOf([racebox, cockpit])
        let position = pickPosition(positionSrc)
        let dynSrc = bestOf([raceboxIm, iphoneImu, cockpit])
        let dynamics = pickDynamics(dynSrc)
        let vehicle = pickVehicle(t4000: t4000, gnss: positionSrc)

        // Quality consolidada — mesmo algoritmo do JS.
        var fontesAtivas: [Quality] = []
        for s in sourcesData.values where s.sample.t > 0 || s.sample.tMono > 0 {
            fontesAtivas.append(s.quality)
        }
        let syncQ: Quality = fontesAtivas.isEmpty ? .missing : Quality.worstOf(fontesAtivas)
        let confidence: String
        switch syncQ {
        case .ok: confidence = "Alta"
        case .late, .lowConfidence, .interpolated: confidence = "Média"
        default: confidence = "Baixa"
        }
        let quality = SnapshotQuality(
            t4000: t4000?.quality ?? .missing,
            racebox: racebox?.quality ?? .missing,
            iphone: cockpit?.quality ?? .missing,
            sync: syncQ,
            confidence: confidence
        )

        return Snapshot(
            t: t, tMono: tMono,
            engine: engine, position: position,
            dynamics: dynamics, vehicle: vehicle,
            quality: quality
        )
    }

    private static func bestOf(_ candidates: [SourcePacket?]) -> SourcePacket? {
        candidates.compactMap { $0 }.first
    }

    private static func pickEngine(_ src: SourcePacket?) -> EngineSnap {
        guard let s = src?.sample else { return EngineSnap() }
        return EngineSnap(
            rpm: s.rpm,
            tps: s.tps,
            map: s.map,
            lambda: s.lambda,
            oilPressure: s.oilPressure,
            oilTemp: s.oilTemp,
            waterTemp: s.waterTemp,
            iat: s.iat,
            batteryVoltage: s.batteryVoltage,
            fuelPressure: nil,
            gear: s.gear
        )
    }

    private static func pickPosition(_ src: SourcePacket?) -> PositionSnap {
        guard let s = src?.sample else { return PositionSnap() }
        return PositionSnap(
            lat: s.lat, lon: s.lng, alt: s.alt,
            localX: nil, localY: nil,
            heading: s.heading ?? s.course,
            gpsAccuracy: s.acc
        )
    }

    private static func pickDynamics(_ src: SourcePacket?) -> DynamicsSnap {
        guard let s = src?.sample else { return DynamicsSnap() }
        return DynamicsSnap(
            accelLongitudinal: s.accLong,
            accelLateral: s.accLat,
            accelVertical: s.accVert ?? s.accZ,
            yawRate: s.yawRate ?? s.gyroAlpha
        )
    }

    private static func pickVehicle(t4000: SourcePacket?, gnss: SourcePacket?) -> VehicleSnap {
        let speedCan = t4000?.sample.speedCan
        let speedGnss = gnss?.sample.speed
        let fused: Double?
        if let c = speedCan, let g = speedGnss {
            fused = c * 0.55 + g * 0.45
        } else {
            fused = speedCan ?? speedGnss
        }
        return VehicleSnap(speedCan: speedCan, speedGnss: speedGnss, speedFused: fused)
    }
}
