// LiveDataBridge — cola entre os dados que chegam (transports + T4000) e o
// CockpitState (modelo do painel). Roda no notebook Windows.
//
// Spec: PLANO_FASE_1.md §6 MS-13.4 (reescrito 2026-05-09 amendment 2 — ADR-023)
// Mockup canônico: zero impacto (este módulo só atualiza o CockpitState).
//
// Fontes:
// 1. TransportSelector (cabo USB primário + Realtime fallback) → IMU/GPS
//    do iPhone (envelope { tMono, source: 'iphone-imu', payload }).
// 2. T4000Provider local no notebook → samples T4000 (RPM, marcha, MAP, λ,
//    temps, pressões, erro ECU, etc.).
//
// O bridge faz duas tarefas:
// - Mapear T4000 → estado direto do cockpit (shift light + alertas críticos).
// - Armazenar último IMU/GPS pra ser consumido pelo detector (MS-13.5,
//   ainda não implementado — quando chegar ele lê via getLastImuGps()).

import {
  ShiftMode,
  MsgTipo,
  SHIFT_LEVEL_MAX,
} from './cockpit-state.js';

// ── Limites default (calibrar por carro com Flávio) ──────────
//
// Origem: docs/hardware/T4000_CAN_SPEC.md §"Alertas determinísticos".
// Valores iniciais conservadores; ALERT_HIERARCHY.md confirma por carro.

export const DEFAULT_LIMITS = Object.freeze({
  redlineRpm:           7500,
  fireThresholdRatio:   0.95, // ≥95% redline → FIRE strobe
  litStartRatio:        0.50, // <50% redline → LEDs apagados
  oilPressMinBar:       0.5,
  oilPressMinAtRpm:     2000, // só dispara alerta abaixo do mínimo se RPM > este
  oilTempMaxC:          130,
  waterTempMaxC:        110,
  // egtOutOfRange já vem flagged pelo parser (T4000_EGT_MAX_C = 1500)
});

// ── Helpers puros (testáveis isoladamente) ──────────────────

/**
 * Mapeia RPM para shift mode + level conforme limites.
 * - >redline       → OVERREV
 * - ≥fireThreshold → FIRE
 * - ≥litStart      → LIT linear 1..SHIFT_LEVEL_MAX
 * - <litStart      → OFF
 */
export function rpmToShift(rpm, limits = DEFAULT_LIMITS) {
  if (typeof rpm !== 'number' || !Number.isFinite(rpm) || rpm < 0) {
    return { mode: ShiftMode.OFF, level: 0 };
  }
  const { redlineRpm, fireThresholdRatio, litStartRatio } = limits;
  if (rpm > redlineRpm) return { mode: ShiftMode.OVERREV, level: 0 };
  const ratio = rpm / redlineRpm;
  if (ratio >= fireThresholdRatio) return { mode: ShiftMode.FIRE, level: 0 };
  if (ratio < litStartRatio) return { mode: ShiftMode.OFF, level: 0 };
  // mapeia [litStart..fireThreshold) → [1..SHIFT_LEVEL_MAX]
  const span = fireThresholdRatio - litStartRatio;
  const norm = (ratio - litStartRatio) / span; // 0..<1
  const level = Math.max(1, Math.min(SHIFT_LEVEL_MAX, Math.round(norm * SHIFT_LEVEL_MAX) || 1));
  return { mode: ShiftMode.LIT, level };
}

/**
 * Avalia condições críticas do T4000. Retorna { tipo, texto } se há alerta;
 * null se está tudo OK ou se o sample tem checksum quebrado.
 *
 * Ordem de prioridade (mais grave primeiro):
 * 1. erro ECU != 0 (bitfield)
 * 2. água > limite
 * 3. óleo > limite
 * 4. pressão óleo < limite com RPM > limite (motor sob carga)
 * 5. EGT fora de range
 */
export function checkCriticalAlerts(sample, limits = DEFAULT_LIMITS) {
  if (!sample || sample.checksumOk === false) return null;

  if (sample.ecuErrorBits !== undefined && sample.ecuErrorBits !== 0) {
    return { tipo: MsgTipo.GRAVE, texto: 'Erro ECU' };
  }
  if (typeof sample.waterTempC === 'number' && sample.waterTempC > limits.waterTempMaxC) {
    return { tipo: MsgTipo.GRAVE, texto: 'Temperatura água crítica' };
  }
  if (typeof sample.oilTempC === 'number' && sample.oilTempC > limits.oilTempMaxC) {
    return { tipo: MsgTipo.GRAVE, texto: 'Temperatura óleo crítica' };
  }
  if (typeof sample.oilPressBar === 'number'
      && typeof sample.rpm === 'number'
      && sample.oilPressBar < limits.oilPressMinBar
      && sample.rpm > limits.oilPressMinAtRpm) {
    return { tipo: MsgTipo.GRAVE, texto: 'Pressão óleo crítica' };
  }
  if (sample.egtOutOfRange === true) {
    return { tipo: MsgTipo.GRAVE, texto: 'EGT crítica' };
  }
  return null;
}

// ── Bridge ──────────────────────────────────────────────────

export class LiveDataBridge {
  /**
   * @param {Object} opts
   * @param {Object} opts.cockpitState   instância de CockpitState
   * @param {Object} [opts.limits]       limites de calibração (DEFAULT_LIMITS)
   * @param {(stage:string,info:any)=>void} [opts.onEvent]  observabilidade
   */
  constructor({ cockpitState, limits = DEFAULT_LIMITS, onEvent = () => {} }) {
    if (!cockpitState) throw new Error('LiveDataBridge: cockpitState é obrigatório');
    this._cockpitState = cockpitState;
    this._limits = limits;
    this._onEvent = onEvent;

    this._lastImuGps = null;
    this._lastT4000 = null;
    this._activeAlertTexto = null; // pra evitar showMessage repetida
    this._stats = { imuGpsCount: 0, t4000Count: 0, alertsRaised: 0, alertsCleared: 0 };
  }

  /** Plugado no TransportSelector — recebe envelope do cabo OU do realtime, indistinto. */
  ingestImuGps(envelope) {
    if (!envelope || envelope.source !== 'iphone-imu' || !envelope.payload) return;
    this._lastImuGps = envelope.payload;
    this._stats.imuGpsCount++;
    // por enquanto não muta CockpitState diretamente — fica disponível pro
    // detector (MS-13.5) consumir via getLastImuGps().
  }

  /** Plugado no T4000Provider — recebe sample já parseado e validado. */
  ingestT4000(sample) {
    if (!sample) return;
    this._lastT4000 = sample;
    this._stats.t4000Count++;
    this._applyT4000ToCockpit(sample);
  }

  getLastImuGps()  { return this._lastImuGps; }
  getLastT4000()   { return this._lastT4000; }
  getStats()       { return { ...this._stats }; }

  // ── interno ─────────────────────────────────────────

  _applyT4000ToCockpit(sample) {
    if (sample.checksumOk === false) {
      this._onEvent('t4000-bad-checksum', { tMono: sample.tMono });
      return; // não interpreta dado corrompido
    }

    // 1. RPM → shift mode/level
    if (typeof sample.rpm === 'number') {
      const { mode, level } = rpmToShift(sample.rpm, this._limits);
      this._cockpitState.applyShift(mode, level);
    }

    // 2. Alertas críticos
    const alert = checkCriticalAlerts(sample, this._limits);
    if (alert) {
      if (this._activeAlertTexto !== alert.texto) {
        this._cockpitState.showMessage(alert);
        this._activeAlertTexto = alert.texto;
        this._stats.alertsRaised++;
        this._onEvent('alert-raised', alert);
      }
    } else if (this._activeAlertTexto !== null) {
      // condição limpou. Limpa só se a mensagem ativa era um alerta deste bridge.
      // (Mensagens de coach/comunicação ficam preservadas — futuro: priority manager.)
      this._cockpitState.hideMessage();
      this._activeAlertTexto = null;
      this._stats.alertsCleared++;
      this._onEvent('alert-cleared', null);
    }
  }
}
