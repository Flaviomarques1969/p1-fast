// ═══════════════════════════════════════════════════════════
// CrossValidation — port de V-001 .. V-002 (P1)
// ═══════════════════════════════════════════════════════════
// Port parcial de src/telemetry/cross-validation.js. Cobre as 2
// regras já exercitadas no harness Node + smokes JS oficiais:
//   V-001 — speed CAN vs speed GNSS divergente > 5 km/h por 2s+
//   V-002 — IMU accel_long vs derivada da velocidade divergente > 2 m/s² por 1s+
//
// Resto do catálogo (V-003..V-011) entra quando precisar — mesmo padrão.
// docs/raceops/CROSS_VALIDATION_RULES.md governa.

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

    private var lastSpeed: Double?
    private var lastTMono: Double?

    public init(onEvent: OnEvent? = nil, cooldownMs: Double = 30_000) {
        self.onEvent = onEvent
        self.cooldownMs = cooldownMs
    }

    public func reset() {
        lastEmittedAt.removeAll()
        v001Window.exit()
        v002Window.exit()
        lastSpeed = nil
        lastTMono = nil
    }

    public func consume(_ snap: Snapshot) {
        if snap.tMono <= 0 { return }
        v001(snap)
        v002(snap)
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

    private func emit(_ ev: ValidationEvent) {
        if let last = lastEmittedAt[ev.validation], ev.tMono - last < cooldownMs { return }
        lastEmittedAt[ev.validation] = ev.tMono
        onEvent?(ev)
    }
}
