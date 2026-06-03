// ═══════════════════════════════════════════════════════════
// FotoCarroSection — campo de seleção da foto principal do carro
// ═══════════════════════════════════════════════════════════
// S2 da rodada 1 (2026-05-12). Componente compartilhado entre
// CarroNovoFormView e CarroModalView.
//
// Comportamento:
// • Preview circular grande (84×84) — mesmo Conceito 1 do card.
// • PhotosPicker nativo do iOS pra escolher uma foto da galeria.
// • Após escolher, a imagem é comprimida (≤ 500 KB alvo, qualidade
//   JPEG 0.6 inicial, com fallback) e a Data resultante fica em
//   `selectedJpeg` pro caller fazer upload no momento certo.
// • Suporta foto já existente (URL do bucket) — AsyncImage carrega
//   pra exibição enquanto o usuário ainda não trocou.
// • Botão "Remover" só aparece quando há foto.

import SwiftUI
import PhotosUI
import UIKit

struct FotoCarroSection: View {
    /// Foto atual do carro no servidor — quando presente, AsyncImage carrega
    /// como fallback (se cache local não tem ainda).
    let fotoUrlAtual: URL?

    /// ID do carro pra lookup do cache local. Nil em CarroNovoFormView
    /// (carro ainda não existe). Quando presente, tenta UIImage do disco
    /// imediatamente — UX "foto já está lá" sem latência de rede.
    var carroId: String? = nil

    /// Bytes da nova foto selecionada+comprimida — preenche quando o usuário
    /// escolhe uma foto. Caller usa pra subir no Storage.
    @Binding var selectedJpeg: Data?

    /// Marcado true quando o usuário tocou em "Remover" — caller deve apagar
    /// foto existente no servidor + zerar foto_url no banco.
    @Binding var pedidoRemover: Bool

    @State private var pickerItem: PhotosPickerItem?
    @State private var previewUI: UIImage?
    @State private var carregando = false
    @State private var erro: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text("Foto do carro")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                Spacer()
                Text("opcional")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }

            HStack(spacing: 14) {
                preview
                    .frame(width: 84, height: 84)

                VStack(alignment: .leading, spacing: 8) {
                    PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                        Text(temAlgumaFoto ? "Trocar foto" : "Escolher foto")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.text)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(Color.surfaceHover)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(Color.border, lineWidth: 1)
                            )
                    }

                    if temAlgumaFoto {
                        Button(action: handleRemover) {
                            Text("Remover")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.textMuted)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(Color.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }

                    if let erro = erro {
                        Text(erro)
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.erro)
                    } else if carregando {
                        Text("Comprimindo…")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    } else if selectedJpeg != nil {
                        Text("Foto pronta. Salve pra confirmar.")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .onChange(of: pickerItem) { _, newItem in
            handleNovaSelecao(item: newItem)
        }
    }

    /// True quando há foto pra exibir: ou foto existente no servidor, ou
    /// preview da nova foto recém-selecionada. Falso se o usuário marcou
    /// "Remover" sem escolher uma nova depois.
    private var temAlgumaFoto: Bool {
        if previewUI != nil { return true }
        if pedidoRemover { return false }
        return fotoUrlAtual != nil
    }

    @ViewBuilder
    private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.surfaceHover)

            if let ui = previewUI {
                // 1) Selecionado agora OU carregado do disco local no .task
                Image(uiImage: ui)
                    .resizable()
                    .scaledToFill()
            } else if !pedidoRemover, let url = fotoUrlAtual {
                // 2) Fallback de rede — primeira vez, ou cache local foi
                // limpo. AsyncImage NÃO popula nosso cache local; depende
                // do uploadFoto ter rodado antes.
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView().tint(Color.textFaint)
                    case .success(let img):
                        img.resizable().scaledToFill()
                    case .failure:
                        Image(systemName: "photo.fill")
                            .font(.system(size: 22, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    @unknown default:
                        Color.clear
                    }
                }
            } else {
                // 3) Sem foto — placeholder neutro
                Image(systemName: "camera.fill")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
        .task(id: carroId) {
            // Carrega do disco local IMEDIATAMENTE quando o sheet abre —
            // UX "foto já está lá" sem latência. Só roda quando previewUI
            // ainda é nil (não sobrescreve nova seleção do usuário).
            guard previewUI == nil, !pedidoRemover, let id = carroId else { return }
            if let img = CarroRepository.carregarFotoLocal(carroId: id) {
                previewUI = img
            }
        }
    }

    private func handleNovaSelecao(item: PhotosPickerItem?) {
        guard let item = item else { return }
        carregando = true
        erro = nil
        Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let ui = UIImage(data: data) else {
                    await MainActor.run {
                        self.erro = "Não consegui ler a foto escolhida."
                        self.carregando = false
                    }
                    return
                }
                let comprimida = FotoCarroCompressor.comprimir(ui)
                await MainActor.run {
                    self.previewUI = ui
                    self.selectedJpeg = comprimida
                    self.pedidoRemover = false
                    self.carregando = false
                }
            } catch {
                await MainActor.run {
                    self.erro = "Erro ao ler foto: \(error.localizedDescription)"
                    self.carregando = false
                }
            }
        }
    }

    private func handleRemover() {
        previewUI = nil
        selectedJpeg = nil
        pickerItem = nil
        pedidoRemover = true
    }
}

// MARK: - Compressor

/// Comprime UIImage pra JPEG visando ≤ targetBytes (default 500 KB).
/// Tenta qualidade 0.8 e cai 0.1 a cada tentativa até bater o alvo ou
/// chegar em 0.3 (fallback). Devolve nil só se o JPEG do iOS falhar
/// completamente (cenário raro).
enum FotoCarroCompressor {
    static let alvoBytes = 500_000

    static func comprimir(_ image: UIImage, alvo: Int = FotoCarroCompressor.alvoBytes) -> Data? {
        // Antes de comprimir, reduz pra no máximo 1280 px no lado maior —
        // foto de iPhone moderno vem em ~12 MP, é desperdício pra card.
        let resized = resizeMaiorLadoSe(image, ate: 1280)
        var quality: CGFloat = 0.8
        while quality >= 0.3 {
            if let data = resized.jpegData(compressionQuality: quality), data.count <= alvo {
                return data
            }
            quality -= 0.1
        }
        return resized.jpegData(compressionQuality: 0.3)
    }

    private static func resizeMaiorLadoSe(_ image: UIImage, ate limite: CGFloat) -> UIImage {
        let w = image.size.width
        let h = image.size.height
        let maiorLado = max(w, h)
        guard maiorLado > limite else { return image }
        let scale = limite / maiorLado
        let novoSize = CGSize(width: w * scale, height: h * scale)
        let renderer = UIGraphicsImageRenderer(size: novoSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: novoSize))
        }
    }
}
