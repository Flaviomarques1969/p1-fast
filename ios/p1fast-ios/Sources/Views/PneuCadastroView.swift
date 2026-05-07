// ═══════════════════════════════════════════════════════════
// PneuCadastroView — port de mockup-pneu-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sheet de cadastro/edição de um pneu individual. Abre como sheet
// do CarroModalView (pneu sempre tem FK carro_id).
//
// Decisões do prompt #14:
//   "Marca / composto" (input livre, ex "Pirelli P1 — radial") → coluna `marca`
//   "Medida" (ex "205/50R16")                                  → coluna `medida`
//   "Tipo" (3-button rail)                                     → coluna `composto`
//                                                                (radial | slick | rua)
//   "Apelido" (mockup) — OMITIDO no v1, schema não tem coluna.
//   "modelo" da tabela fica NULL — v1 não separa marca/modelo.
//
// Init com `pneuToEdit: nil` cria novo; com pneu preenchido edita
// in-place via PneuRepository.upsert (.save = INSERT OR REPLACE).
//
// Modo edit também ganha botão "Apagar pneu" no rodapé do conteúdo
// (ghost vermelho). Tap dispara alert "Não dá pra desfazer." antes
// de chamar `delete(...)` — mesmo padrão dos demais cadastros do
// Sprint 1A.3.

import SwiftUI
import P1FastCore

struct PneuCadastroView: View {
    @EnvironmentObject private var repo: PneuRepository
    let carroId: String
    let pneuToEdit: Pneu?
    let onClose: () -> Void

    @State private var marca: String = ""
    @State private var medida: String = ""
    @State private var composto: Pneu.Composto = .radial
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { pneuToEdit != nil }

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
                onSave: save,
                saveLabel: isEditing ? "Salvar alterações" : "Salvar pneu",
                canSave: !marca.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar pneu?", isPresented: $showDeleteAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDelete() }
        } message: {
            Text("Não dá pra desfazer.")
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: isEditing ? "Editar pneu" : "Novo pneu")
                Text(isEditing ? "Editar pneu" : "Cadastrar pneu")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Cada pneu cadastrado tem histórico próprio.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Marca / composto") {
                FormInput(text: $marca, placeholder: "Ex: Pirelli P1 — radial")
            }

            FormField(label: "Medida") {
                FormInput(text: $medida, placeholder: "Ex: 205/50R16")
            }

            FormField(label: "Tipo") {
                CompostoRail(selection: $composto)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            if isEditing {
                DeleteCadastroButton(label: "Apagar pneu") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    private func hydrateFromExisting() {
        guard let p = pneuToEdit else { return }
        marca = p.marca ?? ""
        medida = p.medida ?? ""
        composto = p.composto ?? .radial
    }

    private func save() {
        let trimmedMarca = marca.trimmingCharacters(in: .whitespaces)
        guard !trimmedMarca.isEmpty else { return }
        isSaving = true
        savingError = nil
        let trimmedMedida = medida.trimmingCharacters(in: .whitespaces)
        let pneu: Pneu = {
            if var existing = pneuToEdit {
                existing.marca = trimmedMarca
                existing.medida = trimmedMedida.isEmpty ? nil : trimmedMedida
                existing.composto = composto
                return existing
            }
            return Pneu(
                id: UUID().uuidString,
                timeId: TeamContext.currentTeamId ?? "",
                carroId: carroId,
                marca: trimmedMarca,
                modelo: nil,
                medida: trimmedMedida.isEmpty ? nil : trimmedMedida,
                composto: composto,
                ciclos: 0
            )
        }()
        Task {
            do {
                try await repo.upsert(pneu)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func confirmarDelete() {
        guard let p = pneuToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.delete(id: p.id)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - 3-button rail (Radial / Slick / Rua)

private struct CompostoRail: View {
    @Binding var selection: Pneu.Composto

    var body: some View {
        HStack(spacing: 8) {
            CompostoButton(label: "Radial", value: .radial, selection: $selection)
            CompostoButton(label: "Slick", value: .slick, selection: $selection)
            CompostoButton(label: "Rua", value: .rua, selection: $selection)
        }
    }
}

private struct CompostoButton: View {
    let label: String
    let value: Pneu.Composto
    @Binding var selection: Pneu.Composto

    private var isActive: Bool { selection == value }

    var body: some View {
        Button {
            selection = value
        } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.07)
                .foregroundStyle(isActive ? Color.onAccent : Color.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(isActive ? Color.accent : Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(isActive ? Color.accent : Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
