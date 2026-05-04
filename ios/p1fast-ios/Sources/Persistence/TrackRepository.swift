// ═══════════════════════════════════════════════════════════
// TrackRepository — leitura de tracks/layouts/segments + seed
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #19. Schema (`tracks` + `track_layouts` +
// `track_segments` + `marcos`) já existe em v1_initial. As struct
// rows já existem em Models.swift (TrackRow / TrackLayoutRow /
// TrackSegmentRow / Marco). Aqui só CRUD readonly + bootstrap
// que persiste o layout principal de Brasília (P1) + 12 segments
// + marcos a partir de SeedBrasilia.make().
//
// Coexistência com EventoRepository.ensureBrasiliaTrack(): aquela
// método cria o TrackRow `trk_brasilia` mas não popula layouts/
// segments/marcos. Bootstrap aqui complementa, idempotente.
//
// V1 = readonly. Sem add/edit/delete pelo usuário (TrechoListaView
// só lista). CRUD virá quando UI de cadastro de pista entrar.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class TrackRepository: ObservableObject {
    @Published private(set) var tracks: [TrackRow] = []
    @Published private(set) var layoutsByTrack: [String: [TrackLayoutRow]] = [:]
    @Published private(set) var segmentsByLayout: [String: [TrackSegmentRow]] = [:]
    @Published private(set) var marcosByLayout: [String: [Marco]] = [:]

    /// Mapa parcial_id → (apelido, nome) pra UI agrupar. Brasília tem 4 parciais
    /// (P1..P4) com apelidos descritivos do mockup.
    @Published private(set) var parciaisBrasilia: [String: P1FastCore.Parcial] = [:]

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    /// Bootstrap idempotente:
    /// 1. Garante o TrackRow `trk_brasilia` (caso EventoRepository não tenha rodado ainda)
    /// 2. Garante o layout `lay_brasilia_principal` + 12 segments + marcos derivados
    /// 3. Carrega caches publicados
    func bootstrap() async {
        do {
            try await seedBrasiliaIfMissing()
            try await reloadAll()
        } catch {
            print("TrackRepository.bootstrap failed: \(error)")
        }
    }

    /// Recarrega todas as caches a partir do GRDB.
    func reloadAll() async throws {
        let snapshot = try await queue.read { db -> Snapshot in
            let tks = try TrackRow.order(Column("apelido").asc).fetchAll(db)
            let lays = try TrackLayoutRow.fetchAll(db)
            let segs = try TrackSegmentRow.order(Column("ordem").asc).fetchAll(db)
            let mks = try Marco.fetchAll(db)
            return Snapshot(tracks: tks, layouts: lays, segments: segs, marcos: mks)
        }
        self.tracks = snapshot.tracks
        self.layoutsByTrack = Dictionary(grouping: snapshot.layouts, by: { $0.trackId })
        self.segmentsByLayout = Dictionary(grouping: snapshot.segments, by: { $0.layoutId })
        self.marcosByLayout = Dictionary(grouping: snapshot.marcos, by: { $0.layoutId })
        // Parciais hoje só pra Brasília — outras pistas entram quando virarem produto.
        self.parciaisBrasilia = Dictionary(uniqueKeysWithValues: SeedBrasilia.parciais.map { ($0.id, $0) })
    }

    // MARK: - Reads

    func track(id: String) -> TrackRow? {
        tracks.first(where: { $0.id == id })
    }

    func layouts(forTrackId trackId: String) -> [TrackLayoutRow] {
        layoutsByTrack[trackId] ?? []
    }

    /// Todos os segments de um layout, em ordem. Inclui retas e curvas.
    func segments(forLayoutId layoutId: String) -> [TrackSegmentRow] {
        segmentsByLayout[layoutId] ?? []
    }

    /// Apenas segments com `eh_trecho=1` (curvas pedagógicas) — usados
    /// na TrechoListaView (retas não viram "trechos a aprender").
    func trechos(forLayoutId layoutId: String) -> [TrackSegmentRow] {
        (segmentsByLayout[layoutId] ?? []).filter { $0.ehTrecho }
    }

    /// Decode helper — devolve `SegmentGeometry.Blob` já parseado pra um row.
    func geometria(forSegmentId segmentId: String) -> P1FastCore.SegmentGeometry.Blob? {
        for (_, segs) in segmentsByLayout {
            if let seg = segs.first(where: { $0.id == segmentId }) {
                return P1FastCore.SegmentGeometry.decode(seg.geometria)
            }
        }
        return nil
    }

    // MARK: - Updates (MS-1.4 configurador visual)

    /// Atualiza os 4 pontos canônicos do trecho (entry/braking/apex/exit) e
    /// re-encoda o JSON `geometria`. Demais campos (tipo, tNaVolta, strategy
    /// etc) são preservados. Idempotente — mesmos pontos não mudam o blob.
    /// Ponto `nil` remove o campo (modo degradado).
    ///
    /// Caller típico: configurador visual MS-1.4 ao confirmar mudanças.
    func updateCanonicalPoints(
        segmentId: String,
        entry: P1FastCore.TrackPoint?,
        braking: P1FastCore.TrackPoint?,
        apex: P1FastCore.TrackPoint?,
        exit: P1FastCore.TrackPoint?
    ) async throws {
        try await queue.write { db in
            guard var row = try TrackSegmentRow.fetchOne(db, key: segmentId) else { return }
            // Usa blob atual como base; se ausente fabrica neutro com x/y=0.
            let base = P1FastCore.SegmentGeometry.decode(row.geometria)
                ?? P1FastCore.SegmentGeometry.Blob(x: 0, y: 0, tipo: P1FastCore.SegmentTipo.curva.rawValue)
            let next = P1FastCore.SegmentGeometry.updateCanonicalPoints(
                in: base, entry: entry, braking: braking, apex: apex, exit: exit
            )
            row.geometria = P1FastCore.SegmentGeometry.encode(next)
            try row.update(db)
        }
        try await reloadAll()
    }

    // MARK: - Seed

    /// Persiste track `trk_brasilia` + layout `lay_brasilia_principal` + 12
    /// segments + marcos (largada/chegada) derivados de SeedBrasilia.make().
    /// Idempotente: cada upsert checa existência por id antes.
    private func seedBrasiliaIfMissing() async throws {
        let bundle = SeedBrasilia.make()
        let layoutId = bundle.layout.id
        let trackId = bundle.track.id

        try await queue.write { db in
            // --- TrackRow ---
            if try TrackRow.fetchOne(db, key: trackId) == nil {
                try TrackRow(
                    id: trackId,
                    apelido: bundle.track.apelido,
                    nomeOficial: bundle.track.nome
                ).insert(db)
            }

            // --- TrackLayoutRow ---
            if try TrackLayoutRow.fetchOne(db, key: layoutId) == nil {
                try TrackLayoutRow(
                    id: layoutId,
                    trackId: trackId,
                    nome: bundle.layout.nome,
                    parciais: Self.encodeParciais(bundle.layout.parciais),
                    svgPath: bundle.track.svgPath,
                    linhaChegada: Self.encodeLinhaChegada(bundle.layout.linhaChegada)
                ).insert(db)
            }

            // --- TrackSegmentRow (12 segments) ---
            for seg in bundle.segments {
                if try TrackSegmentRow.fetchOne(db, key: seg.id) == nil {
                    try TrackSegmentRow(
                        id: seg.id,
                        layoutId: layoutId,
                        parcialId: seg.parcialId,
                        ordem: seg.ordem,
                        ehTrecho: seg.ehTrecho,
                        nome: seg.nome,
                        geometria: Self.encodeGeometria(seg)
                    ).insert(db)
                }
            }

            // --- Marcos (largada + chegada). Posição em "x,y" simples.
            let marcos: [(String, Marco.Tipo, String, String?)] = [
                ("marco_brasilia_largada", .largada, "415,720", "Largada"),
                ("marco_brasilia_chegada", .chegada, "415,695", "Chegada"),
            ]
            for (id, tipo, posicao, label) in marcos {
                if try Marco.fetchOne(db, key: id) == nil {
                    try Marco(
                        id: id,
                        layoutId: layoutId,
                        tipo: tipo,
                        posicao: posicao,
                        label: label
                    ).insert(db)
                }
            }
        }
    }

    // MARK: - Encoders pras colunas TEXT (JSON)

    nonisolated private static let jsonEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    nonisolated private static func encodeParciais(_ parciais: [P1FastCore.Parcial]) -> String? {
        guard !parciais.isEmpty, let data = try? jsonEncoder.encode(parciais) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    nonisolated private static func encodeLinhaChegada(_ linha: P1FastCore.LinhaChegada?) -> String? {
        guard let linha, let data = try? jsonEncoder.encode(linha) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Encode da geometria do segment (delegate p/ `P1FastCore.SegmentGeometry`,
    /// que é puro Swift e tem smoke próprio). Mantido aqui só pra usar
    /// no seedBrasilia.
    nonisolated private static func encodeGeometria(_ seg: P1FastCore.TrackSegment) -> String? {
        P1FastCore.SegmentGeometry.encode(seg)
    }

    // MARK: - Internal types

    private struct Snapshot {
        let tracks: [TrackRow]
        let layouts: [TrackLayoutRow]
        let segments: [TrackSegmentRow]
        let marcos: [Marco]
    }
}
