// ═══════════════════════════════════════════════════════════
// AutodromoFormView — cadastro/edição de Autódromo (Onda 2)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). F1=ja-agora.
// Campos mínimos: apelido + nome oficial + cidade + extensão (m) +
// nº de curvas. Layout (path SVG, trechos, zona de boxes) fica pra
// rodada futura — o autódromo aparece na lista mas o "abrir mapa"
// só mostra dado real se o layout estiver cadastrado.

import SwiftUI
import P1FastCore

struct AutodromoFormView: View {
    @EnvironmentObject private var repo: TrackRepository
    let modo: Modo
    let onClose: () -> Void

    enum Modo {
        case novo
        case editar(TrackRow)
    }

    @State private var apelido: String = ""
    @State private var nomeOficial: String = ""
    @State private var cidade: String = ""
    @State private var extensaoMetros: String = ""
    @State private var numeroCurvas: String = ""
    @State private var isSaving = false
    @State private var savingError: String?
    @State private var pedirApagar = false

    private var titulo: String {
        switch modo {
        case .novo:    return "Novo autódromo"
        case .editar:  return "Editar autódromo"
        }
    }

    private var podeSalvar: Bool {
        !apelido.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                conteudo
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 240)  // +80 pro espaço da barra + menu
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)
            FootBar(
                onCancel: onClose,
                onSave: salvar,
                saveLabel: "Salvar",
                canSave: podeSalvar,
                isSaving: isSaving
            )
            // 2026-05-17 (Flávio): sobe a barra de Cancelar/Salvar pra
            // ficar acima do menu inferior (que mede ~95 pt + safe area).
            .padding(.bottom, 95)
        }
        .navigationTitle(titulo)
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .onAppear(perform: preencher)
        .alert("Apagar autódromo?", isPresented: $pedirApagar) {
            Button("Manter", role: .cancel) {}
            Button("Apagar", role: .destructive) { Task { await apagar() } }
        } message: {
            Text("O autódromo será removido. Stints e voltas vinculadas perdem a referência ao autódromo mas continuam guardados.")
        }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: titulo)
                Text("Dados do autódromo")
                    .font(.system(size: 22, weight: .semibold))
                    .tracking(-0.55)
                    .foregroundStyle(Color.text)
                Text("Cadastro inicial. Trechos e mapa do circuito você cadastra depois.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Apelido") {
                FormInput(text: $apelido, placeholder: "Ex.: Brasília · Velo Città · Interlagos")
            }
            FormField(label: "Nome oficial", small: "opcional") {
                FormInput(text: $nomeOficial, placeholder: "Ex.: Autódromo Internacional Nelson Piquet")
            }
            FormField(label: "Cidade", small: "opcional") {
                FormInput(text: $cidade, placeholder: "Ex.: Brasília · São Paulo · Mogi Guaçu")
            }
            FormField(label: "Extensão", small: "metros") {
                FormInput(text: $extensaoMetros, placeholder: "Ex.: 5476",
                          keyboardType: .numberPad)
            }
            FormField(label: "Número de curvas", small: "opcional") {
                FormInput(text: $numeroCurvas, placeholder: "Ex.: 8",
                          keyboardType: .numberPad)
            }

            if let erro = savingError {
                Text(erro)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            if case .editar = modo {
                Button {
                    pedirApagar = true
                } label: {
                    Text("Apagar autódromo")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.erro)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .fill(Color.erro.opacity(0.12))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(Color.erro.opacity(0.5), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.md)
            }

            HelperNote(text: "Pra agora, o cadastro de autódromo serve pra você organizar onde rodou e separar voltas/recordes por circuito. O traçado e os trechos do autódromo entram numa rodada futura, com mapa visual.")
                .padding(.top, Spacing.sm)
        }
    }

    private func preencher() {
        if case .editar(let row) = modo {
            apelido = row.apelido
            nomeOficial = row.nomeOficial ?? ""
            cidade = row.cidade ?? ""
            extensaoMetros = row.extensaoMetros.map { "\($0)" } ?? ""
            numeroCurvas = row.numeroCurvas.map { "\($0)" } ?? ""
        }
    }

    private func salvar() {
        let apelidoT = apelido.trimmingCharacters(in: .whitespaces)
        guard !apelidoT.isEmpty else { return }
        let nomeT = nomeOficial.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : nomeOficial.trimmingCharacters(in: .whitespaces)
        let cidadeT = cidade.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : cidade.trimmingCharacters(in: .whitespaces)
        let extInt: Int? = Int(extensaoMetros.trimmingCharacters(in: .whitespaces))
        let curvasInt: Int? = Int(numeroCurvas.trimmingCharacters(in: .whitespaces))

        isSaving = true
        savingError = nil
        Task {
            do {
                switch modo {
                case .novo:
                    _ = try await repo.criarAutodromo(
                        apelido: apelidoT,
                        nomeOficial: nomeT,
                        cidade: cidadeT,
                        extensaoMetros: extInt,
                        numeroCurvas: curvasInt
                    )
                case .editar(let row):
                    try await repo.atualizarAutodromo(
                        row,
                        apelido: apelidoT,
                        nomeOficial: nomeT,
                        cidade: cidadeT,
                        extensaoMetros: extInt,
                        numeroCurvas: curvasInt
                    )
                }
                await MainActor.run {
                    isSaving = false
                    onClose()
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    savingError = "Não consegui salvar: \(error.localizedDescription)"
                }
            }
        }
    }

    private func apagar() async {
        guard case .editar(let row) = modo else { return }
        do {
            try await repo.apagarAutodromo(row.id)
            await MainActor.run { onClose() }
        } catch {
            await MainActor.run {
                savingError = "Não consegui apagar: \(error.localizedDescription)"
            }
        }
    }
}
