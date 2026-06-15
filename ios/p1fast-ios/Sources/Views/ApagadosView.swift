// ═══════════════════════════════════════════════════════════
// ApagadosView — lista de itens apagados de uma entidade + resgate
// ═══════════════════════════════════════════════════════════
// Pedido de Flávio 2026-06-14: apagar do app, mas guardar pra resgatar.
// Tela genérica (serve carros/pilotos/passageiros/combustível/lições):
// mostra o que foi escondido e oferece "Resgatar" em cada linha.
//
// É "burra": recebe o ArquivoRepository (pra reagir à lista) e um closure
// `onRestaurar` que a tela-pai implementa (ela é quem tem o repositório da
// entidade pra trazer o item de volta à lista). Assim esta view não precisa
// conhecer os 5 repositórios.

import SwiftUI
import P1FastCore

/// As 5 entidades da Garagem que podem ser apagadas/resgatadas.
/// O `rawValue` casa com a coluna `entidade` da tabela `item_arquivado`.
enum EntidadeArquivavel: String {
    case carros, pilotos, passageiros, combustiveis, licoes

    var tituloApagados: String {
        switch self {
        case .carros: return "Carros apagados"
        case .pilotos: return "Pilotos apagados"
        case .passageiros: return "Passageiros apagados"
        case .combustiveis: return "Combustíveis apagados"
        case .licoes: return "Lições apagadas"
        }
    }

    var singular: String {
        switch self {
        case .carros: return "carro"
        case .pilotos: return "piloto"
        case .passageiros: return "passageiro"
        case .combustiveis: return "combustível"
        case .licoes: return "lição"
        }
    }
}

struct ApagadosView: View {
    @ObservedObject var arquivoRepo: ArquivoRepository
    let entidade: EntidadeArquivavel
    let onRestaurar: (ItemArquivado) -> Void
    let onClose: () -> Void

    private var itens: [ItemArquivado] { arquivoRepo.itens(entidade: entidade.rawValue) }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.surface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    header
                    if itens.isEmpty {
                        emptyState
                    } else {
                        VStack(spacing: 10) {
                            ForEach(itens) { item in
                                linha(item)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            FootBar(onCancel: onClose, onSave: onClose, saveLabel: "Fechar", canSave: true)
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Apagados")
            Text(entidade.tituloApagados)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("Apagar não destrói. O que você apaga fica guardado aqui — toque em Resgatar pra trazer de volta.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
    }

    private var emptyState: some View {
        Text("Nada apagado por aqui. Quando você apagar um \(entidade.singular), ele aparece nesta lista pra resgatar.")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .lineSpacing(3)
            .padding(.horizontal, 16)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
    }

    private func linha(_ item: ItemArquivado) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.rotulo.isEmpty ? "(sem nome)" : item.rotulo)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.08)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                Text("Apagado em \(quando(item.arquivadoEm))")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            Button { onRestaurar(item) } label: {
                Text("Resgatar")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.accent)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color.accent.opacity(0.14)))
                    .overlay(Capsule().stroke(Color.accent.opacity(0.35), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
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

    /// Data curta em pt-BR (ex.: "14 de jun").
    private func quando(_ ms: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(ms) / 1000.0)
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "d 'de' MMM"
        return f.string(from: date)
    }
}

/// Linha-atalho "Apagados (N)" pra entrar na lixeira de uma sub-aba.
/// Some quando não há nada apagado (count = 0).
struct ApagadosAtalho: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                Text("Apagados")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                Spacer(minLength: 0)
                Text("\(count)")
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.textMuted)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.textFaint)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
