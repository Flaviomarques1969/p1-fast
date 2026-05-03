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
                    onCreated: { _ in sheet = nil }
                )
                .environmentObject(stintRepo)
                .environmentObject(carroRepo)
                .environmentObject(pneuRepo)
                .environmentObject(combustivelRepo)
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
                    ForEach(reais) { stint in
                        StintCardReal(
                            stint: stint,
                            isFinalizing: finalizingStintId == stint.id,
                            onTap: { abrirStintReal(stint) }
                        )
                    }
                } else {
                    // Eventos seedados — fallback pros mocks de design.
                    ForEach(mocks) { stint in
                        StintCardMock(stint: stint)
                    }
                }
                AddStintCTA(onTap: { sheet = .novoStint })
            }
        }
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
}

// MARK: - Sheet enum

enum EventoDetalheSheet: Identifiable, Equatable {
    case novoStint
    case posStint(stintId: String)
    case pendencias

    var id: String {
        switch self {
        case .novoStint: return "novo-stint"
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
                    .fill(stint.isAtivo ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(stint.isAtivo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isFinalizing)
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
