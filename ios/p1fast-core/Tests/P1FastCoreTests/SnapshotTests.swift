// ═══════════════════════════════════════════════════════════
// SnapshotTests — paridade com src/telemetry/snapshot.js
// ═══════════════════════════════════════════════════════════
// Verifica buildSnapshot Swift produz o mesmo shape do JS pra
// inputs equivalentes (T-031..T-033 do harness JS).

import XCTest
@testable import P1FastCore

final class SnapshotTests: XCTestCase {

    func makeImuSample(accLong: Double, accLat: Double) -> Sample {
        var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.imu)
        s.accLong = accLong
        s.accLat = accLat
        return s
    }

    func makeGpsSample(kmh: Double, acc: Double = 3) -> Sample {
        var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.racebox)
        s.lat = -15.77
        s.lng = -47.90
        s.speed = kmh / 3.6
        s.acc = acc
        return s
    }

    func makeT4000Sample(rpm: Double, oilPressure: Double, kmh: Double) -> Sample {
        var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.t4000)
        s.rpm = rpm
        s.oilPressure = oilPressure
        s.tps = 60
        s.map = 0.7
        s.lambda = 0.92
        s.waterTemp = 92
        s.batteryVoltage = 13.8
        s.speedCan = kmh / 3.6
        return s
    }

    func testSnapshotConsumesIMUFields() {
        let imu = makeImuSample(accLong: -8.3, accLat: 1.0)
        let gps = makeGpsSample(kmh: 100)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.imu: SourcePacket(sample: imu),
                SourceTags.racebox: SourcePacket(sample: gps),
            ]
        )
        XCTAssertEqual(snap.dynamics.accelLongitudinal, -8.3, accuracy: 0.001)
        XCTAssertEqual(snap.dynamics.accelLateral, 1.0, accuracy: 0.001)
    }

    func testSnapshotFusedSpeed() {
        let t4000 = makeT4000Sample(rpm: 5500, oilPressure: 4.2, kmh: 91)
        let gps = makeGpsSample(kmh: 89)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.t4000: SourcePacket(sample: t4000),
                SourceTags.racebox: SourcePacket(sample: gps),
            ]
        )
        XCTAssertNotNil(snap.vehicle.speedFused)
        // 91/3.6 * 0.55 + 89/3.6 * 0.45 ≈ 25.0 m/s
        XCTAssertEqual(snap.vehicle.speedFused!, (91/3.6) * 0.55 + (89/3.6) * 0.45, accuracy: 0.001)
    }

    func testSnapshotEngineFromT4000() {
        let t4000 = makeT4000Sample(rpm: 5800, oilPressure: 0.6, kmh: 95)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.t4000: SourcePacket(sample: t4000),
            ]
        )
        XCTAssertEqual(snap.engine.rpm, 5800)
        XCTAssertEqual(snap.engine.oilPressure!, 0.6, accuracy: 0.001)
        XCTAssertEqual(snap.engine.waterTemp, 92)
    }

    func testEmptyInputProducesMissingQuality() {
        let snap = SnapshotBuilder.build(tMono: 100, sourcesData: [:])
        XCTAssertEqual(snap.quality.sync, .missing)
        XCTAssertEqual(snap.quality.confidence, "Baixa")
        XCTAssertNil(snap.engine.rpm)
        XCTAssertNil(snap.position.lat)
    }

    func testQualityConsolidatedToWorst() {
        var imu = makeImuSample(accLong: 0, accLat: 0)
        imu.signalQuality = "GOOD"
        var gps = makeGpsSample(kmh: 90, acc: 25)   // fromGpsAccuracy 25 → suspect
        gps.signalQuality = "DEGRADED"
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.imu: SourcePacket(sample: imu, quality: .ok),
                SourceTags.racebox: SourcePacket(sample: gps, quality: .suspect),
            ]
        )
        XCTAssertEqual(snap.quality.sync, .suspect)
        XCTAssertEqual(snap.quality.confidence, "Baixa")
    }
}
