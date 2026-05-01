// ═══════════════════════════════════════════════════════════
// QualityTests — paridade com src/domain/data-quality.js
// ═══════════════════════════════════════════════════════════
// Cada teste tem equivalente direto no smoke node-smoke-telemetry-p0.mjs
// (DQ-01..DQ-06). Se o port estiver fiel, mesmas entradas → mesmas saídas.
//
// Usamos Swift Testing (Swift 6) porque CommandLineTools não traz
// XCTest. `swift test` no Mac sem Xcode → Swift Testing nativo.

import Testing
@testable import P1FastCore

@Suite("Quality — paridade JS")
struct QualityTests {

    @Test("DQ-01: 11 categorias canônicas")
    func categoriasCanonicas() {
        #expect(Quality.allCases.count == 11)
    }

    @Test("DQ-02: fromSignalQuality mapeia 4-cat → 11-cat")
    func fromSignalQualityMapping() {
        #expect(Quality.fromSignalQuality("GOOD")     == .ok)
        #expect(Quality.fromSignalQuality("DEGRADED") == .suspect)
        #expect(Quality.fromSignalQuality("BAD")      == .lowConfidence)
        #expect(Quality.fromSignalQuality("LOST")     == .missing)
        #expect(Quality.fromSignalQuality("WAT")      == .missing)
    }

    @Test("DQ-03: fromGpsAccuracy thresholds 5/20/50")
    func gpsAccuracyThresholds() {
        #expect(Quality.fromGpsAccuracy(2)   == .ok)
        #expect(Quality.fromGpsAccuracy(5)   == .ok)
        #expect(Quality.fromGpsAccuracy(10)  == .lowConfidence)
        #expect(Quality.fromGpsAccuracy(20)  == .lowConfidence)
        #expect(Quality.fromGpsAccuracy(30)  == .suspect)
        #expect(Quality.fromGpsAccuracy(50)  == .suspect)
        #expect(Quality.fromGpsAccuracy(60)  == .missing)
        #expect(Quality.fromGpsAccuracy(nil) == .missing)
    }

    @Test("DQ-04: fromRangeCheck rotula OUT_OF_RANGE")
    func rangeCheck() {
        #expect(Quality.fromRangeCheck(value: 5, min: 0, max: 10) == .ok)
        #expect(Quality.fromRangeCheck(value: -1, min: 0, max: 10) == .outOfRange)
        #expect(Quality.fromRangeCheck(value: 15, min: 0, max: 10) == .outOfRange)
    }

    @Test("DQ-05: worstOf devolve pior por severidade")
    func worstOf() {
        #expect(Quality.worstOf([.ok, .ok, .ok]) == .ok)
        #expect(Quality.worstOf([.ok, .suspect, .ok]) == .suspect)
        #expect(Quality.worstOf([.late, .missing, .ok]) == .missing)
    }

    @Test("DQ-06: isOk + permitsCritical respeitam Regra 4")
    func isOkPermitsCritical() {
        #expect(Quality.ok.isOk)
        #expect(!Quality.suspect.isOk)
        #expect(Quality.ok.permitsCritical)
        #expect(!Quality.lowConfidence.permitsCritical)
        #expect(!Quality.missing.permitsCritical)
    }
}
