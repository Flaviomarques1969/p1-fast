// ═══════════════════════════════════════════════════════════
// LocalSocketCockpitTransport — MS-2.8 (cabo USB primário)
// ═══════════════════════════════════════════════════════════
// Abre um TCP listener em 127.0.0.1:5050 que aceita 1 cliente. O
// cockpit no notebook Windows se conecta via cabo USB usando iproxy
// (https://github.com/libimobiledevice/libusbmuxd) que encaminha
// portas TCP do iPhone pra portas locais do PC.
//
// Frame:
//   <JSON do CockpitEnvelope>\n
// Cada envelope termina em '\n' pra que o consumidor faça line-based
// framing. JSON encodado em UTF-8 sortedKeys (ordem alfabética dos
// campos — combina com o smoke ENV-02).

import Foundation
import Network
import P1FastCore

actor LocalSocketCockpitTransport: CockpitTransport {
    public let name: String = "local-socket"
    private let port: UInt16
    private var listener: NWListener?
    private var connection: NWConnection?
    private let encoder: JSONEncoder

    public init(port: UInt16 = 5050) {
        self.port = port
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        self.encoder = enc
    }

    public func start() async {
        guard listener == nil else { return }
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        parameters.allowLocalEndpointReuse = true
        guard let p = NWEndpoint.Port(rawValue: port) else { return }
        let l = try? NWListener(using: parameters, on: p)
        guard let l else { return }
        l.newConnectionHandler = { [weak self] conn in
            Task { await self?.acceptConnection(conn) }
        }
        l.start(queue: .global(qos: .userInitiated))
        self.listener = l
    }

    private func acceptConnection(_ conn: NWConnection) {
        // Encerra cliente anterior (mantém só 1 ativo — modelo simples,
        // o cockpit Windows é único consumidor)
        connection?.cancel()
        connection = conn
        conn.start(queue: .global(qos: .userInitiated))
    }

    public func stop() async {
        connection?.cancel()
        connection = nil
        listener?.cancel()
        listener = nil
    }

    public func send(_ envelope: CockpitEnvelope) async {
        guard let conn = connection, conn.state == .ready else { return }
        guard let data = try? encoder.encode(envelope) else { return }
        var bytes = data
        bytes.append(0x0A)  // '\n' line terminator
        conn.send(content: bytes, completion: .contentProcessed { _ in })
    }
}
