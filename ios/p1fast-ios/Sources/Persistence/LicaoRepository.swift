// ═══════════════════════════════════════════════════════════
// LicaoRepository — catálogo curado de lições (readonly)
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #20. Lição é catálogo global (sem time_id —
// dev-curated, igual tracks). bootstrap() popula 12 lições canônicas
// portadas de `src/data/lesson-library.js`: 7 MVP ativas + 5 Fase 2
// inativas (esperando sensores que ainda não chegam ao snapshot).
//
// V1 = readonly. Sem CRUD pelo usuário. Bootstrap idempotente:
// se a tabela tem N=12 rows, no-op; se diferente (drift de versão),
// upsert por id mantendo a flag `ativa` atual no banco quando o seed
// padrão coincidir, ou aplicando o estado seedado.
//
// Sinais requeridos são serializados como JSON (TEXT) — consumidor que
// precisar ler decodifica. App V1 só mostra "X sinais" no detalhe,
// sem expandir; lista completa fica pra cockpit.

import Foundation
import GRDB
import P1FastCore

@MainActor
final class LicaoRepository: ObservableObject {
    @Published private(set) var licoes: [Licao] = []

    private let queue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.queue = queue
    }

    func bootstrap() async {
        do {
            try await seedCanonicalIfDifferent()
            try await reload()
        } catch {
            print("LicaoRepository.bootstrap failed: \(error)")
        }
    }

    func reload() async throws {
        let rows = try await queue.read { db in
            try Licao.order(
                Column("ativa").desc, Column("categoria").asc, Column("nivel").asc
            ).fetchAll(db)
        }
        self.licoes = rows
    }

    /// Apenas as lições com `ativa=true` (filtro padrão da UI).
    var ativas: [Licao] {
        licoes.filter(\.ativa)
    }

    func find(id: String) -> Licao? {
        licoes.first(where: { $0.id == id })
    }

    // MARK: - Seed canônico (12 lições)

    /// Compara o conjunto seedado vs o que está no banco. Se idêntico,
    /// no-op. Se diferente (faltando rows ou drift de campos não-`ativa`),
    /// upsert. Preserva flag `ativa` do banco quando o seed e o banco
    /// têm o mesmo registro — usuário não pode mudar `ativa` (V1), mas
    /// previne sobrescrita acidental.
    private func seedCanonicalIfDifferent() async throws {
        let seeded = Self.canonicalLicoes
        try await queue.write { db in
            let existing = try Licao.fetchAll(db)
            let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
            for var seed in seeded {
                if let curr = existingById[seed.id] {
                    // Preserva `ativa`, `createdAt` do banco. Atualiza outros campos só
                    // se algo divergiu — assim drift entre versões do app aparece.
                    if Self.semanticallyEqual(curr, seed, withoutTimestamps: true) {
                        continue  // exato igual, nada a fazer
                    }
                    seed.ativa = curr.ativa
                    seed.createdAt = curr.createdAt
                    seed.updatedAt = DB.nowMs()
                    try seed.update(db)
                } else {
                    try seed.insert(db)
                }
            }
        }
    }

    nonisolated private static func semanticallyEqual(_ a: Licao, _ b: Licao, withoutTimestamps: Bool) -> Bool {
        return a.id == b.id
            && a.titulo == b.titulo
            && a.descricao == b.descricao
            && a.categoria == b.categoria
            && a.nivel == b.nivel
            && a.fase == b.fase
            && a.tipoCurva == b.tipoCurva
            && a.sinaisRequeridos == b.sinaisRequeridos
    }

    /// Catálogo das 12 lições canônicas. Portado literal de
    /// `src/data/lesson-library.js` (LESSONS_MVP + LESSONS_PHASE_2):
    /// 7 ativas (MVP) + 5 inativas (Fase 2 — sinais ainda não chegam).
    nonisolated static let canonicalLicoes: [Licao] = {
        let now = DB.nowMs()
        return [
            // MVP — 7 ativas
            Licao(
                id: "L001-referencia-fixa",
                titulo: "Referência Fixa",
                descricao: "Frear, virar e acelerar sempre nos mesmos pontos.",
                categoria: "REFERENCIA",
                nivel: "INTRO",
                fase: "ENTRADA",
                tipoCurva: "lenta,media,rapida",
                sinaisRequeridos: #"["LAT","LNG","KMH"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L002-v-min",
                titulo: "V-Min",
                descricao: "Manter velocidade mínima alta e consistente no apex.",
                categoria: "VELOCIDADE",
                nivel: "INTRO",
                fase: "APEX",
                tipoCurva: "lenta,media",
                sinaisRequeridos: #"["KMH","V_MIN","PHASE"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L003-transicao-freio-acelerador",
                titulo: "Transição Freio-Acelerador",
                descricao: "Sem coast longo entre soltar freio e abrir acelerador.",
                categoria: "TRANSICAO",
                nivel: "PADRAO",
                fase: "APEX",
                tipoCurva: "lenta,media,rapida",
                sinaisRequeridos: #"["ACC_LONG","KMH","PHASE"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L004-acelerador-progressivo",
                titulo: "Acelerador Progressivo",
                descricao: "Abrir o gás suave, sem bate-bate na saída.",
                categoria: "TRANSICAO",
                nivel: "PADRAO",
                fase: "SAIDA",
                tipoCurva: "lenta,media",
                sinaisRequeridos: #"["ACC_LONG","KMH","PHASE"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L005-linha-de-visao",
                titulo: "Linha de Visão",
                descricao: "Olhar adiante, antecipar o apex e a saída.",
                categoria: "VISAO",
                nivel: "INTRO",
                fase: "ENTRADA",
                tipoCurva: "lenta,media,rapida",
                sinaisRequeridos: #"["HEADING","GYRO_YAW","PHASE"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L006-controle-subesterco",
                titulo: "Controle de Subesterço",
                descricao: "Carro empurra: aliviar e abrir, não insistir.",
                categoria: "CONTROLE",
                nivel: "PADRAO",
                fase: "APEX",
                tipoCurva: "media,rapida",
                sinaisRequeridos: #"["ACC_LAT","KMH","GYRO_YAW","PHASE"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L007-curva-cega",
                titulo: "Curva Cega",
                descricao: "Comprometer trajetória mesmo sem ver a saída.",
                categoria: "REFERENCIA",
                nivel: "PADRAO",
                fase: "ENTRADA",
                tipoCurva: "lenta,media",
                sinaisRequeridos: #"["LAT","LNG","KMH"]"#,
                ativa: true,
                createdAt: now, updatedAt: now
            ),
            // Fase 2 — 5 inativas (esperando sensores)
            Licao(
                id: "L101-volante-continuo",
                titulo: "Volante Contínuo",
                descricao: "Sem corrigir, sem rasgar — entrada em arco único.",
                categoria: "CONTROLE",
                nivel: "AVANCADO",
                fase: "ENTRADA",
                tipoCurva: "lenta,media,rapida",
                sinaisRequeridos: #"["STEERING","PHASE"]"#,
                ativa: false,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L102-circulo-de-grip",
                titulo: "Círculo de Grip",
                descricao: "Somar lat e long sem perder o envelope.",
                categoria: "CONTROLE",
                nivel: "AVANCADO",
                fase: "APEX",
                tipoCurva: "lenta,media,rapida",
                sinaisRequeridos: #"["ACC_LAT","ACC_LONG","PHASE"]"#,
                ativa: false,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L103-pneu-arrastando",
                titulo: "Pneu Arrastando",
                descricao: "Entrar travado/derrapando custa mais que parece.",
                categoria: "SUPERFICIE",
                nivel: "AVANCADO",
                fase: "ENTRADA",
                tipoCurva: "lenta,media",
                sinaisRequeridos: #"["SLIP_RATIO","KMH","PHASE"]"#,
                ativa: false,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L104-controle-sobresterco",
                titulo: "Controle de Sobresterço",
                descricao: "Saída solta na traseira — antecipar a correção.",
                categoria: "CONTROLE",
                nivel: "AVANCADO",
                fase: "SAIDA",
                tipoCurva: "media,rapida",
                sinaisRequeridos: #"["GYRO_YAW","ACC_LAT","STEERING","PHASE"]"#,
                ativa: false,
                createdAt: now, updatedAt: now
            ),
            Licao(
                id: "L105-uso-seguro-zebra",
                titulo: "Uso Seguro de Zebra",
                descricao: "Pisar na zebra sem desestabilizar o carro.",
                categoria: "SUPERFICIE",
                nivel: "AVANCADO",
                fase: "APEX",
                tipoCurva: "media,rapida",
                sinaisRequeridos: #"["LAT","LNG","ACC_LAT","GYRO_YAW"]"#,
                ativa: false,
                createdAt: now, updatedAt: now
            ),
        ]
    }()
}
