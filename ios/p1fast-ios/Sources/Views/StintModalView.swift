// ═══════════════════════════════════════════════════════════
// StintModalView — port reduzido de mockup-stint.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #11. Modal de criação de stint dentro de
// um evento. O mockup canônico (`_design-reference/mockup-stint.html`)
// tem ~10 campos (combustível, pneu, calibragem 4-rodas, setup
// avançado, P1 Coach, área de foco, lição específica, trecho).
// O prompt do queue corta isso pro essencial do MVP — 4 campos:
//
//   - Piloto (picker, fonte = `pilotos` do time)
//   - Objetivo (5 tipos canônicos de SEED_OBJETIVO_TIPOS)
//   - Voltas planejadas (integer ≥ 1)
//   - Lição focada (texto livre — catálogo é Prompt #16)
//
// Visual herda do mockup: eyebrow + título + sections + footbar
// Cancelar/Salvar. Os campos cortados aparecem em "Sprint 1A.3+"
// (placeholder vazio) pra deixar claro que são pendências.
//
// CTA "Iniciar stint" cria sessao em GRDB com status='ativa', volta
// pra detalhe do evento + dispara `onCreated(stintId)` pra UI abrir
// PosStintView (atalho do MVP — sprint 1B vai inserir cockpit ao
// vivo entre os dois).

import SwiftUI
import P1FastCore

struct StintModalView: View {
    @EnvironmentObject private var repo: StintRepository
    let eventoId: String
    let proximoNumero: Int
    let contextoLinha: String
    let onCancel: () -> Void
    let onCreated: (String) -> Void

    @State private var pilotoId: String?
    @State private var objetivoTipo: String = "Aquecimento"
    @State private var voltasPlanejadas: Int = 10
    @State private var licaoFocada: String = ""
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
                onCancel: onCancel,
                onSave: salvar,
                saveLabel: "Iniciar stint",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .onAppear { hidratarPilotoDefault() }
    }

    private var canSave: Bool {
        guard !isSaving else { return false }
        guard pilotoId != nil else { return false }
        guard !objetivoTipo.isEmpty else { return false }
        guard voltasPlanejadas >= 1 else { return false }
        return true
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Novo stint")
                Text("Stint #\(proximoNumero)")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6) // -0.025em em 24pt
                    .foregroundStyle(Color.text)
                if !contextoLinha.isEmpty {
                    Text(contextoLinha)
                        .font(.system(size: 13, weight: .regular))
                        .monospacedDigit()
                        .foregroundStyle(Color.textMuted)
                }
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            sectionConfiguracao
            sectionObjetivo
            sectionVoltas
            sectionLicao

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Combustível, pneus, setup do dia e P1 Coach você cadastra no Sprint 1A.3+ — esse modal mantém só o essencial pra abrir o stint.")
                .padding(.top, Spacing.sm)
        }
    }

    // MARK: - Seções

    private var sectionConfiguracao: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Configuração")
            FormField(label: "Piloto") { pilotoPicker }
        }
    }

    private var sectionObjetivo: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Objetivo")
            FormField(label: "Tipo", small: "obrigatório") {
                ObjetivoPicker(selection: $objetivoTipo)
            }
        }
    }

    private var sectionVoltas: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Voltas planejadas")
            FormField(label: "Voltas", small: "mínimo 1") {
                VoltasStepper(value: $voltasPlanejadas)
            }
        }
    }

    private var sectionLicao: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Lição focada")
            FormField(label: "Lição praticada", small: "opcional · texto livre") {
                FormInput(text: $licaoFocada, placeholder: "Ex: V-Min · apex")
            }
            // Sugestões 1:1 com o mockup canônico (chips na seção objetivo).
            chipsSugestoes
        }
    }

    private func sectionHead(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.32) // 0.12em em 11pt
            .foregroundStyle(Color.textFaint)
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 2)
    }

    private var chipsSugestoes: some View {
        let sugestoes = ["V-Min · apex", "Referência Fixa", "Acelerador Progressivo", "Sem Coach", "Treinar largada", "Treinar trecho"]
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(sugestoes, id: \.self) { sug in
                    chipSug(sug)
                }
            }
            .padding(.horizontal, 1)
        }
    }

    private func chipSug(_ texto: String) -> some View {
        Button(action: { licaoFocada = texto }) {
            Text(texto)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(Color.clear))
                .overlay(Capsule().stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Picker piloto

    private var pilotoPicker: some View {
        Menu {
            ForEach(repo.pilotos, id: \.id) { p in
                Button(p.nome) { pilotoId = p.id }
            }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pilotoNomeAtual ?? "Escolher piloto")
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(pilotoNomeAtual == nil ? Color.textFaint : Color.text)
                    if let _ = pilotoNomeAtual {
                        Text("Você")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                }
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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
        .menuStyle(.button)
    }

    private var pilotoNomeAtual: String? {
        guard let id = pilotoId else { return nil }
        return repo.pilotos.first(where: { $0.id == id })?.nome
    }

    private func hidratarPilotoDefault() {
        if pilotoId == nil {
            pilotoId = repo.pilotos.first(where: { $0.id == StintRepository.pilotoFlavioId })?.id
                ?? repo.pilotos.first?.id
        }
    }

    // MARK: - Salvar

    private func salvar() {
        guard let pid = pilotoId else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                let stintId = try await repo.create(
                    eventoId: eventoId,
                    pilotoId: pid,
                    objetivoTipo: objetivoTipo,
                    licaoFocada: licaoFocada,
                    voltasPlanejadas: voltasPlanejadas
                )
                isSaving = false
                onCreated(stintId)
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Sub-componentes

/// Picker dos 5 tipos canônicos. Visual idêntico ao CategoriaPicker do
/// CarroNovoFormView mas alimentado por `StintObjetivoTipos.canonicos`.
private struct ObjetivoPicker: View {
    @Binding var selection: String

    var body: some View {
        Menu {
            ForEach(StintObjetivoTipos.canonicos, id: \.self) { tipo in
                Button(tipo) { selection = tipo }
            }
        } label: {
            HStack {
                Text(selection)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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
        .menuStyle(.button)
    }
}

/// Stepper numérico — ± / valor central. Mais legível que TextField
/// num campo "voltas planejadas" que só aceita ints positivos.
private struct VoltasStepper: View {
    @Binding var value: Int

    var body: some View {
        HStack(spacing: 0) {
            stepperButton(symbol: "−", action: decrement, isEnabled: value > 1)
            Spacer(minLength: 0)
            Text("\(value)")
                .font(.system(size: 22, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.44) // -0.02em em 22pt
                .foregroundStyle(Color.text)
            Spacer(minLength: 0)
            stepperButton(symbol: "+", action: increment, isEnabled: value < 99)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func decrement() { if value > 1 { value -= 1 } }
    private func increment() { if value < 99 { value += 1 } }

    private func stepperButton(symbol: String, action: @escaping () -> Void, isEnabled: Bool) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(isEnabled ? Color.text : Color.textFaint)
                .frame(width: 46, height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

#Preview("StintModal — preview vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = StintRepository(queue: queue)
    return StintModalView(
        eventoId: "preview",
        proximoNumero: 1,
        contextoLinha: "Brasília · sábado 02/05 · Celta 1.4",
        onCancel: {},
        onCreated: { _ in }
    )
    .environmentObject(repo)
    .task { await repo.bootstrap() }
}
