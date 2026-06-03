// ═══════════════════════════════════════════════════════════
// EtiquetaOCR — leitura de texto da etiqueta da peça (foto)
// ═══════════════════════════════════════════════════════════
// Usa Apple Vision (VNRecognizeTextRequest) — de graça, offline, no
// próprio iPhone. Lê o texto de QUALQUER etiqueta (qualquer marca) e
// organiza num palpite de nome + especificação + código de barras.
// Sem padrão fixo: o que reconhece de texto vira especificação; o nome
// e o código (EAN) saem por heurística quando dá. 2026-06-01, Flávio.

import Foundation
import UIKit
import Vision

enum EtiquetaOCR {

    struct Resultado {
        var nome: String?
        var codigo: String?
        var especificacao: String?
        var textoBruto: String
    }

    /// Reconhece o texto da imagem, em linhas de cima pra baixo. Vazio se falhar.
    static func lerLinhas(de imagem: UIImage) async -> [String] {
        guard let cg = imagem.cgImage else { return [] }
        return await withCheckedContinuation { cont in
            let req = VNRecognizeTextRequest { request, _ in
                let obs = (request.results as? [VNRecognizedTextObservation]) ?? []
                // boundingBox tem origem no canto inferior; maior maxY = mais alto.
                let ordenadas = obs.sorted { $0.boundingBox.maxY > $1.boundingBox.maxY }
                let linhas = ordenadas.compactMap { $0.topCandidates(1).first?.string }
                cont.resume(returning: linhas)
            }
            req.recognitionLevel = .accurate
            req.usesLanguageCorrection = true
            req.recognitionLanguages = ["pt-BR", "pt", "en"]
            let handler = VNImageRequestHandler(
                cgImage: cg,
                orientation: cgOrientation(imagem.imageOrientation),
                options: [:]
            )
            DispatchQueue.global(qos: .userInitiated).async {
                try? handler.perform([req])
            }
        }
    }

    /// Interpreta as linhas reconhecidas em campos da peça.
    static func interpretar(linhas: [String]) -> Resultado {
        let limpas = linhas
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        // Código de barras: primeira sequência de 12-14 dígitos "limpa".
        var codigo: String?
        for s in limpas {
            let digitos = s.filter { $0.isNumber }
            let naoDigitoNaoEspaco = s.filter { !$0.isNumber && !$0.isWhitespace }
            if digitos.count >= 12, digitos.count <= 14, naoDigitoNaoEspaco.isEmpty {
                codigo = String(digitos)
                break
            }
        }

        // Nome: valor após um rótulo de descrição; senão a 1ª linha "forte".
        var nome: String?
        for s in limpas {
            if let v = valorAposRotulo(s, rotulos: ["DESCRICAO", "DESCR", "PRODUTO", "PECA"]) {
                nome = capitalizarFrase(v)
                break
            }
        }
        if nome == nil {
            nome = limpas.first { linha in
                !ehLixo(linha)
                    && linha.rangeOfCharacter(from: .letters) != nil
                    && linha.split(separator: " ").count >= 2
                    && !linha.contains(":")
            }.map(capitalizarFrase)
        }

        // Especificação: todas as linhas úteis (sem lixo de rodapé), juntadas.
        let uteis = limpas.filter { !ehLixo($0) }
        let especificacao = uteis.isEmpty ? nil : uteis.joined(separator: "\n")

        return Resultado(
            nome: nome,
            codigo: codigo,
            especificacao: especificacao,
            textoBruto: limpas.joined(separator: "\n")
        )
    }

    // MARK: - Heurísticas

    /// Linhas de rodapé/contato que não interessam pra especificação.
    private static func ehLixo(_ s: String) -> Bool {
        let u = semAcento(s).uppercased()
        let padroes = [
            "LIGUE PARA", "WWW.", "HTTP", "CNPJ", "0800",
            "MADE IN", "IND.BRASIL", "IND. BRASIL", "INDUSTRIA E COMERCIO",
            "CORRETO DESCARTE", "CONSULTAR SITE", "OUTRAS INFORMACOES",
            ".COM", "LTDA", " S.A", "S/A"
        ]
        return padroes.contains { u.contains($0) }
    }

    /// Se a linha for "ROTULO: valor" e o rótulo casar, devolve o valor.
    private static func valorAposRotulo(_ linha: String, rotulos: [String]) -> String? {
        guard let idx = linha.firstIndex(of: ":") else { return nil }
        let antes = semAcento(String(linha[..<idx])).uppercased().trimmingCharacters(in: .whitespaces)
        guard rotulos.contains(where: { antes.contains($0) }) else { return nil }
        let depois = String(linha[linha.index(after: idx)...])
        let limpo = depois.trimmingCharacters(in: CharacterSet(charactersIn: ".·: ").union(.whitespaces))
        return limpo.isEmpty ? nil : limpo
    }

    private static func semAcento(_ s: String) -> String {
        s.folding(options: .diacriticInsensitive, locale: Locale(identifier: "pt_BR"))
    }

    /// "RET DA SAIDA" → "Ret da saida" (primeira maiúscula, resto minúsculo).
    private static func capitalizarFrase(_ s: String) -> String {
        let lower = s.lowercased()
        guard let first = lower.first else { return s }
        return String(first).uppercased() + lower.dropFirst()
    }

    private static func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}
