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
        apexes: [P1FastCore.TrackPoint],
        exit: P1FastCore.TrackPoint?,
        markCalibrated: Bool = false
    ) async throws {
        try await queue.write { db in
            guard var row = try TrackSegmentRow.fetchOne(db, key: segmentId) else { return }
            // Usa blob atual como base; se ausente fabrica neutro com x/y=0.
            let base = P1FastCore.SegmentGeometry.decode(row.geometria)
                ?? P1FastCore.SegmentGeometry.Blob(x: 0, y: 0, tipo: P1FastCore.SegmentTipo.curva.rawValue)
            let next = P1FastCore.SegmentGeometry.updateCanonicalPoints(
                in: base, entry: entry, braking: braking, apexes: apexes, exit: exit,
                markCalibrated: markCalibrated
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
            // MS-2.6.c: backfill de geo_ancoras pra rows pré-existentes
            // (TrackRow `trk_brasilia` já é seedado pelo EventoRepository sem
            // geo_ancoras). Sempre que a coluna estiver nil, preenche.
            let geoAncorasJson = Self.encodeGeoAncoras(bundle.track.geoAncoras)
            if let existing = try TrackRow.fetchOne(db, key: trackId) {
                if existing.geoAncoras == nil, geoAncorasJson != nil {
                    var row = existing
                    row.geoAncoras = geoAncorasJson
                    try row.update(db)
                }
            } else {
                try TrackRow(
                    id: trackId,
                    apelido: bundle.track.apelido,
                    nomeOficial: bundle.track.nome,
                    geoAncoras: geoAncorasJson
                ).insert(db)
            }

            // --- TrackLayoutRow ---
            // MS-2.6.c: idem, view_box backfill se ausente.
            let viewBoxJson = Self.encodeViewBox(bundle.track.viewBox)
            if let existing = try TrackLayoutRow.fetchOne(db, key: layoutId) {
                if existing.viewBox == nil, viewBoxJson != nil {
                    var row = existing
                    row.viewBox = viewBoxJson
                    try row.update(db)
                }
            } else {
                try TrackLayoutRow(
                    id: layoutId,
                    trackId: trackId,
                    nome: bundle.layout.nome,
                    parciais: Self.encodeParciais(bundle.layout.parciais),
                    svgPath: bundle.track.svgPath,
                    linhaChegada: Self.encodeLinhaChegada(bundle.layout.linhaChegada),
                    viewBox: viewBoxJson
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

    nonisolated static func encodeGeoAncoras(_ ancoras: [P1FastCore.GeoAncora]) -> String? {
        guard !ancoras.isEmpty, let data = try? jsonEncoder.encode(ancoras) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    nonisolated static func decodeGeoAncoras(_ s: String?) -> [P1FastCore.GeoAncora] {
        guard let s, let data = s.data(using: .utf8),
              let arr = try? JSONDecoder().decode([P1FastCore.GeoAncora].self, from: data) else { return [] }
        return arr
    }

    nonisolated static func encodeViewBox(_ vb: P1FastCore.ViewBox?) -> String? {
        guard let vb, let data = try? jsonEncoder.encode(vb) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    nonisolated static func decodeViewBox(_ s: String?) -> P1FastCore.ViewBox? {
        guard let s, let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(P1FastCore.ViewBox.self, from: data)
    }

    nonisolated static func decodeLinhaChegada(_ s: String?) -> P1FastCore.LinhaChegada? {
        guard let s, let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(P1FastCore.LinhaChegada.self, from: data)
    }

    nonisolated static func decodeParciais(_ s: String?) -> [P1FastCore.Parcial] {
        guard let s, let data = s.data(using: .utf8),
              let arr = try? JSONDecoder().decode([P1FastCore.Parcial].self, from: data) else { return [] }
        return arr
    }

    /// Encode da geometria do segment (delegate p/ `P1FastCore.SegmentGeometry`,
    /// que é puro Swift e tem smoke próprio). Mantido aqui só pra usar
    /// no seedBrasilia.
    nonisolated private static func encodeGeometria(_ seg: P1FastCore.TrackSegment) -> String? {
        P1FastCore.SegmentGeometry.encode(seg)
    }

    // MARK: - currentTrack (MS-2.6.c)

    /// Hidrata Track + TrackLayout + [TrackSegment] do GRDB no formato que
    /// o caller esperava de `SeedBrasilia.make()`. Pré-condição: `bootstrap`
    /// rodou (caches publicados). Default = primeira pista por ordem
    /// alfabética; em multi-track futuro, parameter passa a aceitar trackId.
    ///
    /// Retorna nil se nenhuma pista estiver carregada — caller decide
    /// fallback (ex.: TelemetriaView pode segurar SeedBrasilia.make() como
    /// safety net até multi-track entrar).
    func currentTrack() -> (track: P1FastCore.Track, layout: P1FastCore.TrackLayout, segments: [P1FastCore.TrackSegment])? {
        guard let row = tracks.first else { return nil }
        let layouts = layoutsByTrack[row.id] ?? []
        guard let layoutRow = layouts.first else { return nil }
        let segs = segments(forLayoutId: layoutRow.id).compactMap { Self.hydrateSegment($0) }

        let parciais = Self.decodeParciais(layoutRow.parciais)
        let linhaChegada = Self.decodeLinhaChegada(layoutRow.linhaChegada)
        let viewBox = Self.decodeViewBox(layoutRow.viewBox)
        let geoAncoras = Self.decodeGeoAncoras(row.geoAncoras)

        let track = P1FastCore.Track(
            id: row.id,
            nome: row.nomeOficial ?? row.apelido,
            apelido: row.apelido,
            pais: "BR",
            cidade: nil,
            extensaoMetros: nil,
            numeroCurvas: nil,
            sentido: nil,
            imagemFundo: nil,
            viewBox: viewBox,
            svgPath: layoutRow.svgPath,
            linhaChegada: linhaChegada,
            geoAncoras: geoAncoras,
            lapRefSeg: nil
        )
        let layout = P1FastCore.TrackLayout(
            id: layoutRow.id,
            trackId: layoutRow.trackId,
            nome: layoutRow.nome,
            linhaChegada: linhaChegada,
            parciais: parciais
        )
        return (track, layout, segs)
    }

    /// Decodifica um TrackSegmentRow → TrackSegment de domínio reaproveitando
    /// o blob de geometria (que carrega tipo, x/y, apex etc). Campos não
    /// presentes na geometria são default neutros — Detector/UI tratam.
    /// `pathStart`/`pathEnd` ficam nil — não estão no blob hoje.
    nonisolated private static func hydrateSegment(_ row: TrackSegmentRow) -> P1FastCore.TrackSegment? {
        let blob = P1FastCore.SegmentGeometry.decode(row.geometria)
            ?? P1FastCore.SegmentGeometry.Blob(x: 0, y: 0, tipo: P1FastCore.SegmentTipo.curva.rawValue)
        let tipo = P1FastCore.SegmentTipo(rawValue: blob.tipo) ?? .curva
        let apexRefDomain: P1FastCore.ApexReference? = blob.apexReference.map {
            P1FastCore.ApexReference(x: $0.x, y: $0.y)
        }
        return P1FastCore.TrackSegment(
            id: row.id,
            layoutId: row.layoutId,
            ordem: row.ordem,
            nome: row.nome ?? "",
            tipo: tipo,
            ehTrecho: row.ehTrecho,
            parcialId: row.parcialId ?? "",
            x: blob.x,
            y: blob.y,
            tNaVolta: blob.tNaVolta,
            apexReference: apexRefDomain,
            apexStrategy: blob.apexStrategy.flatMap(P1FastCore.ApexStrategy.init(rawValue:)),
            cornerType: blob.cornerType.flatMap(P1FastCore.CornerType.init(rawValue:)),
            nextStraightLength: blob.nextStraightLength,
            apexCalibration: blob.apexCalibration,
            entryPoint: blob.entryPoint,
            brakingPoint: blob.brakingPoint,
            exitPoint: blob.exitPoint,
            pathStart: nil,
            pathEnd: nil
        )
    }

    // MARK: - Internal types

    private struct Snapshot {
        let tracks: [TrackRow]
        let layouts: [TrackLayoutRow]
        let segments: [TrackSegmentRow]
        let marcos: [Marco]
    }
}
