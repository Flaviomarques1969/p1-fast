// ═══════════════════════════════════════════════════════════
// AoVivoRow — cartão fino "Ao vivo agora" (Home Dia de Pista, J2)
// ═══════════════════════════════════════════════════════════
// Espelha o bloco `.live` de
// _design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html,
// usando SÓ tokens de Theme.swift.
//
// Composição:
//   ┌──────────────────────────────────────────────┐
//   │ ●  Ao vivo agora                 Assistir ›   │
//   │    Treino livre · Autódromo de Brasília       │
//   └──────────────────────────────────────────────┘
//
// Regras do Flávio respeitadas:
//   - PROIBIDO borda vermelha (vermelho só p/ crítico). O "ao vivo" usa
//     ponto VERDE discreto (success), como no mockup.
//   - Estado honesto: sem transmissão (`aoVivoAgora == false`) → sem ponto
//     verde, título "Ao vivo" apagado e ação "Assistir" em tom fraco.
//   - Sem emoji: o ponto é primitivo geométrico (Circle) e o chevron é
//     desenhado com Path (traço fino).

import SwiftUI

struct AoVivoRow: View {
    /// Há transmissão acontecendo agora?
    let aoVivoAgora: Bool
    /// Segunda linha opcional (ex.: "Treino livre · Autódromo de Brasília").
    let subtitulo: String?
    let onTap: () -> Void

    private var titulo: String { aoVivoAgora ? "Ao vivo agora" : "Ao vivo" }
    private var corAcao: Color { aoVivoAgora ? Color.accent : Color.textFaint }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                // Ponto verde discreto — SÓ quando está no ar (glow suave).
                if aoVivoAgora {
                    Circle()
                        .fill(Color.success)
                        .frame(width: 7, height: 7)
                        .overlay(
                            Circle()
                                .fill(Color.success.opacity(0.12))
                                .frame(width: 15, height: 15)
                        )
                        .frame(width: 15, height: 15)
                } else {
                    Circle()
                        .stroke(Color.border, lineWidth: 1)
                        .frame(width: 7, height: 7)
                        .frame(width: 15, height: 15)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(titulo)
                        .font(.system(size: 13.5, weight: .bold))
                        .tracking(-0.13)
                        .foregroundStyle(aoVivoAgora ? Color.text : Color.textMuted)
                    if let subtitulo, !subtitulo.isEmpty {
                        Text(subtitulo)
                            .font(.system(size: 11.5, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Ação "Assistir ›"
                HStack(spacing: 5) {
                    Text("Assistir")
                        .font(.system(size: 12, weight: .bold))
                    Chevron()
                        .stroke(corAcao, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                        .frame(width: 7, height: 12)
                }
                .foregroundStyle(corAcao)
                .fixedSize()
            }
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                // Borda neutra — NUNCA vermelha (regra do Flávio).
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Chevron (traço, sem emoji)

/// Chevron ">" fino, viewBox 7×12 (aponta pra direita).
private struct Chevron: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        return p
    }
}

// MARK: - Previews

#Preview("AoVivo — no ar") {
    AoVivoRow(
        aoVivoAgora: true,
        subtitulo: "Treino livre · Autódromo de Brasília",
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("AoVivo — no ar, sem subtítulo") {
    AoVivoRow(
        aoVivoAgora: true,
        subtitulo: nil,
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("AoVivo — desligado") {
    AoVivoRow(
        aoVivoAgora: false,
        subtitulo: "Nada acontecendo agora",
        onTap: {}
    )
    .padding(Spacing.md)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
