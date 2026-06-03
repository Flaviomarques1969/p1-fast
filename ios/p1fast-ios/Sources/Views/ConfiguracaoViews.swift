// ═══════════════════════════════════════════════════════════
// ConfiguracaoViews — Cadastro de Configuração do carro
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). 2 telas:
//   • ConfiguracaoListaView — lista de configurações de um carro,
//     ativar/duplicar/apagar, FAB "+ Nova"
//   • ConfiguracaoFormView — cadastro/edição (motor, pneus, tipo,
//     câmbio, 3 marcadores de aero, nome livre)
//
// Decisões aplicadas:
//   A1: 5 elementos + AERO (assoalho reto / difusor / splitter).
//   A2 + Q1: várias configs cadastradas; uma é "atual"; troca pela
//            tela do carro OU antes do stint.
//   A3: histórico vivo — apagar pede confirmação se há voltas vinculadas.
//   A4: nome manual livre.

import SwiftUI
import P1FastCore

// ═══════════════════════════════════════════════════════════
// MARK: - ConfiguracaoListaView
// ═══════════════════════════════════════════════════════════

struct ConfiguracaoListaView: View {
    @EnvironmentObject private var repo: ConfiguracaoRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    let carroId: String
    let onClose: () -> Void

    @State private var sheet: ConfiguracaoSheet?
    @State private var pedirApagar: Configuracao?
    @State private var voltasVinculadasMsg: String?

    enum ConfiguracaoSheet: Identifiable {
        case nova(baseDe: Configuracao?)
        case editar(Configuracao)
        var id: String {
            switch self {
            case .nova(let base): return "nova-\(base?.id ?? "_")"
            case .editar(let c):  return "editar-\(c.id)"
            }
        }
    }

    private var carro: Carro? {
        carroRepo.carros.first { $0.id == carroId }
    }

    private var lista: [Configuracao] {
        repo.paraCarro(carroId)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                conteudo
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FAB("Nova configuração") {
                sheet = .nova(baseDe: nil)
            }
            .padding(.trailing, Spacing.md)
            // 2026-05-17 (Flávio): 110 pt sobe o botão pra cima do
            // menu fixo embaixo.
            .padding(.bottom, 110)
        }
        .navigationTitle("Configurações")
        .navigationBarTitleDisplayMode(.inline)
        // 2026-05-17: back nativo do iOS aparece automaticamente.
        // Button("Fechar") removido — era usado quando esta tela era
        // janela modal.
        .preferredColorScheme(.dark)
        .sheet(item: $sheet) { which in
            NavigationStack {
                switch which {
                case .nova(let base):
                    ConfiguracaoFormView(
                        carroId: carroId,
                        modo: base.map { .duplicar($0) } ?? .nova,
                        onClose: { sheet = nil }
                    )
                case .editar(let cfg):
                    ConfiguracaoFormView(
                        carroId: carroId,
                        modo: .editar(cfg),
                        onClose: { sheet = nil }
                    )
                }
            }
        }
        .alert(item: $pedirApagar) { cfg in
            Alert(
                title: Text("Apagar configuração?"),
                message: Text(voltasVinculadasMsg ?? "Esta configuração será removida."),
                primaryButton: .destructive(Text("Apagar")) {
                    Task { try? await repo.apagar(cfg) }
                },
                secondaryButton: .cancel(Text("Manter"))
            )
        }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            cabecalho
            if lista.isEmpty {
                emptyState
            } else {
                VStack(spacing: 10) {
                    ForEach(lista, id: \.id) { cfg in
                        cardConfiguracao(cfg)
                    }
                }
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Configurações")
            Text(carro?.apelido ?? "Carro")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSub)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    private var headerSub: String {
        let n = lista.count
        if n == 0 { return "Sem configuração cadastrada. Toque em 'Nova configuração' pra começar." }
        if n == 1 { return "1 configuração cadastrada" }
        return "\(n) configurações cadastradas"
    }

    private var emptyState: some View {
        Text("Sem configurações cadastradas. Use o botão 'Nova configuração' pra adicionar a primeira.")
            .font(.system(size: 14))
            .foregroundStyle(Color.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
    }

    @ViewBuilder
    private func cardConfiguracao(_ cfg: Configuracao) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(cfg.nome?.isEmpty == false ? cfg.nome! : cfg.resumoLegivel)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.text)
                        if cfg.ativa {
                            EventTag(text: "Atual", kind: .accent)
                        }
                    }
                    Text(detalhesLinha(cfg))
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                }
                Spacer(minLength: 0)
            }
            if !cfg.aeroAtivos.isEmpty {
                HStack(spacing: 6) {
                    ForEach(cfg.aeroAtivos, id: \.self) { tag in
                        Text(tag)
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.6)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(Color.surfaceHover)
                            )
                            .foregroundStyle(Color.textMuted)
                    }
                }
            }
            HStack(spacing: 8) {
                if !cfg.ativa {
                    botaoCard(label: "Marcar como atual") {
                        Task { try? await repo.marcarComoAtiva(cfg) }
                    }
                }
                botaoCard(label: "Editar") {
                    sheet = .editar(cfg)
                }
                botaoCard(label: "Duplicar") {
                    sheet = .nova(baseDe: cfg)
                }
                botaoCard(label: "Apagar", destrutivo: true) {
                    Task { await pedirConfirmacaoApagar(cfg) }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(cfg.ativa ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(cfg.ativa ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
        )
    }

    private func detalhesLinha(_ cfg: Configuracao) -> String {
        var partes: [String] = []
        if let m = cfg.motor?.trimmingCharacters(in: .whitespaces), !m.isEmpty {
            partes.append(m)
        }
        if let tipo = cfg.tipoPneuEnum {
            if let medida = cfg.pneusMedida, !medida.isEmpty {
                partes.append("\(tipo.legivel) · \(medida)")
            } else {
                partes.append(tipo.legivel)
            }
        }
        if let c = cfg.cambio, !c.isEmpty {
            partes.append(c)
        }
        return partes.isEmpty ? "Sem detalhes" : partes.joined(separator: " · ")
    }

    private func botaoCard(label: String, destrutivo: Bool = false,
                           action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(destrutivo ? Color.erro : Color.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
    }

    private func pedirConfirmacaoApagar(_ cfg: Configuracao) async {
        let n = (try? await repo.voltasVinculadas(cfg.id)) ?? 0
        if n > 0 {
            voltasVinculadasMsg = "Essa configuração tem \(n) volta\(n == 1 ? "" : "s") vinculada\(n == 1 ? "" : "s"). Se apagar, as voltas ficam sem configuração registrada (mas continuam guardadas). Apagar mesmo assim?"
        } else {
            voltasVinculadasMsg = "Esta configuração será removida. Como nenhuma volta está vinculada a ela, não tem impacto no histórico."
        }
        pedirApagar = cfg
    }
}

extension Configuracao: Identifiable {}

// ═══════════════════════════════════════════════════════════
// MARK: - ConfiguracaoFormView
// ═══════════════════════════════════════════════════════════

struct ConfiguracaoFormView: View {
    @EnvironmentObject private var repo: ConfiguracaoRepository
    let carroId: String
    let modo: Modo
    let onClose: () -> Void

    enum Modo {
        case nova
        case duplicar(Configuracao)
        case editar(Configuracao)
    }

    @State private var nome: String = ""
    @State private var motor: String = ""
    @State private var pneusMedida: String = ""
    @State private var pneusMarca: String = ""
    @State private var tipoPneu: TipoPneu? = nil
    @State private var cambio: String = ""
    @State private var aeroAssoalhoReto: Bool = false
    @State private var aeroDifusor: Bool = false
    @State private var aeroSplitter: Bool = false
    @State private var marcarComoAtiva: Bool = true
    @State private var isSaving = false
    @State private var savingError: String?

    private var titulo: String {
        switch modo {
        case .nova:      return "Nova configuração"
        case .duplicar:  return "Duplicar configuração"
        case .editar:    return "Editar configuração"
        }
    }

    private var podeSalvar: Bool {
        !nome.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                conteudo
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 160)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: salvar,
                saveLabel: "Salvar",
                canSave: podeSalvar,
                isSaving: isSaving
            )
        }
        .navigationTitle(titulo)
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .onAppear(perform: preencher)
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: titulo)
                Text("Setup deste stint")
                    .font(.system(size: 22, weight: .semibold))
                    .tracking(-0.55)
                    .foregroundStyle(Color.text)
                Text("Mude qualquer item — motor, pneu, tipo, câmbio ou aero — e isso já conta como configuração diferente.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Nome da configuração") {
                FormInput(text: $nome, placeholder: "Ex.: Setup chuva 1 · Classificação")
            }

            FormField(label: "Motor", small: "opcional") {
                FormInput(text: $motor, placeholder: "Ex.: 1.4 standard")
            }

            FormField(label: "Câmbio", small: "opcional") {
                FormInput(text: $cambio, placeholder: "Ex.: 5 marchas H")
            }

            FormField(label: "Tipo de pneu") {
                tipoPneuPicker
            }

            FormField(label: "Medida do pneu", small: "opcional") {
                FormInput(text: $pneusMedida, placeholder: "Ex.: 295/30 R18")
            }

            FormField(label: "Marca do pneu", small: "opcional") {
                FormInput(text: $pneusMarca, placeholder: "Ex.: Maxxis")
            }

            FormField(label: "Aero") {
                aeroToggles
            }

            FormField(label: "Marcar como atual deste carro") {
                Toggle("", isOn: $marcarComoAtiva)
                    .labelsHidden()
                    .tint(Color.accent)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "A configuração marcada como 'atual' aparece pré-selecionada quando você for iniciar um stint deste carro. Você pode trocar antes de começar o stint.")
                .padding(.top, Spacing.sm)
        }
    }

    private var tipoPneuPicker: some View {
        HStack(spacing: 8) {
            ForEach(TipoPneu.allCases, id: \.self) { tipo in
                Button {
                    tipoPneu = tipoPneu == tipo ? nil : tipo
                } label: {
                    Text(tipo.legivel)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(tipoPneu == tipo ? Color.onAccent : Color.text)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(tipoPneu == tipo ? Color.accent : Color.surfaceRaised)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(tipoPneu == tipo ? Color.accent : Color.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var aeroToggles: some View {
        VStack(spacing: 8) {
            aeroLinha(label: "Assoalho reto", isOn: $aeroAssoalhoReto)
            aeroLinha(label: "Difusor", isOn: $aeroDifusor)
            aeroLinha(label: "Splitter", isOn: $aeroSplitter)
        }
    }

    private func aeroLinha(label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(Color.text)
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Color.accent)
        }
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

    private func preencher() {
        switch modo {
        case .nova:
            break
        case .duplicar(let cfg):
            let baseNome = (cfg.nome?.trimmingCharacters(in: .whitespaces).isEmpty == false)
                ? cfg.nome! : cfg.resumoLegivel
            nome = "\(baseNome) (cópia)"
            motor = cfg.motor ?? ""
            pneusMedida = cfg.pneusMedida ?? ""
            pneusMarca = cfg.pneusMarca ?? ""
            tipoPneu = cfg.tipoPneuEnum
            cambio = cfg.cambio ?? ""
            aeroAssoalhoReto = cfg.aeroAssoalhoReto
            aeroDifusor = cfg.aeroDifusor
            aeroSplitter = cfg.aeroSplitter
            marcarComoAtiva = false
        case .editar(let cfg):
            nome = cfg.nome ?? ""
            motor = cfg.motor ?? ""
            pneusMedida = cfg.pneusMedida ?? ""
            pneusMarca = cfg.pneusMarca ?? ""
            tipoPneu = cfg.tipoPneuEnum
            cambio = cfg.cambio ?? ""
            aeroAssoalhoReto = cfg.aeroAssoalhoReto
            aeroDifusor = cfg.aeroDifusor
            aeroSplitter = cfg.aeroSplitter
            marcarComoAtiva = cfg.ativa
        }
    }

    private func salvar() {
        let nomeTrim = nome.trimmingCharacters(in: .whitespaces)
        guard !nomeTrim.isEmpty else { return }
        isSaving = true
        savingError = nil
        Task {
            do {
                switch modo {
                case .nova, .duplicar:
                    _ = try await repo.criar(
                        carroId: carroId,
                        nome: nomeTrim,
                        motor: motor.trimmingCharacters(in: .whitespaces).isEmpty ? nil : motor.trimmingCharacters(in: .whitespaces),
                        pneusMedida: pneusMedida.trimmingCharacters(in: .whitespaces).isEmpty ? nil : pneusMedida.trimmingCharacters(in: .whitespaces),
                        pneusMarca: pneusMarca.trimmingCharacters(in: .whitespaces).isEmpty ? nil : pneusMarca.trimmingCharacters(in: .whitespaces),
                        tipoPneu: tipoPneu,
                        cambio: cambio.trimmingCharacters(in: .whitespaces).isEmpty ? nil : cambio.trimmingCharacters(in: .whitespaces),
                        aeroAssoalhoReto: aeroAssoalhoReto,
                        aeroDifusor: aeroDifusor,
                        aeroSplitter: aeroSplitter,
                        marcarComoAtiva: marcarComoAtiva
                    )
                case .editar(let cfg):
                    try await repo.atualizar(
                        cfg,
                        nome: nomeTrim,
                        motor: motor.trimmingCharacters(in: .whitespaces).isEmpty ? nil : motor.trimmingCharacters(in: .whitespaces),
                        pneusMedida: pneusMedida.trimmingCharacters(in: .whitespaces).isEmpty ? nil : pneusMedida.trimmingCharacters(in: .whitespaces),
                        pneusMarca: pneusMarca.trimmingCharacters(in: .whitespaces).isEmpty ? nil : pneusMarca.trimmingCharacters(in: .whitespaces),
                        tipoPneu: tipoPneu,
                        cambio: cambio.trimmingCharacters(in: .whitespaces).isEmpty ? nil : cambio.trimmingCharacters(in: .whitespaces),
                        aeroAssoalhoReto: aeroAssoalhoReto,
                        aeroDifusor: aeroDifusor,
                        aeroSplitter: aeroSplitter
                    )
                    if marcarComoAtiva && !cfg.ativa {
                        try await repo.marcarComoAtiva(cfg)
                    }
                }
                await MainActor.run {
                    isSaving = false
                    onClose()
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    savingError = "Não consegui salvar: \(error.localizedDescription)"
                }
            }
        }
    }
}
