// ═══════════════════════════════════════════════════════════
// RelatoriosViews — 4 telas dos cards da Home (S3-ajuste 2026-05-12)
// ═══════════════════════════════════════════════════════════
// Substitui a decisão P3 #2.3 (que mandava redirecionar pra Eventos).
// Os 4 cards de estatística da tela inicial agora ganham telas próprias:
//
//   • StintsView      — lista de stints com agrupador (Autódromo / Data / Velocidade)
//   • VoltasView      — lista de voltas válidas, ordenadas por tempo
//   • AutodromosView  — autódromos visitados, cada um expansível
//   • RecordesView    — trechos onde o piloto tem PB (melhor tempo dele)
//
// Junto vem RelatoriosRepository: queries agregadas que NÃO se encaixam
// nos repositórios scoped (Stint, Evento, etc).

import Foundation
import SwiftUI
import GRDB
import P1FastCore

// MARK: - Items de dados (pra UI)

struct StintListaItem: Identifiable, Equatable {
    let id: String
    let dataInicio: Int64?
    let pistaApelido: String?
    let carroApelido: String?
    let pilotoNome: String?
    let voltasCount: Int
    let melhorVoltaMs: Int?
    let vmaxKmh: Double?
    let trackId: String?
}

struct VoltaListaItem: Identifiable, Equatable {
    let id: String
    let numero: Int
    let tempoMs: Int
    let dataInicio: Int64?
    let pistaApelido: String?
    let carroApelido: String?
    let pilotoNome: String?
    let stintId: String
}

struct AutodromoListaItem: Identifiable, Equatable {
    let id: String  // trackId
    let apelido: String
    let cidade: String?
    let nomeOficial: String?
    let eventosCount: Int
    let stintsCount: Int
    let voltasCount: Int
    let kmEstimado: Double
    let vmaxKmh: Double?
    /// SVG path do layout principal (Conceito do Command Box). Nil quando
    /// o layout não foi seedado ainda.
    let svgPath: String?
    /// ViewBox JSON do layout: `{"w":..., "h":...}`. Nil quando ausente.
    let viewBox: String?
}

struct TrechoListaItem: Identifiable, Equatable {
    let id: String  // segmentId
    let nome: String
    let ehTrecho: Bool
}

struct RecordeListaItem: Identifiable, Equatable {
    let id: String  // segmentId
    let segmentNome: String
    let trackApelido: String?
    let tempoMs: Int
    let carroApelido: String?
    let quandoMs: Int64?
}

// MARK: - RelatoriosRepository (queries agregadas)

@MainActor
final class RelatoriosRepository: ObservableObject {
    @Published private(set) var stints: [StintListaItem] = []
    @Published private(set) var voltas: [VoltaListaItem] = []
    @Published private(set) var autodromos: [AutodromoListaItem] = []
    @Published private(set) var recordes: [RecordeListaItem] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func loadStints() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.stints = []
            return
        }
        let rows = try await queue.read { db -> [StintListaItem] in
            let sql = """
                SELECT s.id, s.data_inicio, t.apelido AS pista,
                       c.apelido AS carro, p.nome AS piloto,
                       t.id AS track_id,
                       COUNT(v.id) AS voltas_count,
                       MIN(CASE WHEN v.valida = 1 THEN v.tempo_ms END) AS melhor_ms,
                       MAX(se.velocidade_max) AS vmax
                FROM sessoes s
                LEFT JOIN eventos e ON e.id = s.evento_id
                LEFT JOIN tracks t ON t.id = e.track_id
                LEFT JOIN carros c ON c.id = s.carro_id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                LEFT JOIN voltas v ON v.sessao_id = s.id
                LEFT JOIN segment_executions se ON se.sessao_id = s.id
                WHERE s.time_id = ?
                  AND s.cancelado_em IS NULL
                GROUP BY s.id
                ORDER BY s.data_inicio DESC, s.created_at DESC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [teamId]).map { row in
                StintListaItem(
                    id: row["id"],
                    dataInicio: row["data_inicio"],
                    pistaApelido: row["pista"],
                    carroApelido: row["carro"],
                    pilotoNome: row["piloto"],
                    voltasCount: (row["voltas_count"] as Int?) ?? 0,
                    melhorVoltaMs: row["melhor_ms"],
                    vmaxKmh: row["vmax"],
                    trackId: row["track_id"]
                )
            }
        }
        self.stints = rows
    }

    func loadVoltas() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.voltas = []
            return
        }
        let rows = try await queue.read { db -> [VoltaListaItem] in
            let sql = """
                SELECT v.id, v.numero, v.tempo_ms, v.inicio_at,
                       t.apelido AS pista, c.apelido AS carro,
                       p.nome AS piloto, s.id AS stint_id
                FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                LEFT JOIN eventos e ON e.id = s.evento_id
                LEFT JOIN tracks t ON t.id = e.track_id
                LEFT JOIN carros c ON c.id = s.carro_id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                WHERE v.time_id = ?
                  AND v.valida = 1
                  AND v.tempo_ms IS NOT NULL
                ORDER BY v.tempo_ms ASC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [teamId]).map { row in
                VoltaListaItem(
                    id: row["id"],
                    numero: row["numero"],
                    tempoMs: row["tempo_ms"],
                    dataInicio: row["inicio_at"],
                    pistaApelido: row["pista"],
                    carroApelido: row["carro"],
                    pilotoNome: row["piloto"],
                    stintId: row["stint_id"]
                )
            }
        }
        self.voltas = rows
    }

    func loadAutodromos() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.autodromos = []
            return
        }
        let rows = try await queue.read { db -> [AutodromoListaItem] in
            let sql = """
                SELECT t.id, t.apelido, t.cidade, t.nome_oficial,
                       COUNT(DISTINCT e.id) AS eventos_count,
                       COUNT(DISTINCT s.id) AS stints_count,
                       COUNT(v.id) AS voltas_count,
                       MAX(se.velocidade_max) AS vmax,
                       SUM(((COALESCE(se.vmin_kmh, se.velocidade_max * 0.6) + se.velocidade_max) / 2.0)
                           * (se.tempo_ms / 3600000.0)) AS km_estimado,
                       (SELECT tl.svg_path FROM track_layouts tl WHERE tl.track_id = t.id LIMIT 1) AS svg_path,
                       (SELECT tl.view_box FROM track_layouts tl WHERE tl.track_id = t.id LIMIT 1) AS view_box
                FROM tracks t
                JOIN eventos e ON e.track_id = t.id
                LEFT JOIN sessoes s ON s.evento_id = e.id AND s.cancelado_em IS NULL
                LEFT JOIN voltas v ON v.sessao_id = s.id AND v.valida = 1
                LEFT JOIN segment_executions se ON se.sessao_id = s.id
                WHERE e.time_id = ?
                GROUP BY t.id
                HAVING eventos_count > 0
                ORDER BY eventos_count DESC, t.apelido ASC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [teamId]).map { row in
                AutodromoListaItem(
                    id: row["id"],
                    apelido: row["apelido"],
                    cidade: row["cidade"],
                    nomeOficial: row["nome_oficial"],
                    eventosCount: (row["eventos_count"] as Int?) ?? 0,
                    stintsCount: (row["stints_count"] as Int?) ?? 0,
                    voltasCount: (row["voltas_count"] as Int?) ?? 0,
                    kmEstimado: (row["km_estimado"] as Double?) ?? 0,
                    vmaxKmh: row["vmax"],
                    svgPath: row["svg_path"],
                    viewBox: row["view_box"]
                )
            }
        }
        self.autodromos = rows
    }

    /// Carrega trechos (pedagógicos) de um autódromo pra mostrar quando o
    /// usuário expande o card. Lê via track_segments do primeiro layout.
    func trechosDoAutodromo(trackId: String) async throws -> [TrechoListaItem] {
        try await queue.read { db -> [TrechoListaItem] in
            let sql = """
                SELECT ts.id, ts.nome, ts.eh_trecho
                FROM track_segments ts
                JOIN track_layouts tl ON tl.id = ts.layout_id
                WHERE tl.track_id = ?
                ORDER BY ts.ordem ASC
            """
            return try Row.fetchAll(db, sql: sql, arguments: [trackId]).map { row in
                TrechoListaItem(
                    id: row["id"],
                    nome: (row["nome"] as String?) ?? "Trecho",
                    ehTrecho: (row["eh_trecho"] as Int?) == 1
                )
            }
        }
    }

    func loadRecordes() async throws {
        guard let teamId = TeamContext.currentTeamId else {
            self.recordes = []
            return
        }
        let pilotoId = TeamContext.currentPilotoId
        let rows = try await queue.read { db -> [RecordeListaItem] in
            // Recorde = melhor tempo do piloto em cada (segment_id).
            // Mostra só trechos onde há pelo menos uma execução do piloto.
            let pilotoFiltro = pilotoId != nil ? "AND s.piloto_id = ?" : ""
            var args: [DatabaseValueConvertible] = [teamId]
            if let pid = pilotoId { args.append(pid) }
            let sql = """
                SELECT se.segment_id AS id,
                       MIN(se.tempo_ms) AS tempo_ms,
                       ts.nome AS segment_nome,
                       t.apelido AS pista,
                       c.apelido AS carro,
                       MAX(v.inicio_at) AS quando_ms
                FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                LEFT JOIN voltas v ON v.id = se.volta_id
                LEFT JOIN track_segments ts ON ts.id = se.segment_id
                LEFT JOIN track_layouts tl ON tl.id = ts.layout_id
                LEFT JOIN tracks t ON t.id = tl.track_id
                LEFT JOIN carros c ON c.id = s.carro_id
                WHERE s.time_id = ?
                  AND se.tempo_ms IS NOT NULL
                  AND se.segment_id IS NOT NULL
                  \(pilotoFiltro)
                GROUP BY se.segment_id
                ORDER BY tempo_ms ASC
            """
            return try Row.fetchAll(db, sql: sql, arguments: StatementArguments(args)).map { row in
                RecordeListaItem(
                    id: row["id"] ?? UUID().uuidString,
                    segmentNome: (row["segment_nome"] as String?) ?? "Trecho",
                    trackApelido: row["pista"],
                    tempoMs: row["tempo_ms"],
                    carroApelido: row["carro"],
                    quandoMs: row["quando_ms"]
                )
            }
        }
        self.recordes = rows
    }
}

// MARK: - PathUtils: parse + simplificação + curva suave
// 2026-05-17 (Flávio aprovou opção B): filtragem inteligente para
// remover "tremores" do desenho original sem mudar o formato real
// das curvas. Usado por todos os mapas do app (mapa principal, modal,
// trecho ampliado, Vista Piloto, etc).

enum PathUtils {
    /// Parseia um path SVG no mesmo formato do SeedBrasilia (M, L, Z).
    /// Devolve sub-paths como listas de pontos em coords do MAPA.
    static func parsearSubpaths(_ svgPath: String) -> [[CGPoint]] {
        var subpaths: [[CGPoint]] = [[]]
        var tokens = svgPath.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        var i = 0
        var ultimo: Character = "M"
        while i < tokens.count {
            let t = tokens[i]
            let primeiro = t.first ?? Character("?")
            if "MLZmlz".contains(primeiro) {
                ultimo = primeiro
                if primeiro == "Z" || primeiro == "z" { i += 1; continue }
                let resto = String(t.dropFirst())
                if !resto.isEmpty, let x = Double(resto), i + 1 < tokens.count, let y = Double(tokens[i + 1]) {
                    let p = CGPoint(x: CGFloat(x), y: CGFloat(y))
                    if primeiro == "M" || primeiro == "m" {
                        if !subpaths.last!.isEmpty { subpaths.append([]) }
                        subpaths[subpaths.count - 1].append(p)
                    } else {
                        subpaths[subpaths.count - 1].append(p)
                    }
                    i += 2; continue
                }
                i += 1
            } else if let x = Double(t), i + 1 < tokens.count, let y = Double(tokens[i + 1]) {
                let p = CGPoint(x: CGFloat(x), y: CGFloat(y))
                if ultimo == "M" { ultimo = "L" } else if ultimo == "m" { ultimo = "l" }
                subpaths[subpaths.count - 1].append(p)
                i += 2
            } else {
                i += 1
            }
        }
        return subpaths.filter { !$0.isEmpty }
    }

    /// Douglas-Peucker: remove pontos cuja distância perpendicular
    /// ao segmento dos vizinhos é menor que `epsilon`. Mantém a forma
    /// geral, elimina "tremores" curtos. Epsilon típico: 2.0 unidades
    /// de mapa pra Brasília (viewBox ~ 600×600).
    static func simplificar(_ pontos: [CGPoint], epsilon: CGFloat) -> [CGPoint] {
        guard pontos.count > 2 else { return pontos }
        // Encontra ponto mais distante do segmento [first, last].
        let first = pontos.first!
        let last = pontos.last!
        var maxDist: CGFloat = 0
        var idxMax = 0
        for i in 1..<(pontos.count - 1) {
            let d = distPontoSegmento(pontos[i], a: first, b: last)
            if d > maxDist { maxDist = d; idxMax = i }
        }
        if maxDist > epsilon {
            // Mantém o ponto e recursa nas 2 metades.
            let esquerda = simplificar(Array(pontos[0...idxMax]), epsilon: epsilon)
            let direita = simplificar(Array(pontos[idxMax..<pontos.count]), epsilon: epsilon)
            return esquerda.dropLast() + direita
        } else {
            return [first, last]
        }
    }

    private static func distPontoSegmento(_ p: CGPoint, a: CGPoint, b: CGPoint) -> CGFloat {
        let dx = b.x - a.x; let dy = b.y - a.y
        let len2 = dx * dx + dy * dy
        if len2 < 1e-9 { return hypot(p.x - a.x, p.y - a.y) }
        let t = max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
        let projX = a.x + t * dx; let projY = a.y + t * dy
        return hypot(p.x - projX, p.y - projY)
    }

    /// Adiciona a uma `Path` os subpaths usando curva suave Catmull-Rom
    /// (sem quinas) entre os pontos.
    static func adicionarSuave(em path: inout Path, subpaths: [[CGPoint]],
                                mapToScreen: (CGPoint) -> CGPoint) {
        for sub in subpaths where sub.count >= 2 {
            let pts = sub.map(mapToScreen)
            path.move(to: pts[0])
            let n = pts.count
            for i in 0..<(n - 1) {
                let p0 = i == 0 ? pts[i] : pts[i - 1]
                let p1 = pts[i]
                let p2 = pts[i + 1]
                let p3 = (i + 2 < n) ? pts[i + 2] : pts[i + 1]
                let cp1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6.0,
                                  y: p1.y + (p2.y - p0.y) / 6.0)
                let cp2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6.0,
                                  y: p2.y - (p3.y - p1.y) / 6.0)
                path.addCurve(to: p2, control1: cp1, control2: cp2)
            }
        }
    }
}

// MARK: - Mini-mapa do circuito (Conceito Command Box, S3-ajuste 2)

/// SwiftUI Shape que renderiza o SVG path do layout principal do autódromo
/// dentro do viewBox. Aplica filtragem Douglas-Peucker (remove tremores
/// do desenho original) e desenha com curvas Catmull-Rom suaves.
struct CircuitoShape: Shape {
    let svgPath: String
    let viewBoxW: CGFloat
    let viewBoxH: CGFloat
    /// Limiar de simplificação. 0 = desabilita.
    /// 2026-05-17 (Flavio): padrão mudado de 1.5 para 0. O desenho v2 da
    /// Brasília vem com 425 pontos arrumados manualmente pelo Flavio; o
    /// filtro Douglas-Peucker descartava os ajustes finos. Quem precisar
    /// simplificar pra desenhos de outras pistas pode setar explicitamente.
    var epsilon: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let scaleX = rect.width / viewBoxW
        let scaleY = rect.height / viewBoxH
        let scale = min(scaleX, scaleY)
        let offsetX = (rect.width - viewBoxW * scale) / 2.0
        let offsetY = (rect.height - viewBoxH * scale) / 2.0
        let mapToScreen: (CGPoint) -> CGPoint = { p in
            CGPoint(x: offsetX + p.x * scale, y: offsetY + p.y * scale)
        }
        let subpaths = PathUtils.parsearSubpaths(svgPath)
        let simplificados: [[CGPoint]] = epsilon > 0
            ? subpaths.map { PathUtils.simplificar($0, epsilon: epsilon) }
            : subpaths
        PathUtils.adicionarSuave(em: &path, subpaths: simplificados, mapToScreen: mapToScreen)
        return path
    }
}

/// Wrapper visual: quadrado com fundo preto (igual ao Command Box) +
/// path do circuito em traço claro. Usado no card de autódromo no lugar
/// do círculo decorativo.
struct CircuitoMiniMapa: View {
    let svgPath: String?
    let viewBox: String?
    var size: CGFloat = 56

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.85))
            if let path = svgPath, let dims = parseViewBox(viewBox) {
                CircuitoShape(svgPath: path, viewBoxW: dims.w, viewBoxH: dims.h)
                    .stroke(Color.accent.opacity(0.85), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                    .padding(6)
            } else {
                Image(systemName: "map")
                    .font(.system(size: 18, weight: .light))
                    .foregroundStyle(Color.textFaint)
            }
        }
        .frame(width: size, height: size)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func parseViewBox(_ json: String?) -> (w: CGFloat, h: CGFloat)? {
        guard let json = json, let data = json.data(using: .utf8) else { return nil }
        struct V: Decodable { let w: Double; let h: Double }
        if let v = try? JSONDecoder().decode(V.self, from: data) {
            return (CGFloat(v.w), CGFloat(v.h))
        }
        return nil
    }
}

// MARK: - Tela: Stints

enum StintsAgrupador: String, CaseIterable, Identifiable {
    case data, autodromo, velocidade
    var id: String { rawValue }
    var rotulo: String {
        switch self {
        case .data: return "Data"
        case .autodromo: return "Autódromo"
        case .velocidade: return "Velocidade"
        }
    }
}

struct StintsView: View {
    @EnvironmentObject private var repo: RelatoriosRepository
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var voltaVideoRepo: VoltaVideoRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var eventoRepo: EventoRepository
    @EnvironmentObject private var setupReplicadoRepo: EventoSetupReplicadoRepository
    let onClose: () -> Void

    @State private var agrupador: StintsAgrupador = .data
    @State private var carregando = true
    @State private var stintAbertoId: String?

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
        .sheet(isPresented: Binding(
            get: { stintAbertoId != nil },
            set: { if !$0 { stintAbertoId = nil } }
        )) {
            if let sid = stintAbertoId,
               let item = repo.stints.first(where: { $0.id == sid }) {
                NavigationStack {
                    PosStintView(
                        stintId: sid,
                        contextoLinha: contextoStint(item),
                        onClose: { stintAbertoId = nil }
                    )
                    .environmentObject(stintRepo)
                    .environmentObject(voltaVideoRepo)
                    .environmentObject(carroRepo)
                    .environmentObject(eventoRepo)
                    .environmentObject(setupReplicadoRepo)
                }
            }
        }
    }

    private func contextoStint(_ item: StintListaItem) -> String {
        let pista = item.pistaApelido ?? "—"
        guard let ms = item.dataInicio else { return pista }
        return "\(pista) · \(formatDataCurta(ms: ms))"
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // 2026-05-16 Flávio: topbar customizado removido — setinha de
            // voltar agora vem do sistema (NavigationStack), sempre no
            // topo à esquerda.
            cabecalho
            picker
            if carregando {
                Text("Carregando…")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.top, Spacing.md)
            } else if repo.stints.isEmpty {
                Text("Nenhum stint finalizado ainda.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.top, Spacing.md)
            } else {
                lista
            }
        }
    }

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Voltar")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Stints")
            Text("Todos os seus stints")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
            Text("\(repo.stints.count) stint\(repo.stints.count == 1 ? "" : "s") finalizados no time. Agrupe pela informação que quiser.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    private var picker: some View {
        HStack(spacing: 6) {
            ForEach(StintsAgrupador.allCases) { ag in
                Button(action: { agrupador = ag }) {
                    Text(ag.rotulo)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(agrupador == ag ? Color.text : Color.textMuted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 999, style: .continuous)
                                .fill(agrupador == ag ? Color.accentDim.opacity(0.20) : Color.surfaceRaised)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 999, style: .continuous)
                                .stroke(agrupador == ag ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }

    private var lista: some View {
        VStack(spacing: 14) {
            ForEach(grupos, id: \.titulo) { grupo in
                VStack(alignment: .leading, spacing: 8) {
                    Text(grupo.titulo.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.8)
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 4)
                    VStack(spacing: 6) {
                        ForEach(grupo.stints) { stint in
                            stintCard(stint)
                        }
                    }
                }
            }
        }
    }

    private struct Grupo {
        let titulo: String
        let stints: [StintListaItem]
    }

    private var grupos: [Grupo] {
        switch agrupador {
        case .data:
            return Dictionary(grouping: repo.stints) { item -> String in
                guard let ms = item.dataInicio else { return "Sem data" }
                return formatDataLargaMes(ms: ms)
            }.map { Grupo(titulo: $0.key, stints: $0.value) }
                .sorted { a, b in
                    (a.stints.first?.dataInicio ?? 0) > (b.stints.first?.dataInicio ?? 0)
                }
        case .autodromo:
            return Dictionary(grouping: repo.stints) { $0.pistaApelido ?? "Sem autódromo" }
                .map { Grupo(titulo: $0.key, stints: $0.value) }
                .sorted { $0.titulo < $1.titulo }
        case .velocidade:
            // Faixas: 0-100, 100-150, 150-200, 200+
            let faixas: [(String, (Double) -> Bool)] = [
                ("200 km/h ou mais", { $0 >= 200 }),
                ("150 a 200 km/h",   { $0 >= 150 && $0 < 200 }),
                ("100 a 150 km/h",   { $0 >= 100 && $0 < 150 }),
                ("Abaixo de 100 km/h", { $0 < 100 }),
                ("Sem velocidade medida", { _ in false }),
            ]
            var result: [Grupo] = []
            for (titulo, pred) in faixas {
                let items = repo.stints.filter { item in
                    if titulo == "Sem velocidade medida" { return item.vmaxKmh == nil }
                    guard let v = item.vmaxKmh else { return false }
                    return pred(v)
                }
                if !items.isEmpty {
                    result.append(Grupo(titulo: titulo, stints: items))
                }
            }
            return result
        }
    }

    private func stintCard(_ stint: StintListaItem) -> some View {
        Button(action: { stintAbertoId = stint.id }) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(stint.pistaApelido ?? "Sem pista")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Spacer()
                    if let ms = stint.dataInicio {
                        Text(formatDataCurta(ms: ms))
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                    Text("›")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                        .padding(.leading, 4)
                }
                HStack(spacing: 14) {
                    infoPar(rotulo: "Carro", valor: stint.carroApelido ?? "—")
                    infoPar(rotulo: "Voltas", valor: "\(stint.voltasCount)")
                    if let m = stint.melhorVoltaMs {
                        infoPar(rotulo: "Melhor", valor: formatTempoMs(m), ouro: true)
                    }
                    if let v = stint.vmaxKmh, v > 0 {
                        infoPar(rotulo: "Vel. máx", valor: "\(Int(v.rounded())) km/h")
                    }
                    Spacer(minLength: 0)
                }
                if let piloto = stint.pilotoNome, !piloto.isEmpty {
                    Text("Piloto: \(piloto)")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func carregar() async {
        do { try await repo.loadStints() }
        catch { print("StintsView.carregar erro: \(error)") }
        carregando = false
    }
}

// MARK: - Tela: Voltas

struct VoltasView: View {
    @EnvironmentObject private var repo: RelatoriosRepository
    let onClose: () -> Void
    @State private var carregando = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    // 2026-05-16 Flávio: setinha de voltar agora vem do sistema.
                    cabecalho
                    if carregando {
                        Text("Carregando…")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                            .padding(.top, Spacing.md)
                    } else if repo.voltas.isEmpty {
                        Text("Nenhuma volta válida registrada ainda.")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    } else {
                        VStack(spacing: 6) {
                            ForEach(repo.voltas) { v in
                                voltaLinha(v)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Voltar")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Voltas")
            Text("Todas as suas voltas")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
            Text("\(repo.voltas.count) volta\(repo.voltas.count == 1 ? "" : "s") válida\(repo.voltas.count == 1 ? "" : "s") registrada\(repo.voltas.count == 1 ? "" : "s"). Ordenadas por tempo — a melhor no topo.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    private func voltaLinha(_ v: VoltaListaItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(formatTempoMs(v.tempoMs))
                        .font(.system(size: 16, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.ouro)
                    Text("#\(v.numero)")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
                Text("\(v.pistaApelido ?? "—") · \(v.carroApelido ?? "—")")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                if let ms = v.dataInicio {
                    Text(formatDataCurta(ms: ms))
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func carregar() async {
        do { try await repo.loadVoltas() }
        catch { print("VoltasView.carregar erro: \(error)") }
        carregando = false
    }
}

// MARK: - Tela: Autódromos

struct AutodromosView: View {
    @EnvironmentObject private var repo: RelatoriosRepository
    let onClose: () -> Void
    @State private var carregando = true
    @State private var expandidos: Set<String> = []
    @State private var trechosPorAutodromo: [String: [TrechoListaItem]] = [:]

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    // 2026-05-16 Flávio: setinha de voltar agora vem do sistema.
                    cabecalho
                    if carregando {
                        Text("Carregando…")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                            .padding(.top, Spacing.md)
                    } else if repo.autodromos.isEmpty {
                        Text("Nenhum autódromo visitado ainda. Cadastre um evento pra começar.")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(repo.autodromos) { a in
                                autodromoCard(a)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Voltar")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Autódromos")
            Text("Autódromos onde você já correu")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
            Text("Toque em qualquer um pra ver os detalhes: eventos lá, stints, voltas, quilometragem e velocidade máxima.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    private func autodromoCard(_ a: AutodromoListaItem) -> some View {
        let estaExpandido = expandidos.contains(a.id)
        return VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                if estaExpandido {
                    expandidos.remove(a.id)
                } else {
                    expandidos.insert(a.id)
                    Task { await carregarTrechos(trackId: a.id) }
                }
            }) {
                HStack(alignment: .center, spacing: 12) {
                    // Mini-mapa do circuito (Conceito Command Box) — substitui
                    // o círculo decorativo, semelhante ao card do carro.
                    CircuitoMiniMapa(svgPath: a.svgPath, viewBox: a.viewBox, size: 56)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(a.apelido)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.text)
                        if let cidade = a.cidade?.trimmingCharacters(in: .whitespaces), !cidade.isEmpty {
                            Text(cidade)
                                .font(.system(size: 11, weight: .regular))
                                .foregroundStyle(Color.textMuted)
                        }
                        Text("\(a.eventosCount) evento\(a.eventosCount == 1 ? "" : "s")")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.accent)
                    }
                    Spacer()
                    Text(estaExpandido ? "˅" : "›")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if estaExpandido {
                VStack(alignment: .leading, spacing: 6) {
                    Divider().overlay(Color.border)
                    if let oficial = a.nomeOficial {
                        Text(oficial)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                    }
                    detalheLinha(rotulo: "Eventos", valor: "\(a.eventosCount)")
                    detalheLinha(rotulo: "Stints", valor: "\(a.stintsCount)")
                    detalheLinha(rotulo: "Voltas válidas", valor: "\(a.voltasCount)")
                    detalheLinha(rotulo: "Km rodada (estimada)", valor: a.kmEstimado > 0 ? String(format: "%.0f km", a.kmEstimado) : "—")
                    detalheLinha(rotulo: "Vel. máxima", valor: a.vmaxKmh.map { String(format: "%.0f km/h", $0) } ?? "—")
                    // S3-ajuste 3: lista de trechos do autódromo. Mostra
                    // só os pedagógicos (eh_trecho=1). Retas aparecem
                    // intercaladas conforme a ordem do layout.
                    let trechos = trechosPorAutodromo[a.id] ?? []
                    if !trechos.isEmpty {
                        Text("TRECHOS DA PISTA")
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(Color.textFaint)
                            .padding(.top, 8)
                        VStack(spacing: 4) {
                            ForEach(trechos) { t in
                                HStack(spacing: 8) {
                                    Image(systemName: t.ehTrecho ? "circle.fill" : "minus")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(t.ehTrecho ? Color.accent : Color.textFaint)
                                    Text(t.nome)
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(t.ehTrecho ? Color.text : Color.textMuted)
                                    Spacer(minLength: 0)
                                }
                                .padding(.vertical, 3)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, 12)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(estaExpandido ? Color.accentDim.opacity(0.08) : Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(estaExpandido ? Color.accent.opacity(0.45) : Color.border, lineWidth: 1)
        )
    }

    private func carregarTrechos(trackId: String) async {
        guard trechosPorAutodromo[trackId] == nil else { return }
        do {
            trechosPorAutodromo[trackId] = try await repo.trechosDoAutodromo(trackId: trackId)
        } catch {
            print("AutodromosView.carregarTrechos erro: \(error)")
        }
    }

    private func detalheLinha(rotulo: String, valor: String) -> some View {
        HStack {
            Text(rotulo)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.textMuted)
            Spacer()
            Text(valor)
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(valor == "—" ? Color.textFaint : Color.text)
        }
    }

    private func carregar() async {
        do { try await repo.loadAutodromos() }
        catch { print("AutodromosView.carregar erro: \(error)") }
        carregando = false
    }
}

// MARK: - Tela: Recordes

struct RecordesView: View {
    @EnvironmentObject private var repo: RelatoriosRepository
    let onClose: () -> Void
    @State private var carregando = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    // 2026-05-16 Flávio: setinha de voltar agora vem do sistema.
                    cabecalho
                    if carregando {
                        Text("Carregando…")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                            .padding(.top, Spacing.md)
                    } else if repo.recordes.isEmpty {
                        Text("Nenhum recorde de trecho registrado ainda. Os recordes aparecem quando você tem o melhor tempo do piloto em um trecho da pista.")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    } else {
                        VStack(spacing: 6) {
                            ForEach(repo.recordes) { r in
                                recordeLinha(r)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Voltar")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Recordes")
            Text("Seus melhores tempos por trecho")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
            Text("\(repo.recordes.count) trecho\(repo.recordes.count == 1 ? "" : "s") onde você tem o melhor tempo. Recorde absoluto da pista entre todos os pilotos chega em sprint futura.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    private func recordeLinha(_ r: RecordeListaItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(r.segmentNome)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("\(r.trackApelido ?? "—") · \(r.carroApelido ?? "—")")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 3) {
                Text(formatTempoMs(r.tempoMs))
                    .font(.system(size: 16, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.ouro)
                if let ms = r.quandoMs {
                    Text(formatDataCurta(ms: ms))
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func carregar() async {
        do { try await repo.loadRecordes() }
        catch { print("RecordesView.carregar erro: \(error)") }
        carregando = false
    }
}

// MARK: - Helpers (compartilhados)

private func infoPar(rotulo: String, valor: String, ouro: Bool = false) -> some View {
    VStack(alignment: .leading, spacing: 2) {
        Text(valor)
            .font(.system(size: 13, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(ouro ? Color.ouro : Color.text)
        Text(rotulo.uppercased())
            .font(.system(size: 9, weight: .medium))
            .tracking(0.6)
            .foregroundStyle(Color.textFaint)
    }
}

private func formatDataLargaMes(ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "MMMM 'de' yyyy"
    return f.string(from: date).capitalized
}

/// "dd/MM/yy" — versão livre (a do EventoDetalheView é privada).
private func formatDataCurta(ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "dd/MM/yy"
    return f.string(from: date)
}
