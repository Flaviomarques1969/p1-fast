// ═══════════════════════════════════════════════════════════
// EyebrowHeader — eyebrow + título grande + summary opcional
// ═══════════════════════════════════════════════════════════
// Espelha `.eyebrow + .header__status / .card__title + .gauges` do
// mockup-home-cheio.html (Padrão B). É a "abertura" de cada tela e
// também aparece no topo de cards principais.
//
// Composição:
//   ┌────────────────────────────────┐
//   │ ● PRÓXIMO EVENTO   ← Eyebrow   │
//   │ Brasília · 2 de maio  ← Title  │
//   │ Sábado, 02/05         ← Sub    │
//   └────────────────────────────────┘
//
// Sem ícones. O dot do eyebrow é primitivo geométrico (Circle), não
// "ícone decorativo". O prompt #7 trata isso explicitamente — mockup
// usa <span class="eyebrow__dot"> que é só um disco de 5px.

import SwiftUI

/// Pill "eyebrow" — uppercase, accent, background tonal.
/// Aparece sozinho como kicker antes do título de uma seção.
struct Eyebrow: View {
    let text: String

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(Color.accent)
                .frame(width: 5, height: 5)
            Text(text.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2) // 0.12em ≈ 1.2pt em 10pt
                .foregroundStyle(Color.accent)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .background(
            Capsule().fill(Color.accentDim.opacity(0.15))
        )
        .overlay(
            Capsule().stroke(Color.accent.opacity(0.35), lineWidth: 1)
        )
    }
}

/// Cabeçalho completo: eyebrow + título + subtítulo opcional.
/// Equivalente ao `.header` do mockup-home-cheio.html quando a tela
/// abre com kicker (eyebrow) seguido do estado principal.
struct EyebrowHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String?

    init(eyebrow: String, title: String, subtitle: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Eyebrow(text: eyebrow)
            Text(title)
                .font(.titleP1)
                .tracking(-0.4) // -0.02em em 22pt
                .foregroundStyle(Color.text)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }
}

// MARK: - Previews

#Preview("Eyebrow — sozinho") {
    VStack(alignment: .leading, spacing: Spacing.md) {
        Eyebrow(text: "Próximo evento")
        Eyebrow(text: "Stint em andamento")
        Eyebrow(text: "Sugestão")
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("EyebrowHeader — completo") {
    VStack(alignment: .leading, spacing: Spacing.xl) {
        EyebrowHeader(
            eyebrow: "Próximo evento",
            title: "Brasília · 2 de maio",
            subtitle: "Sábado, 02/05 · 09:00 · Nelson Piquet"
        )

        EyebrowHeader(
            eyebrow: "Stint em andamento",
            title: "Volta 4 de 10",
            subtitle: nil
        )
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
