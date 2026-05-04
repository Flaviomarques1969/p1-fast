// ═══════════════════════════════════════════════════════════
// p1fast-smoke — harness Swift validando paridade vs pipeline JS
// ═══════════════════════════════════════════════════════════
// Roda com: swift run p1fast-smoke
// Sem XCTest/Testing — só Foundation + asserts manuais.
// Cada bloco espelha um teste do pipeline JS.

import Foundation
import GRDB
import P1FastCore

var ok = 0
var fail = 0

func step(_ name: String, _ body: () throws -> Void) {
    do {
        try body()
        print("✓ \(name)")
        ok += 1
    } catch {
        print("✗ \(name) — \(error)")
        fail += 1
    }
}

struct Bad: Error { let msg: String }
func assertTrue(_ cond: Bool, _ msg: String = "assert false") throws {
    if !cond { throw Bad(msg: msg) }
}
func assertEq<T: Equatable>(_ a: T, _ b: T, _ msg: String = "") throws {
    if a != b { throw Bad(msg: "\(msg) — esperado \(b), recebido \(a)") }
}
func assertClose(_ a: Double?, _ b: Double, tol: Double = 0.001, _ msg: String = "") throws {
    guard let a else { throw Bad(msg: "\(msg) — recebeu nil") }
    if abs(a - b) > tol { throw Bad(msg: "\(msg) — \(a) ≠ \(b) (tol \(tol))") }
}

// ── helpers de fixture ──────────────────────────────────────
func imuSample(accLong: Double, accLat: Double, signalQuality: String = "GOOD") -> Sample {
    var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.imu, signalQuality: signalQuality)
    s.accLong = accLong
    s.accLat  = accLat
    return s
}
func gpsSample(kmh: Double, acc: Double = 3, signalQuality: String = "GOOD") -> Sample {
    var s = Sample(t: 1_700_000_000_000, tMono: 100, source: SourceTags.racebox, signalQuality: signalQuality)
    s.lat   = -15.77
    s.lng   = -47.90
    s.speed = kmh / 3.6
    s.acc   = acc
    return s
}
func t4000Sample(rpm: Double, oilPressure: Double, kmh: Double) -> Sample {
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

// ════════════════════════════════════════════════════════════
// Quality — DQ-01 .. DQ-12 (paridade JS data-quality.js)
// ════════════════════════════════════════════════════════════

step("DQ-01: 11 categorias canônicas") {
    try assertEq(Quality.allCases.count, 11)
}

step("DQ-02: fromSignalQuality 4-cat → 11-cat (paridade JS)") {
    // JS: degraded → LOW_CONFIDENCE; bad → SUSPECT.
    try assertEq(Quality.fromSignalQuality("GOOD"),     .ok)
    try assertEq(Quality.fromSignalQuality("good"),     .ok)
    try assertEq(Quality.fromSignalQuality("OK"),       .ok)
    try assertEq(Quality.fromSignalQuality("DEGRADED"), .lowConfidence)
    try assertEq(Quality.fromSignalQuality("BAD"),      .suspect)
    try assertEq(Quality.fromSignalQuality("LOST"),     .missing)
    try assertEq(Quality.fromSignalQuality("MISSING"),  .missing)
    // Categoria nova válida — passthrough
    try assertEq(Quality.fromSignalQuality("OUT_OF_RANGE"), .outOfRange)
    // Default: JS retorna OK (não MISSING) p/ valor desconhecido
    try assertEq(Quality.fromSignalQuality("WAT"),      .ok)
    try assertEq(Quality.fromSignalQuality(nil),        .missing)
}

step("DQ-03: fromGpsAccuracy thresholds 5/20/50") {
    try assertEq(Quality.fromGpsAccuracy(2),   .ok)
    try assertEq(Quality.fromGpsAccuracy(5),   .ok)
    try assertEq(Quality.fromGpsAccuracy(10),  .lowConfidence)
    try assertEq(Quality.fromGpsAccuracy(20),  .lowConfidence)
    try assertEq(Quality.fromGpsAccuracy(30),  .suspect)
    try assertEq(Quality.fromGpsAccuracy(50),  .suspect)
    try assertEq(Quality.fromGpsAccuracy(60),  .missing)
    try assertEq(Quality.fromGpsAccuracy(nil), .missing)
    try assertEq(Quality.fromGpsAccuracy(.nan),.missing)
}

step("DQ-04: fromRangeCheck rotula OUT_OF_RANGE") {
    try assertEq(Quality.fromRangeCheck(value: 5, min: 0, max: 10), .ok)
    try assertEq(Quality.fromRangeCheck(value: -1, min: 0, max: 10), .outOfRange)
    try assertEq(Quality.fromRangeCheck(value: 15, min: 0, max: 10), .outOfRange)
}

step("DQ-05: worstOf devolve pior por severidade") {
    try assertEq(Quality.worstOf([.ok, .ok, .ok]), .ok)
    try assertEq(Quality.worstOf([.ok, .suspect, .ok]), .suspect)
    try assertEq(Quality.worstOf([.late, .missing, .ok]), .missing)
    // Paridade JS: lista vazia → OK (seed)
    try assertEq(Quality.worstOf([]), .ok)
}

step("DQ-06: isOk + permitsCritical respeitam Regra 4") {
    try assertTrue(Quality.ok.isOk)
    try assertTrue(!Quality.suspect.isOk)
    try assertTrue(Quality.ok.permitsCritical)
    try assertTrue(!Quality.lowConfidence.permitsCritical)
    try assertTrue(!Quality.missing.permitsCritical)
}

step("DQ-07: fromGpsAccuracy com numSatellites < 6 derruba pra LOW_CONFIDENCE") {
    // Accuracy boa (3m) mas só 4 satélites → LOW_CONFIDENCE
    try assertEq(Quality.fromGpsAccuracy(3, numSatellites: 4),  .lowConfidence)
    try assertEq(Quality.fromGpsAccuracy(3, numSatellites: 5),  .lowConfidence)
    try assertEq(Quality.fromGpsAccuracy(3, numSatellites: 6),  .ok)
    try assertEq(Quality.fromGpsAccuracy(3, numSatellites: 12), .ok)
    // Accuracy ruim ignora numSatellites
    try assertEq(Quality.fromGpsAccuracy(30, numSatellites: 12), .suspect)
}

step("DQ-08: fromRangeCheck com min/max opcionais e value não-finito") {
    // Apenas min: rejeita abaixo, aceita qualquer coisa acima
    try assertEq(Quality.fromRangeCheck(value: 100, min: 0), .ok)
    try assertEq(Quality.fromRangeCheck(value: -1,  min: 0), .outOfRange)
    // Apenas max: rejeita acima, aceita qualquer coisa abaixo
    try assertEq(Quality.fromRangeCheck(value: -100, max: 10), .ok)
    try assertEq(Quality.fromRangeCheck(value: 11,   max: 10), .outOfRange)
    // value não-finito ou nil → MISSING
    try assertEq(Quality.fromRangeCheck(value: nil,  min: 0, max: 10), .missing)
    try assertEq(Quality.fromRangeCheck(value: .nan, min: 0, max: 10), .missing)
    try assertEq(Quality.fromRangeCheck(value: .infinity, min: 0, max: 10), .missing)
}

step("DQ-09: permitsVisual — MISSING/INVALID_CHECKSUM/DUPLICATE são descartados") {
    try assertTrue(Quality.ok.permitsVisual)
    try assertTrue(Quality.suspect.permitsVisual)
    try assertTrue(Quality.lowConfidence.permitsVisual)
    try assertTrue(Quality.late.permitsVisual)
    try assertTrue(Quality.outOfRange.permitsVisual)
    try assertTrue(Quality.interpolated.permitsVisual)
    try assertTrue(Quality.estimated.permitsVisual)
    try assertTrue(Quality.outOfOrder.permitsVisual)
    try assertTrue(!Quality.missing.permitsVisual)
    try assertTrue(!Quality.invalidChecksum.permitsVisual)
    try assertTrue(!Quality.duplicate.permitsVisual)
}

step("DQ-10: label snake_case (paridade JS qualityLabel)") {
    try assertEq(Quality.ok.label,              "ok")
    try assertEq(Quality.suspect.label,         "suspect")
    try assertEq(Quality.missing.label,         "missing")
    try assertEq(Quality.late.label,            "late")
    try assertEq(Quality.outOfOrder.label,      "out_of_order")
    try assertEq(Quality.invalidChecksum.label, "invalid_checksum")
    try assertEq(Quality.outOfRange.label,      "out_of_range")
    try assertEq(Quality.duplicate.label,       "duplicate")
    try assertEq(Quality.interpolated.label,    "interpolated")
    try assertEq(Quality.estimated.label,       "estimated")
    try assertEq(Quality.lowConfidence.label,   "low_confidence")
}

step("DQ-11: token CSS (paridade JS qualityToken)") {
    try assertEq(Quality.ok.token,              "--bom")
    try assertEq(Quality.interpolated.token,    "--sistema")
    try assertEq(Quality.estimated.token,       "--sistema")
    try assertEq(Quality.late.token,            "--atencao")
    try assertEq(Quality.lowConfidence.token,   "--atencao")
    try assertEq(Quality.suspect.token,         "--atencao")
    try assertEq(Quality.outOfRange.token,      "--erro")
    try assertEq(Quality.invalidChecksum.token, "--erro")
    try assertEq(Quality.missing.token,         "--erro")
}

step("DQ-12: severity ordenada — MISSING é máxima") {
    try assertTrue(Quality.ok.severity < Quality.lowConfidence.severity)
    try assertTrue(Quality.lowConfidence.severity < Quality.suspect.severity)
    try assertTrue(Quality.suspect.severity < Quality.outOfRange.severity)
    try assertTrue(Quality.outOfRange.severity < Quality.invalidChecksum.severity)
    try assertTrue(Quality.invalidChecksum.severity < Quality.missing.severity)
    // OK é mínima
    for q in Quality.allCases where q != .ok {
        try assertTrue(Quality.ok.severity < q.severity)
    }
}

// ════════════════════════════════════════════════════════════
// Snapshot — IMU/Vehicle/Engine/Quality (espelha node-harness-funcional)
// ════════════════════════════════════════════════════════════

step("SNAP-01: snapshot consome accLong e accLat do iphone-imu") {
    let snap = SnapshotBuilder.build(
        tMono: 100,
        sourcesData: [
            SourceTags.imu:     SourcePacket(sample: imuSample(accLong: -8.3, accLat: 1.0)),
            SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 100)),
        ]
    )
    try assertClose(snap.dynamics.accelLongitudinal, -8.3, "accLong")
    try assertClose(snap.dynamics.accelLateral,       1.0, "accLat")
}

step("SNAP-02: 4 fases distintas (reta/freio/curva/acel)") {
    let reta = SnapshotBuilder.build(tMono: 1, sourcesData: [
        SourceTags.imu: SourcePacket(sample: imuSample(accLong:  0.5, accLat: 0.2)),
        SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 90)),
    ])
    let freio = SnapshotBuilder.build(tMono: 2, sourcesData: [
        SourceTags.imu: SourcePacket(sample: imuSample(accLong: -8.3, accLat: 1.0)),
        SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 90)),
    ])
    let curva = SnapshotBuilder.build(tMono: 3, sourcesData: [
        SourceTags.imu: SourcePacket(sample: imuSample(accLong: -1.0, accLat: 11.8)),
        SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 90)),
    ])
    let acel = SnapshotBuilder.build(tMono: 4, sourcesData: [
        SourceTags.imu: SourcePacket(sample: imuSample(accLong:  5.4, accLat: 1.5)),
        SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 90)),
    ])
    try assertTrue(abs(reta.dynamics.accelLongitudinal!) < 2.0,  "reta ~0g")
    try assertTrue(freio.dynamics.accelLongitudinal! < -5.0,     "freio < -5 m/s²")
    try assertTrue(abs(curva.dynamics.accelLateral!) > 5.0,      "curva |lat| > 5")
    try assertTrue(acel.dynamics.accelLongitudinal! > 3.0,       "acel > 3 m/s²")
}

step("SNAP-03: speedFused = CAN×0.55 + GNSS×0.45") {
    let snap = SnapshotBuilder.build(
        tMono: 100,
        sourcesData: [
            SourceTags.t4000:   SourcePacket(sample: t4000Sample(rpm: 5500, oilPressure: 4.2, kmh: 91)),
            SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 89)),
        ]
    )
    let expected = (91.0 / 3.6) * 0.55 + (89.0 / 3.6) * 0.45
    try assertClose(snap.vehicle.speedFused, expected, "speedFused")
}

step("SNAP-04: pickEngine extrai rpm/oilPressure/waterTemp") {
    let snap = SnapshotBuilder.build(
        tMono: 100,
        sourcesData: [SourceTags.t4000: SourcePacket(sample: t4000Sample(rpm: 5800, oilPressure: 0.6, kmh: 95))]
    )
    try assertEq(snap.engine.rpm, 5800)
    try assertClose(snap.engine.oilPressure, 0.6, "oilPressure")
    try assertEq(snap.engine.waterTemp, 92)
}

step("SNAP-05: input vazio → quality MISSING + confidence Baixa") {
    let snap = SnapshotBuilder.build(tMono: 100, sourcesData: [:])
    try assertEq(snap.quality.sync, .missing)
    try assertEq(snap.quality.confidence, "Baixa")
    try assertTrue(snap.engine.rpm == nil, "rpm nil")
    try assertTrue(snap.position.lat == nil, "lat nil")
}

step("SNAP-06: quality consolidada → pior das fontes ativas") {
    let snap = SnapshotBuilder.build(
        tMono: 100,
        sourcesData: [
            SourceTags.imu:     SourcePacket(sample: imuSample(accLong: 0, accLat: 0), quality: .ok),
            SourceTags.racebox: SourcePacket(sample: gpsSample(kmh: 90, acc: 25),       quality: .suspect),
        ]
    )
    try assertEq(snap.quality.sync, .suspect)
}

// ════════════════════════════════════════════════════════════
// Clock — paridade com helpers tempo do JS
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// CriticalRules — CR-01 .. CR-05 (espelha node-smoke-telemetry-p0.mjs)
// ════════════════════════════════════════════════════════════

func snapWithEngine(rpm: Double, oilPressure: Double? = nil, waterTemp: Double? = nil, batteryVoltage: Double? = nil, tMono: Double = 100, t4000Quality: Quality = .ok) -> Snapshot {
    var s = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.t4000)
    s.rpm = rpm
    s.oilPressure = oilPressure
    s.waterTemp = waterTemp
    s.batteryVoltage = batteryVoltage
    return SnapshotBuilder.build(
        tMono: tMono,
        sourcesData: [SourceTags.t4000: SourcePacket(sample: s, quality: t4000Quality)]
    )
}

step("CR-01: catálogo tem regras canônicas obrigatórias") {
    let ids = CRITICAL_RULES.map { $0.id }
    try assertTrue(ids.contains("press-oleo-baixa"), "press-oleo-baixa")
    try assertTrue(ids.contains("temp-motor-extrema"), "temp-motor-extrema")
    try assertTrue(ids.contains("bateria-baixa"), "bateria-baixa")
}

step("CR-02: pressão óleo < 1.0 bar com RPM > 1000 dispara BOX_AGORA") {
    var alerts: [Alert] = []
    let engine = CriticalRulesEngine { alerts.append($0) }
    let snap = snapWithEngine(rpm: 5800, oilPressure: 0.6)
    engine.consume(snap)
    try assertEq(alerts.count, 1, "alertas")
    try assertEq(alerts[0].id, "press-oleo-baixa")
    try assertEq(alerts[0].nivel, .boxAgora)
    try assertEq(alerts[0].confianca, "Alta")
    try assertEq(alerts[0].quemAge, "piloto")
}

step("CR-03: temp motor escala ATENCAO → CRITICO → BOX_AGORA") {
    var alerts: [Alert] = []
    let engine = CriticalRulesEngine { alerts.append($0) }
    engine.consume(snapWithEngine(rpm: 5500, waterTemp: 102, tMono: 100))
    engine.consume(snapWithEngine(rpm: 5500, waterTemp: 108, tMono: 31_000))   // depois do cooldown
    engine.consume(snapWithEngine(rpm: 5500, waterTemp: 117, tMono: 62_000))
    let temp = alerts.filter { $0.id == "temp-motor-extrema" }
    try assertEq(temp.count, 3, "três escalões")
    try assertEq(temp[0].nivel, .atencao)
    try assertEq(temp[1].nivel, .critico)
    try assertEq(temp[2].nivel, .boxAgora)
}

step("CR-04: cooldown bloqueia repetição imediata") {
    var alerts: [Alert] = []
    let engine = CriticalRulesEngine { alerts.append($0) }
    engine.consume(snapWithEngine(rpm: 5800, oilPressure: 0.6, tMono: 100))
    engine.consume(snapWithEngine(rpm: 5800, oilPressure: 0.6, tMono: 200))   // dentro de cooldown 10s
    try assertEq(alerts.count, 1, "cooldown bloqueou 2ª")
}

step("CR-05: regra ignora canal sem Quality.OK (Regra 4)") {
    var alerts: [Alert] = []
    let engine = CriticalRulesEngine { alerts.append($0) }
    let snap = snapWithEngine(rpm: 5800, oilPressure: 0.6, t4000Quality: .suspect)
    engine.consume(snap)
    try assertEq(alerts.count, 0, "Regra 4: CRÍTICO precisa OK")
}

step("CR-06: fireManual dispara bandeira vermelha BOX_AGORA") {
    var alerts: [Alert] = []
    let engine = CriticalRulesEngine { alerts.append($0) }
    engine.fireManual(id: "bandeira-vermelha")
    try assertEq(alerts.count, 1)
    try assertEq(alerts[0].id, "bandeira-vermelha")
    try assertEq(alerts[0].nivel, .boxAgora)
}

// ════════════════════════════════════════════════════════════
// CrossValidation — XV-01 .. XV-03 (paridade com node-smoke-telemetry-p0.mjs)
// ════════════════════════════════════════════════════════════

step("XV-V001: divergência CAN vs GNSS > 5 km/h sustentada > 2s emite V-001") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    // 25 amostras a 100ms = 2.5s, divergência 12 km/h
    var tMono: Double = 0
    for _ in 0..<25 {
        tMono += 100
        var t4000 = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.t4000)
        t4000.speedCan = (90 + 12) / 3.6
        var racebox = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.racebox)
        racebox.speed = 90 / 3.6
        let snap = SnapshotBuilder.build(
            tMono: tMono,
            sourcesData: [
                SourceTags.t4000:   SourcePacket(sample: t4000, quality: .ok),
                SourceTags.racebox: SourcePacket(sample: racebox, quality: .ok),
            ]
        )
        xv.consume(snap)
    }
    let v001 = events.filter { $0.validation == "V-001" }
    try assertTrue(v001.count >= 1, "esperava ≥1 V-001, recebeu \(v001.count)")
    try assertEq(v001[0].severity, .atencao)
}

step("XV-V001: divergência < 5 km/h NÃO emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 0
    for _ in 0..<25 {
        tMono += 100
        var t4000 = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.t4000)
        t4000.speedCan = (90 + 0.4) / 3.6
        var racebox = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.racebox)
        racebox.speed = 90 / 3.6
        let snap = SnapshotBuilder.build(
            tMono: tMono,
            sourcesData: [
                SourceTags.t4000:   SourcePacket(sample: t4000, quality: .ok),
                SourceTags.racebox: SourcePacket(sample: racebox, quality: .ok),
            ]
        )
        xv.consume(snap)
    }
    try assertEq(events.count, 0, "esperava 0 events")
}

step("XV-V001: cooldown bloqueia 2ª emissão dentro de 30s") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    // gera divergência sustentada → emite uma vez → outra rajada idêntica
    var tMono: Double = 0
    for _ in 0..<50 {
        tMono += 100
        var t4000 = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.t4000)
        t4000.speedCan = (90 + 12) / 3.6
        var racebox = Sample(t: 1_700_000_000_000, tMono: tMono, source: SourceTags.racebox)
        racebox.speed = 90 / 3.6
        let snap = SnapshotBuilder.build(
            tMono: tMono,
            sourcesData: [
                SourceTags.t4000:   SourcePacket(sample: t4000, quality: .ok),
                SourceTags.racebox: SourcePacket(sample: racebox, quality: .ok),
            ]
        )
        xv.consume(snap)
    }
    let v001 = events.filter { $0.validation == "V-001" }
    try assertEq(v001.count, 1, "cooldown — só 1 emissão em 5s")
}

// ── XV-V003..V-011 (paridade com node-smoke-cross-validation.mjs) ──

/// Helper local — constrói Snapshot diretamente sem passar pelo builder,
/// porque os cenários V-003..V-011 testam canais específicos sem fundir fontes.
func mkSnap(
    tMono: Double,
    rpm: Double? = nil, tps: Double? = nil, map: Double? = nil, lambda: Double? = nil,
    oilPressure: Double? = nil, oilTemp: Double? = nil, waterTemp: Double? = nil,
    batteryVoltage: Double? = nil, gear: Int? = nil,
    accLong: Double? = nil, accLat: Double? = nil, yawRate: Double? = nil,
    speedFused: Double? = nil, lat: Double? = nil, lon: Double? = nil
) -> Snapshot {
    Snapshot(
        t: Int64(tMono), tMono: tMono,
        engine: EngineSnap(
            rpm: rpm, tps: tps, map: map, lambda: lambda,
            oilPressure: oilPressure, oilTemp: oilTemp, waterTemp: waterTemp,
            batteryVoltage: batteryVoltage, fuelPressure: nil, gear: gear
        ),
        position: PositionSnap(lat: lat, lon: lon),
        dynamics: DynamicsSnap(
            accelLongitudinal: accLong, accelLateral: accLat,
            accelVertical: nil, yawRate: yawRate
        ),
        vehicle: VehicleSnap(speedCan: nil, speedGnss: nil, speedFused: speedFused),
        quality: SnapshotQuality(t4000: Quality.ok, racebox: Quality.ok, iphone: Quality.ok, sync: Quality.ok, confidence: "Alta")
    )
}

step("XV-V002: IMU long 5 m/s² mas velocidade não muda → emite após 1s") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 3000 {
        xv.consume(mkSnap(tMono: tMono, accLong: 5.0, speedFused: 25))
        tMono += 100
    }
    let v002 = events.filter { $0.validation == "V-002" }
    try assertEq(v002.count, 1)
}

step("XV-V003: TPS>80 + MAP<0.6 + acc<1 sustentado 0.5s+ → emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 2000 {
        xv.consume(mkSnap(tMono: tMono, tps: 90, map: 0.4, accLong: 0.2))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-003" }.count, 1)
}

step("XV-V003: TPS alto + MAP alto + ganho real → não emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 3000 {
        xv.consume(mkSnap(tMono: tMono, tps: 90, map: 0.95, accLong: 3.0))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-003" }.count, 0)
}

step("XV-V004: rpm/gear/speed inconsistente por 1s+ → emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 3000 {
        // 4ª em 5000 RPM esperado ~48.6 m/s; carro a 25 m/s → erro ~50%
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, gear: 4, speedFused: 25))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-004" }.count, 1)
}

step("XV-V004: rpm/gear/speed consistente → não emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 3000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, gear: 4, speedFused: 48.6))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-004" }.count, 0)
}

step("XV-V005: water temp slope > 0.5°C/min sustentado 60s+ → emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 0
    while tMono < 6 * 60_000 {
        // 100°C +1.5°C/min — quando janela 60s atinge, tw > 100 → critico
        xv.consume(mkSnap(tMono: tMono, waterTemp: 100 + (tMono / 60_000) * 1.5))
        tMono += 1000
    }
    let v5 = events.filter { $0.validation == "V-005" }
    try assertTrue(v5.count >= 1, "V-005 não emitiu")
    try assertEq(v5[0].severity, .critico)
}

step("XV-V006: pressão óleo 1 bar a 5000 RPM por 2s+ → critico") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 4000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, oilPressure: 1.0, oilTemp: 90))
        tMono += 100
    }
    let v6 = events.filter { $0.validation == "V-006" }
    try assertEq(v6.count, 1)
    try assertEq(v6[0].severity, .critico)
}

step("XV-V006: pressão óleo saudável → não emite") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 4000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, oilPressure: 5.0, oilTemp: 90))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-006" }.count, 0)
}

step("XV-V007: λ>1.0 sob carga por 1-5s → atencao") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 3000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 6000, tps: 90, map: 1.0, lambda: 1.05))
        tMono += 100
    }
    let v7 = events.filter { $0.validation == "V-007" }
    try assertEq(v7.count, 1)
    try assertEq(v7[0].severity, .atencao)
}

step("XV-V007: λ>1.0 sob carga por 5s+ com cooldown reduzido → critico") {
    // Cooldown padrão (30s) bloqueia escalada atencao→critico — mesmo design do JS.
    // Pra validar lógica de janela 5s, usa cooldown 500ms.
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine(onEvent: { events.append($0) }, cooldownMs: 500)
    var tMono: Double = 1000
    while tMono < 7000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 6000, tps: 90, map: 1.0, lambda: 1.05))
        tMono += 100
    }
    let critico = events.filter { $0.validation == "V-007" && $0.severity == .critico }
    try assertTrue(critico.count >= 1, "crítico não disparou em 5s+")
}

step("XV-V008: bateria 10V a 5000 RPM por 2s+ → critico") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 4000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, batteryVoltage: 10.0))
        tMono += 100
    }
    let v8 = events.filter { $0.validation == "V-008" }
    try assertEq(v8.count, 1)
    try assertEq(v8[0].severity, .critico)
}

step("XV-V008: bateria 11V a 5000 RPM → atencao (não critico)") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 4000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, batteryVoltage: 11.0))
        tMono += 100
    }
    let v8 = events.filter { $0.validation == "V-008" }
    try assertEq(v8.count, 1)
    try assertEq(v8[0].severity, .atencao)
}

step("XV-V010: yaw alto + aLat baixo → sobresterço (V-010)") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    xv.consume(mkSnap(tMono: 1000, accLat: 1.5, yawRate: 50))
    try assertEq(events.filter { $0.validation == "V-010" }.count, 1)
}

step("XV-V010-b: aLat alto + yaw baixo → subesterço") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    xv.consume(mkSnap(tMono: 1000, accLat: 9.0, yawRate: 5))
    try assertEq(events.filter { $0.validation == "V-010-b" }.count, 1)
}

step("XV-V011: aLat divergente do raio da trajetória → emite info") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    let radius = 100.0, v = 30.0, omega = v / radius
    let cosLat = cos(-15.77 * .pi / 180)
    var tMono: Double = 1000
    while tMono < 3000 {
        let theta = (omega * tMono) / 1000
        let lat = -15.77 + (radius * cos(theta)) / 111_320
        let lon = -47.90 + (radius * sin(theta)) / (111_320 * cosLat)
        // aLat 1 m/s² mas trajetória pede ~9 m/s²
        xv.consume(mkSnap(tMono: tMono, accLat: 1.0, speedFused: v, lat: lat, lon: lon))
        tMono += 100
    }
    try assertTrue(events.filter { $0.validation == "V-011" }.count >= 1)
}

step("XV-reset: limpa cooldowns e janelas") {
    var events: [ValidationEvent] = []
    let xv = CrossValidationEngine { events.append($0) }
    var tMono: Double = 1000
    while tMono < 4000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, oilPressure: 1.0))
        tMono += 100
    }
    try assertEq(events.filter { $0.validation == "V-006" }.count, 1)
    xv.reset()
    while tMono < 7000 {
        xv.consume(mkSnap(tMono: tMono, rpm: 5000, oilPressure: 1.0))
        tMono += 100
    }
    // Após reset, mesmo dentro do cooldown original, nova janela emite de novo
    try assertEq(events.filter { $0.validation == "V-006" }.count, 2)
}

step("CR-07: regras manuais existem (3 mínimo)") {
    try assertTrue(MANUAL_RULES.count >= 3, "manual rules >= 3")
    let ids = MANUAL_RULES.map { $0.id }
    try assertTrue(ids.contains("bandeira-vermelha"))
    try assertTrue(ids.contains("bandeira-amarela"))
    try assertTrue(ids.contains("pista-molhada"))
}

// ════════════════════════════════════════════════════════════
// Track / SeedBrasilia — TRK-01 .. TRK-05 (paridade JS seed-tracks.js)
// ════════════════════════════════════════════════════════════

step("TRK-01: parciaisIguais(4) gera 4 parciais 0-25/25-50/50-75/75-100") {
    let p = TrackLayout.parciaisIguais(n: 4)
    try assertEq(p.count, 4)
    try assertEq(p[0].id, "P1")
    try assertClose(p[0].tStart, 0)
    try assertClose(p[0].tEnd, 25)
    try assertClose(p[3].tEnd, 100)
}

step("TRK-02: SeedBrasilia.make() retorna track + layout + 12 segmentos") {
    let r = SeedBrasilia.make()
    try assertEq(r.track.apelido, "Brasília")
    try assertEq(r.track.numeroCurvas, 8)
    try assertEq(r.track.sentido, "anti-horário")
    try assertEq(r.layout.parciais.count, 4)
    try assertEq(r.segments.count, 12)
}

step("TRK-03: Brasília tem 8 trechos (curvas) + 4 retas") {
    let r = SeedBrasilia.make()
    let curvas = r.segments.filter { $0.ehTrecho }
    let retas  = r.segments.filter { !$0.ehTrecho }
    try assertEq(curvas.count, 8)
    try assertEq(retas.count, 4)
}

step("TRK-04: todos os trechos têm apex calibration DEFAULT + apexReference + cornerType") {
    let r = SeedBrasilia.make()
    let trechos = r.segments.filter { $0.ehTrecho }
    for t in trechos {
        try assertEq(t.apexCalibration, "DEFAULT", "\(t.nome) sem DEFAULT")
        try assertTrue(t.apexReference != nil, "\(t.nome) sem apexReference")
        try assertTrue(t.apexStrategy != nil, "\(t.nome) sem apexStrategy")
        try assertTrue(t.cornerType != nil, "\(t.nome) sem cornerType")
    }
}

step("TRK-05a: ApexClassification — 12 valores canônicos") {
    try assertEq(ApexClassification.allCases.count, 12)
    // Smoke das raw values: paridade exata com track-segment.js
    try assertEq(ApexClassification.correto.rawValue, "apex-correto")
    try assertEq(ApexClassification.antecipado.rawValue, "apex-antecipado")
    try assertEq(ApexClassification.tardio.rawValue, "apex-tardio")
    try assertEq(ApexClassification.perdidoFora.rawValue, "apex-perdido-fora")
    try assertEq(ApexClassification.internoDemais.rawValue, "apex-interno-demais")
    try assertEq(ApexClassification.duplo.rawValue, "apex-duplo")
    try assertEq(ApexClassification.sacrificadoIntencional.rawValue, "apex-sacrificado-intencional")
    try assertEq(ApexClassification.prejudicandoSaida.rawValue, "apex-prejudicando-saida")
    try assertEq(ApexClassification.bomAceleracaoTardia.rawValue, "apex-bom-aceleracao-tardia")
    try assertEq(ApexClassification.entradaBoaApexRuim.rawValue, "entrada-boa-apex-ruim")
    try assertEq(ApexClassification.apexBomSaidaRuim.rawValue, "apex-bom-saida-ruim")
    try assertEq(ApexClassification.entradaRuimApexComprometido.rawValue, "entrada-ruim-apex-comprometido")
}

step("TRK-05b: TrackSegment — hasFullPointCadastro exige 4 pontos + ehTrecho") {
    var seg = TrackSegment(
        id: "s1", layoutId: "L", ordem: 0, nome: "Curva 1",
        tipo: .curva, ehTrecho: true, parcialId: "P1",
        x: 100, y: 100
    )
    try assertTrue(!seg.hasFullPointCadastro, "vazio: deve ser false")
    seg.entryPoint = TrackPoint(x: 50, y: 50)
    try assertTrue(!seg.hasFullPointCadastro, "só entry: deve ser false")
    seg.brakingPoint = TrackPoint(x: 60, y: 60)
    seg.apexReference = ApexReference(x: 100, y: 100)
    try assertTrue(!seg.hasFullPointCadastro, "sem exit: deve ser false")
    seg.exitPoint = TrackPoint(x: 150, y: 150)
    try assertTrue(seg.hasFullPointCadastro, "4 pontos + ehTrecho: deve ser true")
    // Reta nunca tem cadastro pleno mesmo com 4 pontos
    seg.ehTrecho = false
    try assertTrue(!seg.hasFullPointCadastro, "reta nunca: deve ser false")
}

step("TRK-05c: TrackSegment.setting — atualiza ponto canônico imutavelmente") {
    let seg = TrackSegment(
        id: "s1", layoutId: "L", ordem: 0, nome: "Curva 1",
        tipo: .curva, ehTrecho: true, parcialId: "P1",
        x: 100, y: 100
    )
    let p1 = TrackPoint(x: 10, y: 20)
    let s2 = seg.setting(.entryPoint, to: p1)
    try assertEq(s2.entryPoint?.x, 10)
    try assertEq(s2.entryPoint?.y, 20)
    try assertTrue(seg.entryPoint == nil, "original não muta")
    let s3 = s2.setting(.brakingPoint, to: TrackPoint(x: 30, y: 40))
                .setting(.apexReference, to: ApexReference(x: 50, y: 60))
                .setting(.exitPoint, to: TrackPoint(x: 70, y: 80))
    try assertTrue(s3.hasFullPointCadastro, "3 setting + entry: deve ser pleno")
    let s4 = s3.setting(.entryPoint, to: nil)
    try assertTrue(s4.entryPoint == nil, "nil limpa")
    try assertTrue(!s4.hasFullPointCadastro, "limpou entry → modo degradado")
}

step("TRK-05d: TrackSegment — hasFullApexCadastro exige apexRef+strategy+cornerType+ehTrecho") {
    var seg = TrackSegment(
        id: "s1", layoutId: "L", ordem: 0, nome: "Curva 1",
        tipo: .curva, ehTrecho: true, parcialId: "P1",
        x: 100, y: 100
    )
    try assertTrue(!seg.hasFullApexCadastro, "vazio: false")
    seg.apexReference = ApexReference(x: 100, y: 100)
    seg.apexStrategy = .neutro
    try assertTrue(!seg.hasFullApexCadastro, "sem cornerType: false")
    seg.cornerType = .media
    try assertTrue(seg.hasFullApexCadastro, "completo: true")
    seg.ehTrecho = false
    try assertTrue(!seg.hasFullApexCadastro, "reta nunca: false")
}

step("TRK-05e: TrackSegment Codable preserva os 4 pontos canônicos + classification") {
    var seg = TrackSegment(
        id: "s1", layoutId: "L", ordem: 0, nome: "Curva 1",
        tipo: .curva, ehTrecho: true, parcialId: "P1",
        x: 100, y: 100
    )
    seg.entryPoint = TrackPoint(x: 1, y: 2)
    seg.brakingPoint = TrackPoint(x: 3, y: 4)
    seg.apexReference = ApexReference(x: 5, y: 6)
    seg.exitPoint = TrackPoint(x: 7, y: 8)
    seg.apexClassificationDefault = .sacrificadoIntencional
    let data = try JSONEncoder().encode(seg)
    let back = try JSONDecoder().decode(TrackSegment.self, from: data)
    try assertEq(back.entryPoint?.x, 1)
    try assertEq(back.brakingPoint?.x, 3)
    try assertEq(back.apexReference?.x, 5)
    try assertEq(back.exitPoint?.x, 7)
    try assertEq(back.apexClassificationDefault, .sacrificadoIntencional)
}

// ════════════════════════════════════════════════════════════
// ErrorClassifier — EC-01 .. EC-12 (port de error-classifier.js)
// ════════════════════════════════════════════════════════════

step("EC-01: ErroTipo — 16 valores canônicos com raw values exatas do JS") {
    try assertEq(ErroTipo.allCases.count, 16)
    try assertEq(ErroTipo.freouCedo.rawValue,            "freou-cedo")
    try assertEq(ErroTipo.freouTardeDemais.rawValue,     "freou-tarde-demais")
    try assertEq(ErroTipo.entrouForteDemais.rawValue,    "entrou-forte-demais")
    try assertEq(ErroTipo.entrouTimido.rawValue,         "entrou-timido")
    try assertEq(ErroTipo.perdeuRotacao.rawValue,        "perdeu-rotacao")
    try assertEq(ErroTipo.matouSaida.rawValue,           "matou-saida")
    try assertEq(ErroTipo.perdeuTracao.rawValue,         "perdeu-tracao")
    try assertEq(ErroTipo.manteveLinha.rawValue,         "manteve-linha")
    try assertEq(ErroTipo.saiuForte.rawValue,            "saiu-forte")
    try assertEq(ErroTipo.boaFrenagem.rawValue,          "boa-frenagem")
    try assertEq(ErroTipo.tempoMedio.rawValue,           "tempo-medio")
    try assertEq(ErroTipo.apexPerdidoFora.rawValue,      "apex-perdido-fora")
    try assertEq(ErroTipo.apexAntecipado.rawValue,       "apex-antecipado")
    try assertEq(ErroTipo.apexTardio.rawValue,           "apex-tardio")
    try assertEq(ErroTipo.apexInternoDemais.rawValue,    "apex-interno-demais")
    try assertEq(ErroTipo.apexSacrificouSaida.rawValue,  "apex-sacrificou-saida")
}

step("EC-02: humanize — 16 labels PT-BR completos") {
    try assertEq(ErroLabel.humanize(.freouCedo),           "Freou cedo")
    try assertEq(ErroLabel.humanize(.matouSaida),          "Matou a saída")
    try assertEq(ErroLabel.humanize(.tempoMedio),          "Ritmo médio")
    try assertEq(ErroLabel.humanize(.apexSacrificouSaida), "Apex sacrificou saída")
    try assertEq(ErrorClassifier.humanize(.boaFrenagem),   "Boa frenagem")
}

step("EC-03: classify — saiuForte (vSaida muito acima + tempo bom)") {
    let exec = SegmentExecutionInput(tempoMs: 9900, velEntrada: 30, velMinima: 18, velSaida: 32)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .saiuForte)
    try assertTrue(r.confianca >= 0.85)
}

step("EC-04: classify — manteveLinha (todas dentro do significant + tempo bom)") {
    let exec = SegmentExecutionInput(tempoMs: 9950, velEntrada: 30, velMinima: 18, velSaida: 28)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .manteveLinha)
}

step("EC-05: classify — freouTardeDemais (entrada alta + ápice MUITO baixo)") {
    let exec = SegmentExecutionInput(tempoMs: 10500, velEntrada: 32, velMinima: 16, velSaida: 27)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .freouTardeDemais)
}

step("EC-06: classify — entrouForteDemais (vEntrada muito alta + tempo ruim)") {
    let exec = SegmentExecutionInput(tempoMs: 10500, velEntrada: 33, velMinima: 18, velSaida: 27)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .entrouForteDemais)
}

step("EC-07: classify — entrouTimido (entrada baixa + tempo ruim)") {
    let exec = SegmentExecutionInput(tempoMs: 10250, velEntrada: 28, velMinima: 18, velSaida: 28)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .entrouTimido)
}

step("EC-08: classify — matouSaida (saída baixa + tempo ruim)") {
    let exec = SegmentExecutionInput(tempoMs: 10200, velEntrada: 30, velMinima: 18, velSaida: 26)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .matouSaida)
}

step("EC-09: classify — apexPerdidoFora (delta lateral > 2x toleranciaApex)") {
    let exec = SegmentExecutionInput(
        tempoMs: 10100, velEntrada: 30, velMinima: 18, velSaida: 28,
        apexActual: ApexReference(x: 100, y: 100)
    )
    let ref = SegmentReferenceInput(
        tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28,
        apexReference: ApexReference(x: 95, y: 100)  // dist=5 > 1.5*2=3
    )
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .apexPerdidoFora)
}

step("EC-10: classify — apexSacrificouSaida (apex OK + saída ruim + reta longa)") {
    let exec = SegmentExecutionInput(
        tempoMs: 10100, velEntrada: 30, velMinima: 18, velSaida: 26,
        apexActual: ApexReference(x: 100, y: 100)
    )
    let ref = SegmentReferenceInput(
        tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28,
        apexReference: ApexReference(x: 100.5, y: 100), // dist=0.5 OK
        nextStraightLength: 400  // > 200 = reta longa
    )
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    try assertEq(r.principal, .apexSacrificouSaida)
    try assertEq(r.secundaria, .matouSaida)
}

step("EC-11: classify — input vazio retorna nulo + confiança 0") {
    let r = ErrorClassifier.classify(
        execution: SegmentExecutionInput(),
        reference: SegmentReferenceInput()
    )
    try assertTrue(r.principal == nil)
    try assertEq(r.confianca, 0)
}

step("EC-12: classify — evidências têm delta arredondado a 4 casas + pct") {
    let exec = SegmentExecutionInput(tempoMs: 10100, velEntrada: 30, velMinima: 18, velSaida: 28)
    let ref  = SegmentReferenceInput(tempoMs: 10000, velEntradaMedia: 30, velMinimaMedia: 18, velSaidaMedia: 28)
    let r = ErrorClassifier.classify(execution: exec, reference: ref)
    let tempoEv = r.evidencias.first { $0.metric == "tempo" }
    try assertTrue(tempoEv != nil, "evidência tempo deve existir")
    try assertClose(tempoEv?.delta, 0.01, tol: 0.0001)
    try assertClose(tempoEv?.deltaPct, 1.0, tol: 0.1)
    try assertEq(tempoEv?.unit, "ms")
}

// ════════════════════════════════════════════════════════════
// PilotReaction — PR-01 .. PR-12 (port de pilot-reaction.js)
// ════════════════════════════════════════════════════════════

func makeShiftEvent(_ apply: (inout ShiftEvent) -> Void = { _ in }) -> ShiftEvent {
    // Defaults: rpm_at_shift=6800, target_visual_rpm=6500, rate=2000rpm/s → 150ms observed
    var ev = ShiftEvent(
        pilotoId: "p1", carroId: "car-1", sessaoId: "s1",
        trechoId: "t-reta", gearBefore: 3, gearAfter: 4,
        rpmAtShift: 6800, rpmBefore: 6400, rpmRiseRate: 2000,
        targetVisualRpm: 6500, targetOptimalRpm: 6500,
        deltaRpm: 300, gearConfidence: 0.9,
        dataInconsistentFlag: false, status: "red", timestamp: 1000
    )
    apply(&ev)
    return ev
}

step("PR-01: tupleKey — paridade JS (campos ausentes viram 'x')") {
    try assertEq(PilotReaction.tupleKey(pilotoId: "p1", carroId: "c1", gear: 4, trechoId: "t1"),
                 "p1:c1:4:t1")
    try assertEq(PilotReaction.tupleKey(pilotoId: "p1", carroId: "c1", gear: 4, trechoId: nil),
                 "p1:c1:4:x")
    try assertEq(PilotReaction.tupleKey(pilotoId: nil, carroId: nil, gear: nil, trechoId: nil),
                 "x:x:x:x")
}

step("PR-02: learnFromEvent ignora gear_confidence < 0.8") {
    let ev = makeShiftEvent { $0.gearConfidence = 0.7 }
    let next = PilotReaction.learnFromEvent(ev, profiles: [:])
    try assertEq(next.count, 0)
}

step("PR-03: learnFromEvent ignora data_inconsistent_flag=true") {
    let ev = makeShiftEvent { $0.dataInconsistentFlag = true }
    let next = PilotReaction.learnFromEvent(ev, profiles: [:])
    try assertEq(next.count, 0)
}

step("PR-04: learnFromEvent ignora eventos early (delta_rpm < 0)") {
    let ev = makeShiftEvent { $0.deltaRpm = -200 }
    let next = PilotReaction.learnFromEvent(ev, profiles: [:])
    try assertEq(next.count, 0)
}

step("PR-05: learnFromEvent — primeira amostra inicializa rt com observed") {
    let ev = makeShiftEvent()
    let next = PilotReaction.learnFromEvent(ev, profiles: [:])
    let key = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t-reta")
    try assertTrue(next[key] != nil, "profile criado")
    try assertEq(next[key]?.sampleCount, 1)
    try assertClose(next[key]?.reactionTimeMs, 150, tol: 0.001)
}

step("PR-06: learnFromEvent — 10 amostras convergem pra rt observado (alpha=0.15)") {
    var profiles: ReactionProfiles = [:]
    for i in 0..<10 {
        let ev = makeShiftEvent { $0.timestamp = 1000 + Double(i) * 100 }
        profiles = PilotReaction.learnFromEvent(ev, profiles: profiles)
    }
    let key = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t-reta")
    try assertEq(profiles[key]?.sampleCount, 10)
    try assertTrue(abs((profiles[key]?.reactionTimeMs ?? 0) - 150) < 5,
                   "rt deveria convergir pra 150")
}

step("PR-07: learnFromEvent — alpha suave (mudança bounded entre eventos)") {
    var profiles: ReactionProfiles = [:]
    profiles = PilotReaction.learnFromEvent(makeShiftEvent(), profiles: profiles) // 150
    let ev2 = makeShiftEvent { $0.rpmRiseRate = 1000 } // observed = 300/1000*1000 = 300
    profiles = PilotReaction.learnFromEvent(ev2, profiles: profiles)
    let key = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t-reta")
    let rt = profiles[key]!.reactionTimeMs
    // EWMA: 150 * 0.85 + 300 * 0.15 = 127.5 + 45 = 172.5
    try assertClose(rt, 172.5, tol: 0.5)
}

step("PR-08: learnFromEvent — clamp em RT_MAX_MS (400ms)") {
    // observed = (300) * 1000 / 500 = 600ms → clampeia em 400.
    let ev = makeShiftEvent { $0.rpmRiseRate = 500 }
    let next = PilotReaction.learnFromEvent(ev, profiles: [:])
    let key = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t-reta")
    try assertClose(next[key]?.reactionTimeMs, 400, tol: 0.001)
}

step("PR-09: computeCompensation — modo learning sempre 0") {
    let r = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: [:], mode: .learning
    )
    try assertEq(r.rtMs, 0)
    try assertEq(r.compensationRpm, 0)
    try assertEq(r.source, .learningMode)
}

step("PR-10: computeCompensation — rpmRiseRate inválido → invalid_rate") {
    let r1 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: nil, profiles: [:]
    )
    try assertEq(r1.source, .invalidRate)
    let r2 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 0, profiles: [:]
    )
    try assertEq(r2.source, .invalidRate)
}

step("PR-11: computeCompensation — sem aprendizado retorna default 250ms") {
    let r = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: [:]
    )
    try assertEq(r.rtMs, 250)
    try assertClose(r.compensationRpm, 1250, tol: 0.001) // 250 * 5000 / 1000
    try assertEq(r.source, .default)
}

step("PR-12: computeCompensation — fallback exact → piloto-carro-gear → piloto-carro") {
    var profiles: ReactionProfiles = [:]
    let keyExact = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1")
    let keyPCG   = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: nil)
    let keyPC    = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: nil, trechoId: nil)
    profiles[keyPC] = ReactionProfile(key: keyPC, reactionTimeMs: 200, sampleCount: 15, lastUpdated: 0)
    let r1 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: profiles
    )
    try assertEq(r1.source, .pilotoCarro)
    try assertEq(r1.rtMs, 200)
    profiles[keyPCG] = ReactionProfile(key: keyPCG, reactionTimeMs: 180, sampleCount: 12, lastUpdated: 0)
    let r2 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: profiles
    )
    try assertEq(r2.source, .pilotoCarroGear)
    try assertEq(r2.rtMs, 180)
    profiles[keyExact] = ReactionProfile(key: keyExact, reactionTimeMs: 160, sampleCount: 11, lastUpdated: 0)
    let r3 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: profiles
    )
    try assertEq(r3.source, .exact)
    try assertEq(r3.rtMs, 160)
    // Profile com sample_count < MIN não conta
    var p2: ReactionProfiles = [:]
    p2[keyExact] = ReactionProfile(key: keyExact, reactionTimeMs: 160, sampleCount: 5, lastUpdated: 0)
    let r4 = PilotReaction.computeCompensation(
        pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1",
        rpmRiseRate: 5000, profiles: p2
    )
    try assertEq(r4.source, .default)
}

// ════════════════════════════════════════════════════════════
// ShiftAnalysis — SA-01 .. SA-08 (port de shift-analysis.js)
// ════════════════════════════════════════════════════════════

step("SA-01: ShiftClassification — 4 valores canônicos com raw values JS") {
    try assertEq(ShiftClassification.allCases.count, 4)
    try assertEq(ShiftClassification.correct.rawValue,          "correct")
    try assertEq(ShiftClassification.early.rawValue,            "early")
    try assertEq(ShiftClassification.late.rawValue,             "late")
    try assertEq(ShiftClassification.insufficientData.rawValue, "insufficient_data")
}

step("SA-02: classifyEvent — insufficient_data se confidence < 0.7") {
    let ev = makeShiftEvent { $0.gearConfidence = 0.5 }
    try assertEq(ShiftAnalysis.classifyEvent(ev), .insufficientData)
}

step("SA-03: classifyEvent — insufficient_data se data_inconsistent_flag=true") {
    let ev = makeShiftEvent { $0.dataInconsistentFlag = true }
    try assertEq(ShiftAnalysis.classifyEvent(ev), .insufficientData)
}

step("SA-04: classifyEvent — correct quando |delta_rpm| <= tolerance") {
    let ev = makeShiftEvent { $0.deltaRpm = 100; $0.targetOptimalRpm = 6500 } // |100| <= 150 default
    try assertEq(ShiftAnalysis.classifyEvent(ev), .correct)
}

step("SA-05: classifyEvent — early quando delta_rpm < -tolerance") {
    let ev = makeShiftEvent { $0.deltaRpm = -300; $0.targetOptimalRpm = 6500 }
    try assertEq(ShiftAnalysis.classifyEvent(ev), .early)
}

step("SA-06: classifyEvent — late quando delta_rpm > tolerance") {
    let ev = makeShiftEvent { $0.deltaRpm = 300; $0.targetOptimalRpm = 6500 }
    try assertEq(ShiftAnalysis.classifyEvent(ev), .late)
}

step("SA-07: classifyEvent — usa car.toleranceRpm quando provido") {
    let ev = makeShiftEvent { $0.deltaRpm = 200; $0.targetOptimalRpm = 6500 }
    let car = ShiftCarContext(toleranceRpm: 250) // |200| <= 250
    try assertEq(ShiftAnalysis.classifyEvent(ev, car: car), .correct)
}

step("SA-08: buildLessonText — substitui <TRECHO> ou remove fragmento sem trecho") {
    let comTrecho = ShiftAnalysis.buildLessonText(classification: .early, trechoName: "Curva da Junção")
    try assertTrue(comTrecho.contains("Curva da Junção"))
    try assertTrue(!comTrecho.contains("<TRECHO>"))
    let semTrecho = ShiftAnalysis.buildLessonText(classification: .early, trechoName: nil)
    try assertTrue(!semTrecho.contains("<TRECHO>"))
    try assertTrue(!semTrecho.contains(" em ."))
    // Frase correct não tem placeholder
    let correta = ShiftAnalysis.buildLessonText(classification: .correct, trechoName: nil)
    try assertEq(correta, "Boa troca. Motor permaneceu na faixa útil e a retomada foi consistente.")
    // analyzeEvent (top-level)
    let evLate = makeShiftEvent { $0.deltaRpm = 400; $0.targetOptimalRpm = 6500 }
    let res = ShiftAnalysis.analyzeEvent(evLate, trechoNameLookup: { id in id == "t-reta" ? "Reta Principal" : nil })
    try assertEq(res.classification, .late)
    try assertTrue(res.lessonText.contains("Reta Principal"))
}

// ════════════════════════════════════════════════════════════
// ShiftTarget — ST-01..ST-10 (port shift-target+safe-mode+dyno-target+cars)
// ════════════════════════════════════════════════════════════

step("ST-01: safeTarget — redline - safety_margin (default 300)") {
    let car = ShiftCar(redlineRpm: 7000)
    try assertEq(try ShiftSafeMode.safeTarget(car), 6700)
    let car2 = ShiftCar(redlineRpm: 7000, safetyMarginRpm: 500)
    try assertEq(try ShiftSafeMode.safeTarget(car2), 6500)
}

step("ST-02: safeTarget — lança em redline inválido") {
    do {
        _ = try ShiftSafeMode.safeTarget(ShiftCar(redlineRpm: 0))
        try assertTrue(false, "deveria lançar")
    } catch ShiftTargetError.invalidRedline {
        // ok
    }
}

step("ST-03: dynoTarget — fallback 90% redline sem gear_ratios") {
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 30),
        DynoPoint(rpm: 4000, powerKw: 60),
        DynoPoint(rpm: 6000, powerKw: 80),
        DynoPoint(rpm: 7000, powerKw: 70)
    ]
    let r = try DynoTargetCalculator.computeOptimalRpmPerGear(
        curve: curve, gearRatios: nil, redlineRpm: 7000
    )
    // Fallback: 5 marchas, 90% de 7000 = 6300
    try assertEq(r.count, 5)
    try assertEq(r[1]?.optimalRpm, 6300)
    try assertEq(r[1]?.source, .fallback)
}

step("ST-04: dynoTarget — usa gear_ratios + cruzamento de potência") {
    // Curva sintética com pico em 6000.
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 30),
        DynoPoint(rpm: 3000, powerKw: 50),
        DynoPoint(rpm: 4000, powerKw: 70),
        DynoPoint(rpm: 5000, powerKw: 78),
        DynoPoint(rpm: 6000, powerKw: 80),
        DynoPoint(rpm: 6500, powerKw: 78),
        DynoPoint(rpm: 7000, powerKw: 70)
    ]
    // 5 marchas, queda média ~70% por troca
    let ratios: [Double] = [3.5, 2.5, 1.8, 1.3, 1.0]
    let r = try DynoTargetCalculator.computeOptimalRpmPerGear(
        curve: curve, gearRatios: ratios, redlineRpm: 7000
    )
    try assertEq(r.count, 5)
    // Última marcha: alvo no pico
    try assertEq(r[5]?.optimalRpm, 6000)
    try assertEq(r[5]?.source, .dyno)
    // Marcha 1 deve ter alvo dyno calculado
    try assertEq(r[1]?.source, .dyno)
    try assertTrue((r[1]?.optimalRpm ?? 0) > 0)
}

step("ST-05: dynoTarget — lança se curva tem < 3 pontos") {
    do {
        _ = try DynoTargetCalculator.computeOptimalRpmPerGear(
            curve: [DynoPoint(rpm: 1, powerKw: 1), DynoPoint(rpm: 2, powerKw: 2)],
            gearRatios: nil, redlineRpm: 7000
        )
        try assertTrue(false, "deveria lançar")
    } catch ShiftTargetError.curveTooShort {
        // ok
    }
}

step("ST-06: computeShiftTarget — gear_confidence < 0.7 → safe") {
    let car = ShiftCar(redlineRpm: 7000)
    let r = try ShiftTarget.computeShiftTarget(car: car, gear: 4, gearConfidence: 0.5)
    try assertEq(r.source, .safe)
    try assertEq(r.optimalRpm, 6700) // redline - 300 default
    try assertEq(r.visualRpm, 6700)  // sem reactionCtx
    try assertTrue(r.reason?.contains("below floor") == true)
}

step("ST-07: computeShiftTarget — sem dyno e sem learned → safe") {
    let car = ShiftCar(redlineRpm: 7000)
    let r = try ShiftTarget.computeShiftTarget(car: car, gear: 4, gearConfidence: 0.9)
    try assertEq(r.source, .safe)
    try assertEq(r.optimalRpm, 6700)
}

step("ST-08: computeShiftTarget — learned do car prevalece quando sem dyno") {
    let car = ShiftCar(
        redlineRpm: 7000,
        learnedTargets: [4: LearnedTarget(optimalRpm: 6400, sampleCount: 12)]
    )
    let r = try ShiftTarget.computeShiftTarget(car: car, gear: 4, gearConfidence: 0.9)
    try assertEq(r.source, .learned)
    try assertEq(r.optimalRpm, 6400)
}

step("ST-09: computeShiftTarget — dyno presente mas sem alvo p/ gear → safe com motivo") {
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 30),
        DynoPoint(rpm: 4000, powerKw: 60),
        DynoPoint(rpm: 6000, powerKw: 80)
    ]
    // gear_ratios só pra 3 marchas → pedir gear=10 retorna safe
    let car = ShiftCar(redlineRpm: 7000, dynoCurve: curve, gearRatios: [3.5, 2.5, 1.8])
    let r = try ShiftTarget.computeShiftTarget(car: car, gear: 10, gearConfidence: 0.9)
    try assertEq(r.source, .safe)
    try assertTrue(r.reason?.contains("gear=10") == true)
}

step("ST-10: computeShiftTarget — reactionCtx subtrai compensation no visualRpm") {
    var profiles: ReactionProfiles = [:]
    let key = PilotReaction.tupleKey(pilotoId: "p1", carroId: "car-1", gear: 4, trechoId: "t1")
    profiles[key] = ReactionProfile(key: key, reactionTimeMs: 200, sampleCount: 12, lastUpdated: 0)
    let car = ShiftCar(
        id: "car-1", redlineRpm: 7000,
        learnedTargets: [4: LearnedTarget(optimalRpm: 6400, sampleCount: 15)]
    )
    let ctx = ShiftReactionContext(
        pilotoId: "p1", carroId: "car-1", trechoId: "t1",
        rpmRiseRate: 5000, profiles: profiles
    )
    let r = try ShiftTarget.computeShiftTarget(
        car: car, gear: 4, gearConfidence: 0.9,
        reactionCtx: ctx
    )
    try assertEq(r.optimalRpm, 6400)
    // compensation = 200 * 5000 / 1000 = 1000 → visual = 6400 - 1000 = 5400
    try assertEq(r.visualRpm, 5400)
    try assertEq(r.reactionSource, .exact)
    // Modo learning → visualRpm == optimalRpm
    let r2 = try ShiftTarget.computeShiftTarget(
        car: car, gear: 4, gearConfidence: 0.9, mode: .learning, reactionCtx: ctx
    )
    try assertEq(r2.visualRpm, 6400)
    try assertEq(r2.reactionSource, .learningMode)
}

// ════════════════════════════════════════════════════════════
// GearEstimation — GE-01..GE-08 (port gear-estimation.js)
// ════════════════════════════════════════════════════════════

let geCalibration: [Int: GearSignature] = [
    1: GearSignature(rpmSpeedRatio: 250),
    2: GearSignature(rpmSpeedRatio: 150),
    3: GearSignature(rpmSpeedRatio: 100),
]

step("GE-01: estimateGear — sem calibração retorna fallback") {
    let r = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 5000, speed: 50),
        signatures: [:]
    )
    try assertEq(r.gear, nil)
    try assertEq(r.confidence, 0)
    try assertEq(r.method, .fallback)
    try assertEq(r.reason, "no calibration")
}

step("GE-02: estimateGear — speed abaixo do threshold retorna fallback") {
    let r = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 5000, speed: 3),
        signatures: geCalibration
    )
    try assertEq(r.method, .fallback)
    try assertEq(r.reason, "speed below threshold")
}

step("GE-03: estimateGear — ratio bate 1ª marcha (250)") {
    // rpm=2500, speed=10 → ratio=250
    let r = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 2500, speed: 10),
        signatures: geCalibration
    )
    try assertEq(r.gear, 1)
    try assertEq(r.method, .rpmSpeed)
    try assertTrue(r.confidence > 0.9, "alta confiança esperada, foi \(r.confidence)")
}

step("GE-04: estimateGear — ratio bate 3ª marcha (100)") {
    // rpm=6000, speed=60 → ratio=100
    let r = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 6000, speed: 60),
        signatures: geCalibration
    )
    try assertEq(r.gear, 3)
    try assertTrue(r.confidence > 0.9)
}

step("GE-05: estimateGear — ratio entre marchas penaliza confiança (margem pequena)") {
    // ratio=125 fica entre 150 (g2) e 100 (g3) — escolhe g3 (mais perto), margem pequena
    let r = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 6250, speed: 50),
        signatures: geCalibration
    )
    try assertTrue(r.gear == 3 || r.gear == 2)
    try assertTrue(r.confidence < 0.9, "margem pequena penaliza, foi \(r.confidence)")
}

step("GE-06: estimateGear — tps=0 + decelerando reduz confiança 50%") {
    let semAccel = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 6000, speed: 60),
        signatures: geCalibration
    )
    let comClutch = GearEstimation.estimateGear(
        sample: GearSampleInput(rpm: 6000, speed: 60, tps: 0, accelLong: -2.0),
        signatures: geCalibration
    )
    try assertTrue(comClutch.confidence < semAccel.confidence,
                   "clutch deveria reduzir conf (\(semAccel.confidence) → \(comClutch.confidence))")
    try assertEq(comClutch.reason, "tps=0 + decelerating: possible clutch/neutral")
}

step("GE-07: estimateGear — usa histórico (window 200ms) para média de ratios") {
    let history: [GearSampleInput] = [
        GearSampleInput(rpm: 6000, speed: 60, timestamp: 800),
        GearSampleInput(rpm: 6000, speed: 60, timestamp: 900),
    ]
    let sample = GearSampleInput(rpm: 6000, speed: 60, timestamp: 1000)
    let r = GearEstimation.estimateGear(
        sample: sample, history: history, signatures: geCalibration
    )
    try assertEq(r.gear, 3)
    try assertEq(r.method, .rpmSpeedHistory)
}

step("GE-08: learnSignature — < 5 amostras retorna nil; ≥ 5 calcula média + std") {
    let curtas: [GearSampleInput] = [
        GearSampleInput(rpm: 5000, speed: 50),
        GearSampleInput(rpm: 5100, speed: 51),
    ]
    let r1 = GearEstimation.learnSignature(curtas)
    try assertEq(r1.signature, nil)
    try assertEq(r1.reason, "insufficient samples")

    // 6 amostras com ratio ~100 (3ª marcha)
    let amostras: [GearSampleInput] = (0..<6).map { i in
        GearSampleInput(rpm: Double(5000 + i * 100), speed: Double(50 + i))
    }
    let r2 = GearEstimation.learnSignature(amostras)
    try assertTrue(r2.signature != nil)
    try assertClose(r2.signature?.rpmSpeedRatio, 100, tol: 0.5)
    try assertEq(r2.sampleCount, 6)
}

// ════════════════════════════════════════════════════════════
// ShiftEventDetector + Bridge — SED-01..SED-06
// ════════════════════════════════════════════════════════════

func sedMakeCar() -> ShiftCar {
    ShiftCar(
        id: "celta",
        redlineRpm: 7000,
        toleranceRpm: 150,
        gearSignatures: ["3": GearSignature(rpmSpeedRatio: 80),
                         "4": GearSignature(rpmSpeedRatio: 60)]
    )
}

step("SED-01: detector inicia em estado idle e ignora samples inválidos") {
    let det = ShiftEventDetector(sessaoId: "s1", car: sedMakeCar())
    try assertEq(det.debugState, "idle")
    det.pushSample(ShiftDetectorSample(rpm: .nan, speed: 80, timestamp: 1000))
    try assertEq(det.debugState, "idle")
    try assertEq(det.emitted.count, 0)
}

step("SED-02: detecta upshift (queda > 800rpm com speed estável)") {
    var captured: ShiftEventEmitted? = nil
    let det = ShiftEventDetector(
        sessaoId: "s1", car: sedMakeCar(),
        onEvent: { captured = $0 }
    )
    // 50ms before com rpm=6800
    det.pushSample(ShiftDetectorSample(rpm: 6800, speed: 80, tps: 80, timestamp: 950))
    // queda 800: 6800 → 6000 com speed 80 estável → entra em pending
    det.pushSample(ShiftDetectorSample(rpm: 6000, speed: 80, tps: 80, timestamp: 1000))
    try assertEq(det.debugState, "pending")
    // Após windowAfter (200ms) emite
    det.pushSample(ShiftDetectorSample(rpm: 5800, speed: 80, tps: 80, timestamp: 1100))
    det.pushSample(ShiftDetectorSample(rpm: 5700, speed: 80, tps: 80, timestamp: 1200))
    try assertTrue(captured != nil, "evento deveria ter sido emitido")
    try assertEq(captured?.rpmAtShift, 6800)   // antes da queda (upshift)
    // Sem dyno/learned, ShiftTarget retorna safe (redline-300=6700).
    // delta=6800-6700=100 ≤ tolerance(150) → "green".
    try assertEq(captured?.status, "green")
}

step("SED-03: cooldown bloqueia 2ª detecção em < 400ms") {
    var count = 0
    let det = ShiftEventDetector(sessaoId: "s1", car: sedMakeCar(), onEvent: { _ in count += 1 })
    det.pushSample(ShiftDetectorSample(rpm: 6800, speed: 80, tps: 80, timestamp: 950))
    det.pushSample(ShiftDetectorSample(rpm: 6000, speed: 80, tps: 80, timestamp: 1000))
    det.pushSample(ShiftDetectorSample(rpm: 5800, speed: 80, tps: 80, timestamp: 1200))
    try assertEq(count, 1)
    // Tentar segunda queda imediatamente — em cooldown
    det.pushSample(ShiftDetectorSample(rpm: 6800, speed: 80, tps: 80, timestamp: 1300))
    det.pushSample(ShiftDetectorSample(rpm: 5900, speed: 80, tps: 80, timestamp: 1340))
    try assertEq(count, 1, "cooldown ativo, não deve emitir 2º")
}

step("SED-04: speed variando > 5% durante o shift cancela") {
    var count = 0
    let det = ShiftEventDetector(sessaoId: "s1", car: sedMakeCar(), onEvent: { _ in count += 1 })
    det.pushSample(ShiftDetectorSample(rpm: 6800, speed: 80, tps: 80, timestamp: 950))
    // queda rpm + speed varia 10% → não entra em pending
    det.pushSample(ShiftDetectorSample(rpm: 6000, speed: 90, tps: 80, timestamp: 1000))
    try assertEq(det.debugState, "idle")
    try assertEq(count, 0)
}

step("SED-05: tps < 10 durante shift descarta evento (clutch/neutral)") {
    var count = 0
    let det = ShiftEventDetector(sessaoId: "s1", car: sedMakeCar(), onEvent: { _ in count += 1 })
    det.pushSample(ShiftDetectorSample(rpm: 6800, speed: 80, tps: 5, timestamp: 950))
    det.pushSample(ShiftDetectorSample(rpm: 6000, speed: 80, tps: 5, timestamp: 1000))
    det.pushSample(ShiftDetectorSample(rpm: 5800, speed: 80, tps: 5, timestamp: 1200))
    try assertEq(count, 0)
}

step("SED-06: ShiftLightBridge descarta sample sem RPM (Tier 0 dormente)") {
    let det = ShiftEventDetector(sessaoId: "s1", car: sedMakeCar())
    var rpmFonte: Double? = nil
    let bridge = ShiftLightBridge(
        detector: det,
        getRpm: { _ in rpmFonte },
        getTps: { _ in 80 }
    )
    // Sample sem RPM: nada acontece (mas bridge avança lastTs)
    bridge.onTelemetrySample(ShiftBridgeSample(t: 800, kmh: 80))
    try assertEq(det.debugState, "idle")
    try assertEq(det.emitted.count, 0)
    // Liga RPM (Tier 1) com timestamps crescentes
    rpmFonte = 6800
    bridge.onTelemetrySample(ShiftBridgeSample(t: 950, tMono: 950, kmh: 80))
    rpmFonte = 6000
    bridge.onTelemetrySample(ShiftBridgeSample(t: 1000, tMono: 1000, kmh: 80))
    rpmFonte = 5800
    bridge.onTelemetrySample(ShiftBridgeSample(t: 1200, tMono: 1200, kmh: 80))
    try assertTrue(det.emitted.count >= 1, "com RPM real, detector deve emitir")
}

// ════════════════════════════════════════════════════════════
// RpmSource — RS-01..RS-06
// ════════════════════════════════════════════════════════════

step("RS-01: ManualRpmSource — getRpm retorna nil antes de start") {
    let src = ManualRpmSource()
    src.setRpm(6500)
    try assertTrue(src.getRpm() == nil)
    try assertEq(src.getStatus(), .lost)
}

step("RS-02: ManualRpmSource — após start retorna RPM/TPS frescos") {
    var clock: Double = 1000
    let src = ManualRpmSource(now: { clock })
    src.start()
    src.setRpm(6500)
    src.setTps(80)
    try assertEq(src.getRpm(), 6500)
    try assertEq(src.getTps(), 80)
    try assertEq(src.getStatus(), .connected)
}

step("RS-03: ManualRpmSource — freshness expira após 500ms (degraded → lost)") {
    var clock: Double = 0
    let src = ManualRpmSource(freshnessMs: 500, now: { clock })
    src.start()
    clock = 1000
    src.setRpm(6500)
    try assertEq(src.getStatus(), .connected)
    clock = 1600 // age = 600ms > 500
    try assertEq(src.getStatus(), .degraded)
    try assertTrue(src.getRpm() == nil, "RPM expirado deve retornar nil")
    clock = 2200 // age = 1200ms > 1000 (2x)
    try assertEq(src.getStatus(), .lost)
}

step("RS-04: ManualRpmSource — stop limpa RPM/TPS") {
    var clock: Double = 1000
    let src = ManualRpmSource(now: { clock })
    src.start()
    src.setRpm(6500)
    src.setTps(80)
    src.stop()
    try assertTrue(src.getRpm() == nil)
    try assertTrue(src.getTps() == nil)
    try assertEq(src.getStatus(), .lost)
}

step("RS-05: ManualRpmSource — RPM negativo é rejeitado (vira nil)") {
    let src = ManualRpmSource()
    src.start()
    src.setRpm(-100)
    try assertTrue(src.getRpm() == nil)
}

step("RS-06: MockRpmSource — script é avaliado a cada tick") {
    let src = MockRpmSource { t in
        if t < 1000 { return (rpm: 5000, tps: 50) }
        else        { return (rpm: 6500, tps: 80) }
    }
    src.start()
    src.tick(500)
    try assertEq(src.getRpm(), 5000)
    try assertEq(src.getTps(), 50)
    src.tick(2000)
    try assertEq(src.getRpm(), 6500)
    try assertEq(src.getTps(), 80)
    try assertEq(src.getStatus(), .connected)
    src.stop()
    try assertTrue(src.getRpm() == nil)
    try assertEq(src.getStatus(), .lost)
}

// ════════════════════════════════════════════════════════════
// Score + Benchmark — SC-01..SC-10
// ════════════════════════════════════════════════════════════

step("SC-01: Scores.lap — empate retorna 100; 5% mais lento retorna ~95") {
    try assertEq(Scores.lap(tempoAtualMs: 100000, melhorTempoMs: 100000), 100)
    let s = Scores.lap(tempoAtualMs: 105000, melhorTempoMs: 100000)!
    try assertClose(s, 95.2, tol: 0.5)
}

step("SC-02: Scores.lap — input inválido retorna nil") {
    try assertTrue(Scores.lap(tempoAtualMs: nil, melhorTempoMs: 100000) == nil)
    try assertTrue(Scores.lap(tempoAtualMs: 100000, melhorTempoMs: 0) == nil)
    try assertTrue(Scores.lap(tempoAtualMs: -1, melhorTempoMs: 100000) == nil)
}

step("SC-03: Scores.categoria — 4 faixas + indefinido") {
    try assertEq(Scores.categoria(99), .excelente)
    try assertEq(Scores.categoria(96), .bom)
    try assertEq(Scores.categoria(92), .medio)
    try assertEq(Scores.categoria(80), .ruim)
    try assertEq(Scores.categoria(nil), .indefinido)
}

step("SC-04: Benchmark.compute — escolhe melhor volta + ideal teórica") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000, numero: 1,
                          temposPorParcial: ["P1": 50_000, "P2": 50_000]),
        BenchmarkLapInput(id: "L2", tempoMs: 99_500, numero: 2,
                          temposPorParcial: ["P1": 49_500, "P2": 50_000]),
        BenchmarkLapInput(id: "L3", tempoMs: 99_800, numero: 3,
                          temposPorParcial: ["P1": 50_000, "P2": 49_800]),
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let r = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    try assertEq(r.melhorVolta?.id, "L2")
    try assertEq(r.melhorVolta?.tempoMs, 99_500)
    try assertEq(r.voltasConsideradas, 3)
    try assertEq(r.melhorPorParcial["P1"]??.lapId, "L2")
    try assertEq(r.melhorPorParcial["P2"]??.lapId, "L3")
    // Ideal teórica = 49500 + 49800 = 99300
    try assertEq(r.idealTeoricaMs, 99_300)
    // Ganho = melhorVolta(99500) - ideal(99300) = 200ms
    try assertEq(r.ganhoTeoricoMs, 200)
}

step("SC-05: Benchmark.compute — laps vazias retorna nil") {
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let r = Benchmark.compute(scope: scope, parciais: [], laps: [])
    try assertTrue(r == nil)
}

step("SC-06: Benchmark.compute — parcial faltando em todas voltas → ideal teórica nil") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    // P2 ausente em todas as voltas
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000, temposPorParcial: ["P1": 50_000]),
        BenchmarkLapInput(id: "L2", tempoMs: 99_500, temposPorParcial: ["P1": 49_500]),
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let r = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    try assertTrue(r.idealTeoricaMs == nil)
    try assertTrue(r.ganhoTeoricoMs == nil)
    try assertTrue(r.melhorPorParcial["P2"]! == nil)
}

step("SC-07: Scores.fromLap — score por parcial + volta") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000, temposPorParcial: ["P1": 50_000, "P2": 50_000]),
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    let lap = ScoreLapInput(id: "Latual", tempoMs: 102_000,
                            temposPorParcial: ["P1": 51_000, "P2": 51_000])
    let r = Scores.fromLap(lap, benchmark: bench)
    try assertClose(r.volta, 98.0, tol: 0.5) // 100000/102000 ≈ 98.04
    try assertClose(r.porParcial["P1"] ?? nil, 98.0, tol: 0.5)
}

step("SC-08: Scores.compensado — distribui peso igual quando sem weights") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000, temposPorParcial: ["P1": 50_000, "P2": 50_000]),
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    // Volta atual: P1=51000 (98.04), P2=49500 (101->100 clampeado)
    let lap = ScoreLapInput(id: "Latual", tempoMs: 100_500,
                            temposPorParcial: ["P1": 51_000, "P2": 49_500])
    let r = Scores.compensado(lap: lap, benchmark: bench)!
    try assertEq(r.parciaisConsideradas, 2)
    try assertEq(r.totalParciais, 2)
    try assertTrue(!r.parcial)
    try assertEq(r.fatorContexto, 1.0)
    try assertTrue(r.score >= 95 && r.score <= 100)
}

step("SC-09: Scores.compensado — parcial=true quando faltam parciais") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000, temposPorParcial: ["P1": 50_000, "P2": 50_000]),
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    // Volta atual com só P1
    let lap = ScoreLapInput(id: "Latual", tempoMs: 100_500,
                            temposPorParcial: ["P1": 50_500])
    let r = Scores.compensado(lap: lap, benchmark: bench)!
    try assertTrue(r.parcial)
    try assertEq(r.parciaisConsideradas, 1)
    try assertEq(r.totalParciais, 2)
    try assertTrue(r.explicacao?.contains("dados parciais") == true)
}

step("SC-10: Scores.compensado — fatorContexto > 1 com diferenças de ar/umidade") {
    let parciais = [Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 100)]
    let laps = [BenchmarkLapInput(id: "L1", tempoMs: 100_000,
                                   temposPorParcial: ["P1": 100_000])]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
    let lap = ScoreLapInput(id: "Latual", tempoMs: 102_000,
                            temposPorParcial: ["P1": 102_000])
    let lapCtx = ScoreContexto(temperaturaAr: 35, umidade: 60)
    let refCtx = ScoreContexto(temperaturaAr: 20, umidade: 30)
    let r = Scores.compensado(lap: lap, benchmark: bench, contextoLap: lapCtx, contextoRef: refCtx)!
    // dT=15>10 → 1.02; dU=30>20 → 1.01 → fator = 1.02 * 1.01 ≈ 1.0302
    try assertClose(r.fatorContexto, 1.0302, tol: 0.001)
}

// ════════════════════════════════════════════════════════════
// Repeatability — REP-01..REP-04
// ════════════════════════════════════════════════════════════

step("REP-01: fromSeries — < 2 valores válidos retorna nil") {
    try assertTrue(Repeatability.fromSeries([]) == nil)
    try assertTrue(Repeatability.fromSeries([100]) == nil)
    try assertTrue(Repeatability.fromSeries([nil, nil]) == nil)
}

step("REP-02: fromSeries — série constante tem CV=0 e index=1") {
    let r = Repeatability.fromSeries([100_000, 100_000, 100_000, 100_000])!
    try assertEq(r.cv, 0)
    try assertEq(r.index, 1.0)
    try assertEq(r.n, 4)
}

step("REP-03: categoria — 3 faixas + indefinido") {
    try assertEq(Repeatability.categoria(0.9), .alta)
    try assertEq(Repeatability.categoria(0.7), .media)
    try assertEq(Repeatability.categoria(0.5), .baixa)
    try assertEq(Repeatability.categoria(nil), .indefinido)
}

step("REP-04: fromLaps + summary — overall é média dos disponíveis") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps: [Repeatability.LapInput] = [
        .init(valida: true, tempoMs: 100_000, temposPorParcial: ["P1": 50_000, "P2": 50_000]),
        .init(valida: true, tempoMs: 100_100, temposPorParcial: ["P1": 50_050, "P2": 50_050]),
        .init(valida: true, tempoMs: 100_200, temposPorParcial: ["P1": 50_100, "P2": 50_100]),
    ]
    let s = Repeatability.summary(laps: laps, parciais: parciais)
    try assertTrue(s.volta != nil)
    try assertTrue(s.overall != nil)
    // Voltas e parciais quase constantes → overall próximo de 1
    try assertTrue((s.overall ?? 0) > 0.95)
}

// ════════════════════════════════════════════════════════════
// PedagogicalDecider — PD-01..PD-06
// ════════════════════════════════════════════════════════════

step("PD-01: decide — score nil ou repet nil retorna indefinido") {
    let r1 = PedagogicalDecider.decide(score: nil, repetibilidade: 0.9)
    try assertEq(r1.decisao, .indefinido)
    let r2 = PedagogicalDecider.decide(score: 95, repetibilidade: nil)
    try assertEq(r2.decisao, .indefinido)
}

step("PD-02: decide — matriz: scoreAlto+repetAlta = MANTER") {
    let r = PedagogicalDecider.decide(score: 96, repetibilidade: 0.9)
    try assertEq(r.decisao, .manter)
    try assertEq(r.razao, "trecho forte e consistente — proteger")
}

step("PD-03: decide — matriz: scoreBaixo+repetAlta = ATACAR") {
    let r = PedagogicalDecider.decide(score: 88, repetibilidade: 0.9)
    try assertEq(r.decisao, .atacar)
    try assertEq(r.razao, "erro consistente — corrigir agora")
}

step("PD-04: decide — matriz: scoreAlto+repetBaixa = CONSOLIDAR") {
    let r = PedagogicalDecider.decide(score: 96, repetibilidade: 0.5)
    try assertEq(r.decisao, .consolidar)
}

step("PD-05: decide — matriz: scoreBaixo+repetBaixa = IGNORAR") {
    let r = PedagogicalDecider.decide(score: 80, repetibilidade: 0.5)
    try assertEq(r.decisao, .ignorar)
}

step("PD-06: decideForParciais + agrupar — distribui em 4 grupos") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps: [PedagogicalDecider.DecideLapInput] = [
        // Voltas válidas com scores: P1 alto (forte), P2 baixo (fraco)
        .init(valida: true, scoresPorParcial: ["P1": 97, "P2": 88]),
        .init(valida: true, scoresPorParcial: ["P1": 96, "P2": 87]),
    ]
    // P1 com repetibilidade alta → MANTER. P2 com repet alta → ATACAR.
    let repet: [String: Double?] = ["P1": 0.9, "P2": 0.9]
    let res = PedagogicalDecider.decideForParciais(
        parciais: parciais, laps: laps, repetibilidadePorParcial: repet
    )
    try assertEq(res.lista.count, 2)
    try assertEq(res.porParcial["P1"]?.decisao, .manter)
    try assertEq(res.porParcial["P2"]?.decisao, .atacar)
    let g = PedagogicalDecider.agrupar(res)
    try assertEq(g.manter.count, 1)
    try assertEq(g.atacar.count, 1)
    try assertEq(g.consolidar.count, 0)
    try assertEq(g.ignorar.count, 0)
}

// ════════════════════════════════════════════════════════════
// DynoCsvParser — DCP-01..DCP-06
// ════════════════════════════════════════════════════════════

step("DCP-01: parse — CSV vazio lança .empty") {
    do {
        _ = try DynoCsvParser.parse("")
        try assertTrue(false)
    } catch DynoCsvParserError.empty {
        // ok
    }
}

step("DCP-02: parse — CSV genérico vírgula com RPM, Torque (Nm), Power (kW)") {
    let csv = """
    RPM,Torque (Nm),Power (kW)
    2000,80,16.7
    3000,100,31.4
    4000,120,50.3
    5000,130,68.1
    6000,128,80.5
    """
    let r = try DynoCsvParser.parse(csv)
    try assertEq(r.format, .generic)
    try assertEq(r.points.count, 5)
    try assertEq(r.points.first?.rpm, 2000)
    try assertClose(r.points.first?.powerKw, 16.7, tol: 0.5)
}

step("DCP-03: parse — Dynojet com hp converte para kW") {
    let csv = """
    Dynojet Run 1
    RPM,HP,Torque (lb-ft)
    2000,30,80
    3000,55,90
    4000,90,110
    5000,120,118
    """
    let r = try DynoCsvParser.parse(csv)
    try assertEq(r.format, .dynojet)
    try assertEq(r.points.count, 4)
    // 30hp ≈ 22.4 kW
    try assertClose(r.points.first?.powerKw, 22.4, tol: 0.5)
}

step("DCP-04: parse — separador ; e vírgula como decimal (locale BR)") {
    let csv = """
    RPM;Torque (Nm);Power (kW)
    2000;80,5;16,7
    3000;100,2;31,4
    4000;120,9;50,3
    """
    let r = try DynoCsvParser.parse(csv)
    try assertEq(r.points.count, 3)
    try assertClose(r.points.first?.powerKw, 16.7, tol: 0.5)
}

step("DCP-05: parse — < 3 pontos válidos lança .insufficientPoints") {
    let csv = """
    RPM,Power (kW)
    2000,30
    3000,55
    """
    do {
        _ = try DynoCsvParser.parse(csv)
        try assertTrue(false, "deveria lançar")
    } catch DynoCsvParserError.insufficientPoints(let found) {
        try assertEq(found, 2)
    }
}

step("DCP-06: parse — só torque preenche power_kw via P=T*RPM/9549") {
    let csv = """
    RPM,Torque (Nm)
    2000,100
    3000,120
    4000,130
    5000,135
    """
    let r = try DynoCsvParser.parse(csv)
    try assertEq(r.points.count, 4)
    // RPM=4000, T=130 → P = 130 * 4000 / 9549 ≈ 54.5 kW
    let p4000 = r.points.first { $0.rpm == 4000 }
    try assertClose(p4000?.powerKw, 54.5, tol: 0.5)
}

// ════════════════════════════════════════════════════════════
// ErrorTaxonomy — ET-01..ET-05
// ════════════════════════════════════════════════════════════

step("ET-01: ErroTipoExtra — 10 valores canônicos com raw values") {
    try assertEq(ErroTipoExtra.allCases.count, 10)
    try assertEq(ErroTipoExtra.pegouCorda.rawValue,     "pegou-corda")
    try assertEq(ErroTipoExtra.naoPegouCorda.rawValue,  "nao-pegou-corda")
    try assertEq(ErroTipoExtra.usouPistaToda.rawValue,  "usou-pista-toda")
    try assertEq(ErroTipoExtra.freadaInstavel.rawValue, "freada-instavel")
    try assertEq(ErroTipoExtra.entradaSuja.rawValue,    "entrada-suja")
    try assertEq(ErroTipoExtra.saidaRasgada.rawValue,   "saida-rasgada")
    try assertEq(ErroTipoExtra.trailBrakingOk.rawValue, "trail-braking-ok")
    try assertEq(ErroTipoExtra.corrigiuLinha.rawValue,  "corrigiu-linha")
    try assertEq(ErroTipoExtra.abortouCurva.rawValue,   "abortou-curva")
    try assertEq(ErroTipoExtra.exploracaoOk.rawValue,   "exploracao-ok")
}

step("ET-02: categoria — distribui ErroTipo + ErroTipoExtra em 4 grupos canônicos") {
    try assertEq(ErrorTaxonomy.categoria(.freouCedo),         .frenagem)
    try assertEq(ErrorTaxonomy.categoria(.entrouForteDemais), .entrada)
    try assertEq(ErrorTaxonomy.categoria(.manteveLinha),      .linha)
    try assertEq(ErrorTaxonomy.categoria(.matouSaida),        .saida)
    try assertEq(ErrorTaxonomy.categoria(.pegouCorda),        .linha)
    try assertEq(ErrorTaxonomy.categoria(.freadaInstavel),    .frenagem)
    try assertEq(ErrorTaxonomy.categoria(.exploracaoOk),      .geral)
}

step("ET-03: classifyDetails — input vazio retorna lista vazia") {
    let r = ErrorTaxonomy.classifyDetails(ErrorTaxonomy.DetailsInput())
    try assertEq(r.count, 0)
}

step("ET-04: classifyDetails — aderência alta = pegouCorda; baixa = naoPegouCorda") {
    let alta = ErrorTaxonomy.classifyDetails(.init(aderenciaCorda: 0.9))
    try assertTrue(alta.contains(.pegouCorda))
    let baixa = ErrorTaxonomy.classifyDetails(.init(aderenciaCorda: 0.3))
    try assertTrue(baixa.contains(.naoPegouCorda))
    let media = ErrorTaxonomy.classifyDetails(.init(aderenciaCorda: 0.5))
    try assertTrue(!media.contains(.pegouCorda) && !media.contains(.naoPegouCorda))
}

step("ET-05: classifyDetails — múltiplos rótulos coexistem") {
    let r = ErrorTaxonomy.classifyDetails(.init(
        aderenciaCorda: 0.9,
        estabilidadeFrear: 0.3,
        aberturaLinha: 0.9,
        abortou: false,
        corrigiu: true,
        trail: true
    ))
    try assertTrue(r.contains(.pegouCorda))
    try assertTrue(r.contains(.freadaInstavel))
    try assertTrue(r.contains(.usouPistaToda))
    try assertTrue(r.contains(.corrigiuLinha))
    try assertTrue(r.contains(.trailBrakingOk))
    try assertEq(r.count, 5)
}

// ════════════════════════════════════════════════════════════
// ToleranceFromDyno — TFD-01..TFD-04
// ════════════════════════════════════════════════════════════

step("TFD-01: compute — < 3 pontos lança .curveTooShort") {
    do {
        _ = try ToleranceFromDyno.compute(curve: [
            DynoPoint(rpm: 2000, powerKw: 30),
            DynoPoint(rpm: 4000, powerKw: 60)
        ])
        try assertTrue(false)
    } catch ToleranceFromDyno.Error.curveTooShort {
        // ok
    }
}

step("TFD-02: compute — janela útil estreita = clamp em tolMin (80)") {
    // Pico em 5000 só (vizinhos < 95% do pico) → janela < 2 pontos → tolMin
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 30),
        DynoPoint(rpm: 3000, powerKw: 50),
        DynoPoint(rpm: 4000, powerKw: 70),
        DynoPoint(rpm: 5000, powerKw: 100), // pico
        DynoPoint(rpm: 6000, powerKw: 70),
        DynoPoint(rpm: 7000, powerKw: 50)
    ]
    let r = try ToleranceFromDyno.compute(curve: curve)
    try assertEq(r, 80)
}

step("TFD-03: compute — janela útil larga, percent default 5") {
    // Pico ~80kW em 6000. Pontos com >= 95% (76 kW): 5000-7000 (largura 2000)
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 30),
        DynoPoint(rpm: 3000, powerKw: 50),
        DynoPoint(rpm: 4000, powerKw: 70),
        DynoPoint(rpm: 5000, powerKw: 78),
        DynoPoint(rpm: 6000, powerKw: 80),
        DynoPoint(rpm: 7000, powerKw: 76),
        DynoPoint(rpm: 8000, powerKw: 60)
    ]
    let r = try ToleranceFromDyno.compute(curve: curve, percent: 5)
    // window = 7000 - 5000 = 2000; tol = 2000 * 5 / 100 = 100
    try assertEq(r, 100)
}

step("TFD-04: compute — janela enorme clampa em tolMax (250)") {
    // Curva chata onde quase todo ponto está em ≥ 95% do pico → janela enorme
    let curve = [
        DynoPoint(rpm: 2000, powerKw: 95),
        DynoPoint(rpm: 4000, powerKw: 99),
        DynoPoint(rpm: 6000, powerKw: 100),
        DynoPoint(rpm: 8000, powerKw: 99),
        DynoPoint(rpm: 10000, powerKw: 96)
    ]
    // window = 10000 - 2000 = 8000; tol = 8000 * 5 / 100 = 400 → clamp 250
    let r = try ToleranceFromDyno.compute(curve: curve, percent: 5)
    try assertEq(r, 250)
}

// ════════════════════════════════════════════════════════════
// PlannedVsExecuted — PVE-01..PVE-05
// ════════════════════════════════════════════════════════════

func pveBenchmarkSimple() -> BenchmarkResult {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let laps = [
        BenchmarkLapInput(id: "L1", tempoMs: 100_000,
                          temposPorParcial: ["P1": 50_000, "P2": 50_000])
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    return Benchmark.compute(scope: scope, parciais: parciais, laps: laps)!
}

step("PVE-01: PvEResultado — 5 valores canônicos") {
    try assertEq(PvEResultado.allCases.count, 5)
    try assertEq(PvEResultado.conseguiu.rawValue,    "conseguiu")
    try assertEq(PvEResultado.parcial.rawValue,      "parcial")
    try assertEq(PvEResultado.tentouFalhou.rawValue, "tentou-falhou")
    try assertEq(PvEResultado.errado.rawValue,       "errado")
    try assertEq(PvEResultado.semDados.rawValue,     "sem-dados")
}

step("PVE-02: evaluate — plan nil retorna nil") {
    let r = PlannedVsExecuted.evaluate(plan: nil, laps: [], benchmark: nil)
    try assertTrue(r == nil)
}

step("PVE-03: evaluate — sem laps válidas → SEM_DADOS") {
    let plan = PedagogicalPlan(focos: [
        PlanFoco(parcialId: "P1", parcialNome: "P1", acaoPrincipal: "atrasar frenagem")
    ])
    let r = PlannedVsExecuted.evaluate(plan: plan, laps: [], benchmark: pveBenchmarkSimple())!
    try assertEq(r.focos.count, 1)
    try assertEq(r.focos.first?.resultado, .semDados)
}

step("PVE-04: evaluate — voltas alinhadas com ação 'atrasar frenagem' → CONSEGUIU") {
    let plan = PedagogicalPlan(focos: [
        PlanFoco(parcialId: "P1", parcialNome: "Curva 1", acaoPrincipal: "atrasar frenagem")
    ])
    // Voltas com tempo = ref (manteveLinha) → ação alinhada
    let laps: [PvELap] = (0..<5).map { i in
        PvELap(id: "L\(i)", numero: i, valida: true,
               temposPorParcial: ["P1": 50_000])
    }
    let r = PlannedVsExecuted.evaluate(plan: plan, laps: laps, benchmark: pveBenchmarkSimple())!
    try assertEq(r.focos.first?.resultado, .conseguiu)
    try assertTrue(r.focos.first?.proximaAcao.flatMap { $0.contains("manter") } == true)
}

step("PVE-05: evaluate — sem mapping conhecido + maioria manteveLinha → PARCIAL") {
    let plan = PedagogicalPlan(focos: [
        PlanFoco(parcialId: "P1", parcialNome: "Curva 1", acaoPrincipal: "ação não mapeada")
    ])
    let laps: [PvELap] = (0..<5).map { i in
        PvELap(id: "L\(i)", numero: i, valida: true,
               temposPorParcial: ["P1": 50_000])
    }
    let r = PlannedVsExecuted.evaluate(plan: plan, laps: laps, benchmark: pveBenchmarkSimple())!
    try assertEq(r.focos.first?.resultado, .parcial)
}

// ════════════════════════════════════════════════════════════
// AttackPriority — AP-01..AP-04
// ════════════════════════════════════════════════════════════

step("AP-01: compute — sem benchmark retorna ranking vazio") {
    let r = AttackPriority.compute(laps: [], benchmark: nil, repetibilidadeSummary: nil)
    try assertEq(r.ranking.count, 0)
    try assertEq(r.top3.count, 0)
}

step("AP-02: compute por parcial — ordena por prioridade desc") {
    let parciais = [
        Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 50),
        Parcial(id: "P2", nome: "P2", apelido: nil, tStart: 50, tEnd: 100),
    ]
    let benchLaps = [
        BenchmarkLapInput(id: "Lref", tempoMs: 100_000,
                          temposPorParcial: ["P1": 50_000, "P2": 50_000])
    ]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: benchLaps)!
    // Voltas com P1 médio=51000 (impacto +1000) e P2 médio=52000 (impacto +2000)
    let laps: [PvELap] = [
        PvELap(id: "L1", numero: 1, valida: true,
               temposPorParcial: ["P1": 51_000, "P2": 52_000]),
        PvELap(id: "L2", numero: 2, valida: true,
               temposPorParcial: ["P1": 51_000, "P2": 52_000]),
    ]
    let summary = Repeatability.summary(laps: [
        .init(valida: true, tempoMs: 100_000, temposPorParcial: ["P1": 51_000, "P2": 52_000]),
        .init(valida: true, tempoMs: 100_000, temposPorParcial: ["P1": 51_000, "P2": 52_000]),
    ], parciais: parciais)
    let r = AttackPriority.compute(laps: laps, benchmark: bench, repetibilidadeSummary: summary)
    try assertEq(r.ranking.count, 2)
    // P2 tem maior impacto → maior prioridade
    try assertEq(r.ranking.first?.parcialId, "P2")
    try assertTrue((r.ranking.first?.prioridade ?? 0) > (r.ranking.last?.prioridade ?? 0))
}

step("AP-03: compute — repetibilidade indefinida usa fator 0.7") {
    let parciais = [Parcial(id: "P1", nome: "P1", apelido: nil, tStart: 0, tEnd: 100)]
    let benchLaps = [BenchmarkLapInput(id: "Lref", tempoMs: 100_000,
                                        temposPorParcial: ["P1": 100_000])]
    let scope = BenchmarkScope(carId: "c1", trackId: "t1", carConfigurationId: nil, dia: nil)
    let bench = Benchmark.compute(scope: scope, parciais: parciais, laps: benchLaps)!
    let laps: [PvELap] = [
        PvELap(id: "L1", numero: 1, valida: true,
               temposPorParcial: ["P1": 102_000]),
    ]
    // sem repetSummary → categoria indefinido → fator 0.7
    let r = AttackPriority.compute(laps: laps, benchmark: bench, repetibilidadeSummary: nil)
    try assertEq(r.ranking.count, 1)
    try assertEq(r.ranking.first?.repetibilidadeCategoria, .indefinido)
    // impacto = 2000; prioridade = 2000 * 0.7 = 1400.0
    try assertEq(r.ranking.first?.prioridade, 1400.0)
}

step("AP-04: computeForTrechos — ranking por trecho com amostras") {
    let trechos = [
        TrackSegment(id: "T1", layoutId: "L", ordem: 0, nome: "Curva 1",
                     tipo: .curva, ehTrecho: true, parcialId: "P1", x: 0, y: 0),
        TrackSegment(id: "T2", layoutId: "L", ordem: 1, nome: "Curva 2",
                     tipo: .curva, ehTrecho: true, parcialId: "P1", x: 0, y: 0),
    ]
    let laps: [AttackPriority.LapPorTrecho] = [
        .init(id: "L1", valida: true, temposPorTrecho: ["T1": 10_000, "T2": 12_000]),
        .init(id: "L2", valida: true, temposPorTrecho: ["T1": 10_500, "T2": 12_500]),
    ]
    let melhor: [String: AttackPriority.MelhorTrecho] = [
        "T1": .init(tempoMs: 9_500),
        "T2": .init(tempoMs: 11_000),
    ]
    let r = AttackPriority.computeForTrechos(
        laps: laps, trechos: trechos, melhorPorTrecho: melhor
    )
    try assertEq(r.ranking.count, 2)
    // T2: impacto = 12250-11000 = 1250
    // T1: impacto = 10250-9500 = 750
    // T2 > T1
    try assertEq(r.ranking.first?.trechoId, "T2")
    try assertEq(r.ranking.first?.amostras, 2)
}

// ════════════════════════════════════════════════════════════
// EventoResumo — ER-01..ER-05
// ════════════════════════════════════════════════════════════

step("ER-01: ResumoQuality — 4 valores canônicos") {
    try assertEq(ResumoQuality.allCases.count, 4)
    try assertEq(ResumoQuality.medido.rawValue,    "MEDIDO")
    try assertEq(ResumoQuality.parcial.rawValue,   "PARCIAL")
    try assertEq(ResumoQuality.estimado.rawValue,  "ESTIMADO")
    try assertEq(ResumoQuality.vazio.rawValue,     "VAZIO")
}

step("ER-02: calcularStintResumo — laps reais → MEDIDO; voltasPlanejadas → ESTIMADO; vazio → VAZIO") {
    let medido = EventoResumo.calcularStintResumo(StintInput(
        id: "S1", lapsExecutados: [
            StintLap(id: "L1", tempoMs: 100_000),
            StintLap(id: "L2", tempoMs: 99_500),
            StintLap(id: "L3", tempoMs: 100_500, valida: false), // inválida
        ]
    ))
    try assertEq(medido.quality, .medido)
    try assertEq(medido.voltas, 2)         // só válidas
    try assertEq(medido.voltasTotais, 3)
    try assertEq(medido.melhorMs, 99_500)
    try assertEq(medido.melhorLapId, "L2")

    let estimado = EventoResumo.calcularStintResumo(StintInput(id: "S2", voltasPlanejadas: 12))
    try assertEq(estimado.quality, .estimado)
    try assertEq(estimado.voltas, 12)
    try assertTrue(estimado.melhorMs == nil)

    let vazio = EventoResumo.calcularStintResumo(StintInput(id: "S3"))
    try assertEq(vazio.quality, .vazio)
    try assertEq(vazio.voltas, 0)
}

step("ER-03: calcularDiaResumo — mistura medido + estimado → PARCIAL") {
    let stints = [
        StintInput(id: "S1", lapsExecutados: [StintLap(tempoMs: 100_000)]),
        StintInput(id: "S2", voltasPlanejadas: 5)
    ]
    let dia = EventoResumo.calcularDiaResumo(stints, now: 1234)
    try assertEq(dia.quality, .parcial)
    try assertEq(dia.voltas, 6)            // 1 + 5
    try assertEq(dia.melhorMs, 100_000)
    try assertEq(dia.melhorStintId, "S1")
    try assertEq(dia.calculadoEm, 1234)
}

step("ER-04: calcularDiaResumo — sem stints → VAZIO") {
    let dia = EventoResumo.calcularDiaResumo([], now: 999)
    try assertEq(dia.quality, .vazio)
    try assertEq(dia.voltas, 0)
    try assertTrue(dia.melhorMs == nil)
}

step("ER-05: calcularEventoResumo — agrega 2 dias com melhor global") {
    let evento = EventoResumoInput(
        dias: [
            EventoDia(id: "D1", data: "2026-05-01"),
            EventoDia(id: "D2", data: "2026-05-02"),
        ],
        stintsByDia: [
            "D1": [StintInput(id: "S1", lapsExecutados: [StintLap(tempoMs: 102_000)])],
            "D2": [StintInput(id: "S2", lapsExecutados: [StintLap(tempoMs: 99_500)])],
        ]
    )
    let r = EventoResumo.calcularEventoResumo(evento, now: 555)
    try assertEq(r.voltasTotal, 2)
    try assertEq(r.melhorMsGlobal, 99_500)
    try assertEq(r.melhorMsPorDia["D1"] ?? nil, 102_000)
    try assertEq(r.melhorMsPorDia["D2"] ?? nil, 99_500)
    try assertEq(r.quality, .medido) // ambos medidos
    try assertEq(r.calculadoEm, 555)
}

step("TRK-05: Codable ida-e-volta — Track → JSON → Track preserva tudo") {
    let r = SeedBrasilia.make()
    let enc = JSONEncoder()
    let dec = JSONDecoder()
    let data = try enc.encode(r.track)
    let back = try dec.decode(Track.self, from: data)
    try assertEq(back.id, r.track.id)
    try assertEq(back.apelido, r.track.apelido)
    try assertEq(back.geoAncoras.count, r.track.geoAncoras.count)
    try assertEq(back.svgPath, r.track.svgPath)
}

// ════════════════════════════════════════════════════════════
// LessonLibrary — LL-01 .. LL-04 (paridade com node-smoke-p1-coach.mjs)
// ════════════════════════════════════════════════════════════

step("LL-01: 7 lições MVP ativas (sem Fase 2 / racecraft / setup)") {
    try assertEq(LessonLibrary.mvp.count, 7)
    try assertEq(LessonLibrary.active.count, 7)
}

step("LL-02: lições MVP esperadas pelos títulos") {
    let titles = LessonLibrary.mvp.map { $0.title }
    let esperadas = ["Referência Fixa", "V-Min", "Transição Freio-Acelerador",
                     "Acelerador Progressivo", "Linha de Visão",
                     "Trail Braking Suave", "Curva Cega"]
    for esp in esperadas {
        try assertTrue(titles.contains(esp), "missing: \(esp)")
    }
}

step("LL-03: phaseWeights de cada lição soma 1.0") {
    for l in LessonLibrary.mvp {
        let total = l.phaseWeights.values.reduce(0.0, +)
        try assertTrue(abs(total - 1.0) < 0.001, "\(l.id) soma=\(total)")
    }
}

step("LL-04: canActivate respeita requiredSignals") {
    let vmin = LessonLibrary.byId("L002-v-min")!
    // Sinais obrigatórios: kmh + velMinima + phase
    try assertTrue(vmin.canActivate(signals: [.kmh, .velMinima, .phase]), "V-Min com kmh+velMinima+phase")
    try assertTrue(!vmin.canActivate(signals: [.kmh, .phase]), "V-Min SEM velMinima → false")
    try assertTrue(!vmin.canActivate(signals: []), "V-Min sem nada → false")
}

// ════════════════════════════════════════════════════════════
// FaseCurva — FC-01 .. FC-08 (port de src/telemetry/fase-curva.js)
// ════════════════════════════════════════════════════════════

step("FC-01: classificar([]) retorna nil") {
    try assertTrue(FaseCurva.classificar([]) == nil, "vazio deve retornar nil")
}

step("FC-02: sem accLong → fallback 1/3 1/3 1/3 por tempo") {
    let samples = (0...9).map { i in
        FaseCurva.InputSample(t: Double(i) * 100, kmh: Double(120 - i))
    }
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.metodo, FaseCurva.Metodo.fallback33)
    // Cortes em t=300 e t=600 → inicio: t<=300 (4), meio: 300<t<=600 (3), fim: t>600 (3)
    try assertEq(r.inicio.samples.count, 4)
    try assertEq(r.meio.samples.count, 3)
    try assertEq(r.fim.samples.count, 3)
}

step("FC-03: com accLong → c1 onde cruza -0.35g, c2 onde cruza +0.25g") {
    let samples: [FaseCurva.InputSample] = [
        .init(t:   0, kmh: 120, accLong: -0.6, accLat: 0.1),
        .init(t: 100, kmh: 100, accLong: -0.5, accLat: 0.3),
        .init(t: 200, kmh:  80, accLong: -0.1, accLat: 0.8),  // c1=200 (cruza -0.35)
        .init(t: 300, kmh:  70, accLong:  0.0, accLat: 0.9),
        .init(t: 400, kmh:  72, accLong:  0.1, accLat: 0.7),
        .init(t: 500, kmh:  85, accLong:  0.4, accLat: 0.4),  // c2=500 (cruza +0.25)
        .init(t: 600, kmh: 100, accLong:  0.5, accLat: 0.2),
    ]
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.metodo, FaseCurva.Metodo.sinais)
    try assertEq(r.inicio.samples.count, 3)  // t=0,100,200
    try assertEq(r.meio.samples.count, 3)    // t=300,400,500
    try assertEq(r.fim.samples.count, 1)     // t=600
}

step("FC-04: apex = ponto de menor velocidade dentro do MEIO") {
    let samples: [FaseCurva.InputSample] = [
        .init(t:   0, kmh: 120, accLong: -0.6),
        .init(t: 100, kmh: 100, accLong: -0.5),
        .init(t: 200, kmh:  80, accLong: -0.1),
        .init(t: 300, kmh:  70, accLong:  0.0),
        .init(t: 400, kmh:  65, accLong:  0.1),  // apex
        .init(t: 500, kmh:  85, accLong:  0.4),
        .init(t: 600, kmh: 100, accLong:  0.5),
    ]
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.meio.stats.apexKmh, 65)
    try assertEq(r.meio.stats.apexT, 400)
    try assertEq(r.total.stats.apexKmh, 65)
}

step("FC-05: stats — velEntrada/velSaida = primeira/última kmh do bloco") {
    let samples: [FaseCurva.InputSample] = [
        .init(t:   0, kmh: 120, accLong: -0.6),
        .init(t: 100, kmh: 100, accLong: -0.5),
        .init(t: 200, kmh:  80, accLong: -0.1),
        .init(t: 300, kmh:  70, accLong:  0.0),
        .init(t: 400, kmh:  65, accLong:  0.1),
        .init(t: 500, kmh:  85, accLong:  0.4),
        .init(t: 600, kmh: 100, accLong:  0.5),
    ]
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.inicio.stats.velEntrada, 120)
    try assertEq(r.inicio.stats.velSaida, 80)
    try assertEq(r.fim.stats.velEntrada, 100)
    try assertEq(r.fim.stats.velSaida, 100)
    try assertEq(r.total.stats.velEntrada, 120)
    try assertEq(r.total.stats.velSaida, 100)
}

step("FC-06: accLongPeak preserva sinal do maior em magnitude") {
    let samples: [FaseCurva.InputSample] = [
        .init(t:   0, kmh: 120, accLong: -0.6),
        .init(t: 100, kmh: 100, accLong:  0.5),
        .init(t: 200, kmh:  80, accLong: -0.1),
    ]
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.total.stats.accLongPeak, -0.6)
}

step("FC-07: total.duracaoMs = t_last - t_first") {
    let samples = (0...10).map { i in
        FaseCurva.InputSample(t: Double(i) * 50, kmh: 100, accLong: 0.0)
    }
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.total.duracaoMs, 500)
}

step("FC-08: sample com velocidade ou accLong nil não quebra") {
    let samples: [FaseCurva.InputSample] = [
        .init(t:   0, kmh: nil, accLong: nil),
        .init(t: 100, kmh: 100, accLong: -0.5),
        .init(t: 200, kmh: nil, accLong: nil),
        .init(t: 300, kmh:  80, accLong:  0.4),
    ]
    let r = FaseCurva.classificar(samples)!
    try assertEq(r.metodo, FaseCurva.Metodo.sinais)
    try assertEq(r.total.stats.velMinima, 80)
    try assertEq(r.total.stats.velMaxima, 100)
}

// ════════════════════════════════════════════════════════════
// PathMapper — PM-01 .. PM-08 (port de src/telemetry/path-mapper.js)
// ════════════════════════════════════════════════════════════

step("PM-01: parsePath M+L extrai vértices") {
    let pts = PathMapper.parsePath("M 10 20 L 30 40 L 50 60")
    try assertEq(pts.count, 3)
    try assertEq(pts[0], PathMapper.Point(x: 10, y: 20))
    try assertEq(pts[2], PathMapper.Point(x: 50, y: 60))
}

step("PM-02: Z fecha o path repetindo o primeiro vértice") {
    let pts = PathMapper.parsePath("M 0 0 L 10 0 L 10 10 Z")
    try assertEq(pts.count, 4)
    try assertEq(pts.last!, PathMapper.Point(x: 0, y: 0))
}

step("PM-03: pathLength soma hipotenusas") {
    let pts = [
        PathMapper.Point(x: 0, y: 0),
        PathMapper.Point(x: 3, y: 4),     // dist 5
        PathMapper.Point(x: 6, y: 8),     // dist 5
    ]
    try assertClose(PathMapper.pathLength(pts), 10, tol: 0.001)
}

step("PM-04: buildLookup gera N+1 pontos com offsets crescentes") {
    let lookup = PathMapper.buildLookup("M 0 0 L 100 0", samples: 10)
    try assertEq(lookup.points.count, 11)
    try assertClose(lookup.totalLength, 100, tol: 0.001)
    try assertClose(lookup.points[0].offset, 0)
    try assertClose(lookup.points[10].offset, 100, tol: 0.001)
    // 5º ponto deve estar em ~50
    try assertClose(lookup.points[5].x, 50, tol: 0.5)
}

step("PM-05: snap projeta GPS no ponto mais próximo do path") {
    let lookup = PathMapper.buildLookup("M 0 0 L 100 0", samples: 100)
    let r = PathMapper.snap(lookup, x: 50, y: 5)
    try assertClose(r.x, 50, tol: 1)
    try assertClose(r.y, 0, tol: 0.001)
    try assertClose(r.dist, 5, tol: 0.001)
    try assertClose(r.offset, 50, tol: 1)
}

step("PM-06: snap atualiza lastIdx e busca incremental funciona") {
    let lookup = PathMapper.buildLookup("M 0 0 L 1000 0", samples: 1000)
    _ = PathMapper.snap(lookup, x: 500, y: 1)
    try assertTrue(lookup.lastIdx != nil, "lastIdx deve ter sido setado")
    let idx1 = lookup.lastIdx!
    // próximo snap muito próximo deve cair na janela incremental
    let r2 = PathMapper.snap(lookup, x: 502, y: 1)
    try assertTrue(abs(lookup.lastIdx! - idx1) < 60, "movimento dentro da janela")
    try assertClose(r2.dist, 1, tol: 0.5)
}

step("PM-07: parcialFromOffset converte offset → parcial via pct") {
    let segs: [PathMapper.SegmentBounds] = [
        .init(parcialId: "P1", pathStart: 0,  pathEnd: 25),
        .init(parcialId: "P2", pathStart: 25, pathEnd: 50),
        .init(parcialId: "P3", pathStart: 50, pathEnd: 75),
        .init(parcialId: "P4", pathStart: 75, pathEnd: 100),
    ]
    try assertEq(PathMapper.parcialFromOffset(offset: 10,  totalLength: 100, segments: segs), "P1")
    try assertEq(PathMapper.parcialFromOffset(offset: 30,  totalLength: 100, segments: segs), "P2")
    try assertEq(PathMapper.parcialFromOffset(offset: 80,  totalLength: 100, segments: segs), "P4")
    try assertTrue(PathMapper.parcialFromOffset(offset: 999, totalLength: 100, segments: segs) == nil)
}

step("PM-08: segmentsIntersect detecta cruzamento") {
    // X simples
    let A = PathMapper.Point(x: 0, y: 0)
    let B = PathMapper.Point(x: 10, y: 10)
    let C = PathMapper.Point(x: 0, y: 10)
    let D = PathMapper.Point(x: 10, y: 0)
    try assertTrue(PathMapper.segmentsIntersect(A, B, C, D), "X clássico cruza")
    // Paralelos não cruzam
    let E = PathMapper.Point(x: 0, y: 0)
    let F = PathMapper.Point(x: 10, y: 0)
    let G = PathMapper.Point(x: 0, y: 5)
    let H = PathMapper.Point(x: 10, y: 5)
    try assertTrue(!PathMapper.segmentsIntersect(E, F, G, H), "paralelos não cruzam")
}

// ════════════════════════════════════════════════════════════
// TrajectoryMonitor — TM-01 .. TM-20 (1:1 com node-smoke-trajectory-monitor.mjs)
// ════════════════════════════════════════════════════════════

let TM_ORIG_LAT = -15.7800
let TM_ORIG_LNG = -47.9200

func tmSample(tMs: Double, dxM: Double = 0, dyM: Double = 0,
              kmh: Double? = 100, accLong: Double? = nil,
              gyroAlpha: Double? = nil, course: Double? = nil) -> TrajectoryMonitor_.InputSample {
    let cosLat = cos(TM_ORIG_LAT * .pi / 180)
    return TrajectoryMonitor_.InputSample(
        t: tMs,
        lat: TM_ORIG_LAT + dyM / 111000,
        lng: TM_ORIG_LNG + dxM / (111000 * cosLat),
        kmh: kmh, accLong: accLong, gyroAlpha: gyroAlpha, course: course
    )
}

func tmRefSamples() -> [TrajectoryMonitor_.InputSample] {
    return [
        tmSample(tMs:    0, dyM: -100, kmh: 130, accLong:  0.0, gyroAlpha:  0, course:   0),
        tmSample(tMs:  100, dyM:  -80, kmh: 130, accLong:  0.0, gyroAlpha:  0, course:   0),
        tmSample(tMs:  200, dyM:  -60, kmh: 125, accLong: -0.3, gyroAlpha:  0, course:   0),  // freio
        tmSample(tMs:  300, dyM:  -40, kmh: 110, accLong: -0.5, gyroAlpha:  5, course:   5),
        tmSample(tMs:  400, dyM:  -20, kmh:  90, accLong: -0.4, gyroAlpha: 30, course:  20),  // giro
        tmSample(tMs:  500, dyM:   -5, kmh:  72, accLong: -0.1, gyroAlpha: 35, course:  50),
        tmSample(tMs:  600, dxM:    5, kmh:  68, accLong:  0.0, gyroAlpha: 30, course:  80),  // apex
        tmSample(tMs:  700, dxM:   20, kmh:  72, accLong:  0.2, gyroAlpha: 20, course: 110),  // tração
        tmSample(tMs:  800, dxM:   45, kmh:  85, accLong:  0.3, gyroAlpha: 10, course: 135),
        tmSample(tMs:  900, dxM:   75, kmh: 100, accLong:  0.3, gyroAlpha:  3, course: 155),
        tmSample(tMs: 1000, dxM:  110, kmh: 115, accLong:  0.2, gyroAlpha:  0, course: 170),
        tmSample(tMs: 1100, dxM:  150, kmh: 125, accLong:  0.1, gyroAlpha:  0, course: 175),
    ]
}

step("TM-01: distanceMetersGeo: 1m horizontal ≈ 1m") {
    let cosLat = cos(TM_ORIG_LAT * .pi / 180)
    let a = (lat: TM_ORIG_LAT, lng: TM_ORIG_LNG)
    let b = (lat: TM_ORIG_LAT, lng: TM_ORIG_LNG + 1 / (111000 * cosLat))
    let d = TrajectoryMonitor_.distanceMetersGeo(a, b)!
    try assertTrue(abs(d - 1) < 0.05, "d=\(d)")
}

step("TM-02: distanceMetersGeo: nulo se faltar coord") {
    try assertTrue(TrajectoryMonitor_.distanceMetersGeo(nil as TrajectoryMonitor_.InputSample?, nil) == nil)
    let s1 = TrajectoryMonitor_.InputSample(t: 0, lat: 1, lng: nil)
    let s2 = TrajectoryMonitor_.InputSample(t: 0, lat: 1, lng: 1)
    try assertTrue(TrajectoryMonitor_.distanceMetersGeo(s1, s2) == nil)
}

step("TM-03: findApexIndex aponta velocidade mínima") {
    let arr = tmRefSamples()
    let i = TrajectoryMonitor_.findApexIndex(arr)
    try assertEq(arr[i].kmh, 68)
}

step("TM-04: findBrakingIndex aponta primeira accLong < -0.20") {
    let arr = tmRefSamples()
    try assertEq(TrajectoryMonitor_.findBrakingIndex(arr), 2)
}

step("TM-05: findBrakingIndex fallback sem IMU usa queda de kmh") {
    let arr = tmRefSamples().map { s in
        TrajectoryMonitor_.InputSample(t: s.t, lat: s.lat, lng: s.lng,
                                       kmh: s.kmh, accLong: nil,
                                       gyroAlpha: s.gyroAlpha, course: s.course)
    }
    let i = TrajectoryMonitor_.findBrakingIndex(arr)
    try assertTrue(i >= 1 && i <= 4, "fallback idx=\(i)")
}

step("TM-06: findTurnInIndex aponta primeira |gyroAlpha| > 15") {
    let arr = tmRefSamples()
    try assertEq(TrajectoryMonitor_.findTurnInIndex(arr), 4)
}

step("TM-07: findTurnInIndex fallback via course") {
    let arr = tmRefSamples().map { s in
        TrajectoryMonitor_.InputSample(t: s.t, lat: s.lat, lng: s.lng,
                                       kmh: s.kmh, accLong: s.accLong,
                                       gyroAlpha: nil, course: s.course)
    }
    let i = TrajectoryMonitor_.findTurnInIndex(arr)
    try assertTrue(i >= 3 && i <= 6, "fallback idx=\(i)")
}

step("TM-08: findThrottleIndex primeira após apex com accLong > 0.15") {
    let arr = tmRefSamples()
    let apex = TrajectoryMonitor_.findApexIndex(arr)
    try assertEq(TrajectoryMonitor_.findThrottleIndex(arr, apexIdx: apex), 7)
}

step("TM-09: evaluateSegmentTrajectory: ref vs ref → desvios ≈ 0") {
    let ref = tmRefSamples()
    let r = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: ref, refSamples: ref)
    try assertTrue(r.disponivel, r.razao ?? "indisponivel")
    for d in [r.brakingPointDeviationM, r.turnInPointDeviationM, r.throttlePointDeviationM,
              r.entryDeviationM, r.apexDeviationM] {
        try assertTrue(d != nil && d! < 0.5, "desvio fora: \(String(describing: d))")
    }
    try assertEq(r.confidence, Confidence.alta)
}

step("TM-10: evaluateSegmentTrajectory: piloto 1 amostra mais tarde no freio gera desvio") {
    let ref = tmRefSamples()
    var cur = ref
    // sample idx=2 vira "ainda não freou"
    cur[2] = TrajectoryMonitor_.InputSample(
        t: cur[2].t, lat: cur[2].lat, lng: cur[2].lng,
        kmh: 130, accLong: 0.0,
        gyroAlpha: cur[2].gyroAlpha, course: cur[2].course
    )
    let r = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: cur, refSamples: ref)
    try assertTrue(r.disponivel)
    let d = r.brakingPointDeviationM
    try assertTrue(d != nil && d! >= 5 && d! <= 40, "brakingDev fora: \(String(describing: d))")
}

step("TM-11: evaluateSegmentTrajectory: poucas amostras → indisponivel") {
    let r = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: [], refSamples: tmRefSamples())
    try assertTrue(!r.disponivel)
    try assertEq(r.razao, "sem-amostras-atuais")
}

step("TM-12: evaluateSegmentTrajectory: sem refSamples → indisponivel") {
    let r = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: tmRefSamples(), refSamples: [])
    try assertTrue(!r.disponivel)
    try assertEq(r.razao, "sem-amostras-referencia")
}

step("TM-13: evaluateSegmentTrajectory: confidence cai sem IMU em ambos") {
    let semImu = tmRefSamples().map { s in
        TrajectoryMonitor_.InputSample(t: s.t, lat: s.lat, lng: s.lng,
                                       kmh: s.kmh, accLong: nil,
                                       gyroAlpha: nil, course: s.course)
    }
    let r = TrajectoryMonitor_.evaluateSegmentTrajectory(samples: semImu, refSamples: semImu)
    try assertTrue(r.confidence != .alta, "não deveria ser ALTA sem IMU")
}

step("TM-14: evaluateReferenciaFixa: 3 voltas com desvio < 8m → cumpriu") {
    let reports: [TrajectoryMonitor_.Report] = [
        makeReport(braking: 5),
        makeReport(braking: 7),
        makeReport(braking: 4),
    ]
    let r = TrajectoryMonitor_.evaluateReferenciaFixa(reports)
    try assertTrue(r.cumpriu, "deveria cumprir")
    try assertEq(r.hits, 3)
    try assertTrue(r.mediaM != nil && abs(r.mediaM! - 5.3) < 0.1, "media=\(String(describing: r.mediaM))")
}

step("TM-15: evaluateReferenciaFixa: 3 voltas com desvio > 8m → não cumpriu") {
    let reports: [TrajectoryMonitor_.Report] = [
        makeReport(braking: 10),
        makeReport(braking: 12),
        makeReport(braking: 15),
    ]
    let r = TrajectoryMonitor_.evaluateReferenciaFixa(reports)
    try assertTrue(!r.cumpriu, "não deveria cumprir")
    try assertEq(r.hits, 0)
}

step("TM-16: evaluateReferenciaFixa: ignora reports sem desvio") {
    let reports: [TrajectoryMonitor_.Report] = [
        makeReport(braking: 5),
        makeReport(braking: nil),
        makeReport(braking: 6),
        makeReport(braking: 4),
    ]
    let r = TrajectoryMonitor_.evaluateReferenciaFixa(reports)
    try assertTrue(r.cumpriu, "3 hits válidos deveriam cumprir")
}

step("TM-17: evaluateCurvaCega: 2 de 3 voltas com desvio < 5m → cumpriu") {
    let reports: [TrajectoryMonitor_.Report] = [
        makeReport(entry: 3),
        makeReport(entry: 8),
        makeReport(entry: 4),
    ]
    let r = TrajectoryMonitor_.evaluateCurvaCega(reports)
    try assertTrue(r.cumpriu, "deveria cumprir")
}

step("TM-18: TrajectoryMonitor recordSegment acumula histórico") {
    let m = TrajectoryMonitor()
    let ref = tmRefSamples()
    _ = m.recordSegment(segmentId: "curva-1", samples: ref, refSamples: ref)
    _ = m.recordSegment(segmentId: "curva-1", samples: ref, refSamples: ref)
    _ = m.recordSegment(segmentId: "curva-2", samples: ref, refSamples: ref)
    try assertEq(m.getHistory("curva-1").count, 2)
    try assertEq(m.getHistory("curva-2").count, 1)
    try assertEq(m.getHistory("curva-X").count, 0)
}

step("TM-19: evaluateLesson roteia para o avaliador certo") {
    let m = TrajectoryMonitor()
    let ref = tmRefSamples()
    for _ in 0..<4 {
        _ = m.recordSegment(segmentId: "c1", samples: ref, refSamples: ref)
    }
    let ev = m.evaluateLesson(lessonId: "L001-referencia-fixa", segmentId: "c1")
    try assertTrue(ev.cumpriu, "L001 ref-vs-ref deveria cumprir")
    let evCega = m.evaluateLesson(lessonId: "L007-curva-cega", segmentId: "c1")
    try assertTrue(evCega.cumpriu, "L007 ref-vs-ref deveria cumprir")
    let evDesconhecida = m.evaluateLesson(lessonId: "L999-fake", segmentId: "c1")
    try assertTrue(!evDesconhecida.cumpriu, "lição desconhecida não cumpre")
    try assertEq(evDesconhecida.razao, "lesson-sem-avaliador")
}

step("TM-20: TrajectoryMonitor.reset() esvazia tudo") {
    let m = TrajectoryMonitor()
    _ = m.recordSegment(segmentId: "c1", samples: tmRefSamples(), refSamples: tmRefSamples())
    m.reset()
    try assertEq(m.getHistory("c1").count, 0)
}

// helper para construir Reports parciais usados em TM-14..17
func makeReport(braking: Double? = nil, entry: Double? = nil) -> TrajectoryMonitor_.Report {
    return TrajectoryMonitor_.Report(
        disponivel: true, razao: nil,
        brakingPointDeviationM: braking,
        turnInPointDeviationM: nil,
        throttlePointDeviationM: nil,
        entryDeviationM: entry,
        apexDeviationM: nil,
        confidence: .alta,
        debug: TrajectoryMonitor_.Report.Debug(
            apexIdx: -1, refApexIdx: -1, brakingIdx: -1, refBrakingIdx: -1,
            turnInIdx: -1, refTurnInIdx: -1, throttleIdx: -1, refThrottleIdx: -1
        )
    )
}

// ════════════════════════════════════════════════════════════
// BaselineVectors — BV-01 .. BV-07 (port de src/domain/baseline-vectors.js)
// ════════════════════════════════════════════════════════════

func bvCand(valida: Bool = true, tempoMs: Double = 75_000,
            userId: String? = "u1", carCfg: String? = "c1",
            data: Date? = nil, clima: String? = "seco",
            composto: String? = "R7", desgaste: Int? = 1,
            tempPista: Double? = 40, tempAr: Double? = 25) -> BaselineVectors.Candidate {
    return BaselineVectors.Candidate(
        lap: BaselineVectors.LapInfo(valida: valida, tempoMs: tempoMs),
        session: BaselineVectors.SessionInfo(userId: userId, carConfigurationId: carCfg,
                                              dataInicio: data, clima: clima),
        env: BaselineVectors.EnvSnapshot(composto: composto, desgasteNivelD: desgaste,
                                          tempPista: tempPista, tempAr: tempAr)
    )
}

let bvRef = BaselineVectors.Reference(
    userId: "u1", carConfigId: "c1",
    timestamp: Date(timeIntervalSince1970: 1_730_000_000),
    clima: "seco",
    env: BaselineVectors.EnvSnapshot(composto: "R7", desgasteNivelD: 1,
                                      tempPista: 40, tempAr: 25)
)

step("BV-01: filterForBaseline aceita candidato compatível") {
    let r = BaselineVectors.filterForBaseline(candidates: [bvCand()], ref: bvRef)
    try assertEq(r.count, 1)
}

step("BV-02: descarta lap.valida = false") {
    let r = BaselineVectors.filterForBaseline(candidates: [bvCand(valida: false)], ref: bvRef)
    try assertEq(r.count, 0)
}

step("BV-03: pneu.igualarMarca exclui composto diferente") {
    let r = BaselineVectors.filterForBaseline(
        candidates: [bvCand(composto: "M4")], ref: bvRef)
    try assertEq(r.count, 0)
}

step("BV-04: pneu.nivelMax exclui desgaste acima do limite") {
    let r = BaselineVectors.filterForBaseline(
        candidates: [bvCand(desgaste: 5)], ref: bvRef)
    try assertEq(r.count, 0)
}

step("BV-05: ambiente.tempPistaTol exclui pista fora da tolerância (5°C)") {
    let r = BaselineVectors.filterForBaseline(
        candidates: [bvCand(tempPista: 50)], ref: bvRef)  // Δ=10
    try assertEq(r.count, 0)
    let r2 = BaselineVectors.filterForBaseline(
        candidates: [bvCand(tempPista: 43)], ref: bvRef)  // Δ=3
    try assertEq(r2.count, 1)
}

step("BV-06: piloto.apenasMesmoPiloto exclui userId diferente") {
    let r = BaselineVectors.filterForBaseline(
        candidates: [bvCand(userId: "outro")], ref: bvRef)
    try assertEq(r.count, 0)
}

step("BV-07: ordena por tempoMs ascendente e respeita minVoltas") {
    let cands = [
        bvCand(tempoMs: 80_000),
        bvCand(tempoMs: 70_000),
        bvCand(tempoMs: 90_000),
        bvCand(tempoMs: 60_000),
    ]
    var preset = BaselineVectors.defaultPreset
    preset.minVoltas = 2
    let r = BaselineVectors.filterForBaseline(candidates: cands, ref: bvRef, preset: preset)
    // max(2, 10) = 10 → todos cabem, ordenados
    try assertEq(r.count, 4)
    try assertEq(r[0].lap.tempoMs, 60_000)
    try assertEq(r[1].lap.tempoMs, 70_000)
    try assertEq(r[3].lap.tempoMs, 90_000)
}

// ════════════════════════════════════════════════════════════
// FuelCalc — FU-01 .. FU-07 (port de src/domain/fuel-calc.js)
// ════════════════════════════════════════════════════════════

step("FU-01: sem combustivelInicialL → não disponível") {
    let r = FuelCalc.calcular(env: FuelCalc.Env())
    try assertEq(r.disponivel, FuelCalc.Disponivel.nao)
    try assertEq(r.razao, "sem-combustivel-inicial")
}

step("FU-02: sem consumo → parcial com pctTanque calculado") {
    let r = FuelCalc.calcular(env: FuelCalc.Env(tanqueLitros: 50, combustivelInicialL: 25))
    try assertEq(r.disponivel, FuelCalc.Disponivel.parcial)
    try assertEq(r.razao, "sem-consumo-medio")
    try assertEq(r.pctTanque, 50)
}

step("FU-03: cálculo completo: consumo 2L/volta, 30L iniciais, 5 voltas") {
    let r = FuelCalc.calcular(
        env: FuelCalc.Env(tanqueLitros: 40, combustivelInicialL: 30, consumoMedioLVolta: 2),
        voltasAndadas: 5
    )
    try assertEq(r.disponivel, FuelCalc.Disponivel.sim)
    try assertEq(r.consumidoL, 10)
    try assertEq(r.restanteL, 20)
    try assertEq(r.voltasRestantes, 10)   // 20 / 2 = 10
    try assertEq(r.pctTanque, 50)         // 20/40
    try assertEq(r.label, "10v")
}

step("FU-04: restanteL nunca fica negativo") {
    let r = FuelCalc.calcular(
        env: FuelCalc.Env(tanqueLitros: 40, combustivelInicialL: 5, consumoMedioLVolta: 2),
        voltasAndadas: 100
    )
    try assertEq(r.restanteL, 0)
    try assertEq(r.voltasRestantes, 0)
    try assertEq(r.label, "0v")
}

step("FU-05: progressoStint sem laps") {
    let p = FuelCalc.calcularProgressoStint(laps: [], plan: FuelCalc.StintPlan(nVoltasAlvo: 10))
    try assertEq(p.voltasFeitas, 0)
    try assertEq(p.voltasAlvo, 10)
    try assertEq(p.voltasRestantes, 10)
    try assertEq(p.pctCompleto, 0)
    try assertTrue(p.melhorMs == nil && p.ritmoMedioMs == nil)
}

step("FU-06: progressoStint com 3 voltas válidas → ritmo + delta") {
    let laps = [
        FuelCalc.LapInfo(valida: true, tempoMs: 80_000),
        FuelCalc.LapInfo(valida: true, tempoMs: 78_000),
        FuelCalc.LapInfo(valida: true, tempoMs: 79_000),
    ]
    let p = FuelCalc.calcularProgressoStint(laps: laps, plan: FuelCalc.StintPlan(nVoltasAlvo: 10))
    try assertEq(p.voltasFeitas, 3)
    try assertEq(p.validas, 3)
    try assertEq(p.melhorMs, 78_000)
    try assertEq(p.ritmoMedioMs, 79_000)
    try assertEq(p.deltaStintMs, 1_000)
    try assertEq(p.pctCompleto, 30)
}

step("FU-07: progressoStint ignora invalidas no ritmo mas conta no total") {
    let laps = [
        FuelCalc.LapInfo(valida: true,  tempoMs: 80_000),
        FuelCalc.LapInfo(valida: false, tempoMs: 200_000),  // out lap, fora do ritmo
        FuelCalc.LapInfo(valida: true,  tempoMs: 78_000),
    ]
    let p = FuelCalc.calcularProgressoStint(laps: laps, plan: nil)
    try assertEq(p.voltasFeitas, 3)
    try assertEq(p.validas, 2)
    try assertEq(p.melhorMs, 78_000)
    try assertEq(p.ritmoMedioMs, 79_000)
    try assertTrue(p.voltasAlvo == nil && p.pctCompleto == nil)
}

// ════════════════════════════════════════════════════════════
// P1Coach — PC-01 .. PC-14 (port de src/domain/p1-coach.js)
// ════════════════════════════════════════════════════════════

let PC_ALL_MVP_SIGNALS: Set<String> = [
    "kmh", "lat", "lng", "course", "heading",
    "accLong", "accLat", "gyroAlpha",
    "phase", "velEntrada", "velMinima", "velSaida",
    "apexT", "apexKmh", "trajetoria",
]
let PC_SLOW = CoachSegment(id: "seg-1", ehTrecho: true, cornerType: .lenta)
let PC_FAST = CoachSegment(id: "seg-2", ehTrecho: true, cornerType: .rapida)
let PC_STRAIGHT = CoachSegment(id: "seg-r", ehTrecho: false, cornerType: nil)

func pcSnap(_ tMono: Double) -> CoachSnapshot {
    return CoachSnapshot(t: tMono, tMono: tMono)
}

step("PC-01: emite mensagem com foco SAIDA em curva lenta") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .saida)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .fim, snapshot: pcSnap(1000), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 1)
    try assertEq(out[0].phase, Phase.saida)
    try assertTrue(CoachPhrases.set.contains(out[0].text))
}

step("PC-02: NÃO emite em fase fora do foco") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .saida)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .inicio, snapshot: pcSnap(1000), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 0)
}

step("PC-03: respeita maxPerCorner=1") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0, maxPerCorner: 1)
    c.startLearningSession(focusPhase: .saida)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .fim, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .fim, snapshot: pcSnap(200), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 1)
}

step("PC-04: cooldown bloqueia mensagem em curva seguinte") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 5000)
    c.startLearningSession(focusPhase: .saida)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .fim, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    c.onSegmentExit()
    c.onSegmentEnter(CoachSegment(id: "seg-1b", ehTrecho: true, cornerType: .lenta),
                     availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .fim, snapshot: pcSnap(200), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 1)
}

step("PC-05: ignora retas (ehTrecho=false)") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession()
    c.onSegmentEnter(PC_STRAIGHT, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .meio, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 0)
}

step("PC-06: pause() suspende emissão; resume() retoma") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .apex)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    c.pause()
    _ = c.consume(faseCurva: .meio, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 0)
    c.resume()
    _ = c.consume(faseCurva: .meio, snapshot: pcSnap(200), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 1)
}

step("PC-07: focusLessonId trava na lição mesmo com outras elegíveis") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .apex, focusLessonId: "L002-v-min")
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .meio, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 1)
    try assertEq(out[0].lessonId, "L002-v-min")
}

step("PC-08: NÃO ativa sem startLearningSession") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.onSegmentEnter(PC_SLOW, availableSignals: PC_ALL_MVP_SIGNALS)
    _ = c.consume(faseCurva: .meio, snapshot: pcSnap(100), signals: PC_ALL_MVP_SIGNALS)
    try assertEq(out.count, 0)
}

step("PC-09: lição BAIXA não emite sem userPick (focusPhase nem focusLessonId)") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession()  // sem foco
    let sig: Set<String> = ["heading", "gyroAlpha", "phase"]
    c.onSegmentEnter(PC_FAST, availableSignals: sig)
    _ = c.consume(faseCurva: .inicio, snapshot: pcSnap(100), signals: sig)
    try assertEq(out.count, 0)
}

step("PC-10: lição BAIXA emite quando piloto fixa focusLessonId") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .entrada, focusLessonId: "L005-linha-de-visao")
    let sig: Set<String> = ["heading", "kmh"]
    c.onSegmentEnter(PC_FAST, availableSignals: sig)
    _ = c.consume(faseCurva: .inicio, snapshot: pcSnap(100), signals: sig)
    try assertEq(out.count, 1)
    try assertEq(out[0].confidence, Confidence.baixa)
}

step("PC-11: signalsFromSnapshot deriva sinais corretamente") {
    let s = P1Coach.signalsFromSnapshot(
        P1Coach.SnapshotSignalsInput(kmh: 80, lat: 1, lng: 2, accLong: 0.3, gyroAlpha: 5),
        faseStats: P1Coach.FaseStatsInput(velMinima: 70, apexT: 1234)
    )
    for need in ["kmh", "lat", "lng", "accLong", "gyroAlpha", "phase", "velMinima", "apexT"] {
        try assertTrue(s.contains(need), "faltou \(need)")
    }
}

step("PC-12: AUDIT — TODAS as 7 lições MVP ativam com snapshot real iPhone") {
    let snap = P1Coach.SnapshotSignalsInput(
        kmh: 90, lat: -15.78, lng: -47.92, course: 180, heading: 178,
        accLong: -0.4, accLat: 0.1, gyroAlpha: 12
    )
    let stats = P1Coach.FaseStatsInput(velEntrada: 110, velMinima: 65, velSaida: 95,
                                       apexT: 1234, apexKmh: 65)
    let signals = P1Coach.signalsFromSnapshot(snap, faseStats: stats)
    var naoAtiva: [String] = []
    for l in LessonLibrary.mvp {
        if !l.canActivate(stringSignals: signals) { naoAtiva.append(l.id) }
    }
    try assertTrue(naoAtiva.isEmpty, "MVP que NÃO ativam: \(naoAtiva.joined(separator: ", "))")
}

step("PC-13: E2E 3 voltas com foco SAIDA — todas msgs SAIDA, ≤6 totais") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .saida)

    let snap = P1Coach.SnapshotSignalsInput(
        kmh: 90, lat: -15.78, lng: -47.92, course: 180, heading: 178,
        accLong: -0.4, accLat: 0.1, gyroAlpha: 12
    )
    let stats = P1Coach.FaseStatsInput(velEntrada: 110, velMinima: 65, velSaida: 95,
                                       apexT: 1234, apexKmh: 65)
    let sig = P1Coach.signalsFromSnapshot(snap, faseStats: stats)

    let SLOW = CoachSegment(id: "curva-1", ehTrecho: true, cornerType: .lenta)
    let FAST = CoachSegment(id: "curva-2", ehTrecho: true, cornerType: .rapida)
    let RETA = CoachSegment(id: "reta-1",  ehTrecho: false, cornerType: nil)

    for lap in 0..<3 {
        let baseT = Double(lap) * 100_000
        c.onSegmentEnter(SLOW, availableSignals: sig)
        _ = c.consume(faseCurva: .inicio, snapshot: pcSnap(baseT + 100), signals: sig)
        _ = c.consume(faseCurva: .meio,   snapshot: pcSnap(baseT + 500), signals: sig)
        _ = c.consume(faseCurva: .fim,    snapshot: pcSnap(baseT + 900), signals: sig)
        c.onSegmentExit()

        c.onSegmentEnter(RETA, availableSignals: sig)
        _ = c.consume(faseCurva: .meio, snapshot: pcSnap(baseT + 1500), signals: sig)
        c.onSegmentExit()

        c.onSegmentEnter(FAST, availableSignals: sig)
        _ = c.consume(faseCurva: .fim, snapshot: pcSnap(baseT + 2500), signals: sig)
        c.onSegmentExit()

        c.onLapEnd()
    }

    try assertTrue(out.count > 0, "coach silencioso em 3 voltas")
    try assertTrue(out.count <= 6, "\(out.count) > 6 (passou maxPerCorner)")
    for m in out {
        try assertEq(m.phase, Phase.saida)
        try assertTrue(CoachPhrases.set.contains(m.text), "frase fora: \(m.text)")
    }
    try assertEq(c.learningSession.laps, 3)
}

step("PC-14: focusLessonId='L002-v-min' só emite em lenta+media (não em rápida)") {
    var out: [CoachMessage] = []
    let c = P1Coach(onMessage: { out.append($0) }, cooldownMs: 0)
    c.startLearningSession(focusPhase: .apex, focusLessonId: "L002-v-min")
    let snap = P1Coach.SnapshotSignalsInput(kmh: 90, lat: -15.78, lng: -47.92,
                                            course: 180, heading: 178,
                                            accLong: -0.4, accLat: 0.1, gyroAlpha: 12)
    let stats = P1Coach.FaseStatsInput(velEntrada: 110, velMinima: 65, velSaida: 95,
                                       apexT: 1234, apexKmh: 65)
    let sig = P1Coach.signalsFromSnapshot(snap, faseStats: stats)

    for (i, ct) in [CornerTypeMatch.lenta, .media, .rapida].enumerated() {
        c.onSegmentEnter(CoachSegment(id: "c\(i)", ehTrecho: true, cornerType: ct),
                         availableSignals: sig)
        _ = c.consume(faseCurva: .meio, snapshot: pcSnap(Double(out.count) * 1000), signals: sig)
        c.onSegmentExit()
    }
    try assertEq(out.count, 2)
    for m in out { try assertEq(m.lessonId, "L002-v-min") }
}

step("CLOCK-01: Clock.now retorna epoch ms positivo") {
    let now = Clock.now
    try assertTrue(now > 1_700_000_000_000, "now > 2023-11")
}

step("CLOCK-02: Clock.nowMono é monotonic e crescente") {
    let m1 = Clock.nowMono
    Thread.sleep(forTimeInterval: 0.01)
    let m2 = Clock.nowMono
    try assertTrue(m2 > m1, "monotonic")
    try assertTrue(m2 - m1 < 1000, "delta razoável < 1s")
}

// ═══════════════════════════════════════════════════════════
// PERSISTENCE — schema v1 + helpers de sync
// ═══════════════════════════════════════════════════════════
// Cada PERSIST-XX usa um DB em memória novo pra isolamento.
// O DatabaseMigrator é idempotente, então re-rodar não é problema —
// mas DBs separados garantem que estados anteriores não interferem.

func makeTestDB() throws -> DatabaseQueue {
    let q = try DB.makeMemoryQueue()
    // Cria um time + track default pra rows que dependem de FK.
    try q.write { db in
        var t = Time(id: "team-1", nome: "Equipe Teste")
        try t.insert(db)
        var tk = TrackRow(id: "track-1", apelido: "BSB")
        try tk.insert(db)
    }
    return q
}

step("PERSIST-01: makeMemoryQueue + migrations v1..v5 cria 25 tabelas") {
    let q = try DB.makeMemoryQueue()
    let names = try q.read { db in
        try String.fetchAll(db, sql:
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'grdb_%' ORDER BY name"
        )
    }
    // 20 do Postgres + sync_queue + sync_meta (v2) + licoes (v4) + pendencias_template + evento_pendencias (v5) = 25
    try assertEq(names.count, 25, "esperava 25 tabelas")
    for expected in ["times", "carros", "configuracoes", "sessoes", "voltas",
                     "marcos", "retas_especiais", "telemetry_samples",
                     "sync_queue", "sync_meta"] {
        try assertTrue(names.contains(expected), "tabela \(expected) ausente")
    }
}

step("PERSIST-02: telemetry_samples NÃO tem coluna synced_at (ADR-014)") {
    let q = try DB.makeMemoryQueue()
    let cols = try q.read { db in
        try Row.fetchAll(db, sql: "PRAGMA table_info(telemetry_samples)").map { $0["name"] as String }
    }
    try assertTrue(!cols.contains("synced_at"), "telemetry_samples NÃO deve ter synced_at")
    try assertTrue(cols.contains("uploaded_at"), "telemetry_samples deve ter uploaded_at")
}

step("PERSIST-03: todas tabelas (exceto telemetry_samples, sync_queue, sync_meta) têm synced_at") {
    let q = try DB.makeMemoryQueue()
    let tables = try q.read { db in
        try String.fetchAll(db, sql:
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'grdb_%'"
        )
    }
    let semSyncedAt: Set<String> = ["telemetry_samples", "sync_queue", "sync_meta"]
    for name in tables where !semSyncedAt.contains(name) {
        let cols = try q.read { db in
            try Row.fetchAll(db, sql: "PRAGMA table_info(\(name))").map { $0["name"] as String }
        }
        try assertTrue(cols.contains("synced_at"), "tabela \(name) deve ter synced_at")
    }
}

step("PERSIST-04: insert + fetch carro com fonte_temperatura default 'motor'") {
    let q = try makeTestDB()
    try q.write { db in
        var c = Carro(id: "carro-1", timeId: "team-1", apelido: "Civic Si")
        try c.insert(db)
    }
    let fetched = try q.read { db in try Carro.fetchOne(db, key: "carro-1") }
    try assertTrue(fetched != nil, "carro deve existir")
    try assertEq(fetched!.apelido, "Civic Si")
    try assertEq(fetched!.fonteTemperatura, .motor)
    try assertTrue(fetched!.syncedAt == nil, "synced_at deve ser nil ao criar")
}

step("PERSIST-05: insert sessao com voltas_planejadas (ghost-map)") {
    let q = try makeTestDB()
    try q.write { db in
        var s = Sessao(id: "sess-1", timeId: "team-1", voltasPlanejadas: 12)
        try s.insert(db)
    }
    let fetched = try q.read { db in try Sessao.fetchOne(db, key: "sess-1") }
    try assertEq(fetched!.voltasPlanejadas, 12)
}

step("PERSIST-06: sessao com voltas_planejadas=0 viola CHECK constraint") {
    let q = try makeTestDB()
    var pegou = false
    do {
        try q.write { db in
            var s = Sessao(id: "sess-bad", timeId: "team-1", voltasPlanejadas: 0)
            try s.insert(db)
        }
    } catch {
        pegou = true
    }
    try assertTrue(pegou, "esperava CHECK constraint violation pra voltas_planejadas=0")
}

step("PERSIST-07: marco aceita pit-in e pit-out") {
    let q = try makeTestDB()
    try q.write { db in
        var l = TrackLayoutRow(id: "layout-1", trackId: "track-1", nome: "Principal")
        try l.insert(db)
        var pin = Marco(id: "m-pin", layoutId: "layout-1", tipo: .pitIn, posicao: "{\"x\":0,\"y\":0}")
        try pin.insert(db)
        var pout = Marco(id: "m-pout", layoutId: "layout-1", tipo: .pitOut, posicao: "{\"x\":1,\"y\":1}")
        try pout.insert(db)
    }
    let count = try q.read { db in try Marco.fetchCount(db) }
    try assertEq(count, 2)
}

step("PERSIST-08: marco com tipo inválido ('saida') é rejeitado pelo CHECK") {
    let q = try makeTestDB()
    try q.write { db in
        var l = TrackLayoutRow(id: "layout-1", trackId: "track-1", nome: "Principal")
        try l.insert(db)
    }
    var pegou = false
    do {
        try q.write { db in
            try db.execute(sql: """
                INSERT INTO marcos (id, layout_id, tipo, posicao, created_at, updated_at)
                VALUES ('bad', 'layout-1', 'saida', '{}', 0, 0)
            """)
        }
    } catch {
        pegou = true
    }
    try assertTrue(pegou, "esperava CHECK violation pra tipo inválido")
}

step("PERSIST-09: reta_especial com auto_detectada default false") {
    let q = try makeTestDB()
    try q.write { db in
        var l = TrackLayoutRow(id: "layout-1", trackId: "track-1", nome: "Principal")
        try l.insert(db)
        var seg = TrackSegmentRow(id: "seg-1", layoutId: "layout-1", ordem: 1, ehTrecho: false)
        try seg.insert(db)
        var r = RetaEspecial(id: "reta-1", trackId: "track-1", segmentId: "seg-1", tempoMedioMs: 18500)
        try r.insert(db)
    }
    let fetched = try q.read { db in try RetaEspecial.fetchOne(db, key: "reta-1") }
    try assertEq(fetched!.autoDetectada, false)
    try assertEq(fetched!.tempoMedioMs, 18500)
}

step("PERSIST-10: insert telemetry_sample (id auto-incremento, sem synced_at)") {
    let q = try makeTestDB()
    try q.write { db in
        var s = Sessao(id: "sess-1", timeId: "team-1")
        try s.insert(db)
        for seq in 0..<3 {
            var ts = TelemetrySample(timeId: "team-1", sessaoId: "sess-1",
                                     seq: seq, t: Int64(seq) * 100, payload: "{}")
            try ts.insert(db)
        }
    }
    let count = try q.read { db in try TelemetrySample.fetchCount(db) }
    try assertEq(count, 3)
}

step("PERSIST-11: SyncQueue.markSynced atualiza synced_at do registro") {
    let q = try makeTestDB()
    try q.write { db in
        var c = Carro(id: "carro-1", timeId: "team-1", apelido: "Civic")
        try c.insert(db)
    }
    try q.write { db in
        try SyncQueue.markSynced(db, tableName: "carros", rowId: "carro-1", at: 9999)
    }
    let fetched = try q.read { db in try Carro.fetchOne(db, key: "carro-1") }
    try assertEq(fetched!.syncedAt, 9999)
}

step("PERSIST-12: SyncQueue.listPending retorna só não-sincronizados") {
    let q = try makeTestDB()
    try q.write { db in
        var c1 = Carro(id: "c-1", timeId: "team-1", apelido: "A", syncedAt: 100)
        try c1.insert(db)
        var c2 = Carro(id: "c-2", timeId: "team-1", apelido: "B")  // syncedAt=nil
        try c2.insert(db)
        var c3 = Carro(id: "c-3", timeId: "team-1", apelido: "C")  // syncedAt=nil
        try c3.insert(db)
    }
    let pendentes = try q.read { db in try SyncQueue.listPending(db, type: Carro.self) }
    try assertEq(pendentes.count, 2)
    let ids = Set(pendentes.map { $0.id })
    try assertTrue(ids == ["c-2", "c-3"], "esperava {c-2, c-3}, recebi \(ids)")
}

step("PERSIST-13: SyncQueue.enqueue + pendingCount + drain") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-1", op: .insert, payload: "{}")
        try SyncQueue.enqueue(db, tableName: "sessoes", rowId: "s-1", op: .update, payload: "{}")
    }
    let countAntes = try q.read { db in try SyncQueue.pendingCount(db) }
    try assertEq(countAntes, 2)

    // Drena o primeiro item
    let firstId = try q.read { db in
        try Int64.fetchOne(db, sql: "SELECT id FROM sync_queue ORDER BY id ASC LIMIT 1")!
    }
    try q.write { db in try SyncQueue.drain(db, id: firstId) }
    let countDepois = try q.read { db in try SyncQueue.pendingCount(db) }
    try assertEq(countDepois, 1)
}

step("PERSIST-14: SyncQueue.incrementAttempts incrementa contador") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-1", op: .insert)
    }
    let id = try q.read { db in
        try Int64.fetchOne(db, sql: "SELECT id FROM sync_queue LIMIT 1")!
    }
    try q.write { db in
        try SyncQueue.incrementAttempts(db, id: id)
        try SyncQueue.incrementAttempts(db, id: id)
    }
    let attempts = try q.read { db in
        try Int.fetchOne(db, sql: "SELECT attempts FROM sync_queue WHERE id = ?", arguments: [id])!
    }
    try assertEq(attempts, 2)
}

step("PERSIST-15: foreign keys habilitadas — insert com time_id inválido falha") {
    let q = try DB.makeMemoryQueue()
    var pegou = false
    do {
        try q.write { db in
            var c = Carro(id: "c-1", timeId: "team-INEXISTENTE", apelido: "X")
            try c.insert(db)
        }
    } catch {
        pegou = true
    }
    try assertTrue(pegou, "esperava FK violation")
}

step("PERSIST-16: migrator é idempotente (rodar de novo não falha)") {
    let q = try DB.makeMemoryQueue()
    // Roda migrator de novo na mesma queue — deve ser no-op
    try DB.migrator.migrate(q)
    let count = try q.read { db in
        try Int.fetchOne(db, sql:
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='carros'"
        ) ?? 0
    }
    try assertEq(count, 1)
}

// ─── DRAINER (Sprint 1A.6 sub-prompt B) ──────────────────────
// Mock transport: configurado por teste pra retornar o que quisermos.
final class MockSyncTransport: SyncTransport {
    var nextResult: SyncResult = SyncResult(accepted: [], rejected: [])
    var lastSent: [SyncRequestRow] = []
    var sendError: Error?

    func send(_ rows: [SyncRequestRow]) throws -> SyncResult {
        lastSent = rows
        if let e = sendError { throw e }
        return nextResult
    }
}

step("DRAIN-01: drainBatch sem pendentes retorna outcome zero") {
    let q = try makeTestDB()
    let mock = MockSyncTransport()
    let out = try SyncDrainer.drainBatch(q, transport: mock)
    try assertEq(out.processedCount, 0)
    try assertEq(out.acceptedCount, 0)
    try assertEq(out.rejectedCount, 0)
    try assertTrue(mock.lastSent.isEmpty, "transport não devia ter sido chamado")
}

step("DRAIN-02: 2 itens enfileirados, ambos accepted → drained + markSynced") {
    let q = try makeTestDB()
    // Insere 1 carro real (pra markSynced atualizar coluna existente)
    try q.write { db in
        var c = Carro(id: "c-drain-1", timeId: "team-1", apelido: "Celta drain")
        try c.insert(db)
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-drain-1", op: .insert,
                              payload: "{\"time_id\":\"team-1\",\"apelido\":\"Celta drain\"}")
        try SyncQueue.enqueue(db, tableName: "sessoes", rowId: "s-drain-1", op: .delete)
    }

    let mock = MockSyncTransport()
    mock.nextResult = SyncResult(accepted: ["c-drain-1", "s-drain-1"], rejected: [])

    let out = try SyncDrainer.drainBatch(q, transport: mock)
    try assertEq(out.processedCount, 2)
    try assertEq(out.acceptedCount, 2)
    try assertEq(out.rejectedCount, 0)

    // sync_queue agora vazia
    let pending = try q.read { db in try SyncQueue.pendingCount(db) }
    try assertEq(pending, 0)

    // carros.synced_at atualizado
    let syncedAt = try q.read { db in
        try Int64.fetchOne(db, sql: "SELECT synced_at FROM carros WHERE id = ?", arguments: ["c-drain-1"])
    }
    try assertTrue(syncedAt != nil && syncedAt! > 0, "synced_at não foi setado")
}

step("DRAIN-03: rejected (stale-write) incrementa attempts, mantém na fila") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-stale", op: .update, payload: "{}")
    }
    let mock = MockSyncTransport()
    mock.nextResult = SyncResult(
        accepted: [],
        rejected: [SyncRejected(row_id: "c-stale", table_name: "carros", reason: "stale-write")]
    )

    let out = try SyncDrainer.drainBatch(q, transport: mock)
    try assertEq(out.processedCount, 1)
    try assertEq(out.rejectedCount, 1)
    try assertEq(out.acceptedCount, 0)

    let attempts = try q.read { db in
        try Int.fetchOne(db, sql: "SELECT attempts FROM sync_queue WHERE row_id = 'c-stale'")
    }
    try assertEq(attempts, 1)
}

step("DRAIN-04: maxAttempts excluí dead-letters do próximo batch") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-dead", op: .insert, payload: "{}")
        // Força attempts = 5 (limite default)
        try db.execute(sql: "UPDATE sync_queue SET attempts = 5 WHERE row_id = 'c-dead'")
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-vivo", op: .insert, payload: "{}")
    }
    let mock = MockSyncTransport()
    mock.nextResult = SyncResult(accepted: ["c-vivo"], rejected: [])

    let out = try SyncDrainer.drainBatch(q, transport: mock)
    try assertEq(out.processedCount, 1, "deve processar só c-vivo, não c-dead")
    try assertEq(out.acceptedCount, 1)

    // c-dead permanece na fila
    let dlCount = try SyncDrainer.deadLetterCount(q)
    try assertEq(dlCount, 1)
}

step("DRAIN-05: transport throw propaga sem mexer em sync_queue") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-net-fail", op: .insert, payload: "{}")
    }
    let mock = MockSyncTransport()
    struct NetErr: Error {}
    mock.sendError = NetErr()

    var pegou = false
    do { _ = try SyncDrainer.drainBatch(q, transport: mock) }
    catch { pegou = true }
    try assertTrue(pegou, "esperava propagação do erro")

    // sync_queue inalterada (item ainda lá, attempts ainda 0)
    let attempts = try q.read { db in
        try Int.fetchOne(db, sql: "SELECT attempts FROM sync_queue WHERE row_id = 'c-net-fail'")
    }
    try assertEq(attempts, 0)
}

step("CURSOR-01: PullCursor.get retorna 0 pra tabela nunca sincronizada") {
    let q = try makeTestDB()
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(cursor, 0)
}

step("CURSOR-02: PullCursor.set + get faz roundtrip") {
    let q = try makeTestDB()
    try q.write { db in try PullCursor.set(db, tableName: "carros", lastSyncAt: 1714693200000) }
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(cursor, 1714693200000)
}

step("CURSOR-03: PullCursor.set sobrescreve cursor existente (upsert)") {
    let q = try makeTestDB()
    try q.write { db in
        try PullCursor.set(db, tableName: "sessoes", lastSyncAt: 100)
        try PullCursor.set(db, tableName: "sessoes", lastSyncAt: 200)
    }
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "sessoes") }
    try assertEq(cursor, 200)
}

step("CURSOR-04: PullCursor.all lista cursors ordenados por table_name") {
    let q = try makeTestDB()
    try q.write { db in
        try PullCursor.set(db, tableName: "voltas", lastSyncAt: 300)
        try PullCursor.set(db, tableName: "carros", lastSyncAt: 100)
        try PullCursor.set(db, tableName: "sessoes", lastSyncAt: 200)
    }
    let all = try q.read { db in try PullCursor.all(db) }
    try assertEq(all.count, 3)
    try assertEq(all[0].tableName, "carros")
    try assertEq(all[1].tableName, "sessoes")
    try assertEq(all[2].tableName, "voltas")
}

step("CURSOR-05: PullCursor.resetAll zera todos os cursors") {
    let q = try makeTestDB()
    try q.write { db in
        try PullCursor.set(db, tableName: "carros", lastSyncAt: 100)
        try PullCursor.set(db, tableName: "sessoes", lastSyncAt: 200)
        try PullCursor.resetAll(db)
    }
    let all = try q.read { db in try PullCursor.all(db) }
    try assertEq(all.count, 0)
    let stillCarros = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(stillCarros, 0)
}

step("DRAIN-06: SyncRequestRow shape — insert sem row_id, update com client_updated_at") {
    let q = try makeTestDB()
    try q.write { db in
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-i", op: .insert, payload: "{\"x\":1}")
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-u", op: .update, payload: "{\"y\":2}")
        try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-d", op: .delete)
    }
    let mock = MockSyncTransport()
    mock.nextResult = SyncResult(accepted: [], rejected: [])
    _ = try SyncDrainer.drainBatch(q, transport: mock)

    let insertRow = mock.lastSent.first(where: { $0.op == "insert" })!
    try assertTrue(insertRow.row_id == nil, "insert não deve mandar row_id")
    try assertTrue(insertRow.payload != nil, "insert deve mandar payload")
    try assertTrue(insertRow.client_updated_at == nil, "insert não usa LWW")

    let updateRow = mock.lastSent.first(where: { $0.op == "update" })!
    try assertTrue(updateRow.row_id == "c-u", "update precisa de row_id")
    try assertTrue(updateRow.payload != nil, "update deve mandar payload")
    try assertTrue(updateRow.client_updated_at != nil, "update deve mandar client_updated_at (LWW)")

    let deleteRow = mock.lastSent.first(where: { $0.op == "delete" })!
    try assertTrue(deleteRow.row_id == "c-d", "delete precisa de row_id")
    try assertTrue(deleteRow.payload == nil, "delete não deve mandar payload")
}

// ─── BACKOFF (Sprint 1A.6 — primitive) ───────────────────────
step("BACKOFF-01: default policy tem 4 attempts (0, 30, 120, 600s)") {
    let p = BackoffPolicy.default
    try assertEq(p.maxAttempts, 4)
    try assertEq(p.baseDelaysSeconds[0], 0)
    try assertEq(p.baseDelaysSeconds[1], 30)
    try assertEq(p.baseDelaysSeconds[2], 120)
    try assertEq(p.baseDelaysSeconds[3], 600)
}

step("BACKOFF-02: nextDelay attempt=0 retorna 0 (imediato)") {
    let d = BackoffPolicy.default.nextDelay(attempts: 0, rng: { 0.5 })
    try assertEq(d, 0)
}

step("BACKOFF-03: nextDelay aplica jitter ±33%") {
    let p = BackoffPolicy.default
    // rng=0.0 → jitter mínimo (-33%); rng=1.0 → jitter máximo (+33%)
    let dMin = p.nextDelay(attempts: 1, rng: { 0.0 })!  // 30 * (1 - 0.33) = 20.1
    let dMax = p.nextDelay(attempts: 1, rng: { 1.0 })!  // 30 * (1 + 0.33) = 39.9
    try assertTrue(abs(dMin - 20.1) < 0.001, "min=\(dMin)")
    try assertTrue(abs(dMax - 39.9) < 0.001, "max=\(dMax)")
}

step("BACKOFF-04: nextDelay attempts >= maxAttempts retorna nil (dead-letter)") {
    let p = BackoffPolicy.default
    try assertTrue(p.nextDelay(attempts: 4, rng: { 0.5 }) == nil, "esperava nil em attempt=4")
    try assertTrue(p.nextDelay(attempts: 99, rng: { 0.5 }) == nil, "esperava nil em attempt=99")
}

step("BACKOFF-05: isDeadLetter consistente com nextDelay nil") {
    let p = BackoffPolicy.default
    try assertEq(p.isDeadLetter(attempts: 0), false)
    try assertEq(p.isDeadLetter(attempts: 3), false)
    try assertEq(p.isDeadLetter(attempts: 4), true)
    try assertEq(p.isDeadLetter(attempts: 5), true)
}

step("BACKOFF-06: policy custom respeita base delays") {
    let p = BackoffPolicy(baseDelaysSeconds: [0, 5, 60], jitterRatio: 0)
    try assertEq(p.maxAttempts, 3)
    try assertEq(p.nextDelay(attempts: 1, rng: { 0.5 }), 5)
    try assertEq(p.nextDelay(attempts: 2, rng: { 0.5 }), 60)
    try assertTrue(p.nextDelay(attempts: 3, rng: { 0.5 }) == nil, "attempt=3 dead-letter")
}

// ─── TELEMETRY UPLOADER (Sprint 1A.6) ────────────────────────
final class MockTelemetryTransport: TelemetryTransport {
    var nextResult: IngestResult = IngestResult(accepted: 0, rejected: 0)
    var lastUploaded: [IngestRequest] = []
    var uploadError: Error?

    func upload(_ request: IngestRequest) throws -> IngestResult {
        lastUploaded.append(request)
        if let e = uploadError { throw e }
        return nextResult
    }
}

step("UPLOAD-01: upload sem pendentes retorna outcome zero") {
    let q = try makeTestDB()
    let mock = MockTelemetryTransport()
    let out = try TelemetryUploader.upload(q, transport: mock)
    try assertEq(out.processedCount, 0)
    try assertEq(out.chunksUploaded, 0)
    try assertTrue(mock.lastUploaded.isEmpty, "transport não devia ter sido chamado")
}

step("UPLOAD-02: upload manda chunks de 1000 + marca uploaded_at") {
    let q = try makeTestDB()
    // Cria sessão (FK requerido pra telemetry_samples)
    try q.write { db in
        var s = Sessao(id: "ses-1", timeId: "team-1")
        try s.insert(db)
    }
    // Insere 2500 samples (3 chunks: 1000 + 1000 + 500)
    try q.write { db in
        for i in 0..<2500 {
            var s = TelemetrySample(
                timeId: "team-1", sessaoId: "ses-1", seq: i,
                t: 1_700_000_000_000 + Int64(i),
                tMono: Double(i),
                payload: "{\"source\":\"test\",\"signalQuality\":\"GOOD\"}"
            )
            try s.insert(db)
        }
    }

    let mock = MockTelemetryTransport()
    mock.nextResult = IngestResult(accepted: 1000, rejected: 0)

    let out = try TelemetryUploader.upload(q, transport: mock)
    try assertEq(out.processedCount, 2500)
    try assertEq(out.chunksUploaded, 3)
    try assertEq(out.acceptedCount, 3000)  // 1000 × 3 chunks (mock retorna 1000 cada, ok pra teste)

    // Todos marcados como uploaded
    let pending = try TelemetryUploader.pendingCount(q)
    try assertEq(pending, 0)
}

step("UPLOAD-03: filtra por sessionId quando especificado") {
    let q = try makeTestDB()
    try q.write { db in
        var sA = Sessao(id: "ses-A", timeId: "team-1"); try sA.insert(db)
        var sB = Sessao(id: "ses-B", timeId: "team-1"); try sB.insert(db)
    }
    try q.write { db in
        for sid in ["ses-A", "ses-B"] {
            for i in 0..<10 {
                var s = TelemetrySample(
                    timeId: "team-1", sessaoId: sid, seq: i,
                    t: Int64(i), payload: "{\"source\":\"x\",\"signalQuality\":\"GOOD\"}"
                )
                try s.insert(db)
            }
        }
    }

    let mock = MockTelemetryTransport()
    mock.nextResult = IngestResult(accepted: 10, rejected: 0)

    let out = try TelemetryUploader.upload(q, sessionId: "ses-A", transport: mock)
    try assertEq(out.processedCount, 10)

    // ses-B continua pendente
    let pendingB = try TelemetryUploader.pendingCount(q, sessionId: "ses-B")
    try assertEq(pendingB, 10)
    let pendingA = try TelemetryUploader.pendingCount(q, sessionId: "ses-A")
    try assertEq(pendingA, 0)
}

step("UPLOAD-04: transport throw NÃO marca uploaded_at") {
    let q = try makeTestDB()
    try q.write { db in
        var s = Sessao(id: "ses-fail", timeId: "team-1"); try s.insert(db)
    }
    try q.write { db in
        for i in 0..<5 {
            var s = TelemetrySample(
                timeId: "team-1", sessaoId: "ses-fail", seq: i,
                t: Int64(i), payload: "{\"source\":\"x\",\"signalQuality\":\"GOOD\"}"
            )
            try s.insert(db)
        }
    }

    let mock = MockTelemetryTransport()
    struct NetErr: Error {}
    mock.uploadError = NetErr()

    var pegou = false
    do { _ = try TelemetryUploader.upload(q, transport: mock) }
    catch { pegou = true }
    try assertTrue(pegou, "esperava erro propagado")

    let pending = try TelemetryUploader.pendingCount(q)
    try assertEq(pending, 5)
}

step("UPLOAD-05: chunk-id é determinístico (sessionId-firstSeq-lastSeq)") {
    let q = try makeTestDB()
    try q.write { db in
        var s = Sessao(id: "ses-X", timeId: "team-1"); try s.insert(db)
    }
    try q.write { db in
        for i in 100..<105 {
            var s = TelemetrySample(
                timeId: "team-1", sessaoId: "ses-X", seq: i,
                t: Int64(i), payload: "{\"source\":\"x\",\"signalQuality\":\"GOOD\"}"
            )
            try s.insert(db)
        }
    }
    let mock = MockTelemetryTransport()
    mock.nextResult = IngestResult(accepted: 5, rejected: 0)
    _ = try TelemetryUploader.upload(q, transport: mock, chunkSize: 10)
    try assertEq(mock.lastUploaded.count, 1)
    try assertEq(mock.lastUploaded[0].chunkId, "ses-X-100-104")
    try assertEq(mock.lastUploaded[0].sessionId, "ses-X")
    try assertEq(mock.lastUploaded[0].samples.count, 5)
}

// ─── PULL EXECUTOR (Sprint 1A.6 sub-prompt E — fechamento do loop) ──
final class MockPullTransport: PullTransport {
    var nextResponse: PullResponse = PullResponse(rows: [:], max_updated_at: [:])
    var lastRequest: PullRequest?
    var pullError: Error?

    func pull(_ request: PullRequest) throws -> PullResponse {
        lastRequest = request
        if let e = pullError { throw e }
        return nextResponse
    }
}

step("PULLEX-01: runOnce sem rows recebidas não muda nada") {
    let q = try makeTestDB()
    let mock = MockPullTransport()
    let out = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock)
    try assertEq(out.totalRowsApplied, 0)
    try assertEq(out.cursorsAdvanced, 0)
    try assertTrue(mock.lastRequest != nil, "transport devia ser chamado")
    try assertEq(mock.lastRequest!.tables, ["carros"])
}

step("PULLEX-02: runOnce com 1 row aplica UPSERT + atualiza cursor") {
    let q = try makeTestDB()
    let mock = MockPullTransport()
    let row = PullRow(
        id: "carro-pull-1",
        updatedAtMs: 1714693300000,
        payload: [
            "time_id": AnyCodable("team-1"),
            "apelido": AnyCodable("Celta puxado"),
            "modelo": AnyCodable("Chevrolet Celta"),
            "fonte_temperatura": AnyCodable("motor"),
            "created_at": AnyCodable(Int64(1714693200000)),
            "updated_at": AnyCodable(Int64(1714693300000)),
        ]
    )
    mock.nextResponse = PullResponse(
        rows: ["carros": [row]],
        max_updated_at: ["carros": 1714693300000]
    )

    let out = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock)
    try assertEq(out.totalRowsApplied, 1)
    try assertEq(out.cursorsAdvanced, 1)

    // Cursor avançou
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(cursor, 1714693300000)

    // Carro existe no GRDB
    let carro = try q.read { db in try Carro.fetchOne(db, key: "carro-pull-1") }
    try assertTrue(carro != nil, "carro não foi inserido")
    try assertEq(carro?.apelido, "Celta puxado")
    // synced_at foi setado (server already has it)
    try assertTrue(carro?.syncedAt != nil, "synced_at não foi marcado")
}

step("PULLEX-03: runOnce subsequente envia cursor anterior como `since`") {
    let q = try makeTestDB()
    try q.write { db in
        try PullCursor.set(db, tableName: "carros", lastSyncAt: 99999)
    }
    let mock = MockPullTransport()
    _ = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock)
    try assertEq(mock.lastRequest?.since["carros"], 99999)
}

step("PULLEX-04: UPSERT — 2ª chamada com mesma id atualiza row existente") {
    let q = try makeTestDB()
    // Insere 1 carro local
    try q.write { db in
        var c = Carro(id: "carro-up", timeId: "team-1", apelido: "Original")
        try c.insert(db)
    }
    // Pull traz a mesma id com apelido novo
    let mock = MockPullTransport()
    let row = PullRow(
        id: "carro-up",
        updatedAtMs: 1714693400000,
        payload: [
            "time_id": AnyCodable("team-1"),
            "apelido": AnyCodable("Atualizado pelo pull"),
            "fonte_temperatura": AnyCodable("motor"),
            "created_at": AnyCodable(Int64(1714693200000)),
            "updated_at": AnyCodable(Int64(1714693400000)),
        ]
    )
    mock.nextResponse = PullResponse(
        rows: ["carros": [row]],
        max_updated_at: ["carros": 1714693400000]
    )
    _ = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock)

    let carro = try q.read { db in try Carro.fetchOne(db, key: "carro-up") }
    try assertEq(carro?.apelido, "Atualizado pelo pull")
}

step("PULLEX-05: has_more reporta tabelas com paginação pendente") {
    let q = try makeTestDB()
    let mock = MockPullTransport()
    mock.nextResponse = PullResponse(
        rows: ["carros": [], "sessoes": []],
        max_updated_at: ["carros": 0, "sessoes": 0],
        has_more: ["carros": true, "sessoes": false]
    )
    let out = try PullExecutor.runOnce(q, tables: ["carros", "sessoes"], transport: mock)
    try assertEq(out.tablesWithMore, ["carros"])
}

step("PULLEX-06: transport throw propaga sem mexer em cursor") {
    let q = try makeTestDB()
    try q.write { db in try PullCursor.set(db, tableName: "carros", lastSyncAt: 100) }
    let mock = MockPullTransport()
    struct NetErr: Error {}
    mock.pullError = NetErr()

    var pegou = false
    do { _ = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock) }
    catch { pegou = true }
    try assertTrue(pegou, "esperava propagação")

    // Cursor inalterado
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(cursor, 100)
}

step("PULLEX-07: cursor NÃO retrocede mesmo se max_updated_at vier menor") {
    let q = try makeTestDB()
    try q.write { db in try PullCursor.set(db, tableName: "carros", lastSyncAt: 5000) }
    let mock = MockPullTransport()
    mock.nextResponse = PullResponse(
        rows: ["carros": []],
        max_updated_at: ["carros": 1000]  // menor que cursor atual
    )
    let out = try PullExecutor.runOnce(q, tables: ["carros"], transport: mock)
    try assertEq(out.cursorsAdvanced, 0)
    let cursor = try q.read { db in try PullCursor.get(db, tableName: "carros") }
    try assertEq(cursor, 5000)
}

// ── relatório ────────────────────────────────────────────────
print("\n═══ RESULTADO ═══")
print("\(ok) ok / \(fail) fail")
exit(fail == 0 ? 0 : 1)
