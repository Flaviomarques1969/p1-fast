// ═══════════════════════════════════════════════════════════
// SessionRecorder — provider/timebase → detector → persistência
// ═══════════════════════════════════════════════════════════
// Fecha o elo Detector → Laps + segmentExecutions.
//
// Dois modos de operação:
//
//   mode='sample'   (default — preserva pipeline single-source)
//     provider.onSample → detector.consume(sample)
//
//   mode='snapshot' (Flavio 2026-04-29, achado #4 da auditoria 2026-04-28)
//     adaptive-tick(timebase) → detector.consumeSnapshot(snap)
//     +opcional: extraConsumers[i](snap) — ex: crossValidationEngine.consume
//     Multi-source fundido (iPhone GPS+IMU hoje; RaceBox+T4000 quando entrarem).
//
// Nos dois modos:
//   detector.onLap        → Laps.create({ ...lap, sessionId })
//   detector.onSegmentEnd → db.segmentExecutions.add({ ...exec, sessionId })

import { Laps } from '../domain/lap.js';
import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { createAdaptiveTick } from './adaptive-tick.js';

export class SessionRecorder {
  /**
   * @param {object} cfg
   * @param {string} cfg.sessionId          obrigatório
   * @param {object} cfg.detector           instância de Detector
   * @param {'sample'|'snapshot'} [cfg.mode='sample']
   *
   * Mode='sample' requer:
   *   @param {object} cfg.provider         fonte com .onSample(cb) → unsub
   *
   * Mode='snapshot' requer:
   *   @param {object} cfg.timebase         TelemetryTimebase
   *   @param {Array<Function>} [cfg.extraConsumers=[]]   funções (snap) → void
   *   @param {object} [cfg.tickOpts={}]    opts pra createAdaptiveTick
   *   @param {object} [cfg.tickFactory]    injeção pra teste (default: createAdaptiveTick)
   *
   * Em ambos:
   *   @param {object} [cfg.lapRepo=Laps]
   */
  constructor(cfg = {}) {
    if (!cfg.sessionId) throw new Error('[SessionRecorder] sessionId obrigatório');
    if (!cfg.detector) throw new Error('[SessionRecorder] detector obrigatório');
    const mode = cfg.mode || 'sample';
    if (mode !== 'sample' && mode !== 'snapshot') {
      throw new Error(`[SessionRecorder] mode inválido: ${mode}`);
    }
    if (mode === 'sample' && !cfg.provider) {
      throw new Error('[SessionRecorder] provider obrigatório no mode=sample');
    }
    if (mode === 'snapshot' && !cfg.timebase) {
      throw new Error('[SessionRecorder] timebase obrigatório no mode=snapshot');
    }

    this.mode = mode;
    this.sessionId = cfg.sessionId;
    this.detector = cfg.detector;
    this.provider = cfg.provider || null;
    this.timebase = cfg.timebase || null;
    this.extraConsumers = Array.isArray(cfg.extraConsumers) ? cfg.extraConsumers.slice() : [];
    this.tickOpts = cfg.tickOpts || {};
    this._tickFactory = cfg.tickFactory || createAdaptiveTick;
    this.lapRepo = cfg.lapRepo || Laps;

    this._unsubSample = null;
    this._tickController = null;
    this._unsubTick = null;
    this._state = 'idle';
    this._stats = { samples: 0, snapshots: 0, laps: 0, segments: 0, dropped: 0 };
  }

  /** Liga o pipeline. No mode=sample, provider precisa já ter sido started. */
  start() {
    if (this._state === 'running') return { ok: false, razao: 'already-running' };

    // Detector callbacks são iguais nos dois modos
    this.detector.onLap(async (lap) => {
      this._stats.laps++;
      try {
        const saved = await this.lapRepo.create({
          ...lap,
          sessionId: this.sessionId,
          valida: true,
        });
        logger.debug('[recorder] lap gravada', { lapId: saved.id, numero: lap.numero });
      } catch (err) {
        logger.error('[recorder] Laps.create falhou', { err: String(err), lap });
      }
    });

    this.detector.onSegmentEnd(async (exec) => {
      this._stats.segments++;
      try {
        const row = { uid: uid('sex'), ...exec, sessionId: this.sessionId, criadoEm: Date.now() };
        await db.segmentExecutions.add(row);
      } catch (err) {
        logger.error('[recorder] segmentExecutions.add falhou', { err: String(err) });
      }
    });

    if (this.mode === 'sample') {
      this._unsubSample = this.provider.onSample((sample) => {
        this._stats.samples++;
        try {
          this.detector.consume(sample);
        } catch (err) {
          this._stats.dropped++;
          logger.error('[recorder] detector.consume falhou', { err: String(err) });
        }
      });
    } else {
      // mode = snapshot
      this._tickController = this._tickFactory(this.timebase, this.tickOpts);
      this._unsubTick = this._tickController.onTick((snap) => {
        this._stats.snapshots++;
        try {
          this.detector.consumeSnapshot(snap);
          for (const consumer of this.extraConsumers) {
            try { consumer(snap); }
            catch (err) { logger.error('[recorder] extraConsumer falhou', { err: String(err) }); }
          }
        } catch (err) {
          this._stats.dropped++;
          logger.error('[recorder] consumeSnapshot falhou', { err: String(err) });
        }
      });
      this._tickController.start();
    }

    this._state = 'running';
    logger.info('[recorder] iniciado', { mode: this.mode, sessionId: this.sessionId });
    return { ok: true };
  }

  /** Desliga listeners. Não para provider/timebase. */
  stop() {
    if (this._unsubSample) { this._unsubSample(); this._unsubSample = null; }
    if (this._unsubTick)   { this._unsubTick();   this._unsubTick = null; }
    if (this._tickController) { this._tickController.stop(); this._tickController = null; }
    this._state = 'stopped';
    logger.info('[recorder] parado', { stats: this._stats });
    return { ok: true, stats: { ...this._stats } };
  }

  stats() {
    return {
      state: this._state,
      mode: this.mode,
      sessionId: this.sessionId,
      currentTickRate: this._tickController?.currentRate?.() ?? null,
      ...this._stats,
    };
  }
}
