// ═══════════════════════════════════════════════════════════
// BarcodeScannerView — leitor de código de barras (câmera)
// ═══════════════════════════════════════════════════════════
// Usa VisionKit DataScanner (iOS 16+). Lê o código de barras da caixa
// da peça e devolve o número pra preencher o campo "Código" no cadastro
// do Estoque. NÃO busca dados externos — só captura o código (a busca
// por catálogo é uma decisão futura). 2026-05-31, pedido do Flávio.

import SwiftUI
import VisionKit

/// Disponível só em device físico com câmera + iOS 16+. No simulador é false.
enum BarcodeScanner {
    @MainActor
    static var disponivel: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }
}

/// Tela do leitor: câmera cheia + faixa de instrução + botão fechar.
struct BarcodeScannerSheet: View {
    let onCode: (String) -> Void
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            if BarcodeScanner.disponivel {
                DataScannerRepresentable(onCode: onCode)
                    .ignoresSafeArea()
            } else {
                // Simulador / sem câmera: mensagem honesta em vez de tela preta.
                Color.surface.ignoresSafeArea()
                VStack(spacing: 12) {
                    Image(systemName: "barcode.viewfinder")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.textFaint)
                    Text("O leitor de código de barras só funciona no iPhone (precisa da câmera).")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.xl)
                }
                .frame(maxHeight: .infinity)
            }

            HStack {
                Text("Aponte pro código de barras da caixa")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.6), radius: 6, y: 1)
                Spacer(minLength: 0)
                Button { onClose() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(Circle().fill(.black.opacity(0.5)))
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
        }
        .preferredColorScheme(.dark)
    }
}

/// Ponte pro DataScannerViewController do VisionKit.
private struct DataScannerRepresentable: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityLevel: .accurate,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        try? scanner.startScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        private let onCode: (String) -> Void
        private var jaLeu = false
        init(onCode: @escaping (String) -> Void) { self.onCode = onCode }

        func dataScanner(_ s: DataScannerViewController, didAdd added: [RecognizedItem], allItems: [RecognizedItem]) {
            captura(added)
        }
        func dataScanner(_ s: DataScannerViewController, didTapOn item: RecognizedItem) {
            captura([item])
        }

        private func captura(_ items: [RecognizedItem]) {
            guard !jaLeu else { return }
            for item in items {
                if case let .barcode(codigo) = item,
                   let texto = codigo.payloadStringValue, !texto.isEmpty {
                    jaLeu = true
                    onCode(texto)
                    return
                }
            }
        }
    }
}
