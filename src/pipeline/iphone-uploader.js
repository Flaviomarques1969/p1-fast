// ═══════════════════════════════════════════════════════════
// iPhoneUploader — envia chunks pendentes pro /api/ingest/iphone
// ═══════════════════════════════════════════════════════════
// Etapa 3 do PLANO_PERNA1_IPHONE.md (2026-04-26).
//
// Princípio:
//   • Roda em background com setInterval — independente da captura
//   • Best-effort: rede ruim NÃO derruba captura (que continua local)
//   • Idempotência por { sessionId, chunkId } — retry seguro
//   • Backoff exponencial: 30s → 60s → 120s → 300s (cap)
//   • Pausa em background (visibilitychange) pra economizar bateria
//
// Comportamento:
//   start()  → começa loop
//   stop()   → para loop e flush final
//   onStatus → callback opcional pra UI mostrar (Hz upload, queue size)

import { iphoneStorage } from './iphone-storage.js';
import { logger } from '../core/logger.js';

const ENDPOINT = '/api/ingest/iphone';
const BASE_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 300_000;

export class IPhoneUploader {
  constructor({ onStatus = null, deviceId = null } = {}) {
    this.onStatus = onStatus;
    this.deviceId = deviceId;
    this._running = false;
    this._timer = null;
    this._currentInterval = BASE_INTERVAL_MS;
    this._consecutiveFailures = 0;
    this._lastUploadAt = null;
    this._uploaded = { chunks: 0, samples: 0, bytesEstimated: 0 };
    this._failed = { chunks: 0, samples: 0 };
    this._visibilityHandler = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._scheduleNext(BASE_INTERVAL_MS);
    this._visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this._running) {
        // Volta foreground → tenta upload imediato (catch-up)
        this._scheduleNext(1000);
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
    logger.info('[iphone-uploader] start');
  }

  async stop() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    // Tenta flush final
    try { await this._tick(); } catch {}
    logger.info('[iphone-uploader] stop', { uploaded: this._uploaded });
  }

  status() {
    return {
      running: this._running,
      currentInterval: this._currentInterval,
      consecutiveFailures: this._consecutiveFailures,
      lastUploadAt: this._lastUploadAt,
      uploaded: { ...this._uploaded },
      failed: { ...this._failed },
    };
  }

  _scheduleNext(delay) {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._tick(), delay);
  }

  async _tick() {
    if (!this._running) return;
    if (document.visibilityState === 'hidden') {
      // Pausa em background — re-tenta quando voltar
      this._scheduleNext(this._currentInterval);
      return;
    }
    try {
      const chunks = await iphoneStorage.getPendingChunks(3);
      if (chunks.length === 0) {
        this._consecutiveFailures = 0;
        this._currentInterval = BASE_INTERVAL_MS;
        this._scheduleNext(this._currentInterval);
        return;
      }
      for (const chunk of chunks) {
        // Chunk persistido com flag `isEmpty=true` (iphone-storage.js
        // _closeCurrentChunk) representa lacuna intencional na timeline.
        // Atalho: marca uploaded sem disparar rede nem query de samples.
        // (Auditoria 2026-04-28 #C1: cobertura explícita da flag.)
        if (chunk.isEmpty || chunk.count === 0) {
          await iphoneStorage.markChunkUploaded(chunk.id);
          logger.debug('[iphone-uploader] chunk vazio skipped', { id: chunk.id, isEmpty: !!chunk.isEmpty });
          continue;
        }
        const samples = await iphoneStorage.getSamplesByChunk(chunk.id);
        if (samples.length === 0) {
          // Defesa: chunk não-empty mas sem samples (corrupção / race) —
          // marca uploaded pra liberar a fila e loga warn pro debug.
          logger.warn('[iphone-uploader] chunk sem samples mas não isEmpty', { id: chunk.id, count: chunk.count });
          await iphoneStorage.markChunkUploaded(chunk.id);
          continue;
        }
        const ok = await this._uploadChunk(chunk, samples);
        if (!ok) {
          this._consecutiveFailures++;
          this._currentInterval = Math.min(this._currentInterval * 2, MAX_INTERVAL_MS);
          this._failed.chunks++;
          this._failed.samples += samples.length;
          break; // sai do loop, retry no próximo tick
        }
        await iphoneStorage.markChunkUploaded(chunk.id);
        this._uploaded.chunks++;
        this._uploaded.samples += samples.length;
        this._uploaded.bytesEstimated += JSON.stringify(samples).length;
        this._lastUploadAt = Date.now();
        this._consecutiveFailures = 0;
        this._currentInterval = BASE_INTERVAL_MS;
      }
    } catch (err) {
      logger.error('[iphone-uploader] tick erro', { err: String(err) });
    } finally {
      if (this.onStatus) {
        try { this.onStatus(this.status()); } catch {}
      }
      if (this._running) this._scheduleNext(this._currentInterval);
    }
  }

  async _uploadChunk(chunk, samples) {
    const body = {
      deviceId: this.deviceId,
      sessionId: chunk.sessionId,
      chunkId: chunk.id,
      samples,
    };
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        logger.warn('[iphone-uploader] resposta não-OK', { status: r.status, body: text.slice(0, 200) });
        return false;
      }
      return true;
    } catch (err) {
      // Rede caiu — não loga erro grave (esperado em pista)
      logger.debug('[iphone-uploader] rede falhou', { err: String(err) });
      return false;
    }
  }
}

export const iphoneUploader = new IPhoneUploader();
