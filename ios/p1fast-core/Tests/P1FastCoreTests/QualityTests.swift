// ═══════════════════════════════════════════════════════════
// QualityTests — paridade com src/domain/data-quality.js
// ═══════════════════════════════════════════════════════════
// Cada teste tem um equivalente direto no smoke node-smoke-telemetry-p0.mjs
// (DQ-01..DQ-06). Se o port estiver fiel, mesmas entradas → mesmas saídas.

import XCTest
@testable import P1FastCore

final class QualityTests: XCTestCase {

    func testDQ01_oneCaseEachCategory() {
        // 11 categorias canônicas (LOST aliasa MISSING — 11 cases incluem .missing).
        XCTAssertEqual(Quality.allCases.count, 11)
    }

    func testDQ02_fromSignalQualityMapping4to11() {
        XCTAssertEqual(Quality.fromSignalQuality("GOOD"),     .ok)
        XCTAssertEqual(Quality.fromSignalQuality("DEGRADED"), .suspect)
        XCTAssertEqual(Quality.fromSignalQuality("BAD"),      .lowConfidence)
        XCTAssertEqual(Quality.fromSignalQuality("LOST"),     .missing)
        XCTAssertEqual(Quality.fromSignalQuality("WAT"),      .missing)
    }

    func testDQ03_fromGpsAccuracyThresholds() {
        XCTAssertEqual(Quality.fromGpsAccuracy(2),   .ok)
        XCTAssertEqual(Quality.fromGpsAccuracy(5),   .ok)
        XCTAssertEqual(Quality.fromGpsAccuracy(10),  .lowConfidence)
        XCTAssertEqual(Quality.fromGpsAccuracy(20),  .lowConfidence)
        XCTAssertEqual(Quality.fromGpsAccuracy(30),  .suspect)
        XCTAssertEqual(Quality.fromGpsAccuracy(50),  .suspect)
        XCTAssertEqual(Quality.fromGpsAccuracy(60),  .missing)
        XCTAssertEqual(Quality.fromGpsAccuracy(nil), .missing)
    }

    func testDQ04_fromRangeCheck() {
        XCTAssertEqual(Quality.fromRangeCheck(value: 5, min: 0, max: 10), .ok)
        XCTAssertEqual(Quality.fromRangeCheck(value: -1, min: 0, max: 10), .outOfRange)
        XCTAssertEqual(Quality.fromRangeCheck(value: 15, min: 0, max: 10), .outOfRange)
    }

    func testDQ05_worstOf() {
        XCTAssertEqual(Quality.worstOf([.ok, .ok, .ok]), .ok)
        XCTAssertEqual(Quality.worstOf([.ok, .suspect, .ok]), .suspect)
        XCTAssertEqual(Quality.worstOf([.late, .missing, .ok]), .missing)
        XCTAssertEqual(Quality.worstOf([.interpolated, .estimated]), .estimated)  // empate retorna a passada por último (severity 1==1)
    }

    func testDQ06_isOkPermitsCritical() {
        XCTAssertTrue(Quality.ok.isOk)
        XCTAssertFalse(Quality.suspect.isOk)
        XCTAssertTrue(Quality.ok.permitsCritical)
        XCTAssertFalse(Quality.lowConfidence.permitsCritical)
        XCTAssertFalse(Quality.missing.permitsCritical)
    }
}
