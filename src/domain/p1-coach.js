// ═══════════════════════════════════════════════════════════
// P1 Coach — motor pedagógico do P1 Track Learning
// ═══════════════════════════════════════════════════════════
// Quando o piloto seleciona dentro de um stint:
//   "Aprendizado com IA" → escolhe uma área de foco (ex: SAIDA)
//
// O P1 Coach:
//   1. Filtra a Biblioteca de Lições (somente active === true)
//      pelo cornerType da curva atual e pela área de foco escolhida
//      (mapa fase → phaseWeights).
//   2. Verifica requiredSignals contra o snapshot canônico — se
//      algum sinal estiver faltando, a lição NÃO é elegível.
//   3. Ranqueia as elegíveis por "encaixe" (peso na fase × confidence).
//   4. Ativa UMA lição por trecho (regra de fluxo: piloto não recebe
//      mais que 1 instrução pedagógica por curva, espelhando SPEC §23.3).
//   5. Emite uma mensagem do `preferredMessageCodes` da lição na fase
//      certa, respeitando cooldown e o estado deterministico do alerta
//      crítico (CriticalRules tem prioridade absoluta — ADR-008).
//
// O coach NÃO duplica o CriticalRulesEngine. O caller deve dar pause()
// no P1 Coach se um alerta CRÍTICO/BOX_AGORA estiver ativo.
//
// Confidence:
//   Lição com `successCriteria.confidence === BAIXA` só dispara
//   mensagem se o piloto pediu explicitamente foco naquela área (sinal
//   alto de intenção pedagógica do piloto).

import { activeLessons, getLesson } from '../data/lesson-library.js';
import { canActivate, Phase, Confidence } from './lesson-schema.js';
import { getPhrase } from '../data/coach-phrases.js';

const PHASE_FROM_FASE_CURVA = Object.freeze({
  inicio: Phase.ENTRADA,
  meio:   Phase.APEX,
  fim:    Phase.SAIDA,
});

const DEFAULT_COOLDOWN_MS = 3500;     // mensagem por trecho — não martela
const DEFAULT_MAX_PER_CORNER = 1;     // 1 lição ativa por curva
const LOW_CONF_REQUIRES_USER_PICK = true;

/**
 * @typedef {Object} CoachMessage
 * @property {string} lessonId
 * @property {string} code              M###
 * @property {string} text              frase 2..3 palavras
 * @property {string} phase             entrada|apex|saida
 * @property {string} confidence        alta|media|baixa
 * @property {number} t                 epoch ms
 * @property {number} tMono             relógio monotônico
 * @property {string} cornerType        lenta|media|rapida
 * @property {string} segmentId
 */

/**
 * @typedef {Object} StintLearningSession
 * @property {boolean} active
 * @property {string|null} focusPhase   entrada|apex|saida|null (qualquer)
 * @property {string|null} focusLessonId  se piloto travou em 1 lição
 * @property {string|null} segmentId    foco em 1 trecho específico (opcional)
 * @property {number} startedAt         epoch ms
 * @property {number} laps              voltas decorridas no modo
 */

export class P1Coach {
  constructor({
    onMessage = null,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    maxPerCorner = DEFAULT_MAX_PER_CORNER,
  } = {}) {
    this.onMessage = onMessage;
    this.cooldownMs = cooldownMs;
    this.maxPerCorner = maxPerCorner;
    this._lastEmitAt = null;
    this._currentSegmentId = null;
    this._messagesThisCorner = 0;
    this._activeLessonForCorner = null;
    this._paused = false;

    /** @type {StintLearningSession} */
    this.learningSession = {
      active: false,
      focusPhase: null,
      focusLessonId: null,
      segmentId: null,
      startedAt: 0,
      laps: 0,
    };
  }

  // ── ciclo do modo "Aprendizado com IA" ──────────────────────
  /**
   * Piloto entrou no modo. focusPhase opcional, mas FORTEMENTE
   * recomendado — sem ele, lições BAIXA confidence não disparam
   * (LOW_CONF_REQUIRES_USER_PICK).
   *
   * @param {object} opts
   * @param {string} [opts.focusPhase]    entrada|apex|saida
   * @param {string} [opts.focusLessonId] trava em 1 lição específica
   * @param {string} [opts.segmentId]     trava em 1 trecho específico
   */
  startLearningSession({ focusPhase = null, focusLessonId = null, segmentId = null } = {}) {
    if (focusPhase != null && !Object.values(Phase).includes(focusPhase)) {
      throw new Error(`focusPhase inválido: ${focusPhase}`);
    }
    if (focusLessonId != null && !getLesson(focusLessonId)) {
      throw new Error(`focusLessonId desconhecido: ${focusLessonId}`);
    }
    this.learningSession = {
      active: true,
      focusPhase,
      focusLessonId,
      segmentId,
      startedAt: Date.now(),
      laps: 0,
    };
    this._activeLessonForCorner = null;
    this._messagesThisCorner = 0;
  }

  endLearningSession() {
    const finished = { ...this.learningSession };
    this.learningSession = {
      active: false, focusPhase: null, focusLessonId: null,
      segmentId: null, startedAt: 0, laps: 0,
    };
    return finished;
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; }

  /**
   * Caller chama no início de cada trecho (curva). Reseta o contador
   * e re-elege a lição ativa para essa curva.
   *
   * @param {object} segment      TrackSegment com cornerType, id
   * @param {Set<string>} availableSignals  sinais presentes no snapshot
   */
  onSegmentEnter(segment, availableSignals) {
    if (!segment || segment.ehTrecho === false) {
      this._currentSegmentId = null;
      this._activeLessonForCorner = null;
      return;
    }
    this._currentSegmentId = segment.id;
    this._messagesThisCorner = 0;
    this._activeLessonForCorner = this._electLesson(segment, availableSignals);
  }

  onSegmentExit() {
    this._currentSegmentId = null;
    this._activeLessonForCorner = null;
    this._messagesThisCorner = 0;
  }

  onLapEnd() {
    if (this.learningSession.active) this.learningSession.laps++;
  }

  /**
   * Elege UMA lição para esta curva. Critérios em ordem:
   *   1. Lição travada pelo piloto (focusLessonId) — só ativa se sinais OK
   *      e cornerType compatível.
   *   2. Filtra ativas + cornerType + canActivate(signals).
   *   3. Se piloto declarou focusPhase: prioriza lições com peso ≥ 0.5
   *      naquela fase.
   *   4. Confidence BAIXA exige LOW_CONF_REQUIRES_USER_PICK satisfeito.
   *   5. Empate: maior peso na focusPhase, depois ordem de id.
   */
  _electLesson(segment, availableSignals) {
    const { focusLessonId, focusPhase } = this.learningSession;
    const cornerType = segment.cornerType;
    const userPicked = !!(focusLessonId || focusPhase);

    if (focusLessonId) {
      const l = getLesson(focusLessonId);
      if (l && l.active && l.applicableCornerTypes.includes(cornerType)
          && canActivate(l, availableSignals)) {
        return l;
      }
      return null;
    }

    let pool = activeLessons()
      .filter(l => l.applicableCornerTypes.includes(cornerType))
      .filter(l => canActivate(l, availableSignals));

    if (LOW_CONF_REQUIRES_USER_PICK && !userPicked) {
      pool = pool.filter(l => l.successCriteria.confidence !== Confidence.BAIXA);
    }

    if (focusPhase) {
      const focused = pool.filter(l => (l.phaseWeights[focusPhase] ?? 0) >= 0.5);
      if (focused.length) pool = focused;
    }

    if (pool.length === 0) return null;

    pool.sort((a, b) => {
      if (focusPhase) {
        const wa = a.phaseWeights[focusPhase] ?? 0;
        const wb = b.phaseWeights[focusPhase] ?? 0;
        if (wa !== wb) return wb - wa;
      }
      return a.id.localeCompare(b.id);
    });
    return pool[0];
  }

  /**
   * Caller alimenta a cada amostra dentro do trecho atual. O coach
   * decide se emite uma mensagem ou não.
   *
   * @param {object} ctx
   * @param {string} ctx.faseCurva       inicio|meio|fim — vem de fase-curva.js
   * @param {object} ctx.snapshot        snapshot com tMono e métricas
   * @param {Set<string>} ctx.signals    sinais presentes
   */
  consume({ faseCurva, snapshot, signals }) {
    if (this._paused) return null;
    if (!this.learningSession.active) return null;
    if (!this._activeLessonForCorner || !this._currentSegmentId) return null;
    if (this._messagesThisCorner >= this.maxPerCorner) return null;

    const phase = PHASE_FROM_FASE_CURVA[faseCurva];
    if (!phase) return null;

    const lesson = this._activeLessonForCorner;
    if (!canActivate(lesson, signals)) return null;

    const weight = lesson.phaseWeights[phase] ?? 0;
    if (weight < 0.2) return null;

    if (this.learningSession.focusPhase && phase !== this.learningSession.focusPhase) {
      return null;
    }

    const tMono = snapshot.tMono ?? 0;
    if (this._lastEmitAt != null && tMono - this._lastEmitAt < this.cooldownMs) return null;

    const code = this._pickMessageCode(lesson, phase);
    if (!code) return null;
    const text = getPhrase(code);
    if (!text) return null;

    const msg = {
      lessonId: lesson.id,
      code,
      text,
      phase,
      confidence: lesson.successCriteria.confidence ?? Confidence.MEDIA,
      t: snapshot.t ?? Date.now(),
      tMono,
      cornerType: lesson.applicableCornerTypes[0],
      segmentId: this._currentSegmentId,
    };

    this._lastEmitAt = tMono;
    this._messagesThisCorner++;

    if (this.onMessage) {
      try { this.onMessage(msg); } catch { /* listener falho não derruba o coach */ }
    }
    return msg;
  }

  _pickMessageCode(lesson, phase) {
    const codes = lesson.preferredMessageCodes;
    if (!codes?.length) return null;
    const idx = ({
      [Phase.ENTRADA]: 0,
      [Phase.APEX]:    Math.min(1, codes.length - 1),
      [Phase.SAIDA]:   Math.min(2, codes.length - 1),
    })[phase] ?? 0;
    return codes[idx] ?? codes[0];
  }

  /**
   * Helper: deriva o conjunto de sinais disponíveis a partir de um
   * snapshot canônico do mobile-telemetry + métricas de fase-curva.
   * Caller pode passar o seu próprio Set se já tiver derivado.
   */
  static signalsFromSnapshot(snapshot, faseStats = null) {
    const set = new Set();
    if (snapshot == null) return set;
    if (snapshot.kmh != null)        set.add('kmh');
    if (snapshot.lat != null)        set.add('lat');
    if (snapshot.lng != null)        set.add('lng');
    if (snapshot.course != null)     set.add('course');
    if (snapshot.heading != null)    set.add('heading');
    if (snapshot.accLong != null)    set.add('accLong');
    if (snapshot.accLat != null)     set.add('accLat');
    if (snapshot.gyroAlpha != null)  set.add('gyroAlpha');
    if (snapshot.engine?.tps != null) set.add('tps');
    if (snapshot.engine?.rpm != null) set.add('rpm');
    if (snapshot.engine?.map != null) set.add('map');
    if (snapshot.engine?.lambda != null) set.add('lambda');
    if (snapshot.steering?.angle != null) set.add('steering.angle');
    if (snapshot.brake?.pressure != null) set.add('brake.pressure');
    if (snapshot.slip?.ratio != null) set.add('slip.ratio');

    if (faseStats) {
      set.add('phase');
      if (faseStats.velEntrada != null) set.add('velEntrada');
      if (faseStats.velMinima != null)  set.add('velMinima');
      if (faseStats.velSaida != null)   set.add('velSaida');
      if (faseStats.apexT != null)      set.add('apexT');
      if (faseStats.apexKmh != null)    set.add('apexKmh');
    }
    if (snapshot.trajetoriaMatch != null) set.add('trajetoria');
    return set;
  }
}

export const p1Coach = new P1Coach();
