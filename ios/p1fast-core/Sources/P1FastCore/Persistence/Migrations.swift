// ═══════════════════════════════════════════════════════════
// Migrations — schema v1 (espelho de supabase/migrations/0001_initial.sql)
// ═══════════════════════════════════════════════════════════
// Mapeamento de tipos Postgres → SQLite:
//   uuid          → TEXT
//   text          → TEXT
//   timestamptz   → INTEGER (epoch ms — uniformiza com t/t_mono)
//   date          → INTEGER (epoch ms à meia-noite UTC)
//   jsonb         → TEXT (JSON serializado pelo caller)
//   integer       → INTEGER
//   bigint        → INTEGER
//   numeric       → REAL
//   boolean       → INTEGER (0/1)
//   bigserial     → INTEGER PRIMARY KEY AUTOINCREMENT
//
// Coluna `synced_at INTEGER NULL` em TODAS as tabelas exceto
// telemetry_samples (ADR-014). RLS do Postgres não tem equivalente local
// (sandbox do device é por usuário). Triggers updated_at não são criados —
// o lado Swift seta updated_at via PersistableRecord.

import Foundation
import GRDB

enum Migrations {
    static func register(into m: inout DatabaseMigrator) {
        m.registerMigration("v1_initial") { db in
            try v1Initial(db)
        }
        // ═══ v2_pull_cursor ════════════════════════════════════
        // Sprint 1A.6 sub-prompt E: cursor `last_sync_at` por tabela
        // pra catch-up sync via Edge Function `pull`.
        m.registerMigration("v2_pull_cursor") { db in
            try db.execute(sql: """
                CREATE TABLE sync_meta (
                    table_name      TEXT PRIMARY KEY,
                    last_sync_at    INTEGER NOT NULL DEFAULT 0
                );
            """)
        }
        // ═══ v2a_columns ═══════════════════════════════════════
        // Sprint 1A.4 — Prompt #16: novos campos em sessoes/pilotos/passageiros.
        // Espelha supabase/migrations/0006_v2_schema_columns.sql (a aplicar em prod
        // manualmente após o merge). Nome `v2a_columns` evita colisão com
        // `v2_pull_cursor` que já está em main.
        m.registerMigration("v2a_columns") { db in
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN pneu_id TEXT REFERENCES pneus(id) ON DELETE SET NULL;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN combustivel_id TEXT REFERENCES combustiveis(id) ON DELETE SET NULL;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN qt_combustivel_litros REAL;")
            try db.execute(sql: "CREATE INDEX idx_sessoes_pneu ON sessoes(pneu_id);")
            try db.execute(sql: "CREATE INDEX idx_sessoes_combustivel ON sessoes(combustivel_id);")
            try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN altura_cm INTEGER;")
            try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN peso_kg REAL;")
            try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN nascimento INTEGER;")
            try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN altura_cm INTEGER;")
            try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN peso_kg REAL;")
            try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN nascimento INTEGER;")
        }
    }

    // swiftlint:disable:next function_body_length
    private static func v1Initial(_ db: Database) throws {
        // ─── Workspace por time ───────────────────────────────
        try db.execute(sql: """
            CREATE TABLE times (
                id          TEXT PRIMARY KEY,
                nome        TEXT NOT NULL,
                criado_por  TEXT,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)

        try db.execute(sql: """
            CREATE TABLE usuarios_time (
                user_id     TEXT NOT NULL,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                role        TEXT NOT NULL DEFAULT 'membro' CHECK (role IN ('admin','membro')),
                created_at  INTEGER NOT NULL,
                synced_at   INTEGER,
                PRIMARY KEY (user_id, time_id)
            );
        """)

        // ─── Pista (track → layout → segment) ─────────────────
        try db.execute(sql: """
            CREATE TABLE tracks (
                id            TEXT PRIMARY KEY,
                apelido       TEXT NOT NULL,
                nome_oficial  TEXT,
                created_at    INTEGER NOT NULL,
                updated_at    INTEGER NOT NULL,
                synced_at     INTEGER
            );
        """)

        try db.execute(sql: """
            CREATE TABLE track_layouts (
                id              TEXT PRIMARY KEY,
                track_id        TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                nome            TEXT NOT NULL,
                parciais        TEXT,
                svg_path        TEXT,
                linha_chegada   TEXT,
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL,
                synced_at       INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_track_layouts_track ON track_layouts(track_id);")

        try db.execute(sql: """
            CREATE TABLE track_segments (
                id          TEXT PRIMARY KEY,
                layout_id   TEXT NOT NULL REFERENCES track_layouts(id) ON DELETE CASCADE,
                parcial_id  TEXT,
                ordem       INTEGER NOT NULL,
                eh_trecho   INTEGER NOT NULL DEFAULT 1,
                nome        TEXT,
                geometria   TEXT,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_track_segments_layout ON track_segments(layout_id);")
        try db.execute(sql: "CREATE INDEX idx_track_segments_layout_ordem ON track_segments(layout_id, ordem);")

        try db.execute(sql: """
            CREATE TABLE marcos (
                id          TEXT PRIMARY KEY,
                layout_id   TEXT NOT NULL REFERENCES track_layouts(id) ON DELETE CASCADE,
                tipo        TEXT NOT NULL CHECK (tipo IN ('largada','chegada','pit-in','pit-out','sinalizacao','box')),
                posicao     TEXT NOT NULL,
                label       TEXT,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_marcos_layout ON marcos(layout_id);")
        try db.execute(sql: "CREATE INDEX idx_marcos_tipo ON marcos(tipo);")

        try db.execute(sql: """
            CREATE TABLE retas_especiais (
                id              TEXT PRIMARY KEY,
                time_id         TEXT REFERENCES times(id) ON DELETE CASCADE,
                track_id        TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                segment_id      TEXT NOT NULL REFERENCES track_segments(id) ON DELETE CASCADE,
                tempo_medio_ms  INTEGER,
                auto_detectada  INTEGER NOT NULL DEFAULT 0,
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL,
                synced_at       INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_retas_track ON retas_especiais(track_id);")
        try db.execute(sql: "CREATE INDEX idx_retas_segment ON retas_especiais(segment_id);")

        // ─── Garagem ──────────────────────────────────────────
        try db.execute(sql: """
            CREATE TABLE carros (
                id                 TEXT PRIMARY KEY,
                time_id            TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                apelido            TEXT NOT NULL,
                modelo             TEXT,
                categoria          TEXT,
                cor                TEXT,
                fonte_temperatura  TEXT NOT NULL DEFAULT 'motor' CHECK (fonte_temperatura IN ('motor','pneu','ambos')),
                created_at         INTEGER NOT NULL,
                updated_at         INTEGER NOT NULL,
                synced_at          INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_carros_time ON carros(time_id);")

        try db.execute(sql: """
            CREATE TABLE configuracoes (
                id                       TEXT PRIMARY KEY,
                time_id                  TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                carro_id                 TEXT NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
                nome                     TEXT,
                data_aplicacao           INTEGER,
                overrides                TEXT,
                temperatura_ideal_range  TEXT,
                created_at               INTEGER NOT NULL,
                updated_at               INTEGER NOT NULL,
                synced_at                INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_configuracoes_carro ON configuracoes(carro_id);")
        try db.execute(sql: "CREATE INDEX idx_configuracoes_time ON configuracoes(time_id);")

        try db.execute(sql: """
            CREATE TABLE pilotos (
                id          TEXT PRIMARY KEY,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                nome        TEXT NOT NULL,
                user_id     TEXT,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_pilotos_time ON pilotos(time_id);")

        try db.execute(sql: """
            CREATE TABLE passageiros (
                id          TEXT PRIMARY KEY,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                nome        TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_passageiros_time ON passageiros(time_id);")

        try db.execute(sql: """
            CREATE TABLE pneus (
                id          TEXT PRIMARY KEY,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                carro_id    TEXT NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
                marca       TEXT,
                modelo      TEXT,
                medida      TEXT,
                composto    TEXT,
                ciclos      INTEGER DEFAULT 0,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_pneus_carro ON pneus(carro_id);")
        try db.execute(sql: "CREATE INDEX idx_pneus_time ON pneus(time_id);")

        try db.execute(sql: """
            CREATE TABLE combustiveis (
                id          TEXT PRIMARY KEY,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                nome        TEXT NOT NULL,
                tipo        TEXT,
                octanagem   REAL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_combustiveis_time ON combustiveis(time_id);")

        // ─── Eventos / sessões / voltas / executions ──────────
        try db.execute(sql: """
            CREATE TABLE eventos (
                id            TEXT PRIMARY KEY,
                time_id       TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                track_id      TEXT REFERENCES tracks(id) ON DELETE SET NULL,
                tipo          TEXT,
                data_evento   INTEGER NOT NULL,
                status        TEXT DEFAULT 'planejado',
                created_at    INTEGER NOT NULL,
                updated_at    INTEGER NOT NULL,
                synced_at     INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_eventos_time ON eventos(time_id);")
        try db.execute(sql: "CREATE INDEX idx_eventos_data ON eventos(data_evento);")

        try db.execute(sql: """
            CREATE TABLE sessoes (
                id                  TEXT PRIMARY KEY,
                time_id             TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                evento_id           TEXT REFERENCES eventos(id) ON DELETE SET NULL,
                carro_id            TEXT REFERENCES carros(id) ON DELETE SET NULL,
                piloto_id           TEXT REFERENCES pilotos(id) ON DELETE SET NULL,
                configuracao_id     TEXT REFERENCES configuracoes(id) ON DELETE SET NULL,
                status              TEXT DEFAULT 'planejada',
                data_inicio         INTEGER,
                data_fim            INTEGER,
                voltas_planejadas   INTEGER CHECK (voltas_planejadas IS NULL OR voltas_planejadas >= 1),
                objetivo            TEXT,
                created_at          INTEGER NOT NULL,
                updated_at          INTEGER NOT NULL,
                synced_at           INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_sessoes_time ON sessoes(time_id);")
        try db.execute(sql: "CREATE INDEX idx_sessoes_evento ON sessoes(evento_id);")
        try db.execute(sql: "CREATE INDEX idx_sessoes_carro ON sessoes(carro_id);")

        try db.execute(sql: """
            CREATE TABLE voltas (
                id                  TEXT PRIMARY KEY,
                time_id             TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                sessao_id           TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
                numero              INTEGER NOT NULL,
                tempo_ms            INTEGER,
                tempos_por_parcial  TEXT,
                valida              INTEGER DEFAULT 1,
                motivo_invalidacao  TEXT,
                inicio_at           INTEGER,
                created_at          INTEGER NOT NULL,
                updated_at          INTEGER NOT NULL,
                synced_at           INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_voltas_sessao ON voltas(sessao_id);")
        try db.execute(sql: "CREATE INDEX idx_voltas_sessao_numero ON voltas(sessao_id, numero);")

        try db.execute(sql: """
            CREATE TABLE segment_executions (
                id              TEXT PRIMARY KEY,
                time_id         TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                sessao_id       TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
                volta_id        TEXT NOT NULL REFERENCES voltas(id) ON DELETE CASCADE,
                segment_id      TEXT REFERENCES track_segments(id) ON DELETE SET NULL,
                tempo_ms        INTEGER,
                velocidade_max  REAL,
                created_at      INTEGER NOT NULL,
                synced_at       INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_segexec_sessao ON segment_executions(sessao_id);")
        try db.execute(sql: "CREATE INDEX idx_segexec_volta ON segment_executions(volta_id);")

        // ─── Telemetria append-only (ADR-014: SEM synced_at) ──
        try db.execute(sql: """
            CREATE TABLE telemetry_samples (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                time_id       TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                sessao_id     TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
                seq           INTEGER NOT NULL,
                t             INTEGER NOT NULL,
                t_mono        REAL,
                payload       TEXT NOT NULL,
                uploaded_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_telemetry_sessao_seq ON telemetry_samples(sessao_id, seq);")
        try db.execute(sql: "CREATE INDEX idx_telemetry_sessao_t ON telemetry_samples(sessao_id, t);")

        // ─── Mensagens / troféus ──────────────────────────────
        try db.execute(sql: """
            CREATE TABLE mensagens (
                id              TEXT PRIMARY KEY,
                time_id         TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                sessao_id       TEXT REFERENCES sessoes(id) ON DELETE CASCADE,
                tipo            TEXT NOT NULL,
                origem          TEXT,
                texto           TEXT NOT NULL,
                visivel_no_box  INTEGER NOT NULL DEFAULT 1,
                enviada_em      INTEGER NOT NULL,
                created_at      INTEGER NOT NULL,
                synced_at       INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_mensagens_sessao ON mensagens(sessao_id);")
        try db.execute(sql: "CREATE INDEX idx_mensagens_time_enviada ON mensagens(time_id, enviada_em DESC);")

        try db.execute(sql: """
            CREATE TABLE trofeus_ganhos (
                id          TEXT PRIMARY KEY,
                time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                piloto_id   TEXT NOT NULL REFERENCES pilotos(id) ON DELETE CASCADE,
                sessao_id   TEXT REFERENCES sessoes(id) ON DELETE SET NULL,
                trofeu_id   TEXT NOT NULL,
                ganho_em    INTEGER NOT NULL,
                metadados   TEXT,
                created_at  INTEGER NOT NULL,
                synced_at   INTEGER
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_trofeus_piloto ON trofeus_ganhos(piloto_id);")
        try db.execute(sql: "CREATE INDEX idx_trofeus_time ON trofeus_ganhos(time_id);")

        // ─── sync_queue local ────────────────────────────────
        // Replay pendente de mutações locais que ainda não foram sincronizadas
        // pro Supabase. Drainer (Sprint 1A.6) consome por (table_name, row_id).
        try db.execute(sql: """
            CREATE TABLE sync_queue (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name   TEXT NOT NULL,
                row_id       TEXT NOT NULL,
                op           TEXT NOT NULL CHECK (op IN ('insert','update','delete')),
                payload      TEXT,
                attempts     INTEGER NOT NULL DEFAULT 0,
                created_at   INTEGER NOT NULL
            );
        """)
        try db.execute(sql: "CREATE INDEX idx_syncq_table_row ON sync_queue(table_name, row_id);")
        try db.execute(sql: "CREATE INDEX idx_syncq_created ON sync_queue(created_at);")
    }
}
