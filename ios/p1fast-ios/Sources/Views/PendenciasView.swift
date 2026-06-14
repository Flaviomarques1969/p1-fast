// ═══════════════════════════════════════════════════════════
// PendenciasView — checklist por evento (redesenho 2026-06-14)
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #21 (base). Redesenho aprovado por Flávio em
// 2026-06-14 (mockup-pendencias-estoque-APROVADO):
//   • contador "peguei" (−/+) por item, quando o alvo > 1 — o ALVO vem do
//     estoque (item de mesmo nome no Estoque geral) ou da quantidade
//     consumível do catálogo; o "peguei" é por evento (local).
//   • concluir SÓ pelo quadradinho da esquerda; item concluído SAI da lista;
//     rodapé "✓ N concluída(s)" revela/desmarca.
//   • topo "Gerenciar itens" → Adicionar / Editar / Excluir.
//
// PRESERVA o backbone atual: catálogo sincronizado (PendenciaTemplate +
// EventoPendencia) + itens adicionais locais (EventoPendenciaExtra). A
// riqueza nova (peguei + estoque) fica em camada LOCAL — não toca produção.

import SwiftUI
import P1FastCore

struct PendenciasView: View {
    let eventoId: String
    let eventoTitulo: String?
    let onClose: () -> Void
    var eyebrow: String = "Pendências do evento"
    var showFootBar: Bool = true

    @EnvironmentObject private var repo: PendenciaRepository
    @EnvironmentObject private var estoqueRepo: EstoqueRepository
    @EnvironmentObject private var carroRepo: CarroRepository

    @State private var grupos: [PendenciaGrupoView] = []
    @State private var grupoExpandido: String?
    @State private var editandoNota: PendenciaItemView?
    @State private var notaText: String = ""

    enum PendMode { case normal, editar, excluir }
    @State private var mode: PendMode = .normal
    @State private var selecionados: Set<String> = []
    @State private var showDone: Set<String> = []
    @State private var mostrarMenu = false
    @State private var editorSeed: EstoqueEditorSeed?
    @State private var editorCriaExtra = false
    @State private var confirmarExcluir = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, showFootBar ? 120 : 150)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            if mode == .editar { modeBar }
            else if mode == .excluir { delBar }
            else if showFootBar {
                FootBar(onCancel: onClose, onSave: onClose, saveLabel: "Fechar", canSave: true)
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await refresh()
            try? await estoqueRepo.reloadPegou(eventoId)
        }
        .confirmationDialog("Gerenciar itens", isPresented: $mostrarMenu, titleVisibility: .visible) {
            Button("Adicionar item") { abrirAdicionar() }
            Button("Editar um item") { mode = .editar; expandirTudo() }
            Button("Excluir itens") { mode = .excluir; selecionados.removeAll(); expandirTudo() }
            Button("Cancelar", role: .cancel) {}
        }
        .sheet(item: $editorSeed) { seed in
            EstoqueItemEditorView(
                item: seed.item,
                escopoInicial: seed.escopoInicial,
                nomeInicial: seed.nomeInicial,
                blocoIdInicial: seed.blocoIdInicial,
                onClose: { editorSeed = nil },
                onSaved: { estItem in salvouNoEditor(estItem) }
            )
        }
        .sheet(item: $editandoNota) { item in
            NotaSheet(titulo: item.titulo, nota: $notaText,
                      onCancel: { editandoNota = nil },
                      onSave: {
                          let texto = notaText
                          Task { try? await repo.setNota(instanceId: item.id, nota: texto); await refresh(); editandoNota = nil }
                      })
        }
        .alert("Excluir itens?", isPresented: $confirmarExcluir) {
            Button("Excluir", role: .destructive) { excluirSelecionados() }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Apaga \(selecionados.count) item(ns) que você incluiu. Não dá pra desfazer.")
        }
    }

    // MARK: - Conteúdo

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            header
            VStack(spacing: Spacing.sm) {
                ForEach(grupos) { g in
                    GrupoCard(
                        grupo: g,
                        mode: mode,
                        expandido: mode != .normal || grupoExpandido == g.id,
                        doneRevelado: showDone.contains(g.id),
                        selecionados: selecionados,
                        alvoDe: { alvo($0) },
                        pegouDe: { pegou($0) },
                        onToggleExpand: { toggleExpand(g.id) },
                        onCheck: { toggleItem($0) },
                        onInc: { incPegou($0, $1) },
                        onToggleDone: { toggleDone(g.id) },
                        onAbrirEditor: { abrirEditar($0, grupo: g) },
                        onToggleSel: { toggleSel($0) }
                    )
                }
                if grupos.isEmpty {
                    Text("Carregando pendências…").font(.system(size: 14)).foregroundStyle(Color.textMuted)
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: eyebrow)
                Text(eventoTitulo ?? "Pendências")
                    .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(headerSubtitle).font(.system(size: 13)).foregroundStyle(Color.textMuted)
            }
            Spacer(minLength: 0)
            if mode == .normal {
                Button { mostrarMenu = true } label: {
                    Text("Gerenciar itens")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(Capsule().fill(Color.accent))
                }
                .buttonStyle(.plain)
                .padding(.top, 6)
            }
        }
        .padding(.bottom, Spacing.sm)
    }

    private var headerSubtitle: String {
        let total = grupos.reduce(0) { $0 + $1.total }
        let check = grupos.reduce(0) { $0 + $1.checados }
        return "\(check) de \(total) itens prontos"
    }

    // MARK: - Barras de modo (Editar / Excluir)

    private var modeBar: some View {
        HStack {
            Text("Toque no item que quer editar").font(.system(size: 13)).foregroundStyle(Color.textMuted)
            Spacer()
            Button { mode = .normal } label: {
                Text("Concluir").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.text)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.lg).padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(Color.surface.opacity(0.96).background(.ultraThinMaterial))
        .overlay(Rectangle().fill(Color.border).frame(height: 1), alignment: .top)
        .padding(.bottom, showFootBar ? 0 : 70)
    }

    private var delBar: some View {
        HStack(spacing: 10) {
            Button { mode = .normal; selecionados.removeAll() } label: {
                Text("Cancelar").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.text)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { if selecionados.isEmpty { return }; confirmarExcluir = true } label: {
                Text("Excluir selecionados (\(selecionados.count))")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.erro))
            }
            .buttonStyle(.plain)
            .opacity(selecionados.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, Spacing.lg).padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(Color.surface.opacity(0.96).background(.ultraThinMaterial))
        .overlay(Rectangle().fill(Color.border).frame(height: 1), alignment: .top)
        .padding(.bottom, showFootBar ? 0 : 70)
    }

    // MARK: - Estoque ↔ alvo / peguei

    private func matchedEstoque(_ item: PendenciaItemView) -> EstoqueItem? {
        estoqueRepo.item(nome: item.titulo, escopos: [EstoqueRepository.escopoGeral])
    }
    private func alvo(_ item: PendenciaItemView) -> Int {
        if let est = matchedEstoque(item) { return est.alvo }
        if let q = item.instance?.quantidade, q > 1 { return Int(q.rounded()) }
        return 1
    }
    private func pegou(_ item: PendenciaItemView) -> Int {
        estoqueRepo.pegou(eventoId: eventoId, itemId: item.id)
    }
    private func incPegou(_ item: PendenciaItemView, _ d: Int) {
        let novo = max(0, min(alvo(item), pegou(item) + d))
        Task { try? await estoqueRepo.setPegou(eventoId: eventoId, itemId: item.id, pegou: novo) }
    }

    // MARK: - Ações

    private func toggleExpand(_ gid: String) {
        guard mode == .normal else { return }
        withAnimation(.easeInOut(duration: 0.15)) { grupoExpandido = (grupoExpandido == gid) ? nil : gid }
    }
    private func expandirTudo() { grupoExpandido = nil }
    private func toggleDone(_ gid: String) {
        withAnimation(.easeInOut(duration: 0.15)) {
            if showDone.contains(gid) { showDone.remove(gid) } else { showDone.insert(gid) }
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
    private func toggleSel(_ item: PendenciaItemView) {
        guard item.isExtra else { return }   // só itens incluídos à mão são removíveis
        if selecionados.contains(item.id) { selecionados.remove(item.id) } else { selecionados.insert(item.id) }
    }
    private func excluirSelecionados() {
        let ids = selecionados
        Task {
            for id in ids { try? await repo.removeExtra(id: id, eventoId: eventoId) }
            await MainActor.run { selecionados.removeAll(); mode = .normal }
            await refresh()
        }
    }

    // Gerenciar → Adicionar: editor único cria item no estoque + inclui na pendência.
    private func abrirAdicionar() {
        editorCriaExtra = true
        editorSeed = .novo()
    }
    // Gerenciar → Editar: abre o editor pra DEFINIR/ajustar o estoque do item
    // (é daí que vem a quantidade-alvo do contador). Edita o item de estoque
    // de mesmo nome se existir; senão cria um já com nome + bloco preenchidos.
    private func abrirEditar(_ item: PendenciaItemView, grupo: PendenciaGrupoView) {
        editorCriaExtra = false
        if let est = matchedEstoque(item) {
            editorSeed = .editar(est)
        } else {
            editorSeed = .novo(nome: item.titulo, blocoId: grupo.grupoId)
        }
    }
    private func salvouNoEditor(_ estItem: EstoqueItem) {
        let criaExtra = editorCriaExtra
        editorSeed = nil
        editorCriaExtra = false
        Task {
            if criaExtra {
                try? await repo.addExtra(eventoId: eventoId, grupoId: estItem.grupoId,
                                         grupoTitulo: estItem.grupoTitulo, grupoNum: estItem.grupoNum,
                                         titulo: estItem.nome)
            }
            try? await estoqueRepo.reloadPegou(eventoId)
            await refresh()
        }
    }

    private func refresh() async {
        do {
            try await repo.ensureInstancesForEvento(eventoId)
            let novos = repo.grupos(forEventoId: eventoId)
            withAnimation(.easeInOut(duration: 0.22)) { grupos = novos }
        } catch { print("PendenciasView.refresh failed: \(error)") }
    }
}

// MARK: - GrupoCard

private struct GrupoCard: View {
    let grupo: PendenciaGrupoView
    let mode: PendenciasView.PendMode
    let expandido: Bool
    let doneRevelado: Bool
    let selecionados: Set<String>
    let alvoDe: (PendenciaItemView) -> Int
    let pegouDe: (PendenciaItemView) -> Int
    let onToggleExpand: () -> Void
    let onCheck: (PendenciaItemView) -> Void
    let onInc: (PendenciaItemView, Int) -> Void
    let onToggleDone: () -> Void
    let onAbrirEditor: (PendenciaItemView) -> Void
    let onToggleSel: (PendenciaItemView) -> Void

    private var pendentes: [PendenciaItemView] { grupo.itens.filter { !$0.checado } }
    private var concluidas: [PendenciaItemView] { grupo.itens.filter { $0.checado } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            cabecalho
            if expandido {
                VStack(spacing: 0) {
                    if mode == .normal {
                        linhas(pendentes)
                        if pendentes.isEmpty && !concluidas.isEmpty {
                            Text("Tudo pronto neste bloco.")
                                .font(.system(size: 12)).foregroundStyle(Color.bom)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, Spacing.md).padding(.vertical, 11)
                        }
                        if !concluidas.isEmpty {
                            divisor
                            Button(action: onToggleDone) {
                                HStack {
                                    Text("✓ \(concluidas.count) concluída\(concluidas.count > 1 ? "s" : "")")
                                        .font(.system(size: 11, weight: .semibold)).tracking(0.06 * 11)
                                        .foregroundStyle(Color.bom)
                                    Spacer()
                                    Text(doneRevelado ? "▾" : "›").foregroundStyle(Color.textFaint)
                                }
                                .padding(.horizontal, Spacing.md).padding(.vertical, 11)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if doneRevelado { linhas(concluidas) }
                        }
                    } else {
                        linhas(grupo.itens)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func linhas(_ itens: [PendenciaItemView]) -> some View {
        ForEach(Array(itens.enumerated()), id: \.element.id) { idx, item in
            if idx > 0 { divisor }
            ItemRow(
                item: item, mode: mode,
                alvo: alvoDe(item), pegou: pegouDe(item),
                selecionado: selecionados.contains(item.id),
                onCheck: { onCheck(item) },
                onInc: { onInc(item, $0) },
                onAbrirEditor: { onAbrirEditor(item) },
                onToggleSel: { onToggleSel(item) }
            )
        }
    }

    private var divisor: some View {
        Rectangle().fill(Color.border).frame(height: 1).padding(.horizontal, Spacing.md)
    }

    private var cabecalho: some View {
        Button(action: onToggleExpand) {
            HStack(spacing: 10) {
                Circle().fill(progressColor).frame(width: 10, height: 10)
                Text(grupo.grupoTitulo.uppercased())
                    .font(.system(size: 13, weight: .semibold)).tracking(0.06 * 13)
                    .foregroundStyle(Color.text)
                Spacer(minLength: 12)
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 1) {
                        Text("\(grupo.checados)").foregroundStyle(progressColor)
                        Text("/\(grupo.total)").foregroundStyle(Color.textFaint)
                    }
                    .font(.system(size: 16, weight: .semibold)).monospacedDigit()
                    Text("PRONTAS").font(.system(size: 9, weight: .semibold)).tracking(0.08 * 9)
                        .foregroundStyle(Color.textFaint)
                }
            }
            .padding(.horizontal, Spacing.md).padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(mode != .normal)
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
    let mode: PendenciasView.PendMode
    let alvo: Int
    let pegou: Int
    let selecionado: Bool
    let onCheck: () -> Void
    let onInc: (Int) -> Void
    let onAbrirEditor: () -> Void
    let onToggleSel: () -> Void

    var body: some View {
        switch mode {
        case .editar: linhaEditar
        case .excluir: linhaExcluir
        case .normal: linhaNormal
        }
    }

    // Normal: quadradinho (conclui) + nome + contador "peguei".
    private var linhaNormal: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Button(action: onCheck) { checkbox }.buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.titulo)
                    .font(.system(size: 14)).foregroundStyle(tituloColor)
                    .strikethrough(item.checado, color: Color.textMuted)
                if let nota = item.nota, !nota.isEmpty {
                    Text(nota).font(.system(size: 11)).foregroundStyle(Color.textMuted).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            if alvo > 1, !item.checado { contador }
        }
        .padding(.horizontal, Spacing.md).padding(.vertical, 10)
    }

    // Editar: lápis + nome; toca pra abrir o editor.
    private var linhaEditar: some View {
        Button(action: onAbrirEditor) {
            HStack(spacing: Spacing.sm) {
                Text(item.titulo).font(.system(size: 14)).foregroundStyle(tituloColor)
                Spacer(minLength: 0)
                Image(systemName: "pencil").font(.system(size: 14)).foregroundStyle(Color.textFaint)
                    .frame(width: 30, height: 30)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.border, lineWidth: 1))
            }
            .padding(.horizontal, Spacing.md).padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // Excluir: caixinha de seleção (só itens incluídos à mão) + nome.
    private var linhaExcluir: some View {
        Button(action: onToggleSel) {
            HStack(spacing: Spacing.sm) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6).stroke(selecionado ? Color.clear : Color.border, lineWidth: 1.5)
                        .background(RoundedRectangle(cornerRadius: 6).fill(selecionado ? Color.erro : Color.clear))
                        .frame(width: 22, height: 22)
                    if selecionado { Text("✓").font(.system(size: 13, weight: .bold)).foregroundStyle(.white) }
                }
                .opacity(item.isExtra ? 1 : 0.25)
                Text(item.titulo).font(.system(size: 14)).foregroundStyle(tituloColor)
                Spacer(minLength: 0)
                if !item.isExtra {
                    Text("do catálogo").font(.system(size: 10)).foregroundStyle(Color.textFaint)
                }
            }
            .padding(.horizontal, Spacing.md).padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!item.isExtra)
    }

    private var contador: some View {
        HStack(spacing: 6) {
            cstep("–", accent: false) { onInc(-1) }
            Text("\(pegou)/\(alvo)")
                .font(.system(size: 13, weight: .bold)).monospacedDigit()
                .foregroundStyle(pegou >= alvo ? Color.bom : Color.text)
                .frame(minWidth: 36)
            cstep("+", accent: true) { onInc(1) }
        }
        .padding(.top, 1)
    }

    private func cstep(_ s: String, accent: Bool, _ acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            Text(s).font(.system(size: 18, weight: .regular))
                .foregroundStyle(accent ? Color.onAccent : Color.text)
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: 8).fill(accent ? Color.accent : Color.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(accent ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var tituloColor: Color {
        if item.checado { return Color.textMuted }
        return item.obrigatorio
            ? Color(red: 0.89, green: 0.62, blue: 0.60)
            : Color(red: 0.91, green: 0.79, blue: 0.42)
    }

    private var checkbox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(item.checado ? Color.bom : Color.border, lineWidth: 1.5)
                .frame(width: 20, height: 20)
            if item.checado {
                Text("✓").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.bom)
            }
        }
        .frame(width: 30, height: 30)
        .contentShape(Rectangle())
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
                        Text(titulo).font(.system(size: 18, weight: .semibold)).tracking(-0.5)
                            .foregroundStyle(Color.text)
                    }
                    .padding(.bottom, Spacing.sm)
                    FormField(label: "Observação livre") {
                        TextEditor(text: $nota)
                            .scrollContentBackground(.hidden)
                            .background(Color.surfaceRaised)
                            .frame(minHeight: 120)
                            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
                            .padding(.horizontal, 4)
                            .colorScheme(.dark)
                    }
                }
                .padding(.horizontal, Spacing.lg).padding(.top, Spacing.md).padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)
            FootBar(onCancel: onCancel, onSave: onSave, saveLabel: "Salvar nota", canSave: true)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Preview

#Preview("PendenciasView") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PendenciaRepository(queue: queue)
    let est = EstoqueRepository(queue: queue)
    return PendenciasView(eventoId: "preview-evento", eventoTitulo: "Brasília 02/05", onClose: {})
        .environmentObject(repo)
        .environmentObject(est)
        .task { await repo.bootstrap() }
}
