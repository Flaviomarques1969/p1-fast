// ═══════════════════════════════════════════════════════════
// CatalogoTreinos — port fiel de web/cockpit/catalogo-treinos.js
// ═══════════════════════════════════════════════════════════
// Catálogo canônico dos treinos de técnica com IA (decisão Flávio 11/06).
// UMA fonte só — aqui é a versão do CELULAR (o planejamento mora aqui;
// decisão Flávio 15/06). Texto idêntico ao do computador (não inventar):
//   - 1 técnica: Trail braking (etiqueta 'proxy' — medido por aproximação)
//   - 6 pontos do trecho: Entrada, Ponto de frenagem, Velocidade mínima,
//     Ápice, Início de aceleração, Saída (todos 'pleno' — medidos de verdade).
// 'pleno' = a IA mede de verdade hoje (GPS + motor). 'proxy' = aproximação
// declarada na ressalva (sem o sensor pleno ainda).

import Foundation

struct TreinoCatalogo: Identifiable, Equatable {
    let id: String
    let rotulo: String
    /// "tecnica" (técnica de pilotagem) ou "ponto" (um dos 6 pontos do trecho).
    let grupo: String
    /// "pleno" (medido de verdade) ou "proxy" (aproximação declarada).
    let etiqueta: String
    let oQueE: String
    let oQueMede: [String]
    let ressalva: String?
}

enum CatalogoTreinos {
    static let todos: [TreinoCatalogo] = [
        TreinoCatalogo(
            id: "trail-braking",
            rotulo: "Trail braking",
            grupo: "tecnica",
            etiqueta: "proxy",
            oQueE: "Soltar o freio aos poucos curva adentro, arrastando um resto de pressão até perto do ápice: peso na frente pra virar, traseira leve pra rotacionar. No nosso carro de tração dianteira é quase obrigatório — é a arma número 1 contra sair de frente.",
            oQueMede: [
                "Ponto de freada em metros desde a linha de entrada (por GPS, em cada trecho)",
                "Velocidade mínima do trecho e ONDE ela acontece (trail bom empurra a velocidade mínima pra perto do ápice)",
            ],
            ressalva: "Medição por aproximação: ainda não há sensor de pedal no carro, então a IA enxerga o EFEITO do seu trail (ponto de freada + velocidade mínima), não a pressão do seu pé. O treino pleno chega com o sensor de pressão de freio."
        ),
        TreinoCatalogo(
            id: "entrada",
            rotulo: "Entrada",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Chegar na linha de entrada do trecho com a velocidade da melhor passagem — sem desistir antes da hora. A entrada é onde se carrega a velocidade que a reta inteira construiu.",
            oQueMede: [
                "Velocidade ao cruzar a linha de entrada, comparada à melhor passagem histórica do carro",
                "Tempo perdido no pedaço entrada → ponto de freada",
            ],
            ressalva: nil
        ),
        TreinoCatalogo(
            id: "frenagem",
            rotulo: "Ponto de frenagem",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Frear forte, em linha reta, no ponto mais tardio que ainda deixa a curva acontecer. É o exercício de atraso progressivo do manual: aproximar seu ponto de freada do ponto da melhor passagem, em degraus.",
            oQueMede: [
                "Ponto de freada em metros desde a linha de entrada (medido de verdade, por GPS, a cada passagem)",
                "Tempo perdido no pedaço ponto de freada → ápice",
            ],
            ressalva: nil
        ),
        TreinoCatalogo(
            id: "vmin",
            rotulo: "Velocidade mínima",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Carregar mais velocidade pelo miolo da curva: a velocidade mínima (Vmin) é o quanto de velocidade sobrou depois de todo o trabalho de freio e volante. Vmin baixa demais = tirou velocidade que a curva aceitava.",
            oQueMede: [
                "Velocidade mínima da passagem em cada trecho (derivada do GPS), comparada à da melhor passagem",
                "Tempo perdido nos pedaços freio → ápice",
            ],
            ressalva: nil
        ),
        TreinoCatalogo(
            id: "apice",
            rotulo: "Ápice",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Passar no ponto mais interno que a curva permite, com o carro já apontado pra saída. Quem chega no ápice ainda virando não consegue acelerar; quem chega apontado acelera antes de todo mundo.",
            oQueMede: [
                "Distância real entre a sua passagem e o ápice de referência (metros, a cada passagem)",
                "Tempo perdido no miolo da curva",
            ],
            ressalva: nil
        ),
        TreinoCatalogo(
            id: "pace",
            rotulo: "Início de aceleração",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Antecipar o ponto onde você abre o acelerador de vez (o PAce) — primeiro desvira, depois pisa, e pisa UMA vez só. Acelerar cedo com o volante torto suja o pneu da frente; acelerar tarde joga a reta fora.",
            oQueMede: [
                "Tempo perdido do ápice até a linha de saída (a fase de aceleração), comparado à melhor passagem",
                "Velocidade ao cruzar a linha de saída",
            ],
            ressalva: nil
        ),
        TreinoCatalogo(
            id: "saida",
            rotulo: "Saída",
            grupo: "ponto",
            etiqueta: "pleno",
            oQueE: "Cruzar a linha de saída com a maior velocidade que o trecho entrega — porque essa velocidade viaja a reta inteira junto com você. A saída se ganha com disciplina de acelerador, não com coragem.",
            oQueMede: [
                "Velocidade ao cruzar a linha de saída, comparada à melhor passagem histórica",
                "Tempo perdido na fase de aceleração (ápice → saída)",
            ],
            ressalva: nil
        ),
    ]

    static var tecnica: [TreinoCatalogo] { todos.filter { $0.grupo == "tecnica" } }
    static var pontos: [TreinoCatalogo] { todos.filter { $0.grupo == "ponto" } }
    static func por(id: String) -> TreinoCatalogo? { todos.first { $0.id == id } }
}

/// Parte do carro que o propósito "Testar o carro" foca (web subTestar).
enum FocoTeste: String, CaseIterable, Identifiable {
    case motor, freios, pneus, cambio, suspensao, eletrica
    var id: String { rawValue }
    var rotulo: String {
        switch self {
        case .motor: return "Motor"
        case .freios: return "Freios"
        case .pneus: return "Pneus e rodas"
        case .cambio: return "Câmbio"
        case .suspensao: return "Suspensão"
        case .eletrica: return "Elétrica"
        }
    }
}
