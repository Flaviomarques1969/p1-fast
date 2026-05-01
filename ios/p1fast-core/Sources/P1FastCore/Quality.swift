// ═══════════════════════════════════════════════════════════
// Quality — 11 categorias canônicas
// ═══════════════════════════════════════════════════════════
// Port direto de src/domain/data-quality.js.
// docs/raceops/DATA_QUALITY_RULES.md governa.
// Toda amostra (e cada canal de snapshot) carrega EXATAMENTE UMA.

import Foundation

public enum Quality: String, Codable, Sendable, CaseIterable {
    case ok = "OK"
    case suspect = "SUSPECT"
    case missing = "MISSING"
    case late = "LATE"
    case outOfOrder = "OUT_OF_ORDER"
    case invalidChecksum = "INVALID_CHECKSUM"
    case outOfRange = "OUT_OF_RANGE"
    case duplicate = "DUPLICATE"
    case interpolated = "INTERPOLATED"
    case estimated = "ESTIMATED"
    case lowConfidence = "LOW_CONFIDENCE"
    // LOST aliasa MISSING (compat com SignalQuality 4-cat antigo)
}

extension Quality {
    /// Severidade ordenada — usado em worstOf.
    public var severity: Int {
        switch self {
        case .ok: return 0
        case .interpolated, .estimated: return 1
        case .late, .lowConfidence: return 2
        case .outOfOrder: return 3
        case .duplicate: return 4
        case .suspect: return 5
        case .outOfRange: return 6
        case .invalidChecksum: return 7
        case .missing: return 8
        }
    }

    /// Worst-of N categorias — retorna a de pior severidade.
    public static func worstOf(_ qs: [Quality]) -> Quality {
        guard let first = qs.first else { return .missing }
        return qs.dropFirst().reduce(first) { $0.severity >= $1.severity ? $0 : $1 }
    }

    /// Aceita uso livre (Regra 4 ALERT_HIERARCHY: CRÍTICO precisa OK).
    public var isOk: Bool { self == .ok }

    /// Permite emitir alerta CRÍTICO contra esta qualidade?
    public var permitsCritical: Bool { self == .ok }
}

extension Quality {
    /// Mapeamento da SignalQuality 4-cat antiga (provider.js) pra Quality 11-cat.
    public static func fromSignalQuality(_ sq: String) -> Quality {
        switch sq.uppercased() {
        case "GOOD":     return .ok
        case "DEGRADED": return .suspect
        case "BAD":      return .lowConfidence
        case "LOST":     return .missing
        default:         return .missing
        }
    }

    /// Thresholds de GPS accuracy (m) — espelho de DeviceProvider.
    public static func fromGpsAccuracy(_ acc: Double?) -> Quality {
        guard let acc, acc.isFinite else { return .missing }
        if acc <= 5  { return .ok }
        if acc <= 20 { return .lowConfidence }
        if acc <= 50 { return .suspect }
        return .missing
    }

    /// Range check — retorna .outOfRange se valor fora dos limites.
    public static func fromRangeCheck(value: Double, min: Double, max: Double) -> Quality {
        if value < min || value > max { return .outOfRange }
        return .ok
    }
}
