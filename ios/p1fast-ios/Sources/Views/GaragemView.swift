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
import P1FastCore

struct GaragemView: View {
    @EnvironmentObject private var repo: CarroRepository
    @State private var navSelection: BottomNavItem.ID?
    @State private var sheet: GaragemSheet?
    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Cadastros"),
        BottomNavItem("Garagem"),
    ]

    /// Permite abrir a tela já com uma sheet visível — usado pelos
    /// launch args `--p1-garagem-novo` / `--p1-garagem-carro` pra
    /// screenshot dos modais.
    var initialSheet: GaragemSheet?

    init(initialSheet: GaragemSheet? = nil) {
        self.initialSheet = initialSheet
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
        .overlay(alignment: .bottomTrailing) {
            FAB("Novo carro") { sheet = .novo }
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 90)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            // BottomNav começa com "Garagem" ativo (4º item).
            if navSelection == nil { navSelection = navItems.last?.id }
            if let s = initialSheet, sheet == nil { sheet = s }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novo:
                CarroNovoFormView(onClose: { sheet = nil })
            case .editar(let carroId):
                CarroModalView(carroId: carroId, onClose: { sheet = nil })
            case .trechos:
                NavigationStack {
                    TrechoListaView(onClose: { sheet = nil })
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            contextHead
            summaryCard
            VStack(spacing: 10) {
                ForEach(Array(repo.carros.enumerated()), id: \.element.id) { idx, carro in
                    CarroCard(
                        carro: carro,
                        stints: repo.stintsPorCarro[carro.id] ?? 0,
                        metricas: repo.metricasPorCarro[carro.id] ?? .vazio,
                        isAtivo: idx == 0
                    ) {
                        sheet = .editar(carroId: carro.id)
                    }
                }
            }
        }
    }

    private var contextHead: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Eyebrow(text: "Garagem")
                Spacer(minLength: 0)
                trechosLink
            }
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

// MARK: - CarroCard (S2 — Conceito 1: avatar grande à esquerda, 3 números embaixo)

private struct CarroCard: View {
    let carro: Carro
    let stints: Int
    let metricas: CarroMetricas
    let isAtivo: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: 16) {
                fotoOuSwatch
                VStack(alignment: .leading, spacing: 3) {
                    Text(carro.apelido)
                        .font(.system(size: 19, weight: .semibold))
                        .tracking(-0.285) // -0.015em em 19pt
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    Text(modelLine)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                        .lineLimit(1)
                    numerosRow
                        .padding(.top, 10)
                    if isAtivo {
                        EventTag(text: "Próximo evento", kind: .accent)
                            .padding(.top, 8)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(isAtivo ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    /// Quadrado de 84pt com cantos arredondados. Na Parte A do S2 mostra
    /// só a cor de fundo do carro (placeholder). Na Parte C (próximo passo)
    /// passa a exibir a foto real do servidor quando o carro tiver `foto_url`.
    private var fotoOuSwatch: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(swatchColor)
            .frame(width: 84, height: 84)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
    }

    private var swatchColor: Color {
        guard let hex = carro.cor, let parsed = Color(hex: hex) else {
            return Color.surfaceHover
        }
        return parsed
    }

    /// Linha dos 3 números (Conceito 1 aprovado pelo Flávio em 2026-05-12):
    /// km no app · velocidade máxima · autódromos. Valores ausentes viram "—".
    private var numerosRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            metricaCol(valor: formatKm(metricas.kmRodada), unidade: "km", rotulo: "no app")
            metricaCol(valor: formatVmax(metricas.vmaxKmh), unidade: "km/h", rotulo: "vel. máxima")
            metricaCol(valor: "\(metricas.autodromosCount)", unidade: nil, rotulo: "autódromos")
        }
    }

    private func metricaCol(valor: String, unidade: String?, rotulo: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(valor)
                    .font(.system(size: 18, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-0.27) // -0.015em em 18pt
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                if let unidade = unidade {
                    Text(unidade)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                }
            }
            Text(rotulo.uppercased())
                .font(.system(size: 9, weight: .medium))
                .tracking(0.72) // 0.08em em 9pt
                .foregroundStyle(Color.textFaint)
        }
    }

    private func formatKm(_ km: Double?) -> String {
        guard let km = km, km > 0 else { return "—" }
        if km >= 1000 {
            return String(format: "%.0f", km)
        }
        return String(format: "%.0f", km)
    }

    private func formatVmax(_ kmh: Double?) -> String {
        guard let kmh = kmh, kmh > 0 else { return "—" }
        return String(format: "%.0f", kmh)
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
