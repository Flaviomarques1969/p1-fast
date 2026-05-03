// ═══════════════════════════════════════════════════════════
// CarroModalView — port de mockup-carro.html
// ═══════════════════════════════════════════════════════════
// Tela completa de edição do carro: identidade (apelido, modelo,
// categoria, cor) + setup base com 14 overrides em 5 grupos +
// seção "Pneus cadastrados" (CRUD inline — Sprint 1A.3 / Prompt #14).
//
// 14 overrides do prompt #9:
//   PNEUS (4)              — pressão DE/DD/TE/TD
//   ALINHAMENTO (3)        — cambagem D, cambagem T, convergência T
//   SUSPENSÃO (3)          — mola D, mola T, altura D
//   FREIOS (1)             — bias dianteiro
//   MOTOR · TRANSMISSÃO (3)— combustível, mapa, diferencial
//
// Persistência: identidade vai pra `carros` (tabela); overrides vão
// pra `configuracoes.overrides` como JSON (CarroSetupOverrides);
// pneus vivem em `pneus` (PneuRepository).

import SwiftUI
import P1FastCore

struct CarroModalView: View {
    @EnvironmentObject private var repo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    let carroId: String
    let initialPneuSheet: Bool
    let onClose: () -> Void

    init(carroId: String, initialPneuSheet: Bool = false, onClose: @escaping () -> Void) {
        self.carroId = carroId
        self.initialPneuSheet = initialPneuSheet
        self.onClose = onClose
    }

    @State private var loaded = false
    @State private var carro: Carro?
    @State private var pneuSheet: PneuSheetMode?

    private enum PneuSheetMode: Identifiable {
        case novo
        case editar(Pneu)

        var id: String {
            switch self {
            case .novo: return "novo"
            case .editar(let p): return "editar-\(p.id)"
            }
        }
    }

    // Identidade
    @State private var apelido: String = ""
    @State private var modelo: String = ""
    @State private var categoria: String? = nil
    @State private var corHex: String = CarroPalette.opcoes[1].hex

    // Setup overrides (14 campos)
    @State private var setup = CarroSetupOverrides.empty

    // UI state
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
                onSave: save,
                saveLabel: "Salvar",
                canSave: !apelido.isEmpty && !isSaving
            )
        }
        .preferredColorScheme(.dark)
        .task { await load() }
        .sheet(item: $pneuSheet) { mode in
            switch mode {
            case .novo:
                PneuCadastroView(
                    carroId: carroId,
                    pneuToEdit: nil,
                    onClose: { pneuSheet = nil }
                )
                .environmentObject(pneuRepo)
            case .editar(let pneu):
                PneuCadastroView(
                    carroId: carroId,
                    pneuToEdit: pneu,
                    onClose: { pneuSheet = nil }
                )
                .environmentObject(pneuRepo)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            header

            sectionIdentidade
            sectionPneus
            sectionAlinhamento
            sectionSuspensao
            sectionFreios
            sectionMotorTransmissao
            sectionPneusCadastrados

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Editar carro")
            Text(apelido.isEmpty ? "Carro" : apelido)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("Setup base · usado em todos os stints (cada stint pode sobrescrever).")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    // MARK: Sections

    private var sectionIdentidade: some View {
        sectionFrame(title: "Identidade") {
            FormField(label: "Apelido") {
                FormInput(text: $apelido, placeholder: "Como você chama o carro")
            }
            FormField(label: "Modelo", small: "opcional") {
                FormInput(text: $modelo, placeholder: "Marca + ano")
            }
            FormField(label: "Categoria") {
                CategoriaPicker(selection: $categoria)
            }
            FormField(label: "Cor") {
                CorPicker(selection: $corHex)
            }
        }
    }

    private var sectionPneus: some View {
        sectionFrame(title: "Pneus") {
            FormField(label: "Pressão (saída box, PSI)") {
                VStack(spacing: Spacing.sm) {
                    HStack(spacing: Spacing.sm) {
                        WheelInput(label: "Diant. esq.", value: $setup.pressaoDE)
                        WheelInput(label: "Diant. dir.", value: $setup.pressaoDD)
                    }
                    HStack(spacing: Spacing.sm) {
                        WheelInput(label: "Tras. esq.", value: $setup.pressaoTE)
                        WheelInput(label: "Tras. dir.", value: $setup.pressaoTD)
                    }
                }
            }
        }
    }

    private var sectionAlinhamento: some View {
        sectionFrame(title: "Alinhamento") {
            FormField(label: "Cambagem dianteira (°)") {
                WheelInput(label: nil, value: $setup.cambagemDianteira)
            }
            FormField(label: "Cambagem traseira (°)") {
                WheelInput(label: nil, value: $setup.cambagemTraseira)
            }
            FormField(label: "Convergência traseira (mm)", small: "positivo = aberto") {
                WheelInput(label: nil, value: $setup.convergenciaTraseira)
            }
        }
    }

    private var sectionSuspensao: some View {
        sectionFrame(title: "Suspensão") {
            FormField(label: "Mola dianteira (kg/mm)") {
                WheelInput(label: nil, value: $setup.molaDianteira)
            }
            FormField(label: "Mola traseira (kg/mm)") {
                WheelInput(label: nil, value: $setup.molaTraseira)
            }
            FormField(label: "Altura dianteira (mm — ride height)") {
                WheelInput(label: nil, value: $setup.alturaDianteira)
            }
        }
    }

    private var sectionFreios: some View {
        sectionFrame(title: "Freios") {
            FormField(label: "Bias de freio (% F)") {
                WheelInput(label: nil, value: $setup.biasFreioDianteiro)
            }
        }
    }

    private var sectionMotorTransmissao: some View {
        sectionFrame(title: "Motor · transmissão") {
            FormField(label: "Combustível") {
                FormInput(
                    text: Binding(get: { setup.combustivel ?? "" }, set: { setup.combustivel = $0.isEmpty ? nil : $0 }),
                    placeholder: "Gasolina aditivada"
                )
            }
            FormField(label: "Mapa / injeção") {
                FormInput(
                    text: Binding(get: { setup.mapaInjecao ?? "" }, set: { setup.mapaInjecao = $0.isEmpty ? nil : $0 }),
                    placeholder: "Ex: T4000 — mapa seco-1"
                )
            }
            FormField(label: "Diferencial") {
                FormInput(
                    text: Binding(get: { setup.diferencial ?? "" }, set: { setup.diferencial = $0.isEmpty ? nil : $0 }),
                    placeholder: "Aberto / autoblocante / ratchet"
                )
            }
        }
    }

    private var sectionPneusCadastrados: some View {
        sectionFrame(title: "Pneus cadastrados") {
            let pneus = pneuRepo.pneusByCarroId[carroId] ?? []
            VStack(spacing: Spacing.sm) {
                if pneus.isEmpty {
                    EmptyTireHint()
                } else {
                    ForEach(pneus, id: \.id) { pneu in
                        TireItem(pneu: pneu) {
                            pneuSheet = .editar(pneu)
                        }
                    }
                }
                AddTireButton { pneuSheet = .novo }
            }
        }
    }

    @ViewBuilder
    private func sectionFrame<C: View>(title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32) // 0.12em em 11pt
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)
            VStack(alignment: .leading, spacing: 14) { content() }
        }
    }

    // MARK: Persist load + save

    private func load() async {
        guard !loaded else { return }
        loaded = true
        // Identidade
        if let row = repo.carros.first(where: { $0.id == carroId }) {
            self.carro = row
            self.apelido = row.apelido
            self.modelo = row.modelo ?? ""
            self.categoria = row.categoria
            if let hex = row.cor { self.corHex = hex }
        }
        // Setup overrides
        do {
            if let cfg = try await repo.loadConfiguracao(carroId: carroId) {
                self.setup = CarroSetupOverrides.decode(from: cfg.overrides)
            }
        } catch {
            // Silencioso — UI mostra empty defaults.
            print("CarroModalView.load configuracao failed: \(error)")
        }
        if initialPneuSheet {
            // Pequeno delay pra view terminar de montar antes da sheet.
            try? await Task.sleep(nanoseconds: 200_000_000)
            pneuSheet = .novo
        }
    }

    private func save() {
        guard !apelido.isEmpty, var current = carro else { return }
        isSaving = true
        savingError = nil
        current.apelido = apelido.trimmingCharacters(in: .whitespaces)
        current.modelo = trimmedOrNil(modelo)
        current.categoria = categoria
        current.cor = corHex
        let json = setup.encodedJSON()
        Task {
            do {
                try await repo.update(carro: current)
                try await repo.saveOverrides(carroId: carroId, overridesJSON: json)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func trimmedOrNil(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }
}

// MARK: - Helpers de input

private struct WheelInput: View {
    let label: String?
    @Binding var value: Double?

    var body: some View {
        VStack(alignment: .center, spacing: 5) {
            if let label {
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Color.textFaint)
            }
            TextField("", text: textBinding, prompt: Text("—").foregroundStyle(Color.textFaint))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 16, weight: .medium, design: .default))
                .monospacedDigit()
                .foregroundStyle(Color.text)
                .padding(.vertical, 13)
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity)
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

    private var textBinding: Binding<String> {
        Binding(
            get: {
                guard let v = value else { return "" }
                return formatDouble(v)
            },
            set: { newText in
                let clean = newText.replacingOccurrences(of: ",", with: ".")
                if clean.isEmpty {
                    value = nil
                } else if let n = Double(clean) {
                    value = n
                }
            }
        )
    }

    private func formatDouble(_ d: Double) -> String {
        if d.truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(d))
        }
        return String(format: "%.1f", d)
    }
}

private struct EmptyTireHint: View {
    var body: some View {
        Text("Nenhum pneu cadastrado pra esse carro ainda.")
            .font(.system(size: 13, weight: .regular))
            .foregroundStyle(Color.textFaint)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
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

private struct AddTireButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text("+").font(.system(size: 16, weight: .medium))
                Text("Adicionar pneu")
                    .font(.system(size: 13, weight: .semibold))
                    .tracking(-0.065)
            }
            .foregroundStyle(Color.textMuted)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(Color.border, style: StrokeStyle(lineWidth: 1, dash: [4]))
            )
        }
        .buttonStyle(.plain)
    }
}

private struct TireItem: View {
    let pneu: Pneu
    let onEdit: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(pneu.marca ?? "Pneu sem marca")
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07)
                    .foregroundStyle(Color.text)
                Text(metaLine)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: Spacing.sm)
            Button(action: onEdit) {
                Text("Editar")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(-0.06)
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private var metaLine: String {
        var parts: [String] = []
        if let m = pneu.medida, !m.isEmpty { parts.append(m) }
        if let c = pneu.composto { parts.append(c.rawValue) }
        parts.append(pneu.ciclos == 0 ? "novo" : "\(pneu.ciclos) voltas")
        return parts.joined(separator: " · ")
    }
}
