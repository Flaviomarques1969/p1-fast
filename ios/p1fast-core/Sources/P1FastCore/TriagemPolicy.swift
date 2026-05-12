// ═══════════════════════════════════════════════════════════
// TriagemPolicy — regras puras de bloqueio do próximo stint
// ═══════════════════════════════════════════════════════════
// F4 etapa 5. Decide se um stint novo pode começar dado o estado das
// voltas pendentes de triagem de stints anteriores no MESMO evento.
//
// Decisão de produto (resposta Flávio 2026-05-12, d4_pendentes = DESCARTA):
//   - Voltas pendentes do MESMO DIA bloqueiam o próximo stint —
//     pessoa tem que triar antes (ou marcar tudo como descartada em
//     lote, mas isso é UX da F4.4).
//   - Voltas pendentes de DIAS ANTERIORES não bloqueiam — viram
//     descartadas automaticamente (regra "fim do dia" do Flávio).
//
// Sem estado, sem IO. Testado em smoke.

import Foundation

/// Entrada da policy: cada stint anterior do evento que ainda tem
/// voltas pendentes de triagem, com a data em que foi criado.
public struct StintComPendentes: Sendable, Equatable {
    /// Identificador do stint (pra log/UI).
    public let stintId: String
    /// `created_at` do stint em ms-epoch.
    public let criadoEmMs: Int64
    /// Número de voltas pendentes neste stint.
    public let voltasPendentes: Int

    public init(stintId: String, criadoEmMs: Int64, voltasPendentes: Int) {
        self.stintId = stintId
        self.criadoEmMs = criadoEmMs
        self.voltasPendentes = voltasPendentes
    }
}

/// Resultado da avaliação. UI consome `bloqueado` pra mostrar aviso
/// e botão "marcar todas como descartadas". `autoDescartar` lista
/// stints cujas pendentes devem virar descartadas automaticamente
/// (rotina de início do dia).
public enum BloqueioTriagemResultado: Sendable, Equatable {
    case ok
    case bloqueado(
        razao: String,
        stintsAfetados: [StintComPendentes],
        autoDescartar: [StintComPendentes]
    )
}

public enum TriagemPolicy {

    /// Avalia se pode iniciar um stint novo. `hoje` é a data corrente
    /// (caller passa pra facilitar teste; default usa relógio do sistema
    /// quando chamado em runtime real).
    ///
    /// - Parameters:
    ///   - pendentes: lista de stints anteriores do evento com pendentes.
    ///   - hoje: data corrente (timezone do device — Padrão Flávio rodando
    ///     no Brasil usa Brasília por default).
    ///   - calendar: calendário pra normalizar dia (default Gregoriano).
    /// - Returns: `.ok` se tudo certo. `.bloqueado` com 2 listas: stints
    ///   com pendentes do mesmo dia (devem ser triados) e stints com
    ///   pendentes de dias anteriores (devem ser auto-descartados).
    public static func avaliar(
        pendentes: [StintComPendentes],
        hoje: Date,
        calendar: Calendar = .init(identifier: .gregorian)
    ) -> BloqueioTriagemResultado {
        guard !pendentes.isEmpty else { return .ok }

        let inicioDeHoje = calendar.startOfDay(for: hoje)
        let inicioDeHojeMs = Int64(inicioDeHoje.timeIntervalSince1970 * 1000)

        var afetados: [StintComPendentes] = []
        var autoDescartar: [StintComPendentes] = []

        for stint in pendentes {
            if stint.criadoEmMs >= inicioDeHojeMs {
                afetados.append(stint)
            } else {
                autoDescartar.append(stint)
            }
        }

        if afetados.isEmpty {
            // Só tem pendentes de dias anteriores — não bloqueia, mas o
            // caller deve auto-descartar antes de iniciar o novo stint.
            // Mantém retorno `.bloqueado` com afetados vazio pra o caller
            // ter chance de executar a rotina de auto-descarte. UI decide
            // se mostra aviso ou roda silenciosamente.
            return .bloqueado(
                razao: "Voltas pendentes de stints de dias anteriores serão descartadas automaticamente.",
                stintsAfetados: [],
                autoDescartar: autoDescartar
            )
        }

        let totalVoltas = afetados.reduce(0) { $0 + $1.voltasPendentes }
        let razao = "Voltas pendentes de triagem em \(afetados.count) stint\(afetados.count == 1 ? "" : "s") deste evento (\(totalVoltas) volta\(totalVoltas == 1 ? "" : "s")). Tria antes de iniciar o próximo."
        return .bloqueado(
            razao: razao,
            stintsAfetados: afetados,
            autoDescartar: autoDescartar
        )
    }
}
