import Foundation
import GRDB

// ════════════════════════════════════════════════════════════════════════
// Checklist de Pista — catálogo padrão (lista aprovada pelo Flávio 19/06/2026)
// + semeadura (bootstrap) + consulta dos pendentes pro Command Box.
//
// A lista é PROPOSTA/padrão: a equipe pode adicionar itens e desativar os que
// não usa. O bootstrap só semeia se ainda não houver itens do time (idempotente).
// ════════════════════════════════════════════════════════════════════════
public enum ChecklistCatalogo {

    /// (nome, papel responsável, obrigatório)
    private static let saida: [(String, String, Bool)] = [
        ("Capacete e equipamento do piloto travados", "piloto",       true),
        ("Cinto de 5 pontos regulado",                "piloto",       true),
        ("Freios sangrados · pedal firme",            "mecanico",     true),
        ("Pressão de óleo OK",                        "engenheiro",   true),
        ("Nível de água / arrefecimento",             "mecanico",     true),
        ("Pneus calibrados (a frio)",                 "mecanico",     true),
        ("Porcas de roda no torque",                  "mecanico",     true),
        ("Combustível suficiente pro stint",          "chefe_equipe", true),
        ("Rádio / comunicação testada",               "chefe_equipe", false),
        ("Câmera ligada e gravando",                  "engenheiro",   false),
        ("Telemetria transmitindo",                   "engenheiro",   false),
    ]

    private static let chegada: [(String, String, Bool)] = [
        ("Pressão e temperatura dos pneus (quentes)", "mecanico",     true),
        ("Telemetria salva / descarregada",           "engenheiro",   true),
        ("Combustível restante medido",                "chefe_equipe", true),
        ("Nível de óleo conferido",                    "mecanico",     true),
        ("Freios e pastilhas inspecionados",           "mecanico",     true),
        ("Danos / avarias inspecionados",              "mecanico",     false),
        ("Notas do piloto registradas",                "piloto",       false),
        ("Próximo stint planejado",                    "chefe_equipe", false),
    ]

    /// Lista padrão completa (saída + chegada) pra um time.
    public static func padrao(timeId: String) -> [ChecklistItem] {
        var out: [ChecklistItem] = []
        for (i, t) in saida.enumerated() {
            out.append(ChecklistItem(timeId: timeId, momento: "saida", nome: t.0,
                                     papel: t.1, obrigatorio: t.2, ordem: i))
        }
        for (i, t) in chegada.enumerated() {
            out.append(ChecklistItem(timeId: timeId, momento: "chegada", nome: t.0,
                                     papel: t.1, obrigatorio: t.2, ordem: i))
        }
        return out
    }

    /// Semeia a lista padrão se o time ainda não tiver nenhum item (idempotente).
    /// Devolve quantos itens semeou (0 = já existia).
    @discardableResult
    public static func bootstrap(_ db: Database, timeId: String) throws -> Int {
        let n = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM checklist_item WHERE time_id = ?",
                                 arguments: [timeId]) ?? 0
        if n > 0 { return 0 }
        let itens = padrao(timeId: timeId)
        for it in itens { try it.insert(db) }
        return itens.count
    }

    /// Itens PENDENTES de um momento, pro Command Box: ativos, ainda NÃO checados
    /// no evento, obrigatórios em cima e depois pela ordem.
    public static func pendentes(_ db: Database, timeId: String, eventoId: String,
                                 momento: String) throws -> [ChecklistItem] {
        let ativos = try ChecklistItem.fetchAll(db, sql:
            "SELECT * FROM checklist_item WHERE time_id = ? AND momento = ? AND ativo = 1",
            arguments: [timeId, momento])
        let checados = try String.fetchSet(db, sql:
            "SELECT item_id FROM checklist_tique WHERE evento_id = ? AND checado = 1",
            arguments: [eventoId])
        return ativos
            .filter { !checados.contains($0.id) }
            .sorted { a, b in
                if a.obrigatorio != b.obrigatorio { return a.obrigatorio && !b.obrigatorio }
                return a.ordem < b.ordem
            }
    }
}
