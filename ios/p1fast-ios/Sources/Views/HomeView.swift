// ═══════════════════════════════════════════════════════════
// HomeView — port de mockup-home-cheio.html + mockup-home-vazio.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #8.
//
// Estados:
//   - .filled : tem 1+ carro ou 1+ evento → mostra hub completo
//                (3-stats no topo, evento ativo hoje destacado, próximo
//                 evento, lista de carros recentes, FAB, BottomNav).
//   - .empty  : zero carros e zero eventos → onboarding com 2 CTAs
//                ("Cadastrar primeiro carro" + "Criar primeiro evento").
//
// 1:1 com canônicos: `_design-reference/mockup-home-{cheio,vazio}.html`.
// Tokens só de Theme.swift. Tratamento "você", sem ícones decorativos.

import SwiftUI

enum HomeState {
    case filled(HomeData)
    case empty
}

/// Destinos navegáveis a partir da Home — alimentam o `NavigationPath`
/// quando o usuário toca BottomNav, FAB ou CTAs do estado vazio.
/// MS-10 Sprint D: cabeação mínima da Home pra desbloquear cadastro
/// de carro / criação de evento via iPhone real (antes só via launch
/// args do simulador).
enum HomeNavTarget: Hashable {
    case eventos
    case eventosNovo
    case cadastros
    case garagem
    case garagemNovo
    /// Atalho dev — abre TelemetriaView (sessão demo descartável). Usado
    /// pra captura rápida em test drive sem passar pelo fluxo Evento →
    /// Stint. Botão fica embaixo do conteúdo da Home, marcado como
    /// "(dev)" pra não ser confundido com fluxo canônico.
    case telemetriaDemo
}

/// Dados necessários para renderizar o estado cheio. Por enquanto vêm
/// como mock — Sprint 1A.6 troca pelo Repository real (GRDB +
/// sync drainer Supabase).
struct HomeData {
    let carrosTotal: Int
    let eventosTotal: Int
    let stintsTotal: Int
    let eventoAtivoHoje: EventoMock?
    let proximoEvento: EventoMock?
    let carrosRecentes: [CarroMock]
    // S3 da rodada 1 (2026-05-12): nome do piloto + 3 estatísticas novas
    // pros 6 cards clicáveis da tela inicial.
    /// Primeiro nome do piloto logado (pilotos.user_id == auth.uid()).
    /// Nil quando não há login ou quando o cadastro do piloto ainda não
    /// foi feito — a saudação cai pra versão sem nome.
    let pilotoPrimeiroNome: String?
    /// Quantos autódromos diferentes onde o time já correu.
    let autodromosTotal: Int
    /// Quantos trechos onde o piloto tem o tempo recorde dele (PB).
    let recordesTotal: Int
    /// Total de voltas registradas em todos os stints encerrados.
    let voltasTotal: Int
}

struct EventoMock: Identifiable, Equatable {
    let id = UUID()
    /// "Brasília", "Interlagos", etc.
    let pista: String
    /// "Auto. Int. Nelson Piquet", "Auto. José Carlos Pace", etc.
    let pistaOficial: String?
    /// Data ISO `2026-05-02` (TZ neutra).
    let dataISO: String
    /// "09:00", "14:30" etc — nullable.
    let horario: String?
}

struct CarroMock: Identifiable, Equatable {
    let id = UUID()
    let apelido: String
    /// "Celta 1.4 turismo", "Honda Civic" etc.
    let modeloCategoria: String
    /// Cor do swatch (token Color).
    let cor: Color
    let stints: Int
    // S2 — Conceito 1: 3 números no card do carro.
    /// Quilometragem estimada rodada dentro do app (nil → "—").
    let kmRodada: Double?
    /// Velocidade máxima (km/h) já atingida pelo carro (nil → "—").
    let vmaxKmh: Double?
    /// Quantos autódromos diferentes o carro já visitou.
    let autodromosCount: Int
}

// MARK: - View raiz

struct HomeView: View {
    let state: HomeState
    /// Opcional pra previews — quando presente, mostra SyncStatusBadge no
    /// header e abre SincronizacaoView no tap.
    var syncCoordinator: SyncCoordinator? = nil
    /// Closure opcional injetada por ContentView pra construir a
    /// TelemetriaView com queue + trackBundle (a Home não tem acesso
    /// direto aos repositórios). Quando nil, o atalho dev fica oculto.
    var telemetriaDevView: (() -> AnyView)? = nil
    @State private var navSelection: BottomNavItem.ID?
    @State private var showSyncSheet = false
    @State private var navPath = NavigationPath()
    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Cadastros"),
        BottomNavItem("Garagem"),
    ]

    var body: some View {
        NavigationStack(path: $navPath) {
            shell
                .navigationDestination(for: HomeNavTarget.self) { target in
                    destinationView(for: target)
                }
        }
    }

    private var shell: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140) // espaço pra FAB/BottomNav fixos
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            BottomNav(items: navItems, selection: $navSelection, onSelect: handleNavSelect)
        }
        .overlay(alignment: .bottomTrailing) {
            if case .filled = state {
                FAB("Novo evento", action: { navPath.append(HomeNavTarget.eventosNovo) })
                    .padding(.trailing, Spacing.md)
                    .padding(.bottom, 90)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if navSelection == nil { navSelection = navItems.first?.id }
        }
        .overlay(alignment: .topTrailing) {
            if let coord = syncCoordinator {
                SyncStatusBadge(coordinator: coord, compact: false) {
                    showSyncSheet = true
                }
                .padding(.trailing, Spacing.lg)
                .padding(.top, Spacing.md)
            }
        }
        .sheet(isPresented: $showSyncSheet) {
            if let coord = syncCoordinator {
                SincronizacaoView()
                    .environmentObject(coord)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            switch state {
            case .filled(let data):
                FilledContent(
                    data: data,
                    onTapCard: { destino in handleNavSelect(destino) }
                )
            case .empty:
                EmptyContent(
                    onCadastrarCarro: { navPath.append(HomeNavTarget.garagemNovo) },
                    onCriarEvento: { navPath.append(HomeNavTarget.eventosNovo) }
                )
            }
            // Atalho dev pra captura rápida em test drive — fica embaixo
            // do conteúdo canônico. Só renderiza quando o caller injetou
            // um builder válido.
            if telemetriaDevView != nil {
                DevShortcuts(onAbrirTelemetria: {
                    navPath.append(HomeNavTarget.telemetriaDemo)
                })
            }
        }
    }

    @ViewBuilder
    private func destinationView(for target: HomeNavTarget) -> some View {
        switch target {
        case .eventos:
            EventosListaView()
        case .eventosNovo:
            EventosListaView(initialSheet: .novo)
        case .cadastros:
            PessoasView()
        case .garagem:
            GaragemView()
        case .garagemNovo:
            GaragemView(initialSheet: .novo)
        case .telemetriaDemo:
            if let builder = telemetriaDevView {
                builder()
            } else {
                EmptyView()
            }
        }
    }

    /// BottomNav é tab-like visualmente, mas comportamento é push de
    /// NavigationStack — sub-views ganham back button do sistema. Home
    /// é a única raiz; tocar "Home" volta pra raiz.
    private func handleNavSelect(_ item: BottomNavItem) {
        switch item.label {
        case "Home":
            if !navPath.isEmpty { navPath = NavigationPath() }
        case "Eventos":
            navPath.append(HomeNavTarget.eventos)
        case "Cadastros":
            navPath.append(HomeNavTarget.cadastros)
        case "Garagem":
            navPath.append(HomeNavTarget.garagem)
        default:
            break
        }
        // Reset selection pro item Home assim que voltar pra raiz —
        // BottomNav só aparece na Home, então sub-views não precisam
        // do estado.
        navSelection = navItems.first?.id
    }

    /// S3 rodada 1: navegação dos 6 cards de estatística. Decisão P3 #2.3
    /// — os 4 cards novos (Stints/Autódromos/Recordes/Voltas) redirecionam
    /// pra Eventos. Carros vai pra Garagem. Eventos vai pra Eventos.
    /// Quando filtros chegarem em sprints futuras, a tela de Eventos
    /// pode receber parâmetro pra abrir já filtrada.
    private func handleNavSelect(_ destino: HomeStatDestino) {
        switch destino {
        case .carros:
            navPath.append(HomeNavTarget.garagem)
        case .eventos, .stints, .autodromos, .recordes, .voltas:
            navPath.append(HomeNavTarget.eventos)
        }
    }
}

/// Destinos de toque dos 6 cards de estatística da Home. P3 #2.3:
/// Stints/Autódromos/Recordes/Voltas redirecionam pra Eventos com filtro
/// (filtro fica pra sprint futura — hoje só abre Eventos).
enum HomeStatDestino {
    case carros, eventos, stints, autodromos, recordes, voltas
}

// MARK: - Estado cheio

private struct FilledContent: View {
    let data: HomeData
    /// S3 da rodada 1 (2026-05-12): callback de toque nos 6 cards de
    /// estatística. HomeView passa pra cá pra navegar via NavigationStack.
    let onTapCard: (HomeStatDestino) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Header — espelha `.header` do mockup-home-cheio.html
            VStack(alignment: .leading, spacing: 6) {
                Text("P1 FAST")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.98) // 0.18em em 11pt
                    .foregroundStyle(Color.textFaint)
                Text(headerStatusLine(data: data))
                    .font(.titleP1)
                    .tracking(-0.44) // -0.02em em 22pt
                    .foregroundStyle(Color.text)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.sm)

            // S3 #2 — 6 cards clicáveis em grid 3x2.
            SummaryStats([
                StatItem(value: "\(data.carrosTotal)", label: "Carros",
                         onTap: { onTapCard(.carros) }),
                StatItem(value: "\(data.eventosTotal)", label: "Eventos",
                         onTap: { onTapCard(.eventos) }),
                StatItem(value: "\(data.stintsTotal)", label: "Stints",
                         onTap: { onTapCard(.stints) }),
                StatItem(value: "\(data.autodromosTotal)", label: "Autódromos",
                         onTap: { onTapCard(.autodromos) }),
                StatItem(value: "\(data.recordesTotal)", label: "Recordes",
                         onTap: { onTapCard(.recordes) }),
                StatItem(value: "\(data.voltasTotal)", label: "Voltas",
                         onTap: { onTapCard(.voltas) }),
            ], columns: 3)

            if let evento = data.eventoAtivoHoje {
                EventoAtivoHojeCard(evento: evento)
            }

            if let proximo = data.proximoEvento {
                ProximoEventoCard(evento: proximo, hojeISO: data.eventoAtivoHoje?.dataISO ?? todayISO())
            }

            // S3 #3 — bloco "Garagem" substitui "Carros recentes" e mostra
            // TODOS os carros (não só 3). Toque no cabeçalho ou em qualquer
            // carro leva pra Garagem completa.
            if !data.carrosRecentes.isEmpty {
                Button(action: { onTapCard(.carros) }) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Garagem".uppercased())
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(1.54)
                            .foregroundStyle(Color.textFaint)
                        Text(data.carrosTotal == 1 ? "1 carro" : "\(data.carrosTotal) carros")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                        Spacer()
                        Text("Ver todos ›")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.accent)
                    }
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, Spacing.sm)
                }
                .buttonStyle(.plain)

                VStack(spacing: Spacing.sm) {
                    ForEach(data.carrosRecentes) { carro in
                        Button(action: { onTapCard(.carros) }) {
                            CarroRow(carro: carro)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    /// S3 da rodada 1 (2026-05-12): adiciona ", <PrimeiroNome>" ao fim
    /// de qualquer um dos 3 estados quando há piloto logado (decisão
    /// Flávio: aplica nos 3 estados, recomendação P3 #1).
    /// "Hoje em Brasília, Flávio" / "Próximo evento em 3 dias, Flávio"
    /// / "Sem eventos planejados, Flávio".
    private func headerStatusLine(data: HomeData) -> AttributedString {
        let nomeSufixo: String = {
            guard let n = data.pilotoPrimeiroNome,
                  !n.trimmingCharacters(in: .whitespaces).isEmpty else { return "" }
            return ", \(n)"
        }()

        if let ativo = data.eventoAtivoHoje {
            var s = AttributedString("Hoje em \(ativo.pista)\(nomeSufixo)")
            if let range = s.range(of: ativo.pista) {
                s[range].foregroundColor = Color.accent
            }
            return s
        }
        if let proximo = data.proximoEvento {
            let dias = daysFromTodayToISO(proximo.dataISO)
            let label = dias == 1 ? "amanhã" : "em \(dias) dias"
            var s = AttributedString("Próximo evento \(label)\(nomeSufixo)")
            if let range = s.range(of: label) {
                s[range].foregroundColor = Color.accent
            }
            return s
        }
        return AttributedString("Sem eventos planejados\(nomeSufixo)")
    }
}

// MARK: - Cards

/// Card destacado em accent — evento ativo hoje. Espelha o `.card` do
/// mockup-home-cheio "Stint em andamento" mas com border accent (focus
/// visual do estado "está acontecendo agora").
private struct EventoAtivoHojeCard: View {
    let evento: EventoMock

    var body: some View {
        Card(style: .accent) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Eyebrow(text: "Ativo · hoje")
                Text("\(evento.pista) · \(formatDateLong(evento.dataISO))")
                    .font(.system(size: 18, weight: .semibold))
                    .tracking(-0.27)
                    .foregroundStyle(Color.text)
                if let oficial = evento.pistaOficial {
                    Text(subtitleLine(evento: evento, oficial: oficial))
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
        }
    }

    private func subtitleLine(evento: EventoMock, oficial: String) -> String {
        if let h = evento.horario {
            return "\(formatWeekdayShort(evento.dataISO)), \(formatDateShort(evento.dataISO)) · \(h) · \(oficial)"
        }
        return "\(formatWeekdayShort(evento.dataISO)), \(formatDateShort(evento.dataISO)) · \(oficial)"
    }
}

/// Card neutro — próximo evento agendado. Espelha o `.card` "Próximo
/// evento" do mockup com countdown grande.
private struct ProximoEventoCard: View {
    let evento: EventoMock
    let hojeISO: String

    private var dias: Int {
        daysBetween(fromISO: hojeISO, toISO: evento.dataISO)
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Eyebrow(text: "Próximo evento")

                HStack(alignment: .lastTextBaseline, spacing: Spacing.sm) {
                    Text("\(dias)")
                        .font(.system(size: 36, weight: .semibold))
                        .monospacedDigit()
                        .tracking(-1.08) // -0.03em em 36pt
                        .foregroundStyle(Color.accent)
                    Text(dias == 1 ? "DIA" : "DIAS")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(1.1) // 0.1em em 11pt
                        .foregroundStyle(Color.textFaint)
                }

                Text("\(evento.pista) · \(formatDateLong(evento.dataISO))")
                    .font(.system(size: 18, weight: .semibold))
                    .tracking(-0.27)
                    .foregroundStyle(Color.text)
                    .padding(.top, Spacing.xs)

                if let oficial = evento.pistaOficial {
                    Text("\(formatWeekdayShort(evento.dataISO)), \(formatDateShort(evento.dataISO)) · \(oficial)")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
        }
    }
}

// MARK: - Carros recentes (S2 — Conceito 1)

/// Linha de carro com avatar grande de 84pt à esquerda e 3 números embaixo
/// (km no app · velocidade máxima · autódromos). Espelha o mesmo padrão
/// do `CarroCard` da Garagem — conceito 1 aprovado por Flávio em 2026-05-12.
private struct CarroRow: View {
    let carro: CarroMock

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(carro.cor)
                .frame(width: 84, height: 84)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(carro.apelido)
                    .font(.system(size: 19, weight: .semibold))
                    .tracking(-0.285) // -0.015em em 19pt
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                Text(carro.modeloCategoria)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .lineLimit(1)
                numerosRow
                    .padding(.top, 10)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 16)
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

    /// ViewThatFits: tenta 3 colunas; se a fonte grande do iOS quebrar,
    /// cai pra layout vertical com cada métrica numa linha completa.
    private var numerosRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                metricaCol(valor: formatKm(carro.kmRodada), unidade: "km", rotulo: "no app")
                metricaCol(valor: formatVmax(carro.vmaxKmh), unidade: "km/h", rotulo: "vel. máxima")
                metricaCol(valor: "\(carro.autodromosCount)", unidade: nil, rotulo: "autódromos")
            }
            VStack(alignment: .leading, spacing: 6) {
                metricaLinha(valor: formatKm(carro.kmRodada), unidade: "km", rotulo: "no app")
                metricaLinha(valor: formatVmax(carro.vmaxKmh), unidade: "km/h", rotulo: "vel. máxima")
                metricaLinha(valor: "\(carro.autodromosCount)", unidade: nil, rotulo: "autódromos")
            }
        }
    }

    private func metricaCol(valor: String, unidade: String?, rotulo: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(valor)
                    .font(.system(size: 18, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-0.27)
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
                .tracking(0.72)
                .foregroundStyle(Color.textFaint)
                .fixedSize(horizontal: true, vertical: false)
        }
    }

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
        return String(format: "%.0f", km)
    }

    private func formatVmax(_ kmh: Double?) -> String {
        guard let kmh = kmh, kmh > 0 else { return "—" }
        return String(format: "%.0f", kmh)
    }
}

/// Mini-tag inline igual `.tag` do mockup-home-cheio. Texto puro,
/// uppercase 10pt, border-radius pill.
struct EventTag: View {
    let text: String
    let kind: TagKind

    init(text: String, kind: TagKind = .neutral) {
        self.text = text
        self.kind = kind
    }

    enum TagKind {
        case neutral, bom, atencao, ouro, accent
    }

    private var foreground: Color {
        switch kind {
        case .neutral: return Color.textFaint
        case .bom: return Color.bom
        case .atencao: return Color.atencao
        case .ouro: return Color.ouro
        case .accent: return Color.accent
        }
    }

    private var borderColor: Color {
        switch kind {
        case .neutral: return Color.border
        case .bom: return Color.bom.opacity(0.45)
        case .atencao: return Color.atencao.opacity(0.45)
        case .ouro: return Color.ouro.opacity(0.45)
        case .accent: return Color.accent.opacity(0.45)
        }
    }

    private var background: Color {
        switch kind {
        case .neutral: return Color.clear
        case .bom: return Color.bom.opacity(0.12)
        case .atencao: return Color.atencao.opacity(0.12)
        case .ouro: return Color.ouro.opacity(0.12)
        case .accent: return Color.accent.opacity(0.10)
        }
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .monospacedDigit()
            .tracking(0.6) // 0.06em em 10pt
            .foregroundStyle(foreground)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 3)
            .background(Capsule().fill(background))
            .overlay(Capsule().stroke(borderColor, lineWidth: 1))
    }
}

// MARK: - Estado vazio

private struct EmptyContent: View {
    let onCadastrarCarro: () -> Void
    let onCriarEvento: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            Text("P1 FAST")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.98) // 0.18em em 11pt
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)
                .padding(.top, Spacing.sm)

            VStack(alignment: .leading, spacing: Spacing.lg) {
                Eyebrow(text: "Vamos começar")

                Text("Comece pela garagem.")
                    .font(.system(size: 28, weight: .semibold))
                    .tracking(-0.7) // -0.025em em 28pt
                    .foregroundStyle(Color.text)
                    .lineSpacing(4)

                Text("O P1 Fast organiza todo ritual de track day — antes, durante e depois. Cadastre o seu carro pra ter setup, pneus e configurações por evento.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(6)
                    .frame(maxWidth: 340, alignment: .leading)

                VStack(spacing: 10) {
                    bullet(num: "1", primaryText: "Cadastre seu primeiro carro", suffix: " — apelido, modelo, categoria, cor.")
                    bullet(num: "2", primaryText: "Crie um evento", suffix: " — autódromo, data, janela do dia.")
                    bullet(num: "3", primaryText: "No dia, registre stints", suffix: " e abra o cockpit no carro.")
                }
                .padding(.top, 6)

                VStack(spacing: 10) {
                    PrimaryCTAButton(label: "Cadastrar primeiro carro", action: onCadastrarCarro)
                    SecondaryCTAButton(label: "Criar primeiro evento", action: onCriarEvento)
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.top, Spacing.lg)
        }
    }

    @ViewBuilder
    private func bullet(num: String, primaryText: String, suffix: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Text(num)
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.onAccent)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.accent))

            (Text(primaryText).foregroundStyle(Color.text).fontWeight(.semibold)
                + Text(suffix).foregroundStyle(Color.textMuted))
                .font(.system(size: 13, weight: .regular))
                .lineSpacing(3)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 14)
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

// MARK: - CTA buttons (estado vazio)

private struct PrimaryCTAButton: View {
    let label: String
    let action: () -> Void
    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(-0.075) // -0.005em em 15pt
            }
            .foregroundStyle(Color.onAccent)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.accent)
            )
            .shadow(color: Color.accent.opacity(0.25), radius: 14, x: 0, y: 10)
            .scaleEffect(isPressed ? 0.97 : 1.0)
        }
        .buttonStyle(.plain)
        .animation(Layout.snap, value: isPressed)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

private struct SecondaryCTAButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075)
                .foregroundStyle(Color.text)
                .padding(.vertical, 16)
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
        .buttonStyle(.plain)
    }
}

// MARK: - Helpers de data
//
// Formatadores conscientes do timezone do device. ISO de input é
// `YYYY-MM-DD` (TZ-neutral) — interpretamos como meia-noite no TZ
// atual pra cálculos relativos consistentes ("hoje", "em N dias").
//
// Exemplo: para 2026-05-02 em pt-BR retorna:
//   formatDateLong   → "2 de maio"
//   formatDateShort  → "02/05"
//   formatWeekdayShort → "Sábado"

private func parseISODate(_ iso: String) -> Date? {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .iso8601)
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "yyyy-MM-dd"
    return f.date(from: iso)
}

private func formatDateLong(_ iso: String) -> String {
    guard let date = parseISODate(iso) else { return iso }
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "d 'de' MMMM"
    return f.string(from: date)
}

private func formatDateShort(_ iso: String) -> String {
    guard let date = parseISODate(iso) else { return iso }
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "dd/MM"
    return f.string(from: date)
}

private func formatWeekdayShort(_ iso: String) -> String {
    guard let date = parseISODate(iso) else { return "" }
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "EEEE"
    return f.string(from: date).capitalized
}

private func todayISO() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
}

private func daysBetween(fromISO: String, toISO: String) -> Int {
    guard let from = parseISODate(fromISO), let to = parseISODate(toISO) else { return 0 }
    let cal = Calendar(identifier: .iso8601)
    return cal.dateComponents([.day], from: cal.startOfDay(for: from),
                              to: cal.startOfDay(for: to)).day ?? 0
}

private func daysFromTodayToISO(_ iso: String) -> Int {
    daysBetween(fromISO: todayISO(), toISO: iso)
}

// MARK: - Mock data (Sprint 1A.6 troca pelo Repository real)

extension HomeData {
    static let mockFilled = HomeData(
        carrosTotal: 2,
        eventosTotal: 12,
        stintsTotal: 47,
        eventoAtivoHoje: EventoMock(
            pista: "Brasília",
            pistaOficial: "Auto. Int. Nelson Piquet",
            dataISO: "2026-05-02",
            horario: "09:00"
        ),
        proximoEvento: EventoMock(
            pista: "Brasília",
            pistaOficial: "Auto. Int. Nelson Piquet",
            dataISO: "2026-05-15",
            horario: "08:30"
        ),
        carrosRecentes: [
            CarroMock(
                apelido: "Celta 1.4",
                modeloCategoria: "Chevrolet · Turismo",
                cor: Color(red: 30.0/255, green: 100.0/255, blue: 180.0/255), // azul Chevrolet
                stints: 31,
                kmRodada: 245,
                vmaxKmh: 187,
                autodromosCount: 3
            ),
            CarroMock(
                apelido: "Honda Civic",
                modeloCategoria: "Honda · Sedã",
                cor: Color(red: 130.0/255, green: 130.0/255, blue: 138.0/255), // cinza
                stints: 16,
                kmRodada: 128,
                vmaxKmh: 174,
                autodromosCount: 2
            ),
        ],
        // S3 rodada 1
        pilotoPrimeiroNome: "Flávio",
        autodromosTotal: 3,
        recordesTotal: 8,
        voltasTotal: 412
    )
}

// MARK: - Atalhos dev

/// Caixa discreta com atalhos exclusivos pra desenvolvimento. Borda
/// cinza, label "ATALHOS DEV", **não faz parte do mockup canônico** —
/// some quando o ContentView resolver os entry points reais (Stint
/// real → captura ao vivo).
private struct DevShortcuts: View {
    let onAbrirTelemetria: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("ATALHOS DEV")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.textFaint)

            Button(action: onAbrirTelemetria) {
                HStack {
                    Text("Gravar telemetria")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Spacer(minLength: 0)
                    Text("›")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.top, Spacing.lg)
    }
}

// MARK: - Previews

#Preview("Home — cheio") {
    HomeView(state: .filled(HomeData.mockFilled))
}

#Preview("Home — vazio") {
    HomeView(state: .empty)
}

#Preview("EmptyContent — taps") {
    EmptyContent(onCadastrarCarro: {}, onCriarEvento: {})
        .padding(Spacing.lg)
        .background(Color.surface)
        .preferredColorScheme(.dark)
}
