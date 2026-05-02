// ═══════════════════════════════════════════════════════════
// BottomNav — barra inferior 3-4 itens com indicador accent
// ═══════════════════════════════════════════════════════════
// Espelha `.bottom-nav` do mockup-home-cheio.html. Itens:
//   Home / Eventos / Pendências / Garagem
//
// Padrão B usa um dot accent acima do label do item ativo (não um
// ícone) — isso é o "indicador" texto-puro do prompt #7. Item inativo
// = dot transparente. Sem ícones decorativos em qualquer posição.
//
// Material:
//   - background ≈ `oklch(18% 0.005 240 / .92)` no mockup → translucido
//     com `.ultraThinMaterial` no SwiftUI (efeito blur similar)
//   - border-top hairline
//   - safe area inferior preservada

import SwiftUI

struct BottomNavItem: Identifiable, Hashable {
    let id = UUID()
    let label: String

    init(_ label: String) {
        self.label = label
    }
}

struct BottomNav: View {
    let items: [BottomNavItem]
    @Binding var selection: BottomNavItem.ID?
    var onSelect: (BottomNavItem) -> Void = { _ in }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items) { item in
                BottomNavCell(
                    item: item,
                    isActive: item.id == selection,
                    action: {
                        selection = item.id
                        onSelect(item)
                    }
                )
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 10)
        .padding(.bottom, 22)
        .background(
            // Translúcido sobre o gradient global do app, igual o
            // `backdrop-filter: blur(20px) saturate(140%)` do mockup.
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

private struct BottomNavCell: View {
    let item: BottomNavItem
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Circle()
                    .fill(isActive ? Color.accent : Color.clear)
                    .frame(width: 5, height: 5)
                Text(item.label.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.6) // 0.06em em 10pt
                    .foregroundStyle(isActive ? Color.accent : Color.textFaint)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, Spacing.sm)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(Layout.snap, value: isActive)
    }
}

// MARK: - Previews

#Preview("BottomNav — 4 itens, Home ativo") {
    StatefulPreview { selection in
        VStack(spacing: 0) {
            Spacer()
            BottomNav(
                items: [
                    BottomNavItem("Home"),
                    BottomNavItem("Eventos"),
                    BottomNavItem("Pendências"),
                    BottomNavItem("Garagem"),
                ],
                selection: selection
            )
        }
        .background(Color.surface)
    }
    .preferredColorScheme(.dark)
}

#Preview("BottomNav — 3 itens (variante)") {
    StatefulPreview { selection in
        VStack(spacing: 0) {
            Spacer()
            BottomNav(
                items: [
                    BottomNavItem("Home"),
                    BottomNavItem("Eventos"),
                    BottomNavItem("Garagem"),
                ],
                selection: selection
            )
        }
        .background(Color.surface)
    }
    .preferredColorScheme(.dark)
}

/// Wrapper de Preview pra dar `@State` aos casos que precisam
/// (Preview top-level não pode ter `@State` direto).
struct StatefulPreview<Content: View>: View {
    @State private var selection: BottomNavItem.ID?
    let content: (Binding<BottomNavItem.ID?>) -> Content

    init(@ViewBuilder _ content: @escaping (Binding<BottomNavItem.ID?>) -> Content) {
        self.content = content
    }

    var body: some View {
        content($selection)
    }
}
