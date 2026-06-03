// ═══════════════════════════════════════════════════════════
// CarroNovoFormView — port de mockup-carro-novo.html (aba Geral)
// ═══════════════════════════════════════════════════════════
// Form mínimo de cadastro: apelido + modelo + categoria + cor.
// Submit grava via CarroRepository (GRDB), fecha a sheet, volta pra
// Garagem com o card novo já visível.
//
// A aba "Dinamômetro" do mockup fica pra Sprint 1A.4 (curva motor +
// shift cards). Aqui só a aba "Geral".

import SwiftUI

struct CarroNovoFormView: View {
    @EnvironmentObject private var repo: CarroRepository
    let onClose: () -> Void

    @State private var apelido: String = ""
    @State private var modelo: String = ""
    @State private var categoria: String? = nil
    @State private var corHex: String = CarroPalette.opcoes[1].hex // amarelo (default mockup)
    @State private var savingError: String?
    @State private var isSaving = false
    // S2 rodada 1: foto opcional do carro novo.
    @State private var fotoSelecionada: Data?
    @State private var pedidoRemoverFoto = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: save,
                saveLabel: "Salvar",
                canSave: !apelido.isEmpty && !isSaving,
                isSaving: isSaving
            )
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Novo carro")
                Text("Cadastrar carro")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.text)
                Text("Setup base e pneus você cadastra depois.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            FormField(label: "Apelido") {
                FormInput(text: $apelido, placeholder: "Ex: Celta 1.4")
            }

            FormField(label: "Modelo", small: "opcional") {
                FormInput(text: $modelo, placeholder: "Marca + ano (ex: Chevrolet Celta 1.4 2010)")
            }

            FormField(label: "Categoria") {
                CategoriaPicker(selection: $categoria)
            }

            FormField(label: "Cor") {
                CorPicker(selection: $corHex)
            }

            FotoCarroSection(
                fotoUrlAtual: nil,
                selectedJpeg: $fotoSelecionada,
                pedidoRemover: $pedidoRemoverFoto
            )

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            HelperNote(text: "Depois de salvar, você abre o carro e cadastra setup base (calibragem, alinhamento, suspensão, freios, motor) e pneus que esse carro usa.")
                .padding(.top, Spacing.sm)
        }
    }

    private func save() {
        NSLog("[CarroNovoFormView.save] disparado — apelido='\(apelido)', foto=\(fotoSelecionada?.count ?? 0)B")
        guard !apelido.isEmpty else {
            NSLog("[CarroNovoFormView.save] guard apelido vazio")
            return
        }
        isSaving = true
        savingError = nil
        Task {
            do {
                NSLog("[CarroNovoFormView.save] 1) repo.create")
                let carroId = try await repo.create(
                    apelido: apelido.trimmingCharacters(in: .whitespaces),
                    modelo: trimmedOrNil(modelo),
                    categoria: categoria,
                    cor: corHex
                )
                NSLog("[CarroNovoFormView.save] criou carroId=\(carroId)")
                if let jpeg = fotoSelecionada {
                    NSLog("[CarroNovoFormView.save] 2) uploadFoto (\(jpeg.count)B)")
                    do {
                        try await withThrowingTaskGroup(of: Void.self) { group in
                            group.addTask { _ = try await repo.uploadFoto(carroId: carroId, imageData: jpeg) }
                            group.addTask {
                                try await Task.sleep(nanoseconds: 20_000_000_000)
                                throw SaveTimeoutError(seconds: 20)
                            }
                            try await group.next()
                            group.cancelAll()
                        }
                        NSLog("[CarroNovoFormView.save] uploadFoto OK")
                    } catch {
                        NSLog("[CarroNovoFormView.save] uploadFoto FAIL: \(error)")
                        await MainActor.run {
                            savingError = "Carro criado, mas não subi a foto: \(error.localizedDescription)"
                            isSaving = false
                        }
                        return
                    }
                }
                NSLog("[CarroNovoFormView.save] fechando")
                await MainActor.run {
                    isSaving = false
                    onClose()
                }
            } catch {
                NSLog("[CarroNovoFormView.save] ERRO geral: \(error)")
                await MainActor.run {
                    isSaving = false
                    savingError = "Não consegui salvar: \(error.localizedDescription)"
                }
            }
        }
    }

    private func trimmedOrNil(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }
}

// MARK: - Componentes do form (compartilhados com CarroModalView)

struct FormField<Content: View>: View {
    let label: String
    let small: String?
    @ViewBuilder let content: () -> Content

    init(label: String, small: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.label = label
        self.small = small
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text(label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                Spacer()
                if let small {
                    Text(small)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            content()
        }
    }
}

struct FormInput: View {
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default
    var isFocus: Bool = false
    var isError: Bool = false

    var body: some View {
        TextField(placeholder, text: $text, prompt: Text(placeholder).foregroundStyle(Color.textFaint))
            .keyboardType(keyboardType)
            .textFieldStyle(.plain)
            .font(.system(size: 16, weight: .medium))
            .tracking(-0.08)
            .foregroundStyle(Color.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    private var borderColor: Color {
        if isError { return Color.erro }
        if isFocus { return Color.accent }
        return Color.border
    }
}

struct CategoriaPicker: View {
    @Binding var selection: String?

    var body: some View {
        Menu {
            ForEach(CarroCategoria.opcoes, id: \.self) { cat in
                Button(cat) { selection = cat }
            }
        } label: {
            HStack {
                Text(selection ?? "Escolher categoria")
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(selection == nil ? Color.textFaint : Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .menuStyle(.button)
    }
}

struct CorPicker: View {
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 10) {
            ForEach(CarroPalette.opcoes) { cor in
                CorSwatch(
                    cor: cor,
                    isSelected: cor.hex.lowercased() == selection.lowercased()
                ) {
                    selection = cor.hex
                }
            }
            Spacer(minLength: 0)
        }
    }
}

private struct CorSwatch: View {
    let cor: CarroPalette.Cor
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .stroke(isSelected ? Color.accent : Color.border, lineWidth: 2)
                    .frame(width: 38, height: 38)
                Circle()
                    .fill(Color(hex: cor.hex) ?? Color.gray)
                    .frame(width: isSelected ? 30 : 24, height: isSelected ? 30 : 24)
                if isSelected {
                    Circle()
                        .stroke(Color.accent.opacity(0.18), lineWidth: 3)
                        .frame(width: 44, height: 44)
                }
            }
            .frame(width: 44, height: 44)
            .accessibilityLabel(cor.nome)
        }
        .buttonStyle(.plain)
        .animation(Layout.snap, value: isSelected)
    }
}

struct HelperNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(Color.textFaint)
            .lineSpacing(4)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 12)
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
}

struct FootBar: View {
    let onCancel: () -> Void
    let onSave: () -> Void
    let saveLabel: String
    let canSave: Bool
    var isSaving: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onCancel) {
                Text("Cancelar")
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(-0.075)
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Button(action: onSave) {
                HStack(spacing: 8) {
                    if isSaving {
                        ProgressView()
                            .tint(Color.onAccent)
                            .scaleEffect(0.85)
                    }
                    Text(isSaving ? "Salvando…" : saveLabel)
                        .font(.system(size: 15, weight: .semibold))
                        .tracking(-0.075)
                        .foregroundStyle(Color.onAccent)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(canSave ? Color.accent : Color.accent.opacity(0.4))
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 14)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity)
        .background(
            Color.surface.opacity(0.92).background(.ultraThinMaterial)
        )
        .overlay(
            Rectangle()
                .fill(Color.border)
                .frame(height: 1),
            alignment: .top
        )
    }
}
