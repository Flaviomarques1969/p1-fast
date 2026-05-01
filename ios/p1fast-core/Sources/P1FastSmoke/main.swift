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
