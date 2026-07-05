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

    // ALERTAS (10) — limites de alerta DESTE carro (Flávio 05/07, item 4 da Fase 2).
    // Cada carro tem os seus; nil = usa o padrão do sistema. Temperatura em °C, tensão em V,
    // lambda adimensional. O cérebro do cockpit (notebook) lê estes ao abrir a sessão do carro.
    // MOTOR (temperatura da água)
    var alertaMotorQuenteC: Double?       // trava dura "Motor Quente" (padrão 70)
    var alertaMotorReferenciaC: Double?   // máxima normal semente do aprendizado (padrão 62)
    var alertaMotorDeltaC: Double?        // quantos °C acima do normal avisa "subindo" (padrão 3)
    // MISTURA (lambda)
    var alertaLambdaPobre: Double?        // acima disso = mistura pobre (padrão 1.0)
    var alertaLambdaRica: Double?         // abaixo disso = mistura rica (padrão 0.74)
    // BATERIA
    var alertaBateriaMinV: Double?        // abaixo disso = bateria fraca (padrão 12.5)
    // PNEU — 2 níveis por tipo (preparado; espera o sensor de pneu)
    var alertaPneuRadialAtencaoC: Double? // radial 185 atenção (padrão 95)
    var alertaPneuRadialCriticoC: Double? // radial 185 crítico (padrão 105)
    var alertaPneuSlickAtencaoC: Double?  // semi-slick 195 atenção (padrão 105)
    var alertaPneuSlickCriticoC: Double?  // semi-slick 195 crítico (padrão 115)

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
        case alertaMotorQuenteC = "alerta_motor_quente_c"
        case alertaMotorReferenciaC = "alerta_motor_referencia_c"
        case alertaMotorDeltaC = "alerta_motor_delta_c"
        case alertaLambdaPobre = "alerta_lambda_pobre"
        case alertaLambdaRica = "alerta_lambda_rica"
        case alertaBateriaMinV = "alerta_bateria_min_v"
        case alertaPneuRadialAtencaoC = "alerta_pneu_radial_atencao_c"
        case alertaPneuRadialCriticoC = "alerta_pneu_radial_critico_c"
        case alertaPneuSlickAtencaoC = "alerta_pneu_slick_atencao_c"
        case alertaPneuSlickCriticoC = "alerta_pneu_slick_critico_c"
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
