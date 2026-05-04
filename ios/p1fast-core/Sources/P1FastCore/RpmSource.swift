// ═══════════════════════════════════════════════════════════
// RpmSource — port Swift de src/pipeline/rpm-source.js
// ═══════════════════════════════════════════════════════════
// Interface única para fontes de RPM (e TPS). Isolam a diversidade
// de fontes (Manual / Mock / BLE-T4000) atrás de um contrato estável
// consumido pelo `ShiftLightBridge` (MS-8.5).
//
// Esta release contém:
//   • RpmSource — protocolo
//   • ManualRpmSource — caller seta manualmente (testes / Web Bluetooth
//     externo / qualquer canal que ainda não vire adapter)
//   • MockRpmSource — RPM "scriptado" por trajetória (testes E2E)
//
// O adapter BLE T4000 (CoreBluetooth real) entra em MS-9, junto com
// `gear_signatures` / `gear_ratios` / `dyno_curve` cadastrados.
//
// MS-8.6 (port 2026-05-04).

import Foundation

public enum RpmSourceConst {
    public static let freshnessMsDefault: Double = 500
}

public enum RpmSourceStatus: String, Sendable, Codable {
    case connected
    case degraded
    case lost
}

public protocol RpmSource: AnyObject, Sendable {
    /// RPM corrente, nil se sem leitura fresca.
    func getRpm() -> Double?
    /// 0..100, nil se sensor ausente.
    func getTps() -> Double?
    /// Status de saúde do feed.
    func getStatus() -> RpmSourceStatus
    /// Inicia o feed (em BLE roda async; aqui sync por simplicidade).
    func start()
    /// Para o feed e limpa estado.
    func stop()
}

/// Fonte manual — caller atualiza via setRpm/setTps. Útil pra testes,
/// simulador ou pra ligar manualmente a qualquer canal externo (Web
/// Bluetooth, MQTT, WebSocket) que ainda não tenha adapter dedicado.
public final class ManualRpmSource: RpmSource, @unchecked Sendable {
    private var rpm: Double? = nil
    private var tps: Double? = nil
    private var lastUpdate: Double = -.infinity
    private var started: Bool = false
    private let freshnessMs: Double
    private let now: () -> Double

    public init(
        freshnessMs: Double = RpmSourceConst.freshnessMsDefault,
        now: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 }
    ) {
        self.freshnessMs = freshnessMs
        self.now = now
    }

    public func setRpm(_ v: Double?) {
        if let v, v.isFinite, v >= 0 {
            rpm = v
        } else {
            rpm = nil
        }
        lastUpdate = now()
    }

    public func setTps(_ v: Double?) {
        if let v, v.isFinite { tps = v } else { tps = nil }
    }

    public func getRpm() -> Double? {
        guard started else { return nil }
        if now() - lastUpdate > freshnessMs { return nil }
        return rpm
    }

    public func getTps() -> Double? {
        started ? tps : nil
    }

    public func getStatus() -> RpmSourceStatus {
        guard started else { return .lost }
        let age = now() - lastUpdate
        if age > freshnessMs * 2 { return .lost }
        if age > freshnessMs     { return .degraded }
        return .connected
    }

    public func start() { started = true }
    public func stop()  { started = false; rpm = nil; tps = nil }
}

/// Fonte mock — RPM scriptado por uma função `(t) -> (rpm, tps)`.
/// Use com `tick(t)` antes de cada leitura para definir o instante.
public final class MockRpmSource: RpmSource, @unchecked Sendable {
    public typealias Script = (Double) -> (rpm: Double?, tps: Double?)

    private let script: Script
    private var started: Bool = false
    private var lastT: Double? = nil

    public init(script: @escaping Script) {
        self.script = script
    }

    public func tick(_ t: Double) { lastT = t }

    public func getRpm() -> Double? {
        guard started, let t = lastT else { return nil }
        let v = script(t)
        guard let r = v.rpm, r.isFinite else { return nil }
        return r
    }

    public func getTps() -> Double? {
        guard started, let t = lastT else { return nil }
        let v = script(t)
        guard let p = v.tps, p.isFinite else { return nil }
        return p
    }

    public func getStatus() -> RpmSourceStatus {
        started ? .connected : .lost
    }

    public func start() { started = true }
    public func stop()  { started = false; lastT = nil }
}
