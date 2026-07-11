// ═══════════════════════════════════════════════════════════
// ReverVoltaDemoView — DEMONSTRAÇÃO da ETAPA 3 ("rever a volta")
// ═══════════════════════════════════════════════════════════
// Prova o MOTOR DE SINCRONIZAÇÃO: dado um tempo da gravação, mostra a
// posição e a velocidade do carro NAQUELE instante. É exatamente o que
// liga VÍDEO ↔ DADOS (tabela `volta_video` indexa cada volta por offset
// em ms dentro da gravação). Aqui: arrastar a LINHA DO TEMPO (ou tocar)
// move JUNTOS o ponto do vídeo (placeholder — sem vídeo real ainda) e a
// bolinha + velocidade no mapa.
//
// Dado = volta REAL gravada do Bubi (AssistirDemoVolta). NÃO é ao vivo,
// NÃO é vídeo real. É andaime de demonstração: reusa o mapa oficial e a
// amarração aprovados (PistaBrasilia), sem inventar tela de produção.
// Atalho: --p1-rever-volta-demo.

import SwiftUI

// MARK: - Motor de sincronização (tempo da gravação → posição + velocidade)

extension AssistirDemoVolta {
    /// Duração total da gravação embutida (ms desde o início).
    static var duracaoTotalMs: Double { amostras.last?.t ?? 0 }

    /// Posição (lat/lng) interpolada e velocidade (km/h) no tempo `t` (ms).
    /// É a conta que um player de vídeo usaria: "no segundo X do vídeo, o
    /// carro estava AQUI, a tantos km/h". Velocidade vem do movimento real.
    static func estadoEm(_ t: Double) -> (lat: Double, lng: Double, spd: Double) {
        guard amostras.count > 1 else {
            let a = amostras.first
            return (a?.lat ?? 0, a?.lng ?? 0, 0)
        }
        let alvo = min(max(t, amostras.first!.t), amostras.last!.t)
        // acha o par de amostras que cerca o tempo alvo
        var i = 1
        while i < amostras.count && amostras[i].t < alvo { i += 1 }
        if i >= amostras.count { i = amostras.count - 1 }
        let a = amostras[i - 1], b = amostras[i]
        let span = b.t - a.t
        let f = span > 0 ? (alvo - a.t) / span : 0
        let lat = a.lat + (b.lat - a.lat) * f
        let lng = a.lng + (b.lng - a.lng) * f
        // velocidade do trecho a→b (distância / tempo)
        var spd = 0.0
        if span > 0 {
            let metros = distanciaMetrosDemo(a.lat, a.lng, b.lat, b.lng)
            spd = (metros / (span / 1000.0)) * 3.6
        }
        return (lat, lng, spd)
    }

    private static func distanciaMetrosDemo(_ lat1: Double, _ lng1: Double,
                                            _ lat2: Double, _ lng2: Double) -> Double {
        let r = 6_371_000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let s = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLng / 2) * sin(dLng / 2)
        return r * 2 * atan2(sqrt(s), sqrt(1 - s))
    }
}

// MARK: - Tela

struct ReverVoltaDemoView: View {
    var onClose: (() -> Void)? = nil

    /// Posição na linha do tempo (ms desde o início da gravação).
    @State private var tMs: Double = 0
    @State private var tocando = false
    @State private var playId = 0

    private var estado: (lat: Double, lng: Double, spd: Double) {
        AssistirDemoVolta.estadoEm(tMs)
    }

    private var pontoNoMapa: CGPoint {
        PistaBrasilia.pontoNoDesenho(lat: estado.lat, lng: estado.lng)
    }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                videoPane
                    .frame(height: max(180, geo.size.height * 0.30))
                    .clipped()

                faixaVelocidade

                ReverMapaView(carro: pontoNoMapa)

                linhaDoTempo
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 18)
                    .background(Color(red: 0.04, green: 0.05, blue: 0.07))
            }
        }
        .background(Color.black)
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .onChange(of: tocando) { ligado in if ligado { iniciarPlay() } }
        .onAppear { tocando = true }   // demo abre já tocando a gravação
        .onDisappear { tocando = false }
    }

    // ── Vídeo (placeholder sincronizado) ──
    private var videoPane: some View {
        ZStack {
            Color.black
            VStack(spacing: 8) {
                Text("VÍDEO DA VOLTA entra aqui")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
                Text("sincronizado em \(fmtTempo(tMs))")
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.45))
            }
            VStack {
                HStack(spacing: 7) {
                    Circle().fill(.orange).frame(width: 9, height: 9)
                    Text("REVER A VOLTA")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                    Spacer()
                    if onClose != nil {
                        Button(action: { onClose?() }) {
                            Text("Fechar")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(Capsule().fill(Color.black.opacity(0.55)))
                        }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14).padding(.top, 8)
                Spacer()
            }
        }
    }

    // ── Velocidade no instante ──
    private var faixaVelocidade: some View {
        HStack(alignment: .bottom, spacing: 18) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(Int(estado.spd.rounded()))")
                    .font(.system(size: 52, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white).monospacedDigit()
                Text("km/h")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            Text("DEMONSTRAÇÃO — volta gravada do Bubi (sem vídeo real ainda)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.orange.opacity(0.95))
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 220, alignment: .trailing)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Color(red: 0.04, green: 0.05, blue: 0.07))
    }

    // ── Linha do tempo (scrubber) + tocar/pausar ──
    private var linhaDoTempo: some View {
        VStack(spacing: 8) {
            HStack {
                Button(action: { tocando.toggle() }) {
                    Text(tocando ? "Pausar" : "Tocar")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(Capsule().fill(Color.blue.opacity(0.85)))
                }.buttonStyle(.plain)
                Spacer()
                Text("\(fmtTempo(tMs)) / \(fmtTempo(AssistirDemoVolta.duracaoTotalMs))")
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.7))
            }
            // Arrastar a barra com o dedo PAUSA (scrub manual); o avanço
            // automático do "Tocar" mexe em tMs sem disparar isto.
            Slider(value: $tMs, in: 0...max(1, AssistirDemoVolta.duracaoTotalMs),
                   onEditingChanged: { arrastando in if arrastando { tocando = false } })
                .tint(.orange)
        }
    }

    private func iniciarPlay() {
        playId += 1
        let meu = playId
        Task { @MainActor in
            let total = AssistirDemoVolta.duracaoTotalMs
            while tocando && meu == playId {
                tMs += 600                 // 600 ms de gravação a cada 50 ms de relógio (12×)
                if tMs >= total { tMs = 0 }
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
    }

    private func fmtTempo(_ ms: Double) -> String {
        let s = max(0, ms) / 1000.0
        let m = Int(s) / 60, seg = Int(s) % 60
        return String(format: "%d:%02d", m, seg)
    }
}

// MARK: - Mapa com a bolinha na posição sincronizada

private struct ReverMapaView: View {
    let carro: CGPoint

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

                Circle()
                    .fill(Color.red)
                    .frame(width: 14, height: 14)
                    .overlay(Circle().stroke(Color.white.opacity(0.9), lineWidth: 2))
                    .position(x: ox + carro.x * escala, y: oy + carro.y * escala)
                    .animation(.linear(duration: 0.05), value: carro)
            }
        }
    }
}

#Preview("Rever a volta (demo)") {
    ReverVoltaDemoView(onClose: {})
}
