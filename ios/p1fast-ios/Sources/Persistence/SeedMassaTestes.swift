// ═══════════════════════════════════════════════════════════
// SeedMassaTestes — massa de simulação pras telas novas
// ═══════════════════════════════════════════════════════════
// Reportado pelo Flávio 2026-05-12: as 4 telas novas (Stints/Voltas/
// Autódromos/Recordes) abrem vazias porque não há sessoes/voltas/
// segment_executions reais no banco. Esta massa cria dados fictícios
// com prefixo `seed-test-` em todos os IDs pra fácil identificação
// e remoção futura.
//
// PADRÃO TÉCNICO DE IDENTIFICAÇÃO:
// • Todos os IDs gerados começam com "seed-test-".
// • Prefixos: seed-test-carro-, seed-test-sessao-, seed-test-volta-,
//   seed-test-segexec-.
// • limparMassaTestes() apaga TUDO que tem esse prefixo.
//
// IDEMPOTÊNCIA: checa se já existe carro com prefixo — se sim, pula.
//
// CONTEÚDO:
// • 2 carros (Celta 1.4 azul + Honda Civic cinza).
// • 4 stints distribuídos entre os 2 eventos passados canônicos
//   (25/04 e 28/03 de 2026), com Flávio e Bruno alternando.
// • 10 voltas por stint (40 voltas no total), tempos realistas
//   1:38 a 1:50 com variação determinística.
// • 3 segment_executions por volta (120 ao todo), usando os
//   segmentos canônicos de Brasília (seg_brasilia_1, _3, _7).
//
// Pra REMOVER quando rodar com dados reais: chamar
// `SeedMassaTestes.limparMassaTestes(queue:)`.

import Foundation
import GRDB
import P1FastCore

enum SeedMassaTestes {
    static let prefixo = "seed-test-"

    // IDs canônicos (compatíveis com prefixo + idempotência)
    static let carroCelta   = "\(prefixo)carro-celta"
    static let carroCivic   = "\(prefixo)carro-civic"

    /// Cria a massa SE ainda não existe. Idempotente. Chamado no boot
    /// do app DEPOIS dos repositories canônicos terem rodado bootstrap.
    static func criarSeFaltar(queue: DatabaseQueue) async {
        guard let teamId = TeamContext.currentTeamId else {
            print("SeedMassaTestes: sem teamId, pulando.")
            return
        }
        do {
            let jaExiste = try await queue.read { db in
                try Carro.fetchOne(db, key: Self.carroCelta) != nil
            }
            if jaExiste {
                return
            }
            try await queue.write { db in
                try inserirCarros(db: db, teamId: teamId)
                try inserirStintsVoltasExecucoes(db: db, teamId: teamId)
            }
            print("SeedMassaTestes: massa criada (2 carros, 4 stints, 40 voltas, 120 execuções).")
        } catch {
            print("SeedMassaTestes.criarSeFaltar erro: \(error)")
        }
    }

    /// Apaga tudo da massa pelo prefixo. Chamar quando for entrar em
    /// produção com dados reais. Cascade: segment_executions, voltas,
    /// sessoes, carros.
    static func limparMassaTestes(queue: DatabaseQueue) async {
        do {
            try await queue.write { db in
                try db.execute(sql: "DELETE FROM segment_executions WHERE id LIKE ?", arguments: ["\(prefixo)%"])
                try db.execute(sql: "DELETE FROM voltas WHERE id LIKE ?", arguments: ["\(prefixo)%"])
                try db.execute(sql: "DELETE FROM sessoes WHERE id LIKE ?", arguments: ["\(prefixo)%"])
                try db.execute(sql: "DELETE FROM carros WHERE id LIKE ?", arguments: ["\(prefixo)%"])
            }
            print("SeedMassaTestes: massa apagada.")
        } catch {
            print("SeedMassaTestes.limparMassaTestes erro: \(error)")
        }
    }

    // MARK: - Implementação

    private static func inserirCarros(db: Database, teamId: String) throws {
        let agora = DB.nowMs()
        let celta = Carro(
            id: carroCelta,
            timeId: teamId,
            apelido: "Celta 1.4",
            modelo: "Chevrolet Celta 1.4 2010",
            categoria: "Turismo",
            cor: "#1E64B4", // azul Chevrolet
            createdAt: agora,
            updatedAt: agora
        )
        let civic = Carro(
            id: carroCivic,
            timeId: teamId,
            apelido: "Honda Civic",
            modelo: "Honda Civic Si 2012",
            categoria: "Sedã",
            cor: "#82828A", // cinza
            createdAt: agora,
            updatedAt: agora
        )
        try celta.insert(db)
        try civic.insert(db)
    }

    /// 4 stints × 10 voltas × 3 trechos por volta. Tempos realistas e
    /// determinísticos (não-aleatórios) pra que rodar 2x não mude valores.
    private static func inserirStintsVoltasExecucoes(db: Database, teamId: String) throws {
        let stints: [Configuracao] = [
            // (id_stint, evento_id, carro_id, piloto_id, data_inicio_iso, tempo_base_ms)
            Configuracao(stintN: 1, eventoId: "evt-mock-2026-04-25",
                         carroId: carroCelta, pilotoId: "piloto-mock-flavio",
                         dataIso: "2026-04-25T09:00:00", tempoBaseMs: 98_500),
            Configuracao(stintN: 2, eventoId: "evt-mock-2026-04-25",
                         carroId: carroCivic, pilotoId: "piloto-mock-bruno",
                         dataIso: "2026-04-25T11:00:00", tempoBaseMs: 102_200),
            Configuracao(stintN: 3, eventoId: "evt-mock-2026-03-28",
                         carroId: carroCelta, pilotoId: "piloto-mock-flavio",
                         dataIso: "2026-03-28T09:30:00", tempoBaseMs: 99_800),
            Configuracao(stintN: 4, eventoId: "evt-mock-2026-03-28",
                         carroId: carroCivic, pilotoId: "piloto-mock-bruno",
                         dataIso: "2026-03-28T11:30:00", tempoBaseMs: 103_100),
        ]

        for stint in stints {
            try inserirStint(db: db, teamId: teamId, stint: stint)
        }
    }

    private struct Configuracao {
        let stintN: Int
        let eventoId: String
        let carroId: String
        let pilotoId: String
        let dataIso: String
        let tempoBaseMs: Int
    }

    private static func inserirStint(db: Database, teamId: String, stint: Configuracao) throws {
        let sessaoId = "\(prefixo)sessao-\(stint.stintN)"
        let dataMs = isoToMs(stint.dataIso)
        let agora = DB.nowMs()

        try Sessao(
            id: sessaoId,
            timeId: teamId,
            eventoId: stint.eventoId,
            carroId: stint.carroId,
            pilotoId: stint.pilotoId,
            configuracaoId: nil,
            status: "finalizada",
            dataInicio: dataMs,
            dataFim: dataMs + 1_800_000, // +30 min
            voltasPlanejadas: 10,
            objetivo: "Massa de teste",
            createdAt: agora,
            updatedAt: agora
        ).insert(db)

        // 10 voltas com tempos seguindo curva V (aquece, melhora, cansa).
        let trajetoria: [Int] = [+5_500, +2_800, +800, -200, -500, -300, +100, +500, +1_200, +2_000] // ms relativos ao tempoBase
        for (idx, delta) in trajetoria.enumerated() {
            let numero = idx + 1
            let voltaId = "\(prefixo)volta-\(stint.stintN)-\(numero)"
            let tempoMs = stint.tempoBaseMs + delta
            let inicioAt = dataMs + Int64(idx * 110_000) // ~1:50 por volta

            try Volta(
                id: voltaId,
                timeId: teamId,
                sessaoId: sessaoId,
                numero: numero,
                tempoMs: tempoMs,
                valida: true,
                inicioAt: inicioAt,
                createdAt: agora,
                updatedAt: agora
            ).insert(db)

            // 3 execuções de trecho por volta. Distribuição de tempos
            // dentro da volta (somam ~ tempoMs). Velocidades realistas
            // pra cada trecho (curva fechada vs reta principal).
            try inserirExecucao(db: db, sessaoId: sessaoId, voltaId: voltaId, teamId: teamId,
                                segmentId: "seg_brasilia_1",
                                tempoMs: Int(Double(tempoMs) * 0.30),
                                velMax: 165.0 + Double(idx) * 0.5,
                                vmin: 65.0,
                                sufixo: "a")
            try inserirExecucao(db: db, sessaoId: sessaoId, voltaId: voltaId, teamId: teamId,
                                segmentId: "seg_brasilia_3",
                                tempoMs: Int(Double(tempoMs) * 0.25),
                                velMax: 185.0 + Double(idx) * 0.8,  // reta principal — vmax aqui
                                vmin: 95.0,
                                sufixo: "b")
            try inserirExecucao(db: db, sessaoId: sessaoId, voltaId: voltaId, teamId: teamId,
                                segmentId: "seg_brasilia_7",
                                tempoMs: Int(Double(tempoMs) * 0.45),
                                velMax: 145.0 + Double(idx) * 0.3,
                                vmin: 55.0,
                                sufixo: "c")
        }
    }

    private static func inserirExecucao(db: Database, sessaoId: String, voltaId: String,
                                        teamId: String, segmentId: String,
                                        tempoMs: Int, velMax: Double, vmin: Double,
                                        sufixo: String) throws {
        let id = "\(prefixo)segexec-\(voltaId.dropFirst(prefixo.count))-\(sufixo)"
        try SegmentExecution(
            id: id,
            timeId: teamId,
            sessaoId: sessaoId,
            voltaId: voltaId,
            segmentId: segmentId,
            tempoMs: tempoMs,
            velocidadeMax: velMax,
            vminKmh: vmin,
            vminX: nil,
            vminY: nil
        ).insert(db)
    }

    private static func isoToMs(_ iso: String) -> Int64 {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "America/Sao_Paulo")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        guard let d = f.date(from: iso) else { return DB.nowMs() }
        return Int64(d.timeIntervalSince1970 * 1000)
    }
}
