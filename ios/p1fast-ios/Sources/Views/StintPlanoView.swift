// ═══════════════════════════════════════════════════════════
// StintPlanoView — o Planejamento do Stint (propósito + treino)
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 15/06: o planejamento do Stint mora no CELULAR. Esta tela
// é o coração do planejamento — port fiel da lógica do computador
// (web/cockpit/configuracao-stint.js + catalogo-treinos.js), NÃO copiado
// literal: o celular vira a fonte do planejamento.
//
// Propósito (o que você quer da sessão):
//   - Rodar livre   → painel padrão completo, sem foco.
//   - Testar o carro → foca numa parte (Motor/Freios/Pneus e rodas/Câmbio/
//                      Suspensão/Elétrica) o stint inteiro.
//   - Treinar habilidade → escolhe um treino do catálogo (1 técnica + 6
//                      pontos do trecho); a explicação (o que é + o que a IA
//                      mede) é OBRIGATÓRIA antes de aprovar.
// + Ghost na tela (registra a escolha) + voltas do stint.
//
// ESTADO ATUAL: "Aprovar" monta o plano e mostra o resumo. GRAVAR o plano
// (no formato que o painel da pista lê — plano_stint) e INICIAR o Stint
// entram no próximo passo (é a parte que mexe na nuvem, com autorização).

import SwiftUI
import P1FastCore

struct StintPlanoView: View {
    /// Evento ao qual o Stint está vinculado. nil = Stint livre (sem evento).
    var eventoId: String? = nil

    enum Proposito: String { case livre, testar, treinar }

    @State private var proposito: Proposito?
    @State private var focoTeste: FocoTeste?
    @State private var focoTreino: String?      // id do treino do catálogo
    @State private var briefConfirmado = false
    @State private var ghost = false
    @State private var voltas = 10
    @State private var aprovado = false

    private var podeAprovar: Bool {
        switch proposito {
        case .none: return false
        case .livre: return true
        case .testar: return focoTeste != nil
        case .treinar: return focoTreino != nil && briefConfirmado
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                cabecalho
                propositoSection
                if proposito == .treinar, let id = focoTreino, let treino = CatalogoTreinos.por(id: id) {
                    briefCard(treino)
                }
                ghostRow
                voltasRow
                if aprovado { resumoCard }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .preferredColorScheme(.dark)
        .safeAreaInset(edge: .bottom) { footBar }
    }

    // MARK: Cabeçalho

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Planejar Stint")
            Text("Como vai ser este Stint")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color.text)
            Text(eventoId == nil ? "Stint livre — sem evento." : "Vinculado a um evento.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textFaint)
        }
    }

    // MARK: Propósito

    private var propositoSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            rotulo("Propósito — o que você quer desta sessão")

            propositoCard(.livre, "Rodar livre", "Volta livre, painel completo. Sem foco específico.")

            propositoCard(.testar, "Testar o carro", "O painel foca na parte escolhida o stint inteiro.")
            if proposito == .testar {
                chipsWrap {
                    ForEach(FocoTeste.allCases) { f in
                        chip(f.rotulo, ativo: focoTeste == f) { focoTeste = f }
                    }
                }
            }

            propositoCard(.treinar, "Treinar habilidade", "Voltas focadas numa disciplina: técnica de pilotagem ou um dos 6 pontos do trecho.")
            if proposito == .treinar {
                Text("Técnica de pilotagem")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(Color.textFaint)
                chipsWrap {
                    ForEach(CatalogoTreinos.tecnica) { t in
                        chip(t.rotulo, ativo: focoTreino == t.id) { escolherTreino(t.id) }
                    }
                }
                Text("Pontos do trecho")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(Color.textFaint)
                    .padding(.top, 2)
                chipsWrap {
                    ForEach(CatalogoTreinos.pontos) { t in
                        chip(t.rotulo, ativo: focoTreino == t.id) { escolherTreino(t.id) }
                    }
                }
            }
        }
    }

    private func propositoCard(_ p: Proposito, _ nome: String, _ desc: String) -> some View {
        let selecionado = proposito == p
        return Button {
            proposito = p
            if p != .testar { focoTeste = nil }
            if p != .treinar { focoTreino = nil; briefConfirmado = false }
            aprovado = false
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(nome)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(selecionado ? Color.accent.opacity(0.12) : Color.surfaceHover)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(selecionado ? Color.accent : Color.border, lineWidth: selecionado ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func escolherTreino(_ id: String) {
        focoTreino = id
        briefConfirmado = false   // novo treino → reexige a explicação
        aprovado = false
    }

    // MARK: Explicação obrigatória do treino (brief)

    private func briefCard(_ t: TreinoCatalogo) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text(t.rotulo)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.text)
                Spacer(minLength: 0)
                etiquetaBadge(t.etiqueta)
            }
            Text(t.oQueE)
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            Text("O que a inteligência mede")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(Color.textFaint)
                .padding(.top, 2)
            ForEach(Array(t.oQueMede.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 8) {
                    Text("·").foregroundStyle(Color.accent)
                    Text(item)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if let r = t.ressalva {
                Text(r)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }

            Button {
                briefConfirmado = true
            } label: {
                Text(briefConfirmado ? "Entendido" : "Entendi — pode treinar isso")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(briefConfirmado ? Color.onAccent : Color.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(briefConfirmado ? Color.accent : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color.accent, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.surfaceHover)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func etiquetaBadge(_ etiqueta: String) -> some View {
        let pleno = etiqueta == "pleno"
        return Text(pleno ? "MEDIDO DE VERDADE" : "POR APROXIMAÇÃO")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(pleno ? Color.onAccent : Color.text)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().fill(pleno ? Color.accent : Color.surface))
            .overlay(Capsule().stroke(pleno ? Color.clear : Color.border, lineWidth: 1))
    }

    // MARK: Ghost + voltas

    private var ghostRow: some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Ghost na tela")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("Mostra o traçado da melhor passagem pra seguir. A escolha fica no plano.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Toggle("", isOn: $ghost).labelsHidden().tint(Color.accent)
        }
    }

    private var voltasRow: some View {
        HStack {
            Text("Voltas do stint")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.text)
            Spacer()
            Stepper(value: $voltas, in: 1...99) {
                Text("\(voltas)")
                    .font(.system(size: 16, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.text)
            }
            .labelsHidden()
            .fixedSize()
        }
    }

    // MARK: Resumo (após aprovar)

    private var resumoCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plano pronto")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.text)
            Text(resumoTexto)
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            Text("Gravar e iniciar o Stint entra no próximo passo.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.textFaint)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.accent.opacity(0.10))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.accent, lineWidth: 1)
        )
    }

    private var resumoTexto: String {
        var partes: [String] = []
        switch proposito {
        case .livre: partes.append("Rodar livre")
        case .testar: partes.append("Testar o carro" + (focoTeste.map { " · \($0.rotulo)" } ?? ""))
        case .treinar:
            let nome = focoTreino.flatMap { CatalogoTreinos.por(id: $0)?.rotulo } ?? ""
            partes.append("Treinar · \(nome)")
        case .none: break
        }
        partes.append("\(voltas) voltas")
        if ghost { partes.append("ghost ligado") }
        return partes.joined(separator: " · ")
    }

    // MARK: Rodapé

    private var footBar: some View {
        Button {
            aprovado = true
        } label: {
            Text(aprovado ? "Plano aprovado" : "Aprovar plano")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.onAccent)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Capsule().fill(Color.accent))
                .opacity(podeAprovar ? 1.0 : 0.4)
        }
        .buttonStyle(.plain)
        .disabled(!podeAprovar || aprovado)
        .padding(.horizontal, Spacing.lg)
        .padding(.bottom, Spacing.md)
        .padding(.top, Spacing.sm)
        .background(.ultraThinMaterial)
    }

    // MARK: helpers visuais

    private func rotulo(_ texto: String) -> some View {
        Text(texto.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.1)
            .foregroundStyle(Color.textFaint)
    }

    private func chip(_ texto: String, ativo: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(texto)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(ativo ? Color.onAccent : Color.textMuted)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().fill(ativo ? Color.accent : Color.clear))
                .overlay(Capsule().stroke(ativo ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func chipsWrap<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        // Quebra os chips em linhas conforme a largura (FlowLayout simples).
        FlowChips { content() }
    }
}

/// Layout que quebra os filhos em linhas (substitui o flex-wrap da web).
private struct FlowChips: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > maxW, x > 0 {
                x = 0; y += lineH + spacing; lineH = 0
            }
            x += s.width + spacing
            lineH = max(lineH, s.height)
        }
        return CGSize(width: maxW == .infinity ? x : maxW, height: y + lineH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxW = bounds.width
        var x: CGFloat = bounds.minX, y: CGFloat = bounds.minY, lineH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x - bounds.minX + s.width > maxW, x > bounds.minX {
                x = bounds.minX; y += lineH + spacing; lineH = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing
            lineH = max(lineH, s.height)
        }
    }
}

#Preview {
    NavigationStack {
        StintPlanoView(eventoId: nil)
    }
}
