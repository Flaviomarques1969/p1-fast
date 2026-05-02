// ═══════════════════════════════════════════════════════════
// EventoDetalheView — port de mockup-evento-detalhe.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #10. Tela de drill-down de um evento.
//
// Composição (1:1 com mockup):
//   - topbar: "‹ Eventos" (back) à esquerda + "Editar" à direita
//   - event-head: eyebrow "Evento" + título grande (28pt) + sub
//     "Sábado · 25/04 · Nelson Piquet"
//   - summary card 4-cells: Stints / Voltas / Melhor (em ouro) / Pronto%
//   - group__head "Stints" + contagem
//   - lista de stint cards (numerador 42x42 + título + sub + tags)
//   - CTA inline dashed "+ Novo stint" (criação chega no Sprint 1A.3)
//
// Dados de stints vêm de `EventoMockSummary.canon(eventoId:)` enquanto
// a Sprint 1A.3 não popula a tabela `sessoes`. Para eventos criados
// pelo usuário (não-seedados), a lista de stints fica vazia mas o
// CTA inline continua aparecendo.

import SwiftUI
import P1FastCore

struct EventoDetalheView: View {
    @EnvironmentObject private var repo: EventoRepository
    let eventoId: String
    let onClose: () -> Void

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
        let stints = stintsFor(ev)
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Stints")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32) // 0.12em em 11pt
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(stints.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 10)

            VStack(spacing: 8) {
                ForEach(stints) { stint in
                    StintCard(stint: stint)
                }
                AddStintCTA()
                    .padding(.top, stints.isEmpty ? 0 : 0)
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

// MARK: - StintCard

private struct StintCard: View {
    let stint: StintMock

    var body: some View {
        Button(action: { /* drill-down de stint chega no Sprint 1A.3 */ }) {
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

// MARK: - Add Stint CTA (dashed inline)

private struct AddStintCTA: View {
    var body: some View {
        Button(action: { /* criação chega no Sprint 1A.3 */ }) {
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
    return EventoDetalheView(eventoId: EventoRepository.seedPassado1Id, onClose: {})
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
