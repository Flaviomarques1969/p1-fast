// ═══════════════════════════════════════════════════════════
// CrossValidationEngine — V-001 a V-011 (P1)
// ═══════════════════════════════════════════════════════════
// docs/raceops/CROSS_VALIDATION_RULES.md (Engenheiro-Chefe 2026-04-26).
// Catálogo determinístico de comparações redundantes entre canais.
//
// Princípio: divergência gera HIPÓTESE, não certeza. Mensagem ao box é
// "verificar X", não "X está errado". Quando divergência detectada,
// canais envolvidos são marcados como SUSPECT.
//
// Cooldown por validação (default 30s) evita spam.
//
// Consume snapshots produzidos pelo TelemetryTimebase + SnapshotBuilder.

import { Quality } from '../domain/data-quality.js';
import { logger } from '../core/logger.js';
import { msParaKmh } from '../domain/velocidade.js';

const DEFAULT_COOLDOWN_MS = 30_000;

/**
 * @typedef {Object} ValidationEvent
 * @property {string} validation     V-001 .. V-011
 * @property {string} severity       'info' | 'atencao' | 'critico'
 * @property {string} message        Mensagem para o Box
 * @property {string[]} channels     Canais envolvidos (ex: 'engine.rpm', 'vehicle.speed_fused')
 * @property {string} hypothesis     Hipótese sugerida (curta)
 * @property {string} action         Ação recomendada
 * @property {number} t              Date.now da detecção
 * @property {number} tMono          performance.now da detecção
 */

/** Marcadores temporais para regras com janela mínima sustentada. */
class WindowState {
  constructor(minMs) {
    this.minMs = minMs;
    this.startedAt = null;
  }
  enter(tMono) {
    if (this.startedAt == null) this.startedAt = tMono;
    return tMono - this.startedAt >= this.minMs;
  }
  exit() {
    this.startedAt = null;
  }
}

/**
 * Engine principal — caller alimenta snapshots; engine emite eventos.
 *
 * Uso típico:
 *   const engine = new CrossValidationEngine({ onEvent: ev => box.push(ev) });
 *   timebase.onTick(10, snap => engine.consume(snap));
 */
export class CrossValidationEngine {
  constructor({ onEvent = null, gearMap = null, cooldownMs = DEFAULT_COOLDOWN_MS } = {}) {
    this.onEvent = onEvent;
    this.cooldownMs = cooldownMs;
    /** Última emissão por validação — pra cooldown. */
    this.lastEmittedAt = new Map();
    /** Janelas de regra. */
    this.windows = {
      v001: new WindowState(2000),     // V-001: 2s
      v002: new WindowState(1000),     // V-002: 1s
      v003: new WindowState(500),      // V-003: 0.5s
      v004: new WindowState(1000),     // V-004: 1s
      v005: new WindowState(60_000),   // V-005: 1min
      v006: new WindowState(2000),     // V-006: 2s
      v007: new WindowState(1000),     // V-007: 1s
      v007b: new WindowState(5000),    // V-007 escalado pra CRÍTICO
      v008: new WindowState(2000),     // V-008
    };
    /**
     * Mapa marcha→(km/h por 1000 RPM). CROSS_VALIDATION_RULES V-004:
     * valores de exemplo do Celta 1.4. Calibrar com Flavio.
     */
    this.gearMap = gearMap || { 1: 10, 2: 20, 3: 28, 4: 35, 5: 42, 6: 50 };
  }

  /** Limpa estado (útil em testes). */
  reset() {
    this.lastEmittedAt.clear();
    Object.values(this.windows).forEach(w => w.exit());
  }

  /** Consome um snapshot — roda todas as validações. */
  consume(snap) {
    if (!snap || !snap.tMono) return;
    this._v001(snap);
    this._v002(snap);
    this._v003(snap);
    this._v004(snap);
    this._v005(snap);
    this._v006(snap);
    this._v007(snap);
    this._v008(snap);
    this._v010(snap);
    this._v011(snap);
    // V-009 é derivada (corner-by-corner), não snapshot-by-snapshot.
    // Vai num módulo separado de análise pós-curva.
  }

  _emit(ev) {
    const last = this.lastEmittedAt.get(ev.validation);
    if (last != null && ev.tMono - last < this.cooldownMs) return;
    this.lastEmittedAt.set(ev.validation, ev.tMono);
    // ALERT_HIERARCHY exige `confianca` declarada em CRÍTICO/BOX AGORA.
    // Eventos do engine vêm de regras determinísticas com janela mínima
    // sustentada — confiança Alta por construção. Caller (cockpit/box) pode
    // descartar eventos com confianca != 'Alta' por defesa em profundidade.
    const annotated = ev.confianca ? ev : { ...ev, confianca: 'Alta' };
    if (this.onEvent) {
      try { this.onEvent(annotated); } catch (e) { logger.error('[xvalidation] onEvent', { err: String(e) }); }
    }
    logger.info('[xvalidation] event', { v: annotated.validation, sev: annotated.severity, ch: annotated.channels });
  }

  // ─── V-001 · Velocidade CAN vs Velocidade GNSS ──────────────
  _v001(snap) {
    const can = snap.vehicle?.speed_can;
    const gnss = snap.vehicle?.speed_gnss;
    if (can == null || gnss == null) { this.windows.v001.exit(); return; }
    if (snap.quality.t4000_quality !== Quality.OK || (snap.quality.racebox_quality !== Quality.OK && snap.quality.iphone_quality !== Quality.OK)) {
      this.windows.v001.exit(); return;
    }
    const diffKmh = Math.abs(msParaKmh(can - gnss));
    if (diffKmh > 5) {
      if (this.windows.v001.enter(snap.tMono)) {
        this._emit({
          validation: 'V-001', severity: 'atencao',
          channels: ['vehicle.speed_can', 'vehicle.speed_gnss'],
          message: `Velocidade CAN diverge da GNSS em ${diffKmh.toFixed(1)} km/h por 2s+. Verificar calibração de pneu / sensor de roda.`,
          hypothesis: 'sensor de velocidade T4000 calibrado errado, circunferência de pneu diferente, slip momentâneo, ou erro GNSS multipath',
          action: 'verificar calibração de pneu/sensor', t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v001.exit();
  }

  // ─── V-002 · Aceleração long IMU vs derivada da velocidade ───
  _v002(snap) {
    const imu = snap.dynamics?.accel_longitudinal;
    const speed = snap.vehicle?.speed_fused;
    if (imu == null || speed == null) { this.windows.v002.exit(); return; }
    // Precisa histórico — caller fornece via _lastSpeed
    if (this._lastSpeed != null && this._lastTMono != null) {
      const dt = (snap.tMono - this._lastTMono) / 1000;
      if (dt > 0.05 && dt < 1.0) {
        const derivada = (speed - this._lastSpeed) / dt;
        const diff = Math.abs(imu - derivada);
        if (diff > 2) {
          if (this.windows.v002.enter(snap.tMono)) {
            this._emit({
              validation: 'V-002', severity: 'atencao',
              channels: ['dynamics.accel_longitudinal'],
              message: `Aceleração longitudinal IMU diverge ${diff.toFixed(1)} m/s² da derivada da velocidade. Possível drift IMU ou impacto.`,
              hypothesis: 'drift IMU, calibração ruim, ou vibração mecânica anômala (zebra, buraco, batida)',
              action: 'marcar accel_longitudinal como SUSPECT na janela', t: snap.t, tMono: snap.tMono,
            });
          }
        } else this.windows.v002.exit();
      }
    }
    this._lastSpeed = speed;
    this._lastTMono = snap.tMono;
  }

  // ─── V-003 · TPS vs MAP vs Aceleração ───────────────────────
  _v003(snap) {
    const tps = snap.engine?.tps;
    const map = snap.engine?.map;
    const acc = snap.dynamics?.accel_longitudinal;
    if (tps == null || map == null || acc == null) { this.windows.v003.exit(); return; }
    // Heurística NA — para turbo, threshold seria 1.0 bar.
    const isPedal = tps > 80;
    const isMapBaixo = map < 0.6;
    const semGanho = acc < 1;
    if (isPedal && isMapBaixo && semGanho) {
      if (this.windows.v003.enter(snap.tMono)) {
        this._emit({
          validation: 'V-003', severity: 'atencao',
          channels: ['engine.tps', 'engine.map', 'dynamics.accel_longitudinal'],
          message: 'TPS alto sem ganho de aceleração ou MAP. Verificar tração, combustível, admissão ou sensor.',
          hypothesis: 'perda de tração, falha de bicos, restrição admissão, sensor MAP problemático ou marcha errada',
          action: 'investigar grupo combustão/admissão/tração', t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v003.exit();
  }

  // ─── V-004 · RPM vs Marcha vs Velocidade ────────────────────
  _v004(snap) {
    const rpm = snap.engine?.rpm;
    const gear = snap.engine?.gear;
    const speed = snap.vehicle?.speed_fused;
    if (rpm == null || gear == null || speed == null || gear === 0) { this.windows.v004.exit(); return; }
    if (rpm < 1500) { this.windows.v004.exit(); return; }
    const expectedKmhPer1000 = this.gearMap[gear];
    if (!expectedKmhPer1000) return;
    const speedKmh = msParaKmh(speed);
    const expectedKmh = (rpm / 1000) * expectedKmhPer1000;
    const errPct = Math.abs(speedKmh - expectedKmh) / Math.max(1, expectedKmh);
    if (errPct > 0.15) {
      if (this.windows.v004.enter(snap.tMono)) {
        this._emit({
          validation: 'V-004', severity: 'atencao',
          channels: ['engine.rpm', 'engine.gear', 'vehicle.speed_fused'],
          message: `Relação RPM × velocidade × marcha fora do esperado (erro ${(errPct*100).toFixed(0)}%). Verificar embreagem, slip ou sensor de marcha.`,
          hypothesis: 'patinação de embreagem, marcha incorreta, slip de rodas ou troca de marcha em curso',
          action: 'marcar engine.gear como SUSPECT, investigar transmissão', t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v004.exit();
  }

  // ─── V-005 · Temperatura água vs tempo de pista ─────────────
  _v005(snap) {
    const tw = snap.engine?.water_temp;
    if (tw == null) { this.windows.v005.exit(); return; }
    // Tendência: amostragem em janela móvel
    if (!this._tempHistory) this._tempHistory = [];
    this._tempHistory.push({ t: snap.tMono, v: tw });
    // Manter últimos 5 min
    const cutoff = snap.tMono - 5 * 60_000;
    this._tempHistory = this._tempHistory.filter(p => p.t > cutoff);
    if (this._tempHistory.length < 30) return;
    // Slope linear simples (°C/min) sobre os últimos 5min
    const first = this._tempHistory[0];
    const last = this._tempHistory[this._tempHistory.length - 1];
    const dtMin = (last.t - first.t) / 60_000;
    if (dtMin < 1) return;
    const slope = (last.v - first.v) / dtMin;
    if (slope > 0.5 && tw > 75) {  // após 5min iniciais
      if (this.windows.v005.enter(snap.tMono)) {
        this._emit({
          validation: 'V-005', severity: tw > 100 ? 'critico' : 'atencao',
          channels: ['engine.water_temp'],
          message: `Temperatura da água subindo ${slope.toFixed(2)}°C/min. Atual ${tw.toFixed(0)}°C. Verificar arrefecimento.`,
          hypothesis: 'falha de arrefecimento, ventoinha desligada, vazamento ou radiador sujo',
          action: 'verificar sistema de arrefecimento', t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v005.exit();
  }

  // ─── V-006 · Pressão óleo vs RPM ────────────────────────────
  _v006(snap) {
    const press = snap.engine?.oil_pressure;
    const rpm = snap.engine?.rpm;
    const oilT = snap.engine?.oil_temp;
    if (press == null || rpm == null) { this.windows.v006.exit(); return; }
    // Janela mínima esperada: 1 bar para cada 1000 rpm é heurística clássica.
    // Hot oil cai mais — ajusta se temp óleo > 110.
    let expected = rpm / 1000;
    if (oilT != null && oilT > 110) expected *= 0.85;
    if (press < expected * 0.7 && rpm > 2500) {
      const severity = press < 1.5 ? 'critico' : 'atencao';
      if (this.windows.v006.enter(snap.tMono)) {
        this._emit({
          validation: 'V-006', severity,
          channels: ['engine.oil_pressure', 'engine.rpm'],
          message: `Pressão óleo ${press.toFixed(1)} bar baixa para RPM ${rpm.toFixed(0)} (esperado ~${expected.toFixed(1)} bar). Risco mecânico.`,
          hypothesis: 'baixo nível, bomba falhando, óleo diluído (combustível) ou filtro entupido',
          action: severity === 'critico' ? 'BOX AGORA — risco de pane mecânica' : 'monitorar próximas voltas, considerar box',
          t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v006.exit();
  }

  // ─── V-007 · Lambda vs TPS vs MAP vs RPM ────────────────────
  _v007(snap) {
    const lam = snap.engine?.lambda;
    const tps = snap.engine?.tps;
    const map = snap.engine?.map;
    const rpm = snap.engine?.rpm;
    if (lam == null || tps == null || map == null || rpm == null) {
      this.windows.v007.exit(); this.windows.v007b.exit(); return;
    }
    const sobCarga = tps > 70 && map > 0.8 && rpm > 4000;
    const pobre = lam > 1.0;
    if (sobCarga && pobre) {
      const t1 = this.windows.v007.enter(snap.tMono);
      const t5 = this.windows.v007b.enter(snap.tMono);
      if (t5) {
        this._emit({
          validation: 'V-007', severity: 'critico',
          channels: ['engine.lambda', 'engine.tps', 'engine.map', 'engine.rpm'],
          message: `Mistura pobre (λ ${lam.toFixed(2)}) sob carga por 5s+. RISCO DE DETONAÇÃO.`,
          hypothesis: 'mapa de combustível inadequado, pressão de combustível caindo, bicos sujos ou restrição admissão',
          action: 'BOX AGORA — risco de motor', t: snap.t, tMono: snap.tMono,
        });
      } else if (t1) {
        this._emit({
          validation: 'V-007', severity: 'atencao',
          channels: ['engine.lambda', 'engine.tps', 'engine.map', 'engine.rpm'],
          message: `Mistura pobre (λ ${lam.toFixed(2)}) sob carga. Verificar mapa, pressão e bicos.`,
          hypothesis: 'mapa de combustível inadequado ou problema mecânico',
          action: 'monitorar e investigar combustível', t: snap.t, tMono: snap.tMono,
        });
      }
    } else { this.windows.v007.exit(); this.windows.v007b.exit(); }
  }

  // ─── V-008 · Tensão bateria vs comportamento ECU ────────────
  _v008(snap) {
    const v = snap.engine?.battery_voltage;
    const rpm = snap.engine?.rpm;
    if (v == null || rpm == null) { this.windows.v008.exit(); return; }
    if (rpm < 2000) { this.windows.v008.exit(); return; }
    if (v < 11.5) {
      const severity = v < 10.5 ? 'critico' : 'atencao';
      if (this.windows.v008.enter(snap.tMono)) {
        this._emit({
          validation: 'V-008', severity,
          channels: ['engine.battery_voltage', 'engine.rpm'],
          message: `Tensão bateria ${v.toFixed(1)}V baixa com motor a ${rpm.toFixed(0)} RPM (alternador deveria carregar).`,
          hypothesis: 'alternador falhando, correia frouxa ou terminal solto',
          action: severity === 'critico' ? 'BOX AGORA — risco de eletrônica desligar' : 'verificar alternador no fim do stint',
          t: snap.t, tMono: snap.tMono,
        });
      }
    } else this.windows.v008.exit();
  }

  // ─── V-010 · Yaw rate vs trajetória vs aceleração lateral ───
  _v010(snap) {
    const yaw = snap.dynamics?.yaw_rate;
    const aLat = snap.dynamics?.accel_lateral;
    if (yaw == null || aLat == null) return;
    // Heurística simples: |yaw| > 30°/s com |aLat| < 3 m/s² (carro girando sem aderência)
    if (Math.abs(yaw) > 30 && Math.abs(aLat) < 3) {
      this._emit({
        validation: 'V-010', severity: 'atencao',
        channels: ['dynamics.yaw_rate', 'dynamics.accel_lateral'],
        message: `Yaw alto (${yaw.toFixed(0)}°/s) com baixa aceleração lateral (${aLat.toFixed(1)} m/s²) — possível sobresterço (perda de aderência).`,
        hypothesis: 'sobresterço, perda de aderência traseira ou contra-volante',
        action: 'inferência registrada (não fato) — alimentar análise de pilotagem',
        t: snap.t, tMono: snap.tMono,
      });
    }
    // Inverso: |aLat| > 8 m/s² com |yaw| baixo — subesterço
    if (Math.abs(aLat) > 8 && Math.abs(yaw) < 10) {
      this._emit({
        validation: 'V-010-b', severity: 'atencao',
        channels: ['dynamics.yaw_rate', 'dynamics.accel_lateral'],
        message: `Aceleração lateral alta (${aLat.toFixed(1)} m/s²) com yaw baixo — possível subesterço.`,
        hypothesis: 'subesterço, perda de aderência dianteira',
        action: 'inferência registrada — verificar geometria/pneus',
        t: snap.t, tMono: snap.tMono,
      });
    }
  }

  // ─── V-011 · Aceleração lateral vs raio de trajetória ───────
  _v011(snap) {
    // Raio precisa derivada de posição — caller mantém histórico
    const lat = snap.position?.lat;
    const lon = snap.position?.lon;
    const speed = snap.vehicle?.speed_fused;
    const aLat = snap.dynamics?.accel_lateral;
    if (lat == null || lon == null || speed == null || aLat == null) return;

    if (!this._posHistory) this._posHistory = [];
    this._posHistory.push({ t: snap.tMono, lat, lon, speed });
    const cutoff = snap.tMono - 1500;
    this._posHistory = this._posHistory.filter(p => p.t > cutoff);
    if (this._posHistory.length < 5) return;

    // Raio aproximado: r = v² / aLat (centrípeta). Com 3 pontos GPS: usar curvatura discreta.
    const a = this._posHistory[0];
    const b = this._posHistory[Math.floor(this._posHistory.length / 2)];
    const c = this._posHistory[this._posHistory.length - 1];
    const r = circumscribedRadius(a, b, c);
    if (r == null || r < 5 || r > 1000) return;
    const expectedALat = (speed * speed) / r;
    const diff = Math.abs(Math.abs(aLat) - expectedALat);
    // Tolerância 30% — ruído grande do GPS justifica tolerância larga
    if (diff > expectedALat * 0.3 && expectedALat > 2) {
      this._emit({
        validation: 'V-011', severity: 'info',
        channels: ['dynamics.accel_lateral', 'position.lat', 'position.lon'],
        message: `IMU lateral (${Math.abs(aLat).toFixed(1)} m/s²) diverge do esperado pela trajetória (${expectedALat.toFixed(1)} m/s²). Verificar calibração.`,
        hypothesis: 'IMU descalibrado ou trajetória mal-medida',
        action: 'marcar accel_lateral como SUSPECT na janela',
        t: snap.t, tMono: snap.tMono,
      });
    }
  }
}

// Aproximação rápida do raio circunscrito a 3 pontos lat/lon — usa metric local plana (suficiente p/ pista).
function circumscribedRadius(a, b, c) {
  // converte para metros aproximados
  const m = 111_320;
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lon * m * cosLat;
  const ay = a.lat * m;
  const bx = b.lon * m * cosLat;
  const by = b.lat * m;
  const cx = c.lon * m * cosLat;
  const cy = c.lat * m;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return Math.hypot(ux - ax, uy - ay);
}

/** Singleton padrão. */
export const crossValidationEngine = new CrossValidationEngine();
