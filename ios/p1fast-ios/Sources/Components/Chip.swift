// ═══════════════════════════════════════════════════════════
// Chip — pill com label, estados default/active/disabled
// ═══════════════════════════════════════════════════════════
// Espelha `.tipo` do mockup-evento-B.html (a versão pill do mockup —
// border-radius:999px). Padrão B canônico para botões secundários
// inline (filtros, segmented controls, opções).
//
// Estados:
//   - default  : surface bg, hairline border, text-2 label
//   - hover    : surface-2 bg, text label (mockup `.tipo:hover`)
//   - active   : accent bg, accent border, onAccent text (mockup `.tipo.is-active`)
//   - pressed  : scale 0.97 (mockup `.btn:active{transform:scale(.97)}`)
//   - disabled : opacity 0.4, sem hover/press
//
// Sem ícones. Texto puro no label — princípio inegociável.

import SwiftUI

struct Chip: View {
    let label: String
    let isActive: Bool
    let isDisabled: Bool
    let action: () -> Void

    @State private var isPressed = false

    init(
        _ label: String,
        isActive: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void = {}
    ) {
        self.label = label
        self.isActive = isActive
        self.isDisabled = isDisabled
        self.action = action
    }

    private var background: Color {
        if isActive { return Color.accent }
        return Color.surfaceRaised
    }

    private var borderColor: Color {
        if isActive { return Color.accent }
        return Color.border
    }

    private var foreground: Color {
        if isActive { return Color.onAccent }
        return Color.textMuted
    }

    private var weight: Font.Weight {
        isActive ? .semibold : .medium
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: weight))
                .tracking(-0.065) // -0.005em em 13pt
                .foregroundStyle(foreground)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Capsule().fill(background))
                .overlay(Capsule().stroke(borderColor, lineWidth: 1))
                .scaleEffect(isPressed ? 0.97 : 1.0)
                .opacity(isDisabled ? 0.4 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .animation(Layout.snap, value: isPressed)
        .animation(Layout.snap, value: isActive)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = !isDisabled }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Previews

#Preview("Chip — todos os estados") {
    VStack(alignment: .leading, spacing: Spacing.lg) {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("default").font(.captionP1).foregroundStyle(Color.textFaint)
            Chip("Track Day")
        }
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("active").font(.captionP1).foregroundStyle(Color.textFaint)
            Chip("Track Day", isActive: true)
        }
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("disabled").font(.captionP1).foregroundStyle(Color.textFaint)
            Chip("Track Day", isDisabled: true)
        }
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("rail (mockup .tipo-rail)").font(.captionP1).foregroundStyle(Color.textFaint)
            FlowChipRail(
                items: [
                    "Track Day", "Treino", "Treino de largada",
                    "Corrida", "Validação", "Sessão de testes",
                ],
                active: "Track Day"
            )
        }
    }
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

/// Helper de preview: rail horizontal de chips com estado ativo,
/// equivalente ao `.tipo-rail` do mockup-evento-B.html. Não é
/// componente público — só serve pra Preview e pro showcase.
struct FlowChipRail: View {
    let items: [String]
    let active: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(items, id: \.self) { item in
                    Chip(item, isActive: item == active)
                }
            }
        }
    }
}
