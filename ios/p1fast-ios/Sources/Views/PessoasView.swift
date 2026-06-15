// ═══════════════════════════════════════════════════════════
// PessoasView — bundle CRUD pilotos + passageiros + combustíveis
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompts #12 + #13 (Pessoas) + #15 (Combustíveis)
// + fix delete affordances.
//
// Decisão de surface (Prompt #15): em vez de criar 5ª aba pra
// Combustíveis, embarca como 3ª sub-tab desta tela e renomeia o
// label do BottomNav "Pessoas" → "Cadastros". Justificativa:
//   - A nav só tem 4 vagas (Home / Eventos / Pessoas/Cadastros /
//     Garagem). Criar 5ª aba quebraria o Padrão B (4 cells).
//   - "Configurações" como surface alternativa diluiria — combus-
//     tíveis são entidade de domínio (igual pilotos), não setting.
//   - "Cadastros" é genérico o suficiente pra acomodar Pneus depois
//     se virar sub-tab também (a outra hipótese é embutir em Carro
//     Modal — decisão fica pro Prompt #14 Pneus).
// O nome interno (struct, enum, file) fica como `Pessoas*` pra
// minimizar churn neste PR; rename completo pode entrar como chore
// posterior se incomodar — não muda comportamento.
//
// Os mockups canônicos `mockup-piloto-lista.html`,
// `mockup-passageiro-lista.html` e `mockup-combustivel-lista.html`
// foram desenhados como SELETORES dentro do fluxo de stint (eyebrow
// + título + footer Cancelar/Confirmar). Aqui usamos a MESMA
// estética visual mas em modo CRUD: sub-tabs Pilotos/Passageiros/
// Combustíveis.
//
// CRUD completo (delete affordances):
//   - tap no row → abre cadastro em modo edit
//   - swipeActions trailing → "Apagar" destrutivo + alert "Não dá pra
//     desfazer." (cancel + apagar)
// Surface estrutural: outer ScrollView trocou pra `List` com
// `.listStyle(.plain)` e separators escondidos pra suportar
// `.swipeActions` (que só funciona em row de List).
//
// Form mínimo (decisões #12/#13/#15):
//   - Piloto: só nome (user_id FK fica pra Sprint 1A.6)
//   - Passageiro: só nome
//   - Combustível: nome + observação (mapeada pra `combustiveis.tipo`,
//     texto livre — schema canônico v1 sem migration nova)
// O mockup-cadastro de Pessoas mostra altura/peso/idade — esses
// campos ficam pra próxima migração quando o schema canônico ganhar
// as colunas.

import SwiftUI
import P1FastCore

enum PessoasSheet: Identifiable {
    case novoPiloto
    case editarPiloto(Piloto)
    case novoPassageiro
    case editarPassageiro(Passageiro)
    case novoCombustivel
    case editarCombustivel(Combustivel)

    var id: String {
        switch self {
        case .novoPiloto: return "novo-piloto"
        case .editarPiloto(let p): return "editar-piloto-\(p.id)"
        case .novoPassageiro: return "novo-passageiro"
        case .editarPassageiro(let p): return "editar-passageiro-\(p.id)"
        case .novoCombustivel: return "novo-combustivel"
        case .editarCombustivel(let c): return "editar-combustivel-\(c.id)"
        }
    }
}

enum PessoasSubTab: String, CaseIterable, Identifiable {
    case pilotos = "Pilotos"
    case passageiros = "Passageiros"
    case combustiveis = "Combustíveis"
    case licoes = "Lições"
    var id: String { rawValue }
}

struct PessoasView: View {
    @EnvironmentObject private var pilotoRepo: PilotoRepository
    @EnvironmentObject private var passageiroRepo: PassageiroRepository
    @EnvironmentObject private var combustivelRepo: CombustivelRepository
    @EnvironmentObject private var licaoRepo: LicaoRepository
    @EnvironmentObject private var arquivoRepo: ArquivoRepository
    @State private var navSelection: BottomNavItem.ID?
    @State private var sheet: PessoasSheet?
    @State private var subTab: PessoasSubTab = .pilotos
    @State private var pilotoToDelete: Piloto?
    @State private var passageiroToDelete: Passageiro?
    @State private var combustivelToDelete: Combustivel?
    @State private var apagadosEntidade: EntidadeArquivavel?

    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Cadastros"),
        BottomNavItem("Garagem"),
    ]

    var initialSheet: PessoasSheet?
    var initialSubTab: PessoasSubTab?
    /// Quando setado, a tela roda EMBUTIDA dentro da Garagem: mostra só a
    /// lista da sub-aba indicada (esconde o cabeçalho e a fileira de
    /// sub-abas próprios — a Garagem já fornece os dois). 2026-06-14.
    var embeddedSubTab: PessoasSubTab?
    /// Handler do menu inferior — injetado pela HomeView pra permitir
    /// pular pra outra aba direto desta sub-view (fix tab-bar 2026-05-12).
    var onNavSelect: (BottomNavItem) -> Void = { _ in }

    init(initialSheet: PessoasSheet? = nil,
         initialSubTab: PessoasSubTab? = nil,
         embeddedSubTab: PessoasSubTab? = nil,
         onNavSelect: @escaping (BottomNavItem) -> Void = { _ in }) {
        self.initialSheet = initialSheet
        self.initialSubTab = initialSubTab
        self.embeddedSubTab = embeddedSubTab
        self.onNavSelect = onNavSelect
    }

    var body: some View {
        List {
                if embeddedSubTab == nil {
                    contextHeadRow
                    subTabBarRow
                }
                switch subTab {
                case .pilotos:
                    pilotosRows
                    apagadosRow(.pilotos)
                case .passageiros:
                    passageirosRows
                    apagadosRow(.passageiros)
                case .combustiveis:
                    CombustivelListaView(
                        onAdd: { sheet = .novoCombustivel },
                        onTap: { c in sheet = .editarCombustivel(c) },
                        onDelete: { c in combustivelToDelete = c }
                    )
                    .environmentObject(combustivelRepo)
                    apagadosRow(.combustiveis)
                case .licoes:
                    Section {
                        LicaoListaView()
                            .environmentObject(licaoRepo)
                            .environmentObject(arquivoRepo)
                            .listRowInsets(EdgeInsets())
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.surface)
                    }
                    apagadosRow(.licoes)
                }
                bottomSpacerRow
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.surface)
            .environment(\.defaultMinListRowHeight, 0)
        .preferredColorScheme(.dark)
        .onAppear {
            if let s = initialSubTab { subTab = s }
            if let e = embeddedSubTab { subTab = e }
            if let sh = initialSheet, sheet == nil { sheet = sh }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novoPiloto:
                PilotoCadastroView(onClose: { sheet = nil })
                    .environmentObject(pilotoRepo)
            case .editarPiloto(let p):
                PilotoCadastroView(pilotoToEdit: p, onClose: { sheet = nil })
                    .environmentObject(pilotoRepo)
            case .novoPassageiro:
                PassageiroCadastroView(onClose: { sheet = nil })
                    .environmentObject(passageiroRepo)
            case .editarPassageiro(let p):
                PassageiroCadastroView(passageiroToEdit: p, onClose: { sheet = nil })
                    .environmentObject(passageiroRepo)
            case .novoCombustivel:
                CombustivelCadastroView(onClose: { sheet = nil })
                    .environmentObject(combustivelRepo)
            case .editarCombustivel(let c):
                CombustivelCadastroView(combustivelToEdit: c, onClose: { sheet = nil })
                    .environmentObject(combustivelRepo)
            }
        }
        .alert(
            "Apagar piloto?",
            isPresented: Binding(
                get: { pilotoToDelete != nil },
                set: { if !$0 { pilotoToDelete = nil } }
            ),
            presenting: pilotoToDelete
        ) { _ in
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDeletePiloto() }
        } message: { _ in
            Text("Some da lista, mas fica em Apagados — dá pra resgatar.")
        }
        .alert(
            "Apagar passageiro?",
            isPresented: Binding(
                get: { passageiroToDelete != nil },
                set: { if !$0 { passageiroToDelete = nil } }
            ),
            presenting: passageiroToDelete
        ) { _ in
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDeletePassageiro() }
        } message: { _ in
            Text("Some da lista, mas fica em Apagados — dá pra resgatar.")
        }
        .alert(
            "Apagar combustível?",
            isPresented: Binding(
                get: { combustivelToDelete != nil },
                set: { if !$0 { combustivelToDelete = nil } }
            ),
            presenting: combustivelToDelete
        ) { _ in
            Button("Cancelar", role: .cancel) {}
            Button("Apagar", role: .destructive) { confirmarDeleteCombustivel() }
        } message: { _ in
            Text("Some da lista, mas fica em Apagados — dá pra resgatar.")
        }
        .sheet(item: $apagadosEntidade) { ent in
            ApagadosView(
                arquivoRepo: arquivoRepo,
                entidade: ent,
                onRestaurar: { item in restaurar(ent, item) },
                onClose: { apagadosEntidade = nil }
            )
        }
    }

    /// Atalho "Apagados (N)" da sub-aba — some quando não há nada apagado.
    @ViewBuilder
    private func apagadosRow(_ ent: EntidadeArquivavel) -> some View {
        let n = arquivoRepo.total(entidade: ent.rawValue)
        if n > 0 {
            ApagadosAtalho(count: n) { apagadosEntidade = ent }
                .padding(.top, 6)
                .listRowInsets(EdgeInsets(top: 8, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
    }

    /// Resgata o item da entidade certa e atualiza a lista de Apagados.
    private func restaurar(_ ent: EntidadeArquivavel, _ item: ItemArquivado) {
        Task {
            switch ent {
            case .pilotos:      try? await pilotoRepo.restaurar(pilotoId: item.itemId)
            case .passageiros:  try? await passageiroRepo.restaurar(passageiroId: item.itemId)
            case .combustiveis: try? await combustivelRepo.restaurar(combustivelId: item.itemId)
            case .licoes:       try? await licaoRepo.restaurar(licaoId: item.itemId)
            case .carros:       break // carros são resgatados pela Garagem
            }
            try? await arquivoRepo.reload()
        }
    }

    // MARK: - Linhas estruturais (head + subTabs + bottom spacer)

    private var contextHeadRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: eyebrowText)
            Text(headerTitle)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
        .listRowInsets(EdgeInsets(top: Spacing.md, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private var subTabBarRow: some View {
        HStack(spacing: 6) {
            ForEach(PessoasSubTab.allCases) { tab in
                SubTabPill(label: tab.rawValue, isActive: tab == subTab) {
                    subTab = tab
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.xs)
        .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: Spacing.md, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    /// Spacer no fim pra não esconder a última linha sob a BottomNav.
    private var bottomSpacerRow: some View {
        Color.clear
            .frame(height: 140)
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }

    private var eyebrowText: String {
        switch subTab {
        case .pilotos: return "Pilotos"
        case .passageiros: return "Passageiros"
        case .combustiveis: return "Combustível"
        case .licoes: return "Lições"
        }
    }

    private var headerTitle: String {
        switch subTab {
        case .pilotos: return "Quem dirige"
        case .passageiros: return "Quem anda junto"
        case .combustiveis: return "Tipos cadastrados"
        case .licoes: return "Catálogo curado"
        }
    }

    private var headerSubtitle: String {
        switch subTab {
        case .pilotos: return "Cadastrados ficam disponíveis em todo stint."
        case .passageiros: return "Passageiros são cadastrados uma vez e reaproveitados."
        case .combustiveis: return "Tipos abastecidos ficam disponíveis pra próximos stints."
        case .licoes: return "12 lições — 7 ativas com sinais do iPhone, 5 esperando sensores."
        }
    }

    // MARK: - Linhas de Pilotos

    @ViewBuilder
    private var pilotosRows: some View {
        groupHeadRow(title: "Cadastrados", count: pilotoRepo.pilotos.count)
        ForEach(pilotoRepo.pilotos, id: \.id) { p in
            PersonRow(name: p.nome)
                .contentShape(Rectangle())
                .onTapGesture { sheet = .editarPiloto(p) }
                .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        pilotoToDelete = p
                    } label: {
                        Text("Apagar")
                    }
                }
        }
        AddRow(label: "Cadastrar piloto") {
            sheet = .novoPiloto
        }
        .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: - Linhas de Passageiros

    @ViewBuilder
    private var passageirosRows: some View {
        groupHeadRow(title: "Cadastrados", count: passageiroRepo.passageiros.count)
        ForEach(passageiroRepo.passageiros, id: \.id) { p in
            PersonRow(name: p.nome)
                .contentShape(Rectangle())
                .onTapGesture { sheet = .editarPassageiro(p) }
                .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        passageiroToDelete = p
                    } label: {
                        Text("Apagar")
                    }
                }
        }
        AddRow(label: "Cadastrar passageiro") {
            sheet = .novoPassageiro
        }
        .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func groupHeadRow(title: String, count: Int) -> some View {
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
        .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: - Delete confirmados

    private func confirmarDeletePiloto() {
        guard let p = pilotoToDelete else { return }
        pilotoToDelete = nil
        Task {
            try? await pilotoRepo.arquivar(pilotoId: p.id, rotulo: p.nome)
            try? await arquivoRepo.reload()
        }
    }

    private func confirmarDeletePassageiro() {
        guard let p = passageiroToDelete else { return }
        passageiroToDelete = nil
        Task {
            try? await passageiroRepo.arquivar(passageiroId: p.id, rotulo: p.nome)
            try? await arquivoRepo.reload()
        }
    }

    private func confirmarDeleteCombustivel() {
        guard let c = combustivelToDelete else { return }
        combustivelToDelete = nil
        Task {
            try? await combustivelRepo.arquivar(combustivelId: c.id, rotulo: c.nome)
            try? await arquivoRepo.reload()
        }
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
    let combustivelRepo = CombustivelRepository(queue: queue)
    return PessoasView()
        .environmentObject(pilotoRepo)
        .environmentObject(passageiroRepo)
        .environmentObject(combustivelRepo)
        .task {
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
            await combustivelRepo.bootstrap()
        }
}

#Preview("PessoasView — aba passageiros vazia") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let pilotoRepo = PilotoRepository(queue: queue)
    let passageiroRepo = PassageiroRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    return PessoasView(initialSubTab: .passageiros)
        .environmentObject(pilotoRepo)
        .environmentObject(passageiroRepo)
        .environmentObject(combustivelRepo)
        .task {
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
            await combustivelRepo.bootstrap()
        }
}

#Preview("PessoasView — aba combustíveis com seed") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let pilotoRepo = PilotoRepository(queue: queue)
    let passageiroRepo = PassageiroRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    return PessoasView(initialSubTab: .combustiveis)
        .environmentObject(pilotoRepo)
        .environmentObject(passageiroRepo)
        .environmentObject(combustivelRepo)
        .task {
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
            await combustivelRepo.bootstrap()
        }
}
