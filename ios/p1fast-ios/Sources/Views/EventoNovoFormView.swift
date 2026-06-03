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

    /// Dias selecionados pelo usuário tocando o calendário (rodada 2026-05-16:
    /// Flávio quer 1 só campo "Data", abre o calendário, toca os dias do
    /// evento — não data início + fim separadas).
    @State private var diasSelecionados: Set<DateComponents> = []
    /// Lista de inputs (rótulo+tipo) por dia selecionado, na mesma ordem
    /// cronológica de `diasGerados`. Atualizada quando o usuário toca dias.
    @State private var diasInputs: [DiaInput] = []
    @State private var isSaving = false
    @State private var savingError: String?
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
                Text("Escolha a pista e o período (de 1 a 7 dias). Pra cada dia, você pode dar um nome próprio e o tipo (treino, classificação, corrida).")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(2)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Pista") {
                disabledPistaPicker
            }

            FormField(label: "Data") {
                calendarioMultiData
            }

            // Lista de dias gerada do calendário. Reativa a toques.
            if !diasGerados.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text(tituloDiasGerados)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                    ForEach(diasGerados.indices, id: \.self) { idx in
                        DiaCard(
                            data: diasGerados[idx],
                            rotulo: bindingRotulo(idx),
                            tipo: bindingTipo(idx)
                        )
                    }
                }
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Toque os dias do evento no calendário. Sem nome, o dia aparece como \"Dia de pista NN\". Stints e setup você cadastra abrindo o evento depois.")
                .padding(.top, Spacing.sm)
        }
        .onChange(of: diasSelecionados) { _, _ in
            ajustarDiasInputs()
        }
    }

    /// Calendário visual onde o usuário toca os dias do evento. Permite
    /// múltiplos dias (consecutivos ou não — sex/sáb/dom no normal; mas
    /// também 23 e 25 pulando o 24 se for o caso). Limite mínimo = hoje.
    /// Custom em vez de MultiDatePicker pra evitar o destaque azul de
    /// "hoje" do iOS — gestor não quer NADA pré-selecionado (2026-05-16).
    private var calendarioMultiData: some View {
        InlineMonthCalendar(
            diasSelecionados: $diasSelecionados,
            minimoDate: Calendar.current.startOfDay(for: Date())
        )
    }

    /// Datas selecionadas pelo usuário, em ordem cronológica. Vazio quando
    /// ele ainda não tocou nada.
    private var diasGerados: [Date] {
        let cal = Calendar(identifier: .iso8601)
        return diasSelecionados
            .compactMap { cal.date(from: $0) }
            .map { cal.startOfDay(for: $0) }
            .sorted()
    }

    private var tituloDiasGerados: String {
        let n = diasGerados.count
        return n == 1 ? "Dia do evento" : "Dias do evento (\(n))"
    }

    /// Mantém `diasInputs.count` em sincronia com `diasGerados.count`.
    /// Quando o usuário aumenta o período, adiciona itens vazios; quando
    /// reduz, descarta os do fim. Preserva o que já foi preenchido.
    private func ajustarDiasInputs() {
        let n = diasGerados.count
        if diasInputs.count < n {
            diasInputs.append(contentsOf: Array(repeating: DiaInput(), count: n - diasInputs.count))
        } else if diasInputs.count > n {
            diasInputs.removeLast(diasInputs.count - n)
        }
    }

    private func bindingRotulo(_ idx: Int) -> Binding<String> {
        Binding(
            get: { idx < diasInputs.count ? diasInputs[idx].rotulo : "" },
            set: { if idx < diasInputs.count { diasInputs[idx].rotulo = $0 } }
        )
    }

    private func bindingTipo(_ idx: Int) -> Binding<String?> {
        Binding(
            get: { idx < diasInputs.count ? diasInputs[idx].tipo : nil },
            set: { if idx < diasInputs.count { diasInputs[idx].tipo = $0 } }
        )
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

    private func save() {
        let dias = diasGerados
        guard !dias.isEmpty else {
            savingError = "Toque pelo menos um dia no calendário."
            return
        }
        isSaving = true
        savingError = nil
        let cal = Calendar(identifier: .iso8601)
        let inicioMs = Int64(cal.startOfDay(for: dias.first!).timeIntervalSince1970 * 1000)
        let fimMs = Int64(cal.startOfDay(for: dias.last!).timeIntervalSince1970 * 1000)
        let inputs: [EventoRepository.EventoDiaInput] = (0..<dias.count).map { idx in
            let input = idx < diasInputs.count ? diasInputs[idx] : DiaInput()
            let rotulo = input.rotulo.trimmingCharacters(in: .whitespaces)
            return EventoRepository.EventoDiaInput(
                rotulo: rotulo.isEmpty ? nil : rotulo,
                tipo: input.tipo
            )
        }
        let trackId = trackIdSelecionado ?? EventoRepository.brasiliaTrackId
        Task {
            do {
                _ = try await repo.create(
                    trackId: trackId,
                    dataInicio: inicioMs,
                    dataFim: fimMs,
                    dias: inputs
                )
                await MainActor.run {
                    isSaving = false
                    onClose()
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    let ns = error as NSError
                    // Erros de validação do repo (domain/code conhecidos) já
                    // vêm com mensagem voltada ao usuário — mostrar como está.
                    if ns.domain == "EventoRepository" {
                        savingError = ns.localizedDescription
                    } else {
                        savingError = "Não consegui salvar: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
}

// MARK: - DiaInput + DiaCard

/// Estado do formulário pra um dia do evento: rótulo (string, pode ficar
/// vazia → vira "Dia de pista DD" no app) e tipo (treino/quali/corrida/livre
/// ou nil = sem tipo).
struct DiaInput: Equatable {
    var rotulo: String = ""
    var tipo: String? = nil
}

/// Tipos canônicos de dia de pista. Lista curta, fixa.
enum DiaTipo: String, CaseIterable, Identifiable {
    case treinoLivre = "treino_livre"
    case classificacao = "classificacao"
    case corrida = "corrida"
    case outro = "outro"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .treinoLivre: return "Treino livre"
        case .classificacao: return "Classificação"
        case .corrida: return "Corrida"
        case .outro: return "Outro"
        }
    }
}

/// Card de um dia do período, com data fixa + campo rótulo + picker de tipo.
private struct DiaCard: View {
    let data: Date
    @Binding var rotulo: String
    @Binding var tipo: String?

    private static let fmtData: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "EEE dd/MM"
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(DiaCard.fmtData.string(from: data).capitalized)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.text)
                Spacer()
                Text(tipoPickerLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }
            FormInput(text: $rotulo, placeholder: "Nome do dia (opcional — ex: \"Quali\")")
            tipoPicker
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private var tipoPickerLabel: String {
        if let raw = tipo, let t = DiaTipo(rawValue: raw) { return t.label }
        return "sem tipo"
    }

    private var tipoPicker: some View {
        Menu {
            Button("Sem tipo") { tipo = nil }
            Divider()
            ForEach(DiaTipo.allCases) { t in
                Button(t.label) { tipo = t.rawValue }
            }
        } label: {
            HStack {
                Text("Tipo · \(tipoPickerLabel)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
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

// MARK: - InlineMonthCalendar

/// Calendário inline próprio. Diferenças vs MultiDatePicker do sistema:
///   - Não destaca "hoje" em azul (regra Flávio 2026-05-16).
///   - Visual casa com o dark theme do app.
///   - Mesma assinatura do MultiDatePicker (`Set<DateComponents>`) pra
///     manter `diasGerados`/`ajustarDiasInputs` funcionando sem mudança.
/// Datas anteriores a `minimoDate` ficam apagadas e não recebem toque.
private struct InlineMonthCalendar: View {
    @Binding var diasSelecionados: Set<DateComponents>
    let minimoDate: Date

    @State private var mesExibido: Date = Date()

    private let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.locale = Locale(identifier: "pt_BR")
        c.firstWeekday = 1
        return c
    }()

    private static let nomeMesFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "LLLL 'de' yyyy"
        return f
    }()

    var body: some View {
        VStack(spacing: 10) {
            header
            weekdayRow
            daysGrid
        }
        .padding(.horizontal, 12)
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

    private var header: some View {
        HStack {
            Button { mudarMes(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(podeVoltarMes ? Color.text : Color.textFaint)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!podeVoltarMes)

            Spacer()
            Text(Self.nomeMesFmt.string(from: mesExibido).capitalized)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.text)
            Spacer()

            Button { mudarMes(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(Self.weekdayLabels[i])
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textFaint)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private static let weekdayLabels = ["D", "S", "T", "Q", "Q", "S", "S"]

    private var daysGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7),
            spacing: 4
        ) {
            ForEach(Array(diasDoMes.enumerated()), id: \.offset) { _, slot in
                celulaDia(slot)
            }
        }
    }

    @ViewBuilder
    private func celulaDia(_ slot: SlotDia) -> some View {
        switch slot {
        case .vazio:
            Color.clear.frame(height: 38)
        case .dia(let date):
            let bloqueado = date < cal.startOfDay(for: minimoDate)
            let comp = cal.dateComponents([.year, .month, .day], from: date)
            let selecionado = diasSelecionados.contains(comp)
            Button {
                guard !bloqueado else { return }
                if selecionado {
                    diasSelecionados.remove(comp)
                } else {
                    diasSelecionados.insert(comp)
                }
            } label: {
                Text("\(cal.component(.day, from: date))")
                    .font(.system(size: 16, weight: selecionado ? .semibold : .medium))
                    .foregroundStyle(
                        bloqueado
                            ? Color.textFaint.opacity(0.5)
                            : (selecionado ? Color.onAccent : Color.text)
                    )
                    .frame(width: 36, height: 36)
                    .background(
                        Circle().fill(selecionado ? Color.accent : Color.clear)
                    )
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(bloqueado)
        }
    }

    private enum SlotDia {
        case vazio
        case dia(Date)
    }

    private var diasDoMes: [SlotDia] {
        guard let inicioMes = cal.date(from: cal.dateComponents([.year, .month], from: mesExibido)) else {
            return []
        }
        let pesoPrimeiro = cal.component(.weekday, from: inicioMes)
        var slots: [SlotDia] = []
        for _ in 0..<(pesoPrimeiro - cal.firstWeekday) {
            slots.append(.vazio)
        }
        let totalDias = cal.range(of: .day, in: .month, for: inicioMes)?.count ?? 0
        for d in 0..<totalDias {
            if let date = cal.date(byAdding: .day, value: d, to: inicioMes) {
                slots.append(.dia(date))
            }
        }
        return slots
    }

    private var podeVoltarMes: Bool {
        guard
            let inicio = cal.date(from: cal.dateComponents([.year, .month], from: mesExibido)),
            let mesAnterior = cal.date(byAdding: .month, value: -1, to: inicio)
        else { return false }
        let mesMin = cal.dateComponents([.year, .month], from: minimoDate)
        let mesPrev = cal.dateComponents([.year, .month], from: mesAnterior)
        guard let ymPrev = mesPrev.year, let mPrev = mesPrev.month,
              let ymMin = mesMin.year, let mMin = mesMin.month else { return false }
        if ymPrev < ymMin { return false }
        if ymPrev == ymMin && mPrev < mMin { return false }
        return true
    }

    private func mudarMes(_ delta: Int) {
        guard
            let inicio = cal.date(from: cal.dateComponents([.year, .month], from: mesExibido)),
            let novo = cal.date(byAdding: .month, value: delta, to: inicio)
        else { return }
        mesExibido = novo
    }
}
