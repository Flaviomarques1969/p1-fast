// ═══════════════════════════════════════════════════════════
// StreamCoordinator — orquestra vídeo ao vivo via Daily.co
// ═══════════════════════════════════════════════════════════
// MS-11.3. Conversa com as 3 Edge Functions do MS-11.2:
//   - stream-start: cria room no Daily.co, recebe URL
//   - stream-heartbeat: keep-alive a cada 5s (Q15) + regras bateria Q26
//   - stream-end: encerra room
//
// Daily.co iOS SDK (CallClient) é integrado em MS-11.3b — esta etapa
// entrega a camada de orquestração + comunicação com servidor +
// monitoramento de bateria. Conexão real do vídeo na CallClient é
// chamada por `connectToCall(url:)`, isolada num método separado
// pra permitir testes do orquestrador sem stub do SDK inteiro.
//
// Decisões aplicadas:
//   Q11: start automático ao começar stint (caller dispara)
//   Q14: sem áudio (Daily.co room config + SDK config)
//   Q15: heartbeat 5s
//   Q26: aviso 20%, encerra 10%
//   Q27: NÃO pausa no box (continua heartbeat)

import Foundation
import P1FastCore

#if canImport(UIKit)
import UIKit
#endif

/// Erros do StreamCoordinator.
public enum StreamCoordinatorError: Error, LocalizedError {
    case naoConfigurado
    case sessaoSemTime
    case startFalhou(String)
    case heartbeatFalhou(String)
    case enderecoInvalido

    public var errorDescription: String? {
        switch self {
        case .naoConfigurado:
            return "Configuração Supabase ausente — verifique .env.xcconfig"
        case .sessaoSemTime:
            return "Sessao não tem time_id"
        case .startFalhou(let msg):
            return "Falha ao iniciar stream: \(msg)"
        case .heartbeatFalhou(let msg):
            return "Heartbeat falhou: \(msg)"
        case .enderecoInvalido:
            return "URL da sala Daily.co inválida"
        }
    }
}

/// Status canônico que UI consome (espelha VideoStreamStatus do core).
public enum StreamUIStatus: Equatable {
    case parado
    case iniciando
    case aoVivo
    case semSinal
    case encerrado(motivo: String)
    case falha(erro: String)
}

/// Resposta da Edge Function stream-start.
struct StartResponse: Decodable {
    let video_stream_id: String
    let daily_room_url: String
    let daily_room_name: String
}

/// Body do POST stream-start.
struct StartRequest: Encodable {
    let sessao_id: String
    let bateria_inicio: Int?
}

/// Body do POST stream-heartbeat.
struct HeartbeatRequest: Encodable {
    let video_stream_id: String
    let bateria: Int?
}

/// Resposta do POST stream-heartbeat.
struct HeartbeatResponse: Decodable {
    let ok: Bool
    let status: String
    let aviso: String?
    let motivo_encerramento: String?
}

/// Body do POST stream-end.
struct EndRequest: Encodable {
    let video_stream_id: String
    let motivo: String
    let bateria_fim: Int?
}

/// Resposta do POST stream-end.
struct EndResponse: Decodable {
    let ok: Bool
    let already_ended: Bool?
}

/// Orquestrador do vídeo ao vivo. Cliente Swift puro — Daily.co SDK
/// real é integrado pelo método `connectToCall` que pode ser
/// substituído em testes.
@MainActor
public final class StreamCoordinator: ObservableObject {

    @Published public private(set) var status: StreamUIStatus = .parado
    @Published public private(set) var videoStreamId: String?
    @Published public private(set) var dailyRoomUrl: String?
    @Published public private(set) var bateriaAtual: Int?
    @Published public private(set) var ultimaMensagem: String?

    private var heartbeatTask: Task<Void, Never>?
    private let heartbeatIntervalo: TimeInterval = 5.0
    /// MS-11.7: contador de heartbeats falhados em sequência. Após 3
    /// falhas seguidas (~15s), marca status=semSinal pra UI reagir.
    private var falhasConsecutivas: Int = 0
    private let falhasParaSemSinal: Int = 3

    public init() {
        #if canImport(UIKit)
        UIDevice.current.isBatteryMonitoringEnabled = true
        #endif
    }

    /// Inicia stream pra uma sessao. Chama Edge Function stream-start,
    /// recebe URL Daily.co, conecta CallClient (em MS-11.3b), arma
    /// loop de heartbeat. Idempotente — se já estava ativo, no-op.
    public func start(sessaoId: String) async {
        guard status == .parado || isStatusEncerrado() else {
            return
        }
        status = .iniciando
        ultimaMensagem = nil

        let bateria = lerBateriaAtual()
        let body = StartRequest(sessao_id: sessaoId, bateria_inicio: bateria)

        do {
            let resp: StartResponse = try await postJSON(path: "stream-start", body: body)
            self.videoStreamId = resp.video_stream_id
            self.dailyRoomUrl = resp.daily_room_url
            // MS-11.3b: aqui entra a conexão real do CallClient (Daily.co SDK)
            try await connectToCall(url: resp.daily_room_url)
            status = .aoVivo
            iniciarHeartbeat()
        } catch {
            status = .falha(erro: error.localizedDescription)
            ultimaMensagem = "Não consegui iniciar a transmissão: \(error.localizedDescription)"
        }
    }

    /// Encerra stream. `motivo` canônico: manual, bateria_baixa,
    /// sem_internet, stint_cancelado, falha.
    public func stop(motivo: String = "manual") async {
        heartbeatTask?.cancel()
        heartbeatTask = nil

        // Desconecta CallClient (Daily.co SDK) — MS-11.3b
        await disconnectFromCall()

        guard let vid = videoStreamId else {
            status = .encerrado(motivo: motivo)
            return
        }

        let body = EndRequest(
            video_stream_id: vid,
            motivo: motivo,
            bateria_fim: lerBateriaAtual()
        )
        // Silencia erro: stop sempre conclui localmente (Daily room
        // expira pelo TTL de 4h se a chamada do servidor falhar)
        _ = try? await postJSON(path: "stream-end", body: body, respType: EndResponse.self)
        status = .encerrado(motivo: motivo)
    }

    // MARK: - Heartbeat

    private func iniciarHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(5 * 1_000_000_000))
                if Task.isCancelled { break }
                await self?.enviarHeartbeat()
            }
        }
    }

    private func enviarHeartbeat() async {
        guard let vid = videoStreamId else { return }
        let bateria = lerBateriaAtual()
        bateriaAtual = bateria

        do {
            let resp: HeartbeatResponse = try await postJSON(
                path: "stream-heartbeat",
                body: HeartbeatRequest(video_stream_id: vid, bateria: bateria)
            )

            // Q26: se o servidor encerrou por bateria_critica, atualiza UI
            if resp.status == "encerrado" {
                heartbeatTask?.cancel()
                heartbeatTask = nil
                await disconnectFromCall()
                let motivo = resp.motivo_encerramento ?? "bateria_baixa"
                status = .encerrado(motivo: motivo)
                ultimaMensagem = "Transmissão encerrada: bateria abaixo de 10%"
                return
            }

            // Aviso de bateria baixa (20% ou menos)
            if let aviso = resp.aviso, aviso == "bateria_baixa" {
                ultimaMensagem = "Bateria baixa (\(bateria ?? -1)%) — transmissão para em 10%"
            } else {
                ultimaMensagem = nil
            }
            // Sucesso — zera contador de falhas e volta pra aoVivo se estava semSinal
            falhasConsecutivas = 0
            if status == .semSinal {
                status = .aoVivo
                ultimaMensagem = nil
            }
        } catch {
            // MS-11.7: heartbeat falhou. Após 3 falhas seguidas (~15s),
            // marca status=semSinal — Command Box mostra última imagem
            // congelada com aviso (Q16).
            falhasConsecutivas += 1
            if falhasConsecutivas >= falhasParaSemSinal && status == .aoVivo {
                status = .semSinal
                ultimaMensagem = "Sem sinal — verifique a conexão"
            } else if falhasConsecutivas < falhasParaSemSinal {
                ultimaMensagem = "Sinal instável: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - Daily.co SDK (MS-11.3b — stub que vai ser preenchido)

    /// Conecta o Daily.co CallClient à room. MS-11.3b vai trocar este
    /// stub por uma implementação real. Hoje é no-op — o stream existe
    /// no servidor (Edge Function criou room) mas o vídeo do iPhone
    /// ainda não está ligado.
    private func connectToCall(url: String) async throws {
        // TODO MS-11.3b: instanciar Daily.CallClient, conectar à URL com:
        //   - audio_disabled = true (Q14)
        //   - video_enabled = true (câmera frontal)
        //   - preferredCamera = .front
        // Por enquanto, só guarda a URL pra Command Box poder abrir direto.
    }

    private func disconnectFromCall() async {
        // TODO MS-11.3b: desconectar CallClient. Por enquanto no-op.
    }

    // MARK: - Helpers

    private func isStatusEncerrado() -> Bool {
        if case .encerrado = status { return true }
        return false
    }

    /// Lê bateria atual (0-100). nil se não disponível (simulador).
    private func lerBateriaAtual() -> Int? {
        #if canImport(UIKit)
        let level = UIDevice.current.batteryLevel
        guard level >= 0 else { return nil }
        return Int(level * 100)
        #else
        return nil
        #endif
    }

    /// Wrapper async sobre SupabaseHTTP.postJSON (que é sync). Mantém a
    /// UI fluida — caller pode `await` sem travar main thread.
    private func postJSON<Req: Encodable, Resp: Decodable>(
        path: String,
        body: Req,
        respType: Resp.Type = Resp.self
    ) async throws -> Resp {
        try await Task.detached {
            try SupabaseHTTP.postJSON(path: path, body: body, respType: Resp.self)
        }.value
    }
}
