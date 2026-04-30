// ═══════════════════════════════════════════════════════════
// iPhoneStorage — persistência local-first dos samples do cockpit
// ═══════════════════════════════════════════════════════════
// Etapa 2 do PLANO_PERNA1_IPHONE.md (2026-04-26).
//
// Princípio:
//   • Sample chega → grava no IndexedDB ANTES de qualquer upload
//   • Upload é best-effort, separado (iphone-uploader.js, Etapa 3)
//   • Sessão de 1h ≈ 15 MB (1 Hz GPS × 100 B + 50 Hz IMU × 80 B)
//   • Quota Safari iOS típica ~50 MB; sob pressão vai a 1 GB
//   • Sem compactação local — gzip só no upload
//
// Modelo:
//   Session   = 1 stint (criada no botão ENTRAR; fechada no STOP)
//   Chunk     = bloco temporal de 10 s (fecha automático; facilita
//               upload por bloco e replay/skip por janela)
//   Sample    = registro individual GPS ou IMU
//
// Schema (Dexie v10 adiciona index `uploadedAt`):
//   sessions       'id, startedAt, endedAt'
//   telemetrySamples '++id, sessionId, seq, [sessionId+seq], t, uploadedAt'
//   telemetryChunks 'id, sessionId, firstT, lastT, count, closedAt, uploadedAt'

import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

const CHUNK_INTERVAL_MS = 10_000;  // fecha chunk a cada 10s
const FLUSH_DEBOUNCE_MS = 500;     // batch put a cada 500ms (não sobrecarrega DB)

function uid(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export class IPhoneStorage {
  constructor() {
    this.session = null;          // { id, startedAt, endedAt }
    this.currentChunk = null;     // { id, sessionId, firstT, lastT, count, openedAt }
    this._pendingBuffer = [];     // samples pendentes de flush
    this._flushTimer = null;
    this._chunkTimer = null;
    this._seq = 0;
    // Buffer pré-sessão (auditoria 2026-04-28 #C1): primeiros samples GPS/IMU
    // chegam ANTES do startSession resolver (Promise.allSettled em parallel).
    // Antes eram descartados silenciosamente. Agora ficam aqui (cap 200) e
    // são drenados ao abrir a sessão — mantém os primeiros segundos do stint.
    this._preSessionBuffer = [];
    this._stats = {
      ingested: 0,
      flushed: 0,
      droppedOnError: 0,
      preSessionBuffered: 0,
      preSessionDropped: 0,
      replayedFromPreSession: 0,
      emptyChunks: 0,
    };
  }

  /** Cria nova sessão. Chamado no botão ENTRAR. */
  async startSession({ note = null } = {}) {
    if (this.session) {
      logger.warn('[iphone-storage] já tem sessão aberta', { id: this.session.id });
      return this.session;
    }
    const session = {
      id: uid('isession'),
      startedAt: Date.now(),
      endedAt: null,
      note,
    };
    try {
      await db.iphoneSessions.put(session);
    } catch (err) {
      logger.error('[iphone-storage] falha criar sessão', { err: String(err) });
      throw err;
    }
    this.session = session;
    this._seq = 0;
    this._openChunk();
    // Drena pre-session buffer pra dentro da sessão recém-aberta.
    if (this._preSessionBuffer.length > 0) {
      const replay = this._preSessionBuffer.splice(0);
      this._stats.replayedFromPreSession += replay.length;
      logger.info('[iphone-storage] replay pre-sessão', { count: replay.length });
      for (const s of replay) this.ingest(s);
    }
    logger.info('[iphone-storage] sessão aberta', { id: session.id });
    return session;
  }

  /** Fecha sessão. Flush imediato dos pendentes. */
  async stopSession() {
    if (!this.session) return null;
    await this._flush();
    await this._closeCurrentChunk();
    this.session.endedAt = Date.now();
    try {
      await db.iphoneSessions.put(this.session);
    } catch (err) {
      logger.error('[iphone-storage] falha fechar sessão', { err: String(err) });
    }
    const closed = this.session;
    this.session = null;
    if (this._chunkTimer) { clearInterval(this._chunkTimer); this._chunkTimer = null; }
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    logger.info('[iphone-storage] sessão fechada', { id: closed.id, ingested: this._stats.ingested });
    return closed;
  }

  /** Persiste um sample. Caller passa o sample canônico do MobileTelemetry. */
  ingest(sample) {
    if (!sample || typeof sample.tMono !== 'number') {
      this._stats.droppedOnError++;
      return;
    }
    if (!this.session) {
      // Pré-sessão: primeiros samples chegam antes do startSession resolver.
      // Mantém últimos 200 (cap evita unbounded growth se sessão nunca abre).
      this._preSessionBuffer.push(sample);
      this._stats.preSessionBuffered++;
      if (this._preSessionBuffer.length > 200) {
        this._preSessionBuffer.shift();
        this._stats.preSessionDropped++;
      }
      return;
    }
    const enriched = {
      ...sample,
      sessionId: this.session.id,
      seq: this._seq++,
      uploadedAt: null,
      chunkId: this.currentChunk?.id || null,
    };
    this._pendingBuffer.push(enriched);
    this._stats.ingested++;
    if (this.currentChunk) {
      if (this.currentChunk.firstT == null || sample.t < this.currentChunk.firstT) {
        this.currentChunk.firstT = sample.t;
      }
      if (this.currentChunk.lastT == null || sample.t > this.currentChunk.lastT) {
        this.currentChunk.lastT = sample.t;
      }
      this.currentChunk.count++;
    }
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  async _flush() {
    if (this._pendingBuffer.length === 0) return;
    const batch = this._pendingBuffer.splice(0);
    try {
      await db.telemetrySamples.bulkPut(batch);
      this._stats.flushed += batch.length;
    } catch (err) {
      // Falha = recoloca no buffer (será re-tentado)
      this._pendingBuffer.unshift(...batch);
      logger.error('[iphone-storage] flush falhou', { count: batch.length, err: String(err) });
    }
  }

  _openChunk() {
    const now = Date.now();
    this.currentChunk = {
      id: uid('chunk'),
      sessionId: this.session.id,
      firstT: null,
      lastT: null,
      count: 0,
      openedAt: now,
      closedAt: null,
      uploadedAt: null,
    };
    if (this._chunkTimer) clearInterval(this._chunkTimer);
    this._chunkTimer = setInterval(() => this._rotateChunk(), CHUNK_INTERVAL_MS);
  }

  async _closeCurrentChunk() {
    if (!this.currentChunk) return;
    this.currentChunk.closedAt = Date.now();
    if (this.currentChunk.count === 0) {
      // Chunk vazio — auditoria 2026-04-28 #C1: persistir com flag isEmpty=true
      // pra uploader saber que existe lacuna intencional (não confundir com
      // chunk perdido). Mantém integridade da timeline.
      this.currentChunk.isEmpty = true;
      this._stats.emptyChunks++;
      try {
        await db.telemetryChunks.put(this.currentChunk);
      } catch (err) {
        logger.error('[iphone-storage] falha persistir chunk vazio', { err: String(err) });
      }
      const closedEmpty = this.currentChunk;
      this.currentChunk = null;
      return closedEmpty;
    }
    try {
      await db.telemetryChunks.put(this.currentChunk);
    } catch (err) {
      logger.error('[iphone-storage] falha persistir chunk', { err: String(err) });
    }
    const closed = this.currentChunk;
    this.currentChunk = null;
    return closed;
  }

  async _rotateChunk() {
    await this._flush();
    await this._closeCurrentChunk();
    if (this.session) this._openChunk();
  }

  /** Stats em runtime — útil pro chip de status / debug. */
  stats() {
    return {
      ...this._stats,
      sessionId: this.session?.id || null,
      currentChunkId: this.currentChunk?.id || null,
      currentChunkCount: this.currentChunk?.count || 0,
      pendingBufferLen: this._pendingBuffer.length,
    };
  }

  // ─── Queries pra uploader (Etapa 3) ────────────────────────

  async getPendingChunks(limit = 5) {
    return db.telemetryChunks
      .where('uploadedAt').equals(null)
      .filter(c => c.closedAt != null)
      .limit(limit)
      .toArray();
  }

  async getSamplesByChunk(chunkId) {
    return db.telemetrySamples.where('chunkId').equals(chunkId).toArray();
  }

  async markChunkUploaded(chunkId) {
    await db.telemetryChunks.update(chunkId, { uploadedAt: Date.now() });
    // Marca samples como uploaded também (paralelo — pode ser otimizado depois
    // se virar gargalo; a query do uploader ignora chunks já marcados)
    const samples = await db.telemetrySamples.where('chunkId').equals(chunkId).toArray();
    if (samples.length) {
      const ids = samples.map(s => s.id);
      await db.telemetrySamples.bulkUpdate(ids.map(id => ({ key: id, changes: { uploadedAt: Date.now() } })));
    }
  }

  async listSessions() {
    return db.iphoneSessions.orderBy('startedAt').reverse().toArray();
  }
}

/** Singleton padrão. */
export const iphoneStorage = new IPhoneStorage();
