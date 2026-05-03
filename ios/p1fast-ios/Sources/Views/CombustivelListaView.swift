// ═══════════════════════════════════════════════════════════
// CombustivelListaView — port reduzido de mockup-combustivel-lista.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #15 (lista) + fix delete affordances.
//
// Origem do mockup: o `mockup-combustivel-lista.html` foi desenhado
// como SELETOR durante um stint (eyebrow "Combustível", subtitle
// "Stint #3 · Celta 1.4", footer Cancelar/Confirmar). Aqui usamos a
// MESMA estética visual (group head + linhas surface + dashed add)
// em modo CRUD: row sem radio, sem footer. Quando o seletor real
// entrar (Prompt #16+), embrulha esta view num wrapper que adiciona
// o estado de seleção e o footer.
//
// Mapeamento de campos (decisão do prompt):
//   - "Nome do tipo"  → combustiveis.nome
//   - "Observação"    → combustiveis.tipo (texto livre, ok pro v1)
//   - octanagem       → fora do form v1 (HelperNote no cadastro)
//
// Empty state explícito (mockup tem grupo "Cadastrados" + count) —
// quando count=0 mostra prompt pra cadastrar (princípio "nunca
// fabricar dados").
//
// CRUD completo: o body é um `Group` de rows pra ser usado DENTRO
// de um `List` parent (PessoasView). Cada row de combustível tem:
//   - tap-to-edit → callback `onTap(c)`
//   - swipeActions(.trailing) com botão "Apagar" destrutivo → callback `onDelete(c)`
// O parent (PessoasView) decide sheet de edit + alert de confirmação.

import SwiftUI
import P1FastCore

struct CombustivelListaView: View {
    @EnvironmentObject private var repo: CombustivelRepository
    var onAdd: () -> Void = {}
    var onTap: (Combustivel) -> Void = { _ in }
    var onDelete: (Combustivel) -> Void = { _ in }

    var body: some View {
        Group {
            groupHeadRow

            if repo.combustiveis.isEmpty {
                emptyStateRow
            } else {
                ForEach(repo.combustiveis, id: \.id) { c in
                    CombustivelRow(nome: c.nome, hint: c.tipo)
                        .contentShape(Rectangle())
                        .onTapGesture { onTap(c) }
                        .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                onDelete(c)
                            } label: {
                                Text("Apagar")
                            }
                        }
                }
            }

            AddRow(label: "Cadastrar outro tipo", action: onAdd)
                .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
    }

    private var groupHeadRow: some View {
        HStack {
            Text("Cadastrados".uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32)
                .foregroundStyle(Color.textFaint)
            Spacer()
            Text("\(repo.combustiveis.count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.accent)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, 10)
        .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private var emptyStateRow: some View {
        Text("Você ainda não cadastrou nenhum combustível. Cadastre um tipo abaixo pra reaproveitar nos próximos stints.")
            .font(.system(size: 13, weight: .regular))
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
            .listRowInsets(EdgeInsets(top: 4, leading: Spacing.lg, bottom: 4, trailing: Spacing.lg))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}

// MARK: - Sub-componentes locais

/// Row de combustível (mockup `.fuel-row`). Sem radio porque a
/// surface é CRUD, não selector. Visual idêntico ao mockup fora isso
/// (background surface, hairline, name 16/600, hint 12/regular).
private struct CombustivelRow: View {
    let nome: String
    let hint: String?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(nome)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.08)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                if let hint, !hint.isEmpty {
                    Text(hint)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
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
}

/// Botão "+ Cadastrar outro tipo" (mockup `.add-row` — dashed border).
private struct AddRow: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07)
                    .foregroundStyle(Color.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(Color.border)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview("CombustivelListaView — com seed") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CombustivelRepository(queue: queue)
    return List {
        CombustivelListaView(onAdd: {})
            .environmentObject(repo)
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Color.surface)
    .preferredColorScheme(.dark)
    .task { await repo.bootstrap() }
}

#Preview("CombustivelListaView — vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = CombustivelRepository(queue: queue)
    return List {
        CombustivelListaView(onAdd: {})
            .environmentObject(repo)
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Color.surface)
    .preferredColorScheme(.dark)
    .task {
        // Não chama bootstrap — fica vazio de propósito (empty state).
        try? await repo.reload()
    }
}
