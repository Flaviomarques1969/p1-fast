// ═══════════════════════════════════════════════════════════
// EventoDetalheView — port de mockup-evento-detalhe.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #10. Sprint 1A.3 — Prompt #11 acoplou os
// fluxos `StintModalView` (CTA "Novo stint") e `PosStintView`
// (tap em stint card real → finalize + recap).
//
// Composição (1:1 com mockup):
//   - topbar: "‹ Eventos" (back) à esquerda + "Editar" à direita
//   - event-head: eyebrow "Evento" + título grande (28pt) + sub
//     "Sábado · 25/04 · Nelson Piquet"
//   - summary card 4-cells: Stints / Voltas / Melhor (em ouro) / Pronto%
//   - group__head "Stints" + contagem
//   - lista de stint cards (numerador 42x42 + título + sub + tags)
//   - CTA inline dashed "+ Novo stint"
//
// Dados:
//   - Eventos seedados (`evt-mock-*`) renderizam stints do
//     `EventoMockSummary` — somente leitura, atalho do PR #10.
//   - Eventos criados pelo usuário renderizam `StintRepository
//     .stintsPorEvento` (real, GRDB). Tap abre PosStintView; se
//     stint ainda está ativo, repo.finalize() roda antes pra
//     gerar voltas (gerador determinístico — Sprint 1B troca pelo
//     dado real do cockpit).

import SwiftUI
import P1FastCore

struct EventoDetalheView: View {
    @EnvironmentObject private var repo: EventoRepository
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var combustivelRepo: CombustivelRepository
    @EnvironmentObject private var pendenciaRepo: PendenciaRepository
    @EnvironmentObject private var voltaVideoRepo: VoltaVideoRepository
    let eventoId: String
    let onClose: () -> Void

    @State private var sheet: EventoDetalheSheet?
    @State private var finalizingStintId: String?

    /// Evento "passado" — data anterior ao dia de hoje (decisão Flávio
    /// rodada 1, escolha "Data anterior ao dia de hoje"). Passado é só
    /// histórico — esconde botões de mutação (Novo stint, Editar).
    private var isEventoPassado: Bool {
        guard let ms = repo.find(id: eventoId)?.evento.dataEvento else { return false }
        let dataEvento = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
        let inicioDeHoje = Calendar(identifier: .gregorian).startOfDay(for: Date())
        return dataEvento < inicioDeHoje
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()

            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, 4)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
        .task { await loadStintsReais() }
        .sheet(item: $sheet, onDismiss: {
            // Recarrega após criar/encerrar stint.
            Task { await loadStintsReais() }
        }) { which in
            sheetView(for: which)
        }
    }

    @ViewBuilder
    private func sheetView(for which: EventoDetalheSheet) -> some View {
        switch which {
        case .novoStint:
            if let ev = repo.find(id: eventoId) {
                StintModalView(
                    eventoId: eventoId,
                    proximoNumero: stintRepo.stintsPorEvento.count + 1,
                    contextoLinha: contextoStintModal(ev: ev),
                    onCancel: { sheet = nil },
                    // MS-2.5 wire: stint criado entra direto na captura
                    // ao vivo (StintCaptureView arma o coordinator). Antes
                    // disso o modal só fechava — finalize nunca recebia
                    // segmentEvents na prática.
                    onCreated: { stintId in
                        sheet = .captureAtivo(stintId: stintId)
                    }
                )
                .environmentObject(stintRepo)
                .environmentObject(carroRepo)
                .environmentObject(pneuRepo)
                .environmentObject(combustivelRepo)
            } else {
                EmptyView()
            }
        case .captureAtivo(let stintId):
            if let ev = repo.find(id: eventoId) {
                StintCaptureView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onFinalized: { id in
                        // F4-glue: passo intermediário pra triagem do vídeo.
                        // Se não houver gravação Daily.co OU nenhuma volta
                        // foi indexada, a TriagemVideoView mostra empty state
                        // e a pessoa avança pro PosStint normalmente.
                        sheet = .triagemVideo(stintId: id)
                    },
                    onCancel: { sheet = nil }
                )
            } else {
                EmptyView()
            }
        case .triagemVideo(let stintId):
            if let ev = repo.find(id: eventoId) {
                TriagemVideoView(
                    sessaoId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onClose: {
                        // Sempre encaminha pro PosStint depois da triagem
                        // (ou do "Pular"). PosStint é o destino final do
                        // fluxo.
                        sheet = .posStint(stintId: stintId)
                    }
                )
                .environmentObject(voltaVideoRepo)
            } else {
                EmptyView()
            }
        case .posStint(let stintId):
            if let ev = repo.find(id: eventoId) {
                PosStintView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onClose: { sheet = nil }
                )
                .environmentObject(stintRepo)
            } else {
                EmptyView()
            }
        case .pendencias:
            if let ev = repo.find(id: eventoId) {
                PendenciasView(
                    eventoId: eventoId,
                    eventoTitulo: contextoStintModal(ev: ev),
                    onClose: { sheet = nil }
                )
                .environmentObject(pendenciaRepo)
            } else {
                EmptyView()
            }
        }
    }

    private func contextoStintModal(ev: EventoView) -> String {
        let weekday = formatWeekdayLong(ev.evento.dataEvento)
        let dia = formatDayMonthShort(ev.evento.dataEvento)
        return "\(ev.pistaDisplay) · \(weekday.lowercased()) \(dia)"
    }

    private func loadStintsReais() async {
        do { try await stintRepo.loadByEvento(eventoId: eventoId) } catch {
            print("loadByEvento failed: \(error)")
        }
    }

    private func abrirStintReal(_ stint: Stint) {
        // Se ainda está ativo, finalizamos antes (gerador determinístico
        // mockado — Sprint 1B troca pelo dado real). Atalho do MVP pra
        // poder visualizar o PosStint sem cockpit ao vivo.
        if stint.isAtivo {
            finalizingStintId = stint.id
            Task {
                _ = try? await stintRepo.finalize(stintId: stint.id)
                finalizingStintId = nil
                sheet = .posStint(stintId: stint.id)
            }
        } else {
            sheet = .posStint(stintId: stint.id)
        }
    }

    @ViewBuilder
    private var content: some View {
        if let ev = repo.find(id: eventoId) {
            VStack(alignment: .leading, spacing: 0) {
                topbar
                eventHead(ev: ev)
                    .padding(.top, 14)
                // S5 #10: evento passado ganha resumo expandido (5 stats).
                // Evento futuro mantém o summary card 4-cells.
                if isEventoPassado {
                    resumoEventoPassadoCard(ev: ev)
                        .padding(.top, 18)
                } else {
                    summaryCard(ev: ev)
                        .padding(.top, 18)
                }
                pendenciasSection
                    .padding(.top, 18)
                // S5 #9: histórico de pendências (concluídas × não concluídas)
                // visível em evento passado.
                if isEventoPassado, let inst = pendenciaRepo.instanciasPorEvento[eventoId], !inst.isEmpty {
                    historicoPendenciasSection(instancias: inst)
                        .padding(.top, 18)
                }
                stintsSection(ev: ev)
                    .padding(.top, 18)
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.md) {
                topbar
                Text("Evento não encontrado.")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, Spacing.lg)
            }
        }
    }

    // MARK: - Seção pendências (CTA pra abrir o checklist completo)

    /// #24 — Contagem de pendências do evento (abertas × resolvidas).
    /// Lê o estado atual do PendenciaRepository (que carrega assíncrono
    /// no bootstrap). Quando ainda não carregou, retorna 0/0 e o sub-text
    /// fica "Carregando…".
    private var pendenciasContagem: (abertas: Int, resolvidas: Int)? {
        let instancias = pendenciaRepo.instanciasPorEvento[eventoId]
        guard let instancias = instancias else { return nil }
        let resolvidas = instancias.filter { $0.checado }.count
        let abertas = instancias.count - resolvidas
        return (abertas, resolvidas)
    }

    private var pendenciasSection: some View {
        Button {
            sheet = .pendencias
        } label: {
            HStack(alignment: .center, spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pendências")
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(0.06 * 13)
                        .foregroundStyle(Color.text)
                    // #24 — Contadores no lugar do texto fixo antigo.
                    if let c = pendenciasContagem {
                        Text("\(c.abertas) abertas · \(c.resolvidas) resolvidas")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(c.abertas > 0 ? Color.accent : Color.textMuted)
                    } else {
                        Text("Carregando…")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                    }
                }
                Spacer(minLength: 0)
                // #24 — Removida palavra "Ver". Só a setinha (›) decorativa.
                Text("›")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle()) // #24 — garante linha inteira clicável
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

    // MARK: - Topbar

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Eventos")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
            // #16 — Botão "Editar" escondido em evento passado (histórico só).
            if !isEventoPassado {
                Button(action: { /* Edit fica pro Sprint 1A.3 */ }) {
                    Text("Editar")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Header

    private func eventHead(ev: EventoView) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Evento")
            Text(ev.pistaDisplay)
                .font(.system(size: 28, weight: .semibold))
                .tracking(-0.7) // -0.025em em 28pt
                .foregroundStyle(Color.text)
            Text(formatDataLongaPiquet(ms: ev.evento.dataEvento, layoutShort: ev.pistaLayoutShort))
                .font(.system(size: 14, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, 4)
    }

    // MARK: - Resumo do evento passado (S5 rodada 1)

    /// S5 #10 — Quadro de resultados visíveis SÓ em evento passado:
    /// melhor volta + total voltas + total stints + velocidade máxima + km
    /// rodada (estimada). Mantém o estilo visual do summary 4-cells
    /// (Spacing.md + Radius.md + surfaceRaised), só com 5 colunas em
    /// vez de 4 e ordem priorizando o ouro da melhor volta.
    private func resumoEventoPassadoCard(ev: EventoView) -> some View {
        let s = summaryFor(ev)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Resumo do evento")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
            HStack(spacing: 6) {
                statCell(value: s.melhorVoltaCurto ?? "—", label: "Melhor", isOuro: true)
                statCell(value: "\(s.voltas)", label: "Voltas", isOuro: false)
                statCell(value: "\(s.stints)", label: "Stints", isOuro: false)
                statCell(value: formatVmax(s.vmaxKmh), label: "Vel. máx.", isOuro: false)
                statCell(value: formatKm(s.kmTotal), label: "km rodada", isOuro: false)
            }
        }
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

    private func formatVmax(_ kmh: Double?) -> String {
        guard let kmh = kmh, kmh > 0 else { return "—" }
        return String(format: "%.0f km/h", kmh)
    }

    private func formatKm(_ km: Double?) -> String {
        guard let km = km, km > 0 else { return "—" }
        return String(format: "%.0f km", km)
    }

    // MARK: - Histórico de pendências (S5 rodada 1)

    /// S5 #9 — Em evento passado, mostra as pendências feitas e as não
    /// feitas em 2 sub-listas inline. Recomendação P3 aplicada (#9: mostra
    /// em futuros + passados — implementação prioriza passado, futuro fica
    /// no fluxo de pendências aberto pelo botão da seção #24).
    private func historicoPendenciasSection(instancias: [EventoPendencia]) -> some View {
        let concluidas = instancias.filter { $0.checado }
        let naoConcluidas = instancias.filter { !$0.checado }
        return VStack(alignment: .leading, spacing: 14) {
            Text("Histórico de pendências")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            if !concluidas.isEmpty {
                historicoBloco(
                    titulo: "Concluídas",
                    contagem: concluidas.count,
                    cor: Color.bom,
                    instancias: concluidas
                )
            }
            if !naoConcluidas.isEmpty {
                historicoBloco(
                    titulo: "Não concluídas",
                    contagem: naoConcluidas.count,
                    cor: Color.atencao,
                    instancias: naoConcluidas
                )
            }
        }
    }

    private func historicoBloco(titulo: String, contagem: Int, cor: Color, instancias: [EventoPendencia]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Circle().fill(cor).frame(width: 6, height: 6)
                Text(titulo)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("\(contagem)")
                    .font(.system(size: 12, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textFaint)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 4)

            VStack(spacing: 6) {
                ForEach(instancias, id: \.id) { inst in
                    historicoLinha(inst: inst, cor: cor)
                }
            }
        }
    }

    private func historicoLinha(inst: EventoPendencia, cor: Color) -> some View {
        let nome = pendenciaRepo.nomeTemplate(inst.templateId) ?? inst.templateId
        return HStack(alignment: .center, spacing: 10) {
            Image(systemName: inst.checado ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(inst.checado ? cor : Color.textFaint)
            VStack(alignment: .leading, spacing: 2) {
                Text(nome)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(inst.checado ? Color.textMuted : Color.text)
                    .strikethrough(inst.checado, color: Color.textFaint)
                if let nota = inst.nota?.trimmingCharacters(in: .whitespaces), !nota.isEmpty {
                    Text(nota)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
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

    // MARK: - Summary 4-stats

    private func summaryCard(ev: EventoView) -> some View {
        let s = summaryFor(ev)
        return HStack(spacing: 8) {
            statCell(value: "\(s.stints)", label: "Stints", isOuro: false)
            statCell(value: "\(s.voltas)", label: "Voltas", isOuro: false)
            statCell(value: s.melhorVoltaCurto ?? "—", label: "Melhor", isOuro: true)
            statCell(value: "\(s.pctPronto)%", label: "Pronto", isOuro: false)
        }
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

    private func statCell(value: String, label: String, isOuro: Bool) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 18, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.36) // -0.02em em 18pt
                .foregroundStyle(isOuro ? Color.ouro : Color.text)
                .lineLimit(1)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.6) // 0.06em em 10pt
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.surfaceHover)
        )
    }

    // MARK: - Stints

    private func stintsSection(ev: EventoView) -> some View {
        let mocks = stintsFor(ev)
        let reais = stintRepo.stintsPorEvento
        let totalCount = reais.isEmpty ? mocks.count : reais.count
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Stints")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32) // 0.12em em 11pt
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(totalCount)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 10)

            VStack(spacing: 8) {
                if !reais.isEmpty {
                    // Eventos criados pelo usuário — stints reais do GRDB.
                    ForEach(reais) { stint in
                        StintCardReal(
                            stint: stint,
                            isFinalizing: finalizingStintId == stint.id,
                            onTap: { abrirStintReal(stint) },
                            onCancel: (stint.podeCancelar && podeEditarStint(stint)) ? {
                                Task {
                                    try? await stintRepo.cancel(stintId: stint.id)
                                    await loadStintsReais()
                                }
                            } : nil
                        )
                    }
                } else {
                    // Eventos seedados — fallback pros mocks de design.
                    ForEach(mocks) { stint in
                        StintCardMock(stint: stint)
                    }
                }
                // #8 — Botão "Novo stint" escondido em evento passado.
                if !isEventoPassado {
                    AddStintCTA(onTap: { sheet = .novoStint })
                }
            }
        }
    }

    // MARK: - Helpers

    private struct DetalheSummary {
        let stints: Int
        let voltas: Int
        let melhorVoltaCurto: String?
        let pctPronto: Int
        /// S5 rodada 1: velocidade máxima do evento, nil quando não há dado.
        let vmaxKmh: Double?
        /// S5 rodada 1: km estimada do evento, nil quando não há dado.
        let kmTotal: Double?
    }

    private func summaryFor(_ ev: EventoView) -> DetalheSummary {
        if let mock = EventoMockSummary.canon(eventoId: ev.id) {
            return DetalheSummary(
                stints: mock.stintsCount,
                voltas: mock.voltasCount,
                melhorVoltaCurto: mock.melhorVoltaCurto(),
                pctPronto: mock.pctPronto,
                vmaxKmh: mock.vmaxKmh,
                kmTotal: mock.kmTotal
            )
        }
        let real = repo.sumarioPorEvento[ev.id]
        return DetalheSummary(
            stints: real?.stints ?? 0,
            voltas: real?.voltas ?? 0,
            melhorVoltaCurto: real.flatMap { sumario -> String? in
                guard let ms = sumario.melhorVoltaMs else { return nil }
                let minutos = ms / 60_000
                let segundos = (ms % 60_000) / 1000
                let decimo = (ms % 1000) / 100
                return String(format: "%d:%02d.%d", minutos, segundos, decimo)
            },
            pctPronto: 0,
            // S5: vmax e km de eventos reais ainda não são agregados no
            // sumarioPorEvento. Por enquanto nil — UI mostra "—". Adicionar
            // queries no EventoRepository em sprint futura.
            vmaxKmh: nil,
            kmTotal: nil
        )
    }

    private func stintsFor(_ ev: EventoView) -> [StintMock] {
        EventoMockSummary.canon(eventoId: ev.id)?.stintsDetalhados ?? []
    }

    // MS-4.6 — Permissão de editar/cancelar stint. Consume função pura
    // StintEditPermission.podeEditar (testada em PERM-01..06). Hoje,
    // sem F1 (Pessoas multi-papel), o owner do time é sempre 'admin' →
    // todo o app permite. Quando F1 chegar, papéis refinados restringem.
    private func podeEditarStint(_ stint: Stint) -> Bool {
        StintEditPermission.podeEditar(
            currentUserId: TeamContext.currentPilotoId,
            currentRole: TeamContext.currentRole,
            pilotoId: stint.sessao.pilotoId,
            pilotosRevezamento: stint.sessao.pilotosRevezamento
        )
    }
}

// MARK: - Sheet enum

enum EventoDetalheSheet: Identifiable, Equatable {
    case novoStint
    case captureAtivo(stintId: String)
    case triagemVideo(stintId: String)
    case posStint(stintId: String)
    case pendencias

    var id: String {
        switch self {
        case .novoStint: return "novo-stint"
        case .captureAtivo(let id): return "capture-\(id)"
        case .triagemVideo(let id): return "triagem-\(id)"
        case .posStint(let id): return "pos-\(id)"
        case .pendencias: return "pendencias"
        }
    }
}

// MARK: - StintCardMock (eventos seedados — read-only)

private struct StintCardMock: View {
    let stint: StintMock

    var body: some View {
        Button(action: { /* drill-down do mock chega no Sprint 1A.3 */ }) {
            HStack(alignment: .top, spacing: 14) {
                numCircle
                bodyBlock
                Spacer(minLength: 0)
                chev
            }
            .padding(.horizontal, Spacing.md)
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
        .buttonStyle(.plain)
    }

    private var numCircle: some View {
        Text("\(stint.numero)")
            .font(.system(size: 14, weight: .semibold))
            .monospacedDigit()
            .tracking(-0.28)
            .foregroundStyle(Color.text)
            .frame(width: 42, height: 42)
            .background(
                Circle()
                    .fill(Color.surfaceHover)
            )
            .overlay(
                Circle()
                    .stroke(Color.border, lineWidth: 1)
            )
    }

    private var bodyBlock: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(stint.titulo)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075) // -0.005em em 15pt
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text("\(stint.voltas) voltas · melhor \(formatTempoMs(stint.melhorVoltaMs))")
                .font(.system(size: 12, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
            tags
                .padding(.top, 7)
        }
    }

    @ViewBuilder
    private var tags: some View {
        HStack(spacing: 6) {
            EventTag(text: stint.piloto, kind: .neutral)
            EventTag(text: stint.licao, kind: .neutral)
            if let especial = stint.tagEspecial {
                switch especial {
                case .pbDoDia:
                    EventTag(text: "PB do dia", kind: .ouro)
                case .desvioBaixo:
                    EventTag(text: "Desvio < 0.4s", kind: .bom)
                }
            }
        }
    }

    private var chev: some View {
        Text("›")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .padding(.top, 8)
    }
}

// MARK: - StintCardReal (eventos criados pelo usuário)

private struct StintCardReal: View {
    let stint: Stint
    let isFinalizing: Bool
    let onTap: () -> Void
    /// MS-4.5: opcional. Quando presente, long-press oferece "Cancelar stint".
    let onCancel: (() -> Void)?

    @State private var confirmandoCancelamento: Bool = false

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 14) {
                numCircle
                bodyBlock
                Spacer(minLength: 0)
                chev
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .opacity(stint.isCancelado ? 0.55 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isFinalizing || stint.isCancelado)
        .contextMenu {
            if onCancel != nil {
                Button(role: .destructive, action: {
                    confirmandoCancelamento = true
                }) {
                    Label("Cancelar stint", systemImage: "xmark.circle")
                }
            }
        }
        .confirmationDialog(
            "Cancelar este stint?",
            isPresented: $confirmandoCancelamento,
            titleVisibility: .visible
        ) {
            Button("Cancelar stint", role: .destructive) {
                onCancel?()
            }
            Button("Voltar", role: .cancel) {}
        } message: {
            Text("O stint não some — fica marcado como cancelado no histórico.")
        }
    }

    private var backgroundColor: Color {
        if stint.isCancelado { return Color.surfaceRaised }
        if stint.isAtivo { return Color.accentDim.opacity(0.15) }
        return Color.surfaceRaised
    }

    private var borderColor: Color {
        if stint.isCancelado { return Color.border.opacity(0.6) }
        if stint.isAtivo { return Color.accent.opacity(0.55) }
        return Color.border
    }

    private var numCircle: some View {
        // Numeração do stint não é persistida no schema (sessoes não tem
        // `numero` explícito). Usamos só "•" como placeholder visual —
        // EventoDetalheView ordena por created_at e a posição na lista
        // é o que conta. Trocar por número real quando o schema ganhar.
        Text("•")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(Color.text)
            .frame(width: 42, height: 42)
            .background(
                Circle()
                    .fill(stint.isAtivo ? Color.accent.opacity(0.18) : Color.surfaceHover)
            )
            .overlay(
                Circle()
                    .stroke(stint.isAtivo ? Color.accent.opacity(0.45) : Color.border, lineWidth: 1)
            )
    }

    private var bodyBlock: some View {
        let (tipo, licao) = stint.objetivoDecomposto
        return VStack(alignment: .leading, spacing: 3) {
            Text(tipo.isEmpty ? "Stint" : tipo)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075)
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text(subtitle)
                .font(.system(size: 12, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
            HStack(spacing: 6) {
                if let nome = stint.pilotoNome, !nome.isEmpty {
                    EventTag(text: nome, kind: .neutral)
                }
                if !licao.isEmpty {
                    EventTag(text: licao, kind: .neutral)
                }
                if stint.isAtivo {
                    EventTag(text: isFinalizing ? "Finalizando…" : "Ativo", kind: .accent)
                }
                if stint.isCancelado {
                    EventTag(text: "Cancelado", kind: .neutral)
                }
            }
            .padding(.top, 7)
        }
    }

    private var subtitle: String {
        if stint.isAtivo {
            let plan = stint.sessao.voltasPlanejadas ?? 0
            if plan > 0 { return "\(plan) voltas planejadas · toque pra encerrar" }
            return "Stint ativo · toque pra encerrar"
        }
        let count = stint.voltasCount
        guard let melhor = stint.melhorVoltaMs else {
            return "\(count) voltas registradas"
        }
        return "\(count) voltas · melhor \(formatTempoMs(melhor))"
    }

    private var chev: some View {
        Text("›")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .padding(.top, 8)
    }
}

// MARK: - Add Stint CTA (dashed inline)

private struct AddStintCTA: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.sm) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text("Novo stint")
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07) // -0.005em em 14pt
            }
            .foregroundStyle(Color.textMuted)
            .padding(.vertical, 14)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(
                        Color.border,
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("EventoDetalhe — 25/04 (4 stints)") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = EventoRepository(queue: queue)
    let stintRepo = StintRepository(queue: queue)
    let carroRepo = CarroRepository(queue: queue)
    let pneuRepo = PneuRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    return EventoDetalheView(eventoId: EventoRepository.seedPassado1Id, onClose: {})
        .environmentObject(repo)
        .environmentObject(stintRepo)
        .environmentObject(carroRepo)
        .environmentObject(pneuRepo)
        .environmentObject(combustivelRepo)
        .task {
            await repo.bootstrap()
            await stintRepo.bootstrap()
            await carroRepo.bootstrap()
            await pneuRepo.bootstrap()
            await combustivelRepo.bootstrap()
        }
}
