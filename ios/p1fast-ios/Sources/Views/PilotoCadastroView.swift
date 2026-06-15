// ═══════════════════════════════════════════════════════════
// PilotoCadastroView — port reduzido de mockup-piloto-cadastro.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.4 — Prompt #18. Form com `nome` + 3 campos opcionais
// (altura/peso/nascimento) que entraram no schema v2a (#16). Os 3
// opcionais aceitam vazio (NULL no banco). Quando preenchidos, valida
// com range do mockup canônico (altura 100-230, peso 30-200,
// nascimento 1900-hoje); inválido = border vermelho + msg inline +
// bloqueia o submit. Vazio = sempre válido.
//
// Modo edit: hidrata os 4 campos; NULL no banco vira input vazio
// (não chuta default). Salva tanto via create() (novo) quanto via
// update() (existente, mexendo na struct Piloto direto).
//
// Visual herda do mockup: eyebrow + título + label + input + FootBar.
// Botão "Apagar piloto" ghost vermelho aparece só em modo edit.

import SwiftUI
import P1FastCore

struct PilotoCadastroView: View {
    @EnvironmentObject private var repo: PilotoRepository
    let pilotoToEdit: Piloto?
    let onClose: () -> Void

    init(pilotoToEdit: Piloto? = nil, onClose: @escaping () -> Void) {
        self.pilotoToEdit = pilotoToEdit
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

    private var isEditing: Bool { pilotoToEdit != nil }

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
                saveLabel: isEditing ? "Salvar alterações" : "Salvar piloto",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .task { hydrateFromExisting() }
        .alert("Apagar piloto?", isPresented: $showDeleteAlert) {
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
                Eyebrow(text: isEditing ? "Editar piloto" : "Novo piloto")
                Text(isEditing ? "Editar piloto" : "Cadastrar piloto")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text(isEditing ? "Atualize os dados ou apague o cadastro." : "Fica salvo pra próximos stints.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Nome do piloto", isFocus: !isEditing)
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
                DeleteCadastroButton(label: "Apagar piloto") {
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

    /// Mínimo aceito pra DatePicker: 1900-01-01 UTC. Retro-compatível com
    /// pessoas mais velhas; valor abaixo disso indica dado errado.
    private static let dataMinimaNascimento: Date = {
        var c = DateComponents()
        c.year = 1900; c.month = 1; c.day = 1
        return Calendar(identifier: .gregorian).date(from: c) ?? Date(timeIntervalSince1970: 0)
    }()

    // MARK: - Hidratação

    private func hydrateFromExisting() {
        guard !hydrated, let p = pilotoToEdit else { return }
        nome = p.nome
        alturaText = p.alturaCm.map(String.init) ?? ""
        pesoText = p.pesoKg.map { Self.formatPeso($0) } ?? ""
        if let nasc = p.nascimento {
            temNascimento = true
            nascimentoDate = Date(timeIntervalSince1970: TimeInterval(nasc) / 1000)
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

    /// Lê os 3 campos opcionais e devolve em formato pronto pro repo.
    /// Vazio → `nil`. Não-numérico → `nil` (validação já barrou via canSave).
    private func extrairOpcionais() -> (altura: Int?, peso: Double?, nascimento: Int64?) {
        let alturaTrim = alturaText.trimmingCharacters(in: .whitespaces)
        let altura: Int? = alturaTrim.isEmpty ? nil : Int(alturaTrim)

        let pesoTrim = pesoText.trimmingCharacters(in: .whitespaces)
        let pesoNorm = pesoTrim.replacingOccurrences(of: ",", with: ".")
        let peso: Double? = pesoTrim.isEmpty ? nil : Double(pesoNorm)

        let nascimento: Int64? = temNascimento ? Self.toEpochUtcMidnight(nascimentoDate) : nil
        return (altura, peso, nascimento)
    }

    /// Converte uma `Date` em ms epoch desde 1970-01-01 00:00:00 UTC,
    /// truncando pro início do dia em UTC. Spec do schema: nascimento é o
    /// dia, não o instante — sem hora, sem timezone do device. ms (não
    /// segundos) pra bater com o resto dos timestamps do app, e pra Edge
    /// Function `coerceTimestamps` interpretar corretamente em
    /// `new Date(v).toISOString()`.
    private static func toEpochUtcMidnight(_ date: Date) -> Int64 {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? TimeZone(secondsFromGMT: 0)!
        let utcMidnight = calendar.startOfDay(for: date)
        return Int64(utcMidnight.timeIntervalSince1970 * 1000)
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
                if var existing = pilotoToEdit {
                    existing.nome = trimmed
                    existing.alturaCm = altura
                    existing.pesoKg = peso
                    existing.nascimento = nascimento
                    try await repo.update(piloto: existing)
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
        guard let p = pilotoToEdit else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.arquivar(pilotoId: p.id, rotulo: p.nome)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Sub-componentes locais

/// Botão "Apagar X" full-width estilo ghost vermelho. Usado no rodapé
/// das views de cadastro quando abertas em modo edit. Sem fill, só
/// border + texto na cor de erro. Não é destrutivo direto: dispara um
/// alert antes (pattern padrão dos 4 CRUDs do Sprint 1A.3).
struct DeleteCadastroButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.07)
                .foregroundStyle(Color.erro)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.erro.opacity(0.5), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

/// Texto de erro inline embaixo de FormInput. Cor `.erro`, tamanho menor.
struct InlineErro: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(Color.erro)
            .padding(.horizontal, 4)
    }
}

#Preview("PilotoCadastroView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PilotoRepository(queue: queue)
    return PilotoCadastroView(onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}

#Preview("PilotoCadastroView — edit") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = PilotoRepository(queue: queue)
    let mock = Piloto(
        id: "preview-piloto",
        timeId: "preview-team",
        nome: "Flavio Marx",
        alturaCm: 178,
        pesoKg: 75.5,
        nascimento: Int64(Date(timeIntervalSince1970: -915148800).timeIntervalSince1970 * 1000)  // 1941-01-01 plausível (ms)
    )
    return PilotoCadastroView(pilotoToEdit: mock, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
