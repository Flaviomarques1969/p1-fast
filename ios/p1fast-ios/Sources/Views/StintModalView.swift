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
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var combustivelRepo: CombustivelRepository
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

    // Sprint 1A.4 — Prompt #17. Pneu + combustível ficam no estado local
    // do modal e são persistidos via setPneu/setCombustivel após o create.
    // carroId é derivado do primeiro carro do CarroRepository (MVP — não
    // existe seletor de carro no modal v1; ver mockup-stint contextoLinha
    // que mostra o carro como parte do header informativo).
    @State private var pneuIdSelecionado: String?
    @State private var combustivelIdSelecionado: String?
    @State private var qtCombustivelTexto: String = ""
    @State private var sheet: StintModalSheet?

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
        .sheet(item: $sheet) { which in
            sheetView(for: which)
        }
    }

    @ViewBuilder
    private func sheetView(for which: StintModalSheet) -> some View {
        switch which {
        case .pneuPicker:
            PneuPickerView(
                carroId: carroIdInferido,
                stintNumero: proximoNumero,
                initialPneuId: pneuIdSelecionado,
                onCancel: { sheet = nil },
                onConfirm: { id in
                    pneuIdSelecionado = id
                    sheet = nil
                }
            )
            .environmentObject(pneuRepo)
            .environmentObject(carroRepo)
        case .combustivelPicker:
            CombustivelPickerView(
                stintNumero: proximoNumero,
                contextoSub: contextoLinha,
                initialCombustivelId: combustivelIdSelecionado,
                onCancel: { sheet = nil },
                onConfirm: { id in
                    combustivelIdSelecionado = id
                    sheet = nil
                }
            )
            .environmentObject(combustivelRepo)
        }
    }

    private var carroIdInferido: String? {
        carroRepo.carros.first?.id
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
            FormField(label: "Combustível abastecido", small: "opcional") {
                combustivelRow
            }
            FormField(label: "Pneu montado", small: "opcional") {
                pneuRow
            }
        }
    }

    // MARK: - Combustível abastecido (qty + picker)

    private var combustivelRow: some View {
        HStack(spacing: 10) {
            qtCombustivelField
                .frame(maxWidth: 110)
            combustivelPickerButton
        }
    }

    private var qtCombustivelField: some View {
        TextField("L", text: $qtCombustivelTexto, prompt: Text("L").foregroundStyle(Color.textFaint))
            .keyboardType(.decimalPad)
            .textFieldStyle(.plain)
            .font(.system(size: 16, weight: .medium))
            .tracking(-0.08)
            .foregroundStyle(Color.text)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .onChange(of: qtCombustivelTexto) { _, novo in
                qtCombustivelTexto = sanitizarLitros(novo)
            }
    }

    private var combustivelPickerButton: some View {
        Button(action: { sheet = .combustivelPicker }) {
            HStack {
                Text(combustivelLabelAtual)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(combustivelIdSelecionado == nil ? Color.textFaint : Color.text)
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
        .buttonStyle(.plain)
    }

    private var combustivelLabelAtual: String {
        guard let id = combustivelIdSelecionado,
              let c = combustivelRepo.combustiveis.first(where: { $0.id == id }) else {
            return "Escolher tipo"
        }
        return c.nome
    }

    /// Permite só dígitos + 1 ponto/vírgula com no máx 1 casa decimal.
    /// Vírgula vira ponto pra `Double(_:)` aceitar.
    private func sanitizarLitros(_ raw: String) -> String {
        let permitido = raw.replacingOccurrences(of: ",", with: ".")
        let filtrado = permitido.filter { $0.isNumber || $0 == "." }
        let partes = filtrado.split(separator: ".", omittingEmptySubsequences: false)
        if partes.count <= 1 { return String(filtrado.prefix(5)) }
        let inteiro = partes[0]
        let decimal = partes[1].prefix(1)
        return "\(inteiro).\(decimal)"
    }

    // MARK: - Pneu montado (picker)

    private var pneuRow: some View {
        Button(action: abrirPneuPicker) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pneuLabelAtual)
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(pneuIdSelecionado == nil ? Color.textFaint : Color.text)
                    if let hint = pneuHintAtual {
                        Text(hint)
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
        .buttonStyle(.plain)
    }

    private var pneuLabelAtual: String {
        guard let id = pneuIdSelecionado,
              let pneu = pneusDoCarro.first(where: { $0.id == id }) else {
            return "Escolher pneu"
        }
        return pneu.marca?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Pneu"
    }

    private var pneuHintAtual: String? {
        guard let id = pneuIdSelecionado,
              let pneu = pneusDoCarro.first(where: { $0.id == id }) else {
            return nil
        }
        var partes: [String] = []
        if let medida = pneu.medida, !medida.isEmpty { partes.append(medida) }
        if let comp = pneu.composto { partes.append(comp.rawValue) }
        return partes.isEmpty ? nil : partes.joined(separator: " · ")
    }

    private var pneusDoCarro: [Pneu] {
        guard let cid = carroIdInferido else { return [] }
        return pneuRepo.pneusByCarroId[cid] ?? []
    }

    private func abrirPneuPicker() {
        sheet = .pneuPicker
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
            pilotoId = repo.pilotos.first(where: { $0.id == PilotoRepository.pilotoFlavioId })?.id
                ?? repo.pilotos.first?.id
        }
    }

    // MARK: - Salvar

    private func salvar() {
        guard let pid = pilotoId else { return }
        isSaving = true
        savingError = nil
        let pneuParaSalvar = pneuIdSelecionado
        let combustivelParaSalvar = combustivelIdSelecionado
        let litrosParaSalvar = parseLitros(qtCombustivelTexto)
        Task {
            do {
                let stintId = try await repo.create(
                    eventoId: eventoId,
                    pilotoId: pid,
                    objetivoTipo: objetivoTipo,
                    licaoFocada: licaoFocada,
                    voltasPlanejadas: voltasPlanejadas
                )
                if pneuParaSalvar != nil {
                    try await repo.setPneu(stintId: stintId, pneuId: pneuParaSalvar)
                }
                if combustivelParaSalvar != nil || litrosParaSalvar != nil {
                    try await repo.setCombustivel(
                        stintId: stintId,
                        combustivelId: combustivelParaSalvar,
                        litros: litrosParaSalvar
                    )
                }
                isSaving = false
                onCreated(stintId)
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func parseLitros(_ texto: String) -> Double? {
        let trimmed = texto.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
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

// MARK: - Sheets enum

enum StintModalSheet: Identifiable, Equatable {
    case pneuPicker
    case combustivelPicker

    var id: String {
        switch self {
        case .pneuPicker: return "pneu-picker"
        case .combustivelPicker: return "combustivel-picker"
        }
    }
}

// MARK: - Helpers locais

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

#Preview("StintModal — preview vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let stintRepo = StintRepository(queue: queue)
    let carroRepo = CarroRepository(queue: queue)
    let pneuRepo = PneuRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    return StintModalView(
        eventoId: "preview",
        proximoNumero: 1,
        contextoLinha: "Brasília · sábado 02/05 · Celta 1.4",
        onCancel: {},
        onCreated: { _ in }
    )
    .environmentObject(stintRepo)
    .environmentObject(carroRepo)
    .environmentObject(pneuRepo)
    .environmentObject(combustivelRepo)
    .task {
        await stintRepo.bootstrap()
        await carroRepo.bootstrap()
        await pneuRepo.bootstrap()
        await combustivelRepo.bootstrap()
    }
}
