// ═══════════════════════════════════════════════════════════
// EvolucaoCarroView — Bloco 6 do plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Linha do tempo de evolução por trecho. Recebe lista de
// `LinhaEvolucao` pronta (uma por trecho). Hoje carrega dados de
// exemplo — quando o banco de stints históricos crescer, vem do
// repositório.

import SwiftUI
import P1FastCore

struct EvolucaoCarroView: View {
    let carroId: String
    let onClose: () -> Void

    @State private var linhas: [LinhaEvolucao] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                cabecalho
                if linhas.isEmpty {
                    estadoVazio
                } else {
                    ForEach(linhas, id: \.trechoId) { linha in
                        cardLinha(linha)
                    }
                }
            }
            .padding(Spacing.md)
        }
        .background(Color.black.ignoresSafeArea())
        .onAppear {
            linhas = exemploEvolucao()
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Fechar", action: onClose)
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SUA EVOLUÇÃO")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text("Carro \(carroId)")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Text("Últimos 5 eventos por trecho")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var estadoVazio: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ainda não há histórico suficiente.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Rode mais stints com este carro e os trechos vão aparecer aqui.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }

    private func cardLinha(_ linha: LinhaEvolucao) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(linha.trechoId)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(tendenciaTexto(linha.tendencia))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(tendenciaCor(linha.tendencia))
            }
            HStack(spacing: 4) {
                ForEach(linha.pontos, id: \.eventoId) { p in
                    VStack(spacing: 2) {
                        Text(String(format: "%.1f", p.tempoMelhorS))
                            .font(.caption2.monospaced())
                            .foregroundStyle(.white)
                        Text(p.dataIso.prefix(10))
                            .font(.caption2.monospaced())
                            .foregroundStyle(.tertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.06), in: .rect(cornerRadius: 6))
                }
            }
            HStack {
                Text(String(format: "Melhor: %.2f s", linha.melhorAbsolutoS))
                    .font(.caption)
                    .foregroundStyle(.green)
                Spacer()
                Text(String(format: "Último: %.2f s", linha.ultimoS))
                    .font(.caption)
                    .foregroundStyle(.cyan)
            }
        }
        .padding(Spacing.md)
        .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 12))
    }

    private func tendenciaTexto(_ t: String) -> String {
        switch t {
        case "melhorando": return "MELHORANDO"
        case "regredindo": return "REGREDINDO"
        default: return "ESTÁVEL"
        }
    }

    private func tendenciaCor(_ t: String) -> Color {
        switch t {
        case "melhorando": return .green
        case "regredindo": return .orange
        default: return .gray
        }
    }
}

// Exemplo enquanto não há histórico real
private func exemploEvolucao() -> [LinhaEvolucao] {
    let curva1 = montarLinhaEvolucao(
        trechoId: "Curva 1",
        historico: [
            PontoEvolucao(eventoId: "BSB 03", dataIso: "2026-04-15", tempoMelhorS: 11.85),
            PontoEvolucao(eventoId: "BSB 04", dataIso: "2026-04-30", tempoMelhorS: 11.62),
            PontoEvolucao(eventoId: "BSB 05", dataIso: "2026-05-10", tempoMelhorS: 11.50),
            PontoEvolucao(eventoId: "BSB 06", dataIso: "2026-05-18", tempoMelhorS: 11.41),
        ]
    )
    let curva6 = montarLinhaEvolucao(
        trechoId: "Curva 6 (Bruxa)",
        historico: [
            PontoEvolucao(eventoId: "BSB 03", dataIso: "2026-04-15", tempoMelhorS: 13.80),
            PontoEvolucao(eventoId: "BSB 04", dataIso: "2026-04-30", tempoMelhorS: 13.95),
            PontoEvolucao(eventoId: "BSB 05", dataIso: "2026-05-10", tempoMelhorS: 14.10),
            PontoEvolucao(eventoId: "BSB 06", dataIso: "2026-05-18", tempoMelhorS: 14.22),
        ]
    )
    return [curva1, curva6].compactMap { $0 }
}
