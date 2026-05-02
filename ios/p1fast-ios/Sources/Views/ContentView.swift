// ═══════════════════════════════════════════════════════════
// ContentView — root view
// ═══════════════════════════════════════════════════════════
// Sprint 1A.1: provou esqueleto + DB local (splash com "DB: ok").
// Sprint 1A.2 — Prompt #7: ThemeShowcaseView (componentes Padrão B).
// Sprint 1A.2 — Prompt #8: HomeView (cheio | vazio).
// Sprint 1A.2 — Prompt #9: GaragemView + sheets de carro.
// Sprint 1A.2 — Prompt #10 (este): EventosListaView + EventoDetalheView.
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

    static var fromLaunchArgs: AppRoute {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--p1-empty") { return .homeEmpty }
        if args.contains("--p1-showcase") { return .showcase }
        if args.contains("--p1-garagem-novo") { return .garagemNovo }
        if args.contains("--p1-garagem-carro") { return .garagemEditar }
        if args.contains("--p1-garagem") { return .garagem }
        if args.contains("--p1-eventos-novo") { return .eventosNovo }
        if args.contains("--p1-evento-detalhe") { return .eventoDetalhe }
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

    init(queue: DatabaseQueue) {
        self.queue = queue
        _carroRepo = StateObject(wrappedValue: CarroRepository(queue: queue))
        _eventoRepo = StateObject(wrappedValue: EventoRepository(queue: queue))
    }

    var body: some View {
        routedView
            .environmentObject(carroRepo)
            .environmentObject(eventoRepo)
            .task {
                await carroRepo.bootstrap()
                await eventoRepo.bootstrap()
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
        }
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
