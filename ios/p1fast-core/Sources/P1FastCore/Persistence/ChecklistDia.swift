import Foundation

// ════════════════════════════════════════════════════════════════════════
// Checklist do DIA do evento — lista FINAL aprovada pelo Flávio (24/06/2026) +
// engine que DISTRIBUI cada item por papel.
//
// Conceito: o que se faz UMA VEZ por dia (não repete a cada stint). Âncora =
// evento + dia (eventos duram 2+ dias; cada dia tem o seu). Dois momentos:
// início do dia e fim do dia. Mesma mecânica do checklist do stint.
//
// Contrato: _design-reference/propostas-premium-2026-06-21/
//           checklist-DIA-EVENTO-ORIENTACAO-FLAVIO-2026-06-24.md
//
// Cada item tem: momento (início/fim do dia), nível (obrigatório/desejável),
// quem FAZ e quem CONFERE (listas de papéis). Chefe de equipe pode fazer
// qualquer item. "Visitante" (convidado) não recebe item.
//
// IRMÃO de `ChecklistStint.swift` (por stint). Este é por DIA do evento.
// ════════════════════════════════════════════════════════════════════════

/// Momento do item no ciclo do dia do evento.
public enum MomentoDia: String, Codable, Sendable, CaseIterable {
    case inicio   // antes da primeira ida à pista
    case fim      // depois da última ida à pista

    public var rotulo: String {
        switch self {
        case .inicio: return "Início do dia"
        case .fim:    return "Fim do dia"
        }
    }
}

/// Um item do checklist do dia, com os papéis responsáveis.
public struct ItemChecklistDia: Identifiable, Sendable {
    public let id: String
    public let nome: String
    public let momento: MomentoDia
    /// true = obrigatório (trava o finalizar); false = desejável (livre).
    public let obrigatorio: Bool
    /// Papéis que podem EXECUTAR o item.
    public let faz: [PapelPessoa]
    /// Papéis que podem CONFERIR o item.
    public let confere: [PapelPessoa]

    public init(id: String, nome: String, momento: MomentoDia, obrigatorio: Bool,
                faz: [PapelPessoa], confere: [PapelPessoa]) {
        self.id = id; self.nome = nome; self.momento = momento
        self.obrigatorio = obrigatorio; self.faz = faz; self.confere = confere
    }

    /// Esse papel é responsável pelo item (faz OU confere)?
    public func responsavel(_ papel: PapelPessoa) -> Bool {
        faz.contains(papel) || confere.contains(papel)
    }
}

/// Catálogo FINAL do checklist do dia (20 início + 3 fim = 23 itens).
public enum CatalogoChecklistDia {

    private static let P = PapelPessoa.piloto
    private static let M = PapelPessoa.mecanico
    private static let E = PapelPessoa.engenheiro
    private static let C = PapelPessoa.chefeEquipe   // Chefe de equipe

    public static let padrao: [ItemChecklistDia] = [
        // ── Início do dia (antes da primeira ida à pista) — 20 ──
        ItemChecklistDia(id: "ini-01", nome: "Vistoria técnica do dia aprovada",                                    momento: .inicio, obrigatorio: true,  faz: [C],    confere: [E, C]),
        ItemChecklistDia(id: "ini-02", nome: "Torque geral de suspensão e chassi conferido",                        momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-03", nome: "Níveis completos no começo do dia (óleo, água, freio)",               momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-04", nome: "Combustível do dia conferido / reserva",                              momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-05", nome: "Rádios e baterias carregados",                                        momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-06", nome: "Telemetria e câmera configuradas e testadas (uma vez)",               momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-07", nome: "Equipamento de segurança do box no lugar (extintor, primeiros socorros)", momento: .inicio, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-08", nome: "Pneus do dia separados e identificados",                              momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-09", nome: "Instalar o transponder",                                              momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-10", nome: "Pegar pulseira de Piloto",                                            momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-11", nome: "Adesivar o carro com o nr do evento",                                 momento: .inicio, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistDia(id: "ini-12", nome: "Checar tampas do reservatório do líquido de arrefecimento",          momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-13", nome: "Checar tampa do radiador",                                            momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-14", nome: "Checar conexão no borne da bateria",                                  momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-15", nome: "Checar tampa de óleo do motor",                                       momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-16", nome: "Checar bujão do cárter do óleo",                                      momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-17", nome: "Checar parafusos da suspensão se estão apertados",                    momento: .inicio, obrigatorio: false, faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-18", nome: "Checar nível do fluido de freio",                                     momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-19", nome: "Checar nível do líquido de arrefecimento",                            momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "ini-20", nome: "Checar folga nas mangueiras do motor e radiador",                     momento: .inicio, obrigatorio: true,  faz: [E, C], confere: [C]),

        // ── Fim do dia (depois da última ida à pista) — 3 ──
        ItemChecklistDia(id: "fim-01", nome: "Combustível restante medido e registrado",                           momento: .fim,    obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "fim-02", nome: "Pneus do dia registrados (ciclos / desgaste)",                        momento: .fim,    obrigatorio: true,  faz: [E, C], confere: [C]),
        ItemChecklistDia(id: "fim-03", nome: "Checar se tem vazamentos ou algo solto",                              momento: .fim,    obrigatorio: true,  faz: [E, C], confere: [C]),
    ]

    /// Ordem dos papéis da equipe pra exibição/resumo.
    public static let papeisEquipe: [PapelPessoa] = [.piloto, .mecanico, .engenheiro, .chefeEquipe, .convidado]
}

/// Distribuição do checklist do dia por papel — o que cada pessoa recebe.
/// Lógica PURA (sem banco), testável. Espelha `DistribuicaoStint`.
public enum DistribuicaoDia {

    /// Itens de um momento do dia.
    public static func itensDoMomento(_ momento: MomentoDia,
                                      catalogo: [ItemChecklistDia] = CatalogoChecklistDia.padrao) -> [ItemChecklistDia] {
        catalogo.filter { $0.momento == momento }
    }

    /// Itens de um papel (faz OU confere) num momento — a "lista da pessoa".
    public static func itensDaPessoa(papel: PapelPessoa, momento: MomentoDia,
                                     catalogo: [ItemChecklistDia] = CatalogoChecklistDia.padrao) -> [ItemChecklistDia] {
        itensDoMomento(momento, catalogo: catalogo).filter { $0.responsavel(papel) }
    }

    /// Quantos itens cada papel recebe num momento (pra tela).
    public static func resumoPorPapel(momento: MomentoDia,
                                      catalogo: [ItemChecklistDia] = CatalogoChecklistDia.padrao) -> [(papel: PapelPessoa, qtd: Int)] {
        CatalogoChecklistDia.papeisEquipe.map { p in
            (p, itensDaPessoa(papel: p, momento: momento, catalogo: catalogo).count)
        }
    }

    /// Itens OBRIGATÓRIOS ainda NÃO marcados — pendências que travam o
    /// finalizar e acendem o aviso (Command Box + chefe). Desejável nunca entra.
    public static func pendenciasObrigatorias(momento: MomentoDia, marcados: Set<String>,
                                              catalogo: [ItemChecklistDia] = CatalogoChecklistDia.padrao) -> [ItemChecklistDia] {
        itensDoMomento(momento, catalogo: catalogo).filter { $0.obrigatorio && !marcados.contains($0.id) }
    }

    /// Pendências obrigatórias de UM papel (o que falta àquela pessoa).
    public static func pendenciasDaPessoa(papel: PapelPessoa, momento: MomentoDia,
                                          marcados: Set<String>) -> [ItemChecklistDia] {
        itensDaPessoa(papel: papel, momento: momento).filter { $0.obrigatorio && !marcados.contains($0.id) }
    }
}
