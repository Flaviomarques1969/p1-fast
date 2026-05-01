// ═══════════════════════════════════════════════════════════
// SnapshotTests — paridade com src/telemetry/snapshot.js
// ═══════════════════════════════════════════════════════════
// Verifica buildSnapshot Swift produz o mesmo shape do JS pra
// inputs equivalentes (T-031..T-033 do harness JS + IMU-01/02 do
// node-harness-funcional.mjs).

import Testing
@testable import P1FastCore

@Suite("Snapshot — paridade JS")
struct SnapshotTests {

    private func imuSample(accLong: Double, accLat: Double) -> Sample {
        var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.imu)
        s.accLong = accLong
        s.accLat = accLat
        return s
    }

    private func gpsSample(kmh: Double, acc: Double = 3) -> Sample {
        var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.racebox)
        s.lat = -15.77
        s.lng = -47.90
        s.speed = kmh / 3.6
        s.acc = acc
        return s
    }

    private func t4000Sample(rpm: Double, oilPressure: Double, kmh: Double) -> Sample {
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

    @Test("IMU-01: snapshot consome accLong e accLat do iphone-imu")
    func imuConsumido() {
        let imu = imuSample(accLong: -8.3, accLat: 1.0)
        let gps = gpsSample(kmh: 100)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.imu: SourcePacket(sample: imu),
                SourceTags.racebox: SourcePacket(sample: gps),
            ]
        )
        let aLong = try? #require(snap.dynamics.accelLongitudinal)
        let aLat  = try? #require(snap.dynamics.accelLateral)
        #expect((aLong ?? 0) == -8.3)
        #expect((aLat ?? 0) == 1.0)
    }

    @Test("Vehicle: speedFused é média ponderada CAN×0.55 + GNSS×0.45")
    func speedFused() {
        let t4000 = t4000Sample(rpm: 5500, oilPressure: 4.2, kmh: 91)
        let gps   = gpsSample(kmh: 89)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.t4000: SourcePacket(sample: t4000),
                SourceTags.racebox: SourcePacket(sample: gps),
            ]
        )
        let expected = (91.0 / 3.6) * 0.55 + (89.0 / 3.6) * 0.45
        let fused = try? #require(snap.vehicle.speedFused)
        #expect(abs((fused ?? 0) - expected) < 0.001)
    }

    @Test("Engine: pickEngine extrai rpm/oilPressure/waterTemp do t4000")
    func engineFields() {
        let t4000 = t4000Sample(rpm: 5800, oilPressure: 0.6, kmh: 95)
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [SourceTags.t4000: SourcePacket(sample: t4000)]
        )
        #expect(snap.engine.rpm == 5800)
        #expect((snap.engine.oilPressure ?? 0) - 0.6 < 0.001)
        #expect(snap.engine.waterTemp == 92)
    }

    @Test("Empty input → quality MISSING + confidence Baixa")
    func emptyInput() {
        let snap = SnapshotBuilder.build(tMono: 100, sourcesData: [:])
        #expect(snap.quality.sync == .missing)
        #expect(snap.quality.confidence == "Baixa")
        #expect(snap.engine.rpm == nil)
        #expect(snap.position.lat == nil)
    }

    @Test("Quality consolidada → pior das fontes ativas")
    func qualityWorst() {
        var imu = imuSample(accLong: 0, accLat: 0)
        imu.signalQuality = "GOOD"
        var gps = gpsSample(kmh: 90, acc: 25)
        gps.signalQuality = "DEGRADED"
        let snap = SnapshotBuilder.build(
            tMono: 100,
            sourcesData: [
                SourceTags.imu: SourcePacket(sample: imu, quality: .ok),
                SourceTags.racebox: SourcePacket(sample: gps, quality: .suspect),
            ]
        )
        #expect(snap.quality.sync == .suspect)
    }
}
