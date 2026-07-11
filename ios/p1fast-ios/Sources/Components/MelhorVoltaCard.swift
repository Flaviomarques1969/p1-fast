// ═══════════════════════════════════════════════════════════
// MelhorVoltaCard — "Sua melhor volta" (Home Dia de Pista, J2)
// ═══════════════════════════════════════════════════════════
// Espelha o bloco `.bestlap` de
// _design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html
// (blocos "Sua melhor volta"), usando SÓ tokens de Theme.swift.
//
// Composição:
// Sem eyebrow interna — o título "SUA MELHOR VOLTA · Histórico" é o
// cabeçalho de seção da Home, logo acima do cartão (evita duplicação).
//
//   ┌──────────────────────────────────────────────┐
//   │ ╭─╮  1:42.3          ↓ −0,8s     ← traço+tempo│
//   │ ╰─╯  Brasília · Celta · abr        (evolução) │
//   └──────────────────────────────────────────────┘
//
// Estado honesto: `melhorMs == nil` → tempo "—" e sem evolução.
// A evolução verde SÓ aparece quando `evolucaoMs` vier de verdade
// (regra do Flávio: nada de número inventado; verde = melhorou).
//
// Sem ícones decorativos/emoji — a seta da evolução e o mini traçado
// são desenhados com Path (traço fino), princípio inegociável do projeto.

import SwiftUI

struct MelhorVoltaCard: View {
    /// Melhor tempo em milissegundos. `nil` = ainda não há volta → "—".
    let melhorMs: Int?
    /// Linha de contexto (ex.: "Brasília · Celta 1.4 · abr 2026"). `nil` = oculta.
    let contexto: String?
    /// Evolução vs. a marca anterior, em ms (negativo = melhorou). `nil` = oculta.
    let evolucaoMs: Int?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            // Sem eyebrow interna: a Home já tem o cabeçalho de seção
            // "SUA MELHOR VOLTA · Histórico" logo acima (evita duplicação).
            HStack(alignment: .center, spacing: 14) {
                    // Mini traçado oficial da pista — traço fino, reaproveita
                    // o desenho medido/aprovado (PistaBrasilia.swift).
                    PistaBrasiliaMapa(cor: Color.accent.opacity(0.9), espessura: 1.8)
                        .frame(width: 54, height: 46)

                    // Tempo grande tabular + contexto
                    VStack(alignment: .leading, spacing: 4) {
                        tempoView
                        if let contexto, !contexto.isEmpty {
                            Text(contexto)
                                .font(.system(size: 12, weight: .regular))
                                .foregroundStyle(Color.textMuted)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Evolução — SÓ quando há dado real
                    if let evolucaoMs {
                        deltaView(evolucaoMs)
                    }
            }
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Tempo

    @ViewBuilder
    private var tempoView: some View {
        if let melhorMs {
            let t = Self.formatarTempo(melhorMs)
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(t.principal)
                    .font(.system(size: 26, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.text)
                Text(t.decimo)
                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.textMuted)
            }
            .tracking(-0.6) // -0.03em em 26pt
        } else {
            Text("—")
                .font(.system(size: 26, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color.textFaint)
        }
    }

    // MARK: - Evolução (verde = melhorou)

    private func deltaView(_ ms: Int) -> some View {
        HStack(spacing: 4) {
            SetaEvolucao(paraCima: ms >= 0)
                .stroke(Color.success, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                .frame(width: 12, height: 12)
            Text(Self.formatarDelta(ms))
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.success)
        }
    }

    // MARK: - Formatação

    /// `102300` ms → ("1:42", ".3"). Arredonda ao décimo mais próximo.
    static func formatarTempo(_ ms: Int) -> (principal: String, decimo: String) {
        let totalDecimos = (max(0, ms) + 50) / 100
        let min = totalDecimos / 600
        let seg = (totalDecimos % 600) / 10
        let dec = totalDecimos % 10
        return (String(format: "%d:%02d", min, seg), String(format: ".%d", dec))
    }

    /// `-800` ms → "−0,8s"; `+300` → "+0,3s" (vírgula decimal PT-BR, sinal U+2212).
    static func formatarDelta(_ ms: Int) -> String {
        let seg = Double(abs(ms)) / 1000.0
        let valor = String(format: "%.1f", seg).replacingOccurrences(of: ".", with: ",")
        let sinal = ms < 0 ? "\u{2212}" : "+"
        return "\(sinal)\(valor)s"
    }
}

// MARK: - Seta de evolução (traço, sem emoji)

/// Seta vertical fina (corpo + ponta). `paraCima == false` = melhorou (desce),
/// espelha a intenção "caiu o tempo". Desenhada em viewBox 12×12.
private struct SetaEvolucao: Shape {
    let paraCima: Bool

    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        let cx = rect.midX
        var p = Path()
        if paraCima {
            p.move(to: CGPoint(x: cx, y: h * 0.92))
            p.addLine(to: CGPoint(x: cx, y: h * 0.08))
            p.move(to: CGPoint(x: w * 0.22, y: h * 0.42))
            p.addLine(to: CGPoint(x: cx, y: h * 0.08))
            p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.42))
        } else {
            p.move(to: CGPoint(x: cx, y: h * 0.08))
            p.addLine(to: CGPoint(x: cx, y: h * 0.92))
            p.move(to: CGPoint(x: w * 0.22, y: h * 0.58))
            p.addLine(to: CGPoint(x: cx, y: h * 0.92))
            p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.58))
        }
        return p
    }
}

// MARK: - Previews

#Preview("MelhorVolta — com dado + evolução") {
    MelhorVoltaCard(
        melhorMs: 102_300,
        contexto: "Brasília · Celta 1.4 · abr 2026",
        evolucaoMs: -800,
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("MelhorVolta — sem dado (—)") {
    MelhorVoltaCard(
        melhorMs: nil,
        contexto: nil,
        evolucaoMs: nil,
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("MelhorVolta — só tempo, sem evolução") {
    MelhorVoltaCard(
        melhorMs: 98_700,
        contexto: "Brasília · Celta 1.4",
        evolucaoMs: nil,
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
