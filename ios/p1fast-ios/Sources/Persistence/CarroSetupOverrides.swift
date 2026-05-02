// ═══════════════════════════════════════════════════════════
// CarroSetupOverrides — payload do "Setup base" do carro
// ═══════════════════════════════════════════════════════════
// Espelha 14 campos do mockup-carro.html agrupados em 5 seções
// (PNEUS, ALINHAMENTO, SUSPENSÃO, FREIOS, MOTOR · TRANSMISSÃO).
// Serializa pra JSON e vive no campo `configuracoes.overrides` do
// schema (TEXT no SQLite, JSONB no Postgres).
//
// Formato JSON: chaves snake_case alinhadas com o que o resto do
// pipeline JS já usa (src/data/schemas.js → setup base).

import Foundation

struct CarroSetupOverrides: Codable, Equatable {
    // PNEUS (4) — pressão saída box em PSI por roda.
    var pressaoDE: Double?
    var pressaoDD: Double?
    var pressaoTE: Double?
    var pressaoTD: Double?

    // ALINHAMENTO (3) — média por eixo (cambagem D/T) + convergência traseira.
    var cambagemDianteira: Double?
    var cambagemTraseira: Double?
    var convergenciaTraseira: Double?

    // SUSPENSÃO (3) — molas + altura dianteira.
    var molaDianteira: Double?
    var molaTraseira: Double?
    var alturaDianteira: Double?

    // FREIOS (1) — bias de freio dianteiro em %.
    var biasFreioDianteiro: Double?

    // MOTOR · TRANSMISSÃO (3) — combustível, mapa, diferencial.
    var combustivel: String?
    var mapaInjecao: String?
    var diferencial: String?

    enum CodingKeys: String, CodingKey {
        case pressaoDE = "pressao_de"
        case pressaoDD = "pressao_dd"
        case pressaoTE = "pressao_te"
        case pressaoTD = "pressao_td"
        case cambagemDianteira = "cambagem_dianteira"
        case cambagemTraseira = "cambagem_traseira"
        case convergenciaTraseira = "convergencia_traseira"
        case molaDianteira = "mola_dianteira"
        case molaTraseira = "mola_traseira"
        case alturaDianteira = "altura_dianteira"
        case biasFreioDianteiro = "bias_freio_dianteiro"
        case combustivel
        case mapaInjecao = "mapa_injecao"
        case diferencial
    }

    static let empty = CarroSetupOverrides()

    /// Decoder tolerante a JSON null/ausente — `nil` em qualquer campo é OK.
    static func decode(from json: String?) -> CarroSetupOverrides {
        guard let json, let data = json.data(using: .utf8) else { return .empty }
        return (try? JSONDecoder().decode(CarroSetupOverrides.self, from: data)) ?? .empty
    }

    func encodedJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        // Manter `nil`s como ausentes (chave omitida) — Postgres JSONB
        // trata `{}` e `{"x": null}` distintos; preferimos compacto.
        encoder.keyEncodingStrategy = .useDefaultKeys
        guard let data = try? encoder.encode(self) else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}

/// Catálogo canônico de categorias de carro — porte direto de
/// `src/data/schemas.js → SEED_CARRO_CATEGORIAS`. Mantemos como
/// constante local (sem fetch ao DB) — Sprint 1A.6 troca pra read
/// dinâmico de `dados.carroCategorias` quando o sync drainer estiver
/// pronto.
enum CarroCategoria {
    static let opcoes: [String] = [
        "Turismo",
        "Pista",
        "GT",
        "Stock",
        "Marcas",
        "Sedan",
        "Hatch",
        "Fórmula",
        "Kart",
        "Picape",
    ]
}

/// Paleta de cores oferecidas no swatch-rail do mockup-carro-novo.html
/// (4 cores). Mantida como dados (RGB hex) — não vira token visual do
/// Theme porque é dado de carro, não estilo do hub.
enum CarroPalette {
    struct Cor: Identifiable, Equatable {
        let id: String   // hex stable
        let nome: String // pra leitor de tela
        let hex: String  // ex "#e8001c"
    }

    static let opcoes: [Cor] = [
        Cor(id: "#e8001c", nome: "Vermelho", hex: "#e8001c"),
        Cor(id: "#f5c400", nome: "Amarelo",  hex: "#f5c400"),
        Cor(id: "#0099ff", nome: "Azul",     hex: "#0099ff"),
        Cor(id: "#a855f7", nome: "Roxo",     hex: "#a855f7"),
    ]
}
