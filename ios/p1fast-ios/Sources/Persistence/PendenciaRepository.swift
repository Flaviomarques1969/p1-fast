// ═══════════════════════════════════════════════════════════
// PendenciaRepository — checklist por evento
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #21. 2 tabelas:
// • pendencias_template = catálogo curado (GLOBAL, igual licoes).
//   45 itens distribuídos em 6 grupos canônicos (Mecânica/Combustível/
//   Pneus & Suspensão/Elétrica/Segurança/Logística & Apoio). Portado
//   de src/data/schemas.js (SEED_PEND_TIPOS + SEED_ITENS_EVENTO).
//   Heurística de mapeamento item→grupo é hardcoded aqui.
//
// • evento_pendencias = instâncias por evento (UNIQUE evento+template).
//   Criadas auto na 1ª abertura da PendenciasView pra esse evento
//   (ensureInstancesForEvento).
//
// V1 = catálogo readonly (sem add/edit/delete pelo usuário).

import Foundation
import GRDB
import P1FastCore

@MainActor
final class PendenciaRepository: ObservableObject {
    /// Templates carregados do banco (ordenados por grupoNum + ordem).
    @Published private(set) var templates: [PendenciaTemplate] = []

    /// Cache de instâncias por evento atualmente carregado.
    /// Map: eventoId → [EventoPendencia], indexado pra atualização rápida.
    @Published private(set) var instanciasPorEvento: [String: [EventoPendencia]] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func bootstrap() async {
        do {
            try await seedTemplatesIfDifferent()
            try await reloadTemplates()
        } catch {
            print("PendenciaRepository.bootstrap failed: \(error)")
        }
    }

    func reloadTemplates() async throws {
        let rows = try await queue.read { db in
            try PendenciaTemplate.order(
                Column("grupo_num").asc, Column("ordem").asc
            ).fetchAll(db)
        }
        self.templates = rows
    }

    /// Garante 1 row em evento_pendencias por template, pra esse evento.
    /// Idempotente via UNIQUE(evento_id, template_id). Recarrega cache.
    func ensureInstancesForEvento(_ eventoId: String) async throws {
        let allTemplateIds = templates.map(\.id)
        try await queue.write { db in
            let existing = try EventoPendencia
                .filter(Column("evento_id") == eventoId)
                .fetchAll(db)
            let existingTemplateIds = Set(existing.map(\.templateId))
            for tid in allTemplateIds where !existingTemplateIds.contains(tid) {
                let inst = EventoPendencia(
                    id: UUID().uuidString,
                    eventoId: eventoId,
                    templateId: tid
                )
                try inst.insert(db)
                try SyncQueue.enqueueRecord(db, tableName: "evento_pendencias", rowId: inst.id, op: .insert, record: inst)
            }
        }
        try await reloadInstancesForEvento(eventoId)
    }

    func reloadInstancesForEvento(_ eventoId: String) async throws {
        let rows = try await queue.read { db in
            try EventoPendencia
                .filter(Column("evento_id") == eventoId)
                .fetchAll(db)
        }
        instanciasPorEvento[eventoId] = rows
    }

    func toggle(instanceId: String, novo: Bool) async throws {
        try await queue.write { db in
            guard var inst = try EventoPendencia.fetchOne(db, key: instanceId) else { return }
            inst.checado = novo
            inst.checadoAt = novo ? DB.nowMs() : nil
            inst.updatedAt = DB.nowMs()
            inst.syncedAt = nil
            try inst.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "evento_pendencias", rowId: inst.id, op: .update, record: inst)
        }
        // Atualiza cache local sem refetch.
        for (eid, list) in instanciasPorEvento {
            if let idx = list.firstIndex(where: { $0.id == instanceId }) {
                var copy = list
                copy[idx].checado = novo
                copy[idx].checadoAt = novo ? DB.nowMs() : nil
                instanciasPorEvento[eid] = copy
                return
            }
        }
    }

    func setNota(instanceId: String, nota: String?) async throws {
        try await queue.write { db in
            guard var inst = try EventoPendencia.fetchOne(db, key: instanceId) else { return }
            inst.nota = nota?.isEmpty == true ? nil : nota
            inst.updatedAt = DB.nowMs()
            inst.syncedAt = nil
            try inst.update(db)
            try SyncQueue.enqueueRecord(db, tableName: "evento_pendencias", rowId: inst.id, op: .update, record: inst)
        }
        for (eid, list) in instanciasPorEvento {
            if let idx = list.firstIndex(where: { $0.id == instanceId }) {
                var copy = list
                copy[idx].nota = nota?.isEmpty == true ? nil : nota
                instanciasPorEvento[eid] = copy
                return
            }
        }
    }

    /// Retorna mapa grupoId → instâncias (com template anexo).
    func grupos(forEventoId eventoId: String) -> [PendenciaGrupoView] {
        let insts = instanciasPorEvento[eventoId] ?? []
        let templatesById = Dictionary(uniqueKeysWithValues: templates.map { ($0.id, $0) })
        // Junta instância com template
        let pares: [(template: PendenciaTemplate, instance: EventoPendencia)] = insts.compactMap { inst in
            guard let t = templatesById[inst.templateId] else { return nil }
            return (t, inst)
        }
        let porGrupo = Dictionary(grouping: pares, by: { $0.template.grupoId })
        let grupoIds = Set(templates.map(\.grupoId))
        return grupoIds.sorted { l, r in
            (templates.first { $0.grupoId == l }?.grupoNum ?? "9") <
            (templates.first { $0.grupoId == r }?.grupoNum ?? "9")
        }.compactMap { gid in
            guard let parsDoGrupo = porGrupo[gid], let firstT = parsDoGrupo.first?.template else { return nil }
            let sorted = parsDoGrupo.sorted { $0.template.ordem < $1.template.ordem }
            return PendenciaGrupoView(
                grupoId: gid,
                grupoTitulo: firstT.grupoTitulo,
                grupoNum: firstT.grupoNum,
                itens: sorted.map { PendenciaItemView(template: $0.template, instance: $0.instance) }
            )
        }
    }

    // MARK: - Seed

    /// Insere/atualiza templates canônicos. Idempotente: se o id já existe e
    /// o conteúdo bate, no-op. Se diverge, atualiza titulo/grupo (não toca
    /// timestamps ou outros campos voláteis).
    private func seedTemplatesIfDifferent() async throws {
        let canonical = Self.canonicalTemplates
        try await queue.write { db in
            let existing = try PendenciaTemplate.fetchAll(db)
            let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
            for var seed in canonical {
                if let curr = existingById[seed.id] {
                    if Self.semanticallyEqual(curr, seed) { continue }
                    seed.createdAt = curr.createdAt
                    seed.updatedAt = DB.nowMs()
                    try seed.update(db)
                } else {
                    try seed.insert(db)
                }
            }
        }
    }

    nonisolated private static func semanticallyEqual(_ a: PendenciaTemplate, _ b: PendenciaTemplate) -> Bool {
        return a.id == b.id
            && a.grupoId == b.grupoId
            && a.grupoTitulo == b.grupoTitulo
            && a.grupoNum == b.grupoNum
            && a.titulo == b.titulo
            && a.observacao == b.observacao
            && a.obrigatorio == b.obrigatorio
            && a.ordem == b.ordem
    }

    /// Catálogo canônico — 45 itens em 6 grupos canônicos do
    /// SEED_PEND_TIPOS + SEED_ITENS_EVENTO. Heurística de mapeamento
    /// item→grupo é manual. Todos `obrigatorio=true` (igual ao JS V1).
    nonisolated static let canonicalTemplates: [PendenciaTemplate] = {
        let now = DB.nowMs()
        // Helper inline pra reduzir verbosidade
        func t(_ id: String, _ grupoId: String, _ grupoTit: String, _ grupoNum: String,
               _ titulo: String, _ ordem: Int, obs: String? = nil) -> PendenciaTemplate {
            return PendenciaTemplate(
                id: id, grupoId: grupoId, grupoTitulo: grupoTit, grupoNum: grupoNum,
                titulo: titulo, observacao: obs,
                obrigatorio: true, ordem: ordem,
                createdAt: now, updatedAt: now
            )
        }
        return [
            // ─── G1 Mecânica (8) ───
            t("pt-g1-01", "G1", "Mecânica", "1", "Óleo motor", 1),
            t("pt-g1-02", "G1", "Mecânica", "1", "Óleo câmbio", 2),
            t("pt-g1-03", "G1", "Mecânica", "1", "Óleo (geral)", 3),
            t("pt-g1-04", "G1", "Mecânica", "1", "Graxa", 4),
            t("pt-g1-05", "G1", "Mecânica", "1", "Bacia de óleo", 5),
            t("pt-g1-06", "G1", "Mecânica", "1", "Funil", 6),
            t("pt-g1-07", "G1", "Mecânica", "1", "Compressor de ar", 7),
            t("pt-g1-08", "G1", "Mecânica", "1", "Ferro de solda", 8),

            // ─── G2 Combustível (3) ───
            t("pt-g2-01", "G2", "Combustível", "2", "Combustível motos — tanque amarelo", 1),
            t("pt-g2-02", "G2", "Combustível", "2", "Combustível carro — tanque vermelho 50L + barril 50L", 2),
            t("pt-g2-03", "G2", "Combustível", "2", "Medidor de temperatura", 3),

            // ─── G3 Pneus & Suspensão (4) ───
            t("pt-g3-01", "G3", "Pneus & Suspensão", "3", "Macaco", 1),
            t("pt-g3-02", "G3", "Pneus & Suspensão", "3", "Jacks (cavaletes)", 2),
            t("pt-g3-03", "G3", "Pneus & Suspensão", "3", "Rodas sobressalentes", 3),
            t("pt-g3-04", "G3", "Pneus & Suspensão", "3", "Medidor de pressão dos pneus", 4),

            // ─── G4 Elétrica (11) ───
            t("pt-g4-01", "G4", "Elétrica", "4", "Bateria", 1),
            t("pt-g4-02", "G4", "Elétrica", "4", "Fio de ligação elétrica", 2),
            t("pt-g4-03", "G4", "Elétrica", "4", "Terminal de ligação elétrica", 3),
            t("pt-g4-04", "G4", "Elétrica", "4", "Lâmpada traseira", 4),
            t("pt-g4-05", "G4", "Elétrica", "4", "Lâmpada de teste", 5),
            t("pt-g4-06", "G4", "Elétrica", "4", "Luz reserva de freio", 6),
            t("pt-g4-07", "G4", "Elétrica", "4", "Luz LED", 7),
            t("pt-g4-08", "G4", "Elétrica", "4", "Fusível sobressalente", 8),
            t("pt-g4-09", "G4", "Elétrica", "4", "Carregador de telefone", 9),
            t("pt-g4-10", "G4", "Elétrica", "4", "Powerbank para carregar bateria", 10),
            t("pt-g4-11", "G4", "Elétrica", "4", "Extensão elétrica", 11),

            // ─── G5 Segurança (4) ───
            t("pt-g5-01", "G5", "Segurança", "5", "Extintor", 1),
            t("pt-g5-02", "G5", "Segurança", "5", "Protetor de pescoço", 2),
            t("pt-g5-03", "G5", "Segurança", "5", "Capa do carro", 3),
            t("pt-g5-04", "G5", "Segurança", "5", "Desembaçador", 4),

            // ─── G6 Logística & Apoio (15) ───
            t("pt-g6-01", "G6", "Logística & Apoio", "6", "Tie-down (cintas de amarração)", 1),
            t("pt-g6-02", "G6", "Logística & Apoio", "6", "Cabo para rebocar o Celta", 2),
            t("pt-g6-03", "G6", "Logística & Apoio", "6", "Carro de transporte", 3),
            t("pt-g6-04", "G6", "Logística & Apoio", "6", "Caixa de ferramentas", 4),
            t("pt-g6-05", "G6", "Logística & Apoio", "6", "Caixa de ferramentas pequena", 5),
            t("pt-g6-06", "G6", "Logística & Apoio", "6", "Armário de ferramentas", 6),
            t("pt-g6-07", "G6", "Logística & Apoio", "6", "Mesa de apoio", 7),
            t("pt-g6-08", "G6", "Logística & Apoio", "6", "Cadeiras pra sentar", 8),
            t("pt-g6-09", "G6", "Logística & Apoio", "6", "Cooler", 9),
            t("pt-g6-10", "G6", "Logística & Apoio", "6", "Pano", 10),
            t("pt-g6-11", "G6", "Logística & Apoio", "6", "Rolo de pano para limpeza", 11),
            t("pt-g6-12", "G6", "Logística & Apoio", "6", "WD", 12),
            t("pt-g6-13", "G6", "Logística & Apoio", "6", "TV", 13),
            t("pt-g6-14", "G6", "Logística & Apoio", "6", "Suporte da TV", 14),
            t("pt-g6-15", "G6", "Logística & Apoio", "6", "Limpar câmera de ré do caminhão", 15),
        ]
    }()
}

// MARK: - View models leves pra UI

struct PendenciaGrupoView: Identifiable, Equatable {
    let grupoId: String
    let grupoTitulo: String
    let grupoNum: String
    let itens: [PendenciaItemView]

    var id: String { grupoId }
    var checados: Int { itens.filter(\.instance.checado).count }
    var total: Int { itens.count }
    var allChecked: Bool { checados == total && total > 0 }
    var anyChecked: Bool { checados > 0 }
    var allMandatoryChecked: Bool {
        itens.filter(\.template.obrigatorio).allSatisfy(\.instance.checado)
    }
}

struct PendenciaItemView: Identifiable, Equatable {
    let template: PendenciaTemplate
    let instance: EventoPendencia

    var id: String { instance.id }
}
