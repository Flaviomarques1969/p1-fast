// ═══════════════════════════════════════════════════════════
// ContentView — root view
// ═══════════════════════════════════════════════════════════
// Sprint 1A.1: provou esqueleto + DB local (splash com "DB: ok").
// Sprint 1A.2 — Prompt #7: ThemeShowcaseView (componentes Padrão B).
// Sprint 1A.2 — Prompt #8: HomeView (cheio | vazio).
// Sprint 1A.2 — Prompt #9: GaragemView + sheets de carro.
// Sprint 1A.2 — Prompt #10: EventosListaView + EventoDetalheView.
// Sprint 1A.3 — Prompt #11 (este): StintModalView + PosStintView,
//   acoplados ao EventoDetalheView (CTA "Novo stint" + tap em stint
//   real → finalize + recap).
//
// Splash renderizado enquanto `database.status == .idle` (milissegundos)
// e quando `.failed` (estado de erro visível).
//
// Roteamento por launch arg:
//   --p1-empty             → HomeView estado vazio
//   --p1-showcase          → ThemeShowcaseView (galeria do Prompt #7)
//   --p1-garagem           → GaragemView (lista)
//   --p1-garagem-novo      → GaragemView com sheet "Novo carro" aberta
//   --p1-garagem-carro     → GaragemView com sheet "Editar carro" do
//                            primeiro carro da lista
//   --p1-eventos           → EventosListaView (lista 1 ativo + 2 passados)
//   --p1-eventos-novo      → EventosListaView com sheet "Novo evento"
//   --p1-evento-detalhe    → EventosListaView com detalhe do 1º evento
//                            passado (padrão = 25/04, 4 stints)
//   --p1-stint-novo        → cria evento "demo Sprint 1A.3" + abre o
//                            detalhe com a sheet "Novo stint" pronta
//                            pra screenshot do StintModalView
//   --p1-pos-stint         → cria stint, finaliza (gera voltas mock) e
//                            abre PosStintView pra screenshot
//   --p1-pessoas           → PessoasView aba Pilotos (Prompt #12)
//   --p1-pessoas-passageiros → PessoasView aba Passageiros (Prompt #13)
//   --p1-piloto-novo       → PessoasView com sheet "Novo piloto" aberta
//   --p1-passageiro-novo   → PessoasView com sheet "Novo passageiro" aberta
//   --p1-combustiveis      → PessoasView aba Combustíveis (Prompt #15)
//   --p1-combustivel-novo  → PessoasView com sheet "Novo combustível" aberta
//   --p1-pneu-novo         → abre CarroModalView do primeiro carro já
//                            com a sheet "Novo pneu" aberta (Prompt #14)
//   default                → HomeView estado cheio (Sprint 1A.6 troca
//                            pelo Repository real)

import SwiftUI
import P1FastCore
import GRDB

private enum AppRoute {
    case home
    case homeEmpty
    case showcase
    case garagem
    case garagemNovo
    case garagemEditar
    case eventos
    case eventosNovo
    case eventoDetalhe
    case stintNovo
    case posStint
    case pessoasPilotos
    case pessoasPassageiros
    case pilotoNovo
    case passageiroNovo
    case combustiveis
    case combustivelNovo
    case pneuNovo

    static var fromLaunchArgs: AppRoute {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--p1-empty") { return .homeEmpty }
        if args.contains("--p1-showcase") { return .showcase }
        if args.contains("--p1-garagem-novo") { return .garagemNovo }
        if args.contains("--p1-garagem-carro") { return .garagemEditar }
        if args.contains("--p1-garagem") { return .garagem }
        if args.contains("--p1-eventos-novo") { return .eventosNovo }
        if args.contains("--p1-evento-detalhe") { return .eventoDetalhe }
        if args.contains("--p1-stint-novo") { return .stintNovo }
        if args.contains("--p1-pos-stint") { return .posStint }
        if args.contains("--p1-piloto-novo") { return .pilotoNovo }
        if args.contains("--p1-passageiro-novo") { return .passageiroNovo }
        if args.contains("--p1-pessoas-passageiros") { return .pessoasPassageiros }
        if args.contains("--p1-combustivel-novo") { return .combustivelNovo }
        if args.contains("--p1-combustiveis") { return .combustiveis }
        if args.contains("--p1-pessoas") { return .pessoasPilotos }
        if args.contains("--p1-pneu-novo") { return .pneuNovo }
        if args.contains("--p1-eventos") { return .eventos }
        return .home
    }
}

struct ContentView: View {
    @EnvironmentObject private var database: AppDatabase

    var body: some View {
        switch database.status {
        case .idle:
            Splash(stateLabel: "DB: subindo…", isError: false)
        case .ok:
            if let queue = database.queue {
                ReadyRoot(queue: queue)
            } else {
                Splash(stateLabel: "DB: ok mas sem queue", isError: true)
            }
        case .failed(let message):
            Splash(stateLabel: "DB: falhou\n\(message)", isError: true)
        }
    }
}

/// View construída APÓS DB.ok com queue válida — cria os repos como
/// `@StateObject` (uma única instância por subida do app) e injeta no
/// ambiente. Os repos têm bootstrap independentes e idempotentes.
private struct ReadyRoot: View {
    let queue: DatabaseQueue
    @StateObject private var carroRepo: CarroRepository
    @StateObject private var eventoRepo: EventoRepository
    @StateObject private var pilotoRepo: PilotoRepository
    @StateObject private var passageiroRepo: PassageiroRepository
    @StateObject private var combustivelRepo: CombustivelRepository
    @StateObject private var stintRepo: StintRepository
    @StateObject private var pneuRepo: PneuRepository

    init(queue: DatabaseQueue) {
        self.queue = queue
        _carroRepo = StateObject(wrappedValue: CarroRepository(queue: queue))
        _eventoRepo = StateObject(wrappedValue: EventoRepository(queue: queue))
        _pilotoRepo = StateObject(wrappedValue: PilotoRepository(queue: queue))
        _passageiroRepo = StateObject(wrappedValue: PassageiroRepository(queue: queue))
        _combustivelRepo = StateObject(wrappedValue: CombustivelRepository(queue: queue))
        _stintRepo = StateObject(wrappedValue: StintRepository(queue: queue))
        _pneuRepo = StateObject(wrappedValue: PneuRepository(queue: queue))
    }

    var body: some View {
        routedView
            .environmentObject(carroRepo)
            .environmentObject(eventoRepo)
            .environmentObject(pilotoRepo)
            .environmentObject(passageiroRepo)
            .environmentObject(combustivelRepo)
            .environmentObject(stintRepo)
            .environmentObject(pneuRepo)
            .task {
                await carroRepo.bootstrap()
                await eventoRepo.bootstrap()
                // PilotoRepo seeda os 2 pilotos canônicos. Tem que rodar
                // antes do StintRepo pra que o reloadPilotos pegue eles.
                await pilotoRepo.bootstrap()
                await passageiroRepo.bootstrap()
                await combustivelRepo.bootstrap()
                await stintRepo.bootstrap()
                await pneuRepo.bootstrap()
            }
    }

    @ViewBuilder
    private var routedView: some View {
        switch AppRoute.fromLaunchArgs {
        case .home:
            HomeView(state: .filled(HomeData.mockFilled))
        case .homeEmpty:
            HomeView(state: .empty)
        case .showcase:
            ThemeShowcaseView()
        case .garagem:
            GaragemView()
        case .garagemNovo:
            GaragemView(initialSheet: .novo)
        case .garagemEditar:
            GaragemViewEditFirst()
        case .eventos:
            EventosListaView()
        case .eventosNovo:
            EventosListaView(initialSheet: .novo)
        case .eventoDetalhe:
            EventosListaViewWithDetalhePadrao()
        case .stintNovo:
            StintNovoLauncher()
        case .posStint:
            PosStintLauncher()
        case .pessoasPilotos:
            PessoasView()
        case .pessoasPassageiros:
            PessoasView(initialSubTab: .passageiros)
        case .pilotoNovo:
            PessoasView(initialSheet: .novoPiloto, initialSubTab: .pilotos)
        case .passageiroNovo:
            PessoasView(initialSheet: .novoPassageiro, initialSubTab: .passageiros)
        case .combustiveis:
            PessoasView(initialSubTab: .combustiveis)
        case .combustivelNovo:
            PessoasView(initialSheet: .novoCombustivel, initialSubTab: .combustiveis)
        case .pneuNovo:
            PneuNovoLauncher()
        }
    }
}

/// Helper que cria um evento demo + abre detalhe direto na sheet
/// "Novo stint" pra screenshot rápido do StintModalView. Usado pelo
/// launch arg `--p1-stint-novo`.
private struct StintNovoLauncher: View {
    @EnvironmentObject private var eventoRepo: EventoRepository
    @State private var ready = false
    @State private var demoEventoId: String?

    var body: some View {
        Group {
            if ready, let eventoId = demoEventoId {
                EventoDetalheViewSheet(eventoId: eventoId, openSheet: .novoStint)
            } else {
                Splash(stateLabel: "Preparando stint demo…", isError: false)
            }
        }
        .task {
            for _ in 0..<15 {
                if !eventoRepo.eventos.isEmpty { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            // Usa o evento ativo hoje (02/05) — começa vazio (sem mocks).
            // Cai pro primeiro evento da lista se a seed mudar.
            let ativoId = EventoRepository.seedAtivoId
            demoEventoId = eventoRepo.find(id: ativoId)?.id ?? eventoRepo.eventos.first?.id
            ready = true
        }
    }
}

/// Helper que cria um stint, finaliza (gera voltas) e abre PosStintView.
/// Usado pelo launch arg `--p1-pos-stint`.
private struct PosStintLauncher: View {
    @EnvironmentObject private var eventoRepo: EventoRepository
    @EnvironmentObject private var stintRepo: StintRepository
    @State private var stintId: String?
    @State private var prepared = false

    var body: some View {
        Group {
            if let id = stintId {
                PosStintView(
                    stintId: id,
                    contextoLinha: "Brasília · 02/05",
                    onClose: {}
                )
                .environmentObject(stintRepo)
            } else {
                Splash(stateLabel: prepared ? "Sem stint demo" : "Preparando stint demo…", isError: false)
            }
        }
        .task {
            await prepararStintDemo()
            prepared = true
        }
    }

    private func prepararStintDemo() async {
        // Espera repos bootarem.
        for _ in 0..<15 {
            if !eventoRepo.eventos.isEmpty && !stintRepo.pilotos.isEmpty { break }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard let evento = eventoRepo.find(id: EventoRepository.seedAtivoId) ?? eventoRepo.eventos.first,
              let piloto = stintRepo.pilotos.first(where: { $0.id == PilotoRepository.pilotoFlavioId }) ?? stintRepo.pilotos.first else {
            return
        }
        do {
            let id = try await stintRepo.create(
                eventoId: evento.id,
                pilotoId: piloto.id,
                objetivoTipo: "Ataque",
                licaoFocada: "V-Min · apex",
                voltasPlanejadas: 12
            )
            _ = try await stintRepo.finalize(stintId: id, mediaVoltaMs: 102_500)
            self.stintId = id
        } catch {
            print("PosStintLauncher: prepare failed — \(error)")
        }
    }
}

/// EventoDetalheView wrapper que abre uma sheet específica (Novo stint
/// ou PosStint) ao montar — atalho pra screenshot do prompt #11.
private struct EventoDetalheViewSheet: View {
    @EnvironmentObject private var eventoRepo: EventoRepository
    @EnvironmentObject private var stintRepo: StintRepository
    let eventoId: String
    let openSheet: WhichSheet

    enum WhichSheet { case novoStint }

    @State private var presented = false

    var body: some View {
        ZStack {
            EventoDetalheView(eventoId: eventoId, onClose: { presented = false })
                .environmentObject(eventoRepo)
                .environmentObject(stintRepo)
            // Overlay invisível só pra disparar a sheet automaticamente.
            Color.clear
                .frame(width: 0, height: 0)
                .sheet(isPresented: $presented) {
                    switch openSheet {
                    case .novoStint:
                        StintModalView(
                            eventoId: eventoId,
                            proximoNumero: stintRepo.stintsPorEvento.count + 1,
                            contextoLinha: contextoLinha,
                            onCancel: { presented = false },
                            onCreated: { _ in presented = false }
                        )
                        .environmentObject(stintRepo)
                    }
                }
                .task {
                    // Pequeno delay pra detalhe terminar de montar antes da sheet.
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    presented = true
                }
        }
    }

    private var contextoLinha: String {
        guard let ev = eventoRepo.find(id: eventoId) else { return "" }
        let weekday = formatWeekdayLong(ev.evento.dataEvento)
        let dia = formatDayMonthShort(ev.evento.dataEvento)
        return "\(ev.pistaDisplay) · \(weekday.lowercased()) \(dia)"
    }
}

/// Helper que abre EventosListaView já com o detalhe do primeiro evento
/// passado (canonicamente 25/04 com 4 stints). Usado pelo launch arg
/// `--p1-evento-detalhe` pra screenshot rápida.
private struct EventosListaViewWithDetalhePadrao: View {
    @EnvironmentObject private var repo: EventoRepository
    @State private var initial: EventosSheet?
    @State private var ready = false

    var body: some View {
        Group {
            if ready {
                EventosListaView(initialSheet: initial)
            } else {
                Splash(stateLabel: "Abrindo evento…", isError: false)
            }
        }
        .task {
            // Espera o repo bootar (seed roda em bootstrap). 1.5s dá folga
            // pro screenshot script abrir a sheet sem flicker.
            for _ in 0..<15 {
                if !repo.eventos.isEmpty { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            // Prefere o passado canônico (25/04). Cai pra primeiro evento
            // qualquer se a seed mudar de IDs.
            let alvoId = EventoRepository.seedPassado1Id
            if repo.find(id: alvoId) != nil {
                initial = .detalhe(eventoId: alvoId)
            } else if let primeiro = repo.eventos.first {
                initial = .detalhe(eventoId: primeiro.id)
            }
            ready = true
        }
    }
}

/// Helper que abre o CarroModalView do primeiro carro com a sheet de
/// cadastro de pneu já visível. Usado pelo launch arg `--p1-pneu-novo`
/// pra screenshot do PneuCadastroView.
private struct PneuNovoLauncher: View {
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @State private var carroId: String?
    @State private var ready = false

    var body: some View {
        Group {
            if ready, let id = carroId {
                CarroModalView(
                    carroId: id,
                    initialPneuSheet: true,
                    onClose: {}
                )
                .environmentObject(carroRepo)
                .environmentObject(pneuRepo)
            } else {
                Splash(stateLabel: ready ? "Sem carro pra screenshot" : "Preparando carro demo…",
                       isError: false)
            }
        }
        .task {
            for _ in 0..<15 {
                if !carroRepo.carros.isEmpty { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if let primeiro = carroRepo.carros.first {
                carroId = primeiro.id
            } else {
                // Cria um carro demo só pra screenshot ter algo a abrir.
                if let id = try? await carroRepo.create(
                    apelido: "Demo pneu",
                    modelo: "Carro de mock",
                    categoria: nil,
                    cor: nil
                ) {
                    carroId = id
                }
            }
            ready = true
        }
    }
}

/// Helper que abre GaragemView já com a sheet de edição apontando pro
/// primeiro carro da lista (usado pelo launch arg `--p1-garagem-carro`).
/// Espera o repo bootar — se não houver carros ainda, abre só a lista.
private struct GaragemViewEditFirst: View {
    @EnvironmentObject private var repo: CarroRepository
    @State private var initial: GaragemSheet?
    @State private var ready = false

    var body: some View {
        Group {
            if ready {
                GaragemView(initialSheet: initial)
            } else {
                Splash(stateLabel: "Abrindo carro…", isError: false)
            }
        }
        .task {
            for _ in 0..<15 {
                if !repo.carros.isEmpty { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if let primeiro = repo.carros.first {
                initial = .editar(carroId: primeiro.id)
            }
            ready = true
        }
    }
}

private struct Splash: View {
    let stateLabel: String
    let isError: Bool

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            VStack(spacing: 4) {
                Text("P1 Fast")
                    .font(.system(size: 56, weight: .heavy, design: .default))
                    .tracking(-0.5)
                    .foregroundStyle(Color.text)
                Text("v\(Configuration.appVersion) · build \(Configuration.buildNumber)")
                    .font(.monoP1)
                    .foregroundStyle(Color.textMuted)
            }
            Spacer()
            Text(stateLabel)
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .multilineTextAlignment(.center)
                .foregroundStyle(isError ? Color.red : Color.text)
                .padding(.horizontal, Spacing.lg)
            Text(footerHint)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textFaint)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
                .padding(.bottom, Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
        .preferredColorScheme(.dark)
    }

    private var footerHint: String {
        let supa = Configuration.hasSupabaseCredentials ? "ok" : "não configurado"
        let daily = Configuration.hasDailyCredentials ? "ok" : "não configurado"
        return "Supabase: \(supa) · Daily.co: \(daily)"
    }
}

#Preview("ContentView — DB ok (Home cheio)") {
    let db = AppDatabase()
    return ContentView()
        .environmentObject(db)
        .task { await db.bootstrap() }
}

#Preview("Splash — idle") {
    Splash(stateLabel: "DB: subindo…", isError: false)
}
