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
    /// S3 da rodada 1 (2026-05-12): toque opcional no card. Quando nil,
    /// o card é só visual; quando preenchido, vira botão com setinha "›"
    /// no canto. Recomendação P3 #2.3: 4 cards novos (Stints/Autódromos/
    /// Recordes/Voltas) redirecionam pra Eventos com filtro.
    let onTap: (() -> Void)?

    init(value: String, label: String, onTap: (() -> Void)? = nil) {
        self.value = value
        self.label = label
        self.onTap = onTap
    }
}

struct SummaryStats: View {
    let items: [StatItem]
    /// Quantas colunas no grid. Default = 3 (mantém o canônico antigo).
    /// Quando há 6 itens, a Home da S3 usa 3 colunas pra fazer 2 linhas.
    let columns: Int

    init(_ items: [StatItem], columns: Int = 3) {
        self.items = items
        self.columns = max(1, columns)
    }

    var body: some View {
        let cols = Array(repeating: GridItem(.flexible(), spacing: Spacing.sm), count: columns)
        LazyVGrid(columns: cols, spacing: Spacing.sm) {
            ForEach(items) { item in
                StatCell(item: item)
            }
        }
    }
}

private struct StatCell: View {
    let item: StatItem

    var body: some View {
        if let onTap = item.onTap {
            Button(action: onTap) {
                cellContent(clicavel: true)
            }
            .buttonStyle(.plain)
        } else {
            cellContent(clicavel: false)
        }
    }

    private func cellContent(clicavel: Bool) -> some View {
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
        .overlay(alignment: .topTrailing) {
            if clicavel {
                Text("›")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(6)
            }
        }
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
