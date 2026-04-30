// ═══════════════════════════════════════════════════════════
// Detector — volta + parcial + segmento
// ═══════════════════════════════════════════════════════════
// Entrada: stream de samples com { x, y, t, speed } (já em coords do viewBox)
// Saída:
//   - onLap(lap)       quando cruza linha de chegada. Lap.temposPorParcial
//     traz um mapa { [parcialId]: ms } com a duração de cada parcial pela qual
//     o carro passou na volta.
//   - onSegmentEnd(se) quando sai de um trackSegment (curva).
//
// A transição de parcial é detectada observando `segment.parcialId`: assim que
// o carro entra num segmento de parcial diferente do atual, fecha o tempo da
// parcial anterior e inicia a nova.

import { buildLookup, snap, segmentsIntersect } from './path-mapper.js';
import { logger } from '../core/logger.js';

/**
 * @typedef {Object} SegmentExecution
 * @property {string} uid                T-007: uid('sex')
 * @property {string} sessionId
 * @property {number} lapId
 * @property {string} segmentId
 * @property {number} entradaAt
 * @property {number} saidaAt
 * @property {number} tempoMs
 * @property {number|null} velEntrada    m/s
 * @property {number|null} velMinima     m/s (no ápice)
 * @property {number|null} velSaida      m/s
 * @property {number|null} apexT         timestamp do ponto de menor velocidade (apex real)
 * @property {number|null} apexOffset    offset no path consolidado onde o apex aconteceu
 * @property {{x:number,y:number}|null} apexActual  coordenada do apex real {x, y} no viewBox
 * @property {number} criadoEm
 *
 * APEX (gate 2026-04-24, docs/raceops/APEX_ANALYSIS_RULES.md):
 *   apex_actual = ponto onde velMinima foi atingida durante o segment.
 *   Comparar com track-segment.apexReference para classificar
 *   (apex correto / antecipado / tardio / perdido por fora / interno demais).
 */

export class Detector {
  /**
   * @param {object} cfg
   * @param {string} cfg.svgPath      - string d= do path da pista
   * @param {object} cfg.linhaChegada - { x1, y1, x2, y2 }
   * @param {Array}  cfg.segments     - trackSegments da layout (ordenados)
   * @param {number} cfg.snapMaxDist  - se snap > isso, amostra descartada
   */
  constructor({ svgPath, linhaChegada, segments = [], snapMaxDist = 80 }) {
    this.lookup = buildLookup(svgPath, 2000);
    this.linhaChegada = linhaChegada;
    this.segments = segments;
    this.snapMaxDist = snapMaxDist;

    this.listeners = { lap: new Set(), segmentStart: new Set(), segmentEnd: new Set() };
    this.lapCount = 0;
    this.voltaAtual = null;
    this.ultimoPonto = null;
    this.segmentoAtual = null;
    this.parcialTimestamps = {};   // { [parcialId]: tMono } — quando entrou na parcial
    this.currentParcial = null;
  }

  onLap(cb)          { this.listeners.lap.add(cb);          return () => this.listeners.lap.delete(cb); }
  onSegmentStart(cb) { this.listeners.segmentStart.add(cb); return () => this.listeners.segmentStart.delete(cb); }
  onSegmentEnd(cb)   { this.listeners.segmentEnd.add(cb);   return () => this.listeners.segmentEnd.delete(cb); }
  _emit(ev, payload) {
    for (const cb of this.listeners[ev]) {
      try { cb(payload); } catch (err) { logger.error('[detector] listener falhou', { ev, err: String(err) }); }
    }
  }

  /**
   * Etapa 5 do PLANO_PERNA1_IPHONE.md (2026-04-26): Detector aceita
   * `CarTelemetrySnapshot` extraindo campos canônicos. Mantém compat
   * com `consume(sample)` legacy — caller escolhe shape.
   */
  consumeSnapshot(snap) {
    if (!snap || !snap.position) return;
    return this.consume({
      x:     snap.position.local_x,
      y:     snap.position.local_y,
      t:     snap.t,
      tMono: snap.tMono,
      speed: snap.vehicle?.speed_fused ?? snap.vehicle?.speed_gnss ?? null,
    });
  }

  consume(sample) {
    if (sample.x == null || sample.y == null) return;
    const snapped = snap(this.lookup, sample.x, sample.y);
    if (snapped.dist > this.snapMaxDist) return;

    const point = {
      x: sample.x, y: sample.y,
      t: sample.t, tMono: sample.tMono,
      speed: sample.speed,
      offset: snapped.offset,
    };

    if (this.ultimoPonto && this.linhaChegada) {
      const { x1, y1, x2, y2 } = this.linhaChegada;
      const cruzou = segmentsIntersect(
        { x: this.ultimoPonto.x, y: this.ultimoPonto.y },
        { x: point.x, y: point.y },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      );
      if (cruzou) this._onLineCross(point);
    }

    this._updateSegment(point);

    this.ultimoPonto = point;
  }

  _onLineCross(point) {
    const tRef = point.tMono ?? point.t;
    this.lapCount++;
    if (this.voltaAtual) {
      // Fecha parcial corrente antes de emitir a volta
      if (this.currentParcial && this.parcialTimestamps[this.currentParcial] != null) {
        const dur = tRef - this.parcialTimestamps[this.currentParcial];
        this.voltaAtual.temposPorParcial[this.currentParcial] = dur;
      }
      const lap = {
        numero: this.voltaAtual.numero,
        inicioAt: this.voltaAtual.inicioAt,
        fimAt: point.t,
        tempoMs: tRef - this.voltaAtual.inicioAtMono,
        temposPorParcial: { ...this.voltaAtual.temposPorParcial },
        temposPorTrecho:  { ...this.voltaAtual.temposPorTrecho },
      };
      this._emit('lap', lap);
    }
    this.voltaAtual = {
      numero: this.lapCount,
      inicioAt: point.t,
      inicioAtMono: tRef,
      temposPorParcial: {},
      temposPorTrecho:  {},
    };
    this.parcialTimestamps = {};
    this.currentParcial = null;
  }

  _onParcialChange(parcialNova, tRef) {
    if (this.currentParcial && this.parcialTimestamps[this.currentParcial] != null && this.voltaAtual) {
      const dur = tRef - this.parcialTimestamps[this.currentParcial];
      this.voltaAtual.temposPorParcial[this.currentParcial] = dur;
    }
    this.parcialTimestamps[parcialNova] = tRef;
    this.currentParcial = parcialNova;
  }

  _updateSegment(point) {
    if (this.segments.length === 0) return;
    const pctOffset = (point.offset / this.lookup.totalLength) * 100;
    const found = this.segments.find(s =>
      s.pathStart != null && s.pathEnd != null &&
      pctOffset >= s.pathStart && pctOffset < s.pathEnd
    );

    // Transição de parcial via parcialId do segmento
    if (found && found.parcialId && found.parcialId !== this.currentParcial) {
      const tRef = point.tMono ?? point.t;
      this._onParcialChange(found.parcialId, tRef);
    }

    // Helper local — fecha e emite o segmentoAtual com payload canônico.
    const fecharSegmentoAtual = (saidaPoint) => {
      const se = {
        segmentId: this.segmentoAtual.segmentId,
        lapNumero: this.voltaAtual?.numero,
        entradaAt: this.segmentoAtual.entradaAt,
        saidaAt: saidaPoint.t,
        tempoMs: saidaPoint.t - this.segmentoAtual.entradaAt,
        velEntrada: this.segmentoAtual.velEntrada,
        velMinima: this.segmentoAtual.velMinima,
        velSaida: this.ultimoPonto?.speed ?? null,
        pontoFrenagem: this.segmentoAtual.pontoFrenagem,
        // Apex real: ponto onde a menor velocidade foi atingida durante o segment.
        // Diretor Técnico (docs/raceops/APEX_ANALYSIS_RULES.md) — ligar com
        // track-segment.apexReference para classificar.
        apexT: this.segmentoAtual.apexT,
        apexOffset: this.segmentoAtual.apexOffset,
        apexActual: this.segmentoAtual.apexActual,
      };
      if (this.voltaAtual) {
        this.voltaAtual.temposPorTrecho[this.segmentoAtual.segmentId] = se.tempoMs;
      }
      this._emit('segmentEnd', se);
    };

    if (found && (!this.segmentoAtual || this.segmentoAtual.segmentId !== found.id)) {
      if (this.segmentoAtual) fecharSegmentoAtual(point);
      this.segmentoAtual = {
        segmentId: found.id,
        entradaAt: point.t,
        velEntrada: point.speed,
        velMinima: point.speed,
        pontoFrenagem: null,
        apexT: point.t,
        apexOffset: point.offset,
        apexActual: { x: point.x, y: point.y },
      };
      // F4 dinâmico (Flavio 2026-04-29): emitir entrada de segmento permite
      // FocusMode.enterExecution acionar quando carro entra no trecho-foco.
      // Payload espelha onSegmentEnd no que faz sentido na entrada (sem
      // velMinima/apex/saida — esses só existem ao sair).
      this._emit('segmentStart', {
        segmentId: found.id,
        lapNumero: this.voltaAtual?.numero,
        entradaAt: point.t,
        velEntrada: point.speed,
        offset: point.offset,
      });
    } else if (!found && this.segmentoAtual) {
      // F4 dinâmico (Flavio 2026-04-29): saída do segmento pra "fora de
      // qualquer trecho" (reta entre curvas) também precisa fechar o segment
      // — sem isso, ProximityWatcher.RESULT nunca disparava em curva→reta
      // (cenário FAM Racing onde trechos são as curvas e retas são labels).
      fecharSegmentoAtual(point);
      this.segmentoAtual = null;
    } else if (this.segmentoAtual) {
      if (point.speed != null && this.segmentoAtual.velMinima != null) {
        if (point.speed < this.segmentoAtual.velMinima) {
          this.segmentoAtual.velMinima = point.speed;
          this.segmentoAtual.apexT = point.t;
          this.segmentoAtual.apexOffset = point.offset;
          this.segmentoAtual.apexActual = { x: point.x, y: point.y };
        }
      }
      if (this.ultimoPonto && point.speed != null && this.ultimoPonto.speed != null) {
        const dv = this.ultimoPonto.speed - point.speed;
        const dt = (point.t - this.ultimoPonto.t) / 1000;
        if (dv > 3 && dt > 0 && !this.segmentoAtual.pontoFrenagem) {
          this.segmentoAtual.pontoFrenagem = {
            offset: point.offset,
            t: point.t,
            velPre: this.ultimoPonto.speed,
          };
        }
      }
    }
  }

  stats() {
    return {
      lapCount: this.lapCount,
      voltaAtual: this.voltaAtual,
      currentParcial: this.currentParcial,
      segmentoAtual: this.segmentoAtual?.segmentId ?? null,
    };
  }
}
