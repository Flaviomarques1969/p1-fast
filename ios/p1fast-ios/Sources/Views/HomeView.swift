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
import UIKit

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
    /// Fluxo do carro empilhado (push) em vez de folha modal — assim o
    /// menu inferior fixo continua visível. 2026-05-31, pedido do Flávio.
    case carroHub(carroId: String)
    case carroCadastro(carroId: String)
    case manutencao(carroId: String)
    case estoque(carroId: String)
    case eventoDetalhe(eventoId: String)
    /// Atalho dev — abre TelemetriaView (sessão demo descartável). Usado
    /// pra captura rápida em test drive sem passar pelo fluxo Evento →
    /// Stint. Botão fica embaixo do conteúdo da Home, marcado como
    /// "(dev)" pra não ser confundido com fluxo canônico.
    case telemetriaDemo
    /// Tela de TESTE do espelhamento ao vivo (viewer Daily.co + overlay GPS).
    /// Adicionada pra validar o vídeo do notebook no iPhone. Não faz parte
    /// do fluxo canônico — entrada explícita via botão "TESTE AO VIVO".
    case testeAoVivo
    /// Tela de ESPECTADOR (decisão Flávio 09/06): vídeo da pista em cima +
    /// dados básicos de volta/trecho do piloto embaixo.
    case assistir
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
}

// MARK: - View raiz

/// Fonte de verdade ESTÁVEL do caminho de navegação. Vive como
/// @StateObject no ReadyRoot (criado UMA vez), então o histórico de telas
/// sobrevive às recriações da HomeView disparadas pelos repositórios (timer
/// de sincronização a cada 30s, status de manutenção ao abrir o hub, etc.).
/// Antes o caminho era @State volátil dentro da HomeView e se perdia nessas
/// recriações, fazendo o "Cancelar" cair na tela inicial em vez de voltar
/// pra tela anterior (cobrado Flávio 2026-06-03).
final class NavRouter: ObservableObject {
    @Published var path = NavigationPath()
}

struct HomeView: View {
    let state: HomeState
    /// Opcional pra previews — quando presente, mostra SyncStatusBadge no
    /// header e abre SincronizacaoView no tap.
    var syncCoordinator: SyncCoordinator? = nil
    /// Closure opcional injetada por ContentView pra construir a
    /// TelemetriaView com queue + trackBundle (a Home não tem acesso
    /// direto aos repositórios). Quando nil, o atalho dev fica oculto.
    var telemetriaDevView: (() -> AnyView)? = nil
    /// SÓ-DEV: rota inicial pré-empilhada — usada pelos launchers de mock
    /// pra validar telas profundas no simulador sem passar pelo login.
    var initialRoute: [HomeNavTarget] = []
    @State private var navSelection: BottomNavItem.ID?
    @State private var showSyncSheet = false
    @EnvironmentObject private var router: NavRouter
    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Pendências"),
        BottomNavItem("Garagem"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            NavigationStack(path: $router.path) {
                shell
                    .navigationDestination(for: HomeNavTarget.self) { target in
                        destinationView(for: target)
                    }
            }
            // Menu inferior FIXO: fica FORA do NavigationStack, então
            // permanece visível em TODA tela empilhada (hub do carro,
            // cadastro, estoque, detalhe de evento…). 2026-05-31, pedido
            // do Flávio — antes cada tela desenhava o seu, e as telas de
            // detalhe (abertas como folha modal) cobriam o menu.
            BottomNav(items: navItems, selection: $navSelection, onSelect: handleNavSelect)
        }
        .background(Color.surface)
        .preferredColorScheme(.dark)
        .onAppear {
            if navSelection == nil { navSelection = navItems.first?.id }
            if router.path.isEmpty {
                for r in initialRoute { router.path.append(r) }
            }
        }
    }

    private var shell: some View {
        ScrollView {
            content
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 32)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .overlay(alignment: .bottomTrailing) {
            if case .filled = state {
                FAB("Novo evento", action: { router.path.append(HomeNavTarget.eventosNovo) })
                    .padding(.trailing, Spacing.md)
                    .padding(.bottom, Spacing.md)
            }
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
                FilledContent(data: data)
            case .empty:
                EmptyContent(
                    onCadastrarCarro: { router.path.append(HomeNavTarget.garagemNovo) },
                    onCriarEvento: { router.path.append(HomeNavTarget.eventosNovo) }
                )
            }
            // ASSISTIR AO VIVO — tela de espectador (vídeo + volta/trecho).
            AssistirButton(onAbrir: {
                router.path.append(HomeNavTarget.assistir)
            })
            // Botão de TESTE do espelhamento ao vivo — visível em qualquer
            // estado da Home. Abre a TesteAoVivoView (viewer Daily.co).
            TesteAoVivoButton(onAbrir: {
                router.path.append(HomeNavTarget.testeAoVivo)
            })
            // Atalho dev pra captura rápida em test drive — fica embaixo
            // do conteúdo canônico. Só renderiza quando o caller injetou
            // um builder válido.
            if telemetriaDevView != nil {
                DevShortcuts(onAbrirTelemetria: {
                    router.path.append(HomeNavTarget.telemetriaDemo)
                })
            }
        }
    }

    @ViewBuilder
    private func destinationView(for target: HomeNavTarget) -> some View {
        // Fix tab-bar: cada sub-view recebe o handler do menu de baixo
        // pra que o usuário possa pular pra outra aba sem precisar
        // voltar manualmente pra Home antes. Quando a sub-view chama
        // este handler, navPath é resetado e o novo destino empilhado.
        let nav: (BottomNavItem) -> Void = { item in
            navigateFromSubView(to: item)
        }
        switch target {
        case .eventos:
            EventosListaView(onNavSelect: nav)
        case .eventosNovo:
            EventosListaView(initialSheet: .novo, onNavSelect: nav)
        case .cadastros:
            PessoasView(onNavSelect: nav)
        case .garagem:
            GaragemView(onNavSelect: nav)
        case .garagemNovo:
            GaragemView(initialSheet: .novo, onNavSelect: nav)
        case .carroHub(let id):
            CarroHubView(carroId: id, onClose: { voltarUmaTela() })
        case .carroCadastro(let id):
            CarroModalView(carroId: id, onClose: { voltarUmaTela() })
        case .manutencao(let id):
            ManutencaoConsumiveisView(carroId: id, onClose: { voltarUmaTela() })
        case .estoque(let id):
            PecaListaView(carroInicial: id, onClose: { voltarUmaTela() })
        case .eventoDetalhe(let id):
            EventoDetalheView(eventoId: id, onClose: { voltarUmaTela() })
        case .telemetriaDemo:
            if let builder = telemetriaDevView {
                builder()
            } else {
                EmptyView()
            }
        case .testeAoVivo:
            TesteAoVivoView(onClose: { voltarUmaTela() })
                .navigationBarBackButtonHidden(true)
        case .assistir:
            AssistirView(onClose: { voltarUmaTela() })
                .navigationBarBackButtonHidden(true)
        }
    }

    /// Volta exatamente UMA tela. Fecha o teclado antes (um campo em edição
    /// poderia fazer a pilha colapsar) e faz pop incremental do caminho — que
    /// agora é estável (NavRouter), então o "Cancelar"/voltar leva pra tela
    /// anterior em vez de cair na tela inicial (cobrado Flávio 2026-06-03).
    private func voltarUmaTela() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        if !router.path.isEmpty { router.path.removeLast() }
    }

    /// Handler usado pelas sub-views quando o usuário toca em outro
    /// item do menu inferior. Reset do navPath + push do novo destino.
    /// "Home" só limpa o stack (volta pra raiz).
    private func navigateFromSubView(to item: BottomNavItem) {
        router.path = NavigationPath()
        switch item.label {
        case "Home":
            break
        case "Eventos":
            router.path.append(HomeNavTarget.eventos)
        case "Cadastros":
            router.path.append(HomeNavTarget.cadastros)
        case "Garagem":
            router.path.append(HomeNavTarget.garagem)
        default:
            break
        }
    }

    /// Menu inferior fixo: tocar num item SEMPRE volta à raiz daquela aba
    /// (zera o histórico) e marca a aba ativa. Vale de qualquer
    /// profundidade — inclusive de dentro do hub/cadastro/estoque.
    private func handleNavSelect(_ item: BottomNavItem) {
        navSelection = item.id
        router.path = NavigationPath()
        switch item.label {
        case "Home":
            break // a raiz do stack já é a Home
        case "Eventos":
            router.path.append(HomeNavTarget.eventos)
        case "Cadastros":
            router.path.append(HomeNavTarget.cadastros)
        case "Garagem":
            router.path.append(HomeNavTarget.garagem)
        default:
            break
        }
    }
}

// MARK: - Estado cheio

private struct FilledContent: View {
    let data: HomeData

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

            SummaryStats([
                StatItem(value: "\(data.carrosTotal)", label: "Carros"),
                StatItem(value: "\(data.eventosTotal)", label: "Eventos"),
                StatItem(value: "\(data.stintsTotal)", label: "Stints"),
            ])

            if !data.carrosRecentes.isEmpty {
                Text("Carros recentes".uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.54) // 0.14em em 11pt
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, Spacing.sm)

                VStack(spacing: Spacing.sm) {
                    ForEach(Array(data.carrosRecentes.prefix(3))) { carro in
                        CarroRow(carro: carro)
                    }
                }
            }

            // Próximos eventos no fim da página (decisão Flávio 2026-05-12).
            // Antes ficava logo após o header — agora carros vêm primeiro.
            // O bloco DevShortcuts (atalhos dev) é renderizado depois deste
            // FilledContent pelo parent.
            if data.eventoAtivoHoje != nil || data.proximoEvento != nil {
                Text("Próximos eventos".uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.54)
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, Spacing.sm)
            }

            if let evento = data.eventoAtivoHoje {
                EventoAtivoHojeCard(evento: evento)
            }

            if let proximo = data.proximoEvento {
                ProximoEventoCard(evento: proximo, hojeISO: data.eventoAtivoHoje?.dataISO ?? todayISO())
            }
        }
    }

    /// "Hoje em Brasília" se há evento ativo, senão "Próximo evento em N dias",
    /// senão "Pronto pra primeira pedalada".
    private func headerStatusLine(data: HomeData) -> AttributedString {
        if let ativo = data.eventoAtivoHoje {
            var s = AttributedString("Hoje em \(ativo.pista)")
            if let range = s.range(of: ativo.pista) {
                s[range].foregroundColor = Color.accent
            }
            return s
        }
        if let proximo = data.proximoEvento {
            let dias = daysFromTodayToISO(proximo.dataISO)
            let label = dias == 1 ? "amanhã" : "em \(dias) dias"
            var s = AttributedString("Próximo evento \(label)")
            if let range = s.range(of: label) {
                s[range].foregroundColor = Color.accent
            }
            return s
        }
        return AttributedString("Sem eventos planejados")
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

// MARK: - Carros recentes

/// Linha de carro — espelha `.event` do mockup-home-cheio (mesma estrutura
/// flex: avatar/swatch + body com nome + sub + meta tags + chev).
private struct CarroRow: View {
    let carro: CarroMock

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(carro.cor)
                .frame(width: 52, height: 52)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.border, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(carro.apelido)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.08) // -0.005em em 16pt
                    .foregroundStyle(Color.text)
                Text(carro.modeloCategoria)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                HStack(spacing: 6) {
                    EventTag(text: "\(carro.stints) stints")
                }
                .padding(.top, Spacing.sm)
            }

            Spacer(minLength: 0)

            Text("›")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .frame(width: 24, height: 24)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceHover)
                )
                .padding(.top, 14)
        }
        .padding(.horizontal, Spacing.md)
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
                stints: 31
            ),
            CarroMock(
                apelido: "Honda Civic",
                modeloCategoria: "Honda · Sedã",
                cor: Color(red: 130.0/255, green: 130.0/255, blue: 138.0/255), // cinza
                stints: 16
            ),
        ]
    )
}

// MARK: - Atalhos dev

/// Caixa discreta com atalhos exclusivos pra desenvolvimento. Borda
/// cinza, label "ATALHOS DEV", **não faz parte do mockup canônico** —
/// some quando o ContentView resolver os entry points reais (Stint
/// real → captura ao vivo).
/// Botão que abre a tela de ESPECTADOR (vídeo da pista + volta/trecho).
/// Decisão Flávio 09/06 — é a tela de produto; o TESTE AO VIVO continua
/// embaixo como ferramenta de validação de campo.
private struct AssistirButton: View {
    let onAbrir: () -> Void

    var body: some View {
        Button(action: onAbrir) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color.red)
                    .frame(width: 10, height: 10)
                Text("ASSISTIR AO VIVO")
                    .font(.system(size: 16, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Color.text)
                Spacer(minLength: 0)
                Text("›")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.red.opacity(0.55), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.lg)
    }
}

/// Botão prominente que abre a tela de TESTE do espelhamento ao vivo.
/// Visível em qualquer estado da Home. Verde pra destacar como ação de
/// teste de campo (assistir o vídeo do notebook + GPS).
private struct TesteAoVivoButton: View {
    let onAbrir: () -> Void

    var body: some View {
        Button(action: onAbrir) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 10, height: 10)
                Text("TESTE AO VIVO")
                    .font(.system(size: 16, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Color.text)
                Spacer(minLength: 0)
                Text("›")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.green.opacity(0.55), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.lg)
    }
}

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
        .environmentObject(NavRouter())
}

#Preview("Home — vazio") {
    HomeView(state: .empty)
        .environmentObject(NavRouter())
}

#Preview("EmptyContent — taps") {
    EmptyContent(onCadastrarCarro: {}, onCriarEvento: {})
        .padding(Spacing.lg)
        .background(Color.surface)
        .preferredColorScheme(.dark)
}
