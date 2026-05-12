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
    @EnvironmentObject private var trackRepo: TrackRepository
    let onClose: () -> Void

    @State private var dataEvento: Date = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var observacao: String = ""
    @State private var isSaving = false
    @State private var savingError: String?
    // S4 da rodada 1: autódromo selecionado + sheet de seleção agrupada por cidade.
    @State private var trackIdSelecionado: String?
    @State private var mostrandoSeletorPista = false

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
        .onAppear {
            if trackIdSelecionado == nil {
                trackIdSelecionado = trackRepo.tracks.first?.id ?? EventoRepository.brasiliaTrackId
            }
        }
        .sheet(isPresented: $mostrandoSeletorPista) {
            EscolherAutodromoSheet(
                tracks: trackRepo.tracks,
                idSelecionado: trackIdSelecionado,
                onEscolher: { id in
                    trackIdSelecionado = id
                    mostrandoSeletorPista = false
                },
                onClose: { mostrandoSeletorPista = false }
            )
        }
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

    /// S4 da rodada 1: picker que abre sheet com autódromos agrupados por
    /// cidade. Mostra apelido + cidade da pista selecionada e a quantidade
    /// total de autódromos cadastrados como hint.
    private var disabledPistaPicker: some View {
        Button {
            mostrandoSeletorPista = true
        } label: {
            HStack {
                Text(textoPistaSelecionada)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                Spacer()
                Text(hintQuantidade)
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                Text("›")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.leading, 4)
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
        .buttonStyle(.plain)
    }

    private var textoPistaSelecionada: String {
        guard let id = trackIdSelecionado,
              let track = trackRepo.tracks.first(where: { $0.id == id }) else {
            return "Escolher autódromo"
        }
        let cidade = track.cidade?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        if let cidade = cidade {
            return "\(cidade) · \(track.apelido)"
        }
        return track.apelido
    }

    private var hintQuantidade: String {
        let n = trackRepo.tracks.count
        if n <= 1 { return "único hoje" }
        return "\(n) cadastrados"
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
                let trackId = trackIdSelecionado ?? EventoRepository.brasiliaTrackId
                _ = try await repo.create(
                    trackId: trackId,
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
    let trackRepo = TrackRepository(queue: queue)
    return EventoNovoFormView(onClose: {})
        .environmentObject(repo)
        .environmentObject(trackRepo)
        .task {
            await repo.bootstrap()
            await trackRepo.bootstrap()
        }
}

// MARK: - EscolherAutodromoSheet (S4 rodada 1)

/// Sheet que mostra todos os autódromos cadastrados agrupados por cidade.
/// O piloto só ESCOLHE — cadastro é tarefa interna (decisão Flávio P3 #7.1).
/// Hoje a lista tem só Brasília · Nelson Piquet; outras pistas entram quando
/// forem cadastradas internamente.
struct EscolherAutodromoSheet: View {
    let tracks: [TrackRow]
    let idSelecionado: String?
    let onEscolher: (String) -> Void
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    HStack {
                        Button(action: onClose) {
                            Text("‹ Voltar")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.textMuted)
                                .padding(.vertical, 8)
                                .padding(.horizontal, 4)
                        }
                        .buttonStyle(.plain)
                        Spacer()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Eyebrow(text: "Escolher autódromo")
                        Text("Onde vai ser o evento")
                            .font(.system(size: 22, weight: .semibold))
                            .tracking(-0.55)
                            .foregroundStyle(Color.text)
                        Text("Toque numa cidade pra ver os autódromos disponíveis. Cadastro de novos autódromos é tarefa interna — entre em contato pra acrescentar.")
                            .font(.system(size: 13, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                    }
                    .padding(.horizontal, Spacing.xs)

                    cidadesList
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 40)
            }
        }
        .preferredColorScheme(.dark)
    }

    private var cidadesList: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(gruposPorCidade, id: \.cidade) { grupo in
                cidadeBloco(grupo)
            }
        }
    }

    private struct GrupoCidade {
        let cidade: String
        let tracks: [TrackRow]
    }

    /// Agrupa por cidade (case-insensitive), ordena cidades alfabéticamente,
    /// e dentro de cada cidade ordena por apelido. Pistas com cidade nil
    /// vão pra um grupo "Sem cidade" no fim — não deveria acontecer com o
    /// seed atual, mas mantém UI honesta se aparecer.
    private var gruposPorCidade: [GrupoCidade] {
        let agrupado = Dictionary(grouping: tracks) { (t: TrackRow) -> String in
            (t.cidade?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 }
                ?? "Sem cidade"
        }
        return agrupado
            .map { GrupoCidade(cidade: $0.key, tracks: $0.value.sorted(by: { $0.apelido < $1.apelido })) }
            .sorted { lhs, rhs in
                // "Sem cidade" sempre por último.
                if lhs.cidade == "Sem cidade" { return false }
                if rhs.cidade == "Sem cidade" { return true }
                return lhs.cidade < rhs.cidade
            }
    }

    private func cidadeBloco(_ grupo: GrupoCidade) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(grupo.cidade.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(Color.textFaint)
                Text("·")
                    .foregroundStyle(Color.textFaint)
                Text(grupo.tracks.count == 1 ? "1 autódromo" : "\(grupo.tracks.count) autódromos")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            VStack(spacing: 8) {
                ForEach(grupo.tracks, id: \.id) { track in
                    autodromoLinha(track)
                }
            }
        }
    }

    private func autodromoLinha(_ track: TrackRow) -> some View {
        let estaSelecionado = (track.id == idSelecionado)
        return Button {
            onEscolher(track.id)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(track.apelido)
                        .font(.system(size: 15, weight: .semibold))
                        .tracking(-0.075)
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    if let oficial = track.nomeOficial, !oficial.isEmpty {
                        Text(oficial)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if estaSelecionado {
                    Text("Selecionado")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(Color.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 999, style: .continuous)
                                .fill(Color.accentDim.opacity(0.18))
                        )
                } else {
                    Text("›")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(estaSelecionado ? Color.accentDim.opacity(0.10) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(estaSelecionado ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Helpers

private extension String {
    /// Retorna nil quando a string está vazia. Usado no resumo da pista
    /// selecionada pra não mostrar " · " com cidade vazia.
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
