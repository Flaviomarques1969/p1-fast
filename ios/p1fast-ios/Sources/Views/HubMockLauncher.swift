// ═══════════════════════════════════════════════════════════
// HubMockLauncher — atalho SÓ-DEV pra validar o CarroHubView
// ═══════════════════════════════════════════════════════════
// Ativado pelo launch arg `--p1-hub-mock`. Abre o hub do carro num
// banco em memória, com um carro amarelo "Bolinha" e uma foto LARGA
// de teste (pra reproduzir o cenário real da foto de fundo no
// simulador, sem precisar de login). Não afeta o app normal.

import SwiftUI
import UIKit
import P1FastCore

struct HubMockLauncher: View {
    @StateObject private var carroRepo: CarroRepository
    @StateObject private var manutencaoStore: ManutencaoConsumiveisStore
    @StateObject private var pecaRepo: PecaRepository
    @StateObject private var pneuRepo: PneuRepository

    @State private var carroId: String?
    @State private var ready = false

    init() {
        // Sem login não há equipe; o create de carro exige uma. Finge uma.
        UserDefaults.standard.set("00000000-0000-0000-0000-0000000000AA",
                                  forKey: TeamContext.storageKey)
        let queue = try! DB.makeMemoryQueue()
        _carroRepo = StateObject(wrappedValue: CarroRepository(queue: queue))
        _manutencaoStore = StateObject(wrappedValue: ManutencaoConsumiveisStore(queue: queue))
        _pecaRepo = StateObject(wrappedValue: PecaRepository(queue: queue))
        _pneuRepo = StateObject(wrappedValue: PneuRepository(queue: queue))
    }

    var body: some View {
        Group {
            if ready, let id = carroId {
                if ProcessInfo.processInfo.arguments.contains("--p1-preco-ml") {
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
                        .environmentObject(NavRouter())
                }
            } else {
                Color.black.ignoresSafeArea()
            }
        }
        .task {
            await carroRepo.bootstrap()
            await pecaRepo.bootstrap()
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
            carroId = id
            ready = true
        }
    }

    /// Rota inicial do mock: hub do carro; com `--p1-deep` empilha tb o Estoque.
    private func rotaMock(carroId id: String) -> [HomeNavTarget] {
        if ProcessInfo.processInfo.arguments.contains("--p1-deep") {
            return [.garagem, .carroHub(carroId: id), .carroCadastro(carroId: id)]
        }
        return [.garagem, .carroHub(carroId: id)]
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
