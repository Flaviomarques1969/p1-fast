// ═══════════════════════════════════════════════════════════
// PilotoCadastroView — port reduzido de mockup-piloto-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #12. Form mínimo: só `nome`. Os campos
// altura/peso/idade do mockup ficam pra próxima migração quando
// a tabela `pilotos` ganhar essas colunas (não estão no schema
// canônico v1 — supabase/migrations/0001_initial.sql).
//
// Visual herda do mockup: eyebrow + título + label + input +
// FootBar Cancelar/Salvar. CTA "Salvar piloto" → grava via
// PilotoRepository (GRDB), fecha sheet, lista atualiza.
//
// Modo edit: quando `pilotoToEdit` chega não-nil, hidrata o form
// com o nome atual, troca o título pra "Editar piloto", chama
// `update(...)` em vez de `create(...)`. Mostra também botão
// "Apagar piloto" no rodapé do conteúdo (ghost vermelho), que
// dispara alert "Não dá pra desfazer." e remove via `delete(...)`.

import SwiftUI
import P1FastCore

struct PilotoCadastroView: View {
    @EnvironmentObject private var repo: PilotoRepository
    let pilotoToEdit: Piloto?
    let onClose: () -> Void

    init(pilotoToEdit: Piloto? = nil, onClose: @escaping () -> Void) {
        self.pilotoToEdit = pilotoToEdit
        self.onClose = onClose
    }

    @State private var nome: String = ""
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var hydrated = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { pilotoToEdit != nil }

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

            FootBar(
                onCancel: onClose,
                onSave: salvar,
                saveLabel: isEditing ? "Salvar alterações" : "Salvar piloto",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar piloto?", isPresented: $showDeleteAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDelete() }
        } message: {
            Text("Não dá pra desfazer.")
        }
    }

    private var canSave: Bool {
        !isSaving && !nome.trimmingCharacters(in: .whitespaces).isEmpty
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: isEditing ? "Editar piloto" : "Novo piloto")
                Text(isEditing ? "Editar piloto" : "Cadastrar piloto")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(isEditing ? "Atualize o nome ou apague o cadastro." : "Fica salvo pra próximos stints.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Nome do piloto", isFocus: !isEditing)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Altura, peso e idade vão entrar quando o schema do time ganhar esses campos. Por enquanto é só o nome.")
                .padding(.top, Spacing.sm)

            if isEditing {
                DeleteCadastroButton(label: "Apagar piloto") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    private func hydrateFromExisting() {
        guard !hydrated, let p = pilotoToEdit else { return }
        nome = p.nome
        hydrated = true
    }

    private func salvar() {
        let trimmed = nome.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                if var existing = pilotoToEdit {
                    existing.nome = trimmed
                    try await repo.update(piloto: existing)
                } else {
                    try await repo.create(nome: trimmed)
                }
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func confirmarDelete() {
        guard let p = pilotoToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.delete(pilotoId: p.id)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Sub-componentes locais

/// Botão "Apagar X" full-width estilo ghost vermelho. Usado no rodapé
/// das views de cadastro quando abertas em modo edit. Sem fill, só
/// border + texto na cor de erro. Não é destrutivo direto: dispara um
/// alert antes (pattern padrão dos 4 CRUDs do Sprint 1A.3).
struct DeleteCadastroButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.07)
                .foregroundStyle(Color.erro)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.erro.opacity(0.5), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

#Preview("PilotoCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PilotoRepository(queue: queue)
    return PilotoCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}

#Preview("PilotoCadastroView — edit") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PilotoRepository(queue: queue)
    let mock = Piloto(id: "preview-piloto", timeId: PilotoRepository.localTimeId, nome: "Flavio Marx")
    return PilotoCadastroView(pilotoToEdit: mock, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
