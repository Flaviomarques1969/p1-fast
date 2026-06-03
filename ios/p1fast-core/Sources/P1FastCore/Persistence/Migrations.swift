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
        // ═══ v4_licoes ═════════════════════════════════════════
        // Sprint 1A.5 — Prompt #20: catálogo curado de lições. Tabela
        // `licoes` é GLOBAL (não tem `time_id` — é dev-curated). Espelha
        // supabase/migrations/0004_licoes.sql (a aplicar em prod
        // manualmente após o merge). Seed das 12 lições é
        // responsabilidade do LicaoRepository.bootstrap() (canonico em
        // Swift, portado de src/data/lesson-library.js).
        m.registerMigration("v4_licoes") { db in
            try db.execute(sql: """
                CREATE TABLE licoes (
                    id                TEXT PRIMARY KEY,
                    titulo            TEXT NOT NULL,
                    descricao         TEXT,
                    categoria         TEXT NOT NULL,
                    nivel             TEXT NOT NULL,
                    fase              TEXT,
                    tipo_curva        TEXT,
                    sinais_requeridos TEXT,
                    ativa             INTEGER NOT NULL DEFAULT 1,
                    created_at        INTEGER NOT NULL,
                    updated_at        INTEGER NOT NULL,
                    synced_at         INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_licoes_ativa ON licoes(ativa);")
            try db.execute(sql: "CREATE INDEX idx_licoes_categoria ON licoes(categoria);")
        }
        // ═══ v5_pendencias ═════════════════════════════════════
        // Sprint 1A.5 — Prompt #21: checklist cascata por evento.
        // pendencias_template = catálogo curado (GLOBAL, igual licoes).
        // evento_pendencias = instâncias por evento (UNIQUE evento+template).
        // Espelha supabase/migrations/0005_pendencias.sql.
        m.registerMigration("v5_pendencias") { db in
            try db.execute(sql: """
                CREATE TABLE pendencias_template (
                    id            TEXT PRIMARY KEY,
                    grupo_id      TEXT NOT NULL,
                    grupo_titulo  TEXT NOT NULL,
                    grupo_num     TEXT NOT NULL,
                    titulo        TEXT NOT NULL,
                    observacao    TEXT,
                    obrigatorio   INTEGER NOT NULL DEFAULT 0,
                    ordem         INTEGER NOT NULL,
                    created_at    INTEGER NOT NULL,
                    updated_at    INTEGER NOT NULL,
                    synced_at     INTEGER
                );
            """)
            try db.execute(sql: """
                CREATE TABLE evento_pendencias (
                    id           TEXT PRIMARY KEY,
                    evento_id    TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                    template_id  TEXT NOT NULL REFERENCES pendencias_template(id) ON DELETE CASCADE,
                    checado      INTEGER NOT NULL DEFAULT 0,
                    checado_at   INTEGER,
                    nota         TEXT,
                    created_at   INTEGER NOT NULL,
                    updated_at   INTEGER NOT NULL,
                    synced_at    INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_evento_pendencias_evento ON evento_pendencias(evento_id);")
            try db.execute(sql: "CREATE UNIQUE INDEX idx_evento_pendencias_unique ON evento_pendencias(evento_id, template_id);")
        }
        // ═══ v6_vmin_georef ════════════════════════════════════
        // MS-2.4 (PLANO_FASE_1) — segment_executions ganha o trio
        // (vmin_kmh, vmin_x, vmin_y). Persistência consumindo o Detector
        // real entra em MS-2.5; aqui só prepara o schema. Todas as
        // colunas NULL — execuções legadas continuam válidas sem o trio.
        // Espelha supabase/migrations/0007_vmin_georef.sql.
        m.registerMigration("v6_vmin_georef") { db in
            try db.execute(sql: "ALTER TABLE segment_executions ADD COLUMN vmin_kmh REAL;")
            try db.execute(sql: "ALTER TABLE segment_executions ADD COLUMN vmin_x REAL;")
            try db.execute(sql: "ALTER TABLE segment_executions ADD COLUMN vmin_y REAL;")
        }
        // ═══ v7_telemetry_samples_enriched ═════════════════════
        // MS-2.7 PR B (PLANO_FASE_1) — persistência da saída do
        // KalmanINSGPS (PR A, #99) por sample. Append-only ADR-014:
        // SEM synced_at, NÃO passa por sync_queue. Volume proibitivo
        // (36k rows/sessão a 10 Hz) será sincronizado por batch.
        // Schema-only — escrita real chega no MS-2.7 PR C
        // (LiveKalmanProcessor consumindo LiveTelemetryRecorder).
        // Espelha supabase/migrations/0008_telemetry_samples_enriched.sql.
        m.registerMigration("v7_telemetry_samples_enriched") { db in
            try db.execute(sql: """
                CREATE TABLE telemetry_samples_enriched (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    time_id       TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                    sessao_id     TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
                    seq           INTEGER NOT NULL,
                    t             INTEGER NOT NULL,
                    t_mono        REAL,
                    x_m           REAL NOT NULL,
                    y_m           REAL NOT NULL,
                    vx_mps        REAL NOT NULL,
                    vy_mps        REAL NOT NULL,
                    heading_deg   REAL NOT NULL,
                    pos_sigma_m   REAL NOT NULL,
                    source_kalman INTEGER NOT NULL CHECK (source_kalman IN (0, 1)),
                    uploaded_at   INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_telemetry_enriched_sessao_seq ON telemetry_samples_enriched(sessao_id, seq);")
            try db.execute(sql: "CREATE INDEX idx_telemetry_enriched_sessao_t ON telemetry_samples_enriched(sessao_id, t);")
        }
        // ═══ v8_track_geo_anchors_view_box ═════════════════════
        // MS-2.6.c (PLANO_FASE_1) — geo_ancoras (em tracks) + view_box
        // (em track_layouts) deixam de viver hardcoded em SeedBrasilia
        // e passam a ser persistidos. Pré-requisito pra TelemetriaView
        // largar `SeedBrasilia.make()` e usar `TrackRepository.currentTrack()`,
        // e pra cadastro de pista pelo usuário no futuro.
        // Espelha supabase/migrations/0009_track_geo_anchors_view_box.sql.
        // Colunas TEXT (JSON) — mesmo padrão de svg_path, parciais,
        // linha_chegada, geometria.
        m.registerMigration("v8_track_geo_anchors_view_box") { db in
            try db.execute(sql: "ALTER TABLE tracks         ADD COLUMN geo_ancoras TEXT;")
            try db.execute(sql: "ALTER TABLE track_layouts  ADD COLUMN view_box    TEXT;")
        }
        // ═══ v9_telemetry_enriched_gap_duration ═════════════════
        // A-07 (#117 PR A) — Kalman gap recovery resetando
        // covariância em gap > 5s. `gap_duration_ms` é setado só na
        // amostra que disparou reset. Field test 2026-05-06 expôs
        // pos_sigma divergindo pra 1e+55 quando app foi morto em
        // background — esta coluna torna o evento observável e
        // alimenta UI de aviso ("captura interrompida X s").
        // Espelha supabase/migrations/0010_kalman_gap_duration.sql.
        m.registerMigration("v9_telemetry_enriched_gap_duration") { db in
            try db.execute(sql: "ALTER TABLE telemetry_samples_enriched ADD COLUMN gap_duration_ms REAL;")
        }

        // ═══ v10_brasilia_uuid ═════════════════════════════════
        // Bug E1: track id literal `"trk_brasilia"` é incompatível com
        // Postgres que tem `tracks.id` uuid. Evento real (4E6DA001)
        // travou no sync com `invalid input syntax for type uuid`.
        // Renomeia pro UUID5 determinístico (DNS namespace, "p1fast.brasilia"):
        //   e8335412-3312-54fe-b634-db2d02c7fa81
        // Servidor cria a row em tracks com mesmo UUID via migration
        // 0012_seed_brasilia.sql. defer_foreign_keys evita CASCADE
        // problemas durante o re-bind das FKs.
        m.registerMigration("v10_brasilia_uuid") { db in
            let oldId = "trk_brasilia"
            let newId = "e8335412-3312-54fe-b634-db2d02c7fa81"
            try db.execute(sql: "PRAGMA defer_foreign_keys = ON;")
            try db.execute(sql: "UPDATE tracks SET id = ? WHERE id = ?;", arguments: [newId, oldId])
            try db.execute(sql: "UPDATE track_layouts SET track_id = ? WHERE track_id = ?;", arguments: [newId, oldId])
            try db.execute(sql: "UPDATE eventos SET track_id = ? WHERE track_id = ?;", arguments: [newId, oldId])
            try db.execute(sql: "UPDATE retas_especiais SET track_id = ? WHERE track_id = ?;", arguments: [newId, oldId])
            // `marcos` no schema local referencia layouts (`layout_id`),
            // não tracks direto — não precisa rebind aqui. No servidor
            // marcos tem `track_id` direto, mas isso é coberto pelo
            // catálogo (track_layouts.track_id já aponta pro novo UUID).
        }

        // ═══ v11_sync_queue_last_error ═════════════════════════
        // Sem isso, o motivo de rejeição da Edge Function `sync` (stale-write,
        // not-member-of-time, db-error, row-not-found, ...) era descartado em
        // `incrementAttempts`. Field test 2026-05-09: row de pilotos·update
        // bateu attempts=5 sem o usuário (nem o Claude) saber o porquê — só
        // dava pra adivinhar. last_error é local-only (não vai pro servidor),
        // sobrescrito a cada nova tentativa rejeitada.
        m.registerMigration("v11_sync_queue_last_error") { db in
            try db.execute(sql: "ALTER TABLE sync_queue ADD COLUMN last_error TEXT;")
        }

        // ═══ v12_reset_legacy_dead_letters ═════════════════════
        // Rows que viraram dead-letter ANTES da v11 não têm last_error
        // gravado — perderam o motivo da falha. Bug raiz (trigger Postgres
        // sobrescrevendo updated_at + drainer não tratando stale-write)
        // foi resolvido em paralelo: trigger fixed em
        // 0013_set_updated_at_respects_client.sql, drainer trata
        // stale-write como drain canônico LWW. Reset zera só rows legacy
        // (last_error IS NULL) — novos dead-letters preservam state.
        m.registerMigration("v12_reset_legacy_dead_letters") { db in
            try db.execute(sql: """
                UPDATE sync_queue SET attempts = 0
                WHERE attempts >= 5 AND last_error IS NULL;
            """)
        }

        // ═══ v13_nascimento_seconds_to_ms ══════════════════════
        // PilotoCadastroView/PassageiroCadastroView gravavam nascimento
        // em SEGUNDOS desde epoch (`Int64(date.timeIntervalSince1970)`).
        // Edge Function `coerceTimestamps` faz `new Date(v).toISOString()`
        // assumindo MS — então 1265673600 (2010-02-09 em segundos) virava
        // 1970-01-15 em ms (14.6 dias após epoch). Field test 2026-05-09:
        // server tinha Bubi com nascimento="1970-01-15", correto seria
        // "2010-02-09". Conversão 1× pra alinhar com o resto do app
        // (created_at, updated_at, data_aplicacao já são ms).
        // Filtro `< 100000000000` (1e11) protege contra dupla aplicação:
        // valores em ms já estão acima dessa threshold (10^12 pra
        // datas pós-2001), em segundos abaixo (10^9 pra datas pós-2001).
        m.registerMigration("v13_nascimento_seconds_to_ms") { db in
            try db.execute(sql: """
                UPDATE pilotos SET nascimento = nascimento * 1000
                WHERE nascimento IS NOT NULL AND nascimento < 100000000000;
            """)
            try db.execute(sql: """
                UPDATE passageiros SET nascimento = nascimento * 1000
                WHERE nascimento IS NOT NULL AND nascimento < 100000000000;
            """)
        }

        // ═══ v14_ms4_sessoes_extensions ════════════════════════
        // MS-4 etapa 1. Espelha supabase/migrations/0014_ms4_sessoes_extensions.sql.
        // Campos novos pra StintPlan estendido — paradas_box, ia_ligada,
        // mapa_ghost_ligado, licao_id, cancelado_em, pilotos_revezamento,
        // convidado_id. Decisões em docs/FRENTES_POS_MS4.md (PR #175).
        //
        // Papel 'chefe_equipe' (Q23) é só servidor — tabela usuarios_time
        // não existe em SQLite local (sandbox por usuário, sem multi-user
        // local). Permissões consumem auth.role via TeamContext.
        m.registerMigration("v14_ms4_sessoes_extensions") { db in
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN paradas_box TEXT NOT NULL DEFAULT '[]';")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN ia_ligada INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN mapa_ghost_ligado INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN licao_id TEXT REFERENCES licoes(id) ON DELETE SET NULL;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN cancelado_em INTEGER;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN pilotos_revezamento TEXT;")
            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN convidado_id TEXT REFERENCES pilotos(id) ON DELETE SET NULL;")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sessoes_licao ON sessoes(licao_id);")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sessoes_convidado ON sessoes(convidado_id);")
        }

        // ═══ v15_ms11_video_streams ════════════════════════════
        // MS-11 etapa 1. Espelha supabase/migrations/0015_ms11_video_streams.sql.
        // Tabela video_streams (1:1 com sessoes) registra cada transmissão
        // de vídeo ao vivo via Daily.co. ADR-024 escolheu Daily.co como
        // serviço de stream do MVP. Decisões registradas em respostas
        // do Flávio em 2026-05-11 (rodadas 1+2).
        //
        // RLS local não tem equivalente — sandbox do device é por usuário.
        // Apenas member do time vê streams no servidor (RLS Postgres).
        m.registerMigration("v15_ms11_video_streams") { db in
            try db.execute(sql: """
                CREATE TABLE video_streams (
                    id                   TEXT PRIMARY KEY,
                    time_id              TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                    sessao_id            TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
                    daily_room_url       TEXT NOT NULL,
                    daily_room_name      TEXT NOT NULL,
                    status               TEXT NOT NULL DEFAULT 'iniciando'
                                         CHECK (status IN ('iniciando','ao_vivo','sem_sinal','encerrado','falha')),
                    started_at           INTEGER,
                    ended_at             INTEGER,
                    ultima_heartbeat     INTEGER,
                    bateria_inicio       INTEGER CHECK (bateria_inicio IS NULL OR (bateria_inicio BETWEEN 0 AND 100)),
                    bateria_fim          INTEGER CHECK (bateria_fim IS NULL OR (bateria_fim BETWEEN 0 AND 100)),
                    motivo_encerramento  TEXT,
                    created_at           INTEGER NOT NULL,
                    updated_at           INTEGER NOT NULL,
                    synced_at            INTEGER
                );
            """)
            try db.execute(sql: "CREATE UNIQUE INDEX idx_video_streams_sessao ON video_streams(sessao_id);")
            try db.execute(sql: "CREATE INDEX idx_video_streams_time_started ON video_streams(time_id, started_at DESC);")
            // Link público por evento (Q2.4) — vale o dia inteiro
            try db.execute(sql: "ALTER TABLE eventos ADD COLUMN link_publico_video_token TEXT;")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_eventos_link_publico ON eventos(link_publico_video_token);")
        }

        // ═══ v16_volta_video ═══════════════════════════════════
        // F4 etapa 2. Espelha supabase/migrations/0016_volta_video.sql.
        // Tabela volta_video indexa cada volta dentro da gravação Daily.co
        // (1 gravação por stream, 1 stream por sessão). Cada row marca
        // onde a volta começa/termina dentro do vídeo + status de triagem.
        //
        // Decisões registradas (rodada 1+2 de 2026-05-11):
        //   Q18+Q2.5: gravação cobre todo stream; triagem volta-a-volta = F4
        //   Q2.5: triagem por piloto + chefe da equipe (refinada em F4.6)
        m.registerMigration("v16_volta_video") { db in
            try db.execute(sql: """
                CREATE TABLE volta_video (
                    id               TEXT PRIMARY KEY,
                    time_id          TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                    video_stream_id  TEXT NOT NULL REFERENCES video_streams(id) ON DELETE CASCADE,
                    volta_id         TEXT NOT NULL REFERENCES voltas(id) ON DELETE CASCADE,
                    t_inicio_ms      INTEGER NOT NULL CHECK (t_inicio_ms >= 0),
                    t_fim_ms         INTEGER NOT NULL CHECK (t_fim_ms > t_inicio_ms),
                    triagem_status   TEXT NOT NULL DEFAULT 'pendente'
                                     CHECK (triagem_status IN ('pendente','mantida','descartada')),
                    triada_por       TEXT,
                    triada_em        INTEGER,
                    created_at       INTEGER NOT NULL,
                    updated_at       INTEGER NOT NULL,
                    synced_at        INTEGER
                );
            """)
            try db.execute(sql: "CREATE UNIQUE INDEX idx_volta_video_volta ON volta_video(volta_id);")
            try db.execute(sql: "CREATE INDEX idx_volta_video_stream ON volta_video(video_stream_id);")
            try db.execute(sql: "CREATE INDEX idx_volta_video_time_status ON volta_video(time_id, triagem_status);")
        }

        // ═══ v17_pessoas ═══════════════════════════════════════
        // F1 etapa A.1 (Unificação de pessoas multi-papel). Espelha
        // supabase/migrations/0018_pessoas.sql. Tabela `pessoas`
        // unifica pilotos + passageiros + papéis novos (engenheiro,
        // mecanico, coach, convidado, chefe_equipe) numa entidade só.
        //
        // Fase A: cria tabela vazia. Fase B (futura) migra dados de
        // pilotos+passageiros, atualiza sessoes, reescreve repos e UIs.
        //
        // Mockups Onda 1 (PR #174) + decisão Flávio: uma única entidade
        // Pessoa com múltiplos papéis selecionáveis.
        m.registerMigration("v17_pessoas") { db in
            try db.execute(sql: """
                CREATE TABLE pessoas (
                    id          TEXT PRIMARY KEY,
                    time_id     TEXT NOT NULL REFERENCES times(id) ON DELETE CASCADE,
                    nome        TEXT NOT NULL CHECK (LENGTH(TRIM(nome)) > 0),
                    user_id     TEXT,
                    altura_cm   INTEGER CHECK (altura_cm IS NULL OR (altura_cm BETWEEN 50 AND 250)),
                    peso_kg     REAL CHECK (peso_kg IS NULL OR (peso_kg BETWEEN 20 AND 250)),
                    nascimento  INTEGER,
                    created_at  INTEGER NOT NULL,
                    updated_at  INTEGER NOT NULL,
                    synced_at   INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_pessoas_time ON pessoas(time_id);")
            try db.execute(sql: "CREATE INDEX idx_pessoas_user ON pessoas(user_id) WHERE user_id IS NOT NULL;")
        }

        // ═══ v18_pessoa_papeis ═════════════════════════════════
        // F1 etapa A.2. Espelha supabase/migrations/0019_pessoa_papeis.sql.
        // Relação 1:N — cada pessoa pode ter N papéis simultâneos.
        // PK composta (pessoa_id, papel) impede duplicata silenciosa.
        m.registerMigration("v18_pessoa_papeis") { db in
            try db.execute(sql: """
                CREATE TABLE pessoa_papeis (
                    pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
                    papel       TEXT NOT NULL CHECK (papel IN (
                                  'piloto','passageiro','engenheiro',
                                  'mecanico','coach','convidado','chefe_equipe'
                                )),
                    created_at  INTEGER NOT NULL,
                    synced_at   INTEGER,
                    PRIMARY KEY (pessoa_id, papel)
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_pessoa_papeis_papel ON pessoa_papeis(papel);")
        }

        // ═══ v19_carros_foto_url ════════════════════════════════
        // S2 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0020_carros_foto_url.sql.
        // Adiciona o campo opcional `foto_url` em `carros` — caminho
        // (key) do arquivo no bucket `carro-fotos` do Supabase Storage.
        // A leitura/exibição usa AsyncImage, o upload é feito pelo
        // CarroRepository.uploadFoto com compressão automática (≤ 500KB).
        m.registerMigration("v19_carros_foto_url") { db in
            try db.execute(sql: "ALTER TABLE carros ADD COLUMN foto_url TEXT;")
        }

        // ═══ v20_tracks_cidade ═════════════════════════════════
        // S4 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0021_tracks_cidade.sql.
        // Adiciona coluna `cidade` em `tracks`. Usada pra agrupar
        // autódromos na tela de seleção do cadastro de evento.
        // Atualiza Brasília legada (apelido='Brasília') pra cidade='Brasília'.
        m.registerMigration("v20_tracks_cidade") { db in
            try db.execute(sql: "ALTER TABLE tracks ADD COLUMN cidade TEXT;")
            try db.execute(sql: "UPDATE tracks SET cidade = 'Brasília' WHERE apelido = 'Brasília' AND cidade IS NULL;")
        }

        // ═══ v21_pendencias_consumiveis ════════════════════════
        // S8 #21 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0022_pendencias_consumiveis.sql.
        // Templates de pendência ganham flag `eh_consumivel` (1 quando
        // o item é consumível tipo óleo/combustível) e `unidade` (texto:
        // "L" pra litros, "mL" pra mililitros). evento_pendencias ganha
        // `quantidade` (numérica). UI condiciona o campo: só pendências
        // consumíveis pedem quantidade ao marcar como feita.
        m.registerMigration("v21_pendencias_consumiveis") { db in
            try db.execute(sql: "ALTER TABLE pendencias_template ADD COLUMN eh_consumivel INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE pendencias_template ADD COLUMN unidade TEXT;")
            try db.execute(sql: "ALTER TABLE evento_pendencias ADD COLUMN quantidade REAL;")
            // Backfill heurístico: marca consumíveis pela palavra-chave
            // no título. Lista canônica do Flávio quando ele passar.
            try db.execute(sql: """
                UPDATE pendencias_template
                SET eh_consumivel = 1,
                    unidade = 'L'
                WHERE LOWER(titulo) LIKE '%óleo%'
                   OR LOWER(titulo) LIKE '%oleo%'
                   OR LOWER(titulo) LIKE '%combustível%'
                   OR LOWER(titulo) LIKE '%combustivel%'
                   OR LOWER(titulo) LIKE '%aditivo%'
                   OR LOWER(titulo) LIKE '%fluido%';
            """)
        }

        // ═══ v22_pneus_serie_evento ════════════════════════════
        // S8 #23 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0023_pneus_serie_evento.sql.
        // Pneus ganham `numero_serie` (identificador físico). Nova
        // tabela `evento_pneus` liga pneus aos eventos onde foram usados.
        // Estrutura preparatória pra TPMS (campos pressão/temperatura
        // atual já presentes — UI futura plumba quando hardware chegar).
        m.registerMigration("v22_pneus_serie_evento") { db in
            try db.execute(sql: "ALTER TABLE pneus ADD COLUMN numero_serie TEXT;")
            try db.execute(sql: """
                CREATE TABLE evento_pneus (
                    id              TEXT PRIMARY KEY,
                    time_id         TEXT NOT NULL,
                    evento_id       TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                    pneu_id         TEXT NOT NULL REFERENCES pneus(id) ON DELETE CASCADE,
                    pressao_atual_psi    REAL,
                    temperatura_atual_c  REAL,
                    ultima_leitura_em    INTEGER,
                    created_at      INTEGER NOT NULL,
                    updated_at      INTEGER NOT NULL,
                    synced_at       INTEGER,
                    UNIQUE(evento_id, pneu_id)
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_evento_pneus_evento ON evento_pneus(evento_id);")
            try db.execute(sql: "CREATE INDEX idx_evento_pneus_pneu ON evento_pneus(pneu_id);")
        }

        // ═══ v23_acoes_a_fazer ═════════════════════════════════
        // S8 #22 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0024_acoes_a_fazer.sql.
        // Lista pessoal e livre de ações a fazer, separada de pendências
        // canônicas. Per-evento (decisão Flávio P3 #22). Some na próxima
        // abertura ao marcar feita — implementação filtra `feita_em IS NULL`.
        m.registerMigration("v23_acoes_a_fazer") { db in
            try db.execute(sql: """
                CREATE TABLE acoes_a_fazer (
                    id          TEXT PRIMARY KEY,
                    time_id     TEXT NOT NULL,
                    evento_id   TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                    piloto_id   TEXT,
                    descricao   TEXT NOT NULL,
                    feita_em    INTEGER,
                    created_at  INTEGER NOT NULL,
                    updated_at  INTEGER NOT NULL,
                    synced_at   INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_acoes_a_fazer_evento ON acoes_a_fazer(evento_id);")
        }

        // ═══ v24_evento_setup_replicado ═══════════════════════
        // S7 #17 da rodada 1 (2026-05-12). Espelha
        // supabase/migrations/0025_evento_setup_replicado.sql.
        // Quando o piloto toca em "Replicar essa configuração" numa volta
        // passada (VoltaDetalheView), criamos uma row aqui apontando pro
        // evento futuro de destino. O EventoDetalheView do evento futuro
        // lê e mostra "Setup replicado de [evento origem]".
        //
        // overrides_json carrega o JSON da configuracoes.overrides da
        // sessão de origem — preserva snapshot mesmo se o setup do
        // carro mudar depois.
        m.registerMigration("v24_evento_setup_replicado") { db in
            try db.execute(sql: """
                CREATE TABLE evento_setup_replicado (
                    id              TEXT PRIMARY KEY,
                    time_id         TEXT NOT NULL,
                    evento_id       TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                    origem_volta_id TEXT NOT NULL,
                    origem_evento_id TEXT,
                    carro_id        TEXT,
                    overrides_json  TEXT,
                    nota            TEXT,
                    created_at      INTEGER NOT NULL,
                    updated_at      INTEGER NOT NULL,
                    synced_at       INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_evento_setup_replicado_evento ON evento_setup_replicado(evento_id);")
        }

        // ═══ v25_evento_periodo_e_dias ════════════════════════════
        // 2026-05-16 (Flávio autorizou). Espelha
        // supabase/migrations/0029_evento_periodo_e_dias.sql.
        //
        // Evento vira guarda-chuva de período:
        //   eventos.data_evento  = data início (legado, mantido)
        //   eventos.data_fim     = NOVO; backfill = data_evento (1 dia)
        //   evento_dias          = NOVA tabela; 1 row por dia do evento
        //   sessoes.evento_dia_id = NOVO vínculo direto stint ↔ dia
        //
        // Tipo do evento sobe pra evento_dias.tipo (cada dia tem o seu).
        // Coluna eventos.tipo é preservada por retro-compatibilidade
        // mas não é mais usada pelo app a partir desta migration.
        // Rotulo é NULL por default — app exibe "Dia de pista DD"
        // (número do dia do mês) quando rotulo == NULL.
        m.registerMigration("v25_evento_periodo_e_dias") { db in
            try db.execute(sql: "ALTER TABLE eventos ADD COLUMN data_fim INTEGER;")
            try db.execute(sql: "UPDATE eventos SET data_fim = data_evento WHERE data_fim IS NULL;")
            // SQLite não suporta ALTER COLUMN SET NOT NULL; manter NOT NULL via constraint
            // implícita no app (Carro.swift / Evento.swift). Sem CHECK pra preservar
            // simplicidade — Repository garante data_fim sempre preenchido.

            try db.execute(sql: """
                CREATE TABLE evento_dias (
                    id          TEXT PRIMARY KEY,
                    time_id     TEXT NOT NULL,
                    evento_id   TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                    data_dia    INTEGER NOT NULL,
                    rotulo      TEXT,
                    tipo        TEXT,
                    ordem       INTEGER NOT NULL DEFAULT 0,
                    created_at  INTEGER NOT NULL,
                    updated_at  INTEGER NOT NULL,
                    synced_at   INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_evento_dias_evento ON evento_dias(evento_id);")
            try db.execute(sql: "CREATE INDEX idx_evento_dias_time ON evento_dias(time_id);")
            try db.execute(sql: "CREATE INDEX idx_evento_dias_data ON evento_dias(data_dia);")

            try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN evento_dia_id TEXT REFERENCES evento_dias(id) ON DELETE SET NULL;")
            try db.execute(sql: "CREATE INDEX idx_sessoes_evento_dia ON sessoes(evento_dia_id);")

            // Conversão automática (P5): cada evento existente vira 1 dia.
            try db.execute(sql: """
                INSERT INTO evento_dias (id, time_id, evento_id, data_dia, rotulo, tipo, ordem, created_at, updated_at)
                SELECT
                    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
                    e.time_id,
                    e.id,
                    e.data_evento,
                    NULL,
                    e.tipo,
                    0,
                    e.created_at,
                    e.updated_at
                FROM eventos e
                WHERE NOT EXISTS (SELECT 1 FROM evento_dias d WHERE d.evento_id = e.id);
            """)

            // Linka sessões ao único dia existente (eventos antigos têm 1 dia só).
            try db.execute(sql: """
                UPDATE sessoes
                SET evento_dia_id = (SELECT d.id FROM evento_dias d WHERE d.evento_id = sessoes.evento_id LIMIT 1)
                WHERE evento_id IS NOT NULL AND evento_dia_id IS NULL;
            """)
        }

        // v26 — Função "Peças do carro" (2026-05-17). Banco único de peças
        // (decisão A); por carro (decisão D); locais cadastráveis (decisão
        // C); movimentações −1/+1 com histórico (decisão F). Áreas vivem
        // no app via PecaArea enum (decisão E); SQL guarda só TEXT pra não
        // restringir crescimento futuro.
        m.registerMigration("v26_pecas") { db in
            try db.execute(sql: """
                CREATE TABLE pecas_locais (
                    id          TEXT PRIMARY KEY,
                    time_id     TEXT NOT NULL,
                    nome        TEXT NOT NULL,
                    descricao   TEXT,
                    ordem       INTEGER NOT NULL DEFAULT 0,
                    created_at  INTEGER NOT NULL,
                    updated_at  INTEGER NOT NULL,
                    synced_at   INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_pecas_locais_time ON pecas_locais(time_id);")
            try db.execute(sql: "CREATE INDEX idx_pecas_locais_ordem ON pecas_locais(ordem);")

            try db.execute(sql: """
                CREATE TABLE pecas (
                    id              TEXT PRIMARY KEY,
                    time_id         TEXT NOT NULL,
                    carro_id        TEXT NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
                    nome            TEXT NOT NULL,
                    codigo          TEXT,
                    area            TEXT NOT NULL,
                    tipo            TEXT NOT NULL DEFAULT 'componente',
                    especificacao   TEXT,
                    foto_url        TEXT,
                    quantidade      INTEGER NOT NULL DEFAULT 0,
                    local_id        TEXT REFERENCES pecas_locais(id) ON DELETE SET NULL,
                    observacoes     TEXT,
                    created_at      INTEGER NOT NULL,
                    updated_at      INTEGER NOT NULL,
                    synced_at       INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_pecas_carro ON pecas(carro_id);")
            try db.execute(sql: "CREATE INDEX idx_pecas_area ON pecas(area);")
            try db.execute(sql: "CREATE INDEX idx_pecas_tipo ON pecas(tipo);")
            try db.execute(sql: "CREATE INDEX idx_pecas_local ON pecas(local_id);")
            try db.execute(sql: "CREATE INDEX idx_pecas_time ON pecas(time_id);")

            try db.execute(sql: """
                CREATE TABLE pecas_movimentacoes (
                    id              TEXT PRIMARY KEY,
                    time_id         TEXT NOT NULL,
                    peca_id         TEXT NOT NULL REFERENCES pecas(id) ON DELETE CASCADE,
                    delta           INTEGER NOT NULL,
                    observacao      TEXT,
                    ocorrido_em     INTEGER NOT NULL,
                    created_at      INTEGER NOT NULL,
                    synced_at       INTEGER
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_pecas_mov_peca ON pecas_movimentacoes(peca_id);")
            try db.execute(sql: "CREATE INDEX idx_pecas_mov_ocorrido ON pecas_movimentacoes(ocorrido_em);")
        }

        // v27 — preço unitário opcional nas peças (Flávio 2026-05-17:
        // "inclua por área a quantidade e o valor total delas"). Guarda
        // em centavos (Int) pra evitar imprecisão de ponto flutuante.
        // Resumo é calculado em runtime (sum/group by area).
        m.registerMigration("v27_pecas_preco") { db in
            try db.execute(sql: "ALTER TABLE pecas ADD COLUMN preco_unitario_cents INTEGER;")
        }

        // v28 — Configuração do carro (Flávio 2026-05-17, reformulação
        // Autódromos). Estende `configuracoes` com 9 campos novos:
        // motor (livre), pneus_medida + pneus_marca, tipo_pneu (slick/
        // chuva/rua), câmbio (livre), 3 marcadores de aero (assoalho_reto,
        // difusor, splitter) e flag `ativa` (qual está marcada como
        // "atual" pelo carro). Apelido legível usa o campo `nome` já
        // existente (ex.: "Setup chuva 1"). Várias configs por carro:
        // FK carro_id já existe. Nenhuma config é apagada automaticamente
        // — histórico vivo (decisão A3).
        //
        // Local-only nesta rodada — produção (Supabase) não foi tocada
        // ainda. Quando alinharmos com o servidor, gera migration espelho.
        m.registerMigration("v28_configuracao_setup") { db in
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN motor TEXT;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN pneus_medida TEXT;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN pneus_marca TEXT;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN tipo_pneu TEXT;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN cambio TEXT;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN aero_assoalho_reto INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN aero_difusor INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN aero_splitter INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "ALTER TABLE configuracoes ADD COLUMN ativa INTEGER NOT NULL DEFAULT 0;")
            try db.execute(sql: "CREATE INDEX idx_configuracoes_ativa ON configuracoes(carro_id, ativa);")
        }

        // v29 — Tela do autódromo (Flávio 2026-05-17). 2 campos novos
        // em `tracks`: extensao_metros (extensão da pista) e
        // numero_curvas (quantidade total de curvas). Usados na lista de
        // autódromos pra mostrar km × voltas e contar trechos. SeedBrasilia
        // preenche com 5476 m / 8 curvas.
        m.registerMigration("v29_tracks_extensao_curvas") { db in
            try db.execute(sql: "ALTER TABLE tracks ADD COLUMN extensao_metros INTEGER;")
            try db.execute(sql: "ALTER TABLE tracks ADD COLUMN numero_curvas INTEGER;")
            try db.execute(sql: """
                UPDATE tracks
                SET extensao_metros = 5476,
                    numero_curvas = 8
                WHERE id = 'e8335412-3312-54fe-b634-db2d02c7fa81'
                  AND extensao_metros IS NULL;
            """)
        }

        // v30 — Pontos geográficos por trecho (entrada/saída/ápice).
        // Só pra curvas (decisão B2). Até 2 ápices por curva (decisão B3).
        // Posições guardadas em coordenadas SVG (x,y) compatíveis com o
        // path oficial da pista. Cada trecho pode ter NULL nas faixas
        // (cadastro incremental). Estrutura preparada pra editor visual
        // futuro — escrita inicial vem do código (SeedBrasilia).
        m.registerMigration("v30_track_segment_faixas") { db in
            try db.execute(sql: """
                CREATE TABLE track_segment_faixas (
                    id            TEXT PRIMARY KEY,
                    segment_id    TEXT NOT NULL REFERENCES track_segments(id) ON DELETE CASCADE,
                    tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','saida','apice')),
                    indice        INTEGER NOT NULL DEFAULT 0,
                    x             REAL NOT NULL,
                    y             REAL NOT NULL,
                    created_at    INTEGER NOT NULL,
                    updated_at    INTEGER NOT NULL,
                    synced_at     INTEGER,
                    UNIQUE (segment_id, tipo, indice)
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_segfaixas_segment ON track_segment_faixas(segment_id);")
            try db.execute(sql: "CREATE INDEX idx_segfaixas_tipo ON track_segment_faixas(segment_id, tipo);")
        }

        // v31 — Pontos dinâmicos por trecho (V-min/frenagem/PAce) calcu-
        // lados da melhor passagem por carro+configuração (decisão E1).
        // Mínimo 3 voltas pra ativar cálculo (decisão E2). Tabela
        // append-only por (carro, configuração, segmento): cada melhor
        // passagem é uma row, atualizada quando vem passagem melhor.
        m.registerMigration("v31_segment_pontos_dinamicos") { db in
            try db.execute(sql: """
                CREATE TABLE segment_pontos_dinamicos (
                    id                TEXT PRIMARY KEY,
                    time_id           TEXT NOT NULL,
                    segment_id        TEXT NOT NULL REFERENCES track_segments(id) ON DELETE CASCADE,
                    carro_id          TEXT NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
                    configuracao_id   TEXT NOT NULL REFERENCES configuracoes(id) ON DELETE CASCADE,
                    tempo_ms          INTEGER NOT NULL,
                    vmin_kmh          REAL,
                    vmin_x            REAL,
                    vmin_y            REAL,
                    frenagem_x        REAL,
                    frenagem_y        REAL,
                    pace_x            REAL,
                    pace_y            REAL,
                    voltas_consideradas INTEGER NOT NULL DEFAULT 0,
                    fonte_volta_id    TEXT,
                    created_at        INTEGER NOT NULL,
                    updated_at        INTEGER NOT NULL,
                    UNIQUE (segment_id, carro_id, configuracao_id)
                );
            """)
            try db.execute(sql: "CREATE INDEX idx_segpd_seg ON segment_pontos_dinamicos(segment_id);")
            try db.execute(sql: "CREATE INDEX idx_segpd_carro_cfg ON segment_pontos_dinamicos(carro_id, configuracao_id);")
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
