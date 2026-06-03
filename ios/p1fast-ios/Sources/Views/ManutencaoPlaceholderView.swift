// ═══════════════════════════════════════════════════════════
// ManutencaoPlaceholderView — botão criado, função pendente
// ═══════════════════════════════════════════════════════════
// 2026-05-17 (Flávio): "Crie a função Manutenção. Aqui vou informar
// troca de óleo, troca de filtro, troca de fluidos, troca de peças
// — é aqui que vamos gerir a manutenção do carro. Mas não inicie
// esse desenvolvimento agora. Vamos concluir o que está fazendo dos
// próximos passos. É só já fazer a alteração e criar o botão."
//
// Esta tela é APENAS o destino do botão "Manutenção" do header da
// Garagem. Quando o gestor autorizar a próxima rodada, esta view
// vira o CRUD real de itens de manutenção do carro.

import SwiftUI

struct ManutencaoPlaceholderView: View {
    let onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow(text: "Manutenção")
                    Text("Em breve")
                        .font(.system(size: 26, weight: .semibold))
                        .tracking(-0.65)
                        .foregroundStyle(Color.text)
                    Text("Função reservada — entra na próxima rodada.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.xs)

                HelperNote(text: "Aqui você vai registrar troca de óleo, troca de filtros, troca de fluidos, troca de peças e tudo que envolve manutenção do carro. O cadastro real entra na próxima rodada — por enquanto só o botão está reservado.")
                    .padding(.top, Spacing.sm)

                VStack(alignment: .leading, spacing: 8) {
                    Text("O QUE VAI ENTRAR")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(Color.textFaint)
                    bullet("Troca de óleo (com data, marca, quilometragem)")
                    bullet("Troca de filtros (ar, óleo, combustível)")
                    bullet("Troca de fluidos (freio, arrefecimento, transmissão)")
                    bullet("Troca de peças (com histórico)")
                    bullet("Periodicidade — alerta quando se aproxima do próximo serviço")
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
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 100)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .navigationTitle("Manutenção")
        .navigationBarTitleDisplayMode(.inline)
        // 2026-05-17: back nativo do iOS aparece automaticamente.
        // Button("Fechar") removido — sobrava do tempo em que esta tela
        // era janela modal.
        .preferredColorScheme(.dark)
    }

    private func bullet(_ texto: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("·")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.textMuted)
            Text(texto)
                .font(.system(size: 13))
                .foregroundStyle(Color.text)
            Spacer(minLength: 0)
        }
    }
}
