import Foundation

// ════════════════════════════════════════════════════════════════════════
// Checklist do stint — lista FINAL aprovada pelo Flávio (23-24/06/2026) +
// engine que DISTRIBUI cada item por papel quando o stint é criado.
//
// Contrato: _design-reference/propostas-premium-2026-06-21/
//           checklist-stint-ORIENTACAO-FLAVIO-2026-06-23.md
//
// Cada item tem: momento (pré/pós), nível (obrigatório/desejável), quem FAZ
// e quem CONFERE (listas de papéis — mais de uma pessoa pode). Chefe de equipe
// pode fazer qualquer item. "Visitante" (convidado) não recebe item.
//
// NÃO confundir com `ChecklistCatalogo` (lista antiga de 1 papel só, ainda não
// ligada a tela). Este é o catálogo novo, multi-papel, que vale.
// ════════════════════════════════════════════════════════════════════════

/// Momento do item no ciclo do stint.
public enum MomentoStint: String, Codable, Sendable, CaseIterable {
    case pre   // saída — antes de rodar
    case pos   // chegada — depois de rodar

    public var rotulo: String {
        switch self {
        case .pre: return "Antes de rodar"
        case .pos: return "Depois de rodar"
        }
    }
}

/// Um item do checklist do stint, com os papéis responsáveis.
public struct ItemChecklistStint: Identifiable, Sendable {
    public let id: String
    public let nome: String
    public let momento: MomentoStint
    /// true = obrigatório (trava o finalizar); false = desejável (livre).
    public let obrigatorio: Bool
    /// Papéis que podem EXECUTAR o item.
    public let faz: [PapelPessoa]
    /// Papéis que podem CONFERIR o item.
    public let confere: [PapelPessoa]
    /// true = só vale em certa condição (ex.: "se tiver carona").
    public let condicional: Bool

    public init(id: String, nome: String, momento: MomentoStint, obrigatorio: Bool,
                faz: [PapelPessoa], confere: [PapelPessoa], condicional: Bool = false) {
        self.id = id; self.nome = nome; self.momento = momento
        self.obrigatorio = obrigatorio; self.faz = faz; self.confere = confere
        self.condicional = condicional
    }

    /// Esse papel é responsável pelo item (faz OU confere)?
    public func responsavel(_ papel: PapelPessoa) -> Bool {
        faz.contains(papel) || confere.contains(papel)
    }
}

/// Catálogo FINAL do checklist do stint (17 pré + 8 pós).
public enum CatalogoChecklistStint {

    private static let P = PapelPessoa.piloto
    private static let M = PapelPessoa.mecanico
    private static let E = PapelPessoa.engenheiro
    private static let C = PapelPessoa.chefeEquipe   // Chefe de equipe

    public static let padrao: [ItemChecklistStint] = [
        // ── Pré-stint (saída) — 17 ──
        ItemChecklistStint(id: "pre-01", nome: "Capacete e equipamento do piloto travados", momento: .pre, obrigatorio: true,  faz: [P, C], confere: [M, E, C]),
        ItemChecklistStint(id: "pre-02", nome: "Cinto de 6 pontos regulado (piloto)",        momento: .pre, obrigatorio: true,  faz: [P, C], confere: [M, E, C]),
        ItemChecklistStint(id: "pre-03", nome: "Cinto de 5 pontos regulado (carona)",        momento: .pre, obrigatorio: true,  faz: [P, C], confere: [M, E, C], condicional: true),
        ItemChecklistStint(id: "pre-04", nome: "Freios sangrados · pedal firme",             momento: .pre, obrigatorio: true,  faz: [M, E, C], confere: [P]),
        ItemChecklistStint(id: "pre-05", nome: "Pressão de óleo OK",                          momento: .pre, obrigatorio: true,  faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-06", nome: "Nível de água / arrefecimento",              momento: .pre, obrigatorio: true,  faz: [M, E, C], confere: []),
        ItemChecklistStint(id: "pre-07", nome: "Pneus calibrados (a frio)",                  momento: .pre, obrigatorio: true,  faz: [M, C], confere: [E]),
        ItemChecklistStint(id: "pre-08", nome: "Porcas de roda no torque",                   momento: .pre, obrigatorio: true,  faz: [M, E, C], confere: []),
        ItemChecklistStint(id: "pre-09", nome: "Combustível suficiente pro stint",           momento: .pre, obrigatorio: true,  faz: [P, C], confere: [M, E, C]),
        ItemChecklistStint(id: "pre-10", nome: "Retirar Trava do Extintor",                  momento: .pre, obrigatorio: true,  faz: [P, C], confere: [M, E, C]),
        ItemChecklistStint(id: "pre-11", nome: "Rádio / comunicação testada",                momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-12", nome: "Câmera ligada e gravando",                   momento: .pre, obrigatorio: false, faz: [P, E, C], confere: [C]),
        ItemChecklistStint(id: "pre-13", nome: "Telemetria transmitindo",                    momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-14", nome: "Checar tampa de óleo do motor",              momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-15", nome: "Checar tampa do líquido de arrefecimento",   momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-16", nome: "Checar conexão de combustível no motor",     momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pre-17", nome: "Ver se tem item solto dentro da cabine",     momento: .pre, obrigatorio: false, faz: [P, C], confere: [C]),

        // ── Pós-stint (chegada) — 8 ──
        ItemChecklistStint(id: "pos-01", nome: "Pressão e temperatura dos pneus (quentes)",  momento: .pos, obrigatorio: true,  faz: [M, E, C], confere: []),
        ItemChecklistStint(id: "pos-02", nome: "Telemetria salva / descarregada",            momento: .pos, obrigatorio: true,  faz: [C], confere: []),
        ItemChecklistStint(id: "pos-03", nome: "Combustível restante medido",                momento: .pos, obrigatorio: true,  faz: [M, E, C], confere: [P, C]),
        ItemChecklistStint(id: "pos-04", nome: "Nível de óleo conferido",                    momento: .pos, obrigatorio: true,  faz: [P, C], confere: [M, E, C]),
        ItemChecklistStint(id: "pos-05", nome: "Freios e pastilhas inspecionados",           momento: .pos, obrigatorio: true,  faz: [M, E, C], confere: []),
        ItemChecklistStint(id: "pos-06", nome: "Danos / avarias inspecionados",              momento: .pos, obrigatorio: false, faz: [M, E, C], confere: []),
        ItemChecklistStint(id: "pos-07", nome: "Notas do piloto registradas",                momento: .pos, obrigatorio: false, faz: [P, C], confere: [C]),
        ItemChecklistStint(id: "pos-08", nome: "Próximo stint planejado",                    momento: .pos, obrigatorio: false, faz: [C], confere: [C]),
    ]

    /// Ordem dos papéis da equipe pra exibição/resumo.
    public static let papeisEquipe: [PapelPessoa] = [.piloto, .mecanico, .engenheiro, .chefeEquipe, .convidado]
}

/// Distribuição do checklist por papel — o que cada pessoa recebe quando o
/// stint é criado. Lógica PURA (sem banco), testável.
public enum DistribuicaoStint {

    /// Itens ATIVOS de um momento (tira os condicionais quando não se aplicam).
    public static func itensAtivos(momento: MomentoStint, temCarona: Bool = false,
                                   catalogo: [ItemChecklistStint] = CatalogoChecklistStint.padrao) -> [ItemChecklistStint] {
        catalogo.filter { $0.momento == momento && (!$0.condicional || temCarona) }
    }

    /// Itens de um papel (faz OU confere) num momento — a "lista da pessoa".
    public static func itensDaPessoa(papel: PapelPessoa, momento: MomentoStint, temCarona: Bool = false,
                                     catalogo: [ItemChecklistStint] = CatalogoChecklistStint.padrao) -> [ItemChecklistStint] {
        itensAtivos(momento: momento, temCarona: temCarona, catalogo: catalogo)
            .filter { $0.responsavel(papel) }
    }

    /// Quantos itens cada papel da equipe recebe num momento (pra tela de criar stint).
    public static func resumoPorPapel(momento: MomentoStint, temCarona: Bool = false,
                                      catalogo: [ItemChecklistStint] = CatalogoChecklistStint.padrao) -> [(papel: PapelPessoa, qtd: Int)] {
        CatalogoChecklistStint.papeisEquipe.map { p in
            (p, itensDaPessoa(papel: p, momento: momento, temCarona: temCarona, catalogo: catalogo).count)
        }
    }

    /// Itens OBRIGATÓRIOS ainda NÃO marcados — as pendências que travam o
    /// finalizar e acendem o aviso (Command Box + chefe). Desejável nunca entra.
    public static func pendenciasObrigatorias(momento: MomentoStint, marcados: Set<String>,
                                              temCarona: Bool = false,
                                              catalogo: [ItemChecklistStint] = CatalogoChecklistStint.padrao) -> [ItemChecklistStint] {
        itensAtivos(momento: momento, temCarona: temCarona, catalogo: catalogo)
            .filter { $0.obrigatorio && !marcados.contains($0.id) }
    }

    /// Pendências obrigatórias de UM papel (o que falta àquela pessoa).
    public static func pendenciasDaPessoa(papel: PapelPessoa, momento: MomentoStint, marcados: Set<String>,
                                          temCarona: Bool = false) -> [ItemChecklistStint] {
        itensDaPessoa(papel: papel, momento: momento, temCarona: temCarona)
            .filter { $0.obrigatorio && !marcados.contains($0.id) }
    }
}
