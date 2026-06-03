// ═══════════════════════════════════════════════════════════
// Manutencao — domain puro da função Manutenção (2026-05-18 "go")
// ═══════════════════════════════════════════════════════════
// Camada de domínio sem dependência de banco/UI. Cobre:
//   • ManutencaoCatalogo  — catálogo embarcado de 15 itens default
//     (óleo, filtros, velas, fluidos, pastilhas, embreagem…) com
//     periodicidade sugerida por item.
//   • PeriodicidadeRegra  — shape da regra "quando trocar". Permite
//     km de rua, km de pista (peso 3× — pista castiga mais), horas,
//     meses, e combinação por "qualquer um vence" / "todos vencem".
//     Encoda como JSON pra persistência via ManutencaoPeriodicidade.
//   • ContadorVida        — entrada do cálculo de "quanto rodou desde
//     a última troca" (km, voltas-pista, horas, dias).
//   • avaliarStatus       — função pura que combina regra + contador
//     e devolve ManutencaoStatus (verde/amarelo/vermelho + previsão).
//   • duracaoEntreTrocas  — função pura sobre 2 manutenções consecutivas
//     (km rodado, voltas em cada autódromo, horas, dias) — usada pela
//     inteligência aprendente do Bloco 5.
//
// Bloco 4 + Bloco 5 do plano da noite consomem essas funções via
// ManutencaoRepository (camada iOS).

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Catálogo embarcado
// ─────────────────────────────────────────────────────────────

/// Definição estática de um item de manutenção. `codigo` é a chave
/// canônica usada em `manutencoes.item_codigo` e nos detalhes.
public struct ManutencaoItemDef: Sendable, Hashable, Identifiable, Codable {
    public let codigo: String
    public let nome: String
    public let area: PecaArea
    public let periodicidadeDefault: PeriodicidadeRegra

    public var id: String { codigo }

    public init(codigo: String, nome: String, area: PecaArea,
                periodicidadeDefault: PeriodicidadeRegra) {
        self.codigo = codigo
        self.nome = nome
        self.area = area
        self.periodicidadeDefault = periodicidadeDefault
    }
}

/// Catálogo embarcado de 15 itens default. Fonte de verdade pro
/// formulário "Nova troca" e pra previsão default antes da
/// inteligência aprendida acumular dados.
public enum ManutencaoCatalogo {
    public static let itens: [ManutencaoItemDef] = [
        ManutencaoItemDef(
            codigo: "oleo_motor",
            nome: "Óleo do motor",
            area: .motor,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(5_000), .porData(meses: 6)
            ])
        ),
        ManutencaoItemDef(
            codigo: "filtro_oleo",
            nome: "Filtro de óleo",
            area: .motor,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(5_000), .porData(meses: 6)
            ])
        ),
        ManutencaoItemDef(
            codigo: "filtro_ar",
            nome: "Filtro de ar",
            area: .motor,
            periodicidadeDefault: .porKmRua(10_000)
        ),
        ManutencaoItemDef(
            codigo: "filtro_combustivel",
            nome: "Filtro de combustível",
            area: .motor,
            periodicidadeDefault: .porKmRua(20_000)
        ),
        ManutencaoItemDef(
            codigo: "velas",
            nome: "Velas de ignição",
            area: .motor,
            periodicidadeDefault: .porKmRua(20_000)
        ),
        ManutencaoItemDef(
            codigo: "correia_dentada",
            nome: "Correia dentada / corrente",
            area: .motor,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(60_000), .porData(meses: 60)
            ])
        ),
        ManutencaoItemDef(
            codigo: "fluido_freio",
            nome: "Fluido de freio",
            area: .freios,
            periodicidadeDefault: .porData(meses: 24)
        ),
        ManutencaoItemDef(
            codigo: "pastilha_freio",
            nome: "Pastilha de freio",
            area: .freios,
            periodicidadeDefault: .porDesgaste
        ),
        ManutencaoItemDef(
            codigo: "disco_freio",
            nome: "Disco de freio",
            area: .freios,
            periodicidadeDefault: .porDesgaste
        ),
        ManutencaoItemDef(
            codigo: "liquido_arrefecimento",
            nome: "Líquido de arrefecimento",
            area: .refrigeracao,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(40_000), .porData(meses: 24)
            ])
        ),
        ManutencaoItemDef(
            codigo: "oleo_cambio",
            nome: "Óleo do câmbio",
            area: .cambio,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(40_000), .porData(meses: 24)
            ])
        ),
        ManutencaoItemDef(
            codigo: "embreagem_kit",
            nome: "Kit da embreagem",
            area: .embreagem,
            periodicidadeDefault: .porDesgaste
        ),
        ManutencaoItemDef(
            codigo: "amortecedores",
            nome: "Amortecedores",
            area: .suspensao,
            periodicidadeDefault: .porKmRua(60_000)
        ),
        ManutencaoItemDef(
            codigo: "alinhamento_balanceamento",
            nome: "Alinhamento e balanceamento",
            area: .suspensao,
            periodicidadeDefault: .combinacao(.qualquer, [
                .porKmRua(10_000), .porData(meses: 12)
            ])
        ),
        ManutencaoItemDef(
            codigo: "bateria",
            nome: "Bateria",
            area: .eletrica,
            periodicidadeDefault: .porData(meses: 24)
        )
    ]

    /// Busca por código. Nil se não estiver no catálogo (item legado
    /// ou novo, ainda não cadastrado aqui).
    public static func find(_ codigo: String) -> ManutencaoItemDef? {
        itens.first { $0.codigo == codigo }
    }

    /// Itens agrupados por área (preserva ordem do catálogo dentro
    /// de cada grupo). Útil pra picker do formulário.
    public static func itensPorArea() -> [(PecaArea, [ManutencaoItemDef])] {
        var por: [PecaArea: [ManutencaoItemDef]] = [:]
        for item in itens {
            por[item.area, default: []].append(item)
        }
        return PecaArea.allCases.compactMap { area in
            guard let arr = por[area] else { return nil }
            return (area, arr)
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - PeriodicidadeRegra
// ─────────────────────────────────────────────────────────────

/// Como combinar 2+ critérios numa única regra de periodicidade.
public enum PeriodicidadeOperador: String, Codable, Sendable, Hashable {
    /// Vence quando QUALQUER critério bate. Comum: "5000 km OU 6 meses".
    case qualquer
    /// Só vence quando TODOS batem. Raro — usar pra casos restritos.
    case todas
}

/// Regra "quando trocar" — shape rico mas serializável pra JSON.
public indirect enum PeriodicidadeRegra: Codable, Sendable, Hashable {
    /// Trocar a cada N km de rua/cidade.
    case porKmRua(Int)
    /// Trocar a cada N km de pista (com peso multiplicador — default 3.0
    /// porque a pista castiga ~3× mais que rua). km_pista_equivalente =
    /// kmPista * peso. Quando a soma desse equivalente bate em `kmEq`,
    /// vence.
    case porKmPista(kmEq: Int, peso: Double)
    /// Trocar a cada N horas de uso (rodagem).
    case porHoras(Int)
    /// Trocar a cada N meses calendário (independe de uso).
    case porData(meses: Int)
    /// "Inspecionar e trocar por desgaste" — sem regra automática (ex.:
    /// pastilha de freio). Pendência nunca vence sozinha; piloto avalia.
    case porDesgaste
    /// Combinação de N regras. Vence conforme operador.
    case combinacao(PeriodicidadeOperador, [PeriodicidadeRegra])

    // MARK: Codable
    enum CodingKeys: String, CodingKey {
        case tipo, valor, peso, operador, regras, meses, kmEq
    }
    private enum Tipo: String, Codable { case porKmRua, porKmPista, porHoras, porData, porDesgaste, combinacao }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let tipo = try c.decode(Tipo.self, forKey: .tipo)
        switch tipo {
        case .porKmRua:
            self = .porKmRua(try c.decode(Int.self, forKey: .valor))
        case .porKmPista:
            let kmEq = try c.decode(Int.self, forKey: .kmEq)
            let peso = try c.decodeIfPresent(Double.self, forKey: .peso) ?? 3.0
            self = .porKmPista(kmEq: kmEq, peso: peso)
        case .porHoras:
            self = .porHoras(try c.decode(Int.self, forKey: .valor))
        case .porData:
            self = .porData(meses: try c.decode(Int.self, forKey: .meses))
        case .porDesgaste:
            self = .porDesgaste
        case .combinacao:
            let op = try c.decode(PeriodicidadeOperador.self, forKey: .operador)
            let regras = try c.decode([PeriodicidadeRegra].self, forKey: .regras)
            self = .combinacao(op, regras)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .porKmRua(let v):
            try c.encode(Tipo.porKmRua, forKey: .tipo)
            try c.encode(v, forKey: .valor)
        case .porKmPista(let kmEq, let peso):
            try c.encode(Tipo.porKmPista, forKey: .tipo)
            try c.encode(kmEq, forKey: .kmEq)
            try c.encode(peso, forKey: .peso)
        case .porHoras(let v):
            try c.encode(Tipo.porHoras, forKey: .tipo)
            try c.encode(v, forKey: .valor)
        case .porData(let m):
            try c.encode(Tipo.porData, forKey: .tipo)
            try c.encode(m, forKey: .meses)
        case .porDesgaste:
            try c.encode(Tipo.porDesgaste, forKey: .tipo)
        case .combinacao(let op, let regras):
            try c.encode(Tipo.combinacao, forKey: .tipo)
            try c.encode(op, forKey: .operador)
            try c.encode(regras, forKey: .regras)
        }
    }

    /// Serializa pra JSON (UTF-8) — formato persistido em
    /// `manutencao_periodicidades.regra_json`.
    public func toJSON() -> String {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        guard let data = try? enc.encode(self),
              let s = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return s
    }

    /// Parse do JSON persistido. Retorna `.porDesgaste` (degraded) se o
    /// JSON for inválido — não derruba o app.
    public static func fromJSON(_ s: String) -> PeriodicidadeRegra {
        guard let data = s.data(using: .utf8) else { return .porDesgaste }
        do {
            return try JSONDecoder().decode(PeriodicidadeRegra.self, from: data)
        } catch {
            return .porDesgaste
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - ContadorVida + ManutencaoStatus
// ─────────────────────────────────────────────────────────────

/// Quanto rodou desde a última troca daquele item nesse carro.
/// Repository preenche a partir de SQL (km estimado, voltas por
/// autódromo, horas de stint, dias calendário).
public struct ContadorVida: Equatable, Sendable {
    /// Quilometragem de rua/uso geral (vem do contador do carro ou de
    /// estimativa do app — depende do que o piloto registrou).
    public var kmRua: Double
    /// Quilometragem rodada em pista (soma de stint.distancia ou estima
    /// via voltas × extensão). Será multiplicada pelo peso da regra.
    public var kmPista: Double
    /// Horas de uso (somatório de duração dos stints + se houver
    /// duração de rua estimada — começa só com stints).
    public var horas: Double
    /// Dias calendário desde a última troca (ocorridoEm da última
    /// manutencao registrada).
    public var dias: Int

    public init(kmRua: Double = 0, kmPista: Double = 0, horas: Double = 0, dias: Int = 0) {
        self.kmRua = kmRua; self.kmPista = kmPista; self.horas = horas; self.dias = dias
    }

    public static let zero = ContadorVida()
}

/// Severidade atual da manutenção daquele item naquele carro.
public enum ManutencaoSeveridade: String, Codable, Sendable, Hashable, CaseIterable {
    /// Dentro do limite (≤ 80% da vida útil prevista).
    case verde
    /// Aproximando do limite (80–100% da vida útil).
    case amarelo
    /// Vencido (passou de 100%).
    case vermelho
    /// Regra é "por desgaste" — não há previsão automática.
    case desgasteManual
    /// Item nunca foi trocado nesse carro — sem histórico pra calcular.
    case semHistorico
}

/// Status calculado de manutenção de um item. Cobre cor + fração da
/// vida útil + mensagem amigável.
public struct ManutencaoStatus: Equatable, Sendable {
    public let severidade: ManutencaoSeveridade
    /// Fração da vida útil consumida (0.0 = zero, 1.0 = vence agora,
    /// >1.0 = vencido). nil se não há regra automática aplicável.
    public let fracao: Double?
    /// Frase amigável pra exibir ("Vence em 1500 km", "Vencido há 30 dias").
    public let resumo: String

    public init(severidade: ManutencaoSeveridade, fracao: Double?, resumo: String) {
        self.severidade = severidade; self.fracao = fracao; self.resumo = resumo
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Cálculo puro
// ─────────────────────────────────────────────────────────────

/// Avalia o status atual de manutenção combinando regra + contador.
/// Função pura — sem IO. Usada pelo Repository pra produzir lista
/// de pendências e pelo detalhe do item.
public func avaliarStatus(regra: PeriodicidadeRegra,
                          contador: ContadorVida) -> ManutencaoStatus {
    // Curto-circuito: por desgaste manual.
    if case .porDesgaste = regra {
        return ManutencaoStatus(
            severidade: .desgasteManual,
            fracao: nil,
            resumo: "Por desgaste — inspecione no próximo evento."
        )
    }

    let fracoes = fracoesDeVida(regra: regra, contador: contador)
    guard !fracoes.isEmpty else {
        return ManutencaoStatus(
            severidade: .desgasteManual, fracao: nil,
            resumo: "Sem regra automática."
        )
    }

    // Em `.combinacao(.qualquer, …)` vence quando QUALQUER critério bate
    // → fração resultante = max das frações (o mais avançado puxa).
    // Em `.combinacao(.todas, …)` vence quando TODOS batem → fração
    // resultante = min (o menos avançado segura).
    let fracaoAgregada: Double
    if case .combinacao(.todas, _) = regra {
        fracaoAgregada = fracoes.min() ?? 0.0
    } else {
        fracaoAgregada = fracoes.max() ?? 0.0
    }

    let severidade: ManutencaoSeveridade
    if fracaoAgregada >= 1.0 { severidade = .vermelho }
    else if fracaoAgregada >= 0.8 { severidade = .amarelo }
    else { severidade = .verde }

    let resumo = resumoLegivel(regra: regra, contador: contador, fracao: fracaoAgregada)
    return ManutencaoStatus(severidade: severidade, fracao: fracaoAgregada, resumo: resumo)
}

/// Retorna a fração de vida útil consumida por cada critério da regra.
/// Combinação devolve uma fração por sub-regra.
public func fracoesDeVida(regra: PeriodicidadeRegra,
                          contador: ContadorVida) -> [Double] {
    switch regra {
    case .porKmRua(let limite):
        guard limite > 0 else { return [] }
        return [contador.kmRua / Double(limite)]
    case .porKmPista(let kmEq, let peso):
        guard kmEq > 0 else { return [] }
        let equivalente = contador.kmPista * peso
        return [equivalente / Double(kmEq)]
    case .porHoras(let limite):
        guard limite > 0 else { return [] }
        return [contador.horas / Double(limite)]
    case .porData(let meses):
        guard meses > 0 else { return [] }
        // 1 mês ≈ 30 dias civis (suficiente pra previsão)
        return [Double(contador.dias) / (Double(meses) * 30.0)]
    case .porDesgaste:
        return []
    case .combinacao(_, let regras):
        return regras.flatMap { fracoesDeVida(regra: $0, contador: contador) }
    }
}

/// Frase legível por baixo do status. Mostra a folga (ou o atraso) do
/// critério mais avançado.
public func resumoLegivel(regra: PeriodicidadeRegra,
                          contador: ContadorVida,
                          fracao: Double) -> String {
    // Escolhe a sub-regra mais avançada pra explicar
    let critica = subregraMaisCritica(regra: regra, contador: contador)
    switch critica {
    case .porKmRua(let limite):
        let folga = Double(limite) - contador.kmRua
        if folga >= 0 {
            return "Faltam \(formatarKmCurto(folga)) km."
        } else {
            return "Vencido há \(formatarKmCurto(-folga)) km."
        }
    case .porKmPista(let kmEq, let peso):
        let equivalente = contador.kmPista * peso
        let folga = Double(kmEq) - equivalente
        if folga >= 0 {
            return "Faltam \(formatarKmCurto(folga)) km de pista (com peso \(String(format: "%.1f×", peso)))."
        } else {
            return "Vencido há \(formatarKmCurto(-folga)) km de pista."
        }
    case .porHoras(let limite):
        let folga = Double(limite) - contador.horas
        if folga >= 0 {
            return "Faltam \(String(format: "%.0f", folga)) h."
        } else {
            return "Vencido há \(String(format: "%.0f", -folga)) h."
        }
    case .porData(let meses):
        let limiteDias = Int(Double(meses) * 30)
        let folga = limiteDias - contador.dias
        if folga >= 0 {
            return "Faltam \(folga) dias."
        } else {
            return "Vencido há \(-folga) dias."
        }
    case .porDesgaste:
        return "Por desgaste — inspecione no próximo evento."
    case .combinacao:
        _ = fracao
        return "Cálculo combinado pendente."
    }
}

/// Helper pra achar qual sub-regra está mais avançada (maior fração).
/// Em `.combinacao(.todas, …)` mostra a mais BAIXA (a que segura).
private func subregraMaisCritica(regra: PeriodicidadeRegra,
                                 contador: ContadorVida) -> PeriodicidadeRegra {
    switch regra {
    case .combinacao(let op, let regras):
        let pares = regras.compactMap { sub -> (PeriodicidadeRegra, Double)? in
            let fs = fracoesDeVida(regra: sub, contador: contador)
            guard let f = fs.first else { return nil }
            return (sub, f)
        }
        if pares.isEmpty { return .porDesgaste }
        if op == .todas {
            return pares.min(by: { $0.1 < $1.1 })!.0
        } else {
            return pares.max(by: { $0.1 < $1.1 })!.0
        }
    default:
        return regra
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Duração entre trocas (Bloco 5)
// ─────────────────────────────────────────────────────────────

/// Quanto durou um intervalo entre 2 trocas consecutivas. Bloco 5
/// usa pra calcular média aprendida + detectar anomalia.
public struct DuracaoEntreTrocas: Equatable, Sendable {
    /// Quilometragem de rua entre as trocas (diferença entre os
    /// `kmCarro` registrados, quando ambos estão preenchidos).
    public var kmRua: Double?
    /// Quilometragem rodada em pista (soma de voltas × extensão dos
    /// autódromos entre as 2 datas).
    public var kmPista: Double
    /// Horas de stint entre as 2 datas (soma de duração dos stints).
    public var horas: Double
    /// Dias calendário entre as 2 datas.
    public var dias: Int

    public init(kmRua: Double? = nil, kmPista: Double = 0,
                horas: Double = 0, dias: Int = 0) {
        self.kmRua = kmRua; self.kmPista = kmPista
        self.horas = horas; self.dias = dias
    }
}

/// Detecta se uma duração é "anômala" comparada à média histórica.
/// Bloco 5 — se a próxima troca vier com menos de 60% da média
/// aprendida do mesmo item, marca como anomalia (o item durou bem
/// menos do que costuma — algo estranho aconteceu).
public func detectarAnomalia(duracaoAtual: DuracaoEntreTrocas,
                             media: DuracaoEntreTrocas,
                             threshold: Double = 0.6) -> Bool {
    // Compara o critério primário: km de rua (se ambos têm), senão dias.
    if let atual = duracaoAtual.kmRua, let mediaKm = media.kmRua, mediaKm > 0 {
        return atual < (mediaKm * threshold)
    }
    guard media.dias > 0 else { return false }
    return Double(duracaoAtual.dias) < (Double(media.dias) * threshold)
}

/// Média aritmética simples de uma lista de durações. Ignora valores
/// nulos no kmRua quando há pelo menos um preenchido.
public func mediaDuracoes(_ duracoes: [DuracaoEntreTrocas]) -> DuracaoEntreTrocas {
    guard !duracoes.isEmpty else { return DuracaoEntreTrocas() }
    let n = Double(duracoes.count)

    let kmRuaPreenchidos = duracoes.compactMap { $0.kmRua }
    let kmRuaMedia: Double? = kmRuaPreenchidos.isEmpty
        ? nil
        : kmRuaPreenchidos.reduce(0, +) / Double(kmRuaPreenchidos.count)

    let kmPista = duracoes.reduce(0.0) { $0 + $1.kmPista } / n
    let horas = duracoes.reduce(0.0) { $0 + $1.horas } / n
    let diasTotal = duracoes.reduce(0) { $0 + $1.dias }
    let dias = Int(round(Double(diasTotal) / n))

    return DuracaoEntreTrocas(kmRua: kmRuaMedia, kmPista: kmPista,
                              horas: horas, dias: dias)
}

// ─────────────────────────────────────────────────────────────
// Helpers de formatação (público pra UI e smokes)
// ─────────────────────────────────────────────────────────────

public func formatarKmCurto(_ km: Double) -> String {
    if km >= 1000 {
        return String(format: "%.1fk", km / 1000)
    }
    return String(format: "%.0f", km)
}
