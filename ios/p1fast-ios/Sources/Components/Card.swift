// ═══════════════════════════════════════════════════════════
// Card — surface raised + hairline border + radius md
// ═══════════════════════════════════════════════════════════
// Espelha `.card` do mockup-home-cheio.html (e .input/.picker do
// mockup-evento-B.html). É o container neutro do Padrão B — o que
// vier por `content` decide o conteúdo.
//
// Variantes via `style`:
//   - .raised  → background `surfaceRaised` (default — mockup .card)
//   - .hover   → background `surfaceHover` (estado hover do .picker:hover)
//   - .accent  → border `accent` + background levemente azulado (focus)
//
// "Pressed" e "disabled" não são estados visuais do Card no Padrão B
// canônico — quando o card é interativo, o feedback vem do botão
// interno (Chip/FAB) ou de um `scaleEffect(0.99)` aplicado no tap.
// Mostramos um exemplo no Preview de tap.

import SwiftUI

enum CardStyleKind {
    case raised
    case hover
    case accent
}

struct Card<Content: View>: View {
    let style: CardStyleKind
    @ViewBuilder let content: () -> Content

    init(style: CardStyleKind = .raised, @ViewBuilder content: @escaping () -> Content) {
        self.style = style
        self.content = content
    }

    private var background: Color {
        switch style {
        case .raised: return Color.surfaceRaised
        case .hover: return Color.surfaceHover
        case .accent: return Color.surfaceRaised
        }
    }

    private var borderColor: Color {
        switch style {
        case .raised, .hover: return Color.border
        case .accent: return Color.accent
        }
    }

    var body: some View {
        content()
            .padding(.horizontal, 18)
            .padding(.vertical, Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }
}

// MARK: - Previews

#Preview("Card — raised (default)") {
    VStack(spacing: Spacing.md) {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text("Brasília · 2 de maio")
                    .font(.titleP1)
                    .foregroundStyle(Color.text)
                Text("Sábado, 02/05 · 09:00 · Nelson Piquet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("Card — hover state") {
    Card(style: .hover) {
        Text("Estado hover — surface-2 (igual `.picker:hover`)")
            .font(.bodyP1)
            .foregroundStyle(Color.text)
    }
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("Card — accent (focus)") {
    Card(style: .accent) {
        Text("Estado focus — border accent (igual `.input:focus`)")
            .font(.bodyP1)
            .foregroundStyle(Color.text)
    }
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
