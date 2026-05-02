// ═══════════════════════════════════════════════════════════
// SummaryStats — grid horizontal de stats (gauge cards)
// ═══════════════════════════════════════════════════════════
// Espelha `.gauges + .gauge` do mockup-home-cheio.html. Quatro cards
// pequenos com valor grande tabular-nums + label uppercase. Largura
// flex igual em todos os itens (grid 1fr 1fr 1fr 1fr).
//
// O prompt #7 chama de "SummaryStats" mas o nome canônico no mockup é
// "gauges". Mantemos o nome do prompt no SwiftUI pra alinhar com o que
// a queue vai pedir nas próximas telas (Home / Eventos / Garagem).

import SwiftUI

struct StatItem: Identifiable {
    let id = UUID()
    let value: String
    let label: String
}

struct SummaryStats: View {
    let items: [StatItem]

    init(_ items: [StatItem]) {
        self.items = items
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(items) { item in
                StatCell(item: item)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct StatCell: View {
    let item: StatItem

    var body: some View {
        VStack(spacing: 6) {
            Text(item.value)
                .font(.system(size: 22, weight: .semibold, design: .default))
                .monospacedDigit()
                .tracking(-0.4) // -0.02em em 22pt
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text(item.label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.6) // 0.06em em 10pt
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, Spacing.sm)
        .frame(maxWidth: .infinity)
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

// MARK: - Previews

#Preview("SummaryStats — 4 colunas (canônico)") {
    SummaryStats([
        StatItem(value: "4", label: "Eventos"),
        StatItem(value: "158", label: "Voltas"),
        StatItem(value: "158", label: "Celta"),
        StatItem(value: "1:42.3", label: "Melhor"),
    ])
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("SummaryStats — 3 colunas (cards / eventos / stints)") {
    SummaryStats([
        StatItem(value: "2", label: "Carros"),
        StatItem(value: "12", label: "Eventos"),
        StatItem(value: "47", label: "Stints"),
    ])
    .padding(Spacing.lg)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
