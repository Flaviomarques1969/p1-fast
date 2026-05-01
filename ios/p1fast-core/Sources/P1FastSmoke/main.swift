// ═══════════════════════════════════════════════════════════
// p1fast-smoke — harness Swift validando paridade vs pipeline JS
// ═══════════════════════════════════════════════════════════
// Roda com: swift run p1fast-smoke
// Sem XCTest/Testing — só Foundation + asserts manuais.
// Cada bloco espelha um teste do pipeline JS.

import Foundation
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
// Quality — DQ-01 .. DQ-06 (espelha node-smoke-telemetry-p0.mjs)
// ════════════════════════════════════════════════════════════

step("DQ-01: 11 categorias canônicas") {
    try assertEq(Quality.allCases.count, 11)
}

step("DQ-02: fromSignalQuality 4-cat → 11-cat") {
    try assertEq(Quality.fromSignalQuality("GOOD"),     .ok)
    try assertEq(Quality.fromSignalQuality("DEGRADED"), .suspect)
    try assertEq(Quality.fromSignalQuality("BAD"),      .lowConfidence)
    try assertEq(Quality.fromSignalQuality("LOST"),     .missing)
    try assertEq(Quality.fromSignalQuality("WAT"),      .missing)
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
}

step("DQ-06: isOk + permitsCritical respeitam Regra 4") {
    try assertTrue(Quality.ok.isOk)
    try assertTrue(!Quality.suspect.isOk)
    try assertTrue(Quality.ok.permitsCritical)
    try assertTrue(!Quality.lowConfidence.permitsCritical)
    try assertTrue(!Quality.missing.permitsCritical)
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
        quality: SnapshotQuality(t4000: .ok, racebox: .ok, iphone: .ok, sync: .ok, confidence: "Alta")
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

// ── relatório ────────────────────────────────────────────────
print("\n═══ RESULTADO ═══")
print("\(ok) ok / \(fail) fail")
exit(fail == 0 ? 0 : 1)
