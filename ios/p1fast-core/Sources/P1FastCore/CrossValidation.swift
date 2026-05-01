// ═══════════════════════════════════════════════════════════
// CrossValidation — port completo V-001 .. V-011 (P1)
// ═══════════════════════════════════════════════════════════
// Port de src/telemetry/cross-validation.js. docs/raceops/CROSS_VALIDATION_RULES.md
// governa. Port 1:1 com JS — mesmas janelas, thresholds, mensagens, severidades.
//
// V-009 é derivada (corner-by-corner), não snapshot-by-snapshot — fica fora aqui.
//
// Decisões Swift:
//  * `gearMap` aceita override no init (default Celta 1.4 — ver JS).
//  * `circumscribedRadius` em metros locais (lat→m × cos(lat)) igual ao JS.
//  * Cooldown é POR validação (não por severity) — mesmo design do JS:
//    se atencao emite primeiro, critico no mesmo `validation` é silenciado
//    até o cooldown expirar. Smoke documenta isso.

import Foundation

public enum ValidationSeverity: String, Codable, Sendable {
    case info
    case atencao
    case critico
}

public struct ValidationEvent: Codable, Sendable, Equatable {
    public let validation: String   // "V-001", "V-002", ...
    public let severity: ValidationSeverity
    public let message: String
    public let channels: [String]
    public let hypothesis: String
    public let action: String
    public let t: Int64
    public let tMono: Double
}

/// State machine pra janela mínima sustentada.
final class WindowState {
    let minMs: Double
    var startedAt: Double?
    init(minMs: Double) { self.minMs = minMs }
    /// Retorna true quando passou minMs sustentado.
    func enter(_ tMono: Double) -> Bool {
        if startedAt == nil { startedAt = tMono }
        return (tMono - (startedAt ?? tMono)) >= minMs
    }
    func exit() { startedAt = nil }
}

public final class CrossValidationEngine {
    public typealias OnEvent = (ValidationEvent) -> Void

    private var onEvent: OnEvent?
    private let cooldownMs: Double
    private var lastEmittedAt: [String: Double] = [:]

    private let v001Window = WindowState(minMs: 2000)
    private let v002Window = WindowState(minMs: 1000)
    private let v003Window = WindowState(minMs: 500)
    private let v004Window = WindowState(minMs: 1000)
    private let v005Window = WindowState(minMs: 60_000)
    private let v006Window = WindowState(minMs: 2000)
    private let v007Window = WindowState(minMs: 1000)
    private let v007bWindow = WindowState(minMs: 5000)
    private let v008Window = WindowState(minMs: 2000)

    private var lastSpeed: Double?
    private var lastTMono: Double?

    /// Histórico de temperatura água — janela móvel 5min pra V-005.
    private struct TempPoint { let t: Double; let v: Double }
    private var tempHistory: [TempPoint] = []

    /// Histórico de posição — janela móvel 1.5s pra V-011.
    private struct PosPoint { let t: Double; let lat: Double; let lon: Double; let speed: Double }
    private var posHistory: [PosPoint] = []

    /// Mapa marcha → km/h por 1000 RPM (Celta 1.4 default — ver CROSS_VALIDATION_RULES).
    private let gearMap: [Int: Double]

    public init(
        onEvent: OnEvent? = nil,
        cooldownMs: Double = 30_000,
        gearMap: [Int: Double]? = nil
    ) {
        self.onEvent = onEvent
        self.cooldownMs = cooldownMs
        self.gearMap = gearMap ?? [1: 10, 2: 20, 3: 28, 4: 35, 5: 42, 6: 50]
    }

    public func reset() {
        lastEmittedAt.removeAll()
        v001Window.exit(); v002Window.exit(); v003Window.exit(); v004Window.exit()
        v005Window.exit(); v006Window.exit(); v007Window.exit(); v007bWindow.exit()
        v008Window.exit()
        lastSpeed = nil
        lastTMono = nil
        tempHistory.removeAll()
        posHistory.removeAll()
    }

    public func consume(_ snap: Snapshot) {
        if snap.tMono <= 0 { return }
        v001(snap)
        v002(snap)
        v003(snap)
        v004(snap)
        v005(snap)
        v006(snap)
        v007(snap)
        v008(snap)
        v010(snap)
        v011(snap)
        lastSpeed = snap.vehicle.speedFused
        lastTMono = snap.tMono
    }

    // ─── V-001 · CAN vs GNSS ──────────────────────────────
    private func v001(_ snap: Snapshot) {
        guard let can = snap.vehicle.speedCan, let gnss = snap.vehicle.speedGnss else {
            v001Window.exit(); return
        }
        let racebox = snap.quality.racebox
        let iphone  = snap.quality.iphone
        if snap.quality.t4000 != .ok || (racebox != .ok && iphone != .ok) {
            v001Window.exit(); return
        }
        let diffKmh = abs((can - gnss) * 3.6)
        if diffKmh > 5 {
            if v001Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-001",
                    severity: .atencao,
                    message: String(format: "Velocidade CAN diverge da GNSS em %.1f km/h por 2s+. Verificar calibração de pneu / sensor de roda.", diffKmh),
                    channels: ["vehicle.speed_can", "vehicle.speed_gnss"],
                    hypothesis: "sensor de velocidade T4000 calibrado errado, circunferência de pneu diferente, slip momentâneo, ou erro GNSS multipath",
                    action: "verificar calibração de pneu/sensor",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v001Window.exit()
        }
    }

    // ─── V-002 · IMU accel_long vs derivada da velocidade ─
    private func v002(_ snap: Snapshot) {
        guard let imu = snap.dynamics.accelLongitudinal, let speed = snap.vehicle.speedFused else {
            v002Window.exit(); return
        }
        if let lastSpeed, let lastT = lastTMono {
            let dt = (snap.tMono - lastT) / 1000.0
            if dt > 0.05 && dt < 1.0 {
                let derivada = (speed - lastSpeed) / dt
                let diff = abs(imu - derivada)
                if diff > 2 {
                    if v002Window.enter(snap.tMono) {
                        emit(ValidationEvent(
                            validation: "V-002",
                            severity: .atencao,
                            message: String(format: "IMU long (%.2f m/s²) diverge da derivada da velocidade (%.2f m/s²) por 1s+.", imu, derivada),
                            channels: ["dynamics.accel_longitudinal"],
                            hypothesis: "IMU calibração errada, frame de referência rotacionado, ou velocidade fundida com erro",
                            action: "validar fixação do iPhone / RaceBox no carro e calibração de eixo",
                            t: snap.t, tMono: snap.tMono
                        ))
                    }
                } else {
                    v002Window.exit()
                }
            }
        }
    }

    // ─── V-003 · TPS × MAP × accel ─────────────────────────
    private func v003(_ snap: Snapshot) {
        guard let tps = snap.engine.tps,
              let map = snap.engine.map,
              let acc = snap.dynamics.accelLongitudinal else {
            v003Window.exit(); return
        }
        let isPedal = tps > 80
        let isMapBaixo = map < 0.6
        let semGanho = acc < 1
        if isPedal && isMapBaixo && semGanho {
            if v003Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-003",
                    severity: .atencao,
                    message: "TPS alto sem ganho de aceleração ou MAP. Verificar tração, combustível, admissão ou sensor.",
                    channels: ["engine.tps", "engine.map", "dynamics.accel_longitudinal"],
                    hypothesis: "perda de tração, falha de bicos, restrição admissão, sensor MAP problemático ou marcha errada",
                    action: "investigar grupo combustão/admissão/tração",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v003Window.exit()
        }
    }

    // ─── V-004 · RPM × marcha × velocidade ─────────────────
    private func v004(_ snap: Snapshot) {
        guard let rpm = snap.engine.rpm,
              let gear = snap.engine.gear,
              let speed = snap.vehicle.speedFused,
              gear != 0 else {
            v004Window.exit(); return
        }
        if rpm < 1500 { v004Window.exit(); return }
        guard let expectedKmhPer1000 = gearMap[gear] else { return }
        let speedKmh = speed * 3.6
        let expectedKmh = (rpm / 1000) * expectedKmhPer1000
        let errPct = abs(speedKmh - expectedKmh) / max(1, expectedKmh)
        if errPct > 0.15 {
            if v004Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-004",
                    severity: .atencao,
                    message: String(format: "Relação RPM × velocidade × marcha fora do esperado (erro %.0f%%). Verificar embreagem, slip ou sensor de marcha.", errPct * 100),
                    channels: ["engine.rpm", "engine.gear", "vehicle.speed_fused"],
                    hypothesis: "patinação de embreagem, marcha incorreta, slip de rodas ou troca de marcha em curso",
                    action: "marcar engine.gear como SUSPECT, investigar transmissão",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v004Window.exit()
        }
    }

    // ─── V-005 · Temperatura água slope ────────────────────
    private func v005(_ snap: Snapshot) {
        guard let tw = snap.engine.waterTemp else { v005Window.exit(); return }
        tempHistory.append(TempPoint(t: snap.tMono, v: tw))
        let cutoff = snap.tMono - 5 * 60_000
        tempHistory = tempHistory.filter { $0.t > cutoff }
        if tempHistory.count < 30 { return }
        guard let first = tempHistory.first, let last = tempHistory.last else { return }
        let dtMin = (last.t - first.t) / 60_000
        if dtMin < 1 { return }
        let slope = (last.v - first.v) / dtMin
        if slope > 0.5 && tw > 75 {
            if v005Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-005",
                    severity: tw > 100 ? .critico : .atencao,
                    message: String(format: "Temperatura da água subindo %.2f°C/min. Atual %.0f°C. Verificar arrefecimento.", slope, tw),
                    channels: ["engine.water_temp"],
                    hypothesis: "falha de arrefecimento, ventoinha desligada, vazamento ou radiador sujo",
                    action: "verificar sistema de arrefecimento",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v005Window.exit()
        }
    }

    // ─── V-006 · Pressão óleo × RPM ────────────────────────
    private func v006(_ snap: Snapshot) {
        guard let press = snap.engine.oilPressure, let rpm = snap.engine.rpm else {
            v006Window.exit(); return
        }
        var expected = rpm / 1000
        if let oilT = snap.engine.oilTemp, oilT > 110 { expected *= 0.85 }
        if press < expected * 0.7 && rpm > 2500 {
            let severity: ValidationSeverity = press < 1.5 ? .critico : .atencao
            if v006Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-006",
                    severity: severity,
                    message: String(format: "Pressão óleo %.1f bar baixa para RPM %.0f (esperado ~%.1f bar). Risco mecânico.", press, rpm, expected),
                    channels: ["engine.oil_pressure", "engine.rpm"],
                    hypothesis: "baixo nível, bomba falhando, óleo diluído (combustível) ou filtro entupido",
                    action: severity == .critico ? "BOX AGORA — risco de pane mecânica" : "monitorar próximas voltas, considerar box",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v006Window.exit()
        }
    }

    // ─── V-007 · Lambda sob carga ──────────────────────────
    private func v007(_ snap: Snapshot) {
        guard let lam = snap.engine.lambda,
              let tps = snap.engine.tps,
              let map = snap.engine.map,
              let rpm = snap.engine.rpm else {
            v007Window.exit(); v007bWindow.exit(); return
        }
        let sobCarga = tps > 70 && map > 0.8 && rpm > 4000
        let pobre = lam > 1.0
        if sobCarga && pobre {
            let t1 = v007Window.enter(snap.tMono)
            let t5 = v007bWindow.enter(snap.tMono)
            if t5 {
                emit(ValidationEvent(
                    validation: "V-007",
                    severity: .critico,
                    message: String(format: "Mistura pobre (λ %.2f) sob carga por 5s+. RISCO DE DETONAÇÃO.", lam),
                    channels: ["engine.lambda", "engine.tps", "engine.map", "engine.rpm"],
                    hypothesis: "mapa de combustível inadequado, pressão de combustível caindo, bicos sujos ou restrição admissão",
                    action: "BOX AGORA — risco de motor",
                    t: snap.t, tMono: snap.tMono
                ))
            } else if t1 {
                emit(ValidationEvent(
                    validation: "V-007",
                    severity: .atencao,
                    message: String(format: "Mistura pobre (λ %.2f) sob carga. Verificar mapa, pressão e bicos.", lam),
                    channels: ["engine.lambda", "engine.tps", "engine.map", "engine.rpm"],
                    hypothesis: "mapa de combustível inadequado ou problema mecânico",
                    action: "monitorar e investigar combustível",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v007Window.exit(); v007bWindow.exit()
        }
    }

    // ─── V-008 · Bateria × RPM ─────────────────────────────
    private func v008(_ snap: Snapshot) {
        guard let v = snap.engine.batteryVoltage, let rpm = snap.engine.rpm else {
            v008Window.exit(); return
        }
        if rpm < 2000 { v008Window.exit(); return }
        if v < 11.5 {
            let severity: ValidationSeverity = v < 10.5 ? .critico : .atencao
            if v008Window.enter(snap.tMono) {
                emit(ValidationEvent(
                    validation: "V-008",
                    severity: severity,
                    message: String(format: "Tensão bateria %.1fV baixa com motor a %.0f RPM (alternador deveria carregar).", v, rpm),
                    channels: ["engine.battery_voltage", "engine.rpm"],
                    hypothesis: "alternador falhando, correia frouxa ou terminal solto",
                    action: severity == .critico ? "BOX AGORA — risco de eletrônica desligar" : "verificar alternador no fim do stint",
                    t: snap.t, tMono: snap.tMono
                ))
            }
        } else {
            v008Window.exit()
        }
    }

    // ─── V-010 · Yaw × accel lateral (sobre/subesterço) ────
    private func v010(_ snap: Snapshot) {
        guard let yaw = snap.dynamics.yawRate, let aLat = snap.dynamics.accelLateral else { return }
        if abs(yaw) > 30 && abs(aLat) < 3 {
            emit(ValidationEvent(
                validation: "V-010",
                severity: .atencao,
                message: String(format: "Yaw alto (%.0f°/s) com baixa aceleração lateral (%.1f m/s²) — possível sobresterço (perda de aderência).", yaw, aLat),
                channels: ["dynamics.yaw_rate", "dynamics.accel_lateral"],
                hypothesis: "sobresterço, perda de aderência traseira ou contra-volante",
                action: "inferência registrada (não fato) — alimentar análise de pilotagem",
                t: snap.t, tMono: snap.tMono
            ))
        }
        if abs(aLat) > 8 && abs(yaw) < 10 {
            emit(ValidationEvent(
                validation: "V-010-b",
                severity: .atencao,
                message: String(format: "Aceleração lateral alta (%.1f m/s²) com yaw baixo — possível subesterço.", aLat),
                channels: ["dynamics.yaw_rate", "dynamics.accel_lateral"],
                hypothesis: "subesterço, perda de aderência dianteira",
                action: "inferência registrada — verificar geometria/pneus",
                t: snap.t, tMono: snap.tMono
            ))
        }
    }

    // ─── V-011 · Accel lateral × raio da trajetória ────────
    private func v011(_ snap: Snapshot) {
        guard let lat = snap.position.lat,
              let lon = snap.position.lon,
              let speed = snap.vehicle.speedFused,
              let aLat = snap.dynamics.accelLateral else { return }
        posHistory.append(PosPoint(t: snap.tMono, lat: lat, lon: lon, speed: speed))
        let cutoff = snap.tMono - 1500
        posHistory = posHistory.filter { $0.t > cutoff }
        if posHistory.count < 5 { return }
        let a = posHistory.first!
        let b = posHistory[posHistory.count / 2]
        let c = posHistory.last!
        guard let r = circumscribedRadius(a, b, c), r >= 5, r <= 1000 else { return }
        let expectedALat = (speed * speed) / r
        let diff = abs(abs(aLat) - expectedALat)
        if diff > expectedALat * 0.3 && expectedALat > 2 {
            emit(ValidationEvent(
                validation: "V-011",
                severity: .info,
                message: String(format: "IMU lateral (%.1f m/s²) diverge do esperado pela trajetória (%.1f m/s²). Verificar calibração.", abs(aLat), expectedALat),
                channels: ["dynamics.accel_lateral", "position.lat", "position.lon"],
                hypothesis: "IMU descalibrado ou trajetória mal-medida",
                action: "marcar accel_lateral como SUSPECT na janela",
                t: snap.t, tMono: snap.tMono
            ))
        }
    }

    /// Raio circunscrito a 3 pontos lat/lon (metros locais aproximados).
    /// Mesma fórmula do JS — válida pra distâncias de pista (km), não global.
    private func circumscribedRadius(_ a: PosPoint, _ b: PosPoint, _ c: PosPoint) -> Double? {
        let m: Double = 111_320
        let cosLat = cos(a.lat * .pi / 180)
        let ax = a.lon * m * cosLat, ay = a.lat * m
        let bx = b.lon * m * cosLat, by = b.lat * m
        let cx = c.lon * m * cosLat, cy = c.lat * m
        let d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
        if abs(d) < 1e-6 { return nil }
        let ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
        let uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
        return hypot(ux - ax, uy - ay)
    }

    private func emit(_ ev: ValidationEvent) {
        if let last = lastEmittedAt[ev.validation], ev.tMono - last < cooldownMs { return }
        lastEmittedAt[ev.validation] = ev.tMono
        onEvent?(ev)
    }
}
