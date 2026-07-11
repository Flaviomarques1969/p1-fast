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
    @EnvironmentObject private var estoqueRepo: EstoqueRepository
    @EnvironmentObject private var voltaVideoRepo: VoltaVideoRepository
    @Environment(\.databaseQueue) private var dbQueue
    let eventoId: String
    let onClose: () -> Void

    @State private var sheet: EventoDetalheSheet?
    @State private var finalizingStintId: String?

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
        // Tem topbar próprio "‹ Eventos": esconde a barra de navegação
        // nativa pra não duplicar o "voltar" quando vira página empilhada
        // com o menu fixo embaixo. (2026-05-31 — pedido do Flávio.)
        .toolbar(.hidden, for: .navigationBar)
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
        case .checklistStint(let stintId, let label):
            if let q = dbQueue {
                NavigationStack {
                    ExecucaoStintRealView(queue: q, stintId: stintId, stintLabel: label)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Fechar") { sheet = nil }
                            }
                        }
                }
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
                .environmentObject(estoqueRepo)
                .environmentObject(carroRepo)
            } else {
                EmptyView()
            }
        case .editar:
            if let ev = repo.find(id: eventoId) {
                EventoEditarFormView(
                    eventoId: eventoId,
                    dataInicial: Date(timeIntervalSince1970: Double(ev.evento.dataEvento) / 1000),
                    onClose: { sheet = nil }
                )
                .environmentObject(repo)
            } else {
                EmptyView()
            }
        case .stintMock(let stint):
            if let ev = repo.find(id: eventoId) {
                StintMockDetalheView(
                    stint: stint,
                    contextoLinha: contextoStintModal(ev: ev),
                    onClose: { sheet = nil }
                )
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
                summaryCard(ev: ev)
                    .padding(.top, 18)
                pendenciasSection
                    .padding(.top, 18)
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
                    Text("Checklist 6 grupos · ~45 itens")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                }
                Spacer(minLength: 0)
                Text("Ver ›")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.accent)
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
            Button(action: { sheet = .editar }) {
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
                    ForEach(Array(reais.enumerated()), id: \.element.id) { idx, stint in
                        VStack(spacing: 6) {
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
                            if !stint.isCancelado {
                                checklistStintBotao(stintId: stint.id, label: "Stint \(reais.count - idx)")
                            }
                        }
                    }
                } else {
                    // Eventos seedados — fallback pros mocks de design.
                    ForEach(mocks) { stint in
                        StintCardMock(stint: stint, onTap: { sheet = .stintMock(stint) })
                    }
                }
                AddStintCTA(onTap: { sheet = .novoStint })
            }
        }
    }

    // Entrada do checklist do stint (preso a ESTE stint real; grava em stint_check).
    @ViewBuilder
    private func checklistStintBotao(stintId: String, label: String) -> some View {
        Button { sheet = .checklistStint(stintId: stintId, label: label) } label: {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Checklist do stint")
                        .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Color.text)
                    Text("cada um marca os seus itens")
                        .font(.system(size: 11)).foregroundStyle(Color.textFaint)
                }
                Spacer(minLength: 0)
                Text("abrir ›").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.accent)
            }
            .padding(.horizontal, 13).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceHover))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private struct DetalheSummary {
        let stints: Int
        let voltas: Int
        let melhorVoltaCurto: String?
        let pctPronto: Int
    }

    private func summaryFor(_ ev: EventoView) -> DetalheSummary {
        if let mock = EventoMockSummary.canon(eventoId: ev.id) {
            return DetalheSummary(
                stints: mock.stintsCount,
                voltas: mock.voltasCount,
                melhorVoltaCurto: mock.melhorVoltaCurto(),
                pctPronto: mock.pctPronto
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
            pctPronto: 0
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
    case checklistStint(stintId: String, label: String)
    case pendencias
    case editar
    case stintMock(StintMock)

    var id: String {
        switch self {
        case .novoStint: return "novo-stint"
        case .captureAtivo(let id): return "capture-\(id)"
        case .triagemVideo(let id): return "triagem-\(id)"
        case .posStint(let id): return "pos-\(id)"
        case .checklistStint(let id, _): return "checklist-stint-\(id)"
        case .pendencias: return "pendencias"
        case .editar: return "editar"
        case .stintMock(let stint): return "stintmock-\(stint.id)"
        }
    }
}

// MARK: - StintCardMock (eventos seedados — read-only)

private struct StintCardMock: View {
    let stint: StintMock
    let onTap: () -> Void

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

// MARK: - EventoEditarFormView (editar a data do evento)
// 2026-06-19 — Flávio pediu pra "ligar" o botão "Editar" do topbar,
// que tinha ação vazia. Hoje o evento só tem a DATA como campo
// editável (pista fixa "Brasília", tipo fixo "track-day"); este form
// espelha o molde do EventoNovoFormView e grava via repo.update.

struct EventoEditarFormView: View {
    @EnvironmentObject private var repo: EventoRepository
    let eventoId: String
    let onClose: () -> Void

    @State private var dataEvento: Date
    @State private var isSaving = false
    @State private var savingError: String?

    init(eventoId: String, dataInicial: Date, onClose: @escaping () -> Void) {
        self.eventoId = eventoId
        self.onClose = onClose
        _dataEvento = State(initialValue: dataInicial)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                editarContent
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: save,
                saveLabel: "Salvar",
                canSave: !isSaving
            )
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var editarContent: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Editar evento")
                Text("Editar evento")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Você ajusta a data aqui; pista e tipo seguem fixos por enquanto.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(2)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Pista") {
                HStack {
                    Text("Brasília · Auto. Int. Nelson Piquet")
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    Spacer()
                    Text("única hoje")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
            }

            FormField(label: "Data do evento") {
                DatePicker(
                    "Data do evento",
                    selection: $dataEvento,
                    displayedComponents: [.date]
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "pt_BR"))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
            }

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Stints, pilotos e setup você gerencia abrindo o evento — aqui você só muda a data reservada.")
                .padding(.top, Spacing.sm)
        }
    }

    private func save() {
        isSaving = true
        savingError = nil
        Task {
            do {
                guard var evento = repo.find(id: eventoId)?.evento else {
                    isSaving = false
                    savingError = "Evento não encontrado. Feche e abra de novo."
                    return
                }
                // Mesma convenção de fuso do create: meia-noite local em ms.
                let cal = Calendar(identifier: .iso8601)
                let inicioDia = cal.startOfDay(for: dataEvento)
                evento.dataEvento = Int64(inicioDia.timeIntervalSince1970 * 1000)
                try await repo.update(evento: evento)
                isSaving = false
                onClose()
            } catch {
                isSaving = false
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - StintMockDetalheView (resumo só-leitura do stint de exemplo)
// 2026-06-19 — "liga" o tap no card de stint dos eventos seedados
// (exemplo). Stints reais abrem PosStintView (lê do StintRepository);
// como o exemplo não tem sessão no banco, mostramos um resumo só-leitura
// com os próprios dados do StintMock, claramente marcado como exemplo.

struct StintMockDetalheView: View {
    let stint: StintMock
    let contextoLinha: String
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
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

                    VStack(alignment: .leading, spacing: 6) {
                        Eyebrow(text: "Stint \(stint.numero) · exemplo")
                        Text(stint.titulo)
                            .font(.system(size: 28, weight: .semibold))
                            .tracking(-0.7)
                            .foregroundStyle(Color.text)
                        Text(contextoLinha)
                            .font(.system(size: 14, weight: .regular))
                            .monospacedDigit()
                            .foregroundStyle(Color.textMuted)
                    }
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, 14)

                    HStack(spacing: 8) {
                        statCell(value: "\(stint.numero)", label: "Stint", isOuro: false)
                        statCell(value: "\(stint.voltas)", label: "Voltas", isOuro: false)
                        statCell(value: formatTempoMs(stint.melhorVoltaMs), label: "Melhor", isOuro: true)
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
                    .padding(.top, 18)

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
                    .padding(.horizontal, Spacing.xs)
                    .padding(.top, 14)

                    HelperNote(text: "Este é um stint de exemplo (evento seedado). O resumo completo com voltas e vídeo aparece nos stints que você registrar de verdade no evento.")
                        .padding(.top, 18)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, 4)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
    }

    private func statCell(value: String, label: String, isOuro: Bool) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 18, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.36)
                .foregroundStyle(isOuro ? Color.ouro : Color.text)
                .lineLimit(1)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.6)
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
