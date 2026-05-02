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

import SwiftUI
import P1FastCore

struct PilotoCadastroView: View {
    @EnvironmentObject private var repo: PilotoRepository
    let onClose: () -> Void

    @State private var nome: String = ""
    @State private var savingError: String?
    @State private var isSaving = false

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
                saveLabel: "Salvar piloto",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !isSaving && !nome.trimmingCharacters(in: .whitespaces).isEmpty
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Novo piloto")
                Text("Cadastrar piloto")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Fica salvo pra próximos stints.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Nome do piloto", isFocus: true)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Altura, peso e idade vão entrar quando o schema do time ganhar esses campos. Por enquanto é só o nome.")
                .padding(.top, Spacing.sm)
        }
    }

    private func salvar() {
        let trimmed = nome.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.create(nome: trimmed)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("PilotoCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PilotoRepository(queue: queue)
    return PilotoCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
