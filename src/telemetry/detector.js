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
 * @property {number|null} vChegada      m/s — velocidade ~1.2s antes da entrada (proxy de "50 m antes")
 * @property {number|null} vFreada       m/s — velocidade no instante anterior à frenagem detectada
 * @property {number|null} tFreada       wall-ms — momento do início da frenagem
 * @property {number|null} tempoFreadaApiceMs   ms entre tFreada e apexT
 * @property {number|null} tempoApiceSaidaMs    ms entre apexT e saidaAt
 * @property {number} criadoEm
 *
 * APEX (gate 2026-04-24, docs/raceops/APEX_ANALYSIS_RULES.md):
 *   apex_actual = ponto onde velMinima foi atingida durante o segment.
 *   Comparar com track-segment.apexReference para classificar
 *   (apex correto / antecipado / tardio / perdido por fora / interno demais).
 *
 * SEIS INDICADORES (Comando GO 2026-05-24):
 *   - vChegada: aproximação por tempo (lookback ~1.2 s) — proxy de "50 m antes
 *     do ponto E". Usa buffer rolling pré-segmento. Quando não há sample
 *     suficiente, devolve null.
 *   - vFreada / tFreada: derivados de `pontoFrenagem` (primeira queda > 3 m/s
 *     em < 1 s dentro do segmento).
 *   - vSaidaPico: NÃO está em SegmentExecution — é emitido em evento separado
 *     `onSegmentPostBurst` quando o carro percorreu mais ~2.4 s (proxy de
 *     "100 m após saída") OU entrou em novo segmento OU cruzou linha de
 *     chegada. UI agrega os dois eventos por (segmentId, lapNumero).
 */

export class Detector {
  /**
   * @param {object} cfg
   * @param {string} cfg.svgPath      - string d= do path da pista
   * @param {object} cfg.linhaChegada - { x1, y1, x2, y2 }
   * @param {Array}  cfg.segments     - trackSegments da layout (ordenados)
   * @param {number} cfg.snapMaxDist  - se snap > isso, amostra descartada
   */
  constructor({
    svgPath,
    linhaChegada,
    segments = [],
    snapMaxDist = 80,
    vChegadaLookbackMs = 1200,
    vSaidaPicoTrackMs = 2400,
    bufferMaxSamples = 240,
  }) {
    this.lookup = buildLookup(svgPath, 2000);
    this.linhaChegada = linhaChegada;
    this.segments = segments;
    this.snapMaxDist = snapMaxDist;
    this.vChegadaLookbackMs = vChegadaLookbackMs;
    this.vSaidaPicoTrackMs = vSaidaPicoTrackMs;
    this.bufferMaxSamples = bufferMaxSamples;

    this.listeners = {
      lap: new Set(),
      segmentStart: new Set(),
      segmentEnd: new Set(),
      segmentPostBurst: new Set(),
    };
    this.lapCount = 0;
    this.voltaAtual = null;
    this.ultimoPonto = null;
    this.segmentoAtual = null;
    this.parcialTimestamps = {};   // { [parcialId]: tMono } — quando entrou na parcial
    this.currentParcial = null;

    // Buffer rolling de samples pré-segmento — usado pra calcular vChegada.
    // Contém { t, speed, offset } dos últimos `bufferMaxSamples` pontos.
    this.bufferRolling = [];

    // Estado de "pós-saída" pra computar V saída pico (~100 m / ~2.4 s
    // após cruzar o ponto S do segmento). Quando setado, cada consume
    // atualiza vMax/tMax e o evento é emitido quando lookback excedeu OU
    // novo segmento começou OU linha de chegada foi cruzada.
    this.postBurst = null;
  }

  onLap(cb)              { this.listeners.lap.add(cb);              return () => this.listeners.lap.delete(cb); }
  onSegmentStart(cb)     { this.listeners.segmentStart.add(cb);     return () => this.listeners.segmentStart.delete(cb); }
  onSegmentEnd(cb)       { this.listeners.segmentEnd.add(cb);       return () => this.listeners.segmentEnd.delete(cb); }
  onSegmentPostBurst(cb) { this.listeners.segmentPostBurst.add(cb); return () => this.listeners.segmentPostBurst.delete(cb); }
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

    // Buffer rolling — usado pra computar vChegada quando entrar em
    // segmento. Mantém os últimos `bufferMaxSamples` samples válidos.
    this.bufferRolling.push({ t: point.t, speed: point.speed, offset: point.offset });
    if (this.bufferRolling.length > this.bufferMaxSamples) this.bufferRolling.shift();

    // Pós-saída: atualizar pico/encerrar se atingiu lookback de tempo.
    this._updatePostBurst(point, /* forceFlush */ false);

    if (this.ultimoPonto && this.linhaChegada) {
      const { x1, y1, x2, y2 } = this.linhaChegada;
      const cruzou = segmentsIntersect(
        { x: this.ultimoPonto.x, y: this.ultimoPonto.y },
        { x: point.x, y: point.y },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      );
      if (cruzou) {
        // Cruzou linha de chegada: força flush do post-burst pendente.
        this._flushPostBurst('line_cross');
        this._onLineCross(point);
      }
    }

    this._updateSegment(point);

    this.ultimoPonto = point;
  }

  // ───────── helpers privados pros 6 indicadores ─────────

  /// Procura no buffer rolling o sample com t <= tEntrada - lookbackMs.
  /// Devolve null se o buffer não tem amplitude suficiente.
  _vChegadaFromBuffer(tEntrada) {
    if (!this.bufferRolling.length) return null;
    const limite = tEntrada - this.vChegadaLookbackMs;
    let melhor = null;
    for (let i = this.bufferRolling.length - 1; i >= 0; i--) {
      const s = this.bufferRolling[i];
      if (s.t <= limite) { melhor = s; break; }
    }
    if (!melhor) {
      // Buffer raso: usar o sample mais antigo disponível como melhor proxy.
      melhor = this.bufferRolling[0];
    }
    return melhor.speed ?? null;
  }

  /// Atualiza estado de pós-saída e dispara flush quando o tempo
  /// excedeu vSaidaPicoTrackMs. Quando `forceFlush=true`, emite o
  /// evento mesmo sem lookback completo (usado em line_cross / new_segment).
  _updatePostBurst(point, forceFlush) {
    const pb = this.postBurst;
    if (!pb) return;
    if (point.speed != null && (pb.vMax == null || point.speed > pb.vMax)) {
      pb.vMax = point.speed;
      pb.tMax = point.t;
    }
    const elapsed = point.t - pb.tSaida;
    if (forceFlush || elapsed >= this.vSaidaPicoTrackMs) {
      this._flushPostBurst('lookback');
    }
  }

  _flushPostBurst(reason) {
    const pb = this.postBurst;
    if (!pb) return;
    this.postBurst = null;
    this._emit('segmentPostBurst', {
      segmentId: pb.segmentId,
      lapNumero: pb.lapNumero,
      vSaidaPico: pb.vMax ?? null,
      tSaidaPico: pb.tMax ?? null,
      reason,
    });
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
      const pf = this.segmentoAtual.pontoFrenagem;
      const apexT = this.segmentoAtual.apexT;
      const tempoFreadaApiceMs = (pf && apexT != null) ? (apexT - pf.t) : null;
      const tempoApiceSaidaMs = (apexT != null) ? (saidaPoint.t - apexT) : null;
      const se = {
        segmentId: this.segmentoAtual.segmentId,
        lapNumero: this.voltaAtual?.numero,
        entradaAt: this.segmentoAtual.entradaAt,
        saidaAt: saidaPoint.t,
        tempoMs: saidaPoint.t - this.segmentoAtual.entradaAt,
        velEntrada: this.segmentoAtual.velEntrada,
        velMinima: this.segmentoAtual.velMinima,
        velSaida: this.ultimoPonto?.speed ?? null,
        pontoFrenagem: pf,
        // Apex real: ponto onde a menor velocidade foi atingida durante o segment.
        // Diretor Técnico (docs/raceops/APEX_ANALYSIS_RULES.md) — ligar com
        // track-segment.apexReference para classificar.
        apexT,
        apexOffset: this.segmentoAtual.apexOffset,
        apexActual: this.segmentoAtual.apexActual,
        // Indicadores novos (Comando GO 2026-05-24):
        vChegada: this.segmentoAtual.vChegada ?? null,
        vFreada: pf ? pf.velPre : null,
        tFreada: pf ? pf.t : null,
        tempoFreadaApiceMs,
        tempoApiceSaidaMs,
      };
      if (this.voltaAtual) {
        this.voltaAtual.temposPorTrecho[this.segmentoAtual.segmentId] = se.tempoMs;
      }
      this._emit('segmentEnd', se);
      // Inicia rastreamento pós-saída pra computar vSaidaPico. Se já
      // havia outro post-burst pendente (chegada rápida em outro segment),
      // força flush antes pra não perder o evento anterior.
      this._flushPostBurst('new_segment');
      this.postBurst = {
        segmentId: se.segmentId,
        lapNumero: se.lapNumero,
        tSaida: saidaPoint.t,
        vMax: saidaPoint.speed ?? null,
        tMax: saidaPoint.speed != null ? saidaPoint.t : null,
      };
    };

    if (found && (!this.segmentoAtual || this.segmentoAtual.segmentId !== found.id)) {
      if (this.segmentoAtual) fecharSegmentoAtual(point);
      // vChegada: velocidade ~1.2 s antes do instante de entrada (proxy
      // de "50 m antes" — independe de pathMetersPerUnit). Usa buffer
      // rolling. Se o buffer não tem essa amplitude, devolve o sample
      // mais antigo disponível como melhor aproximação.
      const vChegada = this._vChegadaFromBuffer(point.t);
      this.segmentoAtual = {
        segmentId: found.id,
        entradaAt: point.t,
        velEntrada: point.speed,
        velMinima: point.speed,
        pontoFrenagem: null,
        apexT: point.t,
        apexOffset: point.offset,
        apexActual: { x: point.x, y: point.y },
        vChegada,
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

  // Fonte de verdade pra trecho_id em tempo real (lido pelo trecho-resolver
  // do shift-light). Síncrono — só devolve o segment atualmente ativo.
  getCurrentSegmentId() {
    return this.segmentoAtual?.segmentId ?? null;
  }
}
