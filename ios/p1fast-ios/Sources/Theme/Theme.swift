// ═══════════════════════════════════════════════════════════
// Theme — tokens visuais Padrão B (canônico)
// ═══════════════════════════════════════════════════════════
// Espelha 1:1 as variáveis CSS de
// _design-reference/historico-evento/mockup-evento-B.html
// (e dos outros mockups Padrão B que reúsam o mesmo `:root`).
//
// Não recalcular OKLCH aqui — os valores sRGB estão pinados em
// docs/THEME_TOKENS.md e validados por tests/node-smoke-oklch.mjs
// (10 conversões assert iguais às referências). Quando precisar de
// uma cor nova, primeiro extraia o OKLCH do mockup → rode
// `node tools/oklch-to-srgb.mjs` → atualize THEME_TOKENS.md →
// só então adicione token aqui.
//
// Uso típico:
//   Color.surface, Color.accent, ...
//   Font.titleP1, Font.bodyP1, ...
//   Spacing.md, Radius.md
//
// Sem ícones decorativos em qualquer componente que use estes
// tokens — texto puro em todos os labels (princípio inegociável).

import SwiftUI

// MARK: - Cores (10 tokens nomeados de docs/THEME_TOKENS.md)

extension Color {
    /// `--bg` — `oklch(20% 0.005 240)` → `#141618`
    static let surface = Color(red: 20.0/255, green: 22.0/255, blue: 24.0/255)

    /// `--surface` — `oklch(24% 0.005 240)` → `#1d2021`
    static let surfaceRaised = Color(red: 29.0/255, green: 32.0/255, blue: 33.0/255)

    /// `--surface-2` — `oklch(28% 0.005 240)` → `#27292b`. Hover/pressed states.
    static let surfaceHover = Color(red: 39.0/255, green: 41.0/255, blue: 43.0/255)

    /// `--hairline` — `oklch(33% 0.005 240)` → `#333638`. Divisórias finas.
    static let border = Color(red: 51.0/255, green: 54.0/255, blue: 56.0/255)

    /// `--text` — `oklch(95% 0.003 240)` → `#edeff0`. Texto principal.
    static let text = Color(red: 237.0/255, green: 239.0/255, blue: 240.0/255)

    /// `--text-2` — `oklch(75% 0.01 240)` → `#a8afb4`. Texto secundário.
    static let textMuted = Color(red: 168.0/255, green: 175.0/255, blue: 180.0/255)

    /// `--text-3` — `oklch(58% 0.012 240)` → `#747b81`. Texto leve / hint.
    static let textFaint = Color(red: 116.0/255, green: 123.0/255, blue: 129.0/255)

    /// `--accent` — `oklch(78% 0.13 235)` → `#55c4fe`. Azul minimalista do hub.
    static let accent = Color(red: 85.0/255, green: 196.0/255, blue: 254.0/255)

    /// `--accent-2` — `oklch(82% 0.10 235 / .15)` → `#81cffc` α=0.15.
    /// Pill de eyebrow (background tonal). Aplicar opacidade em modificador.
    static let accentDim = Color(red: 129.0/255, green: 207.0/255, blue: 252.0/255)

    /// `--green` — `oklch(78% 0.16 150)` → `#5fd37f`. Sucesso / "PB do dia".
    static let success = Color(red: 95.0/255, green: 211.0/255, blue: 127.0/255)

    /// Variantes derivadas (não viraram token público no CSS, mas aparecem
    /// inline em hovers/borders/text-on-accent). Mantidas como helpers
    /// internos — não expor como API geral.

    /// `oklch(40% 0.10 235)` → `#004e75`. Background do chip ativo do tipo "data picker".
    static let accentDeep = Color(red: 0.0/255, green: 78.0/255, blue: 117.0/255)

    /// `oklch(15% 0.01 235)` → `#070c0f`. Texto sobre o accent (botão primário).
    static let onAccent = Color(red: 7.0/255, green: 12.0/255, blue: 15.0/255)

    /// `oklch(82% 0.14 235)` → `#58d2ff`. Hover do accent.
    static let accentHover = Color(red: 88.0/255, green: 210.0/255, blue: 255.0/255)

    // MARK: - Tokens semânticos do hub (Sprint 1A.2 — docs/THEME_TOKENS_HUB.md)
    //
    // Aparecem em mockup-home-cheio, mockup-garagem, mockup-eventos-lista
    // e mockup-evento-detalhe. Foram extraídos por audit cruzado e estão
    // pinados em docs/THEME_TOKENS_HUB.md (mesma fórmula OKLCH→sRGB já
    // validada por tests/node-smoke-oklch.mjs).

    /// `--bom` — `oklch(78% 0.16 150)` → `#5fd37f`.
    /// Tag verde "PB do dia / desvio < 0.4s". Mesmo OKLCH de `success` —
    /// mantemos como alias semântico para deixar claro o uso "esse tempo
    /// foi bom" vs "operação concluiu com sucesso".
    static let bom = Color.success

    /// `--rec` — `oklch(70% 0.20 25)` → `#ff5f5b`.
    /// Indicador "rec" (gravando/em andamento) — pulse no stint vivo.
    static let rec = Color(red: 255.0/255, green: 95.0/255, blue: 91.0/255)

    /// `--atencao` — `oklch(82% 0.16 80)` → `#fab72a`.
    /// Tag amarela "atenção" — pneu velho, setup desatualizado, etc.
    static let atencao = Color(red: 250.0/255, green: 183.0/255, blue: 42.0/255)

    /// `--erro` — `oklch(70% 0.20 25)` → `#ff5f5b`. Alias de `rec`
    /// (mesmo OKLCH no mockup-garagem) — distingue intenção semântica:
    /// "rec" = gravando, "erro" = problema/falha.
    static let erro = Color.rec

    /// `--ouro` — `oklch(74% 0.16 73)` → `#e79800`.
    /// Tag dourada "melhor volta do dia" — destaca PB do evento.
    static let ouro = Color(red: 231.0/255, green: 152.0/255, blue: 0.0/255)
}

// MARK: - Tipografia (5 papéis)
//
// O mockup usa Inter (Google Fonts) com pesos 300-700. SwiftUI sem
// custom fonts cai no SF Pro do sistema, que é proxy aceitável (visual
// diff <2% pelo critério do prompt). Mono = SF Mono.
//
// Tracking (letterSpacing) reproduz exatamente os valores CSS:
//   display/title : -0.02em a -0.025em
//   body/caption  : neutro ou -0.005em
//   mono          : neutro

extension Font {
    /// Display — h1 / countdown / time-card value. ~36pt heavy.
    static let displayP1 = Font.system(size: 36, weight: .semibold).leading(.tight)

    /// Title — section title / card title / head__title. ~22pt semibold.
    static let titleP1 = Font.system(size: 22, weight: .semibold)

    /// Body — input value / picker__val / btn label. ~15-17pt medium.
    static let bodyP1 = Font.system(size: 15, weight: .medium)

    /// Caption — field__lbl / chip__top / event__sub. ~11-12pt regular/medium.
    static let captionP1 = Font.system(size: 12, weight: .regular)

    /// Mono — versão / build / tabular números. SF Mono.
    static let monoP1 = Font.system(size: 13, weight: .regular, design: .monospaced)
}

// MARK: - Espaçamento (literal do prompt #7)

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Raio (literal do prompt #7)
//
// Mockup B usa `--radius: 12px` como default. Valores adicionais:
//   - sm 8 — chip/picker__chev internos
//   - md 12 — cards / inputs / pickers (igual --radius)
//   - lg 16 — pouco usado, reservado para sheets / containers grandes
//   - pill 999 — eyebrow / .tipo / fab / bottom-nav__dot indicators

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let pill: CGFloat = 999
}

// MARK: - Constantes auxiliares

enum Layout {
    /// Cor de fundo global do app (1° stop do gradient `body` no mockup).
    static let appBackground = Color.surface

    /// Padrão de animação dos componentes interativos do hub
    /// (`cubic-bezier(.34,1.56,.64,1)` no mockup, ~spring no SwiftUI).
    static let snap: Animation = .spring(response: 0.18, dampingFraction: 0.6)
}
