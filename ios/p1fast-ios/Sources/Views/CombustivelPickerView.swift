// ═══════════════════════════════════════════════════════════
// CombustivelPickerView — selector de "Combustível abastecido"
// ═══════════════════════════════════════════════════════════
// Sprint 1A.4 — Prompt #17. Lista os combustíveis cadastrados pelo
// time (não escopado por carro — combustível é per-time_id). Visual
// herda do mockup `_design-reference/mockup-combustivel-lista.html`
// em modo radio + footer "Cancelar/Confirmar".
//
// A quantidade abastecida (litros) NÃO entra aqui — fica no
// StintModalView ao lado do tap-to-pick. Esse picker só escolhe o
// `combustivel_id`. Manter a UI simples e o estado local.
//
// Estados:
//   - lista cheia: radio rows + linha "+ Cadastrar outro tipo" no fim
//   - sem combustíveis: empty state grande com bullets + CTA grande
//     "Cadastrar primeiro tipo" abrindo CombustivelCadastroView
//
// Confirmar dispara `onConfirm(combustivelId?)`. Voltar dispara
// `onCancel()` sem persistir.

import SwiftUI
import P1FastCore

struct CombustivelPickerView: View {
    @EnvironmentObject private var combustivelRepo: CombustivelRepository

    let stintNumero: Int
    let contextoSub: String
    let initialCombustivelId: String?
    let onCancel: () -> Void
    let onConfirm: (String?) -> Void

    @State private var selecionado: String?
    @State private var hidratado = false
    @State private var sheet: CombustivelPickerSheet?

    private var combustiveis: [Combustivel] {
        combustivelRepo.combustiveis
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

            if combustiveis.isEmpty {
                semCombustivelEmptyState
            } else {
                listaCombustiveis
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Combustível")
            Text(combustiveis.isEmpty ? "Nenhum tipo cadastrado" : "Tipo abastecido")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSub)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var headerSub: String {
        let prefixo = "Stint #\(stintNumero)"
        if contextoSub.isEmpty { return prefixo }
        return "\(prefixo) · \(contextoSub)"
    }

    // MARK: - Lista (cheia)

    private var listaCombustiveis: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Cadastrados".uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32)
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(combustiveis.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.top, 6)
            .padding(.bottom, 4)

            ForEach(combustiveis, id: \.id) { combust in
                combustivelRow(combust)
            }

            addRow
        }
    }

    private func combustivelRow(_ c: Combustivel) -> some View {
        let isOn = selecionado == c.id
        // 2026-05-16 Flávio "clicou, já seleciona": tocar na opção
        // confirma direto e fecha. Sem precisar tocar Confirmar depois.
        return Button(action: {
            selecionado = c.id
            onConfirm(c.id)
        }) {
            HStack(spacing: 14) {
                // 2026-05-16 Flávio "não quer bolinhas no botão": removi
                // o indicador de rádio. A linha inteira já é o botão; o
                // estado vem do fundo (com tom de destaque quando ativo).
                VStack(alignment: .leading, spacing: 3) {
                    Text(c.nome)
                        .font(.system(size: 16, weight: .semibold))
                        .tracking(-0.08)
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    if let hint = c.tipo, !hint.isEmpty {
                        Text(hint)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                            .lineLimit(2)
                    }
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

    private var addRow: some View {
        Button(action: { sheet = .cadastrarCombustivel }) {
            HStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text("Cadastrar outro tipo")
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

    // MARK: - Empty state

    private var semCombustivelEmptyState: some View {
        VStack(spacing: 0) {
            Text("+")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Color.textFaint)
                .frame(width: 64, height: 64)
                .background(Circle().fill(Color.surfaceHover))
                .overlay(Circle().stroke(Color.border, lineWidth: 1))
                .padding(.bottom, 18)

            Text("Cadastre o primeiro tipo")
                .font(.system(size: 18, weight: .semibold))
                .tracking(-0.27)
                .foregroundStyle(Color.text)
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Combustível fica salvo no time pra reutilizar entre stints.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.bottom, 20)

            Button(action: { sheet = .cadastrarCombustivel }) {
                HStack(spacing: 8) {
                    Text("+")
                        .font(.system(size: 18, weight: .medium))
                    Text("Cadastrar primeiro tipo")
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

    // MARK: - Foot bar (Cancelar / Confirmar)

    @ViewBuilder
    private var footBar: some View {
        // 2026-05-16 Flávio "clicou, já seleciona": tocar numa opção
        // confirma direto e fecha o seletor. Não tem mais botão
        // Confirmar — só "Voltar" (sair sem mudar).
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
    private func sheetView(for which: CombustivelPickerSheet) -> some View {
        switch which {
        case .cadastrarCombustivel:
            CombustivelCadastroView(onClose: { sheet = nil })
                .environmentObject(combustivelRepo)
        }
    }

    private func hidratarSelecaoInicial() {
        guard !hidratado else { return }
        selecionado = initialCombustivelId
        hidratado = true
    }
}

// MARK: - Sheet enum

private enum CombustivelPickerSheet: Identifiable, Equatable {
    case cadastrarCombustivel

    var id: String { "cadastrar-combustivel" }
}

// MARK: - Previews

#Preview("CombustivelPicker — com 2") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let combustRepo = CombustivelRepository(queue: queue)
    return CombustivelPickerView(
        stintNumero: 3,
        contextoSub: "Celta 1.4",
        initialCombustivelId: nil,
        onCancel: {},
        onConfirm: { _ in }
    )
    .environmentObject(combustRepo)
    .task { await combustRepo.bootstrap() }
}
