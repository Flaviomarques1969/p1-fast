// ═══════════════════════════════════════════════════════════
// CarroHubView — hub do carro (2026-05-31)
// ═══════════════════════════════════════════════════════════
// Aberto ao tocar num carro na Garagem. Topo = foto grande do carro
// edge-to-edge esmaecendo pra baixo (hero premium), com nome e stats
// na frente; embaixo = 3 botões: Cadastro · Manutenção · Estoque.

import SwiftUI
import UIKit
import P1FastCore

struct CarroHubView: View {
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var manutencaoStore: ManutencaoConsumiveisStore
    @EnvironmentObject private var pecaRepo: PecaRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var arquivoRepo: ArquivoRepository

    let carroId: String
    let onClose: () -> Void

    @State private var fotoCarro: UIImage?
    @State private var mostrarConfirmaApagar = false

    private var carro: Carro? { carroRepo.carros.first { $0.id == carroId } }

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()

            // Foto do carro como FUNDO da tela: ancorada no topo, esmaecendo
            // pro fundo escuro embaixo pra manter texto e botões legíveis.
            // (2026-05-31 — pedido do Flávio.)
            fotoDeFundo

            ScrollView {
                VStack(spacing: 0) {
                    // Empurra os dados pra logo abaixo do retrovisor do carro.
                    Color.clear.frame(height: 172)
                    heroTexto
                    VStack(spacing: 10) {
                        statsRow
                        botoes
                    }
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 44)
                }
                .frame(maxWidth: .infinity)
            }
            .ignoresSafeArea(edges: .top)
        }
        .overlay(alignment: .topTrailing) {
            botaoFechar
                .padding(.trailing, Spacing.md)
                .padding(.top, Spacing.sm)
        }
        .preferredColorScheme(.dark)
        // Hub tem foto edge-to-edge + "X" próprio: esconde a barra de
        // navegação nativa pra não duplicar o "voltar" nem cortar a foto.
        .toolbar(.hidden, for: .navigationBar)
        .task {
            fotoCarro = CarroFoto.carregar(carroId: carroId)
            await manutencaoStore.carregarStatus(carroId: carroId)
        }
        // Recarrega a foto ao voltar do Cadastro (que agora é página
        // empilhada, não folha com onDismiss).
        .onAppear {
            fotoCarro = CarroFoto.carregar(carroId: carroId)
        }
    }

    // MARK: - Hero (texto sobre a foto de fundo)

    private var heroTexto: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Painel do carro")
            Text(carro?.apelido ?? "Carro")
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
                .shadow(color: .black.opacity(0.55), radius: 8, y: 1)
            Text(modelLine)
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .shadow(color: .black.opacity(0.45), radius: 6, y: 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.lg)
        .padding(.bottom, Spacing.sm)
    }

    /// Foto de fundo com a LARGURA TRAVADA na largura da tela. Sem isso,
    /// o `scaledToFill` faz a imagem "inflar" (reportar largura ~2× a tela)
    /// e empurra números e botões pra fora — o vazamento que o Flávio viu.
    private var fotoDeFundo: some View {
        GeometryReader { geo in
            fotoFundo
                .frame(width: geo.size.width, height: 430)
                .clipped()
                .overlay(
                    LinearGradient(
                        colors: [Color.clear, Color.clear,
                                 Color.surface.opacity(0.6), Color.surface],
                        startPoint: .top, endPoint: .bottom
                    )
                    .frame(width: geo.size.width, height: 430)
                )
                .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private var fotoFundo: some View {
        if let img = fotoCarro {
            Image(uiImage: img).resizable().scaledToFill()
        } else {
            ZStack {
                LinearGradient(colors: [Color.surfaceRaised, Color.surface], startPoint: .top, endPoint: .bottom)
                Image(systemName: "car.fill")
                    .font(.system(size: 46))
                    .foregroundStyle(Color.textFaint)
                    .padding(.bottom, 40)
            }
        }
    }

    private var botaoFechar: some View {
        Button { onClose() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.text)
                .padding(9)
                .background(Circle().fill(Color.surface.opacity(0.55)))
                .overlay(Circle().stroke(Color.border.opacity(0.6), lineWidth: 1))
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: Spacing.sm) {
            stat(valor: "\(stints)", rotulo: "Stints", cor: Color.text)
            stat(valor: "\(qtdPecas)", rotulo: "Peças", cor: Color.text)
            stat(valor: "\(pendencias)", rotulo: "Pendências", cor: pendencias > 0 ? Color.atencao : Color.bom)
        }
    }

    private func stat(valor: String, rotulo: String, cor: Color) -> some View {
        VStack(spacing: 6) {
            Text(valor)
                .font(.system(size: 20, weight: .semibold)).monospacedDigit().tracking(-0.4)
                .foregroundStyle(cor).lineLimit(1)
            Text(rotulo.uppercased())
                .font(.system(size: 10, weight: .medium)).tracking(0.8)
                .foregroundStyle(Color.textFaint).lineLimit(1)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    private var modelLine: String {
        let m = carro?.modelo?.trimmingCharacters(in: .whitespaces)
        let c = carro?.categoria?.trimmingCharacters(in: .whitespaces)
        switch (m, c) {
        case let (m?, c?) where !m.isEmpty && !c.isEmpty: return "\(m) · \(c)"
        case let (m?, _) where !m.isEmpty: return m
        case let (_, c?) where !c.isEmpty: return c
        default: return "Sem modelo cadastrado"
        }
    }

    private var stints: Int { carroRepo.stintsPorCarro[carroId] ?? 0 }
    private var qtdPecas: Int { pecaRepo.pecas(doCarro: carroId).count }
    private var pendencias: Int {
        CatalogoConsumiveisCelta.itens.reduce(0) { acc, item in
            switch manutencaoStore.statusPorItem[item.codigo]?.severidade {
            case .vermelho, .amarelo: return acc + 1
            default: return acc
            }
        }
    }

    // MARK: - Botões

    private var botoes: some View {
        VStack(spacing: 10) {
            NavigationLink(value: HomeNavTarget.carroCadastro(carroId: carroId)) {
                botaoLabel(icone: "slider.horizontal.3", titulo: "Cadastro",
                           subtitulo: "Identidade, foto, setup base e pneus", cor: Color.accent)
            }
            .buttonStyle(.plain)
            NavigationLink(value: HomeNavTarget.manutencao(carroId: carroId)) {
                botaoLabel(icone: "wrench.and.screwdriver.fill", titulo: "Manutenção · consumíveis",
                           subtitulo: "Checagem e troca dos 30 itens · vida das peças", cor: Color.bom)
            }
            .buttonStyle(.plain)
            NavigationLink(value: HomeNavTarget.estoque(carroId: carroId)) {
                botaoLabel(icone: "shippingbox.fill", titulo: "Estoque do carro",
                           subtitulo: "Peças e ferramentas deste carro · locais e quantidades", cor: Color.yellow)
            }
            .buttonStyle(.plain)

            DeleteCadastroButton(label: "Apagar carro") {
                mostrarConfirmaApagar = true
            }
            .padding(.top, 4)
        }
    }

    private func confirmarApagar() {
        guard let c = carro else { onClose(); return }
        Task {
            try? await carroRepo.arquivar(carroId: c.id, rotulo: c.apelido)
            try? await arquivoRepo.reload()
            onClose()
        }
    }

    private func botaoLabel(icone: String, titulo: String, subtitulo: String, cor: Color) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous).fill(cor.opacity(0.16)).frame(width: 44, height: 44)
                Image(systemName: icone).font(.system(size: 18, weight: .semibold)).foregroundStyle(cor)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(titulo).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                Text(subtitulo).font(.system(size: 12)).foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.textFaint)
        }
        .padding(.horizontal, Spacing.md).padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }
}
