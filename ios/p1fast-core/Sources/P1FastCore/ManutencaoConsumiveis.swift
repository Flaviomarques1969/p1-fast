// ═══════════════════════════════════════════════════════════
// ManutencaoConsumiveis — domínio do modelo CHECAGEM ≠ TROCA
// (reforma 2026-05-31, a partir do instrumento de consumíveis do
//  Celta 1.4 de corrida "Bubi" e da auditoria da função Manutenção
//  órfã de 2026-05-18 — porta a lógica testada SEM as dependências
//  velhas: cálculo de uso por HORAS + média aprendida + anomalia.)
// ═══════════════════════════════════════════════════════════
// Modelo definido pelo Flávio: cada consumível tem até 2 atividades
// SEPARADAS:
//   ① CHECAGEM — inspeção recorrente (quando + ação). Entra no
//      checklist do evento. Não troca nada por si.
//   ② TROCA — reposição, em 4 modos:
//      - peloResultado     : troca condicional, disparada pela checagem
//      - limiteMaximo      : prazo fixo (horas / eventos / meses / validade)
//      - preditivoPorHoras : registra novo, conta horas, aprende a média
//                            de vida e avisa antes (pneu, pastilha,
//                            disco, embreagem)
//      - soRecomendacao    : lembrete sem alerta automático
//
// Camada de domínio PURO — sem banco, sem UI, sem GRDB. Testável por
// p1fast-smoke. As camadas de persistência e telas consomem isto.

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - ① CHECAGEM
// ─────────────────────────────────────────────────────────────

/// Quando a checagem recorrente acontece.
public enum QuandoChecar: Codable, Sendable, Hashable {
    case antesEvento
    case depoisEvento
    case todoEvento
    case aCadaHoras(Int)
    case aCadaEventos(Int)

    /// Frase legível pro checklist e pro prompt.
    public var descricao: String {
        switch self {
        case .antesEvento:       return "Antes do evento"
        case .depoisEvento:      return "Depois do evento"
        case .todoEvento:        return "Todo evento"
        case .aCadaHoras(let h): return "A cada \(h) horas de uso"
        case .aCadaEventos(let e): return "A cada \(e) evento\(e == 1 ? "" : "s")"
        }
    }
}

/// O que a checagem faz fisicamente.
public enum AcaoChecagem: String, Codable, Sendable, Hashable, CaseIterable {
    case inspecionar = "Inspecionar"
    case medir       = "Medir"
    case lavar       = "Lavar"
    case reapertar   = "Reapertar"
    case testar      = "Testar"
    case conferir    = "Conferir"
    case lerVela     = "Ler vela"
}

/// Atividade de checagem de um consumível.
public struct Checagem: Codable, Sendable, Hashable {
    public var ativa: Bool
    public var quando: QuandoChecar
    public var acao: AcaoChecagem

    public init(ativa: Bool, quando: QuandoChecar, acao: AcaoChecagem) {
        self.ativa = ativa; self.quando = quando; self.acao = acao
    }

    public static let nenhuma = Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar)
}

// ─────────────────────────────────────────────────────────────
// MARK: - ② TROCA
// ─────────────────────────────────────────────────────────────

/// Unidade do limite máximo fixo.
public enum UnidadeLimite: String, Codable, Sendable, Hashable, CaseIterable {
    case horas    = "Horas de uso"
    case eventos  = "Eventos"
    case meses    = "Meses"
    case validade = "Validade (etiqueta)"
}

/// Modo de troca do consumível.
public enum ModoTroca: Codable, Sendable, Hashable {
    /// Troca condicional — sem prazo fixo; a checagem é que dispara.
    case peloResultado
    /// Prazo obrigatório. `valor` nil só faz sentido em `.validade`
    /// (a data vem da etiqueta cadastrada item a item).
    case limiteMaximo(valor: Double?, unidade: UnidadeLimite)
    /// IA aprende as horas de vida e avisa antes.
    case preditivoPorHoras
    /// Lembrete sem alerta automático.
    case soRecomendacao

    /// Token curto pra UI/realce (espelha o instrumento HTML).
    public var token: String {
        switch self {
        case .peloResultado:     return "resultado"
        case .limiteMaximo:      return "limite"
        case .preditivoPorHoras: return "preditivo"
        case .soRecomendacao:    return "rec"
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Definição do consumível + catálogo dos 30
// ─────────────────────────────────────────────────────────────

public struct ConsumivelDef: Codable, Sendable, Hashable, Identifiable {
    public let codigo: String
    public let nome: String
    public let bloco: String
    public let area: String
    /// "catalogo" (já existia no app) | "novo" (acrescentado na reforma).
    public let origem: String
    public let checagem: Checagem
    public let troca: ModoTroca
    public let criterio: String

    public var id: String { codigo }

    public init(codigo: String, nome: String, bloco: String, area: String,
                origem: String, checagem: Checagem, troca: ModoTroca, criterio: String) {
        self.codigo = codigo; self.nome = nome; self.bloco = bloco; self.area = area
        self.origem = origem; self.checagem = checagem; self.troca = troca; self.criterio = criterio
    }
}

/// Catálogo embarcado dos 30 consumíveis do Celta 1.4 de corrida.
/// Fonte: instrumento `_design-reference/planejamento-consumiveis-celta.html`
/// (proposta v4 aprovada com as orientações do Flávio).
public enum CatalogoConsumiveisCelta {
    public static let itens: [ConsumivelDef] = [
        // ── Motor — lubrificação ──────────────────────────────
        ConsumivelDef(codigo: "oleo_motor", nome: "Óleo do motor",
            bloco: "Motor — lubrificação", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .conferir),
            troca: .limiteMaximo(valor: 2, unidade: .horas),
            criterio: "A 6.000+ rpm e 110–130 °C o óleo cisalha. Troca preventiva curta protege bronzina e comando. Sintético de competição (10W50/15W50)."),
        ConsumivelDef(codigo: "filtro_oleo", nome: "Filtro de óleo",
            bloco: "Motor — lubrificação", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 2, unidade: .horas),
            criterio: "Troca sempre junto do óleo. Cortar o filtro usado revela limalha — alerta de desgaste interno."),
        ConsumivelDef(codigo: "analise_oleo", nome: "Análise de óleo (laboratório)",
            bloco: "Motor — lubrificação", area: "Motor", origem: "novo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .soRecomendacao,
            criterio: "Análise espectrométrica detecta metal de bronzina/anel antes da quebra. Recomendação, sem alerta."),

        // ── Arrefecimento ─────────────────────────────────────
        ConsumivelDef(codigo: "liquido_arref", nome: "Líquido de arrefecimento + aditivo",
            bloco: "Arrefecimento", area: "Refrigeração", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .conferir),
            troca: .limiteMaximo(valor: 12, unidade: .horas),
            criterio: "Água desmineralizada + aditivo de alto ponto de ebulição. O aditivo perde proteção; trocar por uso."),
        ConsumivelDef(codigo: "mangueiras_arref", nome: "Mangueiras e abraçadeiras",
            bloco: "Arrefecimento", area: "Refrigeração", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 24, unidade: .meses),
            criterio: "Mangueira ressecada estoura e funde o motor. Revisar/reapertar todo evento; trocar no máximo em 24 meses."),

        // ── Ignição e combustível ─────────────────────────────
        ConsumivelDef(codigo: "velas", nome: "Velas de ignição",
            bloco: "Ignição e combustível", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .lerVela),
            troca: .limiteMaximo(valor: 24, unidade: .horas),
            criterio: "Grau térmico casa com a preparação. Ler a cor do eletrodo após a corrida diagnostica mistura/avanço."),
        ConsumivelDef(codigo: "filtro_ar", nome: "Filtro de ar (lavável)",
            bloco: "Ignição e combustível", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .depoisEvento, acao: .lavar),
            troca: .peloResultado,
            criterio: "Filtro lavável: lavar e re-olear após cada evento (poeira de Brasília). Troca só quando a lavagem não recupera."),
        ConsumivelDef(codigo: "filtro_combustivel", nome: "Filtro de combustível (lavável)",
            bloco: "Ignição e combustível", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .depoisEvento, acao: .lavar),
            troca: .peloResultado,
            criterio: "Filtro lavável: lavar ao final de cada evento. Troca pelo resultado (queda de pressão/sujeira que não sai)."),

        // ── Freios (segurança) ────────────────────────────────
        ConsumivelDef(codigo: "fluido_freio", nome: "Fluido de freio (DOT 5.1)",
            bloco: "Freios (segurança)", area: "Freios", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 2, unidade: .horas),
            criterio: "DOT 5.1 ferve nas frenagens fortes e puxa umidade. Sangrar = trocar, por horas, purgando cada pinça."),
        ConsumivelDef(codigo: "pastilhas", nome: "Pastilhas de freio",
            bloco: "Freios (segurança)", area: "Freios", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .medir),
            troca: .preditivoPorHoras,
            criterio: "Composto de competição gasta rápido (dianteira muito mais). Medir todo evento; o app aprende o consumo e prevê a troca."),
        ConsumivelDef(codigo: "discos", nome: "Discos de freio",
            bloco: "Freios (segurança)", area: "Freios", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .antesEvento, acao: .medir),
            troca: .preditivoPorHoras,
            criterio: "Ciclo térmico trinca/empena. Medir espessura antes de todo evento; vincular às horas e prever a troca."),
        ConsumivelDef(codigo: "linhas_freio", nome: "Linhas / flexíveis de freio",
            bloco: "Freios (segurança)", area: "Freios", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 24, unidade: .meses),
            criterio: "Flexível estufa/racha com pressão e calor. Checar todo evento; trocar no máximo em 24 meses, e antes se a checagem apontar."),

        // ── Pneus, rodas e geometria ──────────────────────────
        ConsumivelDef(codigo: "pneus", nome: "Pneus",
            bloco: "Pneus, rodas e geometria", area: "Pneus", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .medir),
            troca: .preditivoPorHoras,
            criterio: "Maior fator de tempo de volta. Medir todo evento; registra o pneu novo, conta as HORAS, aprende a vida e avisa."),
        ConsumivelDef(codigo: "geometria", nome: "Geometria (alinhamento/cambagem/convergência)",
            bloco: "Pneus, rodas e geometria", area: "Suspensão", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .conferir),
            troca: .peloResultado,
            criterio: "Setup de pista; zebra e toque desregulam. Conferir todo evento e após impacto. Ajuste pelo resultado."),
        ConsumivelDef(codigo: "rolamentos", nome: "Rolamentos de roda",
            bloco: "Pneus, rodas e geometria", area: "Rodas", origem: "novo",
            checagem: Checagem(ativa: true, quando: .aCadaHoras(8), acao: .inspecionar),
            troca: .peloResultado,
            criterio: "Carga lateral mata rolamento (dianteiro sofre mais). Checar folga/ruído a cada 8 horas; trocar pelo resultado."),
        ConsumivelDef(codigo: "reaperto_rodas", nome: "Reaperto de rodas (torque)",
            bloco: "Pneus, rodas e geometria", area: "Rodas", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .reapertar),
            troca: .peloResultado,
            criterio: "2 etapas: apertar, ~3 voltas, voltar ao box e reapertar no torque (~95 N·m — confirmar no manual do Celta). Roda solta é acidente grave."),

        // ── Suspensão e direção ───────────────────────────────
        ConsumivelDef(codigo: "amortecedores", nome: "Amortecedores",
            bloco: "Suspensão e direção", area: "Suspensão", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .aCadaHoras(6), acao: .testar),
            troca: .peloResultado,
            criterio: "Amortecedor de pista perde gás e vaza. Testar a cada 6 horas; trocar depende da condição (varia muito)."),
        ConsumivelDef(codigo: "articulacoes", nome: "Articulações (terminais, pivôs, bieletas, buchas, barra estab.)",
            bloco: "Suspensão e direção", area: "Suspensão", origem: "novo",
            checagem: Checagem(ativa: true, quando: .aCadaEventos(1), acao: .inspecionar),
            troca: .peloResultado,
            criterio: "Folga aqui bagunça a geometria. Checar folga a cada evento; trocar quando a checagem apontar."),
        ConsumivelDef(codigo: "coxins", nome: "Coxins de motor e câmbio",
            bloco: "Suspensão e direção", area: "Motor", origem: "novo",
            checagem: Checagem(ativa: true, quando: .aCadaEventos(3), acao: .inspecionar),
            troca: .peloResultado,
            criterio: "Vibração racha coxim; solto, o motor 'pula' e desalinha as marchas. Checar a cada 3 eventos; trocar pelo resultado."),

        // ── Transmissão ───────────────────────────────────────
        ConsumivelDef(codigo: "oleo_cambio", nome: "Óleo do câmbio",
            bloco: "Transmissão", area: "Câmbio", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 2, unidade: .horas),
            criterio: "Câmbio sofre calor e trocas brutas. Troca por horas; olhar cor/cheiro e a limalha no bujão magnético. ~75W90 GL-4."),
        ConsumivelDef(codigo: "embreagem", nome: "Embreagem (disco / platô / rolamento)",
            bloco: "Transmissão", area: "Embreagem", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .preditivoPorHoras,
            criterio: "Largadas castigam. Informa quando é nova; o app conta as horas, aprende a vida e avisa antes do problema."),
        ConsumivelDef(codigo: "homocineticas", nome: "Homocinéticas e coifas",
            bloco: "Transmissão", area: "Câmbio", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .peloResultado,
            criterio: "Tração dianteira: coifa rasgada perde graxa e a junta morre. Checar coifa/graxa todo evento; trocar pelo resultado."),

        // ── Distribuição (crítico) ────────────────────────────
        ConsumivelDef(codigo: "correia_dentada", nome: "Kit correia dentada (correia + tensor + polias)",
            bloco: "Distribuição (crítico)", area: "Motor", origem: "catalogo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .conferir),
            troca: .limiteMaximo(valor: 12, unidade: .meses),
            criterio: "Motor de interferência: se arrebenta, destrói o motor. Conferir tensão por evento; trocar o KIT no máx. a cada 12 meses, nunca pelo km de rua."),
        ConsumivelDef(codigo: "correia_acessorios", nome: "Correia de acessórios",
            bloco: "Distribuição (crítico)", area: "Motor", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 8, unidade: .eventos),
            criterio: "Aciona alternador (e bomba conforme layout). Inspecionar por evento; troca preventiva ~1 temporada. Cuidar do tensor."),

        // ── Elétrica ──────────────────────────────────────────
        ConsumivelDef(codigo: "bateria", nome: "Bateria",
            bloco: "Elétrica", area: "Elétrica", origem: "catalogo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 24, unidade: .meses),
            criterio: "Vibração mata bateria e solta terminal. Fixação reforçada, carregar entre eventos, validade ~2 anos. Conferir corta-corrente."),
        ConsumivelDef(codigo: "cabos_vela", nome: "Cabos de vela / bobina",
            bloco: "Elétrica", area: "Elétrica", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: 12, unidade: .eventos),
            criterio: "Isolação rompida → falha de ignição intermitente, difícil de achar. Inspecionar por evento; jogo reserva no box."),

        // ── Segurança — validade regulamentar (não negociável) ─
        ConsumivelDef(codigo: "cintos", nome: "Cintos de competição (5/6 pontos)",
            bloco: "Segurança — validade regulamentar", area: "Acessórios", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: nil, unidade: .validade),
            criterio: "Validade legal da etiqueta FIA/CBA (~5 anos). Inspecionar fitas/fivela todo evento; trocar pela validade."),
        ConsumivelDef(codigo: "extintor", nome: "Extintor / sistema de incêndio",
            bloco: "Segurança — validade regulamentar", area: "Acessórios", origem: "novo",
            checagem: Checagem(ativa: true, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: nil, unidade: .validade),
            criterio: "Carga/pressão vencem. Conferir manômetro todo evento; trocar/recarregar pela validade. Item de vistoria."),
        ConsumivelDef(codigo: "banco_concha", nome: "Banco de competição (concha FIA)",
            bloco: "Segurança — validade regulamentar", area: "Acessórios", origem: "novo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: nil, unidade: .validade),
            criterio: "Validade FIA (~5 anos da etiqueta). Junto com o cinto, segura o piloto no impacto."),
        ConsumivelDef(codigo: "equipamento_piloto", nome: "Equipamento do piloto (capacete, macacão, luvas, HANS)",
            bloco: "Segurança — validade regulamentar", area: "Acessórios", origem: "novo",
            checagem: Checagem(ativa: false, quando: .todoEvento, acao: .inspecionar),
            troca: .limiteMaximo(valor: nil, unidade: .validade),
            criterio: "Cada peça tem validade FIA e é item de vistoria. Capacete que levou pancada se descarta mesmo na validade."),
    ]

    public static func find(_ codigo: String) -> ConsumivelDef? {
        itens.first { $0.codigo == codigo }
    }

    /// Itens agrupados por bloco, preservando a ordem do catálogo.
    public static func porBloco() -> [(String, [ConsumivelDef])] {
        var ordem: [String] = []
        var mapa: [String: [ConsumivelDef]] = [:]
        for item in itens {
            if mapa[item.bloco] == nil { ordem.append(item.bloco) }
            mapa[item.bloco, default: []].append(item)
        }
        return ordem.map { ($0, mapa[$0] ?? []) }
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Contador de uso + status
// ─────────────────────────────────────────────────────────────

/// Quanto rodou desde a última troca daquele item. Foco em HORAS
/// (corrida não usa km de rua). `eventos` = quantos eventos desde a
/// troca; `dias` = dias calendário (pros limites por mês/validade).
public struct ContadorUso: Equatable, Sendable {
    public var horas: Double
    public var eventos: Int
    public var dias: Int

    public init(horas: Double = 0, eventos: Int = 0, dias: Int = 0) {
        self.horas = horas; self.eventos = eventos; self.dias = dias
    }
    public static let zero = ContadorUso()
}

public enum SeveridadeManutencao: String, Codable, Sendable, Hashable, CaseIterable {
    /// Dentro do limite (≤ 80%).
    case verde
    /// Aproximando (80–100%).
    case amarelo
    /// Vencido (> 100%).
    case vermelho
    /// Troca condicional — depende da checagem, sem prazo.
    case condicional
    /// Só recomendação — sem alerta.
    case recomendacao
    /// Falta dado pra calcular (preditivo sem histórico, ou validade sem data).
    case semHistorico
}

public struct StatusManutencao: Equatable, Sendable {
    public let severidade: SeveridadeManutencao
    /// Fração da vida consumida (0…>1). nil quando não há cálculo automático.
    public let fracao: Double?
    public let resumo: String

    public init(severidade: SeveridadeManutencao, fracao: Double?, resumo: String) {
        self.severidade = severidade; self.fracao = fracao; self.resumo = resumo
    }
}

/// Severidade a partir de uma fração de vida consumida.
public func severidadePorFracao(_ f: Double) -> SeveridadeManutencao {
    if f >= 1.0 { return .vermelho }
    if f >= 0.8 { return .amarelo }
    return .verde
}

/// Avalia o status da TROCA combinando o modo + o contador de uso.
/// - `diasAteValidade`: pros itens `.validade` (dias até a data da etiqueta;
///    negativo = já vencido). nil → ainda não cadastrado.
/// - `mediaHorasAprendida`: pros itens preditivos (média de vida em horas
///    aprendida do histórico). nil → ainda aprendendo.
public func avaliarTroca(troca: ModoTroca,
                         contador: ContadorUso,
                         diasAteValidade: Int? = nil,
                         mediaHorasAprendida: Double? = nil) -> StatusManutencao {
    switch troca {
    case .peloResultado:
        return StatusManutencao(severidade: .condicional, fracao: nil,
                                resumo: "Troca pelo resultado da checagem.")
    case .soRecomendacao:
        return StatusManutencao(severidade: .recomendacao, fracao: nil,
                                resumo: "Só recomendação — sem alerta automático.")
    case .limiteMaximo(let valor, let unidade):
        return avaliarLimite(valor: valor, unidade: unidade,
                             contador: contador, diasAteValidade: diasAteValidade)
    case .preditivoPorHoras:
        return avaliarPreditivo(contador: contador, mediaHoras: mediaHorasAprendida)
    }
}

private func avaliarLimite(valor: Double?, unidade: UnidadeLimite,
                           contador: ContadorUso, diasAteValidade: Int?) -> StatusManutencao {
    switch unidade {
    case .horas:
        guard let v = valor, v > 0 else { return semCalculo("Limite de horas não definido.") }
        let f = contador.horas / v
        return StatusManutencao(severidade: severidadePorFracao(f), fracao: f,
            resumo: folgaTexto(restante: v - contador.horas, unidade: "h", decimais: 1))
    case .eventos:
        guard let v = valor, v > 0 else { return semCalculo("Limite de eventos não definido.") }
        let f = Double(contador.eventos) / v
        return StatusManutencao(severidade: severidadePorFracao(f), fracao: f,
            resumo: folgaTexto(restante: v - Double(contador.eventos), unidade: "evento(s)", decimais: 0))
    case .meses:
        guard let v = valor, v > 0 else { return semCalculo("Limite de meses não definido.") }
        let limiteDias = v * 30.0
        let f = Double(contador.dias) / limiteDias
        return StatusManutencao(severidade: severidadePorFracao(f), fracao: f,
            resumo: folgaTexto(restante: limiteDias - Double(contador.dias), unidade: "dias", decimais: 0))
    case .validade:
        guard let dias = diasAteValidade else {
            return semCalculo("Informe a data da etiqueta pra controlar a validade.")
        }
        if dias < 0 {
            return StatusManutencao(severidade: .vermelho, fracao: 1.0,
                resumo: "Vencido há \(-dias) dias (validade da etiqueta).")
        }
        let sev: SeveridadeManutencao = dias <= 60 ? .amarelo : .verde
        return StatusManutencao(severidade: sev, fracao: nil,
            resumo: "Faltam \(dias) dias pra validade da etiqueta.")
    }
}

private func avaliarPreditivo(contador: ContadorUso, mediaHoras: Double?) -> StatusManutencao {
    guard let media = mediaHoras, media > 0 else {
        return StatusManutencao(severidade: .semHistorico, fracao: nil,
            resumo: "Aprendendo: registre as trocas pra prever a vida em horas.")
    }
    let f = contador.horas / media
    return StatusManutencao(severidade: severidadePorFracao(f), fracao: f,
        resumo: folgaTexto(restante: media - contador.horas, unidade: "h (previsto)", decimais: 1))
}

private func semCalculo(_ msg: String) -> StatusManutencao {
    StatusManutencao(severidade: .semHistorico, fracao: nil, resumo: msg)
}

private func folgaTexto(restante: Double, unidade: String, decimais: Int) -> String {
    let fmt = "%.\(decimais)f"
    if restante >= 0 { return "Faltam \(String(format: fmt, restante)) \(unidade)." }
    return "Vencido há \(String(format: fmt, -restante)) \(unidade)."
}

// ─────────────────────────────────────────────────────────────
// MARK: - Inteligência aprendente (preditivo por HORAS)
//   Portado de ManutencaoInteligencia (18/05): média entre trocas
//   + detecção de anomalia — agora com HORAS como critério primário.
// ─────────────────────────────────────────────────────────────

/// Duração de um intervalo entre 2 trocas consecutivas.
public struct DuracaoTroca: Equatable, Sendable {
    public var horas: Double
    public var eventos: Int
    public var dias: Int
    public init(horas: Double = 0, eventos: Int = 0, dias: Int = 0) {
        self.horas = horas; self.eventos = eventos; self.dias = dias
    }
}

/// Média aritmética simples das durações.
public func mediaDuracoes(_ ds: [DuracaoTroca]) -> DuracaoTroca {
    guard !ds.isEmpty else { return DuracaoTroca() }
    let n = Double(ds.count)
    let horas = ds.reduce(0.0) { $0 + $1.horas } / n
    let eventos = Int(round(Double(ds.reduce(0) { $0 + $1.eventos }) / n))
    let dias = Int(round(Double(ds.reduce(0) { $0 + $1.dias }) / n))
    return DuracaoTroca(horas: horas, eventos: eventos, dias: dias)
}

/// Detecta anomalia: a peça durou bem menos que a média (< threshold).
/// Critério primário = HORAS; cai pra dias se não houver horas.
public func detectarAnomalia(atual: DuracaoTroca, media: DuracaoTroca,
                             threshold: Double = 0.6) -> Bool {
    if media.horas > 0 { return atual.horas < media.horas * threshold }
    guard media.dias > 0 else { return false }
    return Double(atual.dias) < Double(media.dias) * threshold
}
