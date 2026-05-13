// ═══════════════════════════════════════════════════════════
// VoltaDetalheView — detalhe da volta (S6 rodada 1, 2026-05-12)
// ═══════════════════════════════════════════════════════════
// Tela nova aberta ao tocar numa volta dentro do PosStintView quando
// o evento está marcado como passado. Mostra:
//   • Header: tempo da volta + tag (melhor do stint quando aplicável)
//   • Player de vídeo (AVKit), abre no instante da volta dentro da
//     gravação Daily.co quando há triagem mantida pra essa volta.
//   • Dados gerais: pista, data, carro, piloto.
//   • Dados de engenharia: pressão óleo / temp motor / temp pneus /
//     vel. máxima — tudo "—" enquanto o T4000 não estiver integrado
//     (recomendação Flávio P3 #13: construir tela mesmo sem dados).
//
// Decisões de produto:
// • #12 (player dentro do app, não browser). Atende.
// • #13 (dados de engenharia tolerantes ao "—"). Atende.
//
// Pendência operacional honesta:
// • A URL da GRAVAÇÃO Daily.co não está no modelo (VideoStream tem
//   `dailyRoomUrl` que é a sala AO VIVO). Quando o webhook do Daily.co
//   chegar trazendo a URL da gravação salva, o player toca. Hoje, se
//   há VoltaVideo mantida mas sem URL de gravação, banner explica.

import SwiftUI
import AVKit
import P1FastCore

struct VoltaDetalheView: View {
    let volta: Volta
    let stint: Stint
    let contextoLinha: String
    let melhorVoltaMs: Int?
    let onClose: () -> Void

    @EnvironmentObject private var voltaVideoRepo: VoltaVideoRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var eventoRepo: EventoRepository

    @State private var voltaVideo: VoltaVideo?
    @State private var videoStream: VideoStream?
    @State private var carregando = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            topbar
            header
            playerSection
            dadosGeraisSection
            engenhariaSection
        }
    }

    // MARK: - Topbar

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Voltar")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Volta #\(volta.numero)")
            HStack(alignment: .lastTextBaseline, spacing: 12) {
                Text(volta.tempoMs.map { formatTempoMs($0) } ?? "—")
                    .font(.system(size: 38, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-1.14)
                    .foregroundStyle(ehMelhorVolta ? Color.ouro : Color.text)
                    .lineLimit(1)
                if ehMelhorVolta {
                    EventTag(text: "Melhor do stint", kind: .ouro)
                }
                if !volta.valida {
                    EventTag(text: volta.motivoInvalidacao ?? "Inválida", kind: .atencao)
                }
            }
            if !contextoLinha.isEmpty {
                Text(contextoLinha)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var ehMelhorVolta: Bool {
        guard let melhor = melhorVoltaMs, let t = volta.tempoMs, volta.valida else { return false }
        return t == melhor
    }

    // MARK: - Player

    @ViewBuilder
    private var playerSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Vídeo da volta".uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)

            playerCard
        }
    }

    @ViewBuilder
    private var playerCard: some View {
        let url = playerURL
        ZStack {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
            if let url = url {
                VideoPlayer(player: makePlayer(url: url))
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            } else {
                playerPlaceholder
                    .frame(height: 220)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private var playerPlaceholder: some View {
        VStack(spacing: 10) {
            Image(systemName: "video.slash")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Color.textFaint)
            Text(estadoPlayerTexto)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
        }
    }

    private var estadoPlayerTexto: String {
        if carregando { return "Carregando…" }
        if voltaVideo == nil {
            return "Esta volta não foi gravada (sem vídeo associado)."
        }
        if voltaVideo?.status == .descartada {
            return "Volta marcada como descartada na triagem — sem reprodução."
        }
        return "Gravação ainda não disponível. A integração com a Daily.co salva a gravação após o evento."
    }

    /// URL pra reprodução. Hoje o app NÃO grava a URL da gravação final
    /// — só a sala ao vivo. Quando o webhook do Daily.co trouxer a URL
    /// da gravação salva (campo futuro em video_streams), retorna ela
    /// aqui. Por enquanto nil → mostra placeholder.
    private var playerURL: URL? {
        // Quando houver campo `recordingUrl` em VideoStream, retorná-lo
        // aqui se a triagem é mantida. Hoje retorna nil.
        return nil
    }

    private func makePlayer(url: URL) -> AVPlayer {
        let player = AVPlayer(url: url)
        if let t = voltaVideo?.tInicioMs {
            let segundos = Double(t) / 1000.0
            player.seek(to: CMTime(seconds: segundos, preferredTimescale: 600))
        }
        return player
    }

    // MARK: - Dados gerais

    private var dadosGeraisSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Dados gerais".uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)

            VStack(spacing: 6) {
                campoLinha(rotulo: "Pista", valor: contextoPista)
                campoLinha(rotulo: "Data", valor: contextoData)
                campoLinha(rotulo: "Carro", valor: carroDisplay)
                campoLinha(rotulo: "Piloto", valor: pilotoDisplay)
            }
        }
    }

    private var contextoPista: String {
        guard let eventoId = stint.sessao.eventoId,
              let ev = eventoRepo.find(id: eventoId) else { return "—" }
        return ev.pistaDisplay
    }

    private var contextoData: String {
        guard let eventoId = stint.sessao.eventoId,
              let ev = eventoRepo.find(id: eventoId) else { return "—" }
        return formatDataLongaPiquet(ms: ev.evento.dataEvento, layoutShort: ev.pistaLayoutShort)
    }

    private var carroDisplay: String {
        guard let carroId = stint.sessao.carroId,
              let carro = carroRepo.carros.first(where: { $0.id == carroId }) else {
            return "—"
        }
        return carro.apelido
    }

    private var pilotoDisplay: String {
        if let n = stint.pilotoNome, !n.isEmpty { return n }
        return "—"
    }

    // MARK: - Dados de engenharia

    private var engenhariaSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Dados de engenharia".uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)

            Text("Capturados pelo T4000 quando conectado. Sem T4000, os campos abaixo aparecem como '—' — a tela está pronta pra receber o dado quando o hardware estiver integrado.")
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)
                .padding(.bottom, 4)

            VStack(spacing: 6) {
                campoLinha(rotulo: "Pressão do óleo", valor: "—")
                campoLinha(rotulo: "Temperatura do motor", valor: "—")
                campoLinha(rotulo: "Temperatura dos pneus", valor: "—")
                campoLinha(rotulo: "Velocidade máxima", valor: "—")
                campoLinha(rotulo: "Temperatura ambiente", valor: "—")
                campoLinha(rotulo: "Pressão dos pneus", valor: "—")
            }
        }
    }

    // MARK: - Helpers visuais

    private func campoLinha(rotulo: String, valor: String) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(rotulo)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.textMuted)
            Spacer(minLength: 0)
            Text(valor)
                .font(.system(size: 14, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(valor == "—" ? Color.textFaint : Color.text)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    // MARK: - Carregamento

    private func carregar() async {
        do {
            if let vv = try await voltaVideoRepo.findMantidaForVolta(voltaId: volta.id) {
                voltaVideo = vv
                videoStream = try await voltaVideoRepo.loadStream(videoStreamId: vv.videoStreamId)
            }
        } catch {
            print("VoltaDetalheView.carregar erro: \(error)")
        }
        carregando = false
    }
}
