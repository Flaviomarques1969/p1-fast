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
    @EnvironmentObject private var arquivoRepo: ArquivoRepository
    /// Situação de manutenção por carro — alimenta o resumo "Atenção" e o
    /// pontinho de status de cada carro na lista (decisão Flávio 2026-06-22).
    @EnvironmentObject private var manutencaoStore: ManutencaoConsumiveisStore
    /// Equipe do box — alimenta a sub-aba "Equipe" (papel + PIN). 24/06.
    @EnvironmentObject private var equipeStore: EquipeStore
    @State private var sheet: GaragemSheet?
    @State private var mostrarApagadosCarros = false
    /// Sub-aba ativa: Carros (lista de carros) ou um dos cadastros que
    /// migraram pra cá (Pilotos/Passageiros/Combustível/Lições). 2026-06-14.
    @State private var subTab: GaragemSubTab
    /// Momento do checklist (Pré/Pós) ao abrir a gestão a partir da home da Garagem.
    @State private var checklistMomento: MomentoStint = .pre

    /// Permite abrir a tela já com uma sheet visível — usado pelos
    /// launch args `--p1-garagem-novo` / `--p1-garagem-carro` pra
    /// screenshot dos modais.
    var initialSheet: GaragemSheet?
    /// Handler do menu inferior — injetado pela HomeView pra permitir
    /// pular pra outra aba direto desta sub-view (fix tab-bar 2026-05-12).
    var onNavSelect: (BottomNavItem) -> Void = { _ in }
    /// Coordenador de envio — injetado pela Home pra ligar o acesso a "Conta"
    /// (e-mail + Sair) DENTRO da Garagem (decisão Flávio 15/06: Conta saiu da
    /// Home, que agora tem o botão Stint). Opcional: nos launchers de
    /// screenshot fica nil e o botão "Conta" não aparece.
    var syncCoordinator: SyncCoordinator? = nil

    init(initialSheet: GaragemSheet? = nil,
         initialSubTab: GaragemSubTab? = nil,
         onNavSelect: @escaping (BottomNavItem) -> Void = { _ in },
         syncCoordinator: SyncCoordinator? = nil) {
        self.initialSheet = initialSheet
        self.onNavSelect = onNavSelect
        self.syncCoordinator = syncCoordinator
        _subTab = State(initialValue: initialSubTab ?? .carros)
    }

    var body: some View {
        VStack(spacing: 0) {
            if subTab == .carros {
                garagemHome
            } else {
                subVoltarBar
                Group {
                    switch subTab {
                    case .equipe:
                        EquipeCadastroView(store: equipeStore, embutido: true)
                    case .checklist:
                        GestaoChecklistView(momentoInicial: checklistMomento)
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
                    case .carros:
                        EmptyView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
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
            Task { try? await arquivoRepo.reload() }
            Task { await manutencaoStore.carregarAtencao(carrosIds: repo.carros.map { $0.id }) }
        }
        .sheet(item: $sheet, onDismiss: { Task { try? await arquivoRepo.reload() } }) { which in
            switch which {
            case .novo:
                CarroNovoFormView(onClose: { sheet = nil })
            case .editar(let carroId):
                CarroHubView(carroId: carroId, onClose: { sheet = nil })
            case .trechos:
                NavigationStack {
                    TrechoListaView(onClose: { sheet = nil })
                }
            case .conta:
                // Tela de Conta (e-mail + Sair + estado de envio). Mesmíssima
                // tela que abria pela Home; só mudou de porta de entrada. Ela
                // já traz NavigationStack + "Fechar" próprios.
                if let coord = syncCoordinator {
                    SincronizacaoView()
                        .environmentObject(coord)
                }
            }
        }
        .sheet(isPresented: $mostrarApagadosCarros) {
            ApagadosView(
                arquivoRepo: arquivoRepo,
                entidade: .carros,
                onRestaurar: { item in
                    Task {
                        try? await repo.restaurar(carroId: item.itemId)
                        try? await arquivoRepo.reload()
                    }
                },
                onClose: { mostrarApagadosCarros = false }
            )
        }
    }

    // ── Home da Garagem — layout premium v6 (onda2-garagem-header-v6-premium):
    //    SEM abas no topo; lista de grupos roláveis. Carros à frente, depois o
    //    grupo CHECKLIST (Pré-stint / Pós-stint), Equipe, Pessoas, Materiais,
    //    Pista, Conta. A navegação principal (Home/Eventos/Pendências/Garagem)
    //    fica embaixo (BottomNav do app real).
    private var garagemHome: some View {
      ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Eyebrow(text: "Garagem")
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, Spacing.sm)

                deckCard

                grupoLabel("Carros")
                VStack(spacing: 9) {
                    ForEach(Array(repo.carros.enumerated()), id: \.element.id) { idx, carro in
                        NavigationLink(value: HomeNavTarget.carroHub(carroId: carro.id)) {
                            CarroCard(carro: carro,
                                      stints: repo.stintsPorCarro[carro.id] ?? 0,
                                      isAtivo: idx == 0,
                                      atencao: manutencaoStore.atencaoPorCarro[carro.id])
                        }
                        .buttonStyle(.plain)
                    }
                }

                grupoLabel("Checklist")
                HStack(spacing: 10) {
                    ftileButton("Pré-stint", "antes de rodar") { checklistMomento = .pre; subTab = .checklist }
                    ftileButton("Pós-stint", "depois de rodar") { checklistMomento = .pos; subTab = .checklist }
                }

                grupoLabel("Equipe")
                ftileButton("Equipe do box", "papéis e PIN") { subTab = .equipe }

                grupoLabel("Pessoas")
                HStack(spacing: 10) {
                    ftileButton("Pilotos", "cadastro") { subTab = .pilotos }
                    ftileButton("Passageiros", "cadastro") { subTab = .passageiros }
                }

                grupoLabel("Materiais")
                ftileButton("Estoque", "peças e ferramentas") { subTab = .estoqueGeral }

                grupoLabel("Pista")
                HStack(spacing: 10) {
                    ftileButton("Trechos da pista", "trechos") { sheet = .trechos }
                    ftileButton("Lições", "aprendizados") { subTab = .licoes }
                }

                if syncCoordinator != nil {
                    grupoLabel("Conta")
                    ftileButton("Conta", "e-mail e sair") { sheet = .conta }
                    // Login por pessoa: sair da pessoa atual e voltar pro login
                    // por PIN (NÃO desloga a conta na nuvem — só troca quem está usando).
                    if let nome = CurrentPersonStore.nomeSalvo {
                        ftileButton("Trocar pessoa", "você está como \(nome)") {
                            CurrentPersonStore.sairStatic()
                        }
                    }
                }

                if arquivoRepo.total(entidade: "carros") > 0 {
                    ApagadosAtalho(count: arquivoRepo.total(entidade: "carros")) {
                        mostrarApagadosCarros = true
                    }
                    .padding(.top, 6)
                }

                // Ferramentas de teste — última seção da Garagem. Só no app real
                // (syncCoordinator presente), igual ao grupo "Conta": nos
                // launchers de screenshot fica oculto porque ali não há a pilha
                // de navegação que resolve as portas.
                if syncCoordinator != nil {
                    ferramentasTesteSection
                        .id("ferramentas-teste")
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onAppear {
            // SÓ-DEV (prova por foto): rola até a seção "Ferramentas de teste"
            // no fim da Garagem. Sem efeito no app real (só com o launch arg).
            if ProcessInfo.processInfo.arguments.contains("--p1-scroll-ferramentas") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    proxy.scrollTo("ferramentas-teste", anchor: .bottom)
                }
            }
        }
      }
    }

    /// Card de resumo no topo da home (X carros · Stints · Atenção).
    private var deckCard: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(repo.carros.count)")
                    .font(.system(size: 29, weight: .semibold)).tracking(-0.8)
                    .foregroundStyle(Color.text)
                Text(repo.carros.count == 1 ? "carro na garagem" : "carros na garagem")
                    .font(.system(size: 12)).foregroundStyle(Color.textMuted)
            }
            Spacer(minLength: 0)
            HStack(spacing: 16) {
                deckNum("\(totalStints)", "Stints", Color.text)
                deckNum("\(carrosEmAtencao)", "Atenção", carrosEmAtencao > 0 ? Color.atencao : Color.bom)
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    private func deckNum(_ v: String, _ l: String, _ c: Color) -> some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(v).font(.system(size: 18, weight: .semibold)).monospacedDigit().foregroundStyle(c)
            Text(l.uppercased()).font(.system(size: 9, weight: .medium)).tracking(0.7).foregroundStyle(Color.textFaint)
        }
    }

    private func grupoLabel(_ t: String) -> some View {
        HStack(spacing: 9) {
            Text(t.uppercased()).font(.system(size: 9, weight: .bold)).tracking(1.3).foregroundStyle(Color.textFaint)
            Rectangle().fill(Color.border).frame(height: 1)
        }
        .padding(.top, 6).padding(.horizontal, Spacing.xs)
    }

    /// Botão de função (nome + contexto + setinha) — a "peça" do menu da garagem.
    private func ftileButton(_ nome: String, _ ctx: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { ftileLabel(nome, ctx) }
            .buttonStyle(.plain)
    }

    /// Visual da "peça" do menu (nome + contexto + setinha), sem o Button —
    /// pra poder reusar o MESMO visual num NavigationLink (portas que navegam
    /// por push, como os cards de carro), não só num Button de ação local.
    @ViewBuilder
    private func ftileLabel(_ nome: String, _ ctx: String) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(nome).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                    .lineLimit(1)
                Text(ctx).font(.system(size: 11.5)).foregroundStyle(Color.textFaint).lineLimit(1)
            }
            Spacer(minLength: 0)
            Text("›").font(.system(size: 14)).foregroundStyle(Color.textMuted)
                .frame(width: 26, height: 26)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.surfaceHover))
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    /// Grupo "Ferramentas de teste" — as portas que saíram da Home (decisão
    /// Flávio 11/07) e agora vivem aqui, discretas, no FIM da Garagem. NADA de
    /// tela nova: são só entradas pras telas de teste EXISTENTES
    /// (TesteAoVivoView + a TelemetriaView de teste). Navega por PUSH via
    /// HomeNavTarget — o mesmo mecanismo dos cards de carro — então o menu
    /// inferior continua visível e "voltar" volta UMA tela. As telas são
    /// resolvidas pelo `navigationDestination(for: HomeNavTarget.self)` da
    /// HomeView (que também injeta o builder da telemetria vindo do ContentView).
    private var ferramentasTesteSection: some View {
        // VStack (um só frame) em vez de Group pra o grupoLabel e as duas linhas
        // andarem juntos e o scroll-to da prova por foto ter um alvo concreto.
        // spacing Spacing.md casa com o respiro entre os demais grupos.
        VStack(alignment: .leading, spacing: Spacing.md) {
            grupoLabel("Ferramentas de teste")
            VStack(spacing: 9) {
                NavigationLink(value: HomeNavTarget.testeAoVivo) {
                    ftileLabel("Teste ao vivo", "validação de campo")
                }
                .buttonStyle(.plain)
                NavigationLink(value: HomeNavTarget.telemetriaDemo) {
                    ftileLabel("Gravar telemetria", "grava sessão de teste")
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Barra "‹ Garagem" pra voltar à home quando uma função está aberta.
    private var subVoltarBar: some View {
        HStack(spacing: Spacing.sm) {
            Button { subTab = .carros } label: {
                HStack(spacing: 4) {
                    Text("‹").font(.system(size: 17, weight: .regular))
                    Text("Garagem").font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Color.textMuted)
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.lg).padding(.top, Spacing.md).padding(.bottom, Spacing.sm)
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
                                isAtivo: idx == 0,
                                atencao: manutencaoStore.atencaoPorCarro[carro.id]
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                if arquivoRepo.total(entidade: "carros") > 0 {
                    ApagadosAtalho(count: arquivoRepo.total(entidade: "carros")) {
                        mostrarApagadosCarros = true
                    }
                    .padding(.top, 6)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Barra superior fixa da Garagem — eyebrow + atalho "Trechos da pista"
    /// + acesso a "Conta" (e-mail + Sair), que migrou da Home pra cá (Flávio
    /// 15/06).
    private var garagemHeaderBar: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
            Eyebrow(text: "Garagem")
            Spacer(minLength: 0)
            trechosLink
            if syncCoordinator != nil {
                contaLink
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.sm)
    }

    /// Acesso a "Conta" (e-mail + Sair) — saiu da Home (que agora tem o botão
    /// Stint) e passou a viver na Garagem (decisão Flávio 15/06). Abre a tela
    /// de Conta como folha. Só aparece no app real (quando o coordenador de
    /// envio está presente); fica oculto nos launchers de screenshot.
    private var contaLink: some View {
        Button(action: { sheet = .conta }) {
            Text("Conta")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.9)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, 6)
                .overlay(Capsule().stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
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

    /// Soma de stints de todos os carros (real — antes "Pronto" só repetia o
    /// total de carros, que era número falso).
    private var totalStints: Int {
        repo.carros.reduce(0) { $0 + (repo.stintsPorCarro[$1.id] ?? 0) }
    }

    /// Quantos carros têm pelo menos 1 item de manutenção em atenção
    /// (vermelho/amarelo) — antes "Manutenção" era fixo em 0.
    private var carrosEmAtencao: Int {
        repo.carros.filter { (manutencaoStore.atencaoPorCarro[$0.id] ?? 0) > 0 }.count
    }

    private var summaryCard: some View {
        HStack(spacing: Spacing.sm) {
            statCell(value: "\(repo.carros.count)", label: "Carros", color: Color.text)
            statCell(value: "\(totalStints)", label: "Stints", color: Color.text)
            statCell(value: "\(carrosEmAtencao)", label: "Atenção",
                     color: carrosEmAtencao > 0 ? Color.atencao : Color.bom)
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
    case conta

    var id: String {
        switch self {
        case .novo: return "novo"
        case .editar(let id): return "editar-\(id)"
        case .trechos: return "trechos"
        case .conta: return "conta"
        }
    }
}

// MARK: - Sub-abas da Garagem

/// Carros + os cadastros que migraram da antiga aba "Cadastros" (2026-06-14).
enum GaragemSubTab: String, CaseIterable, Identifiable {
    case carros, equipe, checklist, estoqueGeral, pilotos, passageiros, combustivel, licoes
    var id: String { rawValue }
    var label: String {
        switch self {
        case .carros: return "Carros"
        case .equipe: return "Equipe"
        case .checklist: return "Checklist"
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

// MARK: - Gestão do Checklist (sub-aba da Garagem)

/// Tela de gestão do checklist do stint dentro da Garagem: segmento
/// Pré-stint / Pós-stint, cada item com nível (obrigatório/desejável) e os
/// responsáveis (quem FAZ / quem CONFERE). Port do desenho
/// `_design-reference/propostas-premium-2026-06-21/onda2-garagem-checklist-v2.html`.
/// O conteúdo vem do catálogo aprovado pelo Flávio (CatalogoChecklistStint, no núcleo).
struct GestaoChecklistView: View {
    @State private var momento: MomentoStint
    init(momentoInicial: MomentoStint = .pre) {
        _momento = State(initialValue: momentoInicial)
    }

    private var itens: [ItemChecklistStint] {
        CatalogoChecklistStint.padrao.filter { $0.momento == momento }
    }
    private var obrig: [ItemChecklistStint] { itens.filter { $0.obrigatorio } }
    private var desej: [ItemChecklistStint] { itens.filter { !$0.obrigatorio } }
    private var totalPre: Int { CatalogoChecklistStint.padrao.filter { $0.momento == .pre }.count }
    private var totalPos: Int { CatalogoChecklistStint.padrao.filter { $0.momento == .pos }.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                cabecalho
                seletor
                grupo("Obrigatórios", obrig)
                if !desej.isEmpty { grupo("Desejáveis", desej) }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.sm)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(momento == .pre ? "Antes de rodar" : "Depois de rodar")
                .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(momento == .pre
                 ? "O que conferir no box antes do carro sair · \(totalPre) itens"
                 : "O que conferir quando o carro volta · \(totalPos) itens")
                .font(.system(size: 13)).foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var seletor: some View {
        HStack(spacing: 6) {
            segBtn(.pre, "Pré-stint", totalPre)
            segBtn(.pos, "Pós-stint", totalPos)
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func segBtn(_ m: MomentoStint, _ rotulo: String, _ n: Int) -> some View {
        let on = momento == m
        Button { withAnimation(Layout.snap) { momento = m } } label: {
            HStack(spacing: 5) {
                Text(rotulo).font(.system(size: 12.5, weight: .semibold))
                Text("\(n)").font(.system(size: 10, weight: .semibold)).opacity(0.7).monospacedDigit()
            }
            .foregroundStyle(on ? Color.onAccent : Color.textMuted)
            .frame(maxWidth: .infinity).padding(.vertical, 9)
            .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(on ? Color.accent : Color.clear))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func grupo(_ titulo: String, _ lista: [ItemChecklistStint]) -> some View {
        if !lista.isEmpty {
            HStack(spacing: 9) {
                Text("\(titulo.uppercased()) · \(lista.count)")
                    .font(.system(size: 9, weight: .bold)).tracking(1.0).foregroundStyle(Color.textFaint)
                Rectangle().fill(Color.border).frame(height: 1)
            }
            .padding(.top, 4)
            VStack(spacing: 8) {
                ForEach(lista) { item in itemCard(item) }
            }
        }
    }

    @ViewBuilder
    private func itemCard(_ item: ItemChecklistStint) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.nome)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                    if item.condicional {
                        Text("só com carona")
                            .font(.system(size: 9, weight: .bold)).tracking(0.4)
                            .foregroundStyle(Color.ouro)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(item.obrigatorio ? "OBRIG." : "DESEJ.")
                    .font(.system(size: 8.5, weight: .bold)).tracking(0.4)
                    .foregroundStyle(item.obrigatorio ? Color.rec : Color.ouro)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Capsule().fill((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.12)))
                    .overlay(Capsule().stroke((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.4), lineWidth: 1))
            }
            respLinha("Faz", item.faz)
            respLinha("Confere", item.confere)
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func respLinha(_ rotulo: String, _ papeis: [PapelPessoa]) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Text(rotulo.uppercased())
                .font(.system(size: 9, weight: .bold)).tracking(0.6)
                .foregroundStyle(Color.textFaint)
                .frame(width: 54, alignment: .leading)
            Text(papeis.isEmpty ? "ninguém" : papeis.map { nomeCurto($0) }.joined(separator: " · "))
                .font(.system(size: 11))
                .foregroundStyle(papeis.isEmpty ? Color.textFaint : Color.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func nomeCurto(_ p: PapelPessoa) -> String {
        p == .chefeEquipe ? "Chefe" : p.legivel
    }
}

// MARK: - CarroCard

private struct CarroCard: View {
    let carro: Carro
    let stints: Int
    let isAtivo: Bool
    /// Itens de manutenção em atenção (vermelho/amarelo). nil = ainda não
    /// calculado; 0 = em dia (verde); >0 = atenção (amarelo).
    let atencao: Int?

    @State private var foto: UIImage?

    /// Pontinho de situação de manutenção ao lado do nome: verde = em dia,
    /// amarelo = precisa de atenção. Some enquanto o cálculo não chegou.
    @ViewBuilder
    private var statusDot: some View {
        if let atencao {
            Circle()
                .fill(atencao > 0 ? Color.atencao : Color.bom)
                .frame(width: 8, height: 8)
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            swatch
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(carro.apelido)
                        .font(.system(size: 17, weight: .semibold))
                        .tracking(-0.085)
                        .foregroundStyle(Color.text)
                    statusDot
                }
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
    let arquivoRepo = ArquivoRepository(queue: queue)
    let manutencaoStore = ManutencaoConsumiveisStore(queue: queue)
    let equipeStore = EquipeStore(queue: queue)
    return GaragemView()
        .environmentObject(repo)
        .environmentObject(arquivoRepo)
        .environmentObject(manutencaoStore)
        .environmentObject(equipeStore)
        .task { await repo.bootstrap() }
}
