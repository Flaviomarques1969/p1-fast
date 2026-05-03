// ═══════════════════════════════════════════════════════════
// PessoasView — bundle CRUD pilotos + passageiros
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompts #12 + #13 (bundled como "Pessoas").
//
// Os mockups canônicos `mockup-piloto-lista.html` e
// `mockup-passageiro-lista.html` foram desenhados como SELETORES
// dentro do fluxo de stint (eyebrow "Piloto" + título "Quem vai
// dirigir" + footer Cancelar/Confirmar). Aqui usamos a MESMA
// estética visual mas em modo CRUD: sub-tabs Pilotos/Passageiros,
// row tappável com radio escondido (sem selection state), botão
// dashed "Cadastrar piloto/passageiro" abre sheet de cadastro.
//
// Form mínimo (decisão do prompt #12+#13):
//   - Piloto: só nome (user_id FK fica pra Sprint 1A.6)
//   - Passageiro: só nome
// O mockup-cadastro mostra altura/peso/idade — esses campos ficam
// pra próxima migração quando o schema canônico ganhar as colunas.
//
// 4ª aba do BottomNav: Home / Eventos / Pessoas / Garagem (substitui
// "Pendências" placeholder do Prompt #8). Decisão #1 do design 1A.3
// resolvida: bundle "Pessoas" como aba dedicada.

import SwiftUI
import P1FastCore

enum PessoasSheet: Identifiable {
    case novoPiloto
    case novoPassageiro

    var id: String {
        switch self {
        case .novoPiloto: return "novo-piloto"
        case .novoPassageiro: return "novo-passageiro"
        }
    }
}

enum PessoasSubTab: String, CaseIterable, Identifiable {
    case pilotos = "Pilotos"
    case passageiros = "Passageiros"
    var id: String { rawValue }
}

struct PessoasView: View {
    @EnvironmentObject private var pilotoRepo: PilotoRepository
    @EnvironmentObject private var passageiroRepo: PassageiroRepository
    @State private var navSelection: BottomNavItem.ID?
    @State private var sheet: PessoasSheet?
    @State private var subTab: PessoasSubTab = .pilotos

    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Pessoas"),
        BottomNavItem("Garagem"),
    ]

    var initialSheet: PessoasSheet?
    var initialSubTab: PessoasSubTab?

    init(initialSheet: PessoasSheet? = nil, initialSubTab: PessoasSubTab? = nil) {
        self.initialSheet = initialSheet
        self.initialSubTab = initialSubTab
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            BottomNav(items: navItems, selection: $navSelection)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if navSelection == nil { navSelection = navItems[2].id }
            if let s = initialSubTab { subTab = s }
            if let sh = initialSheet, sheet == nil { sheet = sh }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novoPiloto:
                PilotoCadastroView(onClose: { sheet = nil })
                    .environmentObject(pilotoRepo)
            case .novoPassageiro:
                PassageiroCadastroView(onClose: { sheet = nil })
                    .environmentObject(passageiroRepo)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            contextHead
            subTabBar
            switch subTab {
            case .pilotos:
                pilotosSection
            case .passageiros:
                passageirosSection
            }
        }
    }

    private var contextHead: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: subTab == .pilotos ? "Pilotos" : "Passageiros")
            Text(subTab == .pilotos ? "Quem dirige" : "Quem anda junto")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(subTab == .pilotos
                 ? "Cadastrados ficam disponíveis em todo stint."
                 : "Passageiros são cadastrados uma vez e reaproveitados.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    private var subTabBar: some View {
        HStack(spacing: 6) {
            ForEach(PessoasSubTab.allCases) { tab in
                SubTabPill(label: tab.rawValue, isActive: tab == subTab) {
                    subTab = tab
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.xs)
    }

    @ViewBuilder
    private var pilotosSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            groupHead(title: "Cadastrados", count: pilotoRepo.pilotos.count)
            VStack(spacing: 8) {
                ForEach(pilotoRepo.pilotos, id: \.id) { p in
                    PersonRow(name: p.nome)
                }
                AddRow(label: "Cadastrar piloto") {
                    sheet = .novoPiloto
                }
            }
        }
    }

    @ViewBuilder
    private var passageirosSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            groupHead(title: "Cadastrados", count: passageiroRepo.passageiros.count)
            VStack(spacing: 8) {
                ForEach(passageiroRepo.passageiros, id: \.id) { p in
                    PersonRow(name: p.nome)
                }
                AddRow(label: "Cadastrar passageiro") {
                    sheet = .novoPassageiro
                }
            }
        }
    }

    private func groupHead(title: String, count: Int) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32)
                .foregroundStyle(Color.textFaint)
            Spacer()
            Text("\(count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.accent)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, 10)
    }
}

// MARK: - Sub-componentes locais

/// Pill estilo segmented control, espelha visual de `.subtab` do hub
/// (mesmo padrão de Capsule + accent quando ativo).
private struct SubTabPill: View {
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32)
                .foregroundStyle(isActive ? Color.onAccent : Color.textMuted)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isActive ? Color.accent : Color.clear)
                )
                .overlay(
                    Capsule()
                        .stroke(isActive ? Color.clear : Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .animation(Layout.snap, value: isActive)
    }
}

/// Row de pessoa (mockup-piloto-lista `.person-row`). Sem radio
/// porque a aba é CRUD, não selector. Visual idêntico ao mockup
/// fora isso (background surface, hairline, name 16/600).
private struct PersonRow: View {
    let name: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.08)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
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

/// Botão "+ Cadastrar piloto" (mockup `.add-row` — dashed border).
private struct AddRow: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07)
                    .foregroundStyle(Color.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(Color.border)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview("PessoasView — pilotos com seed") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let pilotoRepo = PilotoRepository(queue: queue)
    let passageiroRepo = PassageiroRepository(queue: queue)
    return PessoasView()
        .environmentObject(pilotoRepo)
        .environmentObject(passageiroRepo)
        .task {
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
        }
}

#Preview("PessoasView — aba passageiros vazia") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let pilotoRepo = PilotoRepository(queue: queue)
    let passageiroRepo = PassageiroRepository(queue: queue)
    return PessoasView(initialSubTab: .passageiros)
        .environmentObject(pilotoRepo)
        .environmentObject(passageiroRepo)
        .task {
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
        }
}
