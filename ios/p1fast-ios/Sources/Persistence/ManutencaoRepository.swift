// ═══════════════════════════════════════════════════════════
// ManutencaoRepository — função Manutenção (2026-05-18 "go")
// ═══════════════════════════════════════════════════════════
// Camada de persistência da função Manutenção: 3 tabelas locais
// (manutencoes / manutencao_especificacoes / manutencao_periodicidades),
// catálogo de 15 itens embarcado em P1FastCore.ManutencaoCatalogo,
// integração leve com PecaRepository pra abater −1 do estoque quando
// uma troca tem `pecaId` ligado.
//
// Tudo local nesta rodada — produção Supabase não foi tocada. Sync
// fica pra rodada futura quando o servidor estiver alinhado.

import Foundation
import GRDB
import P1FastCore
import UIKit

@MainActor
final class ManutencaoRepository: ObservableObject {
    @Published private(set) var manutencoes: [Manutencao] = []
    @Published private(set) var especificacoes: [ManutencaoEspecificacao] = []
    @Published private(set) var periodicidades: [ManutencaoPeriodicidade] = []

    private let queue: DatabaseQueue
    /// Repositório de Estoque injetado pra abater quantidade quando a
    /// troca está vinculada a uma peça do banco local.
    private weak var pecaRepo: PecaRepository?

    init(queue: DatabaseQueue, pecaRepo: PecaRepository? = nil) {
        self.queue = queue
        self.pecaRepo = pecaRepo
    }

    // MARK: - Bootstrap / reload

    func bootstrap() async {
        do {
            try await reload()
        } catch {
            print("ManutencaoRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.manutencoes = []
            self.especificacoes = []
            self.periodicidades = []
            return
        }
        let (m, esp, per) = try await queue.read { db -> ([Manutencao], [ManutencaoEspecificacao], [ManutencaoPeriodicidade]) in
            let m = try Manutencao.filter(Column("time_id") == teamId)
                .order(Column("ocorrido_em").desc).fetchAll(db)
            let esp = try ManutencaoEspecificacao.filter(Column("time_id") == teamId)
                .fetchAll(db)
            let per = try ManutencaoPeriodicidade.filter(Column("time_id") == teamId)
                .fetchAll(db)
            return (m, esp, per)
        }
        self.manutencoes = m
        self.especificacoes = esp
        self.periodicidades = per
    }

    // MARK: - Manutenção (CRUD)

    /// Cria uma nova manutenção. Quando `pecaId` é fornecida, registra
    /// também a movimentação −quantidade no estoque (idêntico ao botão
    /// "−1" do PecaViews).
    @discardableResult
    func criar(carroId: String,
               itemCodigo: String,
               area: PecaArea,
               ocorridoEm: Int64,
               kmCarro: Double? = nil,
               marca: String? = nil,
               modelo: String? = nil,
               especificacao: String? = nil,
               observacao: String? = nil,
               foto: UIImage? = nil,
               pecaId: String? = nil,
               quantidade: Int = 1) async throws -> Manutencao {
        guard let teamId = TeamContext.currentTeamId else {
            throw ManutencaoErro.semTime
        }
        let id = UUID().uuidString.lowercased()
        let fotoPath = foto.flatMap { Self.salvarFoto(manutencaoId: id, imagem: $0) }
        let m = Manutencao(
            id: id, timeId: teamId, carroId: carroId,
            itemCodigo: itemCodigo, area: area,
            ocorridoEm: ocorridoEm,
            kmCarro: kmCarro,
            marca: marca?.trimmedNilIfEmpty,
            modelo: modelo?.trimmedNilIfEmpty,
            especificacao: especificacao?.trimmedNilIfEmpty,
            observacao: observacao?.trimmedNilIfEmpty,
            fotoUrl: fotoPath,
            pecaId: pecaId, quantidade: max(1, quantidade)
        )
        try await queue.write { db in
            try m.insert(db)
        }
        // Se a manutenção referencia uma peça do Estoque, abate
        // `quantidade` do estoque (movimentação negativa).
        if let pecaId = pecaId, let pecaRepo = pecaRepo,
           let peca = pecaRepo.pecas.first(where: { $0.id == pecaId }) {
            let descricaoCurta = ManutencaoCatalogo.find(itemCodigo)?.nome ?? itemCodigo
            try await pecaRepo.registrarMovimentacao(
                peca: peca,
                delta: -max(1, quantidade),
                observacao: "Usado em manutenção: \(descricaoCurta)"
            )
        }
        try await reload()
        return m
    }

    func apagar(_ m: Manutencao) async throws {
        try await queue.write { db in
            _ = try m.delete(db)
        }
        try await reload()
    }

    // MARK: - Especificação padrão (UNIQUE por carro+item)

    /// Cria ou atualiza a especificação padrão de um item pra um carro.
    func upsertEspecificacao(carroId: String, itemCodigo: String,
                              marca: String?, modelo: String?,
                              especificacao: String?, observacao: String?) async throws {
        guard let teamId = TeamContext.currentTeamId else { throw ManutencaoErro.semTime }
        try await queue.write { db in
            if var existente = try ManutencaoEspecificacao
                .filter(Column("time_id") == teamId
                        && Column("carro_id") == carroId
                        && Column("item_codigo") == itemCodigo)
                .fetchOne(db) {
                existente.marca = marca?.trimmedNilIfEmpty
                existente.modelo = modelo?.trimmedNilIfEmpty
                existente.especificacao = especificacao?.trimmedNilIfEmpty
                existente.observacao = observacao?.trimmedNilIfEmpty
                existente.updatedAt = DB.nowMs()
                existente.syncedAt = nil
                try existente.update(db)
            } else {
                let nova = ManutencaoEspecificacao(
                    id: UUID().uuidString.lowercased(),
                    timeId: teamId, carroId: carroId, itemCodigo: itemCodigo,
                    marca: marca?.trimmedNilIfEmpty,
                    modelo: modelo?.trimmedNilIfEmpty,
                    especificacao: especificacao?.trimmedNilIfEmpty,
                    observacao: observacao?.trimmedNilIfEmpty
                )
                try nova.insert(db)
            }
        }
        try await reload()
    }

    func especificacao(carroId: String, itemCodigo: String) -> ManutencaoEspecificacao? {
        especificacoes.first { $0.carroId == carroId && $0.itemCodigo == itemCodigo }
    }

    // MARK: - Periodicidade (UNIQUE por carro+item)

    /// Atualiza/insere regra de periodicidade pra um item naquele carro.
    /// Se a regra for igual ao default do catálogo, mantém na tabela
    /// pra deixar explícito que foi confirmado pelo gestor.
    func upsertPeriodicidade(carroId: String, itemCodigo: String,
                              regra: PeriodicidadeRegra) async throws {
        guard let teamId = TeamContext.currentTeamId else { throw ManutencaoErro.semTime }
        let json = regra.toJSON()
        try await queue.write { db in
            if var existente = try ManutencaoPeriodicidade
                .filter(Column("time_id") == teamId
                        && Column("carro_id") == carroId
                        && Column("item_codigo") == itemCodigo)
                .fetchOne(db) {
                existente.regraJson = json
                existente.updatedAt = DB.nowMs()
                existente.syncedAt = nil
                try existente.update(db)
            } else {
                let nova = ManutencaoPeriodicidade(
                    id: UUID().uuidString.lowercased(),
                    timeId: teamId, carroId: carroId,
                    itemCodigo: itemCodigo, regraJson: json
                )
                try nova.insert(db)
            }
        }
        try await reload()
    }

    /// Regra efetiva pra um item naquele carro: override do usuário, ou
    /// default do catálogo se não houver override.
    func regra(carroId: String, itemCodigo: String) -> PeriodicidadeRegra {
        if let override = periodicidades.first(where: {
            $0.carroId == carroId && $0.itemCodigo == itemCodigo
        }) {
            return PeriodicidadeRegra.fromJSON(override.regraJson)
        }
        return ManutencaoCatalogo.find(itemCodigo)?.periodicidadeDefault ?? .porDesgaste
    }

    // MARK: - Consultas de UI

    /// Lista cronológica decrescente de manutenções de um carro.
    func manutencoes(doCarro carroId: String) -> [Manutencao] {
        manutencoes.filter { $0.carroId == carroId }
    }

    /// Última manutenção registrada de um item específico naquele carro.
    func ultimaManutencao(carroId: String, itemCodigo: String) -> Manutencao? {
        manutencoes
            .first { $0.carroId == carroId && $0.itemCodigo == itemCodigo }
        // Lista já vem ordenada por ocorrido_em DESC (reload).
    }

    /// Histórico de um item naquele carro (cronológico crescente, do
    /// mais antigo pro mais novo) — usado pelo cálculo de média
    /// aprendida do Bloco 5.
    func historicoItem(carroId: String, itemCodigo: String) -> [Manutencao] {
        manutencoes
            .filter { $0.carroId == carroId && $0.itemCodigo == itemCodigo }
            .sorted { $0.ocorridoEm < $1.ocorridoEm }
    }

    // MARK: - Fotos (armazenamento local)

    static func fotoLocalURL(manutencaoId: String) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("manutencoes-fotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(manutencaoId).jpg")
    }

    @discardableResult
    private static func salvarFoto(manutencaoId: String, imagem: UIImage) -> String? {
        guard let data = imagem.jpegData(compressionQuality: 0.72) else { return nil }
        let url = fotoLocalURL(manutencaoId: manutencaoId)
        do {
            try data.write(to: url, options: .atomic)
            return url.lastPathComponent
        } catch {
            print("ManutencaoRepository.salvarFoto falhou: \(error)")
            return nil
        }
    }

    static func carregarFoto(manutencaoId: String) -> UIImage? {
        let url = fotoLocalURL(manutencaoId: manutencaoId)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }
}

enum ManutencaoErro: Error {
    case semTime
}

private extension String {
    /// Trim de whitespace + nil quando vazio. Usado pra normalizar
    /// campos de texto livres antes de gravar.
    var trimmedNilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
