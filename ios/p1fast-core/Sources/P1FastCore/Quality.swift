// ═══════════════════════════════════════════════════════════
// Quality — 11 categorias canônicas
// ═══════════════════════════════════════════════════════════
// Port direto de src/domain/data-quality.js (paridade integral 2026-05-04).
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
    /// Lista vazia retorna .ok (paridade JS data-quality.worstOf).
    public static func worstOf(_ qs: [Quality]) -> Quality {
        var worst: Quality = .ok
        for q in qs where q.severity > worst.severity {
            worst = q
        }
        return worst
    }

    public var isOk: Bool { self == .ok }

    /// Apenas .ok pode emitir alerta CRÍTICO (ALERT_HIERARCHY Regra 4).
    public var permitsCritical: Bool { self == .ok }

    /// Permite uso visual (com indicador). MISSING/INVALID_CHECKSUM/DUPLICATE descartados.
    public var permitsVisual: Bool {
        switch self {
        case .missing, .invalidChecksum, .duplicate: return false
        default: return true
        }
    }

    /// Label humano para UI (snake_case, paridade JS qualityLabel).
    public var label: String {
        switch self {
        case .ok: return "ok"
        case .suspect: return "suspect"
        case .missing: return "missing"
        case .late: return "late"
        case .outOfOrder: return "out_of_order"
        case .invalidChecksum: return "invalid_checksum"
        case .outOfRange: return "out_of_range"
        case .duplicate: return "duplicate"
        case .interpolated: return "interpolated"
        case .estimated: return "estimated"
        case .lowConfidence: return "low_confidence"
        }
    }

    /// Token CSS associado — UI usa pra colorir indicadores.
    /// Espelha tokens em design-tokens.css.
    public var token: String {
        switch self {
        case .ok: return "--bom"
        case .interpolated, .estimated: return "--sistema"
        case .late, .lowConfidence, .suspect: return "--atencao"
        case .outOfRange, .invalidChecksum, .missing: return "--erro"
        case .outOfOrder, .duplicate: return "--muted"
        }
    }
}

extension Quality {
    /// Mapeamento da SignalQuality 4-cat antiga (provider.js) pra Quality 11-cat.
    /// Paridade JS data-quality.fromSignalQuality.
    public static func fromSignalQuality(_ sq: String?) -> Quality {
        guard let sq else { return .missing }
        switch sq.lowercased() {
        case "good", "ok":
            return .ok
        case "degraded":
            return .lowConfidence
        case "bad":
            return .suspect
        case "lost", "missing":
            return .missing
        default:
            // Já pode ser uma categoria nova — aceita se válida
            if let q = Quality(rawValue: sq) { return q }
            return .ok
        }
    }

    /// Thresholds de GPS accuracy (m) + numSatellites opcional.
    /// Paridade JS data-quality.fromGpsAccuracy:
    ///   > 50 → MISSING; > 20 → SUSPECT; > 5 → LOW_CONFIDENCE.
    ///   accuracy boa mas <6 satélites → LOW_CONFIDENCE.
    public static func fromGpsAccuracy(_ acc: Double?, numSatellites: Int? = nil) -> Quality {
        guard let acc, acc.isFinite else { return .missing }
        if acc > 50 { return .missing }
        if acc > 20 { return .suspect }
        if acc > 5 { return .lowConfidence }
        if let n = numSatellites, n < 6 { return .lowConfidence }
        return .ok
    }

    /// Range check — paridade JS data-quality.fromRangeCheck.
    /// Valor não-finito → .missing. min/max opcionais (nil = ignora aquele lado).
    public static func fromRangeCheck(value: Double?, min: Double? = nil, max: Double? = nil) -> Quality {
        guard let value, value.isFinite else { return .missing }
        if let min, value < min { return .outOfRange }
        if let max, value > max { return .outOfRange }
        return .ok
    }
}
