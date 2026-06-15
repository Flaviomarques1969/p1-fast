// ═══════════════════════════════════════════════════════════
// StintPlanejamentoView — escolha do Stint quando NÃO é dia de evento
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 15/06/2026: o botão "Stint" no topo da Home (iniciar o
// Stint) decide o destino:
//   - se HOJE é dia de evento  → abre DIRETO no evento (EventoDetalheView)
//     — isso é resolvido em ContentView.stintTapDecision(), NÃO aqui.
//   - se NÃO é dia de evento   → abre ESTA tela, que pergunta:
//        · "Vincular a um evento"  (liga o Stint a um evento já criado)
//        · "Stint livre"           (um Stint sem evento, em qualquer dia)
//
// O painel do computador (web/cockpit) é só o RESULTADO do carro rodando
// conforme o que foi planejado aqui.
//
// ESTADO ATUAL (Fase 0/1 em curso):
//   - "Vincular a um evento" já leva pra lista de Eventos (escolhe lá).
//   - "Stint livre" ainda mostra aviso de "próxima etapa" — o planejamento
//     livre de verdade (propósito livre/testar/treinar + StintModalView no
//     modo solto) entra na Fase 1/2.

import SwiftUI
import P1FastCore

struct StintPlanejamentoView: View {
    @EnvironmentObject private var router: NavRouter

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Eyebrow(text: "Stint")
                Text("Iniciar Stint")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Color.text)
                Text("Hoje não é dia de evento. Como você quer este Stint?")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)

                EscolhaStint(
                    titulo: "Vincular a um evento",
                    descricao: "Liga este Stint a um evento já criado.",
                    action: { router.path.append(HomeNavTarget.eventos) }
                )
                EscolhaStint(
                    titulo: "Stint livre",
                    descricao: "Um Stint sem evento, em qualquer dia.",
                    action: { router.path.append(HomeNavTarget.stintPlano(eventoId: nil)) }
                )
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 40)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .preferredColorScheme(.dark)
    }
}

/// Cartão tocável de escolha (vincular × livre). Visual neutro com borda.
private struct EscolhaStint: View {
    let titulo: String
    let descricao: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(titulo)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(descricao)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        StintPlanejamentoView()
            .environmentObject(NavRouter())
    }
}
