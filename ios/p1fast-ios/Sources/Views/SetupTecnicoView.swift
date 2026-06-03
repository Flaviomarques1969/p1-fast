// ═══════════════════════════════════════════════════════════
// SetupTecnicoView — Bloco 1 do plano Piloto + Engenheiro
// 2026-05-18 (Flávio mandou seguir após confirmação dos valores)
// ═══════════════════════════════════════════════════════════
// Formulário pra cadastrar os 9 campos novos da Configuração ativa:
//   • Relações da marcha 1..6
//   • Relação do diferencial
//   • Raio do pneu (calculado da medida 185/60 R14 ou digitado direto)
//   • Massa do carro pronto (sem piloto, sem combustível)
//
// Não toca nos campos antigos (motor, pneu marca/tipo, câmbio livre, aero) —
// esses ficam na tela tradicional de Configuração.
//
// Acesso: painel do carro → seção Configurações → botão "Setup técnico"
// (aparece quando há configuração ativa).

import SwiftUI
import P1FastCore

struct SetupTecnicoView: View {
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pilotoRepo: PilotoRepository

    let carroId: String
    let onClose: () -> Void

    @State private var configuracao: Configuracao? = nil
    @State private var rel1: String = ""
    @State private var rel2: String = ""
    @State private var rel3: String = ""
    @State private var rel4: String = ""
    @State private var rel5: String = ""
    @State private var rel6: String = ""
    @State private var relFinal: String = ""
    @State private var medidaPneu: String = ""
    @State private var raioPneuM: String = ""
    @State private var massa: String = ""
    @State private var salvando = false
    @State private var erro: String? = nil
    @State private var aviso: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                cabecalho
                if let cfg = configuracao {
                    blocoMarchas
                    blocoFinal
                    blocoPneu
                    blocoMassa
                    blocoPesoTotal
                    if let aviso = aviso {
                        Text(aviso)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.accent)
                            .padding(.horizontal, 4)
                    }
                    if let erro = erro {
                        Text(erro)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.atencao)
                            .padding(.horizontal, 4)
                    }
                    HStack(spacing: 8) {
                        Button {
                            preencherCatalogo()
                        } label: {
                            Text("Preencher com catálogo Celta")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.text)
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(Color.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        Spacer()
                        Button {
                            Task { await salvar() }
                        } label: {
                            Text(salvando ? "Salvando…" : "Salvar")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.onAccent)
                                .padding(.horizontal, 18).padding(.vertical, 10)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(Color.accent)
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(salvando)
                    }
                    .padding(.top, 8)
                } else {
                    Text("Esse carro não tem configuração ativa. Marque uma configuração como atual antes de cadastrar o setup técnico.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                        .padding(.top, 12)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 120)
        }
        .background(Color.surface)
        .navigationTitle("Setup técnico")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { carregar() }
        .onChange(of: medidaPneu) { _, nova in
            if let m = parseMedidaPneu(nova) {
                raioPneuM = String(format: "%.3f", m.raioM)
                aviso = "Raio calculado: \(String(format: "%.3f", m.raioM)) m. Você pode ajustar manualmente abaixo."
            } else if !nova.isEmpty {
                aviso = "Medida não reconhecida (formato esperado: 185/60 R14). Pode digitar o raio em metros direto abaixo."
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Setup técnico")
            Text(carroRepo.carros.first { $0.id == carroId }?.apelido ?? "Carro")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.text)
            Text("Cadastre os números que o motor da inteligência precisa pra calcular aceleração teórica. Cadastro incremental — preencha o que sabe agora, o resto fica vazio.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
        }
    }

    private var blocoMarchas: some View {
        secao(titulo: "Relações de marcha") {
            VStack(spacing: 6) {
                campoMarcha(label: "1ª marcha", text: $rel1, placeholder: "Ex.: 3,92")
                campoMarcha(label: "2ª marcha", text: $rel2, placeholder: "Ex.: 2,05")
                campoMarcha(label: "3ª marcha", text: $rel3, placeholder: "Ex.: 1,36")
                campoMarcha(label: "4ª marcha", text: $rel4, placeholder: "Ex.: 0,95")
                campoMarcha(label: "5ª marcha", text: $rel5, placeholder: "Ex.: 0,76")
                campoMarcha(label: "6ª marcha (opcional)", text: $rel6, placeholder: "Deixe em branco se for câmbio de 5 marchas")
            }
        }
    }

    private var blocoFinal: some View {
        secao(titulo: "Relação do diferencial") {
            campoNumerico(text: $relFinal, placeholder: "Ex.: 4,27")
        }
    }

    private var blocoPneu: some View {
        secao(titulo: "Pneu") {
            VStack(alignment: .leading, spacing: 6) {
                Text("Medida (formato padrão)")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(Color.textFaint)
                TextField("Ex.: 185/60 R14", text: $medidaPneu)
                    .autocapitalization(.allCharacters)
                    .disableAutocorrection(true)
                    .font(.system(size: 14))
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )

                Text("Raio dinâmico (metros) — pode editar manualmente")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(Color.textFaint)
                    .padding(.top, 6)
                campoNumerico(text: $raioPneuM, placeholder: "Ex.: 0,289")
            }
        }
    }

    private var blocoMassa: some View {
        secao(titulo: "Massa do carro pronto (kg)") {
            VStack(alignment: .leading, spacing: 6) {
                Text("Carro pronto pra correr, SEM piloto e SEM combustível. O piloto e o combustível são somados automaticamente no stint.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                campoNumerico(text: $massa, placeholder: "Ex.: 800")
            }
        }
    }

    @ViewBuilder
    private var blocoPesoTotal: some View {
        let massaDouble = Double(massa.replacingOccurrences(of: ",", with: "."))
        let pilotoCadastrado = pilotoRepo.pilotos.first
        let pesoPiloto = pilotoCadastrado?.pesoKg
        if let total = pesoTotalStint(carroKg: massaDouble, pilotoKg: pesoPiloto) {
            secao(titulo: "Peso total estimado no stint") {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Total")
                            .font(.system(size: 13)).foregroundStyle(Color.textMuted)
                        Spacer()
                        Text("\(String(format: "%.0f", total)) kg")
                            .font(.system(size: 16, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Color.text)
                    }
                    Text("Carro \(massa) kg + piloto \(pesoPiloto.map { String(format: "%.0f", $0) } ?? "—") kg + combustível 30 kg (estimativa)")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textFaint)
                }
            }
        }
    }

    // MARK: - Subviews helpers

    private func campoMarcha(label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(Color.textFaint)
            campoNumerico(text: text, placeholder: placeholder)
        }
    }

    private func campoNumerico(text: Binding<String>, placeholder: String) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(.decimalPad)
            .font(.system(size: 14))
            .foregroundStyle(Color.text)
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
    }

    @ViewBuilder
    private func secao<C: View>(titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(titulo.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    // MARK: - Carregamento e ações

    private func carregar() {
        if let cfg = configuracaoRepo.ativaDoCarro(carroId) {
            self.configuracao = cfg
            self.rel1 = cfg.relacaoMarcha1.map { String(format: "%.2f", $0) } ?? ""
            self.rel2 = cfg.relacaoMarcha2.map { String(format: "%.2f", $0) } ?? ""
            self.rel3 = cfg.relacaoMarcha3.map { String(format: "%.2f", $0) } ?? ""
            self.rel4 = cfg.relacaoMarcha4.map { String(format: "%.2f", $0) } ?? ""
            self.rel5 = cfg.relacaoMarcha5.map { String(format: "%.2f", $0) } ?? ""
            self.rel6 = cfg.relacaoMarcha6.map { String(format: "%.2f", $0) } ?? ""
            self.relFinal = cfg.relacaoFinal.map { String(format: "%.2f", $0) } ?? ""
            self.medidaPneu = cfg.pneusMedida ?? ""
            self.raioPneuM = cfg.raioPneuM.map { String(format: "%.3f", $0) } ?? ""
            self.massa = cfg.massaCarroKg.map { String(format: "%.0f", $0) } ?? ""
        }
    }

    private func preencherCatalogo() {
        self.rel1 = String(format: "%.2f", CeltaBubiCatalogo.relacaoMarcha1)
        self.rel2 = String(format: "%.2f", CeltaBubiCatalogo.relacaoMarcha2)
        self.rel3 = String(format: "%.2f", CeltaBubiCatalogo.relacaoMarcha3)
        self.rel4 = String(format: "%.2f", CeltaBubiCatalogo.relacaoMarcha4)
        self.rel5 = String(format: "%.2f", CeltaBubiCatalogo.relacaoMarcha5)
        self.rel6 = ""
        self.relFinal = String(format: "%.2f", CeltaBubiCatalogo.relacaoFinal)
        self.medidaPneu = CeltaBubiCatalogo.medidaPneuTexto
        self.raioPneuM = String(format: "%.3f", CeltaBubiCatalogo.raioPneuM)
        self.massa = String(format: "%.0f", CeltaBubiCatalogo.massaCarroKg)
        self.aviso = "Valores do catálogo Celta 1.0 PK6 + pneu 185/60 R14 + massa 800 kg carregados. Salve pra aplicar."
    }

    @MainActor
    private func salvar() async {
        guard let cfg = configuracao else { return }
        salvando = true
        defer { salvando = false }
        let normalizar = { (s: String) -> Double? in
            let t = s.replacingOccurrences(of: ",", with: ".")
                .trimmingCharacters(in: .whitespaces)
            return t.isEmpty ? nil : Double(t)
        }
        do {
            try await configuracaoRepo.atualizarSetupTecnico(
                cfg,
                relacaoMarcha1: normalizar(rel1),
                relacaoMarcha2: normalizar(rel2),
                relacaoMarcha3: normalizar(rel3),
                relacaoMarcha4: normalizar(rel4),
                relacaoMarcha5: normalizar(rel5),
                relacaoMarcha6: normalizar(rel6),
                relacaoFinal: normalizar(relFinal),
                raioPneuM: normalizar(raioPneuM),
                massaCarroKg: normalizar(massa)
            )
            aviso = "Salvo."
            erro = nil
            onClose()
        } catch {
            self.erro = "Não consegui salvar: \(error.localizedDescription)"
        }
    }
}
