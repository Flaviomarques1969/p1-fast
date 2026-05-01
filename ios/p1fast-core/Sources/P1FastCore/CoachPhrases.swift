// ═══════════════════════════════════════════════════════════
// CoachPhrases — port Swift de src/data/coach-phrases.js
// ═══════════════════════════════════════════════════════════
// Catálogo de frases pedagógicas (2..3 palavras). Apenas códigos
// MVP (M001..M062) — Fase 2 fica fora até as lições virem ativas.

import Foundation

public enum CoachPhrases {

    static let raw: [String: String] = [
        // L001 — Referência Fixa
        "M001": "Mesmo ponto",
        "M002": "Freie aqui",
        "M003": "Gire agora",
        // L002 — V-Min
        "M010": "Mais V-min",
        "M011": "Solta freio",
        "M012": "Não freia mais",
        // L003 — Transição freio-acelerador
        "M020": "Sem coast",
        "M021": "Acelera junto",
        "M022": "Liga o pé",
        // L004 — Acelerador progressivo
        "M030": "Mais suave",
        "M031": "Sem bate",
        "M032": "Cresce gás",
        // L005 — Linha de visão
        "M040": "Olha saída",
        "M041": "Vista longe",
        "M042": "Antecipa apex",
        // L006 — Trail braking suave
        "M050": "Alivia gira",
        "M051": "Abre linha",
        "M052": "Solta volante",
        // L007 — Curva cega
        "M060": "Compromete entrada",
        "M061": "Confia ponto",
        "M062": "Mesmo giro",
    ]

    public static func getPhrase(_ code: String) -> String? { raw[code] }

    public static var set: Set<String> { Set(raw.values) }

    /// Validação ao carregar — espelha checagem JS (2..3 palavras).
    /// Falha em runtime se algum código violar.
    public static func validateAll() throws {
        for (code, phrase) in raw {
            let words = phrase.split(whereSeparator: { $0.isWhitespace }).count
            if words < 2 || words > 3 {
                throw NSError(domain: "CoachPhrases", code: 1,
                              userInfo: [NSLocalizedDescriptionKey:
                                         "\(code) tem \(words) palavras: \"\(phrase)\""])
            }
        }
    }
}
