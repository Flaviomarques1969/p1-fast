// ═══════════════════════════════════════════════════════════
// PecaRepository — CRUD da função "Peças do carro" (2026-05-17)
// ═══════════════════════════════════════════════════════════
// Banco único de peças com campos de estoque opcionais (decisão A);
// cada peça pertence a UM carro (decisão D); locais cadastráveis
// (decisão C — seed inicial com 3 sugestões: Box · Caminhão · Oficina);
// movimentações −1/+1 com histórico (decisão F); áreas via lista fixa
// PecaArea (decisão E); campo `tipo` distingue componente do carro de
// ferramenta de manutenção específica (comentário do Flávio).
//
// Tudo local no GRDB. Sincronização com servidor oficial fica pra
// rodada futura (sem migração agora — produção protegida).

import Foundation
import GRDB
import P1FastCore
import UIKit

@MainActor
final class PecaRepository: ObservableObject {
    @Published private(set) var pecas: [Peca] = []
    @Published private(set) var locais: [PecaLocal] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    // MARK: - Bootstrap / reload

    func bootstrap() async {
        do {
            try await seedLocaisIfNeeded()
            try await reload()
        } catch {
            print("PecaRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.pecas = []
            self.locais = []
            return
        }
        let (pecasRows, locaisRows) = try await queue.read { db -> ([Peca], [PecaLocal]) in
            let p = try Peca.filter(Column("time_id") == teamId)
                .order(Column("nome").asc).fetchAll(db)
            let l = try PecaLocal.filter(Column("time_id") == teamId)
                .order(Column("ordem").asc).fetchAll(db)
            return (p, l)
        }
        self.pecas = pecasRows
        self.locais = locaisRows
    }

    /// Cria os 3 locais default na primeira vez que o time abre a função.
    /// Idempotente — só insere se a tabela está vazia pra esse time.
    private func seedLocaisIfNeeded() async throws {
        guard let teamId = TeamContext.currentTeamId else { return }
        try await queue.write { db in
            let count = try PecaLocal.filter(Column("time_id") == teamId).fetchCount(db)
            guard count == 0 else { return }
            let agora = DB.nowMs()
            let defaults: [(String, String?, Int)] = [
                ("Box", "Estoque que viaja pro autódromo", 0),
                ("Caminhão", "Estoque que está no caminhão", 1),
                ("Oficina", "Estoque que fica na oficina em casa", 2)
            ]
            for (nome, desc, ord) in defaults {
                var local = PecaLocal(
                    id: UUID().uuidString.lowercased(),
                    timeId: teamId,
                    nome: nome,
                    descricao: desc,
                    ordem: ord,
                    createdAt: agora,
                    updatedAt: agora
                )
                try local.insert(db)
            }
        }
    }

    // MARK: - Peças (CRUD)

    @discardableResult
    func criarPeca(carroId: String, nome: String, codigo: String?,
                   area: PecaArea, tipo: PecaTipo, especificacao: String?,
                   quantidade: Int, precoUnitarioCents: Int?,
                   localId: String?, observacoes: String?,
                   fotos: [UIImage]) async throws -> Peca {
        guard let teamId = TeamContext.currentTeamId else {
            throw PecaRepoErro.semTime
        }
        let id = UUID().uuidString.lowercased()
        let fotoPath = Self.salvarFotos(pecaId: id, imagens: fotos)
        var peca = Peca(
            id: id, timeId: teamId, carroId: carroId,
            nome: nome.trimmingCharacters(in: .whitespacesAndNewlines),
            codigo: codigo?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            area: area, tipo: tipo,
            especificacao: especificacao?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            fotoUrl: fotoPath,
            quantidade: max(0, quantidade),
            precoUnitarioCents: precoUnitarioCents,
            localId: localId,
            observacoes: observacoes?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        )
        try await queue.write { db in
            try peca.insert(db)
            if peca.quantidade > 0 {
                var mov = PecaMovimentacao(
                    id: UUID().uuidString.lowercased(),
                    timeId: teamId,
                    pecaId: peca.id,
                    delta: peca.quantidade,
                    observacao: "Estoque inicial",
                    ocorridoEm: DB.nowMs()
                )
                try mov.insert(db)
            }
        }
        try await reload()
        return peca
    }

    func atualizarPeca(_ p: Peca) async throws {
        var atual = p
        atual.updatedAt = DB.nowMs()
        try await queue.write { db in try atual.update(db) }
        try await reload()
    }

    func apagarPeca(_ p: Peca) async throws {
        try await queue.write { db in
            _ = try p.delete(db)
        }
        try await reload()
    }

    // MARK: - Movimentações (−1 / +1)

    func registrarMovimentacao(peca: Peca, delta: Int, observacao: String? = nil) async throws {
        guard let teamId = TeamContext.currentTeamId else { throw PecaRepoErro.semTime }
        guard delta != 0 else { return }
        let novaQuantidade = max(0, peca.quantidade + delta)
        try await queue.write { db in
            var mov = PecaMovimentacao(
                id: UUID().uuidString.lowercased(),
                timeId: teamId,
                pecaId: peca.id,
                delta: delta,
                observacao: observacao?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                ocorridoEm: DB.nowMs()
            )
            try mov.insert(db)
            try db.execute(
                sql: "UPDATE pecas SET quantidade = ?, updated_at = ? WHERE id = ?",
                arguments: [novaQuantidade, DB.nowMs(), peca.id]
            )
        }
        try await reload()
    }

    func historico(pecaId: String) async throws -> [PecaMovimentacao] {
        try await queue.read { db in
            try PecaMovimentacao.filter(Column("peca_id") == pecaId)
                .order(Column("ocorrido_em").desc).fetchAll(db)
        }
    }

    // MARK: - Locais (CRUD)

    @discardableResult
    func criarLocal(nome: String, descricao: String?) async throws -> PecaLocal {
        guard let teamId = TeamContext.currentTeamId else { throw PecaRepoErro.semTime }
        let proximaOrdem = (locais.map { $0.ordem }.max() ?? -1) + 1
        var local = PecaLocal(
            id: UUID().uuidString.lowercased(),
            timeId: teamId,
            nome: nome.trimmingCharacters(in: .whitespacesAndNewlines),
            descricao: descricao?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            ordem: proximaOrdem
        )
        try await queue.write { db in try local.insert(db) }
        try await reload()
        return local
    }

    func atualizarLocal(_ l: PecaLocal) async throws {
        var atual = l
        atual.updatedAt = DB.nowMs()
        try await queue.write { db in try atual.update(db) }
        try await reload()
    }

    func apagarLocal(_ l: PecaLocal) async throws {
        try await queue.write { db in
            try db.execute(sql: "UPDATE pecas SET local_id = NULL WHERE local_id = ?", arguments: [l.id])
            _ = try l.delete(db)
        }
        try await reload()
    }

    func localNome(id: String?) -> String? {
        guard let id = id else { return nil }
        return locais.first { $0.id == id }?.nome
    }

    // MARK: - Filtros / busca

    func pecas(doCarro carroId: String) -> [Peca] {
        pecas.filter { $0.carroId == carroId }
    }

    func busca(_ termo: String) -> [Peca] {
        let q = termo.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return pecas }
        return pecas.filter {
            $0.nome.lowercased().contains(q)
                || ($0.codigo ?? "").lowercased().contains(q)
                || ($0.especificacao ?? "").lowercased().contains(q)
                || $0.area.lowercased().contains(q)
        }
    }

    // MARK: - Fotos (armazenamento local)

    /// Até 5 fotos por peça (2026-06-01, pedido do Flávio; era 3).
    static let maxFotos = 5

    /// índice 0 = `{pecaId}.jpg` (principal, vai no `fotoUrl`); 1..N = `{pecaId}-N.jpg`.
    static func fotoLocalURL(pecaId: String, indice: Int = 0) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("pecas-fotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let nome = indice == 0 ? "\(pecaId).jpg" : "\(pecaId)-\(indice).jpg"
        return dir.appendingPathComponent(nome)
    }

    /// Salva até `maxFotos` fotos e apaga sobras de uma versão
    /// anterior. Retorna o nome do arquivo da PRINCIPAL (índice 0) pra
    /// guardar em `fotoUrl`; nil se não houver foto.
    @discardableResult
    static func salvarFotos(pecaId: String, imagens: [UIImage]) -> String? {
        let lista = Array(imagens.prefix(maxFotos))
        for indice in 0..<maxFotos {
            let url = fotoLocalURL(pecaId: pecaId, indice: indice)
            if indice < lista.count, let data = lista[indice].jpegData(compressionQuality: 0.72) {
                try? data.write(to: url, options: .atomic)
            } else {
                try? FileManager.default.removeItem(at: url)
            }
        }
        guard !lista.isEmpty else { return nil }
        return fotoLocalURL(pecaId: pecaId, indice: 0).lastPathComponent
    }

    static func carregarFoto(pecaId: String) -> UIImage? {
        carregarFotos(pecaId: pecaId).first
    }

    /// Carrega as até `maxFotos` fotos que existirem, em ordem de índice.
    static func carregarFotos(pecaId: String) -> [UIImage] {
        var fotos: [UIImage] = []
        for indice in 0..<maxFotos {
            let url = fotoLocalURL(pecaId: pecaId, indice: indice)
            if FileManager.default.fileExists(atPath: url.path),
               let img = UIImage(contentsOfFile: url.path) {
                fotos.append(img)
            }
        }
        return fotos
    }
}

enum PecaRepoErro: Error {
    case semTime
}

private extension Optional where Wrapped == String {
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
