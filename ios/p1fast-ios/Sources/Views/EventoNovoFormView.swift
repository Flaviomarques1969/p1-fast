// ═══════════════════════════════════════════════════════════
// EventoNovoFormView — form mínimo de criação de evento
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #10. Não há mockup canônico de "novo evento"
// (a fila prevê isso pra Sprint 1A.3, dentro de mockup-stint.html).
// Aqui implementamos o mínimo viável pra cumprir o item "CRUD via
// GRDB (criar/editar evento)" da aceitação:
//
//   - Pista: hard-coded "Brasília" (única catalogada hoje)
//   - Data: DatePicker (default = hoje + 7d)
//   - Submit: cria via repo.create(...) → fecha sheet
//
// Visual segue o mesmo footbar do CarroNovoFormView (FootBar do
// Prompt #9). Sem ícones decorativos, tratamento "você". Quando
// Sprint 1A.3 entregar mockup canônico, este arquivo será refeito
// 1:1 com o mockup.

import SwiftUI
import P1FastCore

struct EventoNovoFormView: View {
    @EnvironmentObject private var repo: EventoRepository
    let onClose: () -> Void

    @State private var dataEvento: Date = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var observacao: String = ""
    @State private var isSaving = false
    @State private var savingError: String?

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
                saveLabel: "Salvar",
                canSave: !isSaving
            )
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Novo evento")
                Text("Cadastrar evento")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Você cadastra a data agora; pistas adicionais e detalhes ficam pra próxima sprint.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(2)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Pista") {
                disabledPistaPicker
            }

            FormField(label: "Data do evento") {
                dataPicker
            }

            FormField(label: "Observação", small: "opcional") {
                FormInput(text: $observacao, placeholder: "Ex: testar pneus novos")
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Stints, pilotos e setup você cadastra abrindo o evento depois — esse cadastro só reserva a data e a pista.")
                .padding(.top, Spacing.sm)
        }
    }

    /// Picker visualmente igual ao Categoria do CarroNovoFormView mas
    /// fixo em "Brasília" (única pista no catálogo hoje).
    private var disabledPistaPicker: some View {
        HStack {
            Text("Brasília · Auto. Int. Nelson Piquet")
                .font(.system(size: 15, weight: .medium))
                .tracking(-0.075)
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Spacer()
            Text("única hoje")
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Color.textFaint)
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

    private var dataPicker: some View {
        DatePicker(
            "Data do evento",
            selection: $dataEvento,
            displayedComponents: [.date]
        )
        .datePickerStyle(.compact)
        .labelsHidden()
        .environment(\.locale, Locale(identifier: "pt_BR"))
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func save() {
        isSaving = true
        savingError = nil
        Task {
            do {
                let cal = Calendar(identifier: .iso8601)
                let inicioDia = cal.startOfDay(for: dataEvento)
                let dataMs = Int64(inicioDia.timeIntervalSince1970 * 1000)
                _ = try await repo.create(
                    trackId: EventoRepository.brasiliaTrackId,
                    tipo: "track-day",
                    dataEvento: dataMs
                )
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("EventoNovo — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = EventoRepository(queue: queue)
    return EventoNovoFormView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
