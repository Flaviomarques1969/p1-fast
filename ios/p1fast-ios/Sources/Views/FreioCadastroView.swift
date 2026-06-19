// ═══════════════════════════════════════════════════════════
// FreioCadastroView — cadastro/edição de um item de freio
// ═══════════════════════════════════════════════════════════
// Espelha o PneuCadastroView (decisão Flávio 19/06/2026: freio/pastilha
// ganha "cadastro próprio igual pneu"). Abre como sheet do CarroModalView
// (todo item tem FK carro_id).
//
// Campos:
//   "Tipo"        (rail) → coluna `tipo` (pastilhas | discos | fluido_freio)
//                          — vem do catálogo de consumíveis, não inventado.
//   "Marca / modelo" (input livre) → coluna `marca`  (obrigatório)
//   "Especificação"  (input livre) → coluna `especificacao` (opcional)
//
// Init com `freioToEdit: nil` cria novo; com item preenchido edita
// in-place via FreioRepository.upsert. Modo edit também ganha "Apagar"
// (ghost vermelho) com alert "Não dá pra desfazer." — mesmo padrão dos
// demais cadastros.

import SwiftUI
import P1FastCore

struct FreioCadastroView: View {
    @EnvironmentObject private var repo: FreioRepository
    let carroId: String
    let freioToEdit: Freio?
    let onClose: () -> Void

    @State private var tipo: FreioTipo = .pastilhas
    @State private var marca: String = ""
    @State private var especificacao: String = ""
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { freioToEdit != nil }

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
                saveLabel: isEditing ? "Salvar alterações" : "Salvar freio",
                canSave: !marca.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar item de freio?", isPresented: $showDeleteAlert) {
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
                Eyebrow(text: isEditing ? "Editar freio" : "Novo freio")
                Text(isEditing ? "Editar item de freio" : "Cadastrar freio")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Cadastra uma vez. No carro aparece só o tipo.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Tipo") {
                FreioTipoRail(selection: $tipo)
            }

            FormField(label: "Marca / modelo") {
                FormInput(text: $marca, placeholder: "Ex: Cobreq Racing")
            }

            FormField(label: "Especificação", small: "opcional") {
                FormInput(text: $especificacao, placeholder: "Ex: dianteira · cerâmica")
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            if isEditing {
                DeleteCadastroButton(label: "Apagar freio") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    private func hydrateFromExisting() {
        guard let f = freioToEdit else { return }
        tipo = FreioTipo(rawValue: f.tipo ?? "") ?? .pastilhas
        marca = f.marca ?? ""
        especificacao = f.especificacao ?? ""
    }

    private func save() {
        let trimmedMarca = marca.trimmingCharacters(in: .whitespaces)
        guard !trimmedMarca.isEmpty else { return }
        isSaving = true
        savingError = nil
        let trimmedSpec = especificacao.trimmingCharacters(in: .whitespaces)
        let freio: Freio = {
            if var existing = freioToEdit {
                existing.tipo = tipo.rawValue
                existing.marca = trimmedMarca
                existing.especificacao = trimmedSpec.isEmpty ? nil : trimmedSpec
                return existing
            }
            return Freio(
                id: UUID().uuidString,
                timeId: TeamContext.currentTeamId ?? "",
                carroId: carroId,
                tipo: tipo.rawValue,
                marca: trimmedMarca,
                especificacao: trimmedSpec.isEmpty ? nil : trimmedSpec
            )
        }()
        Task {
            do {
                try await repo.upsert(freio)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func confirmarDelete() {
        guard let f = freioToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.delete(id: f.id)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Rail de tipo (Pastilha / Disco / Fluido)
// Os 3 componentes de freio que o Flávio citou e que existem na área
// "Freios" do catálogo de consumíveis. Nada inventado.

private struct FreioTipoRail: View {
    @Binding var selection: FreioTipo

    var body: some View {
        HStack(spacing: 8) {
            ForEach(FreioTipo.allCases) { t in
                FreioTipoButton(tipo: t, selection: $selection)
            }
        }
    }
}

private struct FreioTipoButton: View {
    let tipo: FreioTipo
    @Binding var selection: FreioTipo

    private var isActive: Bool { selection == tipo }

    var body: some View {
        Button {
            selection = tipo
        } label: {
            Text(tipo.rotulo)
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
