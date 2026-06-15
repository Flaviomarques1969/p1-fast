// ═══════════════════════════════════════════════════════════
// LicaoListaView — port readonly de mockup-licao-lista.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #20. Catálogo curado de 12 lições portado
// de src/data/lesson-library.js. Sub-tab dentro de "Cadastros"
// (PessoasView). V1 readonly: sem add/edit/delete pelo usuário.
//
// Header com toggle "Só ativas" (default ON). Quando ON, mostra
// 7 lições MVP. Quando OFF, mostra 12 (7 ativas + 5 Fase 2 com
// badge "Fase 2"). Tap no row abre sheet de detalhe read-only.

import SwiftUI
import P1FastCore

struct LicaoListaView: View {
    @EnvironmentObject private var repo: LicaoRepository
    @EnvironmentObject private var arquivoRepo: ArquivoRepository
    @State private var soAtivas: Bool = true
    @State private var detalhe: Licao?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            list
        }
        .sheet(item: $detalhe) { l in
            LicaoDetalheSheet(
                licao: l,
                onClose: { detalhe = nil },
                onApagar: {
                    Task {
                        try? await repo.arquivar(licaoId: l.id, rotulo: l.titulo)
                        try? await arquivoRepo.reload()
                        detalhe = nil
                    }
                }
            )
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(text: "Cadastros · Lições")
                    Text("Lições")
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(Color.text)
                }
                Spacer(minLength: 0)
            }
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)

            Toggle(isOn: $soAtivas) {
                Text("Só ativas")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.text)
            }
            .tint(Color.accent)
            .padding(.top, Spacing.xs)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
    }

    private var headerSubtitle: String {
        let total = repo.licoes.count
        let ativas = repo.ativas.count
        return "\(ativas) ativas de \(total) catalogadas"
    }

    private var list: some View {
        let visiveis = soAtivas ? repo.ativas : repo.licoes
        return LazyVStack(spacing: 8) {
            ForEach(visiveis) { l in
                LicaoRow(licao: l, onTap: { detalhe = l })
            }
            if visiveis.isEmpty {
                Text("Nenhuma lição cadastrada.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Spacing.md)
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.bottom, 40)
    }
}

extension Licao: Identifiable {}

// MARK: - LicaoRow

private struct LicaoRow: View {
    let licao: Licao
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(licao.titulo)
                            .font(.system(size: 15, weight: .semibold))
                            .tracking(-0.075)
                            .foregroundStyle(Color.text)
                        if !licao.ativa {
                            Text("Fase 2")
                                .font(.system(size: 9, weight: .semibold))
                                .tracking(0.06 * 9)
                                .foregroundStyle(Color.atencao)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.atencao.opacity(0.15))
                                )
                        }
                    }
                    if let desc = licao.descricao {
                        Text(desc)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                            .lineLimit(2)
                    }
                    HStack(spacing: 6) {
                        TagPill(text: licao.categoria, kind: .neutral)
                        TagPill(text: licao.nivel, kind: .accent)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, 4)
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
            .opacity(licao.ativa ? 1.0 : 0.85)
        }
        .buttonStyle(.plain)
    }
}

private struct TagPill: View {
    enum Kind { case neutral, accent }
    let text: String
    let kind: Kind

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.06 * 10)
            .foregroundStyle(textColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(bgColor)
            )
    }

    private var textColor: Color {
        switch kind {
        case .neutral: return Color.textMuted
        case .accent:  return Color.accent
        }
    }

    private var bgColor: Color {
        switch kind {
        case .neutral: return Color.surfaceHover
        case .accent:  return Color.accent.opacity(0.15)
        }
    }
}

// MARK: - LicaoDetalheSheet

private struct LicaoDetalheSheet: View {
    let licao: Licao
    let onClose: () -> Void
    let onApagar: () -> Void
    @State private var mostrarConfirmaApagar = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    header
                    if let desc = licao.descricao {
                        Text(desc)
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(Color.text)
                    }
                    metaCards
                    if let sinais = licao.sinaisRequeridos {
                        sinaisCard(sinais)
                    }
                    DeleteCadastroButton(label: "Apagar lição") {
                        mostrarConfirmaApagar = true
                    }
                    .padding(.top, Spacing.sm)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: onClose,
                saveLabel: "Fechar",
                canSave: true
            )
        }
        .alert("Apagar lição?", isPresented: $mostrarConfirmaApagar) {
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { onApagar() }
        } message: {
            Text("Some da lista, mas fica em Apagados — dá pra resgatar.")
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Eyebrow(text: licao.ativa ? "Lição · Ativa" : "Lição · Fase 2")
                if !licao.ativa {
                    Text("Inativa até sensores")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.06 * 10)
                        .foregroundStyle(Color.atencao)
                }
            }
            Text(licao.titulo)
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
        }
        .padding(.bottom, Spacing.sm)
    }

    private var metaCards: some View {
        VStack(spacing: Spacing.sm) {
            metaRow(label: "Categoria", value: licao.categoria)
            metaRow(label: "Nível", value: licao.nivel)
            if let fase = licao.fase {
                metaRow(label: "Fase de foco", value: fase)
            }
            if let curva = licao.tipoCurva {
                metaRow(label: "Tipos de curva", value: curva)
            }
        }
    }

    private func metaRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.text)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func sinaisCard(_ json: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Sinais requeridos")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.22 * 11)
                .foregroundStyle(Color.textFaint)
            Text(formatSinais(json))
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    /// Parser leve do JSON `["LAT","LNG",...]` pra string vírgula-separada.
    /// Falha silenciosa retorna o JSON cru — útil pro dev ver drift.
    private func formatSinais(_ json: String) -> String {
        guard let data = json.data(using: .utf8),
              let array = try? JSONDecoder().decode([String].self, from: data)
        else { return json }
        return array.joined(separator: " · ")
    }
}

// MARK: - Preview

#Preview("LicaoListaView") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = LicaoRepository(queue: queue)
    return LicaoListaView()
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
