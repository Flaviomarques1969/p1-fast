// ═══════════════════════════════════════════════════════════
// GaragemView — port de _design-reference/mockup-garagem.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #9. Hub do carro pessoal.
//
// Composição (1:1 com mockup):
//   - context-head: eyebrow "Garagem" + título "N carros" + linha "última frase"
//   - summary-card 3-stats: Total / Pronto / Manutenção
//   - lista de cards .car (swatch + apelido + modelo·categoria + tags + chev)
//     · primeiro card vira `.car--ativo` quando há próximo evento
//   - FAB "+ Novo carro"
//   - BottomNav com Garagem ATIVO
//
// CRUD via CarroRepository (GRDB local). FAB abre CarroNovoFormView
// como sheet; tap em card abre CarroModalView (edição completa).

import SwiftUI
import UIKit
import P1FastCore

struct GaragemView: View {
    @EnvironmentObject private var repo: CarroRepository
    @State private var sheet: GaragemSheet?
    /// Sub-aba ativa: Carros (lista de carros) ou um dos cadastros que
    /// migraram pra cá (Pilotos/Passageiros/Combustível/Lições). 2026-06-14.
    @State private var subTab: GaragemSubTab = .carros

    /// Permite abrir a tela já com uma sheet visível — usado pelos
    /// launch args `--p1-garagem-novo` / `--p1-garagem-carro` pra
    /// screenshot dos modais.
    var initialSheet: GaragemSheet?
    /// Handler do menu inferior — injetado pela HomeView pra permitir
    /// pular pra outra aba direto desta sub-view (fix tab-bar 2026-05-12).
    var onNavSelect: (BottomNavItem) -> Void = { _ in }

    init(initialSheet: GaragemSheet? = nil,
         onNavSelect: @escaping (BottomNavItem) -> Void = { _ in }) {
        self.initialSheet = initialSheet
        self.onNavSelect = onNavSelect
    }

    var body: some View {
        VStack(spacing: 0) {
            garagemHeaderBar
            subTabBar
            Group {
                switch subTab {
                case .carros:
                    carrosScroll
                case .estoqueGeral:
                    EstoqueGeralView()
                case .pilotos:
                    PessoasView(embeddedSubTab: .pilotos)
                case .passageiros:
                    PessoasView(embeddedSubTab: .passageiros)
                case .combustivel:
                    PessoasView(embeddedSubTab: .combustiveis)
                case .licoes:
                    PessoasView(embeddedSubTab: .licoes)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.surface)
        .overlay(alignment: .bottomTrailing) {
            if subTab == .carros {
                FAB("Novo carro") { sheet = .novo }
                    .padding(.trailing, Spacing.md)
                    .padding(.bottom, Spacing.md)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if let s = initialSheet, sheet == nil { sheet = s }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novo:
                CarroNovoFormView(onClose: { sheet = nil })
            case .editar(let carroId):
                CarroHubView(carroId: carroId, onClose: { sheet = nil })
            case .trechos:
                NavigationStack {
                    TrechoListaView(onClose: { sheet = nil })
                }
            }
        }
    }

    /// Aba Carros: lista de carros (o conteúdo original da Garagem).
    private var carrosScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                carrosHead
                summaryCard
                VStack(spacing: 10) {
                    ForEach(Array(repo.carros.enumerated()), id: \.element.id) { idx, carro in
                        NavigationLink(value: HomeNavTarget.carroHub(carroId: carro.id)) {
                            CarroCard(
                                carro: carro,
                                stints: repo.stintsPorCarro[carro.id] ?? 0,
                                isAtivo: idx == 0
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Barra superior fixa da Garagem — eyebrow + atalho "Trechos da pista".
    private var garagemHeaderBar: some View {
        HStack(alignment: .firstTextBaseline) {
            Eyebrow(text: "Garagem")
            Spacer(minLength: 0)
            trechosLink
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.sm)
    }

    /// Fileira de sub-abas: Carros · Pilotos · Passageiros · Combustível · Lições.
    private var subTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(GaragemSubTab.allCases) { tab in
                    GaragemSubTabPill(label: tab.label, isActive: tab == subTab) {
                        subTab = tab
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.sm)
        }
    }

    /// Título/subtítulo da aba Carros (sem eyebrow — já está na barra de cima).
    private var carrosHead: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(headerTitle)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6) // -0.025em em 24pt
                .foregroundStyle(Color.text)
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    /// Botão "Trechos da pista" no header, alinhado ao eyebrow.
    /// Abre TrechoListaView (Sprint 1A.5 — Prompt #19) como sheet
    /// com NavigationStack pra suportar push futuro.
    private var trechosLink: some View {
        Button {
            sheet = .trechos
        } label: {
            HStack(spacing: 4) {
                Text("Trechos da pista")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.06 * 12)
                Text("›")
                    .font(.system(size: 12, weight: .regular))
            }
            .foregroundStyle(Color.text)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var headerTitle: String {
        let n = repo.carros.count
        if n == 0 { return "Garagem vazia" }
        if n == 1 { return "1 carro" }
        return "\(n) carros"
    }

    private var headerSubtitle: String {
        guard let primeiro = repo.carros.first else {
            return "Cadastre o primeiro pra começar a registrar stints."
        }
        return "Você tem \(primeiro.apelido) cadastrado. Toque pra editar setup ou pneus."
    }

    private var summaryCard: some View {
        HStack(spacing: Spacing.sm) {
            statCell(value: "\(repo.carros.count)", label: "Total", color: Color.text)
            statCell(value: "\(repo.carros.count)", label: "Pronto", color: Color.bom)
            statCell(value: "0", label: "Manutenção", color: Color.atencao)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func statCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 20, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.4)
                .foregroundStyle(color)
                .lineLimit(1)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.8)
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.surfaceHover)
        )
    }
}

// MARK: - Sheet enum

enum GaragemSheet: Identifiable, Equatable {
    case novo
    case editar(carroId: String)
    case trechos

    var id: String {
        switch self {
        case .novo: return "novo"
        case .editar(let id): return "editar-\(id)"
        case .trechos: return "trechos"
        }
    }
}

// MARK: - Sub-abas da Garagem

/// Carros + os cadastros que migraram da antiga aba "Cadastros" (2026-06-14).
enum GaragemSubTab: String, CaseIterable, Identifiable {
    case carros, estoqueGeral, pilotos, passageiros, combustivel, licoes
    var id: String { rawValue }
    var label: String {
        switch self {
        case .carros: return "Carros"
        case .estoqueGeral: return "Estoque geral"
        case .pilotos: return "Pilotos"
        case .passageiros: return "Passageiros"
        case .combustivel: return "Combustível"
        case .licoes: return "Lições"
        }
    }
}

/// Pill da sub-aba (mesmo visual do segmented control de Cadastros).
private struct GaragemSubTabPill: View {
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
                .background(Capsule().fill(isActive ? Color.accent : Color.clear))
                .overlay(Capsule().stroke(isActive ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .animation(Layout.snap, value: isActive)
    }
}

// MARK: - CarroCard

private struct CarroCard: View {
    let carro: Carro
    let stints: Int
    let isAtivo: Bool

    @State private var foto: UIImage?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            swatch
            VStack(alignment: .leading, spacing: 3) {
                Text(carro.apelido)
                    .font(.system(size: 17, weight: .semibold))
                    .tracking(-0.085)
                    .foregroundStyle(Color.text)
                Text(modelLine)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                HStack(spacing: 6) {
                    if isAtivo {
                        EventTag(text: "Próximo evento", kind: .accent)
                    }
                    EventTag(text: "\(stints) stints", kind: .neutral)
                }
                .padding(.top, Spacing.sm)
            }
            Spacer(minLength: 0)
            chev
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(isAtivo ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onAppear { foto = CarroFoto.carregar(carroId: carro.id) }
    }

    /// Foto do carro em círculo; sem foto, ícone neutro de carro.
    /// (2026-05-31: a cor saiu — a identidade do carro é a foto.)
    @ViewBuilder
    private var swatch: some View {
        if let foto {
            Image(uiImage: foto)
                .resizable()
                .scaledToFill()
                .frame(width: 48, height: 48)
                .clipShape(Circle())
                .overlay(
                    Circle().stroke(isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 2)
                )
                .overlay(
                    isAtivo
                    ? Circle().stroke(Color.accent.opacity(0.14), lineWidth: 3).frame(width: 54, height: 54)
                    : nil
                )
        } else {
            ZStack {
                Circle()
                    .fill(Color.surfaceRaised)
                    .frame(width: 48, height: 48)
                    .overlay(
                        Circle().stroke(isAtivo ? Color.accent.opacity(0.35) : Color.border, lineWidth: 2)
                    )
                Image(systemName: "car.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.textFaint)
            }
            .frame(width: 48, height: 48)
            .overlay(
                isAtivo
                ? Circle().stroke(Color.accent.opacity(0.14), lineWidth: 3).frame(width: 54, height: 54)
                : nil
            )
        }
    }

    private var modelLine: String {
        let modelo = carro.modelo?.trimmingCharacters(in: .whitespaces)
        let categoria = carro.categoria?.trimmingCharacters(in: .whitespaces)
        switch (modelo, categoria) {
        case let (m?, c?) where !m.isEmpty && !c.isEmpty:
            return "\(m) · \(c)"
        case let (m?, _) where !m.isEmpty:
            return m
        case let (_, c?) where !c.isEmpty:
            return c
        default:
            return "Sem modelo cadastrado"
        }
    }

    private var chev: some View {
        Text("›")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .padding(.top, 12)
    }
}

// MARK: - Color hex helper

extension Color {
    /// Cria uma Color a partir de hex `#rrggbb` ou `rrggbb`. Retorna nil
    /// se o input for inválido.
    init?(hex: String) {
        let s = hex.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "#", with: "")
        guard s.count == 6, let int = UInt32(s, radix: 16) else { return nil }
        let r = Double((int >> 16) & 0xFF) / 255.0
        let g = Double((int >> 8) & 0xFF) / 255.0
        let b = Double(int & 0xFF) / 255.0
        self = Color(red: r, green: g, blue: b)
    }
}

// MARK: - Previews (mock — não usa GRDB real)

#Preview("Garagem — vazia") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CarroRepository(queue: queue)
    return GaragemView()
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
