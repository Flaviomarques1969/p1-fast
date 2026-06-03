// ═══════════════════════════════════════════════════════════
// PosStintView — port reduzido de mockup-pos-stint.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #11. Tela exibida após `StintRepository.finalize`
// gerar as voltas. Substitui parte do mockup canônico (V-Min, trecho
// foco, sugestão pro próximo) por um resumo direto + lista de voltas
// + nota livre — alinha com o spec do queue:
//
//   - Header eyebrow + título "Stint #N"
//   - Hero card: melhor volta em ouro
//   - Summary 4-stats: Voltas / Melhor / Desvio médio / Consistência %
//   - Lista de voltas com tempo + tag PB do dia (ouro) / Desvio < 0.4s (verde)
//   - Campo de nota livre persistido em `sessao.objetivo` via repo.saveNota
//   - CTA "Finalizar e voltar"
//
// Voltas reais vêm de `voltas` (gravadas em `StintRepository.finalize`).
// Sprint 1B substitui o gerador determinístico por dado de cockpit real.

import SwiftUI
import P1FastCore

struct PosStintView: View {
    @EnvironmentObject private var repo: StintRepository
    let stintId: String
    let contextoLinha: String
    let onClose: () -> Void

    @State private var stint: Stint?
    @State private var voltas: [Volta] = []
    @State private var nota: String = ""
    @State private var savingNote = false
    @State private var loadError: String?
    /// Execuções dos trechos cronometrados nesse stint (Comando GO 2026-05-24).
    /// Carregadas em paralelo com voltas; podem ficar vazias quando o detector
    /// não estava armado.
    @State private var segmentExecutions: [SegmentExecution] = []

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: { /* Sem cancelar — pós-stint não tem rollback */ onClose() },
                onSave: salvarESair,
                saveLabel: "Finalizar e voltar",
                canSave: !savingNote
            )
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    @ViewBuilder
    private var content: some View {
        if let s = stint {
            VStack(alignment: .leading, spacing: Spacing.md) {
                contextHead(stint: s)
                hero(stint: s)
                summary4Stats
                voltasSection
                seisIndicadoresSection
                notaSection
                if let erro = loadError {
                    Text(erro)
                        .font(.captionP1)
                        .foregroundStyle(Color.erro)
                        .padding(.horizontal, Spacing.xs)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Eyebrow(text: "Stint encerrado")
                Text("Carregando…")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.top, Spacing.lg)
        }
    }

    // MARK: - Header

    private func contextHead(stint: Stint) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Stint encerrado")
            Text(stintTitulo(stint: stint))
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6) // -0.025em em 24pt
                .foregroundStyle(Color.text)
            if !contextoLinha.isEmpty {
                Text("\(contextoLinha) · \(stint.voltasCount) voltas")
                    .font(.system(size: 13, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    private func stintTitulo(stint: Stint) -> String {
        let (tipo, _) = stint.objetivoDecomposto
        if tipo.isEmpty { return "Stint" }
        return tipo
    }

    // MARK: - Hero (melhor volta)

    private func hero(stint: Stint) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("MELHOR VOLTA")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32) // 0.12em em 11pt
                .foregroundStyle(Color.textFaint)
            Text(formatTempoMs(stint.melhorVoltaMs ?? 0))
                .font(.system(size: 42, weight: .semibold))
                .monospacedDigit()
                .tracking(-1.26) // -0.03em em 42pt
                .foregroundStyle(Color.ouro)
                .lineLimit(1)
            if let consistenciaSub = consistenciaSubtitle {
                Text(consistenciaSub)
                    .font(.system(size: 12, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, 4)
            }
        }
        .padding(18)
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

    /// "−0.842s vs PB do dia" no canônico — sem PB tracker ainda no
    /// Sprint 1A.3, então mostramos só "Você completou N voltas".
    private var consistenciaSubtitle: String? {
        guard let s = stint, s.voltasCount > 0 else { return nil }
        return "Você completou \(s.voltasCount) volta\(s.voltasCount == 1 ? "" : "s") no stint."
    }

    // MARK: - Summary 4-stats

    private var summary4Stats: some View {
        let agg = aggregate
        return HStack(spacing: 8) {
            statCell(value: "\(agg.voltas)", label: "Voltas", isOuro: false)
            statCell(value: agg.melhorCurto ?? "—", label: "Melhor", isOuro: true)
            statCell(value: agg.desvioFmt, label: "Desvio", isOuro: false)
            statCell(value: "\(agg.consistencia)%", label: "Consist.", isOuro: false)
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
                .minimumScaleFactor(0.8)
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

    // MARK: - Voltas

    private var voltasSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Voltas")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32) // 0.12em em 11pt
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(voltas.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 10)

            VStack(spacing: 6) {
                ForEach(voltas, id: \.id) { v in
                    voltaRow(v)
                }
            }
        }
    }

    private func voltaRow(_ v: Volta) -> some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            Text("#\(v.numero)")
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.textMuted)
                .frame(width: 36, alignment: .leading)
            Text(v.tempoMs.map { formatTempoMs($0) } ?? "—")
                .font(.system(size: 16, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(v.valida ? Color.text : Color.textFaint)
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                if !v.valida {
                    EventTag(text: v.motivoInvalidacao ?? "Inválida", kind: .atencao)
                }
                if isPbDoDia(v) {
                    EventTag(text: "PB do dia", kind: .ouro)
                } else if isDesvioBaixo(v) {
                    EventTag(text: "Desvio < 0.4s", kind: .bom)
                }
            }
        }
        .padding(.horizontal, Spacing.md)
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

    // MARK: - 6 indicadores por trecho (Comando GO 2026-05-24)

    /// Mostra UMA tabela por trecho que apareceu nesse stint, com todas
    /// as passagens do piloto + linha "melhor". Conselho de IA (entrega 3)
    /// é gerado pelo `TrechoAdvisor` e injetado por trecho.
    @ViewBuilder
    private var seisIndicadoresSection: some View {
        let agrupado = trechosAgrupados()
        if !agrupado.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Trechos · 6 indicadores")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1.32)
                        .foregroundStyle(Color.textFaint)
                    Spacer()
                    Text("\(agrupado.count) \(agrupado.count == 1 ? "trecho" : "trechos")")
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.accent)
                }
                .padding(.horizontal, Spacing.xs)
                VStack(spacing: 10) {
                    ForEach(agrupado, id: \.segmentId) { grupo in
                        SeisIndicadoresTrecho(
                            tituloTrecho: grupo.titulo,
                            execucoes: grupo.execucoes,
                            voltaNumeroById: voltaNumeroById,
                            conselhoIA: TrechoAdvisor.conselho(
                                trechoNome: grupo.titulo,
                                execucoes: grupo.execucoes,
                                voltaNumeroById: voltaNumeroById
                            )
                        )
                    }
                }
            }
        }
    }

    private struct TrechoGrupo {
        let segmentId: String
        let titulo: String
        let execucoes: [SegmentExecution]
    }

    /// voltaId → numero (cache pra label "V2"/"V3"…).
    private var voltaNumeroById: [String: Int] {
        Dictionary(uniqueKeysWithValues: voltas.map { ($0.id, $0.numero) })
    }

    private func trechosAgrupados() -> [TrechoGrupo] {
        let porSegmento = Dictionary(grouping: segmentExecutions, by: { $0.segmentId ?? "—" })
        let chaves = porSegmento.keys.sorted()
        return chaves.compactMap { sid in
            guard let lista = porSegmento[sid], !lista.isEmpty else { return nil }
            // Ordena por número de volta (não por created_at) pra ficar
            // V2 → V3 → V4 no relatório.
            let ordenada = lista.sorted { a, b in
                let na = voltaNumeroById[a.voltaId] ?? 0
                let nb = voltaNumeroById[b.voltaId] ?? 0
                return na < nb
            }
            return TrechoGrupo(
                segmentId: sid,
                titulo: nomeAmigavel(segmentId: sid),
                execucoes: ordenada
            )
        }
    }

    /// Resolve nome amigável do segmento. Catálogo Brasília está em
    /// `MAPA-BRASILIA-DEFINITIVO.json`; aqui fazemos lookup mínimo pelos
    /// IDs canônicos. Sem match, mostra o ID cru.
    private func nomeAmigavel(segmentId: String) -> String {
        let catalogo: [String: String] = [
            "seg_brasilia_0": "Curva 01",
            "seg_brasilia_2": "Curva da Reta Oposta",
            "seg_brasilia_3": "Curva \"S\"",
            "seg_brasilia_4": "Junção",
            "seg_brasilia_5": "Curva da Bruxa",
            "seg_brasilia_6": "Placar",
            "seg_brasilia_7": "Chicane",
        ]
        return catalogo[segmentId] ?? segmentId
    }

    // MARK: - Nota

    private var notaSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Nota livre".uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.xs)
            FormField(label: "Nota", small: "opcional · só você") {
                FormInput(text: $nota, placeholder: "Ex: setup ficou solto no apex da Junção")
            }
        }
    }

    // MARK: - Cálculo de agregados

    private struct PosAggregate {
        let voltas: Int
        let melhorMs: Int?
        let melhorCurto: String?
        let desvioMediaMs: Int?
        let desvioFmt: String
        let consistencia: Int
    }

    private var aggregate: PosAggregate {
        let validas = voltas.filter { $0.valida && $0.tempoMs != nil }
        let total = voltas.count
        guard !validas.isEmpty else {
            return PosAggregate(voltas: total, melhorMs: nil, melhorCurto: nil, desvioMediaMs: nil, desvioFmt: "—", consistencia: 0)
        }
        let tempos = validas.compactMap { $0.tempoMs }
        let melhor = tempos.min()
        let media = tempos.reduce(0, +) / tempos.count
        // Desvio médio = média(|tempo - media|) em segundos.
        let desvioMs = tempos.map { abs($0 - media) }.reduce(0, +) / tempos.count
        // Consistência = 100 - (desvio% relativo à melhor volta), clamp [0, 100].
        let consistencia: Int = {
            guard let melhor, melhor > 0 else { return 0 }
            let pct = 100 - Int((Double(desvioMs) / Double(melhor)) * 100)
            return max(0, min(100, pct))
        }()
        let melhorCurto: String? = {
            guard let m = melhor else { return nil }
            let minutos = m / 60_000
            let segundos = (m % 60_000) / 1000
            let decimo = (m % 1000) / 100
            return String(format: "%d:%02d.%d", minutos, segundos, decimo)
        }()
        let desvioSeg = Double(desvioMs) / 1000.0
        let desvioFmt = String(format: "%.2fs", desvioSeg)
        return PosAggregate(
            voltas: total,
            melhorMs: melhor,
            melhorCurto: melhorCurto,
            desvioMediaMs: desvioMs,
            desvioFmt: desvioFmt,
            consistencia: consistencia
        )
    }

    // MARK: - Tags por volta

    private func isPbDoDia(_ v: Volta) -> Bool {
        guard v.valida, let ms = v.tempoMs, let pb = aggregate.melhorMs else { return false }
        return ms == pb
    }

    /// "Desvio < 0.4s" — diferença em relação à média das voltas válidas.
    private func isDesvioBaixo(_ v: Volta) -> Bool {
        guard v.valida, let ms = v.tempoMs else { return false }
        let validas = voltas.filter { $0.valida && $0.tempoMs != nil }.compactMap { $0.tempoMs }
        guard !validas.isEmpty else { return false }
        let media = validas.reduce(0, +) / validas.count
        return abs(ms - media) < 400 // 0.4s = 400ms
    }

    // MARK: - Carga + persistência

    private func carregar() async {
        do {
            let s = try await repo.fetchStint(id: stintId)
            let vs = try await repo.voltas(stintId: stintId)
            let segs = (try? await repo.segmentExecutions(stintId: stintId)) ?? []
            self.stint = s
            self.voltas = vs
            self.segmentExecutions = segs
            self.nota = s.nota
        } catch {
            self.loadError = "Não consegui carregar: \(error.localizedDescription)"
        }
    }

    private func salvarESair() {
        let trimmed = nota.trimmingCharacters(in: .whitespaces)
        // Só persiste se o usuário escreveu algo. Vazio = no-op.
        guard !trimmed.isEmpty else {
            onClose()
            return
        }
        savingNote = true
        Task {
            do {
                try await repo.saveNota(stintId: stintId, nota: trimmed)
                savingNote = false
                onClose()
            } catch {
                savingNote = false
                loadError = "Não consegui salvar a nota: \(error.localizedDescription)"
            }
        }
    }
}

#Preview("PosStint — preview vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = StintRepository(queue: queue)
    return PosStintView(
        stintId: "preview",
        contextoLinha: "Brasília · 02/05",
        onClose: {}
    )
    .environmentObject(repo)
    .task { await repo.bootstrap() }
}
