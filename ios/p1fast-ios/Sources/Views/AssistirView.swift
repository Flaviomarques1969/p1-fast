// ═══════════════════════════════════════════════════════════
// AssistirView — tela de ESPECTADOR (decisão Flávio 2026-06-09)
// ═══════════════════════════════════════════════════════════
// "Tela para pessoas assistirem no app: vídeo em tempo real na
// parte de cima e os dados básicos de trecho e volta no geral
// do piloto" embaixo.
//
// Fonte dos dados: a própria sala de vídeo (Daily.co). A Central
// de Pista (p1tv.vercel.app, no notebook) entra na sala e repassa:
//   { "t":"gps",    spd, numSV, ver, ... }            (5x/s)
//   { "t":"carro",  rpm, kmh, agua, lam, bat, sim }   (2x/s)
//   { "t":"painel", voltaN, voltaS, ultimaS, melhorS,
//                   trecho, deltaS, sim }              (1x/s)
// Quem produz volta/trecho é o painel do piloto (análise central);
// a Central só repassa — nenhuma análise é duplicada aqui.
//
// Viewer puro: câmera e microfone do aparelho NUNCA são publicados.
// Entrada: botão "ASSISTIR AO VIVO" na Home + launch arg --p1-assistir.

import SwiftUI
import UIKit
import Daily
import os

// MARK: - Modelos

private struct AssistirRoomResponse: Decodable {
    let roomUrl: String
    let tokenBox: String
    let roomName: String?
}

/// Superset de todas as mensagens que chegam pela sala (separadas pelo `t`).
private struct LiveMsg: Decodable {
    let t: String?
    // gps
    let spd: Double?
    let numSV: Int?
    let ver: String?
    let lat: Double?
    let lon: Double?
    // carro
    let rpm: Double?
    let kmh: Double?
    let agua: Double?
    let lam: Double?
    let bat: Double?
    // painel (volta/trecho)
    let voltaN: Int?
    let voltaS: Double?
    let ultimaS: Double?
    let melhorS: Double?
    let trecho: String?
    let deltaS: Double?
    let sim: Bool?

    /// Construtor enxuto usado SÓ pelo modo de demonstração (posição + velocidade
    /// vindas da volta gravada). Decodificação da sala segue pelo init sintetizado.
    init(spd: Double? = nil, lat: Double? = nil, lon: Double? = nil) {
        self.t = "gps"; self.spd = spd; self.lat = lat; self.lon = lon
        self.numSV = nil; self.ver = nil
        self.rpm = nil; self.kmh = nil; self.agua = nil; self.lam = nil; self.bat = nil
        self.voltaN = nil; self.voltaS = nil; self.ultimaS = nil; self.melhorS = nil
        self.trecho = nil; self.deltaS = nil; self.sim = nil
    }
}

private enum AssistirStatus: Equatable {
    case conectando
    case aoVivo
    case demonstracao
    case falhou(String)

    var label: String {
        switch self {
        case .conectando: return "conectando…"
        case .aoVivo: return "ao vivo"
        case .demonstracao: return "demonstração"
        case .falhou: return "falhou"
        }
    }
}

// MARK: - ViewModel

@MainActor
private final class AssistirModel: NSObject, ObservableObject {
    @Published var status: AssistirStatus = .conectando
    @Published var remoteTrack: VideoTrack?
    @Published var gps: LiveMsg?
    @Published var carro: LiveMsg?
    @Published var painel: LiveMsg?
    @Published var carroVistoEm: Date?
    @Published var painelVistoEm: Date?

    private let callClient = CallClient()
    private var iniciou = false
    private var encerrado = false
    private let roomEndpoint = URL(string: "https://p1tv.vercel.app/api/room")!
    private let log = Logger(subsystem: "com.flaviomarques.p1fast", category: "assistir")

    /// Demonstração: toca a volta gravada do Bubi em vez de conectar na sala.
    let demo: Bool
    private var demoTask: Task<Void, Never>?

    init(demo: Bool = false) {
        self.demo = demo
        super.init()
        callClient.delegate = self
    }

    func iniciarSeNecessario() {
        guard !iniciou else { return }
        iniciou = true
        if demo { iniciarDemo(); return }
        Task { await conectar() }
    }

    /// Modo demonstração: sem sala de vídeo, sem rede. Anda a bolinha pela volta
    /// REAL gravada (881 amostras) e mostra a velocidade derivada do movimento.
    /// Uma amostra a cada 50 ms → volta visível e contínua; ao fim, repete.
    private func iniciarDemo() {
        status = .demonstracao
        demoTask = Task { @MainActor in
            let am = AssistirDemoVolta.amostras
            guard am.count > 1 else { return }
            while !Task.isCancelled {
                for i in am.indices {
                    if Task.isCancelled { return }
                    let cur = am[i]
                    var spd = 0.0
                    if i > 0 {
                        let prev = am[i - 1]
                        let dt = (cur.t - prev.t) / 1000.0
                        if dt > 0 {
                            let metros = Self.distanciaMetros(prev.lat, prev.lng, cur.lat, cur.lng)
                            spd = (metros / dt) * 3.6
                        }
                    }
                    self.gps = LiveMsg(spd: spd, lat: cur.lat, lon: cur.lng)
                    try? await Task.sleep(nanoseconds: 50_000_000)
                }
            }
        }
    }

    /// Distância em metros entre dois pontos GPS (haversine).
    private static func distanciaMetros(_ lat1: Double, _ lng1: Double,
                                        _ lat2: Double, _ lng2: Double) -> Double {
        let r = 6_371_000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLng / 2) * sin(dLng / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    private func conectar() async {
        status = .conectando
        do {
            var req = URLRequest(url: roomEndpoint)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.timeoutInterval = 20

            let (data, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                throw NSError(domain: "Assistir", code: http.statusCode,
                              userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode) ao criar sala"])
            }
            let room = try JSONDecoder().decode(AssistirRoomResponse.self, from: data)
            guard let url = URL(string: room.roomUrl) else {
                throw NSError(domain: "Assistir", code: -1,
                              userInfo: [NSLocalizedDescriptionKey: "roomUrl inválida"])
            }

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
            try? await callClient.setInputsEnabled([.camera: false, .microphone: false])
            atualizarTrackRemoto()
        } catch {
            // Flávio 11/07: nada de erro técnico na tela do espectador — o detalhe
            // vai pro log e a tela mostra só o aviso calmo de "sem transmissão".
            status = .falhou(error.localizedDescription)
            log.error("P1ASSISTIR falha ao conectar: \(String(describing: error), privacy: .public)")
            agendarNovaTentativa()
        }
    }

    /// Sem transmissão não é beco sem saída: tenta de novo sozinho a cada 20s,
    /// em silêncio — quando houver transmissão, o vídeo entra sem toque do usuário.
    private func agendarNovaTentativa() {
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 20_000_000_000)
            guard let self, !self.encerrado else { return }
            if case .falhou = self.status {
                self.iniciou = false
                self.iniciarSeNecessario()
            }
        }
    }

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
        demoTask?.cancel()
        demoTask = nil
        encerrado = true
        Task { try? await callClient.leave() }
    }
}

extension AssistirModel: CallClientDelegate {
    nonisolated func callClient(_ callClient: CallClient, callStateUpdated state: CallState) {
        Task { @MainActor in
            switch state {
            case .joined:
                if case .falhou = self.status { } else { self.status = .aoVivo }
                self.atualizarTrackRemoto()
            case .joining:
                self.status = .conectando
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
            self.status = .falhou(error.localizedDescription)
            self.log.error("P1ASSISTIR erro da sala: \(String(describing: error), privacy: .public)")
            self.agendarNovaTentativa()
        }
    }

    nonisolated func callClient(_ callClient: CallClient, appMessageAsJson jsonData: Data, from participantID: ParticipantID) {
        Task { @MainActor in
            guard let msg = try? JSONDecoder().decode(LiveMsg.self, from: jsonData) else { return }
            switch msg.t {
            case "gps", .none:    self.gps = msg
            case "carro":         self.carro = msg;  self.carroVistoEm = Date()
            case "painel":        self.painel = msg; self.painelVistoEm = Date()
            default: break
            }
        }
    }
}

// MARK: - Render de vídeo

private struct AssistirVideoView: UIViewRepresentable {
    let track: VideoTrack?

    func makeUIView(context: Context) -> Daily.VideoView {
        let v = Daily.VideoView()
        v.videoScaleMode = .fill
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

struct AssistirView: View {
    var onClose: (() -> Void)? = nil
    /// Demonstração com a volta gravada (sem carro na pista / sem sala de vídeo).
    var demo: Bool = false
    @StateObject private var model: AssistirModel

    init(onClose: (() -> Void)? = nil, demo: Bool = false) {
        self.onClose = onClose
        self.demo = demo
        _model = StateObject(wrappedValue: AssistirModel(demo: demo))
    }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                // ── CIMA: vídeo ao vivo ──
                ZStack {
                    Color.black
                    if let track = model.remoteTrack {
                        AssistirVideoView(track: track)
                    } else {
                        placeholderVideo
                    }
                    VStack {
                        topBar
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 8)
                }
                .frame(height: max(200, geo.size.height * 0.32))
                .clipped()

                // ── MEIO: velocidade + a linha da volta ──
                VStack(spacing: 12) {
                    linhaVelocidadeEVolta
                    if model.demo {
                        Text("DEMONSTRAÇÃO — volta gravada do Bubi (não é o carro ao vivo)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.orange.opacity(0.95))
                            .frame(maxWidth: .infinity)
                    } else if ehSimulado {
                        Text("DADOS DO SIMULADOR (não é o carro real)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.yellow.opacity(0.9))
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(red: 0.04, green: 0.05, blue: 0.07))

                // ── BAIXO: mapa oficial de Brasília com a bolinha do carro ──
                MapaPistaView(carro: pontoCarroNoMapa)
            }
        }
        .background(Color.black)
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .task { model.iniciarSeNecessario() }
        .onDisappear { model.sair() }
    }

    /// Posição do carro convertida pro espaço do desenho oficial.
    private var pontoCarroNoMapa: CGPoint? {
        guard let g = model.gps, let lat = g.lat, let lon = g.lon,
              lat != 0 || lon != 0 else { return nil }
        return PistaBrasilia.pontoNoDesenho(lat: lat, lng: lon)
    }

    // MARK: Estado derivado

    private var ehSimulado: Bool {
        (model.carro?.sim ?? false) || (model.painel?.sim ?? false)
    }

    /// Dados do carro mais velhos que 5s não são mostrados como "ao vivo".
    private var carroFresco: LiveMsg? {
        guard let c = model.carro, let t = model.carroVistoEm,
              Date().timeIntervalSince(t) < 5 else { return nil }
        return c
    }

    private var painelFresco: LiveMsg? {
        guard let p = model.painel, let t = model.painelVistoEm,
              Date().timeIntervalSince(t) < 5 else { return nil }
        return p
    }

    // MARK: Sub-views

    private var placeholderVideo: some View {
        VStack(spacing: 10) {
            switch model.status {
            case .conectando:
                ProgressView().progressViewStyle(.circular).tint(.white)
                Text("Conectando…")
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.system(size: 14, weight: .medium))
            case .demonstracao:
                Text("Demonstração — aqui entra o vídeo da câmera do carro")
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.system(size: 14, weight: .medium))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
            default:
                // Flávio 11/07: sem transmissão (sala vazia OU conexão que falhou)
                // = um único aviso elegante. Erro técnico nunca aparece na tela.
                avisoSemTransmissao
            }
        }
    }

    private var avisoSemTransmissao: some View {
        VStack(spacing: 9) {
            Image(systemName: "antenna.radiowaves.left.and.right.slash")
                .font(.system(size: 27, weight: .light))
                .foregroundStyle(.white.opacity(0.4))
            Text("Sem transmissão no momento")
                .foregroundStyle(.white.opacity(0.9))
                .font(.system(size: 16, weight: .semibold))
            Text("Quando o carro entrar na pista, o vídeo aparece aqui sozinho.")
                .foregroundStyle(.white.opacity(0.5))
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 7) {
                Circle().fill(statusColor).frame(width: 9, height: 9)
                Text(statusRotulo)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(Color.black.opacity(0.55)))
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

    /// Selo do topo (Flávio 11/07): "AO VIVO" verde só quando o vídeo realmente
    /// chega; sem vídeo = "SEM TRANSMISSÃO" neutro (vermelho fica pro crítico).
    private var statusRotulo: String {
        if model.remoteTrack != nil { return "AO VIVO" }
        switch model.status {
        case .conectando: return "CONECTANDO…"
        default: return "SEM TRANSMISSÃO"
        }
    }

    private var statusColor: Color {
        if model.remoteTrack != nil { return .green }
        switch model.status {
        case .conectando: return .yellow
        case .demonstracao: return .orange
        default: return Color(white: 0.6)
        }
    }

    /// MEIO — velocidade grande + a linha da volta (decisão Flávio 09/06):
    /// VOLTA nº · tempo EM CURSO (verde se naquele ponto está melhor que a
    /// melhor volta do dia, vermelho se pior) · MELHOR volta do dia.
    private var linhaVelocidadeEVolta: some View {
        HStack(alignment: .bottom, spacing: 18) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(Int((model.gps?.spd ?? carroFresco?.kmh ?? 0).rounded()))")
                    .font(.system(size: 52, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("km/h")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            if let p = painelFresco {
                metrica(valor: p.voltaN.map { "\($0)" } ?? "—", rotulo: "volta")
                metrica(valor: fmtTempoCorrendo(p.voltaS), rotulo: "em curso",
                        cor: corDelta(p.deltaS))
                metrica(valor: fmtTempoVolta(p.melhorS), rotulo: "melhor")
            } else {
                Text("aguardando o painel do piloto…")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.45))
            }
        }
    }

    private func metrica(valor: String, rotulo: String, cor: Color = .white) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(valor)
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .foregroundStyle(cor)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(rotulo)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.55))
        }
    }

    // MARK: Formatação

    private func fmtTempoCorrendo(_ s: Double?) -> String {
        guard let s, s >= 0 else { return "—" }
        let m = Int(s) / 60, seg = Int(s) % 60
        return String(format: "%d:%02d", m, seg)
    }

    private func fmtTempoVolta(_ s: Double?) -> String {
        guard let s, s > 0 else { return "—" }
        let m = Int(s) / 60
        let resto = s - Double(m * 60)
        return String(format: "%d:%04.1f", m, resto)
    }

    private func corDelta(_ d: Double?) -> Color {
        guard let d else { return .white }
        if d <= -0.05 { return .green }   // mais rápido que a referência
        if d >= 0.05 { return .red }      // mais lento
        return .white
    }
}

// MARK: - Mapa oficial com a bolinha do carro

/// BAIXO da tela (decisão Flávio 09/06): fundo PRETO, pista oficial de
/// Brasília em CINZA (desenho DEFINITIVO posicionado por ele), e a
/// bolinha mostrando onde o carro está (GPS → desenho via amarração).
private struct MapaPistaView: View {
    let carro: CGPoint?

    var body: some View {
        GeometryReader { geo in
            let escala = min(geo.size.width / PistaBrasilia.larguraDesenho,
                             geo.size.height / PistaBrasilia.alturaDesenho) * 0.92
            let ox = (geo.size.width - PistaBrasilia.larguraDesenho * escala) / 2
            let oy = (geo.size.height - PistaBrasilia.alturaDesenho * escala) / 2

            ZStack {
                Color.black
                Path { p in
                    let pts = PistaBrasilia.desenho
                    guard let primeiro = pts.first else { return }
                    p.move(to: CGPoint(x: ox + primeiro.x * escala, y: oy + primeiro.y * escala))
                    for pt in pts.dropFirst() {
                        p.addLine(to: CGPoint(x: ox + pt.x * escala, y: oy + pt.y * escala))
                    }
                    p.closeSubpath()
                }
                .stroke(Color(white: 0.55), style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))

                if let c = carro {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().stroke(Color.white.opacity(0.9), lineWidth: 2))
                        .position(x: ox + c.x * escala, y: oy + c.y * escala)
                        .animation(.linear(duration: 0.2), value: c)
                }
            }
        }
        .ignoresSafeArea(edges: .bottom)
    }
}

#Preview("Assistir ao vivo") {
    AssistirView()
}
