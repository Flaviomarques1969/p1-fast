// ═══════════════════════════════════════════════════════════
// CarroRowCompacta — linha compacta de carro (bloco "Seus carros")
// ═══════════════════════════════════════════════════════════
// Espelha `.car` de _design-reference/propostas-home-2026-07-11/
// proposta-a-dia-de-pista.html (Home "Dia de Pista", aprovada por
// Flávio 2026-07-11 — painel p1fast-home-conceito-1444).
//
// Composição (esquerda → direita):
//   ┌──────────────────────────────────────────────┐
//   │ [◲]  Celta 1.4              31       ›        │
//   │      Ativo · último stint   STINTS            │
//   └──────────────────────────────────────────────┘
//   • swatch arredondado com a COR do carro + carro em traço
//   • apelido semibold + sub (modelo / último stint) apagado
//   • nº de stints tabular à direita ("31" grande + "STINTS" mínimo)
//   • seta › SÓ quando tocável (onTap != nil); nil = linha estática
//
// Contrato (COORDENACAO.md):
//   CarroRowCompacta(apelido:String, sub:String, cor:Color,
//                    stints:Int, onTap:(()->Void)?)
//
// Tokens só de Theme.swift. Ícones = traço (SVG → Path), nunca emoji
// (regra global do Flávio). Fundo escuro. Cor = do carro (não vira
// vermelho/âmbar semântico — é identidade do carro).

import SwiftUI

struct CarroRowCompacta: View {
    let apelido: String
    let sub: String
    let cor: Color
    let stints: Int
    let onTap: (() -> Void)?

    // Init explícito p/ travar a assinatura EXATA do contrato
    // (apelido, sub, cor, stints, onTap) — J5 consome por esta ordem.
    init(apelido: String, sub: String, cor: Color, stints: Int, onTap: (() -> Void)?) {
        self.apelido = apelido
        self.sub = sub
        self.cor = cor
        self.stints = stints
        self.onTap = onTap
    }

    var body: some View {
        // onTap presente → linha vira botão (abre a garagem/carro).
        // onTap nil → linha estática (sem chevron, sem toque).
        if let onTap {
            Button(action: onTap) { conteudo(tocavel: true) }
                .buttonStyle(.plain)
        } else {
            conteudo(tocavel: false)
        }
    }

    private func conteudo(tocavel: Bool) -> some View {
        HStack(spacing: 12) {
            swatch
            VStack(alignment: .leading, spacing: 1) {
                Text(apelido)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.14) // -0.01em em 14pt
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                Text(sub)
                    .font(.system(size: 11.5, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.sm)
            // Bloco de stints (tabular): número grande + rótulo mínimo.
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(stints)")
                    .font(.system(size: 15, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-0.3) // -0.02em em 15pt
                    .foregroundStyle(Color.text)
                Text("STINTS")
                    .font(.system(size: 9.5, weight: .semibold))
                    .tracking(0.95) // 0.1em em 9.5pt
                    .foregroundStyle(Color.textFaint)
            }
            if tocavel {
                ChevronRight()
                    .stroke(Color.textFaint, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                    .frame(width: 7, height: 12)
                    .padding(.leading, 2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .contentShape(Rectangle())
    }

    // Swatch arredondado tingido com a cor do carro + carro em traço.
    private var swatch: some View {
        RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
            .fill(cor.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                    .stroke(cor.opacity(0.20), lineWidth: 1)
            )
            .overlay(
                CarGlyph()
                    .stroke(cor, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                    .frame(width: 20, height: 20)
            )
            .frame(width: 36, height: 36)
    }
}

// MARK: - Ícones de traço (Path a partir do SVG viewBox 24×24 do mockup)

/// Carro em traço — reproduz o `<svg>` de `.car-icon` do mockup A.
/// Path original (24×24):
///   M4 16v-3l2-5.5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5L20 13v3
///   M4 13h16 · círculos (7.5,16.5) e (16.5,16.5) r1.8
struct CarGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24.0
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * s, y: rect.minY + y * s)
        }
        var path = Path()

        // Silhueta (capô + cabine), aberta.
        path.move(to: p(4, 16))
        path.addLine(to: p(4, 13))          // v-3
        path.addLine(to: p(6, 7.5))         // l2 -5.5
        path.addQuadCurve(to: p(7.9, 6), control: p(6, 6))   // arco p/ o teto
        path.addLine(to: p(16.1, 6))        // h8.2
        path.addQuadCurve(to: p(18, 7.5), control: p(18, 6)) // arco p/ trás
        path.addLine(to: p(20, 13))         // L20 13
        path.addLine(to: p(20, 16))         // v3

        // Linha da carroceria (M4 13 h16).
        path.move(to: p(4, 13))
        path.addLine(to: p(20, 13))

        // Rodas (círculos r1.8).
        let r: CGFloat = 1.8 * s
        path.addEllipse(in: CGRect(x: p(7.5, 16.5).x - r, y: p(7.5, 16.5).y - r, width: r * 2, height: r * 2))
        path.addEllipse(in: CGRect(x: p(16.5, 16.5).x - r, y: p(16.5, 16.5).y - r, width: r * 2, height: r * 2))

        return path
    }
}

/// Chevron › em traço — reproduz `m9 6 6 6-6 6` (viewBox 24×24) do mockup.
struct ChevronRight: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        return path
    }
}

// MARK: - Previews

#Preview("CarroRowCompacta — 2 carros (tocáveis)") {
    VStack(spacing: Spacing.sm) {
        CarroRowCompacta(
            apelido: "Celta 1.4",
            sub: "Ativo · último stint em Brasília",
            cor: .accent,
            stints: 31,
            onTap: {}
        )
        CarroRowCompacta(
            apelido: "Honda Civic",
            sub: "Ativo · último stint em Goiânia",
            cor: .success,
            stints: 16,
            onTap: {}
        )
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("CarroRowCompacta — estática (onTap nil) + zerada") {
    VStack(spacing: Spacing.sm) {
        // Linha estática: sem chevron, sem toque.
        CarroRowCompacta(
            apelido: "Fusca 1600",
            sub: "Sem stints ainda",
            cor: .atencao,
            stints: 0,
            onTap: nil
        )
        CarroRowCompacta(
            apelido: "Uno Mille",
            sub: "Guardado · último stint em Interlagos",
            cor: .ouro,
            stints: 8,
            onTap: {}
        )
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
