// ═══════════════════════════════════════════════════════════
// ThemeShowcaseView — galeria viva dos componentes Padrão B
// ═══════════════════════════════════════════════════════════
// Tela única que renderiza cada componente em todos os estados pra
// permitir screenshot real do simulator (alternativa ao Xcode Preview
// quando o agente roda via xcodebuild + xcrun simctl io screenshot).
//
// Vai sumir quando o HomeView/EventosView de verdade chegarem (Sprint
// 1A.2 prompts #8-#10). Por ora é o conteúdo principal do app.

import SwiftUI

struct ThemeShowcaseView: View {
    @State private var navSelection: BottomNavItem.ID?
    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Cadastros"),
        BottomNavItem("Garagem"),
    ]

    init() {
        _navSelection = State(initialValue: nil)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    EyebrowHeader(
                        eyebrow: "Showcase Padrão B",
                        title: "Componentes do hub",
                        subtitle: "Gallery temporária — vai sumir no Sprint 1A.2"
                    )

                    section("Eyebrow + EyebrowHeader") {
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Eyebrow(text: "Próximo evento")
                            Eyebrow(text: "Stint em andamento")
                        }
                    }

                    section("SummaryStats — 4 colunas (canônico Home)") {
                        SummaryStats([
                            StatItem(value: "4", label: "Eventos"),
                            StatItem(value: "158", label: "Voltas"),
                            StatItem(value: "158", label: "Celta"),
                            StatItem(value: "1:42.3", label: "Melhor"),
                        ])
                    }

                    section("Card — variantes") {
                        VStack(spacing: Spacing.sm) {
                            Card {
                                cardContent(title: "Brasília · 2 de maio",
                                            subtitle: "Sábado, 02/05 · 09:00 · Nelson Piquet")
                            }
                            Card(style: .hover) {
                                cardContent(title: "Estado hover",
                                            subtitle: "Igual `.picker:hover` do mockup")
                            }
                            Card(style: .accent) {
                                cardContent(title: "Estado focus",
                                            subtitle: "Igual `.input:focus` do mockup")
                            }
                        }
                    }

                    section("Chip — pill (.tipo do mockup)") {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            HStack(spacing: 6) {
                                Chip("Default")
                                Chip("Active", isActive: true)
                                Chip("Disabled", isDisabled: true)
                            }
                            FlowChipRail(
                                items: ["Track Day", "Treino", "Treino de largada",
                                        "Corrida", "Validação", "Sessão de testes"],
                                active: "Track Day"
                            )
                        }
                    }

                    section("FAB — ancorado bottom-right (uso canônico)") {
                        Text("Veja o botão accent flutuante no canto inferior direito da tela.")
                            .font(.captionP1)
                            .foregroundStyle(Color.textFaint)
                    }

                    Color.clear.frame(height: 140) // espaço pra FAB + BottomNav fixos
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.lg)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            BottomNav(items: navItems, selection: $navSelection)
        }
        .overlay(alignment: .bottomTrailing) {
            // FAB ancorado bottom-right (uso canônico do mockup —
            // `position:fixed; bottom:90px; right:16px`).
            FAB("Novo evento")
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 90)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            // Default: "Home" ativo (pra screenshot bater com mockup canônico).
            if navSelection == nil { navSelection = navItems.first?.id }
        }
    }

    @ViewBuilder
    private func section<Content: View>(
        _ title: String,
        @ViewBuilder _ content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4) // 0.14em em 11pt
                .foregroundStyle(Color.textFaint)
            content()
        }
    }

    @ViewBuilder
    private func cardContent(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .tracking(-0.27) // -0.015em em 18pt
                .foregroundStyle(Color.text)
            Text(subtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textFaint)
        }
    }
}

#Preview {
    ThemeShowcaseView()
}
