// ═══════════════════════════════════════════════════════════
// PneuPickerView — selector de "Pneu montado" do stint
// ═══════════════════════════════════════════════════════════
// Sprint 1A.4 — Prompt #17. Escopado por `carroId` — só aparece pneu
// que pertence ao carro do stint (FK pneus.carro_id). Visual herda do
// mockup `_design-reference/mockup-pneu-lista.html` em modo radio +
// footer "Voltar/Confirmar" (uso original do mockup como selector).
//
// Estados:
//   - lista cheia: radio rows + linha "+ Cadastrar outro pneu" no fim
//   - sem pneus: empty state grande com bullets do mockup + CTA
//     "Cadastrar primeiro pneu" abrindo PneuCadastroView
//   - sem carros (carroId == nil): mensagem informativa, sem CTA — não
//     dá pra cadastrar pneu sem carro (FK obrigatória)
//
// Confirmar dispara `onConfirm(pneuId?)` com o ID escolhido (ou nil
// pra "nenhum"). Voltar dispara `onCancel()` sem persistir.

import SwiftUI
import P1FastCore

struct PneuPickerView: View {
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var carroRepo: CarroRepository

    let carroId: String?
    let stintNumero: Int
    let initialPneuId: String?
    let onCancel: () -> Void
    let onConfirm: (String?) -> Void

    @State private var selecionado: String?
    @State private var hidratado = false
    @State private var sheet: PneuPickerSheet?

    private var pneus: [Pneu] {
        guard let id = carroId else { return [] }
        return pneuRepo.pneusByCarroId[id] ?? []
    }

    private var carroApelido: String {
        guard let id = carroId else { return "carro" }
        return carroRepo.carros.first(where: { $0.id == id })?.apelido ?? "carro"
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            footBar
        }
        .preferredColorScheme(.dark)
        .task { hidratarSelecaoInicial() }
        .sheet(item: $sheet) { which in
            sheetView(for: which)
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.bottom, Spacing.sm)

            if carroId == nil {
                semCarroEmptyState
            } else if pneus.isEmpty {
                semPneuEmptyState
            } else {
                listaPneus
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Pneu montado")
            Text(pneus.isEmpty ? "Nenhum pneu cadastrado" : "Pneu montado")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("Stint #\(stintNumero) · \(carroApelido)")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    // MARK: - Lista (cheia)

    private var listaPneus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Cadastrados".uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32)
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(pneus.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.top, 6)
            .padding(.bottom, 4)

            ForEach(pneus, id: \.id) { pneu in
                pneuRow(pneu)
            }

            addRow
        }
    }

    private func pneuRow(_ pneu: Pneu) -> some View {
        let isOn = selecionado == pneu.id
        // 2026-05-16 Flávio "clicou, já seleciona": tocar confirma e fecha.
        return Button(action: {
            selecionado = pneu.id
            onConfirm(pneu.id)
        }) {
            HStack(spacing: 14) {
                // 2026-05-16 Flávio "não quer bolinhas no botão": removi
                // o indicador de rádio. O destaque do escolhido vem do
                // fundo + borda. Toque = seleciona.
                VStack(alignment: .leading, spacing: 3) {
                    Text(pneuTitulo(pneu))
                        .font(.system(size: 16, weight: .semibold))
                        .tracking(-0.08)
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    Text(pneuHint(pneu))
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(isOn ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isOn ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func pneuTitulo(_ pneu: Pneu) -> String {
        let marca = pneu.marca?.trimmingCharacters(in: .whitespaces) ?? ""
        if marca.isEmpty { return "Pneu" }
        return marca
    }

    private func pneuHint(_ pneu: Pneu) -> String {
        var partes: [String] = []
        if let medida = pneu.medida, !medida.isEmpty { partes.append(medida) }
        if let comp = pneu.composto { partes.append(comp.rawValue) }
        partes.append("\(pneu.ciclos) saída\(pneu.ciclos == 1 ? "" : "s")")
        return partes.joined(separator: " · ")
    }

    private var addRow: some View {
        Button(action: { sheet = .cadastrarPneu }) {
            HStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text("Cadastrar outro pneu")
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07)
            }
            .foregroundStyle(Color.textMuted)
            .padding(.vertical, 14)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(
                        Color.border,
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
    }

    // MARK: - Empty states

    private var semPneuEmptyState: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                Text("+")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(Color.textFaint)
                    .frame(width: 64, height: 64)
                    .background(
                        Circle().fill(Color.surfaceHover)
                    )
                    .overlay(
                        Circle().stroke(Color.border, lineWidth: 1)
                    )
                    .padding(.bottom, 18)

                Text("Cadastre os pneus do \(carroApelido)")
                    .font(.system(size: 18, weight: .semibold))
                    .tracking(-0.27)
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 8)

                Text("Cada pneu fica com histórico próprio de saídas e quilômetros rodados.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.bottom, 20)

                VStack(alignment: .leading, spacing: 10) {
                    bulletRow(strong: "Marca, composto e medida", tail: "ficam salvos.")
                    bulletRow(strong: "Voltas e quilômetros rodados", tail: "contam automaticamente em cada stint.")
                    bulletRow(strong: nil, tail: "Comparar duração entre marcas pra saber qual compensa de verdade.")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 24)
            }

            Button(action: { sheet = .cadastrarPneu }) {
                HStack(spacing: 8) {
                    Text("+")
                        .font(.system(size: 18, weight: .medium))
                    Text("Cadastrar primeiro pneu")
                        .font(.system(size: 15, weight: .semibold))
                        .tracking(-0.075)
                }
                .foregroundStyle(Color.onAccent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.accent)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 28)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .padding(.top, 18)
    }

    private var semCarroEmptyState: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Cadastre um carro primeiro.")
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.08)
                .foregroundStyle(Color.text)
            Text("O pneu fica vinculado ao carro — sem carro cadastrado, não dá pra montar.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .lineSpacing(3)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .padding(.top, 18)
    }

    private func bulletRow(strong: String?, tail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(Color.accent)
                .frame(width: 5, height: 5)
                .padding(.top, 8)
            (
                Text(strong.map { "\($0) " } ?? "")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                + Text(tail)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            )
            .lineSpacing(2)
        }
    }

    // MARK: - Foot bar (Voltar / Confirmar)

    @ViewBuilder
    private var footBar: some View {
        // 2026-05-16 Flávio "clicou, já seleciona": tocar numa opção
        // confirma direto. Rodapé só com Voltar (sair sem mudar).
        soVoltarBar
    }

    private var soVoltarBar: some View {
        Button(action: onCancel) {
            Text("Voltar")
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075)
                .foregroundStyle(Color.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 14)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity)
        .background(
            Color.surface.opacity(0.92).background(.ultraThinMaterial)
        )
        .overlay(
            Rectangle()
                .fill(Color.border)
                .frame(height: 1),
            alignment: .top
        )
    }

    private func radio(isOn: Bool) -> some View {
        ZStack {
            Circle()
                .fill(isOn ? Color.accent : Color.surfaceHover)
                .frame(width: 24, height: 24)
            Circle()
                .stroke(isOn ? Color.accent : Color.border, lineWidth: 2)
                .frame(width: 24, height: 24)
            if isOn {
                Circle()
                    .fill(Color.onAccent)
                    .frame(width: 8, height: 8)
            }
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheetView(for which: PneuPickerSheet) -> some View {
        switch which {
        case .cadastrarPneu:
            if let id = carroId {
                PneuCadastroView(
                    carroId: id,
                    pneuToEdit: nil,
                    onClose: { sheet = nil }
                )
                .environmentObject(pneuRepo)
            } else {
                EmptyView()
            }
        }
    }

    private func hidratarSelecaoInicial() {
        guard !hidratado else { return }
        selecionado = initialPneuId
        hidratado = true
    }
}

// MARK: - Sheet enum

private enum PneuPickerSheet: Identifiable, Equatable {
    case cadastrarPneu

    var id: String { "cadastrar-pneu" }
}

// MARK: - Previews

#Preview("PneuPicker — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let pneuRepo = PneuRepository(queue: queue)
    let carroRepo = CarroRepository(queue: queue)
    return PneuPickerView(
        carroId: "carro-fake",
        stintNumero: 3,
        initialPneuId: nil,
        onCancel: {},
        onConfirm: { _ in }
    )
    .environmentObject(pneuRepo)
    .environmentObject(carroRepo)
    .task {
        await pneuRepo.bootstrap()
        await carroRepo.bootstrap()
    }
}
