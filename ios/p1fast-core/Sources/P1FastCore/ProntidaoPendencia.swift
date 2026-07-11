// ═══════════════════════════════════════════════════════════
// ProntidaoPendencia — % real de prontidão do checklist de pendências
// ═══════════════════════════════════════════════════════════
// Função pura (sem deps iOS) usada pelo app pra trocar o "% pronto"
// cravado em 0 (morto) da tela de detalhe do evento pelo número
// verdadeiro: itens conferidos ÷ total do checklist daquele evento.
//
// Regras (Fase 0 do padrão premium — Flávio 2026-06-22):
//   • total == 0 (checklist nunca aberto, sem itens) → 0% (honesto:
//     nada foi preparado ainda).
//   • arredonda ao inteiro mais próximo e trava no intervalo 0…100.
//
// Testada no smoke `p1fast-smoke` (passo PRONT-01..03).

import Foundation

public enum ProntidaoPendencia {
    /// Prontidão real (0–100): `checados ÷ total`, arredondado ao inteiro
    /// mais próximo. Retorna 0 quando não há itens (total <= 0) ou nada
    /// conferido — nunca estoura o intervalo 0…100.
    public static func pct(checados: Int, total: Int) -> Int {
        guard total > 0, checados > 0 else { return 0 }
        let bruto = (Double(checados) / Double(total) * 100).rounded()
        return min(100, max(0, Int(bruto)))
    }
}
