// ═══════════════════════════════════════════════════════════
// EventoMockSummary — dados mockados pareados com o mockup canônico
// ═══════════════════════════════════════════════════════════
// Fonte de verdade pros eventos do prompt #10 enquanto o fluxo real
// de criação de stint/volta não chega (Sprint 1A.3 entrega).
//
// Os IDs estão pinados em `EventoRepository.seedAtivoId` e nos dois
// `seedPassadoNId`. Trocar IDs lá exige trocar aqui também.
//
// Conteúdo bate 1:1 com:
//   - _design-reference/mockup-eventos-lista.html (seção "Passados")
//   - _design-reference/mockup-evento-detalhe.html (4 stints da volta
//     do dia 25/04)
//
// Sprint 1A.3 substitui esse mock pelo cálculo real (sessoes + voltas
// + segment_executions). Quando isso acontecer, este arquivo some.

import Foundation

struct EventoMockSummary: Equatable {
    let id: String
    /// Stints já feitos no evento (4 / 3).
    let stintsCount: Int
    /// Voltas totais somadas (47 / 32).
    let voltasCount: Int
    /// Melhor volta válida do evento, em ms (1:42.318 = 102_318).
    let melhorVoltaMs: Int?
    /// % "pronto" exibido como tag — mockup mostra "64% pronto" pro
    /// ativo de hoje e "100% pronto" implícito nos passados (não é
    /// exibido como tag, só no summary do detalhe).
    let pctPronto: Int
    /// Stints detalhados — só populado pros passados (pra preencher a
    /// lista no detalhe). O ativo retorna [] (CTA "Novo stint" só).
    let stintsDetalhados: [StintMock]
    /// S5 da rodada 1 (2026-05-12): velocidade máxima atingida no evento.
    /// Usado no resumo do evento passado. Nil pra eventos onde não foi
    /// medida (ativo hoje sem stints, ou seed antigo).
    var vmaxKmh: Double?
    /// S5 da rodada 1 (2026-05-12): quilometragem total estimada do
    /// evento. Mesma aproximação do S2.
    var kmTotal: Double?

    /// Formatação canônica "M:SS.mmm" (1:42.318) — vai no card da lista
    /// e na cell "Melhor" do summary do detalhe.
    func melhorVoltaFormatado() -> String? {
        guard let ms = melhorVoltaMs else { return nil }
        return formatTempoMs(ms)
    }

    /// Versão curta "M:SS.m" (1:42.3) — usada na cell pequena do summary
    /// do detalhe (4 colunas, espaço apertado). Mockup mostra "1:42.3".
    func melhorVoltaCurto() -> String? {
        guard let ms = melhorVoltaMs else { return nil }
        let minutos = ms / 60_000
        let segundos = (ms % 60_000) / 1000
        let decimo = (ms % 1000) / 100
        return String(format: "%d:%02d.%d", minutos, segundos, decimo)
    }
}

struct StintMock: Identifiable, Equatable {
    let id: String
    /// Posição na sequência (1, 2, 3, 4).
    let numero: Int
    /// Categoria do stint — "Aquecimento", "Atacar tempo", etc.
    let titulo: String
    /// Voltas dadas no stint (número exato).
    let voltas: Int
    /// Melhor volta do stint, em ms.
    let melhorVoltaMs: Int
    /// Nome do piloto (tag #1 do meta).
    let piloto: String
    /// Lição focada (tag #2 do meta) — "V-Min · apex", "Sem Coach", etc.
    let licao: String
    /// Tag especial opcional (tag #3) — "PB do dia" (ouro) / "Desvio < 0.4s" (bom).
    let tagEspecial: TagEspecialMock?
}

enum TagEspecialMock: Equatable {
    case pbDoDia
    case desvioBaixo
}

extension EventoMockSummary {
    /// Catálogo dos eventos seedados — chave = `EventoRepository.seedXId`.
    static let canonicos: [String: EventoMockSummary] = [
        // Próximo / ativo hoje (02/05) — 0 stints ainda, 64% pronto.
        "evt-mock-2026-05-02": EventoMockSummary(
            id: "evt-mock-2026-05-02",
            stintsCount: 0,
            voltasCount: 0,
            melhorVoltaMs: nil,
            pctPronto: 64,
            stintsDetalhados: []
        ),
        // Passado de 25/04 — 4 stints / 47 voltas / melhor 1:42.318.
        // Stints batem 1:1 com mockup-evento-detalhe.html.
        "evt-mock-2026-04-25": EventoMockSummary(
            id: "evt-mock-2026-04-25",
            stintsCount: 4,
            voltasCount: 47,
            melhorVoltaMs: 102_318,
            pctPronto: 100,
            stintsDetalhados: [
                StintMock(
                    id: "stint-mock-2026-04-25-1",
                    numero: 1,
                    titulo: "Aquecimento",
                    voltas: 11,
                    melhorVoltaMs: 104_302, // 1:44.302
                    piloto: "Flavio Marx",
                    licao: "Sem Coach",
                    tagEspecial: nil
                ),
                StintMock(
                    id: "stint-mock-2026-04-25-2",
                    numero: 2,
                    titulo: "Atacar tempo",
                    voltas: 14,
                    melhorVoltaMs: 102_318, // 1:42.318
                    piloto: "Flavio Marx",
                    licao: "V-Min · apex",
                    tagEspecial: .pbDoDia
                ),
                StintMock(
                    id: "stint-mock-2026-04-25-3",
                    numero: 3,
                    titulo: "Consistência",
                    voltas: 14,
                    melhorVoltaMs: 103_115, // 1:43.115
                    piloto: "Flavio Marx",
                    licao: "Referência Fixa",
                    tagEspecial: .desvioBaixo
                ),
                StintMock(
                    id: "stint-mock-2026-04-25-4",
                    numero: 4,
                    titulo: "Livre",
                    voltas: 8,
                    melhorVoltaMs: 103_521, // 1:43.521
                    piloto: "Bruno Marx",
                    licao: "Sem Coach",
                    tagEspecial: nil
                ),
            ],
            vmaxKmh: 187,
            kmTotal: 162
        ),
        // Passado de 28/03 — 3 stints / 32 voltas / melhor 1:43.847.
        // Detalhes simplificados (stints curtos pra alimentar a lista).
        "evt-mock-2026-03-28": EventoMockSummary(
            id: "evt-mock-2026-03-28",
            stintsCount: 3,
            voltasCount: 32,
            melhorVoltaMs: 103_847,
            pctPronto: 100,
            stintsDetalhados: [
                StintMock(
                    id: "stint-mock-2026-03-28-1",
                    numero: 1,
                    titulo: "Aquecimento",
                    voltas: 9,
                    melhorVoltaMs: 105_412,
                    piloto: "Flavio Marx",
                    licao: "Sem Coach",
                    tagEspecial: nil
                ),
                StintMock(
                    id: "stint-mock-2026-03-28-2",
                    numero: 2,
                    titulo: "Atacar tempo",
                    voltas: 12,
                    melhorVoltaMs: 103_847,
                    piloto: "Flavio Marx",
                    licao: "V-Min · apex",
                    tagEspecial: .pbDoDia
                ),
                StintMock(
                    id: "stint-mock-2026-03-28-3",
                    numero: 3,
                    titulo: "Consistência",
                    voltas: 11,
                    melhorVoltaMs: 104_201,
                    piloto: "Flavio Marx",
                    licao: "Referência Fixa",
                    tagEspecial: .desvioBaixo
                ),
            ],
            vmaxKmh: 178,
            kmTotal: 110
        ),
    ]

    /// Atalho — retorna o mock canônico pelo ID, ou nil se for evento
    /// criado pelo usuário (a UI cai no `sumarioPorEvento` real).
    static func canon(eventoId: String) -> EventoMockSummary? {
        canonicos[eventoId]
    }
}

// MARK: - Helpers de formatação compartilhados pelas Eventos views

/// "M:SS.mmm" — formatação canônica de tempo de volta no produto.
/// Bate 1:1 com o que o mockup mostra (ex: "1:42.318").
func formatTempoMs(_ ms: Int) -> String {
    let minutos = ms / 60_000
    let segundos = (ms % 60_000) / 1000
    let milisseg = ms % 1000
    return String(format: "%d:%02d.%03d", minutos, segundos, milisseg)
}
