// ═══════════════════════════════════════════════════════════
// DebriefView — Bloco 6 do plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Tela mostrada após encerrar um stint. Lista:
//   • Tempo total + delta vs melhor anterior
//   • Trechos onde melhorou / regrediu / igualou
//   • Top 3 oportunidades reais (priorizadas)
//   • Plano sugerido pro próximo stint
//   • Pendências sugeridas + badge de estoque
//
// Recebe um `ResumoDebrief` pronto (gerado pelo `montarDebrief` do
// core). Hoje (sem T4000) o caller passa um resumo mock — quando o
// T4000 entrar, vem da análise real do stint.

import SwiftUI
import P1FastCore

struct DebriefView: View {
    let resumo: ResumoDebrief
    let estoque: [DisponibilidadeEstoque]
    let onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                cabecalho
                blocoTempoTotal
                if !resumo.pendenciasSugeridas.isEmpty {
                    blocoPendencias
                }
                blocoTrechos
                blocoOportunidades
                blocoPlano
            }
            .padding(Spacing.md)
        }
        .background(Color.black.ignoresSafeArea())
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Fechar", action: onClose)
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("DEBRIEF · Stint")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(resumo.stintId)
                .font(.footnote.monospaced())
                .foregroundStyle(.tertiary)
        }
    }

    private var blocoTempoTotal: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(String(format: "Tempo total %.2f s", resumo.tempoTotalS))
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
            if let melhor = resumo.tempoMelhorAnteriorS {
                let delta = resumo.deltaTotalS
                let texto = delta < 0
                    ? String(format: "Melhorou %.2f s vs melhor anterior (%.2f s)", -delta, melhor)
                    : String(format: "Perdeu %.2f s vs melhor anterior (%.2f s)", delta, melhor)
                Text(texto)
                    .font(.subheadline)
                    .foregroundStyle(delta < 0 ? Color.green : Color.orange)
            } else {
                Text("Primeiro stint deste piloto neste evento.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }

    private var blocoPendencias: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pendências sugeridas pela IA")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
            ForEach(resumo.pendenciasSugeridas, id: \.trechoId) { p in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(p.titulo).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        Spacer()
                        Text(p.severidade.uppercased())
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(p.severidade == "alta" ? Color.red : Color.orange,
                                        in: .capsule)
                            .foregroundStyle(.white)
                    }
                    Text(p.descricao)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(badgeEstoqueParaPendencia(pendencia: p, estoque: estoque))
                        .font(.caption2.monospaced())
                        .foregroundStyle(.cyan)
                }
                .padding(10)
                .background(Color.red.opacity(0.10), in: .rect(cornerRadius: 8))
            }
        }
    }

    private var blocoTrechos: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trechos · onde mudou")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
            if !resumo.trechosMelhoraram.isEmpty {
                listaDiff(titulo: "Melhorou", diffs: resumo.trechosMelhoraram, cor: .green)
            }
            if !resumo.trechosRegrediram.isEmpty {
                listaDiff(titulo: "Regrediu", diffs: resumo.trechosRegrediram, cor: .orange)
            }
            if !resumo.trechosIgualaram.isEmpty {
                listaDiff(titulo: "Igualou", diffs: resumo.trechosIgualaram, cor: .gray)
            }
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }

    private func listaDiff(titulo: String, diffs: [DiffTrecho], cor: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(titulo) · \(diffs.count)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(cor)
            ForEach(diffs, id: \.trechoId) { d in
                HStack {
                    Text(d.trechoId)
                        .font(.caption.monospaced())
                        .foregroundStyle(.white)
                    Spacer()
                    Text(String(format: "%+.2f s", d.deltaS))
                        .font(.caption.monospaced())
                        .foregroundStyle(cor)
                }
            }
        }
    }

    private var blocoOportunidades: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Top oportunidades reais")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
            ForEach(resumo.topOportunidades, id: \.trechoId) { o in
                HStack {
                    Text(o.trechoId)
                        .font(.caption.monospaced())
                        .foregroundStyle(.white)
                    Spacer()
                    Text(o.causaProvavel)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(String(format: "%.2f m/s²", o.deltaAcumuladoMs2))
                        .font(.caption.monospaced())
                        .foregroundStyle(.cyan)
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }

    private var blocoPlano: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Plano sugerido pro próximo stint")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
            ForEach(resumo.plano, id: \.trechoId) { p in
                HStack(alignment: .top, spacing: 8) {
                    Text("\(p.prioridade)")
                        .font(.title3.bold())
                        .foregroundStyle(.yellow)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.trechoId)
                            .font(.caption.monospaced())
                            .foregroundStyle(.tertiary)
                        Text(p.acao)
                            .font(.subheadline)
                            .foregroundStyle(.white)
                    }
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Mock para o painel do carro acessar o debrief antes do T4000
// ─────────────────────────────────────────────────────────────

/// Constrói um ResumoDebrief sintético quando ainda não há análise real.
/// Útil pra Flávio ver o layout funcionando no iPhone sem T4000.
func debriefExemplo() -> ResumoDebrief {
    let oport = [
        OportunidadeMotor(trechoId: "Curva 6", deltaAcumuladoMs2: 2.1, causaProvavel: "motor_abaixo"),
        OportunidadeMotor(trechoId: "Curva 3", deltaAcumuladoMs2: 1.2, causaProvavel: "marcha_baixa"),
        OportunidadeMotor(trechoId: "Reta 7→8", deltaAcumuladoMs2: 0.6, causaProvavel: "pedal_parcial"),
    ]
    let pend = [
        PendenciaSugerida(
            trechoId: "Curva 6",
            titulo: "Motor caindo na Curva 6",
            descricao: "Delta cresceu 56% nos 3 últimos stints. Sugerir checar vela e filtro de ar.",
            severidade: "alta"
        ),
    ]
    let temposAtuais = [
        TempoTrecho(trechoId: "Curva 1", tempoS: 11.5),
        TempoTrecho(trechoId: "Curva 6", tempoS: 14.2),
        TempoTrecho(trechoId: "Reta 7→8", tempoS: 12.1),
    ]
    let melhor: [String: Double] = [
        "Curva 1": 11.4,
        "Curva 6": 13.8,
        "Reta 7→8": 12.1,
    ]
    return montarDebrief(
        stintId: "Stint 3 (exemplo)",
        temposAtuais: temposAtuais,
        melhorPorTrecho: melhor,
        melhorVoltaAnteriorS: 37.3,
        oportunidades: oport,
        pendenciasSugeridas: pend
    )
}
