// ═══════════════════════════════════════════════════════════
// ArquivoRepository — "Apagados" (lixeira) por entidade da Garagem
// ═══════════════════════════════════════════════════════════
// Pedido de Flávio 2026-06-14: apagar do app, mas guardar pra resgatar.
//
// Esta camada SÓ LISTA o que está escondido (pra montar a tela "Apagados"
// e o contador "Apagados (N)" em cada sub-aba). O ato de esconder/resgatar
// mora no repositório de cada entidade (`arquivar`/`restaurar`), que escreve
// na tabela local `item_arquivado` e dá reload na própria lista. Aqui só
// publicamos o conjunto pra UI reagir.
//
// LOCAL-ONLY: a tabela `item_arquivado` não passa pelo SyncQueue. Apagar é
// reversível e fica só no iPhone — o dado original (que sobe pra produção)
// nunca é tocado. Ver `ItemArquivado` em P1FastCore/Models.swift.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class ArquivoRepository: ObservableObject {
    @Published private(set) var arquivados: [ItemArquivado] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func bootstrap() async {
        do {
            try await reload()
        } catch {
            print("ArquivoRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega a lista completa de itens escondidos (todas as entidades).
    func reload() async throws {
        let rows = try await queue.read { db in
            try ItemArquivado.order(Column("arquivado_em").desc).fetchAll(db)
        }
        self.arquivados = rows
    }

    /// Itens escondidos de uma entidade (mais recentes primeiro).
    func itens(entidade: String) -> [ItemArquivado] {
        arquivados.filter { $0.entidade == entidade }
    }

    /// Quantos itens escondidos numa entidade (pro contador "Apagados (N)").
    func total(entidade: String) -> Int {
        arquivados.reduce(0) { $0 + ($1.entidade == entidade ? 1 : 0) }
    }
}
