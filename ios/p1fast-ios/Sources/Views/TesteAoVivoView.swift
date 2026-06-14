// ═══════════════════════════════════════════════════════════
// TesteAoVivoView — tela de TESTE do espelhamento ao vivo
// ═══════════════════════════════════════════════════════════
// Viewer (quem ASSISTE). Não publica câmera nem microfone — só
// recebe o vídeo do notebook (participante remoto) e os pacotes
// de GPS por app-message do Daily.co.
//
// Fluxo:
//   1. POST https://p1tv.vercel.app/api/room  (sem body)
//      → JSON { roomUrl, tokenBox, roomName }
//   2. CallClient.join(url: roomUrl, token: tokenBox)
//      câmera + microfone do próprio app DESLIGADOS.
//   3. Mostra o vídeo do participante remoto em tela cheia (VideoView).
//   4. Recebe app-messages no formato:
//        { "t":"gps","spd":<km/h>,"numSV":<int>,"ver":"<sinal>",
//          "lat":<num|null>,"lon":<num|null>,"fix":<int> }
//      e mostra overlay com velocidade, satélites e o texto `ver`.
//   5. Estado de conexão visível: conectando… / ao vivo / falhou.
//
// É uma tela ADICIONADA pra teste. Não altera o fluxo canônico do app.
// Entrada: botão "TESTE AO VIVO" na Home + launch arg --p1-teste-aovivo.

import SwiftUI
import UIKit
import Daily

// MARK: - Modelos

/// Resposta do endpoint /api/room.
private struct RoomResponse: Decodable {
    let roomUrl: String
    let tokenBox: String
    let roomName: String?
}

/// Pacote de GPS recebido por app-message (enviado pelo notebook).
private struct GpsPacket: Decodable {
    let t: String?
    let spd: Double?
    let numSV: Int?
    let ver: String?
    let lat: Double?
    let lon: Double?
    let fix: Int?
}

/// Estado da conexão pra UI.
private enum LiveStatus: Equatable {
    case conectando
    case aoVivo
    case falhou(String)

    var label: String {
        switch self {
        case .conectando: return "conectando…"
        case .aoVivo: return "ao vivo"
        case .falhou: return "falhou"
        }
    }
}

// MARK: - ViewModel (dono do CallClient + delegate)

@MainActor
private final class TesteAoVivoModel: NSObject, ObservableObject {
    @Published var status: LiveStatus = .conectando
    @Published var remoteTrack: VideoTrack?
    @Published var gps: GpsPacket?
    @Published var detalheErro: String?

    private let callClient = CallClient()
    private var iniciou = false

    /// URL do endpoint que cria/retorna a sala.
    private let roomEndpoint = URL(string: "https://p1tv.vercel.app/api/room")!

    override init() {
        super.init()
        callClient.delegate = self
    }

    /// Idempotente — só conecta na primeira chamada (a View dispara em .task).
    func iniciarSeNecessario() {
        guard !iniciou else { return }
        iniciou = true
        Task { await conectar() }
    }

    private func conectar() async {
        status = .conectando
        do {
            // 1. POST sem body pra obter sala + token de viewer.
            var req = URLRequest(url: roomEndpoint)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.timeoutInterval = 20

            let (data, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                throw NSError(domain: "TesteAoVivo", code: http.statusCode,
                              userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode) ao criar sala"])
            }
            let room = try JSONDecoder().decode(RoomResponse.self, from: data)
            guard let url = URL(string: room.roomUrl) else {
                throw NSError(domain: "TesteAoVivo", code: -1,
                              userInfo: [NSLocalizedDescriptionKey: "roomUrl inválida: \(room.roomUrl)"])
            }

            // 2. Entra como VIEWER — câmera e microfone do app DESLIGADOS.
            let settings = ClientSettingsUpdate(
                inputs: .set(
                    camera: .set(.enabled(false)),
                    microphone: .set(.enabled(false))
                )
            )
            _ = try await callClient.join(
                url: url,
                token: MeetingToken(stringValue: room.tokenBox),
                settings: settings
            )

            status = .aoVivo
            // Garante mesmo após reconfigs que nada do app é publicado.
            try? await callClient.setInputsEnabled([.camera: false, .microphone: false])
            // Pega quem já estava na sala (notebook pode ter entrado antes).
            atualizarTrackRemoto()
        } catch {
            detalheErro = error.localizedDescription
            status = .falhou(error.localizedDescription)
        }
    }

    /// Procura o primeiro participante remoto com track de câmera e publica.
    private func atualizarTrackRemoto() {
        let remotos = callClient.participants.remote.values
        for p in remotos {
            if let track = p.media?.camera.track {
                if remoteTrack !== track { remoteTrack = track }
                return
            }
        }
        remoteTrack = nil
    }

    func sair() {
        Task { try? await callClient.leave() }
    }
}

// MARK: - Delegate do Daily

extension TesteAoVivoModel: CallClientDelegate {
    nonisolated func callClient(_ callClient: CallClient, callStateUpdated state: CallState) {
        Task { @MainActor in
            switch state {
            case .joined:
                if case .falhou = self.status { } else { self.status = .aoVivo }
                self.atualizarTrackRemoto()
            case .joining:
                self.status = .conectando
            case .left:
                break
            default:
                break
            }
        }
    }

    nonisolated func callClient(_ callClient: CallClient, participantJoined participant: Participant) {
        Task { @MainActor in self.atualizarTrackRemoto() }
    }

    nonisolated func callClient(_ callClient: CallClient, participantUpdated participant: Participant) {
        Task { @MainActor in self.atualizarTrackRemoto() }
    }

    nonisolated func callClient(_ callClient: CallClient, participantLeft participant: Participant, withReason reason: ParticipantLeftReason) {
        Task { @MainActor in self.atualizarTrackRemoto() }
    }

    nonisolated func callClient(_ callClient: CallClient, error: CallClientError) {
        Task { @MainActor in
            let msg = String(describing: error)
            self.detalheErro = msg
            self.status = .falhou(msg)
        }
    }

    nonisolated func callClient(_ callClient: CallClient, appMessageAsJson jsonData: Data, from participantID: ParticipantID) {
        Task { @MainActor in
            guard let pkt = try? JSONDecoder().decode(GpsPacket.self, from: jsonData) else { return }
            // Só atualiza se for pacote de GPS (t == "gps") ou se vier sem `t`.
            if pkt.t == nil || pkt.t == "gps" {
                self.gps = pkt
            }
        }
    }
}

// MARK: - Render de vídeo (VideoView do Daily via UIViewRepresentable)

private struct DailyVideoView: UIViewRepresentable {
    let track: VideoTrack?

    func makeUIView(context: Context) -> Daily.VideoView {
        let v = Daily.VideoView()
        v.videoScaleMode = .fill   // tela cheia (aspectFill)
        v.backgroundColor = .black
        v.track = track
        return v
    }

    func updateUIView(_ uiView: Daily.VideoView, context: Context) {
        if uiView.track !== track {
            uiView.track = track
        }
        uiView.videoScaleMode = .fill
    }
}

// MARK: - Tela

struct TesteAoVivoView: View {
    /// Fechar (opcional — quando aberta via push pode ser nil).
    var onClose: (() -> Void)? = nil
    @StateObject private var model = TesteAoVivoModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Vídeo remoto em tela cheia.
            if let track = model.remoteTrack {
                DailyVideoView(track: track)
                    .ignoresSafeArea()
            } else {
                placeholderVideo
            }

            // Overlays por cima do vídeo.
            VStack {
                topBar
                Spacer()
                gpsOverlay
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .task { model.iniciarSeNecessario() }
        .onDisappear { model.sair() }
    }

    // MARK: Sub-views

    private var placeholderVideo: some View {
        VStack(spacing: 12) {
            switch model.status {
            case .conectando:
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
                Text("Conectando ao espelhamento…")
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.system(size: 15, weight: .medium))
            case .aoVivo:
                Text("Esperando o vídeo do notebook…")
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.system(size: 15, weight: .medium))
            case .falhou(let msg):
                Text("Não consegui conectar")
                    .foregroundStyle(.white)
                    .font(.system(size: 17, weight: .semibold))
                Text(msg)
                    .foregroundStyle(.white.opacity(0.6))
                    .font(.system(size: 13))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            statusPill
            Spacer()
            if onClose != nil {
                Button(action: { onClose?() }) {
                    Text("Fechar")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color.black.opacity(0.55)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var statusPill: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(statusColor)
                .frame(width: 9, height: 9)
            Text(model.status.label.uppercased())
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Capsule().fill(Color.black.opacity(0.55)))
    }

    private var statusColor: Color {
        switch model.status {
        case .conectando: return .yellow
        case .aoVivo: return .green
        case .falhou: return .red
        }
    }

    @ViewBuilder
    private var gpsOverlay: some View {
        if let gps = model.gps {
            HStack(alignment: .bottom, spacing: 20) {
                // Velocidade grande.
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(Int((gps.spd ?? 0).rounded()))")
                        .font(.system(size: 64, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text("km/h")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                // Satélites + sinal.
                VStack(alignment: .trailing, spacing: 6) {
                    metric(valor: "\(gps.numSV ?? 0)", rotulo: "satélites")
                    if let ver = gps.ver, !ver.isEmpty {
                        Text(ver)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.black.opacity(0.55))
            )
        }
    }

    private func metric(valor: String, rotulo: String) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(valor)
                .font(.system(size: 28, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(rotulo)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
        }
    }
}

#Preview("Teste ao vivo") {
    TesteAoVivoView()
}
