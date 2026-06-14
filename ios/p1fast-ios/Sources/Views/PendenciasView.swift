// ═══════════════════════════════════════════════════════════
// PendenciasView — port readonly de mockup-pendencias-cascata.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #21. Checklist por evento agrupado em
// 6 grupos canônicos (G1..G6). Header de cada grupo é colapsável
// (default colapsado), mostra "{X}/{N} checadas" + cor por progresso.
// Tap longo no item abre sheet pra editar nota livre.
//
// Bootstrap: ao abrir, garante que existe 1 EventoPendencia pra cada
// PendenciaTemplate vinculado a este eventoId (idempotente via UNIQUE).

import SwiftUI
import P1FastCore

struct PendenciasView: View {
    let eventoId: String
    let eventoTitulo: String?
    let onClose: () -> Void
    /// Texto do eyebrow do topo. Quando aberta como aba do menu (próximo
    /// evento), a HomeView passa "Pendências · próximo evento".
    var eyebrow: String = "Pendências do evento"
    /// Mostra a barra inferior "Fechar". Aba do menu passa `false` (o menu
    /// de baixo já fica fixo na tela, não precisa de barra de fechar).
    var showFootBar: Bool = true

    @EnvironmentObject private var repo: PendenciaRepository
    @State private var grupos: [PendenciaGrupoView] = []
    @State private var grupoExpandido: String?
    @State private var editandoNota: PendenciaItemView?
    @State private var notaText: String = ""
    /// Grupo que está recebendo um item adicional (abre o alerta de incluir).
    @State private var incluindoNoGrupo: PendenciaGrupoView?
    @State private var novoItemTitulo: String = ""

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, showFootBar ? 120 : 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            if showFootBar {
                FootBar(
                    onCancel: onClose,
                    onSave: onClose,
                    saveLabel: "Fechar",
                    canSave: true
                )
            }
        }
        .preferredColorScheme(.dark)
        .task { await refresh() }
        .sheet(item: $editandoNota) { item in
            NotaSheet(
                titulo: item.titulo,
                nota: $notaText,
                onCancel: { editandoNota = nil },
                onSave: {
                    let texto = notaText
                    Task {
                        try? await repo.setNota(instanceId: item.id, nota: texto)
                        await refresh()
                        editandoNota = nil
                    }
                }
            )
        }
        .alert("Incluir pendência", isPresented: Binding(
            get: { incluindoNoGrupo != nil },
            set: { if !$0 { incluindoNoGrupo = nil; novoItemTitulo = "" } }
        ), presenting: incluindoNoGrupo) { grupo in
            TextField("O que está faltando?", text: $novoItemTitulo)
            Button("Cancelar", role: .cancel) { novoItemTitulo = "" }
            Button("Incluir") { confirmarIncluir(grupo) }
        } message: { grupo in
            Text("Novo item em \(grupo.grupoTitulo) — só pra este evento.")
        }
    }

    private func confirmarIncluir(_ grupo: PendenciaGrupoView) {
        let titulo = novoItemTitulo.trimmingCharacters(in: .whitespacesAndNewlines)
        novoItemTitulo = ""
        guard !titulo.isEmpty else { return }
        Task {
            try? await repo.addExtra(
                eventoId: eventoId,
                grupoId: grupo.grupoId,
                grupoTitulo: grupo.grupoTitulo,
                grupoNum: grupo.grupoNum,
                titulo: titulo
            )
            await refresh()
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            header
            VStack(spacing: Spacing.sm) {
                ForEach(grupos) { g in
                    GrupoCard(
                        grupo: g,
                        expandido: grupoExpandido == g.id,
                        onToggleExpand: { toggleExpand(g.id) },
                        onToggleItem: { item in toggleItem(item) },
                        onEditarNota: { item in
                            notaText = item.nota ?? ""
                            editandoNota = item
                        },
                        onIncluir: { incluindoNoGrupo = g },
                        onRemoverItem: { item in removerItem(item) }
                    )
                }
                if grupos.isEmpty {
                    Text("Carregando pendências…")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.textMuted)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: eyebrow)
            Text(eventoTitulo ?? "Pendências")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.bottom, Spacing.sm)
    }

    private var headerSubtitle: String {
        let total = grupos.reduce(0) { $0 + $1.total }
        let check = grupos.reduce(0) { $0 + $1.checados }
        return "\(check) de \(total) itens prontos"
    }

    private func toggleExpand(_ gid: String) {
        withAnimation(.easeInOut(duration: 0.15)) {
            grupoExpandido = (grupoExpandido == gid) ? nil : gid
        }
    }

    private func toggleItem(_ item: PendenciaItemView) {
        Task {
            if item.isExtra {
                try? await repo.toggleExtra(id: item.id, eventoId: eventoId, novo: !item.checado)
            } else {
                try? await repo.toggle(instanceId: item.id, novo: !item.checado)
            }
            await refresh()
        }
    }

    private func removerItem(_ item: PendenciaItemView) {
        guard item.isExtra else { return }
        Task {
            try? await repo.removeExtra(id: item.id, eventoId: eventoId)
            await refresh()
        }
    }

    private func refresh() async {
        do {
            try await repo.ensureInstancesForEvento(eventoId)
            grupos = repo.grupos(forEventoId: eventoId)
        } catch {
            print("PendenciasView.refresh failed: \(error)")
        }
    }
}

// MARK: - GrupoCard

private struct GrupoCard: View {
    let grupo: PendenciaGrupoView
    let expandido: Bool
    let onToggleExpand: () -> Void
    let onToggleItem: (PendenciaItemView) -> Void
    let onEditarNota: (PendenciaItemView) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggleExpand) {
                HStack(spacing: 10) {
                    progressDot
                    VStack(alignment: .leading, spacing: 3) {
                        Text(grupo.grupoTitulo.uppercased())
                            .font(.system(size: 13, weight: .semibold))
                            .tracking(0.06 * 13)
                            .foregroundStyle(Color.text)
                        Text("\(grupo.checados) de \(grupo.total) checadas")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(progressColor)
                    }
                    Spacer(minLength: 0)
                    Text(expandido ? "▾" : "›")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)

            if expandido {
                VStack(spacing: 0) {
                    ForEach(Array(grupo.itens.enumerated()), id: \.element.id) { idx, item in
                        if idx > 0 {
                            Rectangle()
                                .fill(Color.border)
                                .frame(height: 1)
                                .padding(.horizontal, Spacing.md)
                        }
                        ItemRow(
                            item: item,
                            onToggle: { onToggleItem(item) },
                            onLongPress: { onEditarNota(item) }
                        )
                    }
                }
            }
        }
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

    private var progressDot: some View {
        Circle()
            .fill(progressColor)
            .frame(width: 10, height: 10)
    }

    private var progressColor: Color {
        if grupo.allChecked { return Color.bom }
        if grupo.anyChecked { return Color.ouro }
        return Color.textFaint
    }
}

// MARK: - ItemRow

private struct ItemRow: View {
    let item: PendenciaItemView
    let onToggle: () -> Void
    let onLongPress: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(alignment: .top, spacing: Spacing.sm) {
                checkbox
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(item.template.titulo)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundStyle(item.instance.checado ? Color.textMuted : Color.text)
                            .strikethrough(item.instance.checado, color: Color.textMuted)
                        if item.template.obrigatorio {
                            Text("obrig.")
                                .font(.system(size: 9, weight: .semibold))
                                .tracking(0.06 * 9)
                                .foregroundStyle(Color.erro)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.erro.opacity(0.12))
                                )
                        }
                    }
                    if let nota = item.instance.nota, !nota.isEmpty {
                        Text(nota)
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .onLongPressGesture(minimumDuration: 0.5) { onLongPress() }
    }

    private var checkbox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(item.instance.checado ? Color.bom : Color.border, lineWidth: 1.5)
                .frame(width: 20, height: 20)
            if item.instance.checado {
                Text("✓")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.bom)
            }
        }
        .padding(.top, 2)
    }
}

// MARK: - NotaSheet

private struct NotaSheet: View {
    let titulo: String
    @Binding var nota: String
    let onCancel: () -> Void
    let onSave: () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 6) {
                        Eyebrow(text: "Nota da pendência")
                        Text(titulo)
                            .font(.system(size: 18, weight: .semibold))
                            .tracking(-0.5)
                            .foregroundStyle(Color.text)
                    }
                    .padding(.bottom, Spacing.sm)

                    FormField(label: "Observação livre") {
                        TextEditor(text: $nota)
                            .scrollContentBackground(.hidden)
                            .background(Color.surfaceRaised)
                            .frame(minHeight: 120)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                    .stroke(Color.border, lineWidth: 1)
                            )
                            .padding(.horizontal, 4)
                            .colorScheme(.dark)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onCancel,
                onSave: onSave,
                saveLabel: "Salvar nota",
                canSave: true
            )
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Preview

#Preview("PendenciasView") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PendenciaRepository(queue: queue)
    return PendenciasView(eventoId: "preview-evento", eventoTitulo: "Brasília 02/05", onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
