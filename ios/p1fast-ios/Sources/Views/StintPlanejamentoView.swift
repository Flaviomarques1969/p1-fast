// ═══════════════════════════════════════════════════════════
// StintPlanejamentoView — Planejamento do Stint no celular
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 15/06/2026: o PLANEJAMENTO DO STINT é no CELULAR. O
// painel do computador (web/cockpit) é só o RESULTADO do carro rodando
// conforme o que foi planejado aqui.
//
// FASE 0 (esta entrega) = A PORTA. O botão "Stint" no canto superior
// direito da Home (que substituiu o botão temporário "Conta"; Conta/Sair
// migrou pra dentro da Garagem) abre esta tela. Aberta empilhada (push),
// então o menu inferior fixo e o botão "voltar" do sistema seguem valendo.
//
// PRÓXIMAS FASES (ainda NÃO nesta tela):
//   F1 — abrir o planejamento de verdade reaproveitando a StintModalView
//        (que já existe), agora também no modo SOLTO (qualquer dia) e
//        auto-vinculada quando for dia de evento (eventoAtivoHoje()).
//   F2 — PROPÓSITO (livre / testar peça do carro / treinar habilidade) +
//        catálogo de treinos + brief obrigatório, portados da web.
//   F3 — gravar o plano que o painel da pista lê (plano_stint, mig 0042).

import SwiftUI
import P1FastCore

struct StintPlanejamentoView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Eyebrow(text: "Stint")
                Text("Planejamento do Stint")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Color.text)
                Text("Aqui você monta o Stint antes de entrar na pista: livre, testar uma peça do carro, ou treinar uma habilidade — vinculado a um evento quando for dia de evento, ou solto, em qualquer dia.")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Em construção — esta é a porta. As opções de planejamento entram no próximo passo.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textFaint)
                    .padding(.top, Spacing.sm)
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

#Preview {
    NavigationStack {
        StintPlanejamentoView()
    }
}
