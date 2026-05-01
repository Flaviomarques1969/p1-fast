// ═══════════════════════════════════════════════════════════
// db — IndexedDB via Dexie (source of truth local)
// ═══════════════════════════════════════════════════════════
// Schema versionado. Cada bump de versão = migração explícita.
// Dexie deve estar carregado ANTES (script tag no index.html).

import { logger } from './logger.js';

if (typeof Dexie === 'undefined') {
  throw new Error('[db] Dexie não carregou. Verifica que vendor/dexie.min.js está incluído antes dos módulos.');
}

export const DB_NAME = 'famracing';
export const DB_VERSION = 12;

const db = new Dexie(DB_NAME);

// ─── Schema v1 ────────────────────────────────────────────
db.version(1).stores({
  users:              'id, email, criadoEm',
  cars:               'id, userId, nome, criadoEm',
  carConfigurations:  'id, carId, dataAplicacao, criadoEm',
  tracks:             'id, apelido, criadoEm',
  sessions:           'id, userId, carId, trackId, status, dataInicio, criadoEm',
  laps:               'id, sessionId, numero, valida',
  syncQueue:          '++id, status, timestamp, entidade, entidadeId',
  logs:               '++id, ts, level',
  meta:               'key',
});

// ─── Schema v2 — pista em 2 camadas ───────────────────────
db.version(2).stores({
  trackLayouts:       'id, trackId, criadoEm',
  trackSegments:      'id, layoutId, setorId, ordem',
});

// ─── Schema v3 — telemetria append-only ───────────────────
db.version(3).stores({
  telemetrySamples:   '++id, sessionId, seq, [sessionId+seq], t',
});

// ─── Schema v4 — dispositivo mestre ───────────────────────
db.version(4).stores({
  devices:            'id, criadoEm',
  deviceHandovers:    '++id, sessionId, toDeviceId, timestamp',
});

// ─── Schema v5 — detector volta/parcial/trecho ────────────
db.version(5).stores({
  laps:               'id, sessionId, numero, valida, inicioAt',
  segmentExecutions:  '++id, sessionId, lapId, segmentId, [sessionId+lapId]',
});

// ─── Schema v6 — validade de volta ────────────────────────
db.version(6).stores({
  lapValidityEvents:  '++id, lapId, tipo, timestamp',
});

// ─── Schema v7 — plano pedagógico do stint ────────────────
db.version(7).stores({
  pedagogicalPlans:   'id, sessionId, criadoEm',
});

// ─── Schema v8 — índices uid ──────────────────────────────
// Dexie 4 não permite trocar PK auto (++id) por PK inbound (id) diretamente via upgrade.
// Pragmaticamente: domínio gera `uid(prefix)` antes de `.add()`, salva como campo `uid`;
// syncQueue usa `entidadeId = uid`; ++id permanece como PK interno.
db.version(8).stores({
  lapValidityEvents:  '++id, uid, lapId, tipo, timestamp',
  segmentExecutions:  '++id, uid, sessionId, lapId, segmentId, [sessionId+lapId]',
  deviceHandovers:    '++id, uid, sessionId, toDeviceId, timestamp',
});

// ─── Schema v9 — hierarquia Pista → Parcial → Trecho ──────
// Setor macro (S1/S2/S3 hardcoded) sai do modelo. Entra:
//   • parciais[] no TrackLayout (N por pista, ex: Brasília=4)
//   • parcialId + ehTrecho (true p/ curva, false p/ reta) em TrackSegment
//   • stintPlans como store nova (plano estruturado antes de sair pra pista)
//   • stintEnvironment (pneu/clima/pirômetro por stint)
//   • advisorSuggestions (saída da IA Setup Advisor)
db.version(9).stores({
  trackSegments:      'id, layoutId, parcialId, ehTrecho, ordem',
  stintPlans:         'id, sessionId, criadoEm',
  stintEnvironment:   'id, sessionId, criadoEm',
  advisorSuggestions: 'id, sessionId, lapCountAtRun, criadoEm',
});

// ─── Schema v10 — iPhone storage (Etapa 2 PLANO_PERNA1_IPHONE) ─
// telemetrySamples ganha index uploadedAt + chunkId pra uploader
// (Etapa 3) consultar pendentes em batch eficiente.
// telemetryChunks: blocos de ~10s pra upload incremental.
// iphoneSessions: 1 sessão = 1 stint capturado pelo MobileTelemetry.
db.version(10).stores({
  telemetrySamples:   '++id, sessionId, seq, [sessionId+seq], t, uploadedAt, chunkId',
  telemetryChunks:    'id, sessionId, firstT, lastT, closedAt, uploadedAt',
  iphoneSessions:     'id, startedAt, endedAt',
});

// ─── Schema v11 — Smart Shift Light: eventos de troca ─────
// Eventos de troca de marcha persistidos por sessão. Cada evento tem 25
// campos da spec + dedup_key (único) pra idempotência da escrita.
db.version(11).stores({
  shift_events: '++id, &dedup_key, sessao_id, [sessao_id+timestamp], piloto_id, carro_id, trecho_id, timestamp',
});

// ─── Abertura + handshake ────────────────────────────────
db.open()
  .then(() => {
    logger.info('[db] aberto', { name: DB_NAME, version: DB_VERSION });
  })
  .catch(err => {
    logger.error('[db] falha ao abrir', { err: String(err) });
  });

// Hook de populate na primeira execução (cria registro de schema)
db.on('populate', async () => {
  logger.info('[db] populando v1 (primeira execução)');
  await db.meta.bulkAdd([
    { key: 'schemaVersion', value: DB_VERSION },
    { key: 'createdAt', value: Date.now() },
  ]);
});

export { db };
