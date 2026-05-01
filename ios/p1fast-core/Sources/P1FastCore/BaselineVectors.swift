// ═══════════════════════════════════════════════════════════
// BaselineVectors — port Swift de src/domain/baseline-vectors.js
// ═══════════════════════════════════════════════════════════
// Painel de Vetores Configuráveis (B4) — antes de rodar baseline,
// engenheiro escolhe quais dimensões considerar na seleção das
// 5 melhores voltas.
//
// O Dexie (`getPreset/setPreset`) fica fora do port — persistência
// separada do core, conforme padrão Frente 3. Só a função pura
// `filterForBaseline` + estruturas/preset são portadas.

import Foundation

public enum BaselineVectors {

    public struct PneuPreset: Codable, Sendable {
        public var igualarMarca: Bool
        public var igualarComposto: Bool
        public var nivelMax: Int?
        public init(igualarMarca: Bool = true, igualarComposto: Bool = true, nivelMax: Int? = 2) {
            self.igualarMarca = igualarMarca
            self.igualarComposto = igualarComposto
            self.nivelMax = nivelMax
        }
    }

    public struct AmbientePreset: Codable, Sendable {
        public var tempPistaTol: Double?
        public var tempArTol: Double?
        public var apenasClima: Bool
        public init(tempPistaTol: Double? = 5, tempArTol: Double? = 5, apenasClima: Bool = true) {
            self.tempPistaTol = tempPistaTol
            self.tempArTol = tempArTol
            self.apenasClima = apenasClima
        }
    }

    public struct PilotoPreset: Codable, Sendable {
        public var apenasMesmoPiloto: Bool
        public init(apenasMesmoPiloto: Bool = true) { self.apenasMesmoPiloto = apenasMesmoPiloto }
    }

    public struct CarroConfigPreset: Codable, Sendable {
        public var apenasMesmoCarroConfig: Bool
        public init(apenasMesmoCarroConfig: Bool = true) { self.apenasMesmoCarroConfig = apenasMesmoCarroConfig }
    }

    public struct DiaPreset: Codable, Sendable {
        public var apenasMesmoDia: Bool
        public init(apenasMesmoDia: Bool = false) { self.apenasMesmoDia = apenasMesmoDia }
    }

    public struct Preset: Codable, Sendable {
        public var pneu: PneuPreset
        public var ambiente: AmbientePreset
        public var piloto: PilotoPreset
        public var carroConfig: CarroConfigPreset
        public var dia: DiaPreset
        public var minVoltas: Int

        public init(pneu: PneuPreset = .init(),
                    ambiente: AmbientePreset = .init(),
                    piloto: PilotoPreset = .init(),
                    carroConfig: CarroConfigPreset = .init(),
                    dia: DiaPreset = .init(),
                    minVoltas: Int = 5) {
            self.pneu = pneu
            self.ambiente = ambiente
            self.piloto = piloto
            self.carroConfig = carroConfig
            self.dia = dia
            self.minVoltas = minVoltas
        }
    }

    public static let defaultPreset = Preset()

    // ── tipos de entrada ──

    public struct EnvSnapshot: Sendable {
        public var composto: String?
        public var desgasteNivelD: Int?
        public var tempPista: Double?
        public var tempAr: Double?
        public init(composto: String? = nil, desgasteNivelD: Int? = nil,
                    tempPista: Double? = nil, tempAr: Double? = nil) {
            self.composto = composto
            self.desgasteNivelD = desgasteNivelD
            self.tempPista = tempPista
            self.tempAr = tempAr
        }
    }

    public struct LapInfo: Sendable {
        public let valida: Bool
        public let tempoMs: Double?
        public init(valida: Bool, tempoMs: Double? = nil) {
            self.valida = valida; self.tempoMs = tempoMs
        }
    }

    public struct SessionInfo: Sendable {
        public let userId: String?
        public let carConfigurationId: String?
        public let dataInicio: Date?
        public let clima: String?
        public init(userId: String? = nil, carConfigurationId: String? = nil,
                    dataInicio: Date? = nil, clima: String? = nil) {
            self.userId = userId
            self.carConfigurationId = carConfigurationId
            self.dataInicio = dataInicio
            self.clima = clima
        }
    }

    public struct Candidate: Sendable {
        public let lap: LapInfo
        public let session: SessionInfo
        public let env: EnvSnapshot?
        public init(lap: LapInfo, session: SessionInfo, env: EnvSnapshot? = nil) {
            self.lap = lap; self.session = session; self.env = env
        }
    }

    public struct Reference: Sendable {
        public let userId: String?
        public let carConfigId: String?
        public let timestamp: Date?
        public let clima: String?
        public let env: EnvSnapshot?
        public init(userId: String? = nil, carConfigId: String? = nil,
                    timestamp: Date? = nil, clima: String? = nil,
                    env: EnvSnapshot? = nil) {
            self.userId = userId; self.carConfigId = carConfigId
            self.timestamp = timestamp; self.clima = clima; self.env = env
        }
    }

    /// Filtra candidatos a baseline a partir do preset.
    /// Espelho 1:1 da função JS — ordena por tempoMs ascendente
    /// e devolve até `max(preset.minVoltas, 10)` candidatos.
    public static func filterForBaseline(candidates: [Candidate],
                                         ref: Reference,
                                         preset: Preset = defaultPreset) -> [Candidate] {
        var out: [Candidate] = []
        for c in candidates {
            if !c.lap.valida { continue }
            let e = c.env ?? EnvSnapshot()
            let r = ref.env ?? EnvSnapshot()
            let s = c.session

            // Pneu
            if preset.pneu.igualarMarca, let rc = r.composto, let ec = e.composto, rc != ec { continue }
            if let nMax = preset.pneu.nivelMax, let dn = e.desgasteNivelD, dn > nMax { continue }

            // Ambiente — clima
            if preset.ambiente.apenasClima, let refClima = ref.clima, let sClima = s.clima, refClima != sClima { continue }
            // Ambiente — temperaturas
            if let tol = preset.ambiente.tempPistaTol, let rt = r.tempPista, let et = e.tempPista,
               abs(rt - et) > tol { continue }
            if let tol = preset.ambiente.tempArTol, let ra = r.tempAr, let ea = e.tempAr,
               abs(ra - ea) > tol { continue }

            // Piloto
            if preset.piloto.apenasMesmoPiloto, let refUser = ref.userId, s.userId != refUser { continue }
            // Carro/configuração
            if preset.carroConfig.apenasMesmoCarroConfig, let refCfg = ref.carConfigId,
               s.carConfigurationId != refCfg { continue }
            // Dia
            if preset.dia.apenasMesmoDia, let refTs = ref.timestamp, let sTs = s.dataInicio {
                let cal = Calendar(identifier: .gregorian)
                let a = cal.startOfDay(for: refTs)
                let b = cal.startOfDay(for: sTs)
                if a != b { continue }
            }

            out.append(c)
        }

        out.sort { (a: Candidate, b: Candidate) in
            (a.lap.tempoMs ?? 9e9) < (b.lap.tempoMs ?? 9e9)
        }
        let limite = max(preset.minVoltas, 10)
        return Array(out.prefix(limite))
    }
}
