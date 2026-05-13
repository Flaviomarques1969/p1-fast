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
                           * (se.tempo_ms / 3600000.0)) AS km_estimado
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
                    vmaxKmh: row["vmax"]
                )
            }
        }
        self.autodromos = rows
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
    let onClose: () -> Void

    @State private var agrupador: StintsAgrupador = .data
    @State private var carregando = true

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
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            topbar
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
                    topbar
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
                .padding(.bottom, 40)
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

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    topbar
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
                .padding(.bottom, 40)
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
                if estaExpandido { expandidos.remove(a.id) } else { expandidos.insert(a.id) }
            }) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(a.apelido)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.text)
                        if let cidade = a.cidade?.trimmingCharacters(in: .whitespaces), !cidade.isEmpty {
                            Text(cidade)
                                .font(.system(size: 11, weight: .regular))
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                    Spacer()
                    Text("\(a.eventosCount) evento\(a.eventosCount == 1 ? "" : "s")")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.accent)
                    Text(estaExpandido ? "˅" : "›")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                        .padding(.leading, 8)
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
                    topbar
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
                .padding(.bottom, 40)
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
