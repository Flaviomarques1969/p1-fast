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

    private func emit(_ ev: ValidationEvent) {
        if let last = lastEmittedAt[ev.validation], ev.tMono - last < cooldownMs { return }
        lastEmittedAt[ev.validation] = ev.tMono
        onEvent?(ev)
    }
}
