// ═══════════════════════════════════════════════════════════
// FAB — floating action button accent, label texto puro
// ═══════════════════════════════════════════════════════════
// Espelha `.fab` do mockup-home-cheio.html. Pill accent flutuante,
// label texto + um "+" no início — "+" é primitivo geométrico
// (sinal de soma renderizado como texto), NÃO ícone decorativo.
// O prompt #7 trata o "+" do mockup como aceitável — está no canônico.
//
// Estados:
//   - default  : accent bg, onAccent text
//   - hover    : accentHover bg (não vai fazer diff na pose mobile, mas
//                deixamos o token aplicado em onHover por consistência)
//   - pressed  : scale 0.96 (mockup `.fab:active{transform:scale(.96)}`)
//   - disabled : opacity 0.4
//
// Posicionamento: o FAB em si é um `View` retangular — quem usa
// posiciona via `.position(...)` ou ancorando no `ZStack` da tela
// (igual mockup: `position:fixed; bottom:90px; right:16px`).

import SwiftUI

struct FAB: View {
    let label: String
    let isDisabled: Bool
    let action: () -> Void

    @State private var isPressed = false

    init(_ label: String, isDisabled: Bool = false, action: @escaping () -> Void = {}) {
        self.label = label
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                Text("+")
                    .font(.system(size: 20, weight: .medium))
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(-0.075) // -0.005em em 15pt
            }
            .foregroundStyle(Color.onAccent)
            .padding(.leading, 18)
            .padding(.trailing, 22)
            .frame(height: 56)
            .background(Capsule().fill(Color.accent))
            .shadow(color: Color.accent.opacity(0.25), radius: 14, x: 0, y: 10)
            .scaleEffect(isPressed ? 0.96 : 1.0)
            .opacity(isDisabled ? 0.4 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .animation(Layout.snap, value: isPressed)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = !isDisabled }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Previews

#Preview("FAB — todos os estados") {
    VStack(alignment: .leading, spacing: Spacing.lg) {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("default").font(.captionP1).foregroundStyle(Color.textFaint)
            FAB("Novo evento")
        }
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("disabled").font(.captionP1).foregroundStyle(Color.textFaint)
            FAB("Novo evento", isDisabled: true)
        }
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("ancorado bottom-right (uso real)").font(.captionP1).foregroundStyle(Color.textFaint)
            ZStack(alignment: .bottomTrailing) {
                Color.surface.frame(height: 200)
                FAB("Novo carro")
                    .padding(.trailing, Spacing.md)
                    .padding(.bottom, 90)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
    }
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
