// ═══════════════════════════════════════════════════════════
// EnduranceDetection — detecta evento que permite revezamento
// ═══════════════════════════════════════════════════════════
// MS-4.2. Decisão Q2.2 (rodada 2 de 2026-05-11): o aplicativo
// identifica revezamento pelo nome do tipo do evento.
//
// Regra: se `eventos.tipo` contém "endurance" (case-insensitive),
// o evento permite múltiplos pilotos com troca por volta dentro
// do mesmo stint. Track Day, Treino livre, etc. → 1 piloto +
// convidado opcional (decisão Q8).
//
// Esta função é PURA — entrada→saída, sem efeitos. Testável
// isolada em P1FastSmoke. StintRepository.eventoPermiteRevezamento
// consome esta função após ler o tipo do evento do GRDB.

import Foundation

public enum EnduranceDetection {
    /// Retorna true se o tipo do evento contiver "endurance" (case-insensitive).
    /// `nil` ou string vazia → false (não permite revezamento por padrão).
    public static func tipoPermiteRevezamento(_ tipo: String?) -> Bool {
        guard let tipo = tipo, !tipo.isEmpty else { return false }
        return tipo.lowercased().contains("endurance")
    }
}
