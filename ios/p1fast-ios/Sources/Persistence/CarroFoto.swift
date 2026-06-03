// ═══════════════════════════════════════════════════════════
// CarroFoto — foto local do carro (2026-05-31)
// ═══════════════════════════════════════════════════════════
// Foto guardada localmente (Documents/carros-fotos/{carroId}.jpg),
// fora do struct Carro que sincroniza — não toca o banco nem a nuvem.
// Mesmo padrão das fotos de peça. Exibida no hub do carro e escolhida
// no Cadastro básico (PhotosPicker).

import UIKit

enum CarroFoto {
    static func fotoLocalURL(carroId: String) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("carros-fotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(carroId).jpg")
    }

    @discardableResult
    static func salvar(carroId: String, imagem: UIImage) -> Bool {
        guard let data = imagem.jpegData(compressionQuality: 0.8) else { return false }
        do {
            try data.write(to: fotoLocalURL(carroId: carroId), options: .atomic)
            return true
        } catch {
            print("CarroFoto.salvar falhou: \(error)")
            return false
        }
    }

    static func carregar(carroId: String) -> UIImage? {
        let url = fotoLocalURL(carroId: carroId)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    static func remover(carroId: String) {
        try? FileManager.default.removeItem(at: fotoLocalURL(carroId: carroId))
    }
}
