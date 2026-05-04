// ═══════════════════════════════════════════════════════════
// DynoCsvParser — port Swift de src/domain/dyno-csv-parser.js
// ═══════════════════════════════════════════════════════════
// Lê CSV de dinamômetro (Dynojet/Mustang/Dynapack/genérico) e devolve
// uma curva normalizada (`format`, `points: [DynoPoint]`).
//
// Detecta separador (vírgula/ponto-e-vírgula/tab), identifica colunas
// por regex no header, converte unidades (lb-ft → Nm, hp/cv → kW) e
// completa torque ↔ potência via P(kW) = T(Nm) × RPM / 9549.
//
// MS-9.1 (port 2026-05-04). Usado pelo cadastro de carro (cadastro
// de dyno_curve em MS-9 quando T4000 entra).

import Foundation

public enum DynoFormat: String, Sendable, Codable {
    case dynojet
    case mustang
    case dynapack
    case generic
}

public struct ParsedDynoCurve: Sendable, Equatable {
    public let format: DynoFormat
    public let points: [DynoPoint]
}

public enum DynoCsvParserError: Error, Equatable, Sendable {
    case empty
    case headerNotFound
    case rpmColumnNotFound
    case noTorqueOrPowerColumn
    case insufficientPoints(found: Int)
}

public enum DynoCsvParser {
    public static let hpToKw: Double      = 0.7457
    public static let lbftToNm: Double    = 1.355818
    public static let powerKwFromTorque: Double = 9549  // P(kW) = T(Nm) × RPM / 9549

    /// Parse principal. Lança em CSV inválido / sem RPM / < 3 pontos.
    public static func parse(_ text: String) throws -> ParsedDynoCurve {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw DynoCsvParserError.empty
        }
        let allLines = text
            .components(separatedBy: CharacterSet(charactersIn: "\n\r"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard allLines.count >= 2 else { throw DynoCsvParserError.empty }

        // Header = primeira linha que contém "rpm" + um separador.
        var headerIdx: Int = -1
        let rpmRegex = try NSRegularExpression(pattern: #"\brpm\b"#, options: [.caseInsensitive])
        let sepCharSet = CharacterSet(charactersIn: ",;\t")
        for (i, l) in allLines.enumerated() {
            let nsl = l as NSString
            let hasRpm = rpmRegex.firstMatch(in: l, range: NSRange(location: 0, length: nsl.length)) != nil
            let hasSep = l.rangeOfCharacter(from: sepCharSet) != nil
            if hasRpm && hasSep { headerIdx = i; break }
        }
        if headerIdx < 0 { headerIdx = 0 }
        let preamble = allLines[..<headerIdx].joined(separator: " ")
        let lines = Array(allLines[headerIdx...])

        let sep = detectSeparator(lines[0])
        let headers = lines[0]
            .components(separatedBy: String(sep))
            .map { $0.trimmingCharacters(in: .whitespaces) }
        let format = detectFormat(preamble + " " + lines[0])

        let idxRpm = findCol(headers, patterns: [
            #"^rpm$"#, #"\brpm\b"#, #"engine\s*rpm"#, #"eng\.?\s*rpm"#
        ])
        guard idxRpm >= 0 else { throw DynoCsvParserError.rpmColumnNotFound }

        let idxTorqueNm = findCol(headers, patterns: [
            #"torque.*\bnm\b"#, #"torq.*\bnm\b"#, #"torque.*\(n[·\.\s\-]*m\)"#
        ])
        let idxTorqueLb = idxTorqueNm < 0
            ? findCol(headers, patterns: [#"torque.*lb[\s\-]?ft"#, #"torq.*lb[\s\-]?ft"#, #"torque.*ftlb"#])
            : -1
        let idxTorqueGen = (idxTorqueNm < 0 && idxTorqueLb < 0)
            ? findCol(headers, patterns: [#"^torque$"#, #"\btorque\b"#, #"\btorq\b"#])
            : -1

        let idxPowerKw = findCol(headers, patterns: [#"power.*\bkw\b"#, #"pot.*\bkw\b"#, #"\(kw\)"#])
        let idxPowerHp = idxPowerKw < 0
            ? findCol(headers, patterns: [#"power.*\bhp\b"#, #"\bhp\b"#, #"\bbhp\b"#])
            : -1
        let idxPowerCv = (idxPowerKw < 0 && idxPowerHp < 0)
            ? findCol(headers, patterns: [#"\bcv\b"#])
            : -1
        let idxPowerGen = (idxPowerKw < 0 && idxPowerHp < 0 && idxPowerCv < 0)
            ? findCol(headers, patterns: [#"^power$"#, #"\bpower\b"#, #"\bpot[eê]ncia\b"#])
            : -1

        if idxTorqueNm < 0 && idxTorqueLb < 0 && idxTorqueGen < 0
            && idxPowerKw < 0 && idxPowerHp < 0 && idxPowerCv < 0 && idxPowerGen < 0 {
            throw DynoCsvParserError.noTorqueOrPowerColumn
        }

        var points: [DynoPoint] = []
        for li in 1..<lines.count {
            let cells = lines[li]
                .components(separatedBy: String(sep))
                .map { $0.trimmingCharacters(in: .whitespaces) }
            if cells.count < 2 { continue }
            guard idxRpm < cells.count else { continue }
            guard let rpm = parseNum(cells[idxRpm]), rpm.isFinite, rpm > 0 else { continue }

            var torqueNm: Double? = nil
            if idxTorqueNm >= 0, idxTorqueNm < cells.count {
                torqueNm = parseNum(cells[idxTorqueNm])
            } else if idxTorqueLb >= 0, idxTorqueLb < cells.count {
                if let v = parseNum(cells[idxTorqueLb]) { torqueNm = v * lbftToNm }
            } else if idxTorqueGen >= 0, idxTorqueGen < cells.count {
                torqueNm = parseNum(cells[idxTorqueGen])
            }

            var powerKw: Double? = nil
            if idxPowerKw >= 0, idxPowerKw < cells.count {
                powerKw = parseNum(cells[idxPowerKw])
            } else if idxPowerHp >= 0, idxPowerHp < cells.count {
                if let v = parseNum(cells[idxPowerHp]) { powerKw = v * hpToKw }
            } else if idxPowerCv >= 0, idxPowerCv < cells.count {
                if let v = parseNum(cells[idxPowerCv]) { powerKw = v * hpToKw }
            } else if idxPowerGen >= 0, idxPowerGen < cells.count {
                powerKw = parseNum(cells[idxPowerGen])
            }

            // Completar torque ↔ potência
            if let t = torqueNm, t.isFinite, !(powerKw?.isFinite ?? false) {
                powerKw = t * rpm / powerKwFromTorque
            }
            if let p = powerKw, p.isFinite, !(torqueNm?.isFinite ?? false) {
                torqueNm = p * powerKwFromTorque / rpm
            }

            // Pelo menos um dos dois precisa estar definido
            let tValid = torqueNm?.isFinite ?? false
            let pValid = powerKw?.isFinite ?? false
            if !tValid && !pValid { continue }

            points.append(DynoPoint(
                rpm: rpm,
                powerKw: powerKw ?? 0
            ))
            // Note: nosso DynoPoint só carrega rpm + powerKw. Torque-nm
            // é apenas intermediário na conversão. Se necessário pra
            // análise, usar p * 9549 / rpm.
        }

        if points.count < 3 {
            throw DynoCsvParserError.insufficientPoints(found: points.count)
        }
        points.sort { $0.rpm < $1.rpm }
        return ParsedDynoCurve(format: format, points: points)
    }
}

// MARK: - Internals

private func detectSeparator(_ line: String) -> Character {
    let candidates: [Character] = [",", ";", "\t"]
    var best: Character = ","
    var bestCount = 0
    for c in candidates {
        let cnt = line.reduce(0) { $0 + ($1 == c ? 1 : 0) }
        if cnt > bestCount { bestCount = cnt; best = c }
    }
    return best
}

private func detectFormat(_ s: String) -> DynoFormat {
    let lower = s.lowercased()
    if lower.contains("dynojet")  { return .dynojet }
    if lower.contains("mustang")  { return .mustang }
    if lower.contains("dynapack") { return .dynapack }
    return .generic
}

private func findCol(_ headers: [String], patterns: [String]) -> Int {
    for (i, h) in headers.enumerated() {
        let lower = h.lowercased()
        for pStr in patterns {
            if let re = try? NSRegularExpression(pattern: pStr, options: [.caseInsensitive]) {
                let nsl = lower as NSString
                if re.firstMatch(in: lower, range: NSRange(location: 0, length: nsl.length)) != nil {
                    return i
                }
            }
        }
    }
    return -1
}

private func parseNum(_ s: String) -> Double? {
    var cleaned = s.replacingOccurrences(of: " ", with: "")
    // remove vírgula como separador de milhar
    while let range = cleaned.range(of: #",(?=\d{3}\b)"#, options: .regularExpression) {
        cleaned.removeSubrange(range)
    }
    cleaned = cleaned.replacingOccurrences(of: ",", with: ".")
    return Double(cleaned).flatMap { $0.isFinite ? $0 : nil }
}
