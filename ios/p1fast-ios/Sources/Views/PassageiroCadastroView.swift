// ═══════════════════════════════════════════════════════════
// PassageiroCadastroView — port reduzido de mockup-passageiro-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #13. Form mínimo: só `nome` (mesma decisão
// do PilotoCadastroView — altura/peso ficam pra próxima migração).
//
// Modo edit: quando `passageiroToEdit` chega não-nil, hidrata o
// form, troca título e CTA, chama `update(...)` em vez de
// `create(...)`. Botão "Apagar passageiro" no rodapé do conteúdo
// dispara alert antes de remover.

import SwiftUI
import P1FastCore

struct PassageiroCadastroView: View {
    @EnvironmentObject private var repo: PassageiroRepository
    let passageiroToEdit: Passageiro?
    let onClose: () -> Void

    init(passageiroToEdit: Passageiro? = nil, onClose: @escaping () -> Void) {
        self.passageiroToEdit = passageiroToEdit
        self.onClose = onClose
    }

    @State private var nome: String = ""
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var hydrated = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { passageiroToEdit != nil }

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
                saveLabel: isEditing ? "Salvar alterações" : "Salvar passageiro",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar passageiro?", isPresented: $showDeleteAlert) {
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
                Eyebrow(text: isEditing ? "Editar passageiro" : "Novo passageiro")
                Text(isEditing ? "Editar passageiro" : "Cadastrar passageiro")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(isEditing ? "Atualize o nome ou apague o cadastro." : "Fica salvo. Próxima vez é só escolher o nome.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Nome do passageiro", isFocus: !isEditing)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Altura e peso vão entrar quando o schema do time ganhar esses campos. Por enquanto é só o nome.")
                .padding(.top, Spacing.sm)

            if isEditing {
                DeleteCadastroButton(label: "Apagar passageiro") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    private func hydrateFromExisting() {
        guard !hydrated, let p = passageiroToEdit else { return }
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
                if var existing = passageiroToEdit {
                    existing.nome = trimmed
                    try await repo.update(passageiro: existing)
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
        guard let p = passageiroToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.delete(passageiroId: p.id)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("PassageiroCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PassageiroRepository(queue: queue)
    return PassageiroCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}

#Preview("PassageiroCadastroView — edit") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PassageiroRepository(queue: queue)
    let mock = Passageiro(id: "preview-passageiro", timeId: PassageiroRepository.localTimeId, nome: "Alain Mesquita")
    return PassageiroCadastroView(passageiroToEdit: mock, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
