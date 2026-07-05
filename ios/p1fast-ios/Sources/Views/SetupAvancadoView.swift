// ═══════════════════════════════════════════════════════════
// SetupAvancadoView — visualização agrupada dos 14 overrides
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #22. Mesma data que o CarroModalView edita
// (configuracoes.overrides JSON via CarroSetupOverrides), mas em
// modo focado: 5 grupos (PNEUS / ALINHAMENTO / SUSPENSÃO / FREIOS /
// MOTOR · TRANSMISSÃO) com tipografia 18pt e setas de navegação
// entre grupos via scroll-to-anchor. Footer Cancelar/Salvar segue
// padrão dos outros forms.
//
// Dados: lê e escreve o mesmo `configuracoes.overrides` que o modal
// inline (via CarroRepository.loadConfiguracao + saveOverrides). Não
// duplica modelo nem persistência.

import SwiftUI
import P1FastCore

struct SetupAvancadoView: View {
    let carroId: String
    let onClose: () -> Void

    @EnvironmentObject private var repo: CarroRepository

    @State private var setup: CarroSetupOverrides = .empty
    @State private var setupOriginal: CarroSetupOverrides = .empty
    @State private var savingError: String?
    @State private var isSaving = false
    @State private var loaded = false
    @State private var grupoAtivo: GrupoSetup = .pneus

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView {
                    content
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.md)
                        .padding(.bottom, 140)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color.surface)
                .onChange(of: grupoAtivo) { _, novo in
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(novo.anchorId, anchor: .top)
                    }
                }
            }

            FootBar(
                onCancel: onClose,
                onSave: salvar,
                saveLabel: "Salvar setup",
                canSave: !isSaving && setup != setupOriginal
            )
        }
        .preferredColorScheme(.dark)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            header
            navegador
            grupoSection(.pneus)
            grupoSection(.alinhamento)
            grupoSection(.suspensao)
            grupoSection(.freios)
            grupoSection(.motorTransmissao)
            grupoSection(.alertas)

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
            Eyebrow(text: "Setup avançado")
            Text(carroApelido)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("24 ajustes em 6 grupos. Use as setas pra pular entre grupos.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var carroApelido: String {
        repo.carros.first(where: { $0.id == carroId })?.apelido ?? "Setup"
    }

    /// Barra de navegação superior: seta esquerda + grupo atual + seta direita.
    /// Tap nos extremos cicla. Dot indicator embaixo mostra posição (1..5).
    private var navegador: some View {
        VStack(spacing: 8) {
            HStack {
                Button(action: irAnterior) {
                    Text("‹")
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(grupoAtivo == .pneus ? Color.textFaint : Color.text)
                        .frame(width: 36, height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.surfaceRaised)
                        )
                }
                .buttonStyle(.plain)
                .disabled(grupoAtivo == .pneus)

                Spacer(minLength: 0)
                VStack(spacing: 2) {
                    Text(grupoAtivo.eyebrow)
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.22 * 11)
                        .foregroundStyle(Color.textFaint)
                    Text(grupoAtivo.titulo)
                        .font(.system(size: 18, weight: .semibold))
                        .tracking(-0.45)
                        .foregroundStyle(Color.text)
                }
                Spacer(minLength: 0)

                Button(action: irProximo) {
                    Text("›")
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(grupoAtivo == .alertas ? Color.textFaint : Color.text)
                        .frame(width: 36, height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.surfaceRaised)
                        )
                }
                .buttonStyle(.plain)
                .disabled(grupoAtivo == .alertas)
            }

            HStack(spacing: 6) {
                ForEach(GrupoSetup.allCases) { g in
                    Circle()
                        .fill(g == grupoAtivo ? Color.accent : Color.border)
                        .frame(width: 6, height: 6)
                }
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func grupoSection(_ g: GrupoSetup) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(g.titulo.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .tracking(0.06 * 13)
                .foregroundStyle(Color.text)
            switch g {
            case .pneus:
                pneusFields
            case .alinhamento:
                alinhamentoFields
            case .suspensao:
                suspensaoFields
            case .freios:
                freiosFields
            case .motorTransmissao:
                motorFields
            case .alertas:
                alertasFields
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .id(g.anchorId)
    }

    // MARK: - Fields por grupo (4+3+3+1+3 = 14)

    private var pneusFields: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                fieldNumber("Dianteiro esquerdo", value: $setup.pressaoDE, suffix: "psi")
                fieldNumber("Dianteiro direito", value: $setup.pressaoDD, suffix: "psi")
            }
            HStack(spacing: Spacing.sm) {
                fieldNumber("Traseiro esquerdo", value: $setup.pressaoTE, suffix: "psi")
                fieldNumber("Traseiro direito", value: $setup.pressaoTD, suffix: "psi")
            }
        }
    }

    private var alinhamentoFields: some View {
        VStack(spacing: Spacing.sm) {
            fieldNumber("Cambagem dianteira", value: $setup.cambagemDianteira, suffix: "°")
            fieldNumber("Cambagem traseira", value: $setup.cambagemTraseira, suffix: "°")
            fieldNumber("Convergência traseira", value: $setup.convergenciaTraseira, suffix: "mm")
        }
    }

    private var suspensaoFields: some View {
        VStack(spacing: Spacing.sm) {
            fieldNumber("Mola dianteira", value: $setup.molaDianteira, suffix: "lb/in")
            fieldNumber("Mola traseira", value: $setup.molaTraseira, suffix: "lb/in")
            fieldNumber("Altura dianteira", value: $setup.alturaDianteira, suffix: "mm")
        }
    }

    private var freiosFields: some View {
        VStack(spacing: Spacing.sm) {
            fieldNumber("Bias dianteiro", value: $setup.biasFreioDianteiro, suffix: "%")
        }
    }

    private var motorFields: some View {
        VStack(spacing: Spacing.sm) {
            fieldText("Combustível", value: $setup.combustivel, placeholder: "Ex: Etanol")
            fieldText("Mapa de injeção", value: $setup.mapaInjecao, placeholder: "Ex: Mapa 2 - pista")
            fieldText("Diferencial", value: $setup.diferencial, placeholder: "Ex: 60% trava")
        }
    }

    /// Limites de alerta DESTE carro (Flávio 05/07, item 4 da Fase 2). Vazio = usa o padrão do
    /// sistema; o cérebro do cockpit (notebook) lê estes valores ao abrir a sessão do carro.
    private var alertasFields: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Deixe vazio pra usar o padrão do sistema. Cada carro tem os seus.")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textMuted)

            alertaSub("Motor")
            fieldNumber("Motor Quente (trava)", value: $setup.alertaMotorQuenteC, suffix: "°C")
            HStack(spacing: Spacing.sm) {
                fieldNumber("Referência normal", value: $setup.alertaMotorReferenciaC, suffix: "°C")
                fieldNumber("Avisa acima de", value: $setup.alertaMotorDeltaC, suffix: "+°C")
            }

            alertaSub("Mistura")
            HStack(spacing: Spacing.sm) {
                fieldNumber("Pobre acima de", value: $setup.alertaLambdaPobre, suffix: "λ")
                fieldNumber("Rica abaixo de", value: $setup.alertaLambdaRica, suffix: "λ")
            }

            alertaSub("Bateria")
            fieldNumber("Tensão mínima", value: $setup.alertaBateriaMinV, suffix: "V")

            alertaSub("Pneu · radial 185")
            HStack(spacing: Spacing.sm) {
                fieldNumber("Atenção", value: $setup.alertaPneuRadialAtencaoC, suffix: "°C")
                fieldNumber("Crítico", value: $setup.alertaPneuRadialCriticoC, suffix: "°C")
            }

            alertaSub("Pneu · semi-slick 195")
            HStack(spacing: Spacing.sm) {
                fieldNumber("Atenção", value: $setup.alertaPneuSlickAtencaoC, suffix: "°C")
                fieldNumber("Crítico", value: $setup.alertaPneuSlickCriticoC, suffix: "°C")
            }
        }
    }

    /// Mini-rótulo de sub-grupo dentro de Alertas (Motor / Mistura / Bateria / Pneu).
    private func alertaSub(_ t: String) -> some View {
        Text(t.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.08 * 11)
            .foregroundStyle(Color.textFaint)
            .padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Helpers de campos (tipografia 18pt vs 16pt do modal inline)

    private func fieldNumber(_ label: String, value: Binding<Double?>, suffix: String) -> some View {
        let proxy = Binding<String>(
            get: { value.wrappedValue.map { Self.formatDouble($0) } ?? "" },
            set: { txt in
                let normalized = txt.replacingOccurrences(of: ",", with: ".")
                value.wrappedValue = normalized.isEmpty ? nil : Double(normalized)
            }
        )
        return VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.textMuted)
            HStack(spacing: 6) {
                TextField("—", text: proxy)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.plain)
                    .font(.system(size: 18, weight: .semibold))
                    .tracking(-0.09)
                    .foregroundStyle(Color.text)
                Text(suffix)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func fieldText(_ label: String, value: Binding<String?>, placeholder: String) -> some View {
        let proxy = Binding<String>(
            get: { value.wrappedValue ?? "" },
            set: { value.wrappedValue = $0.isEmpty ? nil : $0 }
        )
        return VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.textMuted)
            TextField(placeholder, text: proxy, prompt: Text(placeholder).foregroundStyle(Color.textFaint))
                .textFieldStyle(.plain)
                .font(.system(size: 18, weight: .semibold))
                .tracking(-0.09)
                .foregroundStyle(Color.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.surfaceHover)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func formatDouble(_ v: Double) -> String {
        if v == v.rounded() { return String(format: "%.0f", v) }
        return String(format: "%.2f", v).replacingOccurrences(of: ".", with: ",")
    }

    // MARK: - Navegação

    private func irAnterior() {
        let i = GrupoSetup.allCases.firstIndex(of: grupoAtivo) ?? 0
        if i > 0 { grupoAtivo = GrupoSetup.allCases[i - 1] }
    }

    private func irProximo() {
        let i = GrupoSetup.allCases.firstIndex(of: grupoAtivo) ?? 0
        let n = GrupoSetup.allCases.count
        if i < n - 1 { grupoAtivo = GrupoSetup.allCases[i + 1] }
    }

    // MARK: - Persistência

    private func load() async {
        guard !loaded else { return }
        do {
            if let cfg = try await repo.loadConfiguracao(carroId: carroId) {
                setup = CarroSetupOverrides.decode(from: cfg.overrides)
                setupOriginal = setup
            }
            loaded = true
        } catch {
            savingError = "Não consegui carregar setup: \(error.localizedDescription)"
        }
    }

    private func salvar() {
        guard !isSaving else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                try await repo.saveOverrides(carroId: carroId, overridesJSON: setup.encodedJSON())
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Enum dos 5 grupos canônicos

enum GrupoSetup: String, CaseIterable, Identifiable {
    case pneus, alinhamento, suspensao, freios, motorTransmissao, alertas
    var id: String { rawValue }

    var titulo: String {
        switch self {
        case .pneus: return "Pneus"
        case .alinhamento: return "Alinhamento"
        case .suspensao: return "Suspensão"
        case .freios: return "Freios"
        case .motorTransmissao: return "Motor · Transmissão"
        case .alertas: return "Alertas"
        }
    }

    var eyebrow: String {
        switch self {
        case .pneus: return "Grupo 1 de 6"
        case .alinhamento: return "Grupo 2 de 6"
        case .suspensao: return "Grupo 3 de 6"
        case .freios: return "Grupo 4 de 6"
        case .motorTransmissao: return "Grupo 5 de 6"
        case .alertas: return "Grupo 6 de 6"
        }
    }

    var anchorId: String { "grupo-\(rawValue)" }
}

// MARK: - Preview

#Preview("SetupAvancadoView") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CarroRepository(queue: queue)
    return SetupAvancadoView(carroId: "preview", onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
