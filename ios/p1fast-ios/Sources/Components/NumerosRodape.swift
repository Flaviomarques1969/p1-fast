// ═══════════════════════════════════════════════════════════
// NumerosRodape — rodapé discreto de números históricos
// ═══════════════════════════════════════════════════════════
// Espelha `.stats` de _design-reference/propostas-home-2026-07-11/
// proposta-a-dia-de-pista.html (Home "Dia de Pista", Flávio 2026-07-11).
//
// UMA linha só, discreta, com os totais históricos:
//   ─────────────────────────────────────────────
//     12 EVENTOS  ·  158 VOLTAS  ·  47 STINTS
//
//   • número claro (tabular) + rótulo apagado, lado a lado
//   • cada segmento é tocável (abre a lista correspondente)
//   • "informa sem competir com a decisão do dia" (conceito A)
//
// Contrato (COORDENACAO.md):
//   NumerosRodape(eventos:Int, voltas:Int, stints:Int,
//                 onEventos:()->Void, onVoltas:()->Void, onStints:()->Void)
//
// Tokens só de Theme.swift. Sem emoji. Fundo escuro. Zero é honesto
// (0 EVENTOS) — sem inventar dado.

import SwiftUI

struct NumerosRodape: View {
    let eventos: Int
    let voltas: Int
    let stints: Int
    let onEventos: () -> Void
    let onVoltas: () -> Void
    let onStints: () -> Void

    // Init explícito p/ travar a assinatura EXATA do contrato.
    init(
        eventos: Int,
        voltas: Int,
        stints: Int,
        onEventos: @escaping () -> Void,
        onVoltas: @escaping () -> Void,
        onStints: @escaping () -> Void
    ) {
        self.eventos = eventos
        self.voltas = voltas
        self.stints = stints
        self.onEventos = onEventos
        self.onVoltas = onVoltas
        self.onStints = onStints
    }

    var body: some View {
        HStack(spacing: 10) {
            segmento(valor: eventos, rotulo: "Eventos", acao: onEventos)
            separador
            segmento(valor: voltas, rotulo: "Voltas", acao: onVoltas)
            separador
            segmento(valor: stints, rotulo: "Stints", acao: onStints)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .overlay(
            // hairline superior (border-top do `.stats` do mockup).
            Rectangle()
                .fill(Color.border)
                .frame(height: 1),
            alignment: .top
        )
    }

    private func segmento(valor: Int, rotulo: String, acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            HStack(spacing: 6) {
                Text("\(valor)")
                    .font(.system(size: 15, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-0.3) // -0.02em em 15pt
                    .foregroundStyle(Color.text)
                Text(rotulo.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.0) // 0.1em em 10pt
                    .foregroundStyle(Color.textFaint)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var separador: some View {
        Text("·")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Color.textFaint.opacity(0.6))
    }
}

// MARK: - Previews

#Preview("NumerosRodape — cheio") {
    NumerosRodape(
        eventos: 12,
        voltas: 158,
        stints: 47,
        onEventos: {},
        onVoltas: {},
        onStints: {}
    )
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("NumerosRodape — zerado (honesto)") {
    NumerosRodape(
        eventos: 0,
        voltas: 0,
        stints: 0,
        onEventos: {},
        onVoltas: {},
        onStints: {}
    )
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
