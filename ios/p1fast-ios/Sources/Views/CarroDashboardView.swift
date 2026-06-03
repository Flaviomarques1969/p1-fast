// ═══════════════════════════════════════════════════════════
// CarroDashboardView — painel de atividade do carro
// ═══════════════════════════════════════════════════════════
// 2026-05-16 — Flávio quer que tocar num carro (na Home ou na
// Garagem) ABRA o conteúdo do carro, não a tela de edição.
// Aqui mostramos: km estimado, autódromos visitados, voltas total,
// melhor volta, pilotos que pilotaram e configuração mais usada.
//
// Editar o cadastro do carro continua possível — botão "Editar
// carro" na base empurra CarroModalView dentro da NavigationStack.

import SwiftUI
import P1FastCore
import GRDB

struct CarroDashboardView: View {
    @EnvironmentObject private var repo: CarroRepository
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository
    let carroId: String
    let onClose: () -> Void

    @EnvironmentObject private var navCoordinator: NavigationCoordinator
    @State private var carro: Carro? = nil
    @State private var dashboard: CarroDashboardData? = nil
    @State private var fotoLocal: UIImage? = nil
    @State private var carregando = true
    @State private var mostrarConfiguracoes = false

    @EnvironmentObject private var manutencaoRepo: ManutencaoRepository

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140) // espaço pro menu de baixo (root)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(carro?.apelido ?? "Carro")
        .task(id: carroId) { await carregar() }
        .onChange(of: mostrarConfiguracoes) { _, novo in
            // 2026-05-17 Flávio "menu inferior sempre visível":
            // antes abria sheet — agora empurra pelo NavigationStack pai
            // pra o menu de baixo continuar aparecendo dentro da tela.
            if novo {
                navCoordinator.push(.configuracoesCarro(carroId: carroId))
                mostrarConfiguracoes = false
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // Conteúdo
    // ──────────────────────────────────────────────────────────
    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            cabecalho
            numerosTopo
            secaoEngenharia
            secaoConfiguracoes
            secaoManutencao
            secaoMelhorVolta
            secaoPilotos
            secaoAutodromos
            secaoConfig
        }
    }

    // ── Engenharia / IA (Bloco 6 do plano Piloto + Engenheiro, 2026-05-18)
    /// Atalhos pras telas novas de Debrief e Evolução. Sem T4000 ativo,
    /// ambas mostram dados de exemplo — quando o T4000 entrar, populam
    /// com o stint real.
    private var secaoEngenharia: some View {
        secao(titulo: "Engenharia / IA") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Debrief do último stint + linha do tempo da sua evolução por trecho. Até o T4000 entrar, mostram um stint sintético pra você conhecer a tela.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
                HStack(spacing: 8) {
                    Button {
                        navCoordinator.push(.debriefStint(carroId: carroId))
                    } label: {
                        Text("Debrief do stint")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.onAccent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color.accent)
                            )
                    }
                    .buttonStyle(.plain)
                    Button {
                        navCoordinator.push(.evolucaoCarro(carroId: carroId))
                    } label: {
                        Text("Sua evolução")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.text)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Color.text.opacity(0.30), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // ── Manutenção (2026-05-18 — função "go" autônoma noturna) ──
    /// Resumo da manutenção do carro com botão pra abrir a aba completa
    /// (histórico + especificação padrão). Mostra contagem de trocas
    /// registradas. Quando vazio, convida o gestor a registrar a 1ª.
    private var secaoManutencao: some View {
        let trocas = manutencaoRepo.manutencoes(doCarro: carroId).count
        return secao(titulo: "Manutenção") {
            VStack(alignment: .leading, spacing: 10) {
                if trocas == 0 {
                    Text("Nenhuma troca registrada ainda. Abra a função pra registrar a 1ª manutenção e começar a aprender quanto cada item dura.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                } else {
                    Text("\(trocas) troca\(trocas == 1 ? "" : "s") registrada\(trocas == 1 ? "" : "s")")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.text)
                }
                Button {
                    navCoordinator.push(.manutencaoCarro(carroId: carroId))
                } label: {
                    Text("Abrir manutenção")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.onAccent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.accent)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Carro")
            HStack(alignment: .center, spacing: 16) {
                avatar
                VStack(alignment: .leading, spacing: 4) {
                    Text(carro?.apelido ?? "—")
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(Color.text)
                        .lineLimit(2)
                    Text(modeloCategoria)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var avatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(corDoCarro)
            if let local = fotoLocal {
                Image(uiImage: local).resizable().scaledToFill()
            } else if let url = repo.fotoPublicURL(carro?.fotoUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty: ProgressView().tint(Color.textFaint)
                    case .success(let img): img.resizable().scaledToFill()
                    case .failure: EmptyView()
                    @unknown default: EmptyView()
                    }
                }
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private var corDoCarro: Color {
        Color(hex: carro?.cor ?? "") ?? Color.surfaceRaised
    }

    private var modeloCategoria: String {
        let parts = [carro?.modelo, carro?.categoria].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "—" : parts.joined(separator: " · ")
    }

    private var numerosTopo: some View {
        VStack(spacing: Spacing.sm) {
            SummaryStats([
                StatItem(value: kmText, label: "Km estimado"),
                StatItem(value: "\(dashboard?.voltasTotal ?? 0)", label: "Voltas"),
                StatItem(value: "\(dashboard?.autodromosCount ?? 0)", label: "Autódromos")
            ], columns: 3)
            SummaryStats([
                StatItem(value: vmaxText, label: "Vmax (km/h)"),
                StatItem(value: "\(dashboard?.stintsTotal ?? 0)", label: "Stints"),
                StatItem(value: "\(dashboard?.pilotos.count ?? 0)", label: "Pilotos")
            ], columns: 3)
        }
    }

    private var kmText: String {
        guard let km = dashboard?.kmRodada, km > 0 else { return "—" }
        if km >= 1000 {
            return String(format: "%.1fk", km / 1000)
        }
        return String(format: "%.0f", km)
    }

    private var vmaxText: String {
        guard let v = dashboard?.vmaxKmh, v > 0 else { return "—" }
        return String(format: "%.0f", v)
    }

    // ── Melhor volta ─────────────────────────────────────────
    private var secaoMelhorVolta: some View {
        secao(titulo: "Melhor volta") {
            if let mv = dashboard?.melhorVolta {
                VStack(alignment: .leading, spacing: 6) {
                    Text(Self.formatarTempoVolta(ms: mv.tempoMs))
                        .font(.system(size: 28, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.accent)
                    Text(subtituloMelhorVolta(mv))
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                }
            } else {
                Text(carregando ? "Carregando…" : "Sem voltas válidas registradas pra esse carro ainda.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    private func subtituloMelhorVolta(_ mv: MelhorVolta) -> String {
        var parts: [String] = []
        if let t = mv.trackNome { parts.append(t) }
        if let p = mv.pilotoNome { parts.append(p) }
        if let d = mv.dataMs { parts.append(Self.dataCurta(ms: d)) }
        return parts.joined(separator: " · ")
    }

    // ── Pilotos ──────────────────────────────────────────────
    private var secaoPilotos: some View {
        secao(titulo: "Pilotos que pilotaram") {
            if let lista = dashboard?.pilotos, !lista.isEmpty {
                VStack(spacing: 6) {
                    ForEach(lista, id: \.id) { p in
                        linhaUso(nome: p.nome, complemento: "\(p.stints) stint" + (p.stints == 1 ? "" : "s"))
                    }
                }
            } else {
                Text(carregando ? "Carregando…" : "Nenhum piloto rodou esse carro ainda.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    // ── Autódromos ───────────────────────────────────────────
    private var secaoAutodromos: some View {
        secao(titulo: "Autódromos visitados") {
            if let lista = dashboard?.autodromos, !lista.isEmpty {
                VStack(spacing: 6) {
                    ForEach(lista, id: \.id) { a in
                        let extra = a.ultimoUsoMs.map { "último: \(Self.dataCurta(ms: $0))" } ?? "—"
                        linhaUso(nome: a.nome, complemento: extra)
                    }
                }
            } else {
                Text(carregando ? "Carregando…" : "Esse carro ainda não foi a nenhum autódromo.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    // ── Configurações cadastradas (Onda 1 Autódromos 2026-05-17) ──
    /// Resumo das configurações do carro (motor/pneus/aero etc.). Botão
    /// "Gerenciar" abre a lista completa pra criar / ativar / editar.
    private var secaoConfiguracoes: some View {
        let cfgs = configuracaoRepo.paraCarro(carroId)
        let ativa = configuracaoRepo.ativaDoCarro(carroId)
        return secao(titulo: "Configurações") {
            VStack(alignment: .leading, spacing: 10) {
                if cfgs.isEmpty {
                    Text("Sem configuração cadastrada. Toque em 'Gerenciar' pra adicionar a primeira (motor, pneus, câmbio, aero).")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                } else {
                    if let ativa {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(ativa.nome?.isEmpty == false ? ativa.nome! : ativa.resumoLegivel)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.text)
                                EventTag(text: "Atual", kind: .accent)
                            }
                            Text(detalhesConfig(ativa))
                                .font(.system(size: 12))
                                .foregroundStyle(Color.textMuted)
                        }
                    } else {
                        Text("Nenhuma configuração marcada como atual. Toque em 'Gerenciar' e selecione qual está valendo agora.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textMuted)
                    }
                    Text("\(cfgs.count) cadastrada\(cfgs.count == 1 ? "" : "s")")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(0.4)
                        .foregroundStyle(Color.textFaint)

                    // Setup técnico (Bloco 1 do plano Piloto + Engenheiro, 2026-05-18).
                    // Aparece quando há configuração ativa. Indica se o setup
                    // técnico (relações + raio + massa) está completo.
                    if let ativaCfg = ativa {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(ativaCfg.temSetupTecnicoBasico ? Color.green : Color.atencao)
                                .frame(width: 8, height: 8)
                            Text(ativaCfg.temSetupTecnicoBasico
                                 ? "Setup técnico cadastrado"
                                 : "Setup técnico incompleto — toque pra cadastrar")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.textMuted)
                        }
                        .padding(.top, 4)
                    }
                }
                HStack(spacing: 8) {
                    Button {
                        mostrarConfiguracoes = true
                    } label: {
                        Text("Gerenciar")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.onAccent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color.accent)
                            )
                    }
                    .buttonStyle(.plain)

                    if ativa != nil {
                        Button {
                            navCoordinator.push(.setupTecnicoCarro(carroId: carroId))
                        } label: {
                            Text("Setup técnico")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.text)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 9)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(Color.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func detalhesConfig(_ cfg: Configuracao) -> String {
        var partes: [String] = []
        if let m = cfg.motor, !m.isEmpty { partes.append(m) }
        if let tipo = cfg.tipoPneuEnum {
            if let medida = cfg.pneusMedida, !medida.isEmpty {
                partes.append("\(tipo.legivel) · \(medida)")
            } else {
                partes.append(tipo.legivel)
            }
        }
        if let c = cfg.cambio, !c.isEmpty { partes.append(c) }
        for a in cfg.aeroAtivos { partes.append(a) }
        return partes.isEmpty ? "Sem detalhes" : partes.joined(separator: " · ")
    }

    // ── Configuração mais usada ──────────────────────────────
    private var secaoConfig: some View {
        secao(titulo: "Configuração mais usada") {
            if let cfg = dashboard?.configMaisUsada {
                linhaUso(nome: cfg.nome.isEmpty ? "Setup base" : cfg.nome,
                         complemento: "\(cfg.stints) stint" + (cfg.stints == 1 ? "" : "s"))
            } else {
                Text(carregando ? "Carregando…" : "Sem stints registrados — quando você rodar com setups, o mais usado aparece aqui.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    // ── Helpers de layout ────────────────────────────────────
    @ViewBuilder
    private func secao<C: View>(titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(titulo.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.54)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
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

    private func linhaUso(nome: String, complemento: String) -> some View {
        HStack {
            Text(nome)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.text)
            Spacer()
            Text(complemento)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    // ── Carregamento ─────────────────────────────────────────
    @MainActor
    private func carregar() async {
        carregando = true
        let carroBuscado = repo.carros.first { $0.id == carroId }
        carro = carroBuscado
        fotoLocal = CarroRepository.carregarFotoLocal(carroId: carroId)
        do {
            dashboard = try await CarroDashboardLoader.load(carroId: carroId, queue: repo.queue)
        } catch {
            dashboard = CarroDashboardData.vazio
        }
        carregando = false
    }

    // ── Formatters ───────────────────────────────────────────
    static func formatarTempoVolta(ms: Int) -> String {
        let totalMs = max(ms, 0)
        let m = totalMs / 60_000
        let restoMs = totalMs - m * 60_000
        let s = restoMs / 1000
        let mm = restoMs - s * 1000
        return String(format: "%d:%02d.%03d", m, s, mm)
    }

    static func dataCurta(ms: Int64) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: Date(timeIntervalSince1970: TimeInterval(ms) / 1000))
    }
}

// ─────────────────────────────────────────────────────────────
// Modelos de dados do dashboard
// ─────────────────────────────────────────────────────────────
struct CarroDashboardData {
    var kmRodada: Double?
    var vmaxKmh: Double?
    var autodromosCount: Int
    var stintsTotal: Int
    var voltasTotal: Int
    var melhorVolta: MelhorVolta?
    var pilotos: [PilotoUso]
    var autodromos: [AutodromoUso]
    var configMaisUsada: ConfigUso?

    static let vazio = CarroDashboardData(
        kmRodada: nil, vmaxKmh: nil, autodromosCount: 0,
        stintsTotal: 0, voltasTotal: 0, melhorVolta: nil,
        pilotos: [], autodromos: [], configMaisUsada: nil
    )
}

struct MelhorVolta {
    let tempoMs: Int
    let trackNome: String?
    let pilotoNome: String?
    let dataMs: Int64?
}

struct PilotoUso: Equatable {
    let id: String
    let nome: String
    let stints: Int
}

struct AutodromoUso: Equatable {
    let id: String
    let nome: String
    let ultimoUsoMs: Int64?
}

struct ConfigUso: Equatable {
    let nome: String
    let stints: Int
}


// ─────────────────────────────────────────────────────────────
// Loader — consultas SQL no DatabaseQueue local
// ─────────────────────────────────────────────────────────────
enum CarroDashboardLoader {
    static func load(carroId: String, queue: DatabaseQueue) async throws -> CarroDashboardData {
        guard let teamId = TeamContext.currentTeamId else { return .vazio }
        return try await queue.read { db in
            // Stints + voltas totais
            let stintsTotal = try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM sessoes WHERE carro_id = ? AND time_id = ?
            """, arguments: [carroId, teamId]) ?? 0

            let voltasTotal = try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                WHERE s.carro_id = ? AND s.time_id = ?
            """, arguments: [carroId, teamId]) ?? 0

            // Km estimado + Vmax + qtd autódromos (mesma lógica do CarroRepository).
            let vmax = try Double.fetchOne(db, sql: """
                SELECT MAX(se.velocidade_max) FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                WHERE s.carro_id = ? AND s.time_id = ?
            """, arguments: [carroId, teamId])

            let autodromosCount = try Int.fetchOne(db, sql: """
                SELECT COUNT(DISTINCT e.track_id) FROM eventos e
                JOIN sessoes s ON s.evento_id = e.id
                WHERE s.carro_id = ? AND s.time_id = ? AND e.track_id IS NOT NULL
            """, arguments: [carroId, teamId]) ?? 0

            let km = try Double.fetchOne(db, sql: """
                SELECT SUM(
                  ((COALESCE(se.vmin_kmh, se.velocidade_max * 0.6) + se.velocidade_max) / 2.0)
                  * (se.tempo_ms / 3600000.0)
                ) FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                WHERE s.carro_id = ? AND s.time_id = ?
                  AND se.velocidade_max IS NOT NULL AND se.tempo_ms IS NOT NULL
            """, arguments: [carroId, teamId])

            // Melhor volta válida
            let mvRow = try Row.fetchOne(db, sql: """
                SELECT v.tempo_ms, v.inicio_at, t.nome AS track_nome, p.nome AS piloto_nome
                FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                LEFT JOIN eventos e ON e.id = s.evento_id
                LEFT JOIN tracks t ON t.id = e.track_id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                WHERE s.carro_id = ? AND s.time_id = ? AND v.valida = 1
                  AND v.tempo_ms IS NOT NULL
                ORDER BY v.tempo_ms ASC
                LIMIT 1
            """, arguments: [carroId, teamId])
            let melhorVolta: MelhorVolta? = mvRow.map { row in
                MelhorVolta(
                    tempoMs: row["tempo_ms"] as Int? ?? 0,
                    trackNome: row["track_nome"] as String?,
                    pilotoNome: row["piloto_nome"] as String?,
                    dataMs: row["inicio_at"] as Int64?
                )
            }

            // Pilotos
            let pilotos = try Row.fetchAll(db, sql: """
                SELECT p.id, p.nome, COUNT(s.id) AS stints
                FROM sessoes s
                JOIN pilotos p ON p.id = s.piloto_id
                WHERE s.carro_id = ? AND s.time_id = ? AND s.piloto_id IS NOT NULL
                GROUP BY p.id, p.nome
                ORDER BY stints DESC, p.nome ASC
            """, arguments: [carroId, teamId]).map { row in
                PilotoUso(
                    id: row["id"] as String? ?? "",
                    nome: row["nome"] as String? ?? "—",
                    stints: row["stints"] as Int? ?? 0
                )
            }

            // Autódromos
            let autodromos = try Row.fetchAll(db, sql: """
                SELECT t.id, t.nome, MAX(s.data_inicio) AS ultimo
                FROM sessoes s
                JOIN eventos e ON e.id = s.evento_id
                JOIN tracks t ON t.id = e.track_id
                WHERE s.carro_id = ? AND s.time_id = ?
                GROUP BY t.id, t.nome
                ORDER BY ultimo DESC NULLS LAST, t.nome ASC
            """, arguments: [carroId, teamId]).map { row in
                AutodromoUso(
                    id: row["id"] as String? ?? "",
                    nome: row["nome"] as String? ?? "—",
                    ultimoUsoMs: row["ultimo"] as Int64?
                )
            }

            // Configuração mais usada
            let cfgRow = try Row.fetchOne(db, sql: """
                SELECT c.nome, COUNT(s.id) AS stints
                FROM sessoes s
                JOIN configuracoes c ON c.id = s.configuracao_id
                WHERE s.carro_id = ? AND s.time_id = ? AND s.configuracao_id IS NOT NULL
                GROUP BY c.id, c.nome
                ORDER BY stints DESC
                LIMIT 1
            """, arguments: [carroId, teamId])
            let configMaisUsada: ConfigUso? = cfgRow.map { row in
                ConfigUso(
                    nome: row["nome"] as String? ?? "Setup",
                    stints: row["stints"] as Int? ?? 0
                )
            }

            return CarroDashboardData(
                kmRodada: km,
                vmaxKmh: vmax,
                autodromosCount: autodromosCount,
                stintsTotal: stintsTotal,
                voltasTotal: voltasTotal,
                melhorVolta: melhorVolta,
                pilotos: pilotos,
                autodromos: autodromos,
                configMaisUsada: configMaisUsada
            )
        }
    }
}
