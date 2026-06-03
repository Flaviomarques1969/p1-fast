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
    @EnvironmentObject private var navCoordinator: NavigationCoordinator
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

    /// Tab-like via NavigationCoordinator: cada item leva DIRETO pra
    /// tela alvo (substitui o stack). "Garagem" = no-op (já aqui).
    private func handleNavSelect(_ item: BottomNavItem) {
        switch item.label {
        case "Home":      navCoordinator.goHome()
        case "Eventos":   navCoordinator.goTo(.eventos)
        case "Cadastros": navCoordinator.goTo(.cadastros)
        case "Garagem":   break
        default:          break
        }
    }

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140) // espaço pro menu de baixo (root)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .overlay(alignment: .bottomTrailing) {
            FAB("Novo carro") { sheet = .novo }
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 110) // sobe pro menu não cobrir
        }
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let s = initialSheet, sheet == nil { sheet = s }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novo:
                CarroNovoFormView(onClose: { sheet = nil })
            case .editar:
                // Caso preservado por compatibilidade com ContentView. Tocar
                // num carro AGORA empurra o painel pela pilha (CarroCard
                // chama navCoordinator.push abaixo). Esse case raramente
                // dispara, mas se vier por launch arg, ainda abre o painel.
                EmptyView()
            case .trechos, .pecas, .manutencao:
                // 2026-05-17 Flávio "menu inferior sempre visível":
                // estes destinos viraram push do NavigationStack pai
                // (handleAtalho abaixo). Esse case fica como no-op
                // por compatibilidade com launch args antigos.
                EmptyView()
            }
        }
    }

    /// 2026-05-17 — atalho que substitui o `sheet = .pecas|.manutencao|.trechos`
    /// pra empurrar pela pilha de navegação (mantém o menu inferior visível).
    private func handleAtalho(_ destino: HomeNavTarget) {
        navCoordinator.navPath.append(destino)
        navCoordinator.pilha.append(destino)
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
                        fotoUrl: repo.fotoPublicURL(carro.fotoUrl),
                        isAtivo: idx == 0
                    ) {
                        // 2026-05-16 Flávio "menu sempre embaixo": tocar
                        // num carro empurra o painel pela pilha do
                        // NavigationCoordinator, em vez de abrir janela
                        // modal que cobre o menu de baixo.
                        navCoordinator.navPath.append(HomeNavTarget.carroDashboard(carroId: carro.id))
                    }
                }
            }
        }
    }

    private var contextHead: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "Garagem")
            Text(headerTitle)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6) // -0.025em em 24pt
                .foregroundStyle(Color.text)
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
            atalhosRow
                .padding(.top, 6)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    /// Linha de atalhos da Garagem (Flávio 2026-05-17): botões um pouco
    /// maiores, padronizados e ordenados.
    /// Ordem fixa: Estoque · Manutenção · Autódromos.
    /// "Manutenção" é placeholder (função entra em rodada seguinte).
    /// 2026-05-17 (Flávio "menu inferior sempre visível"): destinos
    /// empurrados pela pilha do NavigationStack pai (não mais janelas
    /// modais), pra que o menu de baixo continue visível dentro deles.
    private var atalhosRow: some View {
        HStack(spacing: 8) {
            botaoAtalho(label: "Estoque") { handleAtalho(.estoque) }
            botaoAtalho(label: "Manutenção") { handleAtalho(.manutencao) }
            botaoAtalho(label: "Autódromos") { handleAtalho(.autodromosLista) }
        }
    }

    /// Botão de atalho do header (versão maior, padronizada — Flávio
    /// 2026-05-17 "podem ser um pouco maiores"). Antes era capsule
    /// pequeno tipo pílula; agora é cartão arredondado com mais respiro.
    /// Cada botão ocupa o mesmo espaço (flex), garantindo alinhamento.
    private func botaoAtalho(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .tracking(-0.07)
                .foregroundStyle(Color.text)
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
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
    case pecas
    /// 2026-05-17 Flávio: função "Manutenção" (placeholder).
    /// Botão criado no header, função em si entra em rodada seguinte.
    case manutencao

    var id: String {
        switch self {
        case .novo: return "novo"
        case .editar(let id): return "editar-\(id)"
        case .trechos: return "trechos"
        case .pecas: return "pecas"
        case .manutencao: return "manutencao"
        }
    }
}

// MARK: - CarroCard (S2 — Conceito 1: avatar grande à esquerda, 3 números embaixo)

private struct CarroCard: View {
    let carro: Carro
    let stints: Int
    let metricas: CarroMetricas
    let fotoUrl: URL?
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

    /// Quadrado de 84pt com cantos arredondados. UX "foto já está lá":
    /// 1) tenta cache local em disco → render imediato
    /// 2) se não tem, cai pra AsyncImage do servidor (rede)
    /// 3) se nem URL tem, mostra swatch colorido
    @State private var fotoLocal: UIImage?
    private var fotoOuSwatch: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(swatchColor)

            if let local = fotoLocal {
                Image(uiImage: local).resizable().scaledToFill()
            } else if let url = fotoUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView().tint(Color.textFaint)
                    case .success(let img):
                        img.resizable().scaledToFill()
                    case .failure:
                        EmptyView()
                    @unknown default:
                        EmptyView()
                    }
                }
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
        )
        .task(id: carro.id) {
            fotoLocal = CarroRepository.carregarFotoLocal(carroId: carro.id)
        }
    }

    private var swatchColor: Color {
        guard let hex = carro.cor, let parsed = Color(hex: hex) else {
            return Color.surfaceHover
        }
        return parsed
    }

    /// Linha dos 3 números (Conceito 1 aprovado pelo Flávio em 2026-05-12):
    /// km no app · velocidade máxima · autódromos. Valores ausentes viram "—".
    /// ViewThatFits: tenta 3 colunas; se não couber (fonte grande do iOS),
    /// cai pra layout vertical em 3 linhas (cada métrica numa linha completa).
    private var numerosRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                metricaCol(valor: formatKm(metricas.kmRodada), unidade: "km", rotulo: "no app")
                metricaCol(valor: formatVmax(metricas.vmaxKmh), unidade: "km/h", rotulo: "vel. máxima")
                metricaCol(valor: "\(metricas.autodromosCount)", unidade: nil, rotulo: "autódromos")
            }
            VStack(alignment: .leading, spacing: 6) {
                metricaLinha(valor: formatKm(metricas.kmRodada), unidade: "km", rotulo: "no app")
                metricaLinha(valor: formatVmax(metricas.vmaxKmh), unidade: "km/h", rotulo: "vel. máxima")
                metricaLinha(valor: "\(metricas.autodromosCount)", unidade: nil, rotulo: "autódromos")
            }
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
                    .fixedSize(horizontal: true, vertical: false)
                if let unidade = unidade {
                    Text(unidade)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            Text(rotulo.uppercased())
                .font(.system(size: 9, weight: .medium))
                .tracking(0.72) // 0.08em em 9pt
                .foregroundStyle(Color.textFaint)
                .fixedSize(horizontal: true, vertical: false)
        }
    }

    /// Layout vertical de uma métrica (fallback do ViewThatFits quando o
    /// usuário aumenta o tamanho do texto e as 3 colunas não cabem mais).
    /// Mostra "245 km · no app" na mesma linha — preserva legibilidade
    /// total mesmo em Dynamic Type grande.
    private func metricaLinha(valor: String, unidade: String?, rotulo: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(valor)
                .font(.system(size: 16, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.text)
            if let unidade = unidade {
                Text(unidade)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }
            Text("·")
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Color.textFaint)
            Text(rotulo)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.textFaint)
            Spacer(minLength: 0)
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
