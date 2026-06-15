// ═══════════════════════════════════════════════════════════
// CombustivelCadastroView — port reduzido de mockup-combustivel-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #15. Form mínimo (decisão do prompt):
//   - "Nome do tipo"  → combustiveis.nome      (NOT NULL)
//   - "Observação"    → combustiveis.tipo      (texto livre, opcional)
// Mantém o schema canônico v1 — sem migration nova neste PR. Mesmo
// padrão do PilotoCadastroView (form reduzido vs mockup completo).
//
// Visual herda do mockup: eyebrow + título + label + input + textarea
// + FootBar Cancelar/Salvar. Octanagem do schema fica fora do form
// v1 (HelperNote deixa explícito).
//
// Modo edit: quando `combustivelToEdit` chega não-nil, hidrata o
// form, troca título e CTA, chama `update(...)` em vez de
// `create(...)`. Botão "Apagar combustível" no rodapé do conteúdo
// dispara alert antes de remover.

import SwiftUI
import P1FastCore

struct CombustivelCadastroView: View {
    @EnvironmentObject private var repo: CombustivelRepository
    let combustivelToEdit: Combustivel?
    let onClose: () -> Void

    init(combustivelToEdit: Combustivel? = nil, onClose: @escaping () -> Void) {
        self.combustivelToEdit = combustivelToEdit
        self.onClose = onClose
    }

    @State private var nome: String = ""
    @State private var observacao: String = ""
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var hydrated = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { combustivelToEdit != nil }

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
                saveLabel: isEditing ? "Salvar alterações" : "Salvar tipo",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar combustível?", isPresented: $showDeleteAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDelete() }
        } message: {
            Text("Some da lista, mas fica em Apagados — dá pra resgatar.")
        }
    }

    private var canSave: Bool {
        !isSaving && !nome.trimmingCharacters(in: .whitespaces).isEmpty
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: isEditing ? "Editar combustível" : "Novo combustível")
                Text(isEditing ? "Editar tipo" : "Cadastrar tipo")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(isEditing ? "Atualize os dados ou apague o tipo." : "Fica disponível pra próximos stints.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome do tipo") {
                FormInput(
                    text: $nome,
                    placeholder: "Ex: Etanol, E85, Metanol",
                    isFocus: !isEditing
                )
            }

            FormField(label: "Observação", small: "opcional") {
                FormTextArea(
                    text: $observacao,
                    placeholder: "Onde compra, octanagem, restrições..."
                )
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Octanagem entra quando o form de stint precisar dela. Por enquanto guarda no campo de observação se quiser registrar.")
                .padding(.top, Spacing.sm)

            if isEditing {
                DeleteCadastroButton(label: "Apagar combustível") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    private func hydrateFromExisting() {
        guard !hydrated, let c = combustivelToEdit else { return }
        nome = c.nome
        observacao = c.tipo ?? ""
        hydrated = true
    }

    private func salvar() {
        let trimmedNome = nome.trimmingCharacters(in: .whitespaces)
        guard !trimmedNome.isEmpty else { return }
        let obs = observacao.trimmingCharacters(in: .whitespacesAndNewlines)
        isSaving = true
        savingError = nil
        Task {
            do {
                if var existing = combustivelToEdit {
                    existing.nome = trimmedNome
                    existing.tipo = obs.isEmpty ? nil : obs
                    try await repo.update(combustivel: existing)
                } else {
                    try await repo.create(
                        nome: trimmedNome,
                        observacao: obs.isEmpty ? nil : obs
                    )
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
        guard let c = combustivelToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.arquivar(combustivelId: c.id, rotulo: c.nome)
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

/// Textarea estilizado igual ao FormInput, mas com mínimo 90pt e
/// font um pouco menor (15pt regular vs 16pt medium do single-line).
/// Espelha `textarea.input` do mockup-combustivel-cadastro.html.
private struct FormTextArea: View {
    @Binding var text: String
    var placeholder: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 17)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .font(.system(size: 15, weight: .regular))
                .tracking(-0.04)
                .foregroundStyle(Color.text)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 10)
                .padding(.vertical, 9)
                .frame(minHeight: 90)
        }
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }
}

#Preview("CombustivelCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CombustivelRepository(queue: queue)
    return CombustivelCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}

#Preview("CombustivelCadastroView — edit") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CombustivelRepository(queue: queue)
    let mock = Combustivel(
        id: "preview-combustivel",
        timeId: "preview-team",
        nome: "Etanol comum",
        tipo: "Posto Shell BR-040"
    )
    return CombustivelCadastroView(combustivelToEdit: mock, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
