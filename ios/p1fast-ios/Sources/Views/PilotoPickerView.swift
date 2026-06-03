// ═══════════════════════════════════════════════════════════
// PilotoPickerView — seleção de piloto / convidado
// ═══════════════════════════════════════════════════════════
// 2026-05-16 (Flávio): "As opções devem ser abertas sempre no mesmo
// padrão." Antes os seletores de Piloto e Convidado eram menus
// suspensos do iOS — diferente do padrão visual usado pelos
// seletores de Combustível e Pneu (tela cheia, lista, CTA cadastrar
// novo no fim, Voltar embaixo).
//
// Esse arquivo unifica: a mesma tela serve pra escolher Piloto OU
// Convidado, mudando só o `titulo`, `eyebrow`, e se permite a opção
// "Sem [convidado]" no topo.

import SwiftUI
import P1FastCore

struct PilotoPickerView: View {
    @EnvironmentObject private var pilotoRepo: PilotoRepository

    let titulo: String                   // "Piloto" ou "Convidado"
    let subtitulo: String                // contexto pequeno (Stint #N · Brasília · ...)
    let initialId: String?
    let permiteSemOpcao: Bool            // true pra Convidado (mostra "Sem convidado")
    let labelSemOpcao: String            // "Sem convidado"
    let labelCadastrarNovo: String       // "Cadastrar novo piloto"
    let idsBloqueados: Set<String>       // filtra IDs (ex: piloto principal não aparece como convidado)
    let onCancel: () -> Void
    let onConfirm: (String?) -> Void

    @State private var selecionado: String?
    @State private var hidratado = false
    @State private var mostrandoCadastro = false

    private var pilotos: [Piloto] {
        pilotoRepo.pilotos.filter { !idsBloqueados.contains($0.id) }
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

            voltarBar
        }
        .preferredColorScheme(.dark)
        .task { hidratarSelecaoInicial() }
        .sheet(isPresented: $mostrandoCadastro) {
            PilotoCadastroView(onClose: {
                mostrandoCadastro = false
                Task { await selecionarMaisRecente() }
            })
            .environmentObject(pilotoRepo)
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.bottom, Spacing.sm)

            lista
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: titulo.uppercased())
            Text(tituloPrincipal)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            if !subtitulo.isEmpty {
                Text(subtitulo)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var tituloPrincipal: String {
        if titulo.lowercased().contains("convidado") {
            return "Quem é o convidado"
        }
        return "Quem dirige"
    }

    private var lista: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Cadastrados".uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32)
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(pilotos.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.top, 6)
            .padding(.bottom, 4)

            if permiteSemOpcao {
                semOpcaoRow
            }

            ForEach(pilotos, id: \.id) { p in
                pilotoRow(p)
            }

            addRow
        }
    }

    private var semOpcaoRow: some View {
        let isOn = selecionado == nil
        return Button(action: {
            selecionado = nil
            onConfirm(nil)
        }) {
            HStack {
                Text(labelSemOpcao)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.text)
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

    private func pilotoRow(_ p: Piloto) -> some View {
        let isOn = selecionado == p.id
        return Button(action: {
            selecionado = p.id
            onConfirm(p.id)
        }) {
            HStack {
                Text(p.nome)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.08)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
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
        Button(action: { mostrandoCadastro = true }) {
            HStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text(labelCadastrarNovo)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07)
            }
            .foregroundStyle(Color.textMuted)
            .padding(.vertical, 14)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised.opacity(0.001))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(
                        Color.border,
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
    }

    private var voltarBar: some View {
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

    private func hidratarSelecaoInicial() {
        guard !hidratado else { return }
        hidratado = true
        selecionado = initialId
    }

    @MainActor
    private func selecionarMaisRecente() async {
        await pilotoRepo.bootstrap()
        let novo = pilotoRepo.pilotos.max(by: { $0.createdAt < $1.createdAt })
        guard let novo, !idsBloqueados.contains(novo.id) else { return }
        selecionado = novo.id
        onConfirm(novo.id)
    }
}
