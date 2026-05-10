// ═══════════════════════════════════════════════════════════
// CockpitTransport — interface de transporte MS-2.8
// ═══════════════════════════════════════════════════════════
// Abstrai o canal de saída do publisher (cabo USB local ou Supabase
// Realtime). Implementações concretas vivem no app (`p1fast-ios`)
// porque dependem de Network framework e supabase-swift; o core só
// define o contrato e um mock pra smoke tests.

import Foundation

/// Saída de pacote — implementações enviam o JSON do envelope pro
/// destino concreto (socket, websocket, ...). Erros são tratados
/// internamente pelo transport (log, reconnect, etc.) — o publisher
/// não decide retry, só dispara.
public protocol CockpitTransport: Sendable {
    /// Identificador legível (`"local-socket"`, `"realtime"`) — usado
    /// em logs/observabilidade.
    var name: String { get }

    /// Envia o envelope de forma assíncrona. Não bloqueia o publisher
    /// nem propaga erros — fail-fast log dentro do transport.
    func send(_ envelope: CockpitEnvelope) async

    /// Inicia o transporte (abre socket, faz subscribe etc.). Idempotente.
    func start() async

    /// Encerra. Idempotente.
    func stop() async
}

/// Mock que captura envelopes em memória. Usado em smoke tests do publisher
/// pra confirmar shape, ordem e cadência sem rede real.
public actor MockCockpitTransport: CockpitTransport {
    public let name: String
    public private(set) var sent: [CockpitEnvelope] = []
    public private(set) var startedCount: Int = 0
    public private(set) var stoppedCount: Int = 0

    public init(name: String = "mock") {
        self.name = name
    }

    public func send(_ envelope: CockpitEnvelope) async {
        sent.append(envelope)
    }

    public func start() async {
        startedCount += 1
    }

    public func stop() async {
        stoppedCount += 1
    }

    /// Helpers de teste
    public func snapshot() -> [CockpitEnvelope] { sent }
    public func reset() {
        sent.removeAll()
        startedCount = 0
        stoppedCount = 0
    }
}
