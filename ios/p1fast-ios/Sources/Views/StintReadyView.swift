// ═══════════════════════════════════════════════════════════
// StintReadyView — tela intermediária "Pronto pra começar"
// ═══════════════════════════════════════════════════════════
// 2026-05-16 (Flávio): "Quando monta o Stint, você deve liberar
// uma tela para ele apertar o start do Stint e ele deve ter a
// opção de deixar só na tela de captura de dados e a transmissão
// da imagem ou deixar na tela do cockpit do piloto."
//
// Aparece DEPOIS do "Iniciar stint" do planejamento. O stint já
// está criado no banco, mas a captura ainda não está ligada. O
// gestor escolhe a vista (dados ou cockpit) e toca START.

import SwiftUI
import P1FastCore

enum StintViewMode {
    case dados
    case cockpit
}

struct StintReadyView: View {
    let stintNumero: Int
    let contextoLinha: String
    let onStart: (StintViewMode) -> Void
    let onCancel: () -> Void
    /// Stint atual — usado pra mostrar e permitir trocar a configuração
    /// antes do START (Q1 do questionário Autódromos 2026-05-17).
    var stintId: String? = nil
    var carroIdDoStint: String? = nil
    var configuracaoIdDoStint: String? = nil
    /// Callback chamado quando o piloto troca a configuração no seletor
    /// embaixo da tela. Caller persiste via StintRepository.setConfiguracao.
    var onTrocarConfiguracao: ((String?) -> Void)? = nil

    @State private var modoEscolhido: StintViewMode = .dados
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 200)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            footer
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            cabecalho
            seletorConfiguracao
            opcoes
        }
    }

    /// Seção opcional: quando o stint tem carro vinculado, mostra a
    /// configuração atual e oferece um botão pra trocar antes do START.
    /// Decisão Q1 do questionário (Flávio 2026-05-17): podemos ter várias
    /// configurações salvas; antes de correr, escolhe.
    @ViewBuilder
    private var seletorConfiguracao: some View {
        if let cid = carroIdDoStint {
            let cfgs = configuracaoRepo.paraCarro(cid)
            let atual = configuracaoIdDoStint.flatMap { id in
                cfgs.first(where: { $0.id == id })
            } ?? cfgs.first(where: { $0.ativa })
            VStack(alignment: .leading, spacing: 8) {
                Text("CONFIGURAÇÃO DESTE STINT")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Color.textFaint)
                if cfgs.isEmpty {
                    Text("Sem configuração cadastrada pra esse carro. Abra a Garagem → Carro → 'Gerenciar configurações' pra adicionar.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textMuted)
                } else {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(atual?.nome ?? atual?.resumoLegivel ?? "Nenhuma escolhida")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(atual == nil ? Color.atencao : Color.text)
                            if let cfg = atual {
                                Text(resumoCurto(cfg))
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.textMuted)
                            }
                        }
                        Spacer(minLength: 0)
                        Menu {
                            ForEach(cfgs, id: \.id) { cfg in
                                Button {
                                    onTrocarConfiguracao?(cfg.id)
                                } label: {
                                    Text(cfg.nome ?? cfg.resumoLegivel)
                                }
                            }
                            if atual != nil {
                                Divider()
                                Button(role: .destructive) {
                                    onTrocarConfiguracao?(nil)
                                } label: {
                                    Text("Sem configuração")
                                }
                            }
                        } label: {
                            Text("Trocar")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.onAccent)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(Color.accent)
                                )
                        }
                    }
                }
            }
            .padding(14)
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

    private func resumoCurto(_ cfg: Configuracao) -> String {
        var partes: [String] = []
        if let m = cfg.motor, !m.isEmpty { partes.append(m) }
        if let tipo = cfg.tipoPneuEnum { partes.append(tipo.legivel) }
        if let c = cfg.cambio, !c.isEmpty { partes.append(c) }
        return partes.isEmpty ? "Sem detalhes" : partes.joined(separator: " · ")
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Stint #\(stintNumero)")
            Text("Pronto pra começar")
                .font(.system(size: 28, weight: .semibold))
                .tracking(-0.7)
                .foregroundStyle(Color.text)
            if !contextoLinha.isEmpty {
                Text(contextoLinha)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            Text("Escolha como o celular vai ser usado durante o stint e toque START.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .padding(.top, 4)
        }
    }

    private var opcoes: some View {
        VStack(spacing: 12) {
            opcaoCard(
                titulo: "Tela de dados",
                hint: "Celular gera os dados do stint e grava o vídeo da videoconferência. Tela fica fixa em vertical mostrando REC + voltas + sensores.",
                modo: .dados
            )
            opcaoCard(
                titulo: "Cockpit do piloto",
                hint: "Celular gera dados e grava vídeo, e ALÉM disso serve como tela do cockpit pro piloto. Em vertical mostra dados; em horizontal mostra o cockpit. Alternância automática pela rotação.",
                modo: .cockpit
            )
        }
    }

    private func opcaoCard(titulo: String, hint: String, modo: StintViewMode) -> some View {
        let isOn = modoEscolhido == modo
        return Button(action: { modoEscolhido = modo }) {
            VStack(alignment: .leading, spacing: 6) {
                Text(titulo)
                    .font(.system(size: 17, weight: .semibold))
                    .tracking(-0.085)
                    .foregroundStyle(Color.text)
                Text(hint)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(2)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(isOn ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isOn ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        VStack(spacing: 10) {
            Button(action: { onStart(modoEscolhido) }) {
                Text("START")
                    .font(.system(size: 18, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(Color.onAccent)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.accent)
                    )
            }
            .buttonStyle(.plain)

            Button(action: onCancel) {
                Text("Cancelar")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 14)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity)
        .background(
            Color.surface.opacity(0.92).background(.ultraThinMaterial)
        )
        .overlay(
            Rectangle()
                .fill(Color.border)
                .frame(height: 1),
            alignment: .top
        )
    }
}
