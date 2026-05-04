// ═══════════════════════════════════════════════════════════
// CoachPhrases — port Swift de src/data/coach-phrases.js
// ═══════════════════════════════════════════════════════════
// Catálogo completo (36 códigos): 21 MVP (M001..M062) + 15 avançadas (M100..M142).
// Decisão Flávio 2026-05-03: não há mais Fase 2 — tudo entra em Fase 1.
//
// Cada frase tem 2 ou 3 palavras (regra dura — validateAll() checa).
// Convenção:
//   M001-009  Referência Fixa / Curva Cega
//   M010-019  V-Min
//   M020-029  Transição Freio-Acelerador
//   M030-039  Acelerador Progressivo
//   M040-049  Linha de Visão
//   M050-059  Controle Subesterço
//   M060-069  Curva Cega (entrada)
//   M100-149  Lições avançadas (volante contínuo, círculo de grip,
//             pneu arrastando, sobresterço, uso de zebra)

import Foundation

public enum CoachPhrases {

    public static let raw: [String: String] = [
        // ─── MVP ───
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
        // L006 — Controle subesterço
        "M050": "Alivia gira",
        "M051": "Abre linha",
        "M052": "Solta volante",
        // L007 — Curva cega
        "M060": "Compromete entrada",
        "M061": "Confia ponto",
        "M062": "Mesmo giro",

        // ─── Avançadas (era Fase 2 — agora tudo é Fase 1) ───
        // L101 — Volante contínuo
        "M100": "Volante único",
        "M101": "Sem corrigir",
        "M102": "Arco limpo",
        // L102 — Círculo de grip
        "M110": "Tira lateral",
        "M111": "Soma forças",
        "M112": "Fora envelope",
        // L103 — Pneu arrastando
        "M120": "Pneu trava",
        "M121": "Alivia freio",
        "M122": "Solta um pouco",
        // L104 — Controle sobresterço
        "M130": "Cuidado traseira",
        "M131": "Corrige cedo",
        "M132": "Tira gás",
        // L105 — Uso seguro de zebra
        "M140": "Sem zebra",
        "M141": "Pisa leve",
        "M142": "Zebra livre",
    ]

    public static func getPhrase(_ code: String) -> String? { raw[code] }

    public static var set: Set<String> { Set(raw.values) }

    public static func isCoachCode(_ code: String) -> Bool { raw[code] != nil }

    /// Validação ao carregar — espelha checagem JS (regex M### + 2..3 palavras).
    /// Falha em runtime se algum código violar.
    public static func validateAll() throws {
        for (code, phrase) in raw {
            guard Lesson.isValidMessageCode(code) else {
                throw NSError(domain: "CoachPhrases", code: 2,
                              userInfo: [NSLocalizedDescriptionKey:
                                         "código inválido \(code)"])
            }
            let words = phrase.split(whereSeparator: { $0.isWhitespace }).count
            if words < 2 || words > 3 {
                throw NSError(domain: "CoachPhrases", code: 1,
                              userInfo: [NSLocalizedDescriptionKey:
                                         "\(code) tem \(words) palavras: \"\(phrase)\""])
            }
        }
    }
}
