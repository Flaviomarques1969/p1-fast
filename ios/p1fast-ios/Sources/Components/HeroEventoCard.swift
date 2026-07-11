// ═══════════════════════════════════════════════════════════
// HeroEventoCard — herói do próximo evento (topo da Home "Dia de Pista")
// ═══════════════════════════════════════════════════════════
// Espelha o bloco `.hero` de
// _design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html
// (Conceito A aprovado pelo Flávio 2026-07-11, painel p1fast-home-conceito-1444).
//
// Responde à pergunta do gestor "o que importa hoje?": o próximo evento
// domina o topo, com prontidão (anel) e pendências visíveis ANTES de chegar
// na pista, e uma única ação óbvia no 1º toque ("Iniciar Stint").
//
// Composição:
//   ┌──────────────────────────────────────────────┐
//   │ PRÓXIMO EVENTO              ╭───────╮         │
//   │ Brasília                    │  64%  │ ← anel  │
//   │ 2 de maio · Autódromo BSB   ╰───────╯         │
//   │ ⌜EM 2 DIAS⌟ ← selo âmbar (azul "HOJE" se 0)   │
//   │ ┌──────────────────────────────────────────┐ │
//   │ │ △ 3 pendências antes da pista          › │ │ ← tocável
//   │ └──────────────────────────────────────────┘ │
//   │ ┌──────────────────────────────────────────┐ │
//   │ │            ▷  Iniciar Stint              │ │ ← CTA azul
//   │ └──────────────────────────────────────────┘ │
//   └──────────────────────────────────────────────┘
//
// Estados honestos (nada de dado fictício):
//   - prontidaoPct == nil  → anel SOME (não invento "0%").
//   - pendenciasAbertas 0  → linha de pendências SOME.
//   - diasAte == 0         → selo "HOJE" AZUL (accent) em vez de âmbar.
//
// Padrão de cor: âmbar (Color.atencao) = atenção sem alarme; azul
// (Color.accent) = ação/estado ativo. VERMELHO não entra aqui (reservado a
// crítico — regra geral do Flávio 2026-07-09). Sem emoji: todos os ícones
// são traço geométrico via SF Symbols de linha.

import SwiftUI

struct HeroEventoCard: View {
    let pista: String
    let dataISO: String
    let pistaOficial: String?
    let horario: String?
    let diasAte: Int
    let prontidaoPct: Int?
    let pendenciasAbertas: Int
    let onPendencias: () -> Void
    let onStint: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            heroTopo
            if pendenciasAbertas > 0 {
                pendenciaLinha
                    .padding(.top, 14)
            }
            botaoStint
                .padding(.top, 14)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { fundoHero }
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    // MARK: - Topo: evento (esquerda) + anel de prontidão (direita)

    private var heroTopo: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Text(ehHoje ? "Ativo · Hoje" : "Próximo evento")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.4) // 0.14em em 10pt
                    .textCase(.uppercase)
                    .foregroundStyle(Color.accent.opacity(0.85))

                Text(pista)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.44) // -0.02em em 22pt
                    .foregroundStyle(Color.text)
                    .padding(.top, 5)

                Text(metaLinha)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, 3)

                seloContagem
                    .padding(.top, 10)
            }

            Spacer(minLength: 0)

            if let pct = prontidaoPct {
                AnelProntidao(pct: pct)
            }
        }
    }

    /// Data + autódromo. Autódromo só entra se `pistaOficial` real (senão
    /// mostra só a data — "—" honesto sem inventar nome de pista).
    private var metaLinha: String {
        let data = dataLegivel
        guard let oficial = pistaOficial, !oficial.isEmpty else { return data }
        return "\(data) · \(oficial)"
    }

    /// dataISO ("2026-05-02") → "2 de maio". Se não casar o formato, devolve
    /// o valor cru — não inventa data.
    private var dataLegivel: String {
        let partes = dataISO.split(separator: "-")
        guard partes.count == 3,
              let mes = Int(partes[1]),
              let dia = Int(partes[2]),
              (1...12).contains(mes) else {
            return dataISO
        }
        let meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                     "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
        var linha = "\(dia) de \(meses[mes - 1])"
        if let horario, !horario.isEmpty { linha += " · \(horario)" }
        return linha
    }

    private var ehHoje: Bool { diasAte == 0 }

    // MARK: - Selo de contagem ("EM N DIAS" âmbar / "HOJE" azul)

    private var seloContagem: some View {
        let hoje = ehHoje
        let cor: Color = hoje ? Color.accent : Color.atencao
        let texto: String = {
            if hoje { return "Hoje" }
            if diasAte == 1 { return "Em 1 dia" }
            if diasAte < 0 { return "Em andamento" } // guarda: nunca "em -N dias"
            return "Em \(diasAte) dias"
        }()

        return HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.system(size: 10, weight: .bold))
            Text(texto)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.66) // 0.06em em 11pt
                .textCase(.uppercase)
        }
        .foregroundStyle(cor)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(cor.opacity(0.10)))
        .overlay(Capsule().stroke(cor.opacity(0.20), lineWidth: 1))
    }

    // MARK: - Linha de pendências (tocável, some com 0)

    private var pendenciaLinha: some View {
        Button(action: onPendencias) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.atencao)
                Text(pendenciaTexto)
                    .font(.system(size: 12.5, weight: .regular))
                    .foregroundStyle(Color.atencao.opacity(0.92))
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.atencao.opacity(0.5))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.atencao.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.atencao.opacity(0.14), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var pendenciaTexto: String {
        let n = pendenciasAbertas
        let palavra = n == 1 ? "pendência" : "pendências"
        return "\(n) \(palavra) antes da pista"
    }

    // MARK: - CTA "Iniciar Stint"

    private var botaoStint: some View {
        Button(action: onStint) {
            HStack(spacing: 9) {
                Image(systemName: "play.fill")
                    .font(.system(size: 15, weight: .bold))
                Text("Iniciar Stint")
                    .font(.system(size: 16, weight: .bold))
                    .tracking(-0.16) // -0.01em em 16pt
            }
            .foregroundStyle(Color.onAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                LinearGradient(
                    colors: [Color.accent, Color.accentDeep],
                    startPoint: .top, endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: Color.accent.opacity(0.22), radius: 12, x: 0, y: 6)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Fundo do hero (gradiente escuro + brilho azul no canto)

    private var fundoHero: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color(red: 19.0/255, green: 26.0/255, blue: 36.0/255),
                        Color(red: 14.0/255, green: 19.0/255, blue: 25.0/255),
                        Color(red: 12.0/255, green: 15.0/255, blue: 20.0/255),
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            )
            .overlay(alignment: .topTrailing) {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.accent.opacity(0.10), .clear],
                            center: .center, startRadius: 0, endRadius: 90
                        )
                    )
                    .frame(width: 180, height: 180)
                    .offset(x: 60, y: -60)
                    .allowsHitTesting(false)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

// MARK: - Anel de prontidão

/// Arco fino de prontidão: trilho cinza + arco âmbar preenchendo `pct`% no
/// sentido horário a partir do topo, com o número grande no centro.
/// Aparece só quando há prontidão real (o pai decide; nil = sem anel).
private struct AnelProntidao: View {
    let pct: Int

    private var fracao: CGFloat { CGFloat(max(0, min(100, pct))) / 100 }

    /// 100% pronto = verde (Color.bom); abaixo disso, âmbar (Color.atencao).
    private var corAnel: Color { pct >= 100 ? Color.bom : Color.atencao }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.07), lineWidth: 6)
            Circle()
                .trim(from: 0, to: fracao)
                .stroke(
                    corAnel,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round)
                )
                .rotationEffect(.degrees(-90)) // começa no topo
            VStack(spacing: 1) {
                Text("\(max(0, min(100, pct)))%")
                    .font(.system(size: 18, weight: .bold))
                    .monospacedDigit()
                    .tracking(-0.36)
                    .foregroundStyle(pct >= 100 ? Color.bom : Color.text)
                Text("Pronto")
                    .font(.system(size: 8, weight: .bold))
                    .tracking(0.8)
                    .textCase(.uppercase)
                    .foregroundStyle(Color.textFaint)
            }
        }
        .frame(width: 78, height: 78)
    }
}

// MARK: - Previews (4 estados exigidos pelo contrato)

#Preview("Hero — em N dias (completo)") {
    HeroEventoCard(
        pista: "Brasília",
        dataISO: "2026-05-02",
        pistaOficial: "Autódromo BSB",
        horario: nil,
        diasAte: 2,
        prontidaoPct: 64,
        pendenciasAbertas: 3,
        onPendencias: {},
        onStint: {}
    )
    .padding(16)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("Hero — HOJE (selo azul)") {
    HeroEventoCard(
        pista: "Goiânia",
        dataISO: "2026-05-04",
        pistaOficial: "Autódromo de Goiânia",
        horario: "09:00",
        diasAte: 0,
        prontidaoPct: 88,
        pendenciasAbertas: 1,
        onPendencias: {},
        onStint: {}
    )
    .padding(16)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("Hero — sem prontidão (anel some)") {
    HeroEventoCard(
        pista: "Interlagos",
        dataISO: "2026-06-14",
        pistaOficial: "Autódromo José Carlos Pace",
        horario: nil,
        diasAte: 12,
        prontidaoPct: nil,
        pendenciasAbertas: 2,
        onPendencias: {},
        onStint: {}
    )
    .padding(16)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}

#Preview("Hero — sem pendências (linha some)") {
    HeroEventoCard(
        pista: "Brasília",
        dataISO: "2026-05-02",
        pistaOficial: nil,
        horario: nil,
        diasAte: 5,
        prontidaoPct: 100,
        pendenciasAbertas: 0,
        onPendencias: {},
        onStint: {}
    )
    .padding(16)
    .frame(maxWidth: .infinity)
    .background(Color.surface)
    .preferredColorScheme(.dark)
}
