// ═══════════════════════════════════════════════════════════
// EyebrowHeader — eyebrow + título grande + summary opcional
// ═══════════════════════════════════════════════════════════
// Espelha `.eyebrow + .header__status / .card__title + .gauges` do
// mockup-home-cheio.html (Padrão B). É a "abertura" de cada tela e
// também aparece no topo de cards principais.
//
// Composição:
//   ┌────────────────────────────────┐
//   │ ● PRÓXIMO EVENTO   ← Eyebrow   │
//   │ Brasília · 2 de maio  ← Title  │
//   │ Sábado, 02/05         ← Sub    │
//   └────────────────────────────────┘
//
// Sem ícones. O dot do eyebrow é primitivo geométrico (Circle), não
// "ícone decorativo". O prompt #7 trata isso explicitamente — mockup
// usa <span class="eyebrow__dot"> que é só um disco de 5px.

import SwiftUI

/// Pill "eyebrow" — uppercase, accent, background tonal.
/// Aparece sozinho como kicker antes do título de uma seção.
///
/// `tint` permite o eyebrow virar rótulo de FASE do momento do dia
/// (Onda 4, 2026-06-22): azul (.accent) = Preparar, vermelho (.rec) =
/// Ao vivo, ouro (.ouro) = Concluído. Default = .accent → preserva o
/// visual de todas as telas que já usavam Eyebrow(text:).
struct Eyebrow: View {
    let text: String
    var tint: Color = .accent

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(tint)
                .frame(width: 5, height: 5)
            Text(text.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2) // 0.12em ≈ 1.2pt em 10pt
                .foregroundStyle(tint)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .background(
            Capsule().fill(tint.opacity(0.15))
        )
        .overlay(
            Capsule().stroke(tint.opacity(0.35), lineWidth: 1)
        )
    }
}

/// Cabeçalho completo: eyebrow + título + subtítulo opcional.
/// Equivalente ao `.header` do mockup-home-cheio.html quando a tela
/// abre com kicker (eyebrow) seguido do estado principal.
struct EyebrowHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String?

    init(eyebrow: String, title: String, subtitle: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Eyebrow(text: eyebrow)
            Text(title)
                .font(.titleP1)
                .tracking(-0.4) // -0.02em em 22pt
                .foregroundStyle(Color.text)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }
}

// MARK: - FaseTrilho — espinha do "momento do dia"

/// Preparar › Rodar › Revisar. A fase corrente fica acesa na cor da fase;
/// as outras esmaecidas. A régua fina embaixo mede um progresso REAL (0…1)
/// quando faz sentido (ex.: % de prontidão das pendências). Onda 4
/// (2026-06-22) — espelha o trilho do mockup premium aprovado. Sem ícones:
/// só os rótulos e o separador "›" (glifo de texto).
enum FaseMomento: Int {
    case preparar = 0
    case rodar = 1
    case revisar = 2
}

struct FaseTrilho: View {
    let atual: FaseMomento
    /// 0…1 da régua; nil = não desenha régua.
    var progresso: Double? = nil
    /// Cor da fase atual.
    var tint: Color = .accent
    /// Cor da régua; default = mesma da fase atual.
    var rulerTint: Color? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                faseLabel(.preparar, "Preparar")
                separador
                faseLabel(.rodar, "Rodar")
                separador
                faseLabel(.revisar, "Revisar")
            }
            if let progresso {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.surfaceHover)
                        Capsule()
                            .fill(rulerTint ?? tint)
                            .frame(width: max(0, min(1, progresso)) * geo.size.width)
                    }
                }
                .frame(height: 3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func faseLabel(_ f: FaseMomento, _ t: String) -> some View {
        Text(t.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.8) // 0.08em em 10pt
            .foregroundStyle(f == atual ? tint : Color.textFaint)
    }

    private var separador: some View {
        Text("›")
            .font(.system(size: 11))
            .foregroundStyle(Color.textFaint)
    }
}

// MARK: - Previews

#Preview("Eyebrow — sozinho") {
    VStack(alignment: .leading, spacing: Spacing.md) {
        Eyebrow(text: "Próximo evento")
        Eyebrow(text: "Stint em andamento")
        Eyebrow(text: "Sugestão")
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("EyebrowHeader — completo") {
    VStack(alignment: .leading, spacing: Spacing.xl) {
        EyebrowHeader(
            eyebrow: "Próximo evento",
            title: "Brasília · 2 de maio",
            subtitle: "Sábado, 02/05 · 09:00 · Nelson Piquet"
        )

        EyebrowHeader(
            eyebrow: "Stint em andamento",
            title: "Volta 4 de 10",
            subtitle: nil
        )
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
