// ═══════════════════════════════════════════════════════════
// HubMockLauncher — atalho SÓ-DEV pra validar o CarroHubView
// ═══════════════════════════════════════════════════════════
// Ativado pelo launch arg `--p1-hub-mock`. Abre o hub do carro num
// banco em memória, com um carro amarelo "Bolinha" e uma foto LARGA
// de teste (pra reproduzir o cenário real da foto de fundo no
// simulador, sem precisar de login). Não afeta o app normal.

import SwiftUI
import UIKit
import AudioToolbox
import P1FastCore
import GRDB

struct HubMockLauncher: View {
    @StateObject private var carroRepo: CarroRepository
    @StateObject private var manutencaoStore: ManutencaoConsumiveisStore
    @StateObject private var pecaRepo: PecaRepository
    @StateObject private var pneuRepo: PneuRepository
    @StateObject private var freioRepo: FreioRepository
    // Repos extras pra abrir a EventoDetalheView no mock de prontidão (Fase 0).
    @StateObject private var stintRepo: StintRepository
    @StateObject private var voltaVideoRepo: VoltaVideoRepository
    // Repos que a Garagem (sub-abas) e a aba Pendências precisam — 2026-06-14.
    @StateObject private var eventoRepo: EventoRepository
    @StateObject private var pilotoRepo: PilotoRepository
    @StateObject private var passageiroRepo: PassageiroRepository
    @StateObject private var combustivelRepo: CombustivelRepository
    @StateObject private var licaoRepo: LicaoRepository
    @StateObject private var pendenciaRepo: PendenciaRepository
    @StateObject private var estoqueRepo: EstoqueRepository
    @StateObject private var arquivoRepo: ArquivoRepository
    /// Só-dev (J4): coordenador de envio "de mentira" pra a seção "Ferramentas
    /// de teste" da Garagem aparecer no mock (ela é gated por syncCoordinator
    /// != nil, igual ao grupo "Conta"). Não sobe nada — só existe pra o gate.
    @StateObject private var reachabilityMock: Reachability
    @StateObject private var syncCoordinatorMock: SyncCoordinator
    /// NavRouter ESTÁVEL (como no ReadyRoot real) — sem isto, cada publish dos
    /// repos recriaria o router e jogaria a navegação de volta pra raiz.
    @StateObject private var router = NavRouter()
    /// Equipe (login por PIN) — só-dev, telas `--p1-equipe` / `--p1-login-pin`.
    @StateObject private var equipeStore: EquipeStore
    /// Marcações do checklist do stint (gravadas no banco) — tela `--p1-execucao`.
    @StateObject private var stintCheckStore: StintCheckStore
    /// Marcações do checklist do DIA do evento (gravadas no banco) — tela `--p1-execucao-dia`.
    @StateObject private var diaCheckStore: DiaCheckStore

    @State private var carroId: String?
    @State private var eventoRealId: String?
    @State private var stintRealId: String?
    @State private var ready = false
    private let queue: DatabaseQueue

    init() {
        // Sem login não há equipe; o create de carro exige uma. Finge uma.
        UserDefaults.standard.set("00000000-0000-0000-0000-0000000000AA",
                                  forKey: TeamContext.storageKey)
        let queue = try! DB.makeMemoryQueue()
        self.queue = queue
        _carroRepo = StateObject(wrappedValue: CarroRepository(queue: queue))
        _manutencaoStore = StateObject(wrappedValue: ManutencaoConsumiveisStore(queue: queue))
        _pecaRepo = StateObject(wrappedValue: PecaRepository(queue: queue))
        _pneuRepo = StateObject(wrappedValue: PneuRepository(queue: queue))
        _freioRepo = StateObject(wrappedValue: FreioRepository(queue: queue))
        _stintRepo = StateObject(wrappedValue: StintRepository(queue: queue))
        _voltaVideoRepo = StateObject(wrappedValue: VoltaVideoRepository(queue: queue))
        _eventoRepo = StateObject(wrappedValue: EventoRepository(queue: queue))
        _pilotoRepo = StateObject(wrappedValue: PilotoRepository(queue: queue))
        _passageiroRepo = StateObject(wrappedValue: PassageiroRepository(queue: queue))
        _combustivelRepo = StateObject(wrappedValue: CombustivelRepository(queue: queue))
        _licaoRepo = StateObject(wrappedValue: LicaoRepository(queue: queue))
        _pendenciaRepo = StateObject(wrappedValue: PendenciaRepository(queue: queue))
        _estoqueRepo = StateObject(wrappedValue: EstoqueRepository(queue: queue))
        _arquivoRepo = StateObject(wrappedValue: ArquivoRepository(queue: queue))
        let reachMock = Reachability()
        _reachabilityMock = StateObject(wrappedValue: reachMock)
        _syncCoordinatorMock = StateObject(wrappedValue: SyncCoordinator(queue: queue, reachability: reachMock))
        _equipeStore = StateObject(wrappedValue: EquipeStore(queue: queue))
        _stintCheckStore = StateObject(wrappedValue: StintCheckStore(queue: queue, stintId: "stint-demo"))
        _diaCheckStore = StateObject(wrappedValue: DiaCheckStore(queue: queue, eventoId: "evento-demo", dia: "2026-06-24"))
        // Atalhos de prova do checklist do stint precisam da equipe já no banco
        // ANTES de qualquer tela ler (evita corrida com a semente do .task).
        if ProcessInfo.processInfo.arguments.contains("--p1-execucao-stint-real")
            || ProcessInfo.processInfo.arguments.contains("--p1-checklist-stint-real") {
            EquipeStore(queue: queue).seedDemoSeVazio()
        }
    }

    var body: some View {
        Group {
            if ProcessInfo.processInfo.arguments.contains("--p1-equipe") {
                // Tela de cadastro da Equipe (papel + PIN) — não precisa de carro.
                // Semeia 5 membros de exemplo SÓ aqui (no app real começa vazio).
                EquipeCadastroView(store: equipeStore)
                    .onAppear { equipeStore.seedDemoSeVazio() }
            } else if ProcessInfo.processInfo.arguments.contains("--p1-login-pin") {
                // Tela de entrada por PIN — não precisa de carro.
                PINLoginView(store: equipeStore)
                    .onAppear { equipeStore.seedDemoSeVazio() }
            } else if ProcessInfo.processInfo.arguments.contains("--p1-criar-stint") {
                // Criar stint — distribuição do checklist por papel.
                CriarStintView(store: equipeStore)
                    .onAppear { equipeStore.seedDemoSeVazio() }
            } else if ProcessInfo.processInfo.arguments.contains("--p1-execucao") {
                // Execução por pessoa (marca os itens, GRAVA no banco) + finalizar.
                ExecucaoStintView(store: stintCheckStore)
            } else if ready, ProcessInfo.processInfo.arguments.contains("--p1-execucao-stint-real") {
                // Wrapper REAL do checklist do stint: "Quem é você?" (equipe real,
                // já semeada no preparo) → itens da pessoa por papel → GRAVA em
                // stint_check (sem demo). Gated por `ready` pra a equipe já existir.
                ExecucaoStintRealView(queue: queue, stintId: "stint-demo", stintLabel: "Stint 3",
                                      devAutoPickFirst: ProcessInfo.processInfo.arguments.contains("--p1-auto-pessoa"),
                                      devVisaoChefe: ProcessInfo.processInfo.arguments.contains("--p1-visao-chefe"),
                                      devCarroVoltou: ProcessInfo.processInfo.arguments.contains("--p1-carro-voltou"),
                                      devPinGate: ProcessInfo.processInfo.arguments.contains("--p1-pin-gate"))
            } else if ProcessInfo.processInfo.arguments.contains("--p1-execucao-dia") {
                // Execução do checklist do DIA (início/fim do dia), por pessoa — GRAVA no banco.
                ExecucaoDiaView(store: diaCheckStore)
            } else if ready, let id = carroId {
                if ProcessInfo.processInfo.arguments.contains("--p1-estoque-editar") {
                    // Editor único de item (botões + câmera/OCR) — screenshot do editor.
                    EstoqueItemEditorView(item: nil, escopoInicial: EstoqueRepository.escopoGeral,
                                          onClose: {}, onSaved: { _ in })
                        .environmentObject(estoqueRepo)
                        .environmentObject(carroRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-garagem-equipe") {
                    // Garagem aberta na sub-aba "Equipe" (prova da integração).
                    GaragemView(initialSubTab: .equipe)
                        .environmentObject(carroRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(equipeStore)
                        .onAppear { equipeStore.seedDemoSeVazio() }
                } else if ProcessInfo.processInfo.arguments.contains("--p1-garagem-home") {
                    // Garagem aberta na HOME (layout premium v6: lista de grupos).
                    GaragemView(initialSubTab: .carros)
                        .environmentObject(carroRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(equipeStore)
                        .onAppear { equipeStore.seedDemoSeVazio() }
                } else if ProcessInfo.processInfo.arguments.contains("--p1-garagem-ferramentas") {
                    // SÓ-DEV (J4): prova por foto da seção "Ferramentas de teste"
                    // no fim da Garagem e das duas telas abrindo POR ELA, sem
                    // login. Pilha própria que resolve os MESMOS HomeNavTarget que
                    // a HomeView resolve no app real. --p1-goto-teste /
                    // --p1-goto-telemetria pré-empilham o destino (equivale ao toque).
                    GaragemFerramentasProva(queue: queue, syncCoordinator: syncCoordinatorMock)
                        .environmentObject(carroRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(equipeStore)
                        .onAppear { equipeStore.seedDemoSeVazio() }
                } else if ProcessInfo.processInfo.arguments.contains("--p1-garagem-checklist") {
                    // Garagem aberta na sub-aba "Checklist" (gestão do checklist do stint).
                    GaragemView(initialSubTab: .checklist)
                        .environmentObject(carroRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(equipeStore)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-estoque") {
                    // Garagem aberta direto na sub-aba "Estoque geral".
                    GaragemView(initialSubTab: .estoqueGeral)
                        .environmentObject(carroRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(equipeStore)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-apagados") {
                    // Tela "Apagados" (resgate) com 2 carros arquivados de exemplo —
                    // prova de que apagar esconde e dá pra resgatar.
                    ApagadosView(
                        arquivoRepo: arquivoRepo,
                        entidade: .carros,
                        onRestaurar: { item in
                            Task {
                                try? await carroRepo.restaurar(carroId: item.itemId)
                                try? await arquivoRepo.reload()
                            }
                        },
                        onClose: {}
                    )
                    .environmentObject(arquivoRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-preco-ml") {
                    // Busca de preço no Mercado Livre (navegador embutido) — valida
                    // que o app lê o preço de dentro do próprio aparelho.
                    BuscaPrecoMLView(termo: "sabo 02370", onUsar: { _ in }, onClose: {})
                } else if ProcessInfo.processInfo.arguments.contains("--p1-peca-editar") {
                    // Tela de EDIÇÃO de peça (pré-preenchida) — valida o título
                    // "Editar peça", os campos preenchidos e o botão Apagar.
                    PecaNovoFormView(
                        pecaParaEditar: Self.pecaMock(carroId: id),
                        onApagada: {},
                        onClose: {}
                    )
                    .environmentObject(pecaRepo)
                    .environmentObject(carroRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-peca-detalhe") {
                    // Detalhe/usar da peça — valida o botão Editar na barra e a
                    // ausência do Apagar nesta tela.
                    NavigationStack {
                        PecaDetalheView(peca: Self.pecaMock(carroId: id), onClose: {})
                    }
                    .environmentObject(pecaRepo)
                    .environmentObject(carroRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-peca") {
                    // Cadastro de peça direto, pra validar UI das fotos + scanner.
                    PecaNovoFormView(carroIdSugerido: id, onClose: {})
                        .environmentObject(pecaRepo)
                        .environmentObject(carroRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-evento-concluido") {
                    // FASE 1 (prova visual): evento SEEDADO (tem stints/voltas/
                    // melhor) → fase Concluído (vitrine do melhor tempo).
                    NavigationStack {
                        EventoDetalheView(eventoId: EventoRepository.seedPassado1Id, onClose: {})
                    }
                    .environmentObject(eventoRepo)
                    .environmentObject(stintRepo)
                    .environmentObject(carroRepo)
                    .environmentObject(pneuRepo)
                    .environmentObject(combustivelRepo)
                    .environmentObject(pendenciaRepo)
                    .environmentObject(estoqueRepo)
                    .environmentObject(voltaVideoRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-checklist-stint-real"), let evId = eventoRealId {
                    // AMARRAÇÃO: tela do evento REAL com um stint real → botão
                    // "Checklist do stint" → "Quem é você?" → marca e GRAVA em
                    // stint_check (fila real injetada via \.databaseQueue).
                    NavigationStack {
                        EventoDetalheView(eventoId: evId, onClose: {})
                    }
                    .environmentObject(eventoRepo)
                    .environmentObject(stintRepo)
                    .environmentObject(carroRepo)
                    .environmentObject(pneuRepo)
                    .environmentObject(combustivelRepo)
                    .environmentObject(pendenciaRepo)
                    .environmentObject(estoqueRepo)
                    .environmentObject(voltaVideoRepo)
                    .environment(\.databaseQueue, queue)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-evento-prontidao"), let evId = eventoRealId {
                    // FASE 0 (padrão premium): tela do evento REAL com ~metade do
                    // checklist conferido → a célula "Pronto" do resumo mostra o %
                    // VERDADEIRO (antes era 0 cravado). Prova visual da ligação.
                    NavigationStack {
                        EventoDetalheView(eventoId: evId, onClose: {})
                    }
                    .environmentObject(eventoRepo)
                    .environmentObject(stintRepo)
                    .environmentObject(carroRepo)
                    .environmentObject(pneuRepo)
                    .environmentObject(combustivelRepo)
                    .environmentObject(pendenciaRepo)
                    .environmentObject(estoqueRepo)
                    .environmentObject(voltaVideoRepo)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-home-prep") {
                    // FASE 2 (prova visual): Home modo preparação, enxuta (sem
                    // foto de fundo e sem carros) pra a barra de prontidão do
                    // próximo evento + a linha "Assistir" caberem numa tela só.
                    HomeView(state: .filled(Self.homeDataPrep()))
                        .environmentObject(carroRepo).environmentObject(manutencaoStore)
                        .environmentObject(pecaRepo).environmentObject(pneuRepo)
                        .environmentObject(freioRepo).environmentObject(eventoRepo)
                        .environmentObject(pilotoRepo).environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo).environmentObject(licaoRepo)
                        .environmentObject(pendenciaRepo).environmentObject(estoqueRepo)
                        .environmentObject(arquivoRepo).environmentObject(router)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-home") {
                    // Home ROOT (sem empilhar nada) com a FOTO DO CARRO HERÓI
                    // ao fundo — prova visual do pedido do Flávio 2026-06-21.
                    HomeView(state: .filled(Self.homeDataComHero(carroId: id)))
                        .environmentObject(carroRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(pecaRepo)
                        .environmentObject(pneuRepo)
                        .environmentObject(freioRepo)
                        .environmentObject(eventoRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(pendenciaRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(router)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-eventos-cheio") {
                    // ONDA 1 (prova visual): a LISTA DE EVENTOS premium — herói
                    // do próximo evento (prontidão real ~51%) + linha do tempo
                    // dos passados + botão "+ Novo evento" FIXO no topo direito.
                    NavigationStack {
                        EventosListaView()
                    }
                    .environmentObject(eventoRepo)
                    .environmentObject(stintRepo)
                    .environmentObject(carroRepo)
                    .environmentObject(pneuRepo)
                    .environmentObject(combustivelRepo)
                    .environmentObject(pendenciaRepo)
                    .environmentObject(estoqueRepo)
                    .environmentObject(voltaVideoRepo)
                    .environmentObject(router)
                } else if ProcessInfo.processInfo.arguments.contains("--p1-pessoas") {
                    // ONDA PESSOAS (prova visual, aprovada 2026-06-23): a tela
                    // "Cadastros" (aba Pilotos) com a NOVA linha de medidas reais
                    // (altura · peso · idade). 3 estados de exemplo: completo /
                    // sem nascimento / sem medidas.
                    PessoasView()
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(arquivoRepo)
                } else {
                    // Monta a Home REAL (com o menu fixo) já empilhada no hub,
                    // pra validar a navegação de verdade no simulador.
                    // `--p1-deep` empilha tb o Estoque, pra checar telas internas.
                    HomeView(state: .filled(HomeData.mockFilled),
                             initialRoute: rotaMock(carroId: id))
                        .environmentObject(carroRepo)
                        .environmentObject(manutencaoStore)
                        .environmentObject(pecaRepo)
                        .environmentObject(pneuRepo)
                        .environmentObject(freioRepo)
                        .environmentObject(eventoRepo)
                        .environmentObject(pilotoRepo)
                        .environmentObject(passageiroRepo)
                        .environmentObject(combustivelRepo)
                        .environmentObject(licaoRepo)
                        .environmentObject(pendenciaRepo)
                        .environmentObject(estoqueRepo)
                        .environmentObject(arquivoRepo)
                        .environmentObject(router)
                }
            } else {
                Color.black.ignoresSafeArea()
            }
        }
        .task {
            await carroRepo.bootstrap()
            await pecaRepo.bootstrap()
            await eventoRepo.bootstrap()
            await pilotoRepo.bootstrap()
            await passageiroRepo.bootstrap()
            await combustivelRepo.bootstrap()
            await licaoRepo.bootstrap()
            await pendenciaRepo.bootstrap()
            await estoqueRepo.bootstrap()
            await arquivoRepo.bootstrap()
            await seedEstoqueMockIfNeeded()
            if ProcessInfo.processInfo.arguments.contains("--p1-pessoas") {
                await seedPilotosMock()
            }
            // Evento FUTURO de demonstração: a seed só tem eventos passados,
            // então a aba "Pendências" (próximo evento) abriria vazia no mock.
            // 7 dias à frente, na pista seed (Brasília).
            var evIdMock = eventoRepo.proximoEvento()?.id
            if evIdMock == nil {
                let trackId = eventoRepo.eventos.first?.evento.trackId
                let em7dias = Int64(Date().timeIntervalSince1970 * 1000) + 7 * 86_400_000
                evIdMock = try? await eventoRepo.create(trackId: trackId, tipo: "track-day", dataEvento: em7dias)
            }
            // FASE 0 (prova visual): cria as instâncias do checklist desse evento
            // e tica 23 de 45 → célula "Pronto" mostra 51% (número real).
            if (ProcessInfo.processInfo.arguments.contains("--p1-evento-prontidao")
                || ProcessInfo.processInfo.arguments.contains("--p1-eventos-cheio")), let evId = evIdMock {
                try? await pendenciaRepo.ensureInstancesForEvento(evId)
                let itens = pendenciaRepo.grupos(forEventoId: evId).flatMap { $0.itens }
                for item in itens.prefix(23) {
                    try? await pendenciaRepo.toggle(instanceId: item.id, novo: true)
                }
                eventoRealId = evId
            }
            // Prova visual da AMARRAÇÃO do checklist do stint: cria um stint
            // REAL no evento de demonstração e semeia a equipe, pra a tela do
            // evento mostrar o card do stint + o botão "Checklist do stint".
            if ProcessInfo.processInfo.arguments.contains("--p1-checklist-stint-real"), let evId = evIdMock {
                let pilotoId = pilotoRepo.pilotos.first?.id ?? PilotoRepository.pilotoFlavioId
                let sId = try? await stintRepo.create(
                    eventoId: evId, pilotoId: pilotoId,
                    objetivoTipo: "Treino", licaoFocada: "Constância",
                    voltasPlanejadas: 8
                )
                eventoRealId = evId
                stintRealId = sId
            }
            var id = carroRepo.carros.first?.id
            if id == nil {
                id = try? await carroRepo.create(
                    apelido: "Bolinha",
                    modelo: "Celta 1.4 Chevrolet",
                    categoria: "Turismo",
                    cor: "#f5c400"
                )
            }
            if let id, CarroFoto.carregar(carroId: id) == nil {
                CarroFoto.salvar(carroId: id, imagem: Self.fotoMockWide())
            }
            // Screenshot da tela "Apagados": arquiva 2 carros de exemplo, que
            // somem da Garagem (filtro) e aparecem na lista de resgate.
            if ProcessInfo.processInfo.arguments.contains("--p1-apagados") {
                if let c1 = try? await carroRepo.create(apelido: "Bolinha 2", modelo: "Celta 1.0", categoria: "Turismo", cor: nil) {
                    try? await carroRepo.arquivar(carroId: c1, rotulo: "Bolinha 2")
                }
                if let c2 = try? await carroRepo.create(apelido: "Fusca de teste", modelo: "VW 1300", categoria: "Clássico", cor: nil) {
                    try? await carroRepo.arquivar(carroId: c2, rotulo: "Fusca de teste")
                }
                try? await arquivoRepo.reload()
            }
            carroId = id
            ready = true
        }
        .environmentObject(equipeStore)
    }

    /// Semeia alguns itens no estoque geral pra screenshot não ficar vazio.
    /// Mostra os 3 tipos de "como conta": simples, embalagem e conjunto.
    private func seedEstoqueMockIfNeeded() async {
        guard estoqueRepo.itens.isEmpty else { return }
        func b(_ id: String) -> BlocoPend { EstoqueRepository.bloco(id: id) }
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "ferramenta",
            bloco: b("G1"), nome: "Compressor de ar", especificacao: nil, categoria: "obrig",
            contagem: "simples", quantidade: 1, volume: nil, unidade: nil, embalagens: nil, partes: [], foto: nil)
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "ferramenta",
            bloco: b("G6"), nome: "Caixa de ferramentas", especificacao: nil, categoria: "obrig",
            contagem: "simples", quantidade: 1, volume: nil, unidade: nil, embalagens: nil, partes: [], foto: nil)
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "item",
            bloco: b("G5"), nome: "Extintor", especificacao: nil, categoria: "obrig",
            contagem: "simples", quantidade: 1, volume: nil, unidade: nil, embalagens: nil, partes: [], foto: nil)
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "item",
            bloco: b("G1"), nome: "Óleo motor", especificacao: "Mobil 5W30 sintético", categoria: "obrig",
            contagem: "embalagem", quantidade: 1, volume: 1, unidade: "L", embalagens: 4, partes: [], foto: nil)
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "item",
            bloco: b("G3"), nome: "Jacks (cavaletes)", especificacao: nil, categoria: "obrig",
            contagem: "simples", quantidade: 4, volume: nil, unidade: nil, embalagens: nil, partes: [], foto: nil)
        _ = try? await estoqueRepo.criar(escopo: EstoqueRepository.escopoGeral, kind: "item",
            bloco: b("G3"), nome: "Rodas sobressalentes", especificacao: nil, categoria: "desej",
            contagem: "conjunto", quantidade: 1, volume: nil, unidade: nil, embalagens: nil,
            partes: [.init(nome: "Aro 15", qtd: 4), .init(nome: "Aro 14", qtd: 4)], foto: nil)
    }

    /// Pilotos de exemplo pros 3 estados da linha de medidas (prova da onda
    /// Pessoas): completo · sem nascimento · sem medidas. Banco em memória,
    /// fresco a cada abertura — sem risco de duplicar.
    private func seedPilotosMock() async {
        _ = try? await pilotoRepo.create(nome: "Flávio", alturaCm: 175, pesoKg: 78,
                                         nascimento: Self.nascMs(ano: 1979, mes: 3, dia: 12))
        _ = try? await pilotoRepo.create(nome: "Bubi", alturaCm: 180, pesoKg: 82, nascimento: nil)
        _ = try? await pilotoRepo.create(nome: "Convidado", alturaCm: nil, pesoKg: nil, nascimento: nil)
    }

    /// Data de nascimento → ms epoch UTC midnight (como o schema grava).
    private static func nascMs(ano: Int, mes: Int, dia: Int) -> Int64 {
        var c = DateComponents(); c.year = ano; c.month = mes; c.day = dia
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? cal.timeZone
        let d = cal.date(from: c) ?? Date(timeIntervalSince1970: 0)
        return Int64(d.timeIntervalSince1970 * 1000)
    }

    /// Rota inicial do mock: hub do carro; com `--p1-deep` empilha tb o Estoque.
    private func rotaMock(carroId id: String) -> [HomeNavTarget] {
        if ProcessInfo.processInfo.arguments.contains("--p1-menu") {
            // Mostra a Garagem reorganizada direto (sem empilhar o hub) — pra
            // validar/screenshot do menu novo (sub-abas + aba Pendências).
            return [.garagem]
        }
        if ProcessInfo.processInfo.arguments.contains("--p1-pend") {
            // Abre a aba Pendências (próximo evento) direto.
            return [.pendencias]
        }
        if ProcessInfo.processInfo.arguments.contains("--p1-deep") {
            return [.garagem, .carroHub(carroId: id), .carroCadastro(carroId: id)]
        }
        return [.garagem, .carroHub(carroId: id)]
    }

    /// HomeData de exemplo com o carro herói preenchido — sua foto vira o
    /// fundo da Home (prova do `--p1-home`).
    private static func homeDataComHero(carroId: String) -> HomeData {
        // Base oficial: HomeData não tem campos premium (heroCarroId); usa o mock padrão.
        return HomeData.mockFilled
    }

    /// HomeData enxuta (sem foto/sem carros) pra screenshot do modo preparação
    /// com a barra de prontidão do próximo evento visível (`--p1-home-prep`).
    private static func homeDataPrep() -> HomeData {
        // Base oficial: usa o mock padrão (sem campos premium que não existem aqui).
        return HomeData.mockFilled
    }

    /// Foto landscape 1920×1080 de teste (faixas verde-limão) — só pra
    /// reproduzir o `scaledToFill` de uma foto larga.
    private static func fotoMockWide() -> UIImage {
        let size = CGSize(width: 1920, height: 1080)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            UIColor(red: 0.80, green: 0.86, blue: 0.05, alpha: 1).setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            UIColor(red: 0.10, green: 0.50, blue: 0.20, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 380, width: 1920, height: 320))
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 520, width: 1920, height: 40))
        }
    }

    /// Peça fake pré-preenchida, pra validar as telas de detalhe e edição.
    private static func pecaMock(carroId: String) -> Peca {
        Peca(
            id: "mock-peca-0001",
            timeId: "00000000-0000-0000-0000-0000000000AA",
            carroId: carroId,
            nome: "Correia do alternador",
            codigo: "5PK890",
            area: .motor,
            tipo: .componente,
            especificacao: "Tensão conforme manual · marca Gates",
            quantidade: 2,
            precoUnitarioCents: 8990
        )
    }
}

// ═══════════════════════════════════════════════════════════
// GaragemFerramentasProva — prova por foto da seção "Ferramentas
// de teste" da Garagem (J4 — Home "Dia de Pista"), sem login.
// ═══════════════════════════════════════════════════════════
// Pilha própria que resolve os MESMOS `HomeNavTarget` que a HomeView
// resolve no app real pras portas de teste — então a foto prova tanto a
// SEÇÃO no fim da Garagem quanto as duas telas abrindo POR ELA.
private struct GaragemFerramentasProva: View {
    let queue: DatabaseQueue
    /// Só pra a seção aparecer (GaragemView a mostra quando != nil).
    let syncCoordinator: SyncCoordinator
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            GaragemView(syncCoordinator: syncCoordinator)
                .navigationDestination(for: HomeNavTarget.self) { target in
                    switch target {
                    case .testeAoVivo:
                        TesteAoVivoView(onClose: { if !path.isEmpty { path.removeLast() } })
                            .navigationBarBackButtonHidden(true)
                    case .telemetriaDemo:
                        TelemetriaView(queue: queue, trackBundle: nil)
                    default:
                        EmptyView()
                    }
                }
        }
        .onAppear {
            let a = ProcessInfo.processInfo.arguments
            if a.contains("--p1-goto-teste") {
                path.append(HomeNavTarget.testeAoVivo)
            } else if a.contains("--p1-goto-telemetria") {
                path.append(HomeNavTarget.telemetriaDemo)
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Equipe do box — login por PIN (SÓ-DEV por enquanto)
// ═══════════════════════════════════════════════════════════
// Telas novas hospedadas aqui (arquivo já-membro do projeto). Provadas pelos
// atalhos `--p1-equipe` (cadastro) e `--p1-login-pin` (entrada). NÃO tocam a
// porta de entrada real do app — isso é etapa futura, com cuidado.

/// Papéis que entram na equipe do box.
private let papeisEquipe: [PapelPessoa] = [.piloto, .mecanico, .engenheiro, .chefeEquipe, .convidado]

/// Rótulo de UI do papel (Visitante = convidado; Chefe de equipe).
private func rotuloPapel(_ p: PapelPessoa) -> String {
    switch p {
    case .chefeEquipe: return "Chefe de equipe"
    case .convidado:   return "Visitante"
    default:           return p.legivel
    }
}

/// Acesso aos membros da equipe (CRUD local + login por PIN). SÓ-DEV.
@MainActor
final class EquipeStore: ObservableObject {
    @Published private(set) var membros: [EquipeMembro] = []
    private let queue: DatabaseQueue
    init(queue: DatabaseQueue) { self.queue = queue }

    private var timeId: String { TeamContext.currentTeamId ?? "00000000-0000-0000-0000-0000000000AA" }

    func carregar() {
        let tid = timeId
        membros = (try? queue.read { db in
            try EquipeMembro
                .filter(sql: "time_id = ? AND ativo = 1", arguments: [tid])
                .order(sql: "nome COLLATE NOCASE")
                .fetchAll(db)
        }) ?? []
    }

    func salvar(idExistente: String?, nome: String, papel: PapelPessoa, pin: String) {
        let nomeT = nome.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !nomeT.isEmpty else { return }
        let tid = timeId
        try? queue.write { db in
            ensureTime(db, tid)
            if let id = idExistente, var m = try EquipeMembro.fetchOne(db, key: id) {
                m.nome = nomeT; m.papel = papel.rawValue; m.updatedAt = DB.nowMs()
                if PinSeguranca.pinValido(pin) {
                    m.pinHash = PinSeguranca.hash(pin: pin, salt: m.id)
                    m.pinSetEm = DB.nowMs()
                }
                try m.update(db)
                // Fase 1 multi-aparelho: enfileira a edição pra subir pra nuvem
                // (a equipe passa a aparecer igual em todos os celulares).
                try SyncQueue.enqueueRecord(db, tableName: "equipe_membros", rowId: m.id, op: .update, record: m)
            } else {
                var m = EquipeMembro(timeId: tid, nome: nomeT, papel: papel)
                if PinSeguranca.pinValido(pin) {
                    m.pinHash = PinSeguranca.hash(pin: pin, salt: m.id)
                    m.pinSetEm = DB.nowMs()
                }
                try m.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "equipe_membros", rowId: m.id, op: .insert, record: m)
            }
        }
        carregar()
    }

    func remover(_ m: EquipeMembro) {
        try? queue.write { db in
            var x = m; x.ativo = false; x.updatedAt = DB.nowMs(); try x.update(db)
            // Soft-delete (ativo=false) é uma atualização — enfileira pra nuvem.
            try SyncQueue.enqueueRecord(db, tableName: "equipe_membros", rowId: x.id, op: .update, record: x)
        }
        carregar()
    }

    /// PIN identifica a pessoa: acha o membro cujo hash bate.
    func entrarComPin(_ pin: String) -> EquipeMembro? {
        guard PinSeguranca.pinValido(pin) else { return nil }
        return membros.first { m in
            guard let h = m.pinHash else { return false }
            return PinSeguranca.confere(pin: pin, hash: h, salt: m.id)
        }
    }

    func seedDemoSeVazio() {
        let tid = timeId
        try? queue.write { db in
            ensureTime(db, tid)
            let n = try EquipeMembro.fetchCount(db)
            guard n == 0 else { return }
            let demo: [(String, PapelPessoa, String)] = [
                ("Flávio", .chefeEquipe, "1313"),
                ("Bubi",   .piloto,      "2222"),
                ("Marcos", .mecanico,    "4242"),
                ("João",   .engenheiro,  "5555"),
                ("Visita", .convidado,   "9999"),
            ]
            for (nome, papel, pin) in demo {
                var m = EquipeMembro(timeId: tid, nome: nome, papel: papel)
                m.pinHash = PinSeguranca.hash(pin: pin, salt: m.id)
                m.pinSetEm = DB.nowMs()
                try m.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "equipe_membros", rowId: m.id, op: .insert, record: m)
            }
        }
        carregar()
    }

    private func ensureTime(_ db: Database, _ tid: String) {
        try? db.execute(sql: "INSERT OR IGNORE INTO times (id, nome, created_at, updated_at) VALUES (?,?,?,?)",
                        arguments: [tid, "Equipe Bolinha", DB.nowMs(), DB.nowMs()])
    }
}

// MARK: - Pessoa atual (login por pessoa: o app sabe quem entrou)

/// Quem está usando o app AGORA (Bubi, Flávio, Alan…). Definido no login
/// por PIN da entrada e LEMBRADO entre aberturas (UserDefaults). O app
/// inteiro lê daqui — o checklist não pergunta mais "quem é você".
extension Notification.Name {
    /// Avisa que a pessoa logada mudou (entrou/saiu) — a raiz do app
    /// recarrega e a porta (login) reaparece quando alguém sai.
    static let pessoaAtualMudou = Notification.Name("p1fast.pessoaAtualMudou")
}

@MainActor
final class CurrentPersonStore: ObservableObject {
    static let idKey = "p1fast.pessoaAtualId"
    static let nomeKey = "p1fast.pessoaAtualNome"
    static let papelKey = "p1fast.pessoaAtualPapel"

    @Published private(set) var pessoaId: String?
    @Published private(set) var nome: String?
    @Published private(set) var papelRaw: String?

    init() {
        recarregar()
        // Qualquer tela pode chamar `sairStatic()` (sem precisar desta
        // instância); aqui a raiz fica sabendo e mostra a porta de novo.
        NotificationCenter.default.addObserver(forName: .pessoaAtualMudou, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.recarregar() }
        }
    }

    var papel: PapelPessoa? { papelRaw.flatMap { PapelPessoa(rawValue: $0) } }
    var logada: Bool { pessoaId != nil }

    func recarregar() {
        let d = UserDefaults.standard
        pessoaId = d.string(forKey: Self.idKey)
        nome = d.string(forKey: Self.nomeKey)
        papelRaw = d.string(forKey: Self.papelKey)
    }

    func entrar(_ m: EquipeMembro) {
        let d = UserDefaults.standard
        d.set(m.id, forKey: Self.idKey)
        d.set(m.nome, forKey: Self.nomeKey)
        d.set(m.papel, forKey: Self.papelKey)
        recarregar()
    }

    func sair() { Self.sairStatic() }

    /// Leitura/escrita estáticas (UserDefaults) — qualquer tela usa sem
    /// depender de injeção, então não há risco de quebrar telas de teste.
    static var idSalvo: String? { UserDefaults.standard.string(forKey: idKey) }
    static var nomeSalvo: String? { UserDefaults.standard.string(forKey: nomeKey) }
    static var papelSalvo: PapelPessoa? {
        UserDefaults.standard.string(forKey: papelKey).flatMap { PapelPessoa(rawValue: $0) }
    }
    static func sairStatic() {
        let d = UserDefaults.standard
        d.removeObject(forKey: idKey); d.removeObject(forKey: nomeKey); d.removeObject(forKey: papelKey)
        NotificationCenter.default.post(name: .pessoaAtualMudou, object: nil)
    }
}

// MARK: - Login por pessoa (PORTA do app, após a conta na nuvem)

/// Entrada do app: escolhe o nome → digita o PIN → o app passa a saber
/// quem é. Aparece só quando a equipe tem gente com PIN. Tem saída pro
/// app caso a equipe ainda não use PIN (não trava ninguém).
struct PersonLoginView: View {
    @ObservedObject var equipe: EquipeStore
    var onEntrou: (EquipeMembro) -> Void
    @State private var pinPara: EquipeMembro?
    @State private var pinDigitado = ""
    @State private var pinErro = false

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            if let m = pinPara {
                pinGate(m)
            } else {
                seletor
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { equipe.carregar() }
    }

    private var seletor: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Spacer().frame(height: 30)
                Eyebrow(text: "Equipe Bolinha", tint: .accent)
                Text("Quem está usando?")
                    .font(.system(size: 28, weight: .semibold)).tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Escolha seu nome e digite seu PIN. O app vai lembrar de você.")
                    .font(.system(size: 13)).foregroundStyle(Color.textMuted)

                VStack(spacing: 9) {
                    ForEach(equipe.membros, id: \.id) { m in pessoaRow(m) }
                }
                .padding(.top, 6)
            }
            .padding(Spacing.lg)
        }
    }

    @ViewBuilder
    private func pessoaRow(_ m: EquipeMembro) -> some View {
        let papel = m.papelEnum ?? .convidado
        Button {
            if m.pinHash != nil { pinDigitado = ""; pinErro = false; withAnimation { pinPara = m } }
            else { onEntrou(m) }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.surfaceHover)
                    Text(String(m.nome.prefix(1)).uppercased())
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.nome).font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.text)
                    Text(rotuloPapel(papel)).font(.system(size: 11.5)).foregroundStyle(Color.textFaint)
                }
                Spacer(minLength: 0)
                if m.pinHash != nil {
                    Text("PIN").font(.system(size: 9, weight: .bold)).tracking(0.5).foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .overlay(Capsule().stroke(Color.border, lineWidth: 1))
                }
                Text("›").font(.system(size: 15)).foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, 14).padding(.vertical, 13)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func pinGate(_ m: EquipeMembro) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button { withAnimation { pinPara = nil } } label: {
                    Text("‹ trocar").font(.system(size: 14, weight: .medium)).foregroundStyle(Color.textMuted)
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, Spacing.lg).padding(.top, 12)
            Spacer().frame(height: 24)
            Eyebrow(text: "Confirme que é você", tint: .accent)
            Text("Olá, \(m.nome)")
                .font(.system(size: 28, weight: .semibold)).tracking(-0.6).foregroundStyle(Color.text).padding(.top, 12)
            Text(pinErro ? "PIN errado — tente de novo" : "Digite seu PIN de 4 dígitos")
                .font(.system(size: 13)).foregroundStyle(pinErro ? Color.rec : Color.textMuted).padding(.top, 4)
            HStack(spacing: 14) {
                ForEach(0..<4, id: \.self) { i in
                    Circle().fill(i < pinDigitado.count ? (pinErro ? Color.rec : Color.accent) : Color.clear)
                        .frame(width: 15, height: 15)
                        .overlay(Circle().stroke(pinErro ? Color.rec : Color.border, lineWidth: 1.5))
                }
            }
            .padding(.vertical, 28)
            teclado(m)
            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
    }

    private func teclado(_ m: EquipeMembro) -> some View {
        let linhas: [[String]] = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","apagar"]]
        return VStack(spacing: 12) {
            ForEach(linhas, id: \.self) { linha in
                HStack(spacing: 12) { ForEach(linha, id: \.self) { k in tecla(k, m) } }
            }
        }
        .frame(maxWidth: 280)
    }

    @ViewBuilder
    private func tecla(_ k: String, _ m: EquipeMembro) -> some View {
        if k.isEmpty {
            Color.clear.frame(height: 58).frame(maxWidth: .infinity)
        } else if k == "apagar" {
            Button { pinErro = false; if !pinDigitado.isEmpty { pinDigitado.removeLast() } } label: {
                Text("‹ apagar").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity).frame(height: 58)
            }.buttonStyle(.plain)
        } else {
            Button { digita(k, m) } label: {
                Text(k).font(.system(size: 23, weight: .medium)).foregroundStyle(Color.text)
                    .frame(maxWidth: .infinity).frame(height: 58)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.surfaceRaised))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.border, lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }

    private func digita(_ d: String, _ m: EquipeMembro) {
        guard pinDigitado.count < 4 else { return }
        pinErro = false; pinDigitado += d
        if pinDigitado.count == 4 {
            if let h = m.pinHash, PinSeguranca.confere(pin: pinDigitado, hash: h, salt: m.id) {
                onEntrou(m)
            } else { pinErro = true; pinDigitado = "" }
        }
    }
}

// MARK: - Cadastro da equipe

enum EquipeFormSheet: Identifiable {
    case novo
    case editar(EquipeMembro)
    var id: String {
        switch self {
        case .novo:            return "novo"
        case .editar(let m):   return "e-\(m.id)"
        }
    }
}

struct EquipeCadastroView: View {
    @ObservedObject var store: EquipeStore
    /// `true` = dentro de uma sub-aba da Garagem (sem fundo/eyebrow próprios,
    /// que a Garagem já fornece). `false` = tela cheia (atalho de dev).
    var embutido: Bool = false
    @State private var sheet: EquipeFormSheet?

    var body: some View {
        conteudo
            .onAppear { store.carregar() }
            .sheet(item: $sheet) { which in
                switch which {
                case .novo:
                    EquipeMembroFormView(store: store, membro: nil) { sheet = nil }
                case .editar(let m):
                    EquipeMembroFormView(store: store, membro: m) { sheet = nil }
                }
            }
    }

    @ViewBuilder
    private var conteudo: some View {
        if embutido {
            ScrollView { miolo }
        } else {
            ZStack {
                Color.surface.ignoresSafeArea()
                ScrollView { miolo }
            }
            .preferredColorScheme(.dark)
        }
    }

    private var miolo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            if !embutido { Eyebrow(text: "Equipe") }
            Text("Quem faz parte")
                .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("Cada um com seu papel e seu PIN. O chefe define.")
                .font(.system(size: 13)).foregroundStyle(Color.textMuted)

            VStack(spacing: 10) {
                ForEach(store.membros, id: \.id) { m in
                    Button { sheet = .editar(m) } label: { EquipeMembroRow(membro: m) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.top, Spacing.sm)

            if store.membros.isEmpty {
                Text("Ninguém na equipe ainda. Toque em “Novo membro” pra começar.")
                    .font(.system(size: 13)).foregroundStyle(Color.textFaint)
                    .padding(.vertical, 8)
            }

            Button { sheet = .novo } label: {
                HStack(spacing: 7) {
                    Text("+").font(.system(size: 18, weight: .medium))
                    Text("Novo membro").font(.system(size: 14, weight: .semibold))
                }
                .foregroundStyle(Color.accent)
                .frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.accent.opacity(0.06)))
                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(Color.accent.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [5])))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct EquipeMembroRow: View {
    let membro: EquipeMembro
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.surfaceHover)
                Text(String(membro.nome.prefix(1)).uppercased())
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(membro.nome).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                Text(membro.temPin ? "PIN definido" : "sem PIN")
                    .font(.system(size: 11)).foregroundStyle(membro.temPin ? Color.textFaint : Color.atencao)
            }
            Spacer(minLength: 0)
            if let p = membro.papelEnum {
                Text(rotuloPapel(p).uppercased())
                    .font(.system(size: 9, weight: .bold)).tracking(0.5)
                    .foregroundStyle(p == .chefeEquipe ? Color.ouro : (p == .convidado ? Color.textFaint : Color.accent))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill((p == .chefeEquipe ? Color.ouro : (p == .convidado ? Color.textFaint : Color.accent)).opacity(0.12)))
                    .overlay(Capsule().stroke((p == .chefeEquipe ? Color.ouro : (p == .convidado ? Color.textFaint : Color.accent)).opacity(0.4), lineWidth: 1))
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }
}

struct EquipeMembroFormView: View {
    @ObservedObject var store: EquipeStore
    let membro: EquipeMembro?
    let onClose: () -> Void

    @State private var nome: String = ""
    @State private var papel: PapelPessoa = .mecanico
    @State private var pin: String = ""

    private var ehEdicao: Bool { membro != nil }
    private var podeSalvar: Bool {
        let nomeOk = !nome.trimmingCharacters(in: .whitespaces).isEmpty
        let pinOk = ehEdicao ? (pin.isEmpty || PinSeguranca.pinValido(pin)) : PinSeguranca.pinValido(pin)
        return nomeOk && pinOk
    }

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    HStack {
                        Button("Cancelar", action: onClose)
                            .font(.system(size: 13, weight: .medium)).foregroundStyle(Color.textMuted)
                        Spacer()
                    }
                    Eyebrow(text: ehEdicao ? "Editar membro" : "Novo membro")
                    Text(ehEdicao ? "Editar \(membro?.nome ?? "")" : "Adicionar à equipe")
                        .font(.system(size: 22, weight: .semibold)).tracking(-0.5).foregroundStyle(Color.text)

                    campo(titulo: "Nome") {
                        TextField("Ex: Marcos", text: $nome)
                            .font(.system(size: 15)).foregroundStyle(Color.text)
                    }

                    Text("PAPEL").font(.system(size: 11, weight: .semibold)).tracking(0.9)
                        .foregroundStyle(Color.textMuted)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(papeisEquipe, id: \.self) { p in
                                Button { papel = p } label: {
                                    Text(rotuloPapel(p).uppercased())
                                        .font(.system(size: 11, weight: .semibold)).tracking(0.6)
                                        .foregroundStyle(papel == p ? Color.onAccent : Color.textMuted)
                                        .padding(.horizontal, 13).padding(.vertical, 8)
                                        .background(Capsule().fill(papel == p ? Color.accent : Color.clear))
                                        .overlay(Capsule().stroke(papel == p ? Color.clear : Color.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    campo(titulo: ehEdicao ? "PIN (deixe vazio pra manter)" : "PIN de 4 dígitos") {
                        TextField(ehEdicao ? "••••" : "0000", text: $pin)
                            .keyboardType(.numberPad)
                            .font(.system(size: 15)).foregroundStyle(Color.text)
                            .onChange(of: pin) { novo in
                                pin = String(novo.filter { $0.isNumber }.prefix(4))
                            }
                    }

                    Button {
                        store.salvar(idExistente: membro?.id, nome: nome, papel: papel, pin: pin)
                        onClose()
                    } label: {
                        Text("Salvar").font(.system(size: 15, weight: .semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .foregroundStyle(podeSalvar ? Color.onAccent : Color.textFaint)
                            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .fill(podeSalvar ? Color.accent : Color.surfaceHover))
                    }
                    .buttonStyle(.plain).disabled(!podeSalvar).padding(.top, 4)
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if let m = membro { nome = m.nome; papel = m.papelEnum ?? .mecanico }
        }
    }

    @ViewBuilder
    private func campo<Content: View>(titulo: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(titulo.uppercased()).font(.system(size: 11, weight: .semibold)).tracking(0.9)
                .foregroundStyle(Color.textMuted)
            content()
                .padding(.horizontal, 14).padding(.vertical, 13)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
    }
}

// MARK: - Criar stint (distribuição por papel)

struct CriarStintView: View {
    @ObservedObject var store: EquipeStore

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: "Novo stint")
                    Text("Stint 3 · Bolinha")
                        .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                        .foregroundStyle(Color.text)
                    Text("O checklist é montado automático e cai na lista de cada um.")
                        .font(.system(size: 13)).foregroundStyle(Color.textMuted)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("CHECKLIST DO STINT")
                            .font(.system(size: 11, weight: .semibold)).tracking(0.9)
                            .foregroundStyle(Color.textFaint)
                        Text("17 itens pré-stint · 8 pós-stint")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                        Text("Cada responsável recebe os seus.")
                            .font(.system(size: 12)).foregroundStyle(Color.textMuted)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
                    .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))

                    Text("QUEM RECEBE O QUÊ · PRÉ-STINT")
                        .font(.system(size: 11, weight: .semibold)).tracking(0.9)
                        .foregroundStyle(Color.textMuted).padding(.top, 4)

                    VStack(spacing: 9) {
                        ForEach(store.membros, id: \.id) { m in
                            distRow(m)
                        }
                    }

                    Text("Começar stint")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.accent))
                        .padding(.top, 6)
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { store.carregar() }
    }

    @ViewBuilder
    private func distRow(_ m: EquipeMembro) -> some View {
        let papel = m.papelEnum ?? .convidado
        let qtd = DistribuicaoStint.itensDaPessoa(papel: papel, momento: .pre).count
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.surfaceHover)
                Text(String(m.nome.prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.text)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(m.nome).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                Text(rotuloPapel(papel)).font(.system(size: 11)).foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            Text(qtd == 0 ? "só acompanha" : "\(qtd) \(qtd == 1 ? "item" : "itens")")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(qtd == 0 ? Color.textFaint : Color.accent)
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }
}

// MARK: - Execução do stint por pessoa + finalizar

/// Efeito de "tremer" pra esquerda/direita (botão Finalizar bloqueado).
struct ShakeEffect: GeometryEffect {
    var travel: CGFloat = 9
    var shakes: CGFloat = 3
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(
            translationX: travel * sin(animatableData * .pi * shakes), y: 0))
    }
}

/// Grava/lê as marcações do checklist de um stint no banco (tabela stint_check).
@MainActor
final class StintCheckStore: ObservableObject {
    @Published private(set) var marcados: Set<String> = []
    private let queue: DatabaseQueue
    let stintId: String
    init(queue: DatabaseQueue, stintId: String) { self.queue = queue; self.stintId = stintId }

    private var timeId: String { TeamContext.currentTeamId ?? "00000000-0000-0000-0000-0000000000AA" }

    // Estado "carro voltou pro box" do stint, guardado como marca especial
    // (fora do catálogo, então NÃO conta como item nem como pendência).
    // Quando true, a pendência grande do pré some sozinha (regra do Flávio).
    static let idCarroVoltou = "_carro_voltou"
    var carroVoltou: Bool { marcados.contains(Self.idCarroVoltou) }
    func definirCarroVoltou(_ v: Bool) {
        if v != carroVoltou { alternar(itemId: Self.idCarroVoltou, membroId: nil, papel: nil) }
    }

    func carregar() {
        let ids = (try? queue.read { db in
            try MarcaChecklistStint
                .filter(sql: "stint_id = ? AND feito = 1", arguments: [stintId])
                .fetchAll(db).map { $0.itemId }
        }) ?? []
        marcados = Set(ids)
    }

    func alternar(itemId: String, membroId: String?, papel: PapelPessoa?) {
        let novo = !marcados.contains(itemId)
        let tid = timeId
        try? queue.write { db in
            try db.execute(sql: "INSERT OR IGNORE INTO times (id, nome, created_at, updated_at) VALUES (?,?,?,?)",
                           arguments: [tid, "Equipe Bolinha", DB.nowMs(), DB.nowMs()])
            if var m = try MarcaChecklistStint
                .filter(sql: "stint_id = ? AND item_id = ?", arguments: [stintId, itemId]).fetchOne(db) {
                m.feito = novo
                m.feitoPor = novo ? membroId : nil
                m.feitoPapel = novo ? papel?.rawValue : nil
                m.feitoEm = novo ? DB.nowMs() : nil
                m.updatedAt = DB.nowMs()
                try m.update(db)
                // Fase 1 multi-aparelho: o checklist do stint passa a subir pra nuvem.
                try SyncQueue.enqueueRecord(db, tableName: "stint_check", rowId: m.id, op: .update, record: m)
            } else {
                let m = MarcaChecklistStint(timeId: tid, stintId: stintId, itemId: itemId, feito: novo,
                                            feitoPor: novo ? membroId : nil, feitoPapel: novo ? papel?.rawValue : nil,
                                            feitoEm: novo ? DB.nowMs() : nil)
                try m.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "stint_check", rowId: m.id, op: .insert, record: m)
            }
        }
        carregar()
    }

    /// Demo (só telas dev): marca alguns itens se ainda não houver marca nenhuma.
    func seedDemoSeVazio(itemIds: [String], papel: PapelPessoa) {
        carregar()
        guard marcados.isEmpty else { return }
        for id in itemIds { alternar(itemId: id, membroId: nil, papel: papel) }
    }
}

struct ExecucaoStintView: View {
    @ObservedObject var store: StintCheckStore
    var nome: String = "Bubi"
    var papel: PapelPessoa = .piloto
    /// Quem está marcando (gravado em feitoPor). nil = anônimo (telas dev).
    var membroId: String? = nil
    /// Rótulo do stint mostrado no cabeçalho (ex.: "Stint 3").
    var stintLabel: String = "Stint"
    /// true só nos atalhos de teste (marca alguns itens de exemplo). No app
    /// real (execução de verdade) fica false: começa com o que está no banco.
    var semearDemo: Bool = true

    @State private var momento: MomentoStint = .pre
    @State private var shakeCount: CGFloat = 0
    @State private var finalizadoPre = false
    @State private var finalizadoPos = false

    private var itens: [ItemChecklistStint] {
        DistribuicaoStint.itensDaPessoa(papel: papel, momento: momento)
    }
    private var finalizado: Bool { momento == .pre ? finalizadoPre : finalizadoPos }
    private var obrig: [ItemChecklistStint] { itens.filter { $0.obrigatorio } }
    private var desej: [ItemChecklistStint] { itens.filter { !$0.obrigatorio } }
    private var obrigPendentes: Int { obrig.filter { !store.marcados.contains($0.id) }.count }

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: "Sua vez no box", tint: .rec)
                    Text("Seu checklist · \(nome)")
                        .font(.system(size: 23, weight: .semibold)).tracking(-0.5)
                        .foregroundStyle(Color.text)
                    Text("\(rotuloPapel(papel)) · \(stintLabel) — marque conforme faz no box.")
                        .font(.system(size: 12.5)).foregroundStyle(Color.textMuted)

                    seletorMomento

                    banner

                    grupo("Obrigatórios", obrig)
                    if !desej.isEmpty { grupo("Desejáveis", desej) }

                    Text(finalizado ? "Finalizado" : "Finalizar \(momento.rotulo.lowercased())")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .foregroundStyle(finalizavel ? Color.onAccent : Color.textFaint)
                        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(finalizado ? Color.bom : (finalizavel ? Color.accent : Color.surfaceRaised)))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(finalizavel ? Color.clear : Color.rec.opacity(0.45), lineWidth: 1))
                        .modifier(ShakeEffect(animatableData: shakeCount))
                        .padding(.top, 6)
                        .onTapGesture { tentarFinalizar() }

                    if obrigPendentes > 0 {
                        Text("Tem obrigatório faltando — ao tocar, o botão treme e não finaliza.")
                            .font(.system(size: 11)).foregroundStyle(Color.rec)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            store.carregar()
            if semearDemo {
                // Exemplo (só atalho de teste): marca alguns obrigatórios do pré.
                let obrigPre = DistribuicaoStint.itensDaPessoa(papel: papel, momento: .pre).filter { $0.obrigatorio }
                store.seedDemoSeVazio(itemIds: Array(obrigPre.dropLast(2).map { $0.id }), papel: papel)
            }
        }
    }

    private var finalizavel: Bool { obrigPendentes == 0 }

    private var seletorMomento: some View {
        HStack(spacing: 8) {
            momentoBtn(.pre)
            momentoBtn(.pos)
        }
    }

    @ViewBuilder
    private func momentoBtn(_ m: MomentoStint) -> some View {
        let on = momento == m
        Button { withAnimation(.easeInOut(duration: 0.15)) { momento = m } } label: {
            Text(m.rotulo)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(on ? Color.onAccent : Color.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(on ? Color.accent : Color.surfaceRaised))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(on ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var banner: some View {
        let texto: String = finalizado ? "Checklist finalizado"
            : (obrigPendentes > 0 ? "Faltam \(obrigPendentes) obrigatório(s)" : "Obrigatórios completos")
        let cor: Color = (obrigPendentes > 0 && !finalizado) ? Color.rec : Color.bom
        Text(texto)
            .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(cor)
            .padding(.horizontal, 13).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(cor.opacity(0.12)))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(cor.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private func grupo(_ titulo: String, _ lista: [ItemChecklistStint]) -> some View {
        if !lista.isEmpty {
            HStack(spacing: 9) {
                Text(titulo.uppercased()).font(.system(size: 9, weight: .bold)).tracking(1.0).foregroundStyle(Color.textFaint)
                Rectangle().fill(Color.border).frame(height: 1)
            }
            .padding(.top, 4)
            VStack(spacing: 7) {
                ForEach(lista) { item in linha(item) }
            }
        }
    }

    @ViewBuilder
    private func linha(_ item: ItemChecklistStint) -> some View {
        let feito = store.marcados.contains(item.id)
        Button { toggle(item.id) } label: {
            HStack(spacing: 11) {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(feito ? Color.bom : Color.clear)
                    .frame(width: 22, height: 22)
                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(feito ? Color.bom : Color.border, lineWidth: 1.5))
                Text(item.nome)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(feito ? Color.textFaint : Color.text)
                    .strikethrough(feito, color: Color.textFaint)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(item.obrigatorio ? "OBRIG." : "DESEJ.")
                    .font(.system(size: 8.5, weight: .bold)).tracking(0.4)
                    .foregroundStyle(item.obrigatorio ? Color.rec : Color.ouro)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Capsule().fill((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.12)))
                    .overlay(Capsule().stroke((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.4), lineWidth: 1))
            }
            .padding(.horizontal, 13).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func toggle(_ id: String) {
        store.alternar(itemId: id, membroId: membroId, papel: papel)
    }
    private func tentarFinalizar() {
        guard !finalizado else { return }
        if obrigPendentes > 0 {
            withAnimation(.linear(duration: 0.5)) { shakeCount += 1 }
        } else {
            if momento == .pre { finalizadoPre = true } else { finalizadoPos = true }
        }
    }
}

// MARK: - Execução do checklist do stint NO APP REAL (escolhe a pessoa → seus itens)

/// Liga o checklist do stint à navegação real: cria o StintCheckStore com a
/// fila REAL e a âncora = id do stint real; mostra "Quem é você?" com a
/// equipe REAL cadastrada na Garagem e, ao escolher, abre os itens daquela
/// pessoa (papel) gravando de verdade em `stint_check`. Sem semear demo.
struct ExecucaoStintRealView: View {
    @StateObject private var store: StintCheckStore
    @StateObject private var equipe: EquipeStore
    private let stintLabel: String
    /// Só-dev (screenshot): entra direto na 1ª pessoa, sem precisar tocar.
    private let devAutoPickFirst: Bool
    @State private var membro: EquipeMembro?
    /// A pessoa já passou da "pendência grande" (1ª tela) pros itens.
    @State private var entrouNoChecklist = false
    /// Visão do chefe: quem ainda tem obrigatório pendente neste stint.
    @State private var verVisaoChefe = false
    /// Pessoa que tocou no nome e precisa confirmar o PIN antes de abrir.
    @State private var pinPara: EquipeMembro?
    @State private var pinDigitado = ""
    @State private var pinErro = false
    /// A pessoa veio do login do app (não escolheu aqui) — esconde o seletor/"trocar".
    @State private var veioDoLogin = false

    private let devCarroVoltou: Bool
    private let devPinGate: Bool

    init(queue: DatabaseQueue, stintId: String, stintLabel: String,
         devAutoPickFirst: Bool = false, devVisaoChefe: Bool = false, devCarroVoltou: Bool = false,
         devPinGate: Bool = false) {
        _store = StateObject(wrappedValue: StintCheckStore(queue: queue, stintId: stintId))
        _equipe = StateObject(wrappedValue: EquipeStore(queue: queue))
        self.stintLabel = stintLabel
        self.devAutoPickFirst = devAutoPickFirst
        self.devCarroVoltou = devCarroVoltou
        self.devPinGate = devPinGate
        _verVisaoChefe = State(initialValue: devVisaoChefe)
    }

    var body: some View {
        Group {
            if verVisaoChefe {
                visaoChefe
            } else if let p = pinPara {
                pinGate(p)
            } else if let m = membro {
                if obrigPrePendentes(m) > 0 && !entrouNoChecklist && !store.carroVoltou {
                    // 1ª tela da pessoa: pendência grande (some quando ela faz
                    // os obrigatórios — ou quando o carro volta pro box).
                    pendenciaGrande(m)
                } else {
                    VStack(spacing: 0) {
                        pessoaBar(m)
                        ExecucaoStintView(store: store,
                                          nome: m.nome,
                                          papel: m.papelEnum ?? .convidado,
                                          membroId: m.id,
                                          stintLabel: stintLabel,
                                          semearDemo: false)
                    }
                }
            } else {
                seletorPessoa
            }
        }
        .onAppear {
            equipe.carregar(); store.carregar()
            if devCarroVoltou { store.definirCarroVoltou(true) }
            // Login por pessoa: se já tem alguém logado no app, vai DIRETO
            // pros itens dela — sem perguntar "quem é você".
            if membro == nil, let pid = CurrentPersonStore.idSalvo,
               let m = equipe.membros.first(where: { $0.id == pid }) {
                membro = m; veioDoLogin = true
            } else if devPinGate, pinPara == nil {
                pinPara = equipe.membros.first { $0.pinHash != nil && ($0.papelEnum ?? .convidado) != .convidado }
            } else if devAutoPickFirst, membro == nil {
                membro = equipe.membros.first { ($0.papelEnum ?? .convidado) != .convidado }
            }
        }
    }

    /// Obrigatórios do PRÉ que a pessoa ainda não marcou (gera a pendência grande + vibra).
    private func obrigPrePendentes(_ m: EquipeMembro) -> Int {
        let papel = m.papelEnum ?? .convidado
        return DistribuicaoStint.itensDaPessoa(papel: papel, momento: .pre)
            .filter { $0.obrigatorio && !store.marcados.contains($0.id) }.count
    }

    /// Vibra ao menos 2× (motor de vibração real — só no aparelho; no simulador não vibra).
    private func vibrarDuasVezes() {
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
    }

    // 1ª tela da pessoa enquanto há obrigatório pendente (desenho aprovado:
    // onda2-checklist-EXECUCAO-FINALIZAR.html, painel C + vibra do painel D).
    private func pendenciaGrande(_ m: EquipeMembro) -> some View {
        let pend = obrigPrePendentes(m)
        return ZStack {
            Color.surface.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("\(m.nome) · \(rotuloPapel(m.papelEnum ?? .convidado))")
                        .font(.system(size: 12, weight: .semibold)).tracking(0.5)
                        .foregroundStyle(Color.textFaint)
                    Spacer(minLength: 0)
                    Button { withAnimation { membro = nil; entrouNoChecklist = false } } label: {
                        Text("trocar").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.accent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 8)

                VStack(alignment: .leading, spacing: 0) {
                    Text("\(pend)")
                        .font(.system(size: 42, weight: .bold)).monospacedDigit()
                        .foregroundStyle(Color.rec)
                    Text(pend == 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                        .padding(.top, 8)
                    Text("\(stintLabel) · Bolinha. Você precisa conferir antes do carro sair.")
                        .font(.system(size: 12)).foregroundStyle(Color.textMuted)
                        .padding(.top, 6).fixedSize(horizontal: false, vertical: true)
                    Button { withAnimation { entrouNoChecklist = true } } label: {
                        Text("Ver e fazer agora")
                            .font(.system(size: 13.5, weight: .bold)).foregroundStyle(Color.onAccent)
                            .padding(.horizontal, 16).padding(.vertical, 11)
                            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Color.rec))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 14)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.rec.opacity(0.14)))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.rec.opacity(0.45), lineWidth: 1))
                .padding(.top, 14)

                Text("Esse aviso não sai da primeira tela até você fazer os obrigatórios — ou até o carro voltar pro box (aí some sozinho). Desejável não gera esse aviso.")
                    .font(.system(size: 11)).foregroundStyle(Color.textFaint)
                    .lineSpacing(2).padding(.top, 13).fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.lg)
        }
        .preferredColorScheme(.dark)
        .onAppear { vibrarDuasVezes() }
    }

    private func pessoaBar(_ m: EquipeMembro) -> some View {
        HStack(spacing: 10) {
            Text("Você: \(m.nome)")
                .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Color.text)
            Text(rotuloPapel(m.papelEnum ?? .convidado))
                .font(.system(size: 11)).foregroundStyle(Color.textFaint)
            Spacer(minLength: 0)
            // Só mostra "trocar" quando NÃO veio do login do app (caso dev/sem
            // login). Logado, a troca de pessoa é na Conta da Garagem.
            if !veioDoLogin {
                Button { withAnimation { membro = nil; entrouNoChecklist = false } } label: {
                    Text("trocar").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.accent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Spacing.lg).padding(.vertical, 10)
        .background(Color.surfaceRaised)
        .overlay(Rectangle().fill(Color.border).frame(height: 1), alignment: .bottom)
    }

    private var seletorPessoa: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: stintLabel, tint: .rec)
                    Text("Quem é você?")
                        .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                        .foregroundStyle(Color.text)
                    Text("Escolha seu nome pra ver e marcar os seus itens deste stint.")
                        .font(.system(size: 13)).foregroundStyle(Color.textMuted)

                    if equipe.membros.isEmpty {
                        Text("Nenhuma pessoa na equipe ainda. Cadastre a equipe na Garagem.")
                            .font(.system(size: 13)).foregroundStyle(Color.textFaint)
                            .padding(.top, 8)
                    } else {
                        VStack(spacing: 9) {
                            ForEach(equipe.membros, id: \.id) { m in
                                pessoaRow(m)
                            }
                        }
                        .padding(.top, 4)

                        Button { store.carregar(); withAnimation { verVisaoChefe = true } } label: {
                            HStack(spacing: 8) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Visão do chefe")
                                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.text)
                                    Text("quem ainda tem obrigatório pendente")
                                        .font(.system(size: 11)).foregroundStyle(Color.textFaint)
                                }
                                Spacer(minLength: 0)
                                Text("ver ›").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.accent)
                            }
                            .padding(.horizontal, 13).padding(.vertical, 11)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceHover))
                            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 6)
                    }
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
    }

    // Visão do chefe: as pendências do stint = obrigatórios não feitos (pré),
    // com o responsável de cada um. Desejável NUNCA entra (contrato Flávio).
    private var visaoChefe: some View {
        let pend = DistribuicaoStint.pendenciasObrigatorias(momento: .pre, marcados: store.marcados)
        return ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Button { withAnimation { verVisaoChefe = false } } label: {
                        Text("‹ voltar").font(.system(size: 14, weight: .medium)).foregroundStyle(Color.textMuted)
                    }
                    .buttonStyle(.plain)

                    Eyebrow(text: "Visão do chefe", tint: pend.isEmpty ? .accent : .rec)
                    Text("Pendências · \(stintLabel)")
                        .font(.system(size: 24, weight: .semibold)).tracking(-0.6)
                        .foregroundStyle(Color.text)

                    carroControle

                    if pend.isEmpty {
                        HStack(spacing: 9) {
                            Text("Tudo certo — nenhum obrigatório pendente antes de rodar.")
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.bom)
                        }
                        .padding(13).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Color.bom.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(Color.bom.opacity(0.4), lineWidth: 1))
                    } else {
                        Text("\(pend.count) obrigatório\(pend.count == 1 ? "" : "s") faltando antes do carro sair")
                            .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Color.rec)
                            .padding(.horizontal, 13).padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Color.rec.opacity(0.12)))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(Color.rec.opacity(0.4), lineWidth: 1))

                        VStack(spacing: 7) {
                            ForEach(pend) { item in chefeItemRow(item) }
                        }
                    }
                    Text("Só obrigatório vira pendência. Desejável não aparece aqui nem no Command Box.")
                        .font(.system(size: 11)).foregroundStyle(Color.textFaint).padding(.top, 2)
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
    }

    // Controle manual do chefe: "carro voltou pro box". Quando liga, a
    // pendência grande do pré some sozinha (regra do Flávio). Hoje é manual;
    // depois dá pra automatizar pela telemetria (carro andando/parado).
    private var carroControle: some View {
        let voltou = store.carroVoltou
        return HStack(spacing: 11) {
            VStack(alignment: .leading, spacing: 2) {
                Text(voltou ? "Carro voltou pro box" : "Carro no box · antes de rodar")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(voltou ? Color.bom : Color.text)
                Text(voltou ? "O aviso grande do pré não trava mais." : "Quando o carro voltar, o aviso grande some sozinho.")
                    .font(.system(size: 11)).foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            Button { store.definirCarroVoltou(!voltou) } label: {
                Text(voltou ? "Desfazer" : "Carro voltou")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(voltou ? Color.textMuted : Color.onAccent)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(Capsule().fill(voltou ? Color.surfaceHover : Color.accent))
                    .overlay(Capsule().stroke(voltou ? Color.border : Color.clear, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(voltou ? Color.bom.opacity(0.4) : Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func chefeItemRow(_ item: ItemChecklistStint) -> some View {
        let resp = item.faz.filter { $0 != .convidado }.map { rotuloPapel($0) }.joined(separator: ", ")
        HStack(alignment: .top, spacing: 11) {
            Circle().fill(Color.rec).frame(width: 8, height: 8).padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.nome)
                    .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Responsável: \(resp.isEmpty ? "—" : resp)")
                    .font(.system(size: 11)).foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            Text("OBRIG.")
                .font(.system(size: 8.5, weight: .bold)).tracking(0.4).foregroundStyle(Color.rec)
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Capsule().fill(Color.rec.opacity(0.12)))
                .overlay(Capsule().stroke(Color.rec.opacity(0.4), lineWidth: 1))
        }
        .padding(.horizontal, 13).padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func pessoaRow(_ m: EquipeMembro) -> some View {
        let papel = m.papelEnum ?? .convidado
        let qtdPre = DistribuicaoStint.itensDaPessoa(papel: papel, momento: .pre).count
        let temPin = m.pinHash != nil
        return Button { abrirPessoa(m) } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.surfaceHover)
                    Text(String(m.nome.prefix(1)).uppercased())
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.text)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.nome).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.text)
                    HStack(spacing: 6) {
                        Text(rotuloPapel(papel)).font(.system(size: 11)).foregroundStyle(Color.textFaint)
                        if temPin {
                            Text("PIN").font(.system(size: 8.5, weight: .bold)).tracking(0.5)
                                .foregroundStyle(Color.textFaint)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .overlay(Capsule().stroke(Color.border, lineWidth: 1))
                        }
                    }
                }
                Spacer(minLength: 0)
                Text(qtdPre == 0 ? "só acompanha" : "\(qtdPre) \(qtdPre == 1 ? "item" : "itens")")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(qtdPre == 0 ? Color.textFaint : Color.accent)
                Text("›").font(.system(size: 14)).foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func abrirPessoa(_ m: EquipeMembro) {
        if m.pinHash != nil {
            pinDigitado = ""; pinErro = false
            withAnimation { pinPara = m }
        } else {
            withAnimation { membro = m }
        }
    }

    // Confirmação por PIN da pessoa que tocou no nome (só se ela tem PIN).
    // Aditivo: sem PIN, abre direto. Não toca na porta do app (tela inicial).
    private func pinGate(_ m: EquipeMembro) -> some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Button { withAnimation { pinPara = nil } } label: {
                        Text("‹ voltar").font(.system(size: 14, weight: .medium)).foregroundStyle(Color.textMuted)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                Spacer().frame(height: 30)
                Eyebrow(text: "Confirme que é você", tint: .accent)
                Text("Olá, \(m.nome)")
                    .font(.system(size: 26, weight: .semibold)).tracking(-0.6)
                    .foregroundStyle(Color.text).padding(.top, 12)
                Text(pinErro ? "PIN errado — tente de novo" : "Digite seu PIN de 4 dígitos")
                    .font(.system(size: 13)).foregroundStyle(pinErro ? Color.rec : Color.textMuted).padding(.top, 4)

                HStack(spacing: 14) {
                    ForEach(0..<4, id: \.self) { i in
                        Circle()
                            .fill(i < pinDigitado.count ? (pinErro ? Color.rec : Color.accent) : Color.clear)
                            .frame(width: 15, height: 15)
                            .overlay(Circle().stroke(pinErro ? Color.rec : Color.border, lineWidth: 1.5))
                    }
                }
                .padding(.vertical, 26)

                pinTeclado(m)
                Spacer()
            }
            .padding(.horizontal, Spacing.lg)
        }
        .preferredColorScheme(.dark)
    }

    private func pinTeclado(_ m: EquipeMembro) -> some View {
        let linhas: [[String]] = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","apagar"]]
        return VStack(spacing: 12) {
            ForEach(linhas, id: \.self) { linha in
                HStack(spacing: 12) {
                    ForEach(linha, id: \.self) { k in pinTecla(k, m) }
                }
            }
        }
        .frame(maxWidth: 280)
    }

    @ViewBuilder
    private func pinTecla(_ k: String, _ m: EquipeMembro) -> some View {
        if k.isEmpty {
            Color.clear.frame(height: 58).frame(maxWidth: .infinity)
        } else if k == "apagar" {
            Button { pinErro = false; if !pinDigitado.isEmpty { pinDigitado.removeLast() } } label: {
                Text("‹ apagar").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity).frame(height: 58)
            }.buttonStyle(.plain)
        } else {
            Button { pinDigita(k, m) } label: {
                Text(k).font(.system(size: 23, weight: .medium)).foregroundStyle(Color.text)
                    .frame(maxWidth: .infinity).frame(height: 58)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.surfaceRaised))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.border, lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }

    private func pinDigita(_ d: String, _ m: EquipeMembro) {
        guard pinDigitado.count < 4 else { return }
        pinErro = false
        pinDigitado += d
        if pinDigitado.count == 4 {
            if let h = m.pinHash, PinSeguranca.confere(pin: pinDigitado, hash: h, salt: m.id) {
                withAnimation { membro = m; pinPara = nil }
            } else {
                pinErro = true; pinDigitado = ""
            }
        }
    }
}

// MARK: - Login por PIN

struct PINLoginView: View {
    @ObservedObject var store: EquipeStore
    /// Aditivo: quando presente, é chamado com o membro identificado pelo PIN
    /// (usado pelo checklist do stint pra abrir os itens da pessoa). Padrão
    /// nil = comportamento antigo (só mostra "Olá, X").
    var onEntrou: ((EquipeMembro) -> Void)? = nil
    @State private var pin: String = ""
    @State private var erro: Bool = false
    @State private var entrouNome: String?

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer().frame(height: 54)
                Eyebrow(text: "Equipe Bolinha")
                Text(entrouNome == nil ? "Quem é você?" : "Olá, \(entrouNome!)")
                    .font(.system(size: 28, weight: .semibold)).tracking(-0.6)
                    .foregroundStyle(Color.text).padding(.top, 14)
                Text(entrouNome == nil ? "Digite seu PIN de 4 dígitos pra entrar" : "Entrou como \(papelDoEntrou)")
                    .font(.system(size: 13)).foregroundStyle(Color.textMuted).padding(.top, 4)

                HStack(spacing: 14) {
                    ForEach(0..<4, id: \.self) { i in
                        Circle()
                            .fill(i < pin.count ? (erro ? Color.rec : Color.accent) : Color.clear)
                            .frame(width: 15, height: 15)
                            .overlay(Circle().stroke(erro ? Color.rec : Color.border, lineWidth: 1.5))
                    }
                }
                .padding(.vertical, 28)

                if erro {
                    Text("PIN não encontrado").font(.system(size: 12)).foregroundStyle(Color.rec)
                        .padding(.bottom, 8)
                }

                teclado
                Spacer()
                Text("Esqueceu? O chefe redefine no cadastro da equipe.")
                    .font(.system(size: 12)).foregroundStyle(Color.textFaint).padding(.bottom, 24)
            }
            .padding(.horizontal, Spacing.lg)
        }
        .preferredColorScheme(.dark)
        .onAppear { store.carregar() }
    }

    private var papelDoEntrou: String {
        guard let nome = entrouNome, let m = store.membros.first(where: { $0.nome == nome }),
              let p = m.papelEnum else { return "" }
        return rotuloPapel(p)
    }

    private var teclado: some View {
        let linhas: [[String]] = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","apagar"]]
        return VStack(spacing: 12) {
            ForEach(linhas, id: \.self) { linha in
                HStack(spacing: 12) {
                    ForEach(linha, id: \.self) { k in tecla(k) }
                }
            }
        }
        .frame(maxWidth: 280)
    }

    @ViewBuilder
    private func tecla(_ k: String) -> some View {
        if k.isEmpty {
            Color.clear.frame(height: 58).frame(maxWidth: .infinity)
        } else if k == "apagar" {
            Button { apagar() } label: {
                Text("‹ apagar").font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity).frame(height: 58)
            }.buttonStyle(.plain)
        } else {
            Button { digitar(k) } label: {
                Text(k).font(.system(size: 23, weight: .medium)).foregroundStyle(Color.text)
                    .frame(maxWidth: .infinity).frame(height: 58)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.surfaceRaised))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.border, lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }

    private func digitar(_ d: String) {
        guard entrouNome == nil, pin.count < 4 else { return }
        erro = false
        pin += d
        if pin.count == 4 { validar() }
    }
    private func apagar() {
        erro = false
        if !pin.isEmpty { pin.removeLast() }
    }
    private func validar() {
        if let m = store.entrarComPin(pin) {
            entrouNome = m.nome
            if let onEntrou { onEntrou(m) }
        } else {
            erro = true
            pin = ""
        }
    }
}

// MARK: - Checklist do DIA do evento (execução por pessoa + finalizar)

/// Grava/lê as marcações do checklist do DIA no banco (tabela dia_check).
/// Âncora = evento + dia. Irmão do StintCheckStore.
@MainActor
final class DiaCheckStore: ObservableObject, Identifiable {
    @Published private(set) var marcados: Set<String> = []
    private let queue: DatabaseQueue
    let eventoId: String
    let dia: String
    nonisolated var id: String { eventoId + "|" + dia }
    init(queue: DatabaseQueue, eventoId: String, dia: String) {
        self.queue = queue; self.eventoId = eventoId; self.dia = dia
    }

    private var timeId: String { TeamContext.currentTeamId ?? "00000000-0000-0000-0000-0000000000AA" }

    func carregar() {
        let ids = (try? queue.read { db in
            try MarcaChecklistDia
                .filter(sql: "evento_id = ? AND dia = ? AND feito = 1", arguments: [eventoId, dia])
                .fetchAll(db).map { $0.itemId }
        }) ?? []
        marcados = Set(ids)
    }

    func alternar(itemId: String, membroId: String?, papel: PapelPessoa?) {
        let novo = !marcados.contains(itemId)
        let tid = timeId
        try? queue.write { db in
            try db.execute(sql: "INSERT OR IGNORE INTO times (id, nome, created_at, updated_at) VALUES (?,?,?,?)",
                           arguments: [tid, "Equipe Bolinha", DB.nowMs(), DB.nowMs()])
            if var m = try MarcaChecklistDia
                .filter(sql: "evento_id = ? AND dia = ? AND item_id = ?", arguments: [eventoId, dia, itemId]).fetchOne(db) {
                m.feito = novo
                m.feitoPor = novo ? membroId : nil
                m.feitoPapel = novo ? papel?.rawValue : nil
                m.feitoEm = novo ? DB.nowMs() : nil
                m.updatedAt = DB.nowMs()
                try m.update(db)
                // Fase 1 multi-aparelho: o checklist do dia passa a subir pra nuvem.
                try SyncQueue.enqueueRecord(db, tableName: "dia_check", rowId: m.id, op: .update, record: m)
            } else {
                let m = MarcaChecklistDia(timeId: tid, eventoId: eventoId, dia: dia, itemId: itemId, feito: novo,
                                          feitoPor: novo ? membroId : nil, feitoPapel: novo ? papel?.rawValue : nil,
                                          feitoEm: novo ? DB.nowMs() : nil)
                try m.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "dia_check", rowId: m.id, op: .insert, record: m)
            }
        }
        carregar()
    }

    /// Demo (só telas dev): marca alguns itens se ainda não houver marca nenhuma.
    func seedDemoSeVazio(itemIds: [String], papel: PapelPessoa) {
        carregar()
        guard marcados.isEmpty else { return }
        for id in itemIds { alternar(itemId: id, membroId: nil, papel: papel) }
    }
}

struct ExecucaoDiaView: View {
    @ObservedObject var store: DiaCheckStore
    var nome: String = "Bubi"
    var papel: PapelPessoa = .chefeEquipe
    /// true só nos atalhos de teste (marca alguns itens de exemplo). No app
    /// real (execução de verdade) fica false: começa com o que está no banco.
    var semearDemo: Bool = true

    @State private var momento: MomentoDia = .inicio
    @State private var shakeCount: CGFloat = 0
    @State private var finalizadoInicio = false
    @State private var finalizadoFim = false

    private var itens: [ItemChecklistDia] {
        DistribuicaoDia.itensDaPessoa(papel: papel, momento: momento)
    }
    private var obrig: [ItemChecklistDia] { itens.filter { $0.obrigatorio } }
    private var desej: [ItemChecklistDia] { itens.filter { !$0.obrigatorio } }
    private var obrigPendentes: Int { obrig.filter { !store.marcados.contains($0.id) }.count }
    private var finalizado: Bool { momento == .inicio ? finalizadoInicio : finalizadoFim }

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: "Checklist do dia", tint: .accent)
                    Text("Dia do evento · \(nome)")
                        .font(.system(size: 23, weight: .semibold)).tracking(-0.5)
                        .foregroundStyle(Color.text)
                    Text("\(rotuloPapel(papel)) · uma vez por dia — marque conforme faz no box.")
                        .font(.system(size: 12.5)).foregroundStyle(Color.textMuted)

                    seletorMomento

                    banner

                    grupo("Obrigatórios", obrig)
                    if !desej.isEmpty { grupo("Desejáveis", desej) }

                    Text(finalizado ? "Finalizado" : "Finalizar \(momento.rotulo.lowercased())")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .foregroundStyle(finalizavel ? Color.onAccent : Color.textFaint)
                        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(finalizado ? Color.bom : (finalizavel ? Color.accent : Color.surfaceRaised)))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(finalizavel ? Color.clear : Color.rec.opacity(0.45), lineWidth: 1))
                        .modifier(ShakeEffect(animatableData: shakeCount))
                        .padding(.top, 6)
                        .onTapGesture { tentarFinalizar() }

                    if obrigPendentes > 0 {
                        Text("Tem obrigatório faltando — ao tocar, o botão treme e não finaliza.")
                            .font(.system(size: 11)).foregroundStyle(Color.rec)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            store.carregar()
            // Exemplo: marca os primeiros obrigatórios do início (2 ficam faltando).
            let obrigInicio = DistribuicaoDia.itensDaPessoa(papel: papel, momento: .inicio).filter { $0.obrigatorio }
            if semearDemo {
                store.seedDemoSeVazio(itemIds: Array(obrigInicio.dropLast(2).map { $0.id }), papel: papel)
            }
        }
    }

    private var finalizavel: Bool { obrigPendentes == 0 }

    private var seletorMomento: some View {
        HStack(spacing: 8) {
            momentoBtn(.inicio)
            momentoBtn(.fim)
        }
    }

    @ViewBuilder
    private func momentoBtn(_ m: MomentoDia) -> some View {
        let on = momento == m
        Button { withAnimation(.easeInOut(duration: 0.15)) { momento = m } } label: {
            Text(m.rotulo)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(on ? Color.onAccent : Color.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(on ? Color.accent : Color.surfaceRaised))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(on ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var banner: some View {
        let texto: String = finalizado ? "\(momento.rotulo) finalizado"
            : (obrigPendentes > 0 ? "Faltam \(obrigPendentes) obrigatório(s)" : "Obrigatórios completos")
        let cor: Color = (obrigPendentes > 0 && !finalizado) ? Color.rec : Color.bom
        Text(texto)
            .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(cor)
            .padding(.horizontal, 13).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(cor.opacity(0.12)))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(cor.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private func grupo(_ titulo: String, _ lista: [ItemChecklistDia]) -> some View {
        if !lista.isEmpty {
            HStack(spacing: 9) {
                Text(titulo.uppercased()).font(.system(size: 9, weight: .bold)).tracking(1.0).foregroundStyle(Color.textFaint)
                Rectangle().fill(Color.border).frame(height: 1)
            }
            .padding(.top, 4)
            VStack(spacing: 7) {
                ForEach(lista) { item in linha(item) }
            }
        }
    }

    @ViewBuilder
    private func linha(_ item: ItemChecklistDia) -> some View {
        let feito = store.marcados.contains(item.id)
        Button { toggle(item.id) } label: {
            HStack(spacing: 11) {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(feito ? Color.bom : Color.clear)
                    .frame(width: 22, height: 22)
                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(feito ? Color.bom : Color.border, lineWidth: 1.5))
                Text(item.nome)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(feito ? Color.textFaint : Color.text)
                    .strikethrough(feito, color: Color.textFaint)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(item.obrigatorio ? "OBRIG." : "DESEJ.")
                    .font(.system(size: 8.5, weight: .bold)).tracking(0.4)
                    .foregroundStyle(item.obrigatorio ? Color.rec : Color.ouro)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Capsule().fill((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.12)))
                    .overlay(Capsule().stroke((item.obrigatorio ? Color.rec : Color.ouro).opacity(0.4), lineWidth: 1))
            }
            .padding(.horizontal, 13).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func toggle(_ id: String) {
        store.alternar(itemId: id, membroId: nil, papel: papel)
    }
    private func tentarFinalizar() {
        guard !finalizado else { return }
        if obrigPendentes > 0 {
            withAnimation(.linear(duration: 0.5)) { shakeCount += 1 }
        } else {
            if momento == .inicio { finalizadoInicio = true } else { finalizadoFim = true }
        }
    }
}
