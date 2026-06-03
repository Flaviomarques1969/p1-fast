// ═══════════════════════════════════════════════════════════
// TrechoAnalisarClient — chamada à Edge Function trecho-analisar
// Bloco 4 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
//
// Empacota um trecho fechado (~5 s de amostras) e bate em
// `<SUPABASE_URL>/functions/v1/trecho-analisar`. Devolve a `AnaliseResponse`
// decodificada com cor + frase + top oportunidade.
//
// Sem dependência de URLSession concreta — recebe um `URLSessionProtocol`
// no init, o que permite testar com `MockURLProtocol` no smoke.
//
// Encoder/decoder usam `JSONEncoder/JSONDecoder` padrão (snake_case por
// CodingKeys explícitas). O contrato JSON é o que `index.ts` consome.

import Foundation

// ─────────────────────────────────────────────────────────────
// MARK: - Estruturas do contrato HTTP
// ─────────────────────────────────────────────────────────────

public struct AmostraTrecho: Sendable, Equatable, Codable {
    public let t: Double
    public let velocidadeKmh: Double
    public let pedalPct: Double
    public let rpm: Double
    public let marcha: Int
    public let aceleracaoRealMs2: Double

    public init(t: Double, velocidadeKmh: Double, pedalPct: Double,
                rpm: Double, marcha: Int, aceleracaoRealMs2: Double) {
        self.t = t
        self.velocidadeKmh = velocidadeKmh
        self.pedalPct = pedalPct
        self.rpm = rpm
        self.marcha = marcha
        self.aceleracaoRealMs2 = aceleracaoRealMs2
    }
}

public struct IdentificacaoTrecho: Sendable, Equatable, Codable {
    public let carroId: String
    public let configId: String
    public let pilotoId: String
    public let eventoId: String

    public init(carroId: String, configId: String, pilotoId: String, eventoId: String) {
        self.carroId = carroId
        self.configId = configId
        self.pilotoId = pilotoId
        self.eventoId = eventoId
    }
}

public struct CarroAnaliseConfig: Sendable, Equatable, Codable {
    public let relacoesMarcha: [Double]   // index 0 = 1ª marcha
    public let relacaoFinal: Double
    public let raioPneuM: Double
    public let massaKg: Double
    public let curva: DynoCurve

    public init(relacoesMarcha: [Double], relacaoFinal: Double,
                raioPneuM: Double, massaKg: Double, curva: DynoCurve) {
        self.relacoesMarcha = relacoesMarcha
        self.relacaoFinal = relacaoFinal
        self.raioPneuM = raioPneuM
        self.massaKg = massaKg
        self.curva = curva
    }

    /// Constrói o config a partir do CeltaBubiCatalogo (defaults conhecidos).
    public static var celtaBubiPadrao: CarroAnaliseConfig {
        CarroAnaliseConfig(
            relacoesMarcha: [
                CeltaBubiCatalogo.relacaoMarcha1,
                CeltaBubiCatalogo.relacaoMarcha2,
                CeltaBubiCatalogo.relacaoMarcha3,
                CeltaBubiCatalogo.relacaoMarcha4,
                CeltaBubiCatalogo.relacaoMarcha5,
            ],
            relacaoFinal: CeltaBubiCatalogo.relacaoFinal,
            raioPneuM: CeltaBubiCatalogo.raioPneuM,
            massaKg: 908,
            curva: DynoCurve.celtaBubi2026_05_18
        )
    }
}

public struct LeituraHistoricaTrecho: Sendable, Equatable, Codable {
    public let evento: String
    public let data: String
    public let trechoId: String
    public let causa: String
    public let deltaAcumuladoMs2: Double

    public init(evento: String, data: String, trechoId: String,
                causa: String, deltaAcumuladoMs2: Double) {
        self.evento = evento
        self.data = data
        self.trechoId = trechoId
        self.causa = causa
        self.deltaAcumuladoMs2 = deltaAcumuladoMs2
    }
}

public struct TrechoAnaliseRequest: Sendable, Equatable, Codable {
    public let trechoId: String
    public let amostras: [AmostraTrecho]
    public let identificacao: IdentificacaoTrecho
    public let carro: CarroAnaliseConfig
    public let historicoTrecho: [LeituraHistoricaTrecho]?

    public init(trechoId: String, amostras: [AmostraTrecho],
                identificacao: IdentificacaoTrecho, carro: CarroAnaliseConfig,
                historicoTrecho: [LeituraHistoricaTrecho]? = nil) {
        self.trechoId = trechoId
        self.amostras = amostras
        self.identificacao = identificacao
        self.carro = carro
        self.historicoTrecho = historicoTrecho
    }
}

public struct TopOportunidade: Sendable, Equatable, Codable {
    public let descricao: String
    public let ganhoEstimadoSeg: Double
    public init(descricao: String, ganhoEstimadoSeg: Double) {
        self.descricao = descricao
        self.ganhoEstimadoSeg = ganhoEstimadoSeg
    }
}

public struct TrechoAnaliseResponse: Sendable, Equatable, Codable {
    public let trechoId: String
    public let cor: String          // "verde" | "amarelo" | "vermelho"
    public let frase: String
    public let topOportunidade: TopOportunidade
    public let causaProvavel: String
    public let deltaAcumuladoMs2: Double
    public let evidencia: String
    public let criarPendencia: Bool
    public let sugestaoPendencia: String?

    public init(trechoId: String, cor: String, frase: String,
                topOportunidade: TopOportunidade, causaProvavel: String,
                deltaAcumuladoMs2: Double, evidencia: String,
                criarPendencia: Bool, sugestaoPendencia: String?) {
        self.trechoId = trechoId
        self.cor = cor
        self.frase = frase
        self.topOportunidade = topOportunidade
        self.causaProvavel = causaProvavel
        self.deltaAcumuladoMs2 = deltaAcumuladoMs2
        self.evidencia = evidencia
        self.criarPendencia = criarPendencia
        self.sugestaoPendencia = sugestaoPendencia
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Protocol pra URLSession (testável)
// ─────────────────────────────────────────────────────────────

/// Subset de URLSession que precisamos. Permite mock em testes.
public protocol URLSessionProtocol: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: URLSessionProtocol {}

// ─────────────────────────────────────────────────────────────
// MARK: - TrechoAnalisarClient
// ─────────────────────────────────────────────────────────────

public enum TrechoAnalisarClientError: Error, Equatable, Sendable {
    case semBaseURL
    case respostaInvalida(statusCode: Int, mensagem: String?)
    case decodificacao(String)
}

public struct TrechoAnalisarClient: Sendable {
    public let baseURL: URL
    public let token: String
    public let session: URLSessionProtocol

    public init(baseURL: URL, token: String, session: URLSessionProtocol = URLSession.shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    /// Bate na Edge Function. Joga `respostaInvalida` em HTTP != 2xx,
    /// `decodificacao` em JSON mal formado.
    public func analisar(_ req: TrechoAnaliseRequest) async throws -> TrechoAnaliseResponse {
        let url = baseURL
            .appendingPathComponent("functions")
            .appendingPathComponent("v1")
            .appendingPathComponent("trecho-analisar")

        var urlReq = URLRequest(url: url)
        urlReq.httpMethod = "POST"
        urlReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlReq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        urlReq.httpBody = try encoder.encode(req)

        let (data, response) = try await session.data(for: urlReq)
        guard let httpResp = response as? HTTPURLResponse else {
            throw TrechoAnalisarClientError.respostaInvalida(statusCode: -1, mensagem: nil)
        }
        guard (200..<300).contains(httpResp.statusCode) else {
            let texto = String(data: data, encoding: .utf8)
            throw TrechoAnalisarClientError.respostaInvalida(
                statusCode: httpResp.statusCode,
                mensagem: texto
            )
        }
        do {
            return try JSONDecoder().decode(TrechoAnaliseResponse.self, from: data)
        } catch {
            throw TrechoAnalisarClientError.decodificacao(String(describing: error))
        }
    }
}
