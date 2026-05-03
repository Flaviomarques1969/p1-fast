// ═══════════════════════════════════════════════════════════
// PassageiroCadastroView — port reduzido de mockup-passageiro-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.4 — Prompt #18. Mesmo padrão de PilotoCadastroView:
// `nome` + 3 opcionais (altura/peso/nascimento) que entraram no
// schema v2a (#16). Vazio = NULL no banco. Validação inline com
// border vermelho + msg quando preenchido com valor fora do range.

import SwiftUI
import P1FastCore

struct PassageiroCadastroView: View {
    @EnvironmentObject private var repo: PassageiroRepository
    let passageiroToEdit: Passageiro?
    let onClose: () -> Void

    init(passageiroToEdit: Passageiro? = nil, onClose: @escaping () -> Void) {
        self.passageiroToEdit = passageiroToEdit
        self.onClose = onClose
    }

    @State private var nome: String = ""
    @State private var alturaText: String = ""
    @State private var pesoText: String = ""
    @State private var temNascimento: Bool = false
    @State private var nascimentoDate: Date = Date()
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var hydrated = false
    @State private var showDeleteAlert = false

    private var isEditing: Bool { passageiroToEdit != nil }

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
                saveLabel: isEditing ? "Salvar alterações" : "Salvar passageiro",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar passageiro?", isPresented: $showDeleteAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDelete() }
        } message: {
            Text("Não dá pra desfazer.")
        }
    }

    private var canSave: Bool {
        !isSaving
            && !nome.trimmingCharacters(in: .whitespaces).isEmpty
            && alturaError == nil
            && pesoError == nil
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: isEditing ? "Editar passageiro" : "Novo passageiro")
                Text(isEditing ? "Editar passageiro" : "Cadastrar passageiro")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(isEditing ? "Atualize os dados ou apague o cadastro." : "Fica salvo. Próxima vez é só escolher o nome.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Nome do passageiro", isFocus: !isEditing)
            }

            FormField(label: "Altura (cm)", small: "opcional") {
                FormInput(
                    text: $alturaText,
                    placeholder: "Ex: 178",
                    keyboardType: .numberPad,
                    isError: alturaError != nil
                )
                if let erro = alturaError {
                    InlineErro(text: erro)
                }
            }

            FormField(label: "Peso (kg)", small: "opcional") {
                FormInput(
                    text: $pesoText,
                    placeholder: "Ex: 75,5",
                    keyboardType: .decimalPad,
                    isError: pesoError != nil
                )
                if let erro = pesoError {
                    InlineErro(text: erro)
                }
            }

            FormField(label: "Data de nascimento", small: "opcional") {
                Toggle("Definir data de nascimento", isOn: $temNascimento.animation(.easeInOut(duration: 0.15)))
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.text)
                    .tint(Color.accent)

                if temNascimento {
                    DatePicker(
                        "Data de nascimento",
                        selection: $nascimentoDate,
                        in: Self.dataMinimaNascimento...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .environment(\.locale, Locale(identifier: "pt_BR"))
                    .colorScheme(.dark)
                }
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            if isEditing {
                DeleteCadastroButton(label: "Apagar passageiro") {
                    showDeleteAlert = true
                }
                .padding(.top, Spacing.sm)
            }
        }
    }

    // MARK: - Validação

    private var alturaError: String? {
        let trimmed = alturaText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        guard let value = Int(trimmed), (100...230).contains(value) else {
            return "Altura parece fora do esperado (100-230 cm)."
        }
        return nil
    }

    private var pesoError: String? {
        let trimmed = pesoText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let normalized = trimmed.replacingOccurrences(of: ",", with: ".")
        guard let value = Double(normalized), (30.0...200.0).contains(value) else {
            return "Peso parece fora do esperado (30-200 kg)."
        }
        return nil
    }

    private static let dataMinimaNascimento: Date = {
        var c = DateComponents()
        c.year = 1900; c.month = 1; c.day = 1
        return Calendar(identifier: .gregorian).date(from: c) ?? Date(timeIntervalSince1970: 0)
    }()

    // MARK: - Hidratação

    private func hydrateFromExisting() {
        guard !hydrated, let p = passageiroToEdit else { return }
        nome = p.nome
        alturaText = p.alturaCm.map(String.init) ?? ""
        pesoText = p.pesoKg.map { Self.formatPeso($0) } ?? ""
        if let nasc = p.nascimento {
            temNascimento = true
            nascimentoDate = Date(timeIntervalSince1970: TimeInterval(nasc))
        } else {
            temNascimento = false
        }
        hydrated = true
    }

    private static func formatPeso(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    // MARK: - Conversão pra persistência

    private func extrairOpcionais() -> (altura: Int?, peso: Double?, nascimento: Int64?) {
        let alturaTrim = alturaText.trimmingCharacters(in: .whitespaces)
        let altura: Int? = alturaTrim.isEmpty ? nil : Int(alturaTrim)

        let pesoTrim = pesoText.trimmingCharacters(in: .whitespaces)
        let pesoNorm = pesoTrim.replacingOccurrences(of: ",", with: ".")
        let peso: Double? = pesoTrim.isEmpty ? nil : Double(pesoNorm)

        let nascimento: Int64? = temNascimento ? Self.toEpochUtcMidnight(nascimentoDate) : nil
        return (altura, peso, nascimento)
    }

    private static func toEpochUtcMidnight(_ date: Date) -> Int64 {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? TimeZone(secondsFromGMT: 0)!
        let utcMidnight = calendar.startOfDay(for: date)
        return Int64(utcMidnight.timeIntervalSince1970)
    }

    // MARK: - Ações

    private func salvar() {
        let trimmed = nome.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        isSaving = true
        savingError = nil
        let (altura, peso, nascimento) = extrairOpcionais()
        Task {
            do {
                if var existing = passageiroToEdit {
                    existing.nome = trimmed
                    existing.alturaCm = altura
                    existing.pesoKg = peso
                    existing.nascimento = nascimento
                    try await repo.update(passageiro: existing)
                } else {
                    try await repo.create(
                        nome: trimmed,
                        alturaCm: altura,
                        pesoKg: peso,
                        nascimento: nascimento
                    )
                }
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func confirmarDelete() {
        guard let p = passageiroToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.delete(passageiroId: p.id)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("PassageiroCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PassageiroRepository(queue: queue)
    return PassageiroCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}

#Preview("PassageiroCadastroView — edit") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PassageiroRepository(queue: queue)
    let mock = Passageiro(
        id: "preview-passageiro",
        timeId: PassageiroRepository.localTimeId,
        nome: "Alain Mesquita",
        alturaCm: 182,
        pesoKg: 80.0,
        nascimento: Int64(Date(timeIntervalSince1970: -315619200).timeIntervalSince1970)
    )
    return PassageiroCadastroView(passageiroToEdit: mock, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
