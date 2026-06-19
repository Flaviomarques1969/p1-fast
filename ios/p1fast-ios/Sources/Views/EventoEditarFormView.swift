// ═══════════════════════════════════════════════════════════
// EventoEditarFormView — editar a data de um evento existente
// ═══════════════════════════════════════════════════════════
// 2026-06-19 — Flávio pediu pra "ligar" o botão "Editar" do
// EventoDetalheView, que até então tinha ação vazia (estava
// adiado pro Sprint 1A.3). Como o evento só tem a DATA como campo
// editável hoje (pista fixa "Brasília", tipo fixo "track-day"),
// este form espelha o molde do EventoNovoFormView (FootBar +
// FormField + DatePicker), pré-preenche a data atual e grava a
// nova via EventoRepository.update(evento:).
//
// Sem ícones decorativos, tratamento "você". Quando Sprint 1A.3
// trouxer mockup canônico de edição, este arquivo será refeito 1:1.

import SwiftUI
import P1FastCore

struct EventoEditarFormView: View {
    @EnvironmentObject private var repo: EventoRepository
    let eventoId: String
    let onClose: () -> Void

    @State private var dataEvento: Date
    @State private var isSaving = false
    @State private var savingError: String?

    init(eventoId: String, dataInicial: Date, onClose: @escaping () -> Void) {
        self.eventoId = eventoId
        self.onClose = onClose
        _dataEvento = State(initialValue: dataInicial)
    }

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
                Eyebrow(text: "Editar evento")
                Text("Editar evento")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Você ajusta a data aqui; pista e tipo seguem fixos por enquanto.")
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

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Stints, pilotos e setup você gerencia abrindo o evento — aqui você só muda a data reservada.")
                .padding(.top, Spacing.sm)
        }
    }

    /// Igual ao do EventoNovoFormView — fixo em "Brasília" (única pista hoje).
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
                guard var evento = repo.find(id: eventoId)?.evento else {
                    isSaving = false
                    savingError = "Evento não encontrado. Feche e abra de novo."
                    return
                }
                // Mesma convenção de fuso do create: meia-noite local em ms.
                let cal = Calendar(identifier: .iso8601)
                let inicioDia = cal.startOfDay(for: dataEvento)
                evento.dataEvento = Int64(inicioDia.timeIntervalSince1970 * 1000)
                try await repo.update(evento: evento)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("EventoEditar — data") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = EventoRepository(queue: queue)
    return EventoEditarFormView(
        eventoId: EventoRepository.seedPassado1Id,
        dataInicial: Date(),
        onClose: {}
    )
    .environmentObject(repo)
    .task { await repo.bootstrap() }
}
