// ═══════════════════════════════════════════════════════════
// AutodromoListaView — lista de Autódromos (Onda 2 reformulação)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). Substitui a antiga
// TrechoListaView que abria direto na lista de trechos de Brasília.
// Agora:
//   • lista cards de autódromos (cidade + nº trechos + melhor volta
//     + vmax + km do piloto)
//   • FAB pra cadastrar autódromo novo (F1=ja-agora)
//   • toque no card → AutodromoDetalheView (Onda 4)
//
// Decisões aplicadas:
//   E (1ª rodada): card mostra cidade, nº trechos, melhor volta, vmax,
//                  km do piloto. Quando seleciona carro: dados do carro.
//   F (1ª rodada) + F2 (questionário): melhor volta + vmax sempre do
//                                       carro escolhido (filtro).
//   F1 (questionário): cadastro de novo autódromo entra agora.
//   C4 + Q3 do follow-up: km é GPS; quando GPS estoura aviso pequeno.

import SwiftUI
import P1FastCore
import GRDB

struct AutodromoListaView: View {
    @EnvironmentObject private var repo: TrackRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var navCoordinator: NavigationCoordinator
    let onClose: (() -> Void)?

    @State private var carroFiltroId: String? = nil
    @State private var resumos: [String: AutodromoResumo] = [:]
    @State private var carregando = true

    init(onClose: (() -> Void)? = nil) {
        self.onClose = onClose
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                conteudo
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FAB("Novo autódromo") {
                // 2026-05-17 Flávio "menu inferior sempre visível":
                // empurra pelo NavigationStack pai em vez de janela modal.
                navCoordinator.push(.autodromoNovo)
            }
                .padding(.trailing, Spacing.md)
                // 2026-05-17 (Flávio): 110 pt sobe o botão pra cima do
                // menu fixo embaixo.
                .padding(.bottom, 110)
        }
        .navigationTitle("Autódromos")
        .navigationBarTitleDisplayMode(.inline)
        // Back nativo do iOS aparece automaticamente. Botão "Fechar"
        // removido — antes era usado quando esta tela era janela modal.
        .preferredColorScheme(.dark)
        .task(id: carroFiltroId) { await carregarResumos() }
        .task(id: repo.tracks.count) { await carregarResumos() }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            cabecalho
            seletorCarro
            if repo.tracks.isEmpty {
                emptyState
            } else {
                VStack(spacing: 10) {
                    ForEach(repo.tracks, id: \.id) { autodromo in
                        NavigationLink {
                            AutodromoDetalheView(
                                autodromoId: autodromo.id,
                                carroFiltroId: carroFiltroId
                            )
                        } label: {
                            cardAutodromo(autodromo)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Autódromos")
            Text(headerTitle)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSub)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    private var headerTitle: String {
        let n = repo.tracks.count
        if n == 0 { return "Nenhum autódromo" }
        if n == 1 { return "1 autódromo" }
        return "\(n) autódromos"
    }

    private var headerSub: String {
        if carroFiltroId == nil {
            return "Toque pra abrir o autódromo. Use o filtro acima pra ver números do carro específico."
        }
        return "Mostrando números do carro selecionado."
    }

    /// Filtro de carro: "Todos os carros" + 1 botão por carro. Quando
    /// um carro está selecionado, melhor volta/vmax/km do card mostram
    /// dados daquele carro (decisão F2 do questionário).
    private var seletorCarro: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                pillCarro(label: "Todos os carros", isOn: carroFiltroId == nil) {
                    carroFiltroId = nil
                }
                ForEach(carroRepo.carros, id: \.id) { c in
                    pillCarro(label: c.apelido, isOn: carroFiltroId == c.id) {
                        carroFiltroId = c.id
                    }
                }
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    private func pillCarro(label: String, isOn: Bool, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isOn ? Color.onAccent : Color.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(isOn ? Color.accent : Color.surfaceRaised)
                )
                .overlay(
                    Capsule().stroke(isOn ? Color.accent : Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        Text("Nenhum autódromo cadastrado. Toque em 'Novo autódromo' pra adicionar o primeiro.")
            .font(.system(size: 14))
            .foregroundStyle(Color.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
    }

    @ViewBuilder
    private func cardAutodromo(_ a: TrackRow) -> some View {
        let resumo = resumos[a.id] ?? .vazio
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(a.apelido)
                        .font(.system(size: 18, weight: .semibold))
                        .tracking(-0.36)
                        .foregroundStyle(Color.text)
                    Text(linhaCidadeCurvas(a))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textMuted)
                }
                Spacer(minLength: 0)
                Button {
                    navCoordinator.push(.autodromoEditar(autodromoId: a.id))
                } label: {
                    Text("Editar")
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color.surfaceHover)
                        )
                        .foregroundStyle(Color.text)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 14) {
                numerinho(valor: resumo.melhorVoltaTexto, rotulo: "MELHOR VOLTA")
                numerinho(valor: resumo.vmaxKmhTexto, rotulo: "VMAX (KM/H)")
                numerinho(valor: resumo.kmPilotoTexto, rotulo: "KM DO PILOTO")
            }
            .padding(.top, 4)
        }
        .padding(14)
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

    private func linhaCidadeCurvas(_ a: TrackRow) -> String {
        var partes: [String] = []
        if let cidade = a.cidade, !cidade.isEmpty { partes.append(cidade) }
        if let n = a.numeroCurvas { partes.append("\(n) curva\(n == 1 ? "" : "s")") }
        if let m = a.extensaoMetros {
            let km = Double(m) / 1000.0
            partes.append(String(format: "%.2f km", km))
        }
        return partes.isEmpty ? "Sem dados de cadastro" : partes.joined(separator: " · ")
    }

    private func numerinho(valor: String, rotulo: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(valor)
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text(rotulo)
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.72)
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @MainActor
    private func carregarResumos() async {
        carregando = true
        var dict: [String: AutodromoResumo] = [:]
        for a in repo.tracks {
            do {
                let r = try await AutodromoResumoLoader.load(
                    autodromoId: a.id,
                    extensaoMetros: a.extensaoMetros,
                    carroId: carroFiltroId,
                    queue: repo.queue
                )
                dict[a.id] = r
            } catch {
                dict[a.id] = .vazio
            }
        }
        resumos = dict
        carregando = false
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - AutodromoResumo + Loader
// ═══════════════════════════════════════════════════════════

struct AutodromoResumo: Equatable {
    let melhorVoltaMs: Int?
    let vmaxKmh: Double?
    /// Km do piloto medidos pelo GPS (Σ velocidade_max × tempo).
    let kmGps: Double?
    /// Km calculados pela extensão da pista × nº de voltas.
    let kmCalculo: Double?
    let alertaGps: Bool

    var melhorVoltaTexto: String {
        guard let ms = melhorVoltaMs else { return "—" }
        return CarroDashboardView.formatarTempoVolta(ms: ms)
    }

    var vmaxKmhTexto: String {
        guard let v = vmaxKmh, v > 0 else { return "—" }
        return String(format: "%.0f", v)
    }

    var kmPilotoTexto: String {
        // Decisão Q3: mostra só o GPS (com alertaGps quando diverge muito).
        guard let km = kmGps, km > 0 else { return "—" }
        if km >= 100 {
            return "\(Int(km.rounded()))" + (alertaGps ? " ⚠︎" : "")
        }
        return String(format: "%.1f", km) + (alertaGps ? " ⚠︎" : "")
    }

    static let vazio = AutodromoResumo(melhorVoltaMs: nil, vmaxKmh: nil,
                                       kmGps: nil, kmCalculo: nil,
                                       alertaGps: false)
}

// ═══════════════════════════════════════════════════════════
// MARK: - AutodromoEditarLauncher — destino da pilha para .autodromoEditar(autodromoId)
// ═══════════════════════════════════════════════════════════
// 2026-05-17 (Flávio "menu inferior sempre visível"): a edição de
// autódromo deixou de ser janela modal e virou tela empilhada.
// Esta view busca o TrackRow pelo ID no TrackRepository e monta o
// AutodromoFormView no modo .editar.

struct AutodromoEditarLauncher: View {
    @EnvironmentObject private var repo: TrackRepository
    let autodromoId: String
    let onClose: () -> Void

    var body: some View {
        Group {
            if let row = repo.tracks.first(where: { $0.id == autodromoId }) {
                AutodromoFormView(modo: .editar(row), onClose: onClose)
            } else {
                VStack(spacing: 8) {
                    Text("Autódromo não encontrado").font(.system(size: 16, weight: .semibold))
                    Button("Voltar", action: onClose)
                }
                .padding()
            }
        }
    }
}

enum AutodromoResumoLoader {
    /// Carrega resumo de um autódromo. Quando `carroId` for nil, números
    /// do time inteiro; quando carroId tiver valor, números só daquele carro.
    static func load(autodromoId: String,
                     extensaoMetros: Int?,
                     carroId: String?,
                     queue: DatabaseQueue) async throws -> AutodromoResumo {
        guard let teamId = TeamContext.currentTeamId else { return .vazio }
        return try await queue.read { db in
            let filtros: String
            let args: [DatabaseValueConvertible]
            if let cid = carroId {
                filtros = "AND s.carro_id = ?"
                args = [autodromoId, teamId, cid]
            } else {
                filtros = ""
                args = [autodromoId, teamId]
            }

            // Melhor volta válida no autódromo (filtrada por carro quando aplica).
            let melhorVoltaMs = try Int.fetchOne(db, sql: """
                SELECT MIN(v.tempo_ms) FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                JOIN eventos e ON e.id = s.evento_id
                WHERE e.track_id = ? AND s.time_id = ? AND v.valida = 1
                  AND v.tempo_ms IS NOT NULL \(filtros)
            """, arguments: StatementArguments(args))

            // Vmax no autódromo.
            let vmaxKmh = try Double.fetchOne(db, sql: """
                SELECT MAX(se.velocidade_max) FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                JOIN eventos e ON e.id = s.evento_id
                WHERE e.track_id = ? AND s.time_id = ? \(filtros)
            """, arguments: StatementArguments(args))

            // Km GPS (Σ velocidade_média × tempo).
            let kmGps = try Double.fetchOne(db, sql: """
                SELECT SUM(
                  ((COALESCE(se.vmin_kmh, se.velocidade_max * 0.6) + se.velocidade_max) / 2.0)
                  * (se.tempo_ms / 3600000.0)
                )
                FROM segment_executions se
                JOIN sessoes s ON s.id = se.sessao_id
                JOIN eventos e ON e.id = s.evento_id
                WHERE e.track_id = ? AND s.time_id = ?
                  AND se.velocidade_max IS NOT NULL AND se.tempo_ms IS NOT NULL \(filtros)
            """, arguments: StatementArguments(args))

            // Km calculado (extensão × nº de voltas válidas).
            let nVoltas = try Int.fetchOne(db, sql: """
                SELECT COUNT(v.id) FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                JOIN eventos e ON e.id = s.evento_id
                WHERE e.track_id = ? AND s.time_id = ? AND v.valida = 1 \(filtros)
            """, arguments: StatementArguments(args)) ?? 0
            let kmCalc: Double? = {
                guard let ext = extensaoMetros, nVoltas > 0 else { return nil }
                return Double(ext) * Double(nVoltas) / 1000.0
            }()

            // Q3: alerta GPS quando diverge mais que 15% do cálculo.
            var alerta = false
            if let g = kmGps, let c = kmCalc, c > 0 {
                let diff = abs(g - c) / c
                if diff > 0.15 { alerta = true }
            }

            return AutodromoResumo(
                melhorVoltaMs: melhorVoltaMs,
                vmaxKmh: vmaxKmh,
                kmGps: kmGps,
                kmCalculo: kmCalc,
                alertaGps: alerta
            )
        }
    }
}
