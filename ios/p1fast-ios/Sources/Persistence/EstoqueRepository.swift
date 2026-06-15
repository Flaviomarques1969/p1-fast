// ═══════════════════════════════════════════════════════════
// EstoqueRepository — Estoque geral unificado (2026-06-14)
// ═══════════════════════════════════════════════════════════
// Desenho aprovado por Flávio em 2026-06-14 (mockup-pendencias-estoque).
//
// "Item unificado": pode ser do Estoque geral (escopo = "geral") ou de um
// carro (escopo = carroId). Guarda a riqueza nova — item/ferramenta, bloco
// (G1..G6), categoria (obrigatório/desejável), especificação e como conta a
// quantidade (Simples / Embalagens / Conjunto).
//
// LOCAL-ONLY: NÃO passa pelo SyncQueue. Mantém o estoque do carro existente
// (`pecas`, que sobe pra nuvem/produção) intacto. A posse mora no estoque; o
// "peguei" (quantos já separei) é por evento (evento_pendencia_pegou).

import Foundation
import GRDB
import P1FastCore
import UIKit

/// Bloco do catálogo (G1..G6) — mesmos 6 blocos das Pendências.
struct BlocoPend: Identifiable, Equatable, Hashable {
    let id: String      // grupoId — "G1".."G6"
    let num: String     // "1".."6"
    let titulo: String
}

@MainActor
final class EstoqueRepository: ObservableObject {
    @Published private(set) var itens: [EstoqueItem] = []
    /// "peguei" por evento: eventoId → (itemId → quantos já peguei).
    @Published private(set) var pegouPorEvento: [String: [String: Int]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) { self.queue = queue }

    /// 6 blocos canônicos (iguais aos do catálogo de Pendências).
    static let blocos: [BlocoPend] = [
        BlocoPend(id: "G1", num: "1", titulo: "Mecânica"),
        BlocoPend(id: "G2", num: "2", titulo: "Combustível"),
        BlocoPend(id: "G3", num: "3", titulo: "Pneus & Suspensão"),
        BlocoPend(id: "G4", num: "4", titulo: "Elétrica"),
        BlocoPend(id: "G5", num: "5", titulo: "Segurança"),
        BlocoPend(id: "G6", num: "6", titulo: "Logística & Apoio")
    ]
    static func bloco(id: String) -> BlocoPend {
        blocos.first { $0.id == id } ?? blocos[0]
    }

    static let escopoGeral = "geral"

    // MARK: - Bootstrap / reload

    func bootstrap() async {
        do {
            try await reload()
            try await copiarDoEstoqueDoCarroSeNecessario()
        } catch { print("EstoqueRepository.bootstrap failed: \(error)") }
    }

    func reload() async throws {
        guard let teamId = TeamContext.currentTeamId else { self.itens = []; return }
        let rows = try await queue.read { db in
            try EstoqueItem.filter(Column("time_id") == teamId)
                .order(Column("grupo_num").asc, Column("nome").asc)
                .fetchAll(db)
        }
        self.itens = rows
    }

    // MARK: - Consultas

    /// Itens de um escopo (ex.: "geral" ou um carroId).
    func itens(escopo: String) -> [EstoqueItem] {
        itens.filter { $0.escopo == escopo }
    }

    /// Itens que valem pra um evento: estoque geral + (estoque do carro do evento).
    func itens(paraEscopos escopos: [String]) -> [EstoqueItem] {
        let set = Set(escopos)
        return itens.filter { set.contains($0.escopo) }
    }

    /// Encontra um item por nome (case-insensitive) dentro dos escopos dados —
    /// usado pra ligar a Pendência do catálogo ao estoque (alvo = quantidade).
    func item(nome: String, escopos: [String]) -> EstoqueItem? {
        let alvo = nome.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let set = Set(escopos)
        return itens.first { set.contains($0.escopo)
            && $0.nome.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == alvo }
    }

    // MARK: - CRUD

    @discardableResult
    func criar(escopo: String, kind: String, bloco: BlocoPend, nome: String,
               especificacao: String?, categoria: String, contagem: String,
               quantidade: Int, volume: Double?, unidade: String?, embalagens: Int?,
               partes: [EstoqueItem.Parte], foto: UIImage?) async throws -> EstoqueItem {
        guard let teamId = TeamContext.currentTeamId else { throw EstoqueErro.semTime }
        let id = UUID().uuidString.lowercased()
        let fotoUrl = foto.flatMap { Self.salvarFoto(itemId: id, imagem: $0) }
        var item = EstoqueItem(
            id: id, timeId: teamId, escopo: escopo, kind: kind,
            grupoId: bloco.id, grupoTitulo: bloco.titulo, grupoNum: bloco.num,
            nome: nome.trimmingCharacters(in: .whitespacesAndNewlines),
            especificacao: especificacao?.trimmingCharacters(in: .whitespacesAndNewlines).nilSeVazio,
            categoria: categoria, contagem: contagem,
            quantidade: max(0, quantidade), volume: volume, unidade: unidade,
            embalagens: embalagens, partesJson: EstoqueItem.encodePartes(partes), fotoUrl: fotoUrl
        )
        try await queue.write { db in try item.insert(db) }
        try await reload()
        return item
    }

    func atualizar(_ item: EstoqueItem, foto: UIImage?) async throws {
        var atual = item
        atual.updatedAt = DB.nowMs()
        if let foto { atual.fotoUrl = Self.salvarFoto(itemId: atual.id, imagem: foto) ?? atual.fotoUrl }
        try await queue.write { db in try atual.update(db) }
        try await reload()
    }

    func apagar(_ item: EstoqueItem) async throws {
        try await queue.write { db in _ = try item.delete(db) }
        Self.apagarFoto(itemId: item.id)
        try await reload()
    }

    func apagar(ids: [String]) async throws {
        guard !ids.isEmpty else { return }
        try await queue.write { db in
            _ = try EstoqueItem.filter(keys: ids).deleteAll(db)
        }
        ids.forEach { Self.apagarFoto(itemId: $0) }
        try await reload()
    }

    // MARK: - "peguei" por evento (local)

    func reloadPegou(_ eventoId: String) async throws {
        let rows = try await queue.read { db in
            try EventoPendenciaPegou.filter(Column("evento_id") == eventoId).fetchAll(db)
        }
        pegouPorEvento[eventoId] = Dictionary(uniqueKeysWithValues: rows.map { ($0.itemId, $0.pegou) })
    }

    func pegou(eventoId: String, itemId: String) -> Int {
        pegouPorEvento[eventoId]?[itemId] ?? 0
    }

    /// Define quantos já "peguei" deste item para este evento (clampa em 0).
    func setPegou(eventoId: String, itemId: String, pegou: Int) async throws {
        let v = max(0, pegou)
        let rec = EventoPendenciaPegou(eventoId: eventoId, itemId: itemId, pegou: v)
        let agora = DB.nowMs()
        try await queue.write { db in
            try db.execute(sql: """
                INSERT INTO evento_pendencia_pegou (id, evento_id, item_id, pegou, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET pegou = excluded.pegou, updated_at = excluded.updated_at
            """, arguments: [rec.id, eventoId, itemId, v, agora])
        }
        var mapa = pegouPorEvento[eventoId] ?? [:]
        mapa[itemId] = v
        pegouPorEvento[eventoId] = mapa
    }

    // MARK: - Fotos (armazenamento local, igual às peças)

    static func fotoURL(itemId: String) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("estoque-fotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(itemId).jpg")
    }

    @discardableResult
    static func salvarFoto(itemId: String, imagem: UIImage) -> String? {
        guard let data = imagem.jpegData(compressionQuality: 0.72) else { return nil }
        let url = fotoURL(itemId: itemId)
        try? data.write(to: url, options: .atomic)
        return url.lastPathComponent
    }

    static func carregarFoto(itemId: String) -> UIImage? {
        let url = fotoURL(itemId: itemId)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    static func apagarFoto(itemId: String) {
        try? FileManager.default.removeItem(at: fotoURL(itemId: itemId))
    }
}

enum EstoqueErro: Error { case semTime }

private extension String {
    var nilSeVazio: String? { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self }
}
