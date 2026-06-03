// ═══════════════════════════════════════════════════════════
// PistaGravacaoPlaceholderView — gravar nova pista (Pendência 5)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos · Flávio 2026-05-17. Decisão P5A:
// "Item A (gravar volta). Padrão visual igual Brasília (fundo
// preto, pista cinza). Pra cadastrar autódromo novo, precisa
// gravar 10 voltas completas."
//
// ESTA TELA É PLACEHOLDER ESTRUTURADO. A captura GPS contínua + a
// montagem do traçado a partir das 10 voltas exige integração com
// o serviço de captura existente (mesmo que roda o stint normal),
// detecção automática de cruzamento da linha de chegada e
// "limpeza" dos pontos. Esse desenvolvimento vai entrar numa
// próxima rodada — esta tela hoje só REGISTRA a intenção e
// abre a estrutura pra plumbar a captura no futuro.

import SwiftUI
import P1FastCore

struct PistaGravacaoPlaceholderView: View {
    let autodromoId: String
    let onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow(text: "Gravar pista")
                    Text("Captura do traçado")
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(Color.text)
                    Text("Você vai rodar 10 voltas completas e o aplicativo monta o desenho da pista a partir do GPS.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.xs)

                aviso

                comoFunciona

                Button {
                    // Placeholder — a captura real entra na próxima
                    // rodada. Por ora, só fecha a tela.
                    onClose()
                } label: {
                    Text("Voltar (gravação em construção)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.text)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .fill(Color.surfaceRaised)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(Color.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 100)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .navigationTitle("Gravar pista")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Fechar", action: onClose).foregroundStyle(Color.text)
            }
        }
        .preferredColorScheme(.dark)
    }

    private var aviso: some View {
        Text("Função de captura em construção. A estrutura desta tela e o cadastro do autódromo já estão prontos pra receber o traçado. A gravação real do GPS + montagem automática do desenho entram na próxima rodada de desenvolvimento.")
            .font(.system(size: 13))
            .foregroundStyle(Color.atencao)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.atencao.opacity(0.10))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.atencao.opacity(0.5), lineWidth: 1)
            )
    }

    private var comoFunciona: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("COMO VAI FUNCIONAR")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.textFaint)
            passo("1. Você posiciona o iPhone no carro e toca em 'Iniciar gravação'.")
            passo("2. Roda 10 voltas completas. O aplicativo grava o GPS contínuo.")
            passo("3. Ao completar 10 voltas, o aplicativo monta o desenho da pista (padrão visual igual Brasília — fundo preto, pista cinza).")
            passo("4. O traçado é salvo automaticamente no autódromo, pronto pra usar nos stints.")
            passo("5. Depois, você pode ajustar entrada/saída/ápice de cada trecho na ficha do trecho.")
        }
        .padding(14)
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

    private func passo(_ t: String) -> some View {
        Text(t).font(.system(size: 13)).foregroundStyle(Color.text)
    }
}
