// ═══════════════════════════════════════════════════════════
// MeuPerfilView — quem é VOCÊ pro aplicativo (Pendência 4)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos · Flávio 2026-05-17. Tela "Meu perfil"
// resolve a identidade do piloto logado: cruza user_id do login
// com a lista de pessoas cadastradas no time. Se já houver vínculo,
// mostra nome + papéis. Se não, oferece picker pra escolher qual
// pessoa cadastrada é VOCÊ.
//
// Recorde pessoal nos Autódromos depende desse vínculo — sem ele
// o aplicativo mostra "—" em "Recorde pessoal".

import SwiftUI
import P1FastCore

struct MeuPerfilView: View {
    @EnvironmentObject private var sessionManager: SessionManager
    @EnvironmentObject private var stintRepo: StintRepository
    let onClose: () -> Void

    @State private var identidade: PerfilCorrenteService.Identidade?
    @State private var pessoasDisponiveis: [Pessoa] = []
    @State private var pilotosDisponiveis: [Piloto] = []
    @State private var carregando = true
    @State private var erro: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow(text: "Meu perfil")
                    Text(tituloHeader)
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(Color.text)
                    Text(subtituloHeader)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.xs)

                cardIdentidade

                if identidade?.pessoaId == nil {
                    cardVinculo
                }

                if let erro {
                    Text(erro)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.erro)
                        .padding(.horizontal, Spacing.xs)
                }

                HelperNote(text: "Quem fez login no aparelho identifica o piloto. O recorde pessoal nos autódromos só aparece quando você está vinculado a uma pessoa cadastrada. Se a pessoa não tem o papel 'piloto' nem 'chefe da equipe', o aplicativo bloqueia o planejamento de stints.")
                    .padding(.top, Spacing.sm)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 100)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .navigationTitle("Meu perfil")
        .navigationBarTitleDisplayMode(.inline)
        // 2026-05-17: back nativo do iOS aparece automaticamente.
        // Button("Fechar") removido — sobrava do tempo em que esta tela
        // era janela modal.
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    private var tituloHeader: String {
        if let nome = identidade?.nome { return nome }
        if sessionManager.currentUserId == nil { return "Sem login" }
        return "Vincule sua pessoa"
    }

    private var subtituloHeader: String {
        if let id = identidade {
            let pap = id.papeis.map { $0.legivel }.sorted().joined(separator: " · ")
            return pap.isEmpty ? "Sem papéis vinculados" : pap
        }
        return "Configure quem é você nesse aparelho"
    }

    private var cardIdentidade: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("LOGIN")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.textFaint)
            if let uid = sessionManager.currentUserId {
                linha(rotulo: "Identificador do usuário", valor: uid.prefix(8).description + "…")
            } else {
                linha(rotulo: "Status", valor: "Sem login ativo")
            }
            if let id = identidade {
                if let pessoaId = id.pessoaId {
                    linha(rotulo: "Pessoa cadastrada", valor: id.nome ?? "—")
                    linha(rotulo: "ID da pessoa", valor: pessoaId.prefix(8).description + "…")
                } else if let pilotoId = id.pilotoId {
                    linha(rotulo: "Piloto legado", valor: id.nome ?? "—")
                    linha(rotulo: "ID do piloto", valor: pilotoId.prefix(8).description + "…")
                }
                linha(rotulo: "Pode planejar stint?", valor: id.podePlanejarStint ? "Sim" : "Não — sem papel piloto/chefe")
            }
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

    private var cardVinculo: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("VINCULAR PESSOA")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.textFaint)
            Text("Escolha qual pessoa cadastrada no time é você.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
            if pessoasDisponiveis.isEmpty && pilotosDisponiveis.isEmpty {
                Text("Nenhuma pessoa cadastrada. Vá em Cadastros → Pessoas, cadastre uma e volte aqui.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.atencao)
            } else {
                ForEach(pessoasDisponiveis, id: \.id) { p in
                    botaoPessoa(nome: p.nome, pessoaId: p.id)
                }
                if pessoasDisponiveis.isEmpty {
                    Text("Apenas pilotos legados cadastrados. Cadastre como pessoa (Cadastros → Pessoas) pra ganhar papéis.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.atencao)
                    ForEach(pilotosDisponiveis, id: \.id) { p in
                        Text("· \(p.nome) (piloto legado)")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.textMuted)
                    }
                }
            }
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

    private func botaoPessoa(nome: String, pessoaId: String) -> some View {
        Button {
            Task { await vincular(pessoaId: pessoaId) }
        } label: {
            HStack {
                Text(nome)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                Spacer()
                Text("Sou eu")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.onAccent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.accent)
                    )
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceHover)
            )
        }
        .buttonStyle(.plain)
    }

    private func linha(rotulo: String, valor: String) -> some View {
        HStack {
            Text(rotulo)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
            Spacer()
            Text(valor)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.text)
        }
    }

    @MainActor
    private func carregar() async {
        carregando = true
        erro = nil
        let q = stintRepo.queue
        do {
            identidade = try await PerfilCorrenteService.identidadeAtual(
                userId: sessionManager.currentUserId, queue: q
            )
            pessoasDisponiveis = try await PerfilCorrenteService.pessoasDoTime(queue: q)
            pilotosDisponiveis = try await PerfilCorrenteService.pilotosDoTime(queue: q)
        } catch {
            erro = "Não consegui carregar o perfil: \(error.localizedDescription)"
        }
        carregando = false
    }

    @MainActor
    private func vincular(pessoaId: String) async {
        guard let uid = sessionManager.currentUserId else {
            erro = "Faça login antes de vincular."
            return
        }
        do {
            try await PerfilCorrenteService.vincularPessoa(
                pessoaId: pessoaId, userId: uid, queue: stintRepo.queue
            )
            await carregar()
        } catch {
            erro = "Não consegui vincular: \(error.localizedDescription)"
        }
    }
}
