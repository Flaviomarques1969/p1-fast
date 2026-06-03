// ═══════════════════════════════════════════════════════════
// EventosListaView — port de mockup-eventos-lista.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #10. Hub temporal do produto: lista todos
// os eventos cadastrados em duas seções ("Próximo" + "Passados").
//
// Composição (1:1 com mockup):
//   - context-head: eyebrow "Eventos" + título "N eventos" + sub
//     "Próximo: <pista> · DD/MM" (pista+data em accent)
//   - group__head "Próximo" + contagem
//   - cards de eventos futuros (o de hoje vira `.event--proximo`,
//     com background accent leve + day em accent)
//   - group__head "Passados" + contagem
//   - cards de eventos passados (variante neutra, com summary
//     stints/voltas/melhor volta como tags)
//   - FAB "+ Novo evento" canto inferior direito
//   - BottomNav 4 itens com Eventos ATIVO (segundo)
//
// Dados: `EventoRepository.bootstrap()` semeia 3 eventos canônicos
// na primeira abertura (1 ativo hoje + 2 passados). Resumo de
// stints/voltas/melhor vem do `EventoMockSummary.canon(...)` enquanto
// Sprint 1A.3 não popula `sessoes` real.
//
// Tap em card → `EventoDetalheView` (sheet ou push). FAB → form
// "Novo evento" minimal (Sprint 1A.2 #10 não tem mockup canônico
// pro form, então usamos picker + cancel/salvar do FootBar do #9).

import SwiftUI
import P1FastCore

struct EventosListaView: View {
    @EnvironmentObject private var repo: EventoRepository
    @EnvironmentObject private var navCoordinator: NavigationCoordinator
    @State private var navSelection: BottomNavItem.ID?
    @State private var sheet: EventosSheet?
    private let navItems: [BottomNavItem] = [
        BottomNavItem("Home"),
        BottomNavItem("Eventos"),
        BottomNavItem("Cadastros"),
        BottomNavItem("Garagem"),
    ]

    /// Tab-like via NavigationCoordinator: cada item leva DIRETO pra
    /// tela alvo (substitui o stack). "Eventos" = no-op (já aqui).
    private func handleNavSelect(_ item: BottomNavItem) {
        switch item.label {
        case "Home":      navCoordinator.goHome()
        case "Garagem":   navCoordinator.goTo(.garagem)
        case "Cadastros": navCoordinator.goTo(.cadastros)
        case "Eventos":   break
        default:          break
        }
    }

    /// Permite abrir a tela já com uma sheet visível — usado pelos
    /// launch args `--p1-eventos-novo` / `--p1-evento-detalhe` pra
    /// screenshot rápida das modais.
    var initialSheet: EventosSheet?

    init(initialSheet: EventosSheet? = nil) {
        self.initialSheet = initialSheet
    }

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)
                .padding(.bottom, 140) // espaço pro menu de baixo (root)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .overlay(alignment: .bottomTrailing) {
            FAB("Novo evento") { sheet = .novo }
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 110) // sobe pro menu não cobrir
        }
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let s = initialSheet, sheet == nil { sheet = s }
        }
        .sheet(item: $sheet) { which in
            switch which {
            case .novo:
                EventoNovoFormView(onClose: { sheet = nil })
                    .environmentObject(repo)
            case .detalhe(let eventoId):
                EventoDetalheView(eventoId: eventoId, onClose: { sheet = nil })
                    .environmentObject(repo)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let proximos = eventosProximos
        let passados = eventosPassados
        VStack(alignment: .leading, spacing: 0) {
            contextHead(total: proximos.count + passados.count)

            if !proximos.isEmpty {
                groupHead(title: "Próximo", count: proximos.count)
                VStack(spacing: 8) {
                    ForEach(proximos) { ev in
                        EventoCard(
                            ev: ev,
                            kind: .proximo(diasRestantes: diasParaEvento(ev)),
                            onTap: { sheet = .detalhe(eventoId: ev.id) }
                        )
                    }
                }
            }

            if !passados.isEmpty {
                groupHead(title: "Passados", count: passados.count)
                VStack(spacing: 8) {
                    ForEach(passados) { ev in
                        EventoCard(
                            ev: ev,
                            kind: .passado(sumario: summaryFor(ev)),
                            onTap: { sheet = .detalhe(eventoId: ev.id) }
                        )
                    }
                }
            }

            if proximos.isEmpty && passados.isEmpty {
                emptyHint
            }
        }
    }

    // MARK: - Header e seções

    private func contextHead(total: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Eventos")
            Text(headerTitle(total: total))
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6) // -0.025em em 24pt
                .foregroundStyle(Color.text)
            if let proximo = repo.eventoAtivoHoje() ?? repo.proximoEvento() {
                Text(proximoSubtitle(for: proximo))
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.md)
    }

    private func headerTitle(total: Int) -> String {
        if total == 0 { return "Sem eventos" }
        if total == 1 { return "1 evento" }
        return "\(total) eventos"
    }

    /// "Próximo: Brasília · 02/05" (1 dia) ou "Próximo: Brasília · 02/05–04/05"
    /// (período) com pista+data em accent (igual `<strong>` do mockup).
    private func proximoSubtitle(for ev: EventoView) -> AttributedString {
        let strong = "\(ev.pistaDisplay) · \(formatPeriodoCurto(inicio: ev.evento.dataEvento, fim: ev.evento.dataFim))"
        var s = AttributedString("Próximo: \(strong)")
        if let range = s.range(of: strong) {
            s[range].foregroundColor = Color.accent
            s[range].font = .system(size: 13, weight: .semibold)
        }
        return s
    }

    /// Formata "DD/MM" pra evento de 1 dia, "DD/MM–DD/MM" pra período.
    func formatPeriodoCurto(inicio: Int64, fim: Int64) -> String {
        let curto = formatDayMonthShort(inicio)
        if inicio == fim { return curto }
        return "\(curto)–\(formatDayMonthShort(fim))"
    }

    private func groupHead(title: String, count: Int) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32) // 0.12em em 11pt
                .foregroundStyle(Color.textFaint)
            Spacer()
            Text("\(count)")
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.accent)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.top, 18)
        .padding(.bottom, 10)
    }

    private var emptyHint: some View {
        Text("Nenhum evento cadastrado ainda. Toque em \"Novo evento\" pra criar o primeiro.")
            .font(.system(size: 13, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .lineSpacing(3)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .padding(.top, Spacing.lg)
    }

    // MARK: - Particionamento

    private var eventosProximos: [EventoView] {
        let inicioHoje = msStartOfDay(Date())
        return repo.eventos
            .filter { $0.evento.dataEvento >= inicioHoje }
            // Mais recentes em cima (próximos primeiro).
            .sorted(by: { $0.evento.dataEvento < $1.evento.dataEvento })
    }

    private var eventosPassados: [EventoView] {
        let inicioHoje = msStartOfDay(Date())
        return repo.eventos
            .filter { $0.evento.dataEvento < inicioHoje }
            .sorted(by: { $0.evento.dataEvento > $1.evento.dataEvento })
    }

    private func diasParaEvento(_ ev: EventoView) -> Int {
        let cal = Calendar(identifier: .iso8601)
        let hoje = cal.startOfDay(for: Date())
        let alvo = cal.startOfDay(for: Date(timeIntervalSince1970: TimeInterval(ev.evento.dataEvento) / 1000))
        return cal.dateComponents([.day], from: hoje, to: alvo).day ?? 0
    }

    /// Resumo para card passado: prefere mock canônico se evento for
    /// seedado, senão cai no `sumarioPorEvento` real do repo.
    private func summaryFor(_ ev: EventoView) -> EventoCardSumario {
        if let mock = EventoMockSummary.canon(eventoId: ev.id) {
            return EventoCardSumario(
                stints: mock.stintsCount,
                voltas: mock.voltasCount,
                melhorFormatado: mock.melhorVoltaFormatado()
            )
        }
        let real = repo.sumarioPorEvento[ev.id]
        return EventoCardSumario(
            stints: real?.stints ?? 0,
            voltas: real?.voltas ?? 0,
            melhorFormatado: real?.melhorVoltaFormatado()
        )
    }
}

// MARK: - Sheet enum

enum EventosSheet: Identifiable, Equatable {
    case novo
    case detalhe(eventoId: String)

    var id: String {
        switch self {
        case .novo: return "novo"
        case .detalhe(let id): return "detalhe-\(id)"
        }
    }
}

// MARK: - Card

struct EventoCardSumario: Equatable {
    let stints: Int
    let voltas: Int
    let melhorFormatado: String?
}

enum EventoCardKind: Equatable {
    case proximo(diasRestantes: Int)
    case passado(sumario: EventoCardSumario)
}

private struct EventoCard: View {
    let ev: EventoView
    let kind: EventoCardKind
    let onTap: () -> Void

    private var isProximo: Bool {
        if case .proximo = kind { return true }
        return false
    }

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 14) {
                dateBlock
                bodyBlock
                Spacer(minLength: 0)
                chev
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(isProximo ? Color.accentDim.opacity(0.15) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isProximo ? Color.accent.opacity(0.55) : Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Sub-blocos

    private var dateBlock: some View {
        VStack(spacing: 3) {
            Text(formatDayDD(ev.evento.dataEvento))
                .font(.system(size: 20, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.4) // -0.02em em 20pt
                .foregroundStyle(isProximo ? Color.accent : Color.text)
                .lineLimit(1)
            Text(formatMonShort(ev.evento.dataEvento).uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.8) // 0.08em em 10pt
                .foregroundStyle(Color.textFaint)
        }
        .frame(width: 52, height: 52)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isProximo ? Color.accent.opacity(0.18) : Color.surfaceHover)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(isProximo ? Color.accent.opacity(0.45) : Color.border, lineWidth: 1)
        )
    }

    private var bodyBlock: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(ev.pistaDisplay)
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.08) // -0.005em em 16pt
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text(subtitleLine)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
            metaTags
                .padding(.top, 7)
        }
    }

    /// "Sábado · Nelson Piquet" — para próximo. Para passado, mockup só
    /// mostra "Nelson Piquet" (sem dia da semana).
    private var subtitleLine: String {
        let layout = ev.pistaLayoutShort
        switch kind {
        case .proximo:
            let weekday = formatWeekdayLong(ev.evento.dataEvento)
            if layout.isEmpty { return weekday }
            return "\(weekday) · \(layout)"
        case .passado:
            return layout.isEmpty ? "—" : layout
        }
    }

    @ViewBuilder
    private var metaTags: some View {
        switch kind {
        case .proximo(let dias):
            HStack(spacing: 6) {
                EventTag(text: faltaTag(dias: dias), kind: .accent)
                if let pct = pctProntoTag {
                    EventTag(text: pct, kind: .neutral)
                }
            }
        case .passado(let sumario):
            HStack(spacing: 6) {
                EventTag(text: "\(sumario.stints) stints", kind: .neutral)
                EventTag(text: "\(sumario.voltas) voltas", kind: .neutral)
                if let melhor = sumario.melhorFormatado {
                    EventTag(text: melhor, kind: .bom)
                }
            }
        }
    }

    private func faltaTag(dias: Int) -> String {
        if dias <= 0 { return "Hoje" }
        if dias == 1 { return "Falta 1 dia" }
        return "Faltam \(dias) dias"
    }

    private var pctProntoTag: String? {
        guard let mock = EventoMockSummary.canon(eventoId: ev.id) else { return nil }
        return "\(mock.pctPronto)% pronto"
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
            .padding(.top, 12)
    }
}

// MARK: - Helpers de data (compartilhados com EventoDetalheView)

/// "02" — dia 2 dígitos.
func formatDayDD(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.timeZone = .current
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "dd"
    return f.string(from: date)
}

/// "Mai" — abreviação 3 letras pt-BR.
func formatMonShort(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.timeZone = .current
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "MMM"
    let raw = f.string(from: date)
    // pt-BR no iOS devolve "mai." / "abr." — normalizamos pra "Mai" / "Abr".
    let semPonto = raw.replacingOccurrences(of: ".", with: "")
    return semPonto.prefix(1).uppercased() + semPonto.dropFirst().lowercased()
}

/// "02/05" — dia/mês.
func formatDayMonthShort(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.timeZone = .current
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "dd/MM"
    return f.string(from: date)
}

/// "Sábado", "Domingo", etc. — capitalizada.
func formatWeekdayLong(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.timeZone = .current
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "EEEE"
    let raw = f.string(from: date)
    return raw.prefix(1).uppercased() + raw.dropFirst()
}

/// "Sábado, 25/04 · Nelson Piquet" — header do detalhe.
func formatDataLongaPiquet(ms: Int64, layoutShort: String) -> String {
    let weekday = formatWeekdayLong(ms)
    let day = formatDayMonthShort(ms)
    if layoutShort.isEmpty { return "\(weekday) · \(day)" }
    return "\(weekday) · \(day) · \(layoutShort)"
}

/// Header longo do detalhe quando o evento é período. 2026-05-16:
///   1 dia       → "Sábado · 23/05 · Nelson Piquet"
///   2+ dias     → "Sáb 23/05 ao Dom 24/05 · Nelson Piquet"
func formatPeriodoLongoPiquet(inicioMs: Int64, fimMs: Int64, layoutShort: String) -> String {
    if inicioMs == fimMs {
        return formatDataLongaPiquet(ms: inicioMs, layoutShort: layoutShort)
    }
    let inicioShort = formatWeekdayShort(inicioMs)
    let fimShort = formatWeekdayShort(fimMs)
    let inicioDia = formatDayMonthShort(inicioMs)
    let fimDia = formatDayMonthShort(fimMs)
    let periodo = "\(inicioShort) \(inicioDia) ao \(fimShort) \(fimDia)"
    if layoutShort.isEmpty { return periodo }
    return "\(periodo) · \(layoutShort)"
}

/// "Sáb", "Dom", "Sex" — abreviado pra header de período.
func formatWeekdayShort(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    let f = DateFormatter()
    f.timeZone = .current
    f.locale = Locale(identifier: "pt_BR")
    f.dateFormat = "EEE"
    let raw = f.string(from: date).replacingOccurrences(of: ".", with: "")
    return raw.prefix(1).uppercased() + raw.dropFirst()
}

/// Timestamp ms da meia-noite local de uma data.
func msStartOfDay(_ d: Date) -> Int64 {
    let cal = Calendar(identifier: .iso8601)
    let start = cal.startOfDay(for: d)
    return Int64(start.timeIntervalSince1970 * 1000)
}

// MARK: - Previews

#Preview("EventosLista — 1 ativo + 2 passados") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = EventoRepository(queue: queue)
    return EventosListaView()
        .environmentObject(repo)
        .task { await repo.bootstrap() }
}
