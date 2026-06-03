// ═══════════════════════════════════════════════════════════
// SeisIndicadoresTrecho — Comando GO 2026-05-24
// ═══════════════════════════════════════════════════════════
// Componente reutilizável que renderiza a tabela canônica dos 6
// indicadores por trecho:
//
//   Volta  | V chegada | 2.Freada | 1.Entrada | 3.Vmin | 4.Pace | V saída pico
//   --------------------------------------------------------------------------
//   Volta 2| 156,0     | 153,1    | 136,4     | 104,8  | 106,8  | 142,3
//   ...
//   Melhor | 155,7     | 153,1    | 131,9     | 101,8  | 106,8  | 142,3
//
// Cores por grupo (espelha o relatório HTML `_arquivado/
// trechos-6-indicadores-LIMPO-2026-05-23.html`):
//   - Freada (V chegada, Freada, Entrada): laranja (Color.atencao)
//   - Curva  (Vmin):                       vermelho (Color.erro)
//   - Saída  (Pace, V saída pico):         verde (Color.bom)
//
// Recebe uma lista de `SegmentExecution` JÁ FILTRADAS pelo trecho.
// Caller é responsável por agrupar/filtrar. "Volta N" é derivada do
// `numero` da `Volta` (lookup feito por dicionário voltaId→numero).
//
// Regra dura: SEM ÍCONES. Texto puro, tabular numérico, monospace.

import SwiftUI
import P1FastCore

struct SeisIndicadoresTrecho: View {
    /// Nome do trecho (cabeçalho) — ex.: "Curva da Reta Oposta".
    let tituloTrecho: String

    /// Execuções desse trecho neste stint (na ordem cronológica das voltas).
    let execucoes: [SegmentExecution]

    /// voltaId → número de volta (vem do StintRepository.voltas).
    let voltaNumeroById: [String: Int]

    /// Conselho da IA (Entrega 3) — opcional. Quando passado, aparece
    /// embaixo da tabela como uma frase em destaque.
    let conselhoIA: String?

    init(
        tituloTrecho: String,
        execucoes: [SegmentExecution],
        voltaNumeroById: [String: Int],
        conselhoIA: String? = nil
    ) {
        self.tituloTrecho = tituloTrecho
        self.execucoes = execucoes
        self.voltaNumeroById = voltaNumeroById
        self.conselhoIA = conselhoIA
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Cabeçalho do trecho
            HStack(alignment: .center, spacing: 8) {
                Text(tituloTrecho)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.text)
                Spacer()
                Text("\(execucoes.count) \(execucoes.count == 1 ? "passagem" : "passagens")")
                    .font(.system(size: 11, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(Color.textFaint)
            }
            .padding(.bottom, 4)

            // Cabeçalho das colunas
            HStack(spacing: 0) {
                colHeader("Volta", grupo: nil, leading: true)
                colHeader("Cheg.", grupo: .freada)
                colHeader("Freada", grupo: .freada)
                colHeader("Entr.", grupo: .freada)
                colHeader("Vmin", grupo: .curva)
                colHeader("Pace", grupo: .saida)
                colHeader("Pico", grupo: .saida)
            }

            // Linhas — cada execução em ordem cronológica
            ForEach(Array(execucoes.enumerated()), id: \.offset) { _, exec in
                row(exec: exec, isMelhor: false)
            }

            // Linha "Melhor"
            if execucoes.count > 1 {
                Rectangle()
                    .fill(Color.border)
                    .frame(height: 1)
                    .padding(.vertical, 4)
                row(exec: melhorPorIndicador(execucoes), isMelhor: true, voltaLabel: "Melhor")
            }

            // Conselho da IA
            if let conselho = conselhoIA, !conselho.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Rectangle()
                        .fill(Color.accent)
                        .frame(width: 3)
                    Text(conselho)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Color.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 8)
                .padding(.leading, 2)
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

    // MARK: - Linha de volta

    private func row(exec: SegmentExecution, isMelhor: Bool, voltaLabel: String? = nil) -> some View {
        HStack(spacing: 0) {
            voltaCell(text: voltaLabel ?? rotuloVolta(exec.voltaId), isMelhor: isMelhor)
            valorCell(exec.vChegadaKmh, grupo: .freada, isMelhor: isMelhor)
            valorCell(exec.vFreadaKmh,  grupo: .freada, isMelhor: isMelhor)
            valorCell(exec.vEntradaKmh, grupo: .freada, isMelhor: isMelhor)
            valorCell(exec.vminKmh,     grupo: .curva,  isMelhor: isMelhor)
            valorCell(exec.vPaceKmh,    grupo: .saida,  isMelhor: isMelhor)
            valorCell(exec.vSaidaPicoKmh, grupo: .saida, isMelhor: isMelhor)
        }
    }

    // MARK: - Células

    private enum Grupo {
        case freada, curva, saida
    }

    private func colHeader(_ text: String, grupo: Grupo?, leading: Bool = false) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .semibold))
            .tracking(0.5)
            .foregroundStyle(grupo.map(corDoGrupo) ?? Color.textFaint)
            .frame(maxWidth: .infinity, alignment: leading ? .leading : .trailing)
            .padding(.horizontal, 4)
            .padding(.vertical, 6)
            .background(grupo.map { corDoGrupo($0).opacity(0.08) } ?? Color.clear)
    }

    private func voltaCell(text: String, isMelhor: Bool) -> some View {
        Text(text)
            .font(.system(size: 12, weight: isMelhor ? .bold : .medium))
            .foregroundStyle(isMelhor ? Color.ouro : Color.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
            .padding(.vertical, 6)
    }

    private func valorCell(_ v: Double?, grupo: Grupo, isMelhor: Bool) -> some View {
        let txt = v.map { String(format: "%.1f", $0) } ?? "—"
        let cor = isMelhor ? Color.ouro : corDoGrupo(grupo)
        return Text(txt)
            .font(.system(size: 12, weight: isMelhor ? .semibold : .medium, design: .monospaced))
            .foregroundStyle(cor)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.horizontal, 4)
            .padding(.vertical, 6)
            .background(corDoGrupo(grupo).opacity(0.04))
    }

    private func corDoGrupo(_ g: Grupo) -> Color {
        switch g {
        case .freada: return Color.atencao
        case .curva:  return Color.erro
        case .saida:  return Color.bom
        }
    }

    // MARK: - Helpers

    private func rotuloVolta(_ voltaId: String) -> String {
        if let n = voltaNumeroById[voltaId] {
            return "V\(n)"
        }
        return "—"
    }

    /// "Melhor da sessão" por indicador. Definição:
    /// - Vmin: a MAIOR Vmin (carro foi mais rápido no apex)
    /// - Pace / V saída pico: as MAIORES (mais rápido saindo)
    /// - V chegada / V entrada: as MAIORES (chegou mais rápido)
    /// - Freada: a MAIOR (freou mais tarde sem perder mais velocidade)
    /// Regra simples: usa MAX em todos. Funciona como referência de
    /// "melhor número observado nessa sessão pra cada indicador".
    private func melhorPorIndicador(_ exs: [SegmentExecution]) -> SegmentExecution {
        func best(_ pick: (SegmentExecution) -> Double?) -> Double? {
            exs.compactMap(pick).max()
        }
        return SegmentExecution(
            id: "melhor", timeId: "", sessaoId: "", voltaId: "_melhor_",
            vminKmh: best { $0.vminKmh },
            vChegadaKmh: best { $0.vChegadaKmh },
            vEntradaKmh: best { $0.vEntradaKmh },
            vFreadaKmh: best { $0.vFreadaKmh },
            vPaceKmh: best { $0.vPaceKmh },
            vSaidaPicoKmh: best { $0.vSaidaPicoKmh }
        )
    }
}

// MARK: - Previews

#Preview("Sem dados") {
    SeisIndicadoresTrecho(
        tituloTrecho: "Curva da Reta Oposta",
        execucoes: [],
        voltaNumeroById: [:]
    )
    .padding()
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("1 passagem") {
    let ex = SegmentExecution(
        id: "x", timeId: "", sessaoId: "", voltaId: "v2",
        vminKmh: 104.8,
        vChegadaKmh: 156.0, vEntradaKmh: 136.4, vFreadaKmh: 153.1,
        vPaceKmh: 106.8, vSaidaPicoKmh: 142.3
    )
    return SeisIndicadoresTrecho(
        tituloTrecho: "Curva da Reta Oposta",
        execucoes: [ex],
        voltaNumeroById: ["v2": 2]
    )
    .padding()
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("3 passagens + IA") {
    let voltas = [
        SegmentExecution(id: "a", timeId: "", sessaoId: "", voltaId: "v2",
                         vminKmh: 104.8, vChegadaKmh: 156.0, vEntradaKmh: 136.4,
                         vFreadaKmh: 153.1, vPaceKmh: 106.8, vSaidaPicoKmh: 142.3),
        SegmentExecution(id: "b", timeId: "", sessaoId: "", voltaId: "v3",
                         vminKmh: 103.6, vChegadaKmh: 155.9, vEntradaKmh: 136.2,
                         vFreadaKmh: 153.6, vPaceKmh: 105.6, vSaidaPicoKmh: 140.2),
        SegmentExecution(id: "c", timeId: "", sessaoId: "", voltaId: "v4",
                         vminKmh: 101.8, vChegadaKmh: 155.7, vEntradaKmh: 131.9,
                         vFreadaKmh: 153.5, vPaceKmh: 105.7, vSaidaPicoKmh: 141.1),
    ]
    return SeisIndicadoresTrecho(
        tituloTrecho: "Curva da Reta Oposta",
        execucoes: voltas,
        voltaNumeroById: ["v2": 2, "v3": 3, "v4": 4],
        conselhoIA: "Curva da Reta Oposta: Pace 1 km/h abaixo da sua melhor. Pouca aceleração na saída."
    )
    .padding()
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
