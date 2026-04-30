// ═══════════════════════════════════════════════════════════
// CriticalRules — hierarquia de alertas determinística (P0)
// ═══════════════════════════════════════════════════════════
// docs/raceops/ALERT_HIERARCHY.md (Diretor Técnico 2026-04-26).
// 4 níveis: INFORMATIVO / ATENÇÃO / CRÍTICO / BOX_AGORA.
//
// REGRAS NÃO NEGOCIÁVEIS (ALERT_HIERARCHY §"Regras críticas"):
//  1. CRÍTICO e BOX_AGORA são DETERMINÍSTICOS. Nunca IA.
//  2. CRÍTICO e BOX_AGORA NUNCA são silenciados por filtro.
//  3. Toda regra crítica é cadastrada explicitamente em código.
//  4. Toda regra crítica tem teste automatizado.
//  5. CRÍTICO precisa Quality.OK no canal (DATA_QUALITY Regra 4).
//
// LIMITES DEFAULT abaixo são CONSERVADORES — calibrar com Flavio
// para o Celta 1.4 quando T4000 entrar live (BLOCKERS.md E2).
// Limites foram derivados de literatura motorsports + manual técnico
// Celta. Cada regra documenta a fonte do default.

import { Quality } from '../domain/data-quality.js';
import { logger } from '../core/logger.js';

export const AlertLevel = Object.freeze({
  INFORMATIVO: 'INFORMATIVO',
  ATENCAO:     'ATENCAO',
  CRITICO:     'CRITICO',
  BOX_AGORA:   'BOX_AGORA',
});

/**
 * Estrutura obrigatória de cada alerta — ALERT_HIERARCHY §"Estrutura obrigatória".
 * Os 7 campos. Sem um deles, o alerta não dispara.
 *
 * @typedef {Object} Alert
 * @property {string} nivel
 * @property {string} descricao
 * @property {string} causa_provavel
 * @property {string} acao_imediata
 * @property {string} quem_age
 * @property {string} urgencia
 * @property {string} confianca
 * @property {string[]} canais
 * @property {string} regra
 * @property {number} t
 * @property {number} tMono
 */

/**
 * CATÁLOGO DETERMINÍSTICO — limites cadastrados.
 * Cada regra declara: canal, limite, nível, cooldown.
 *
 * Defaults conservadores. Flavio calibra cada um quando o canal entra live.
 *
 * Fontes dos defaults:
 *   • Pressão óleo Celta 1.4 manual: idle ≥ 1.0 bar; carga normal ≥ 2.5 bar
 *   • Temperatura motor Celta: range normal 85-95°C; > 110°C alarme
 *   • Lambda alvo Celta NA: 0.85-0.95 sob carga; > 1.0 sob carga = pobre
 *   • Bateria 12V: < 12.0V parado / < 11.5V em uso = falha alternador
 *   • Temperatura freio Celta: > 600°C = fade iminente
 */
export const CRITICAL_RULES = Object.freeze([

  // ─── Pressão óleo baixa ────────────────────────────────────
  {
    id: 'press-oleo-baixa',
    canal: 'engine.oil_pressure',
    descricao: 'Pressão óleo abaixo do limite seguro',
    nivel: AlertLevel.BOX_AGORA,
    cooldownMs: 10_000,
    confianca: 'Alta',
    quem_age: 'piloto',
    urgencia: 'agora — abortar volta se necessário',
    causa_provavel: 'Vazamento ou falha de bomba',
    acao_imediata: 'Box agora — não completar volta',
    /** Aplicado quando: pressão < 1.0 bar com motor RPM > 1000. */
    avaliar(snap) {
      const p = snap.engine?.oil_pressure;
      const rpm = snap.engine?.rpm;
      if (p == null || rpm == null) return false;
      if (snap.quality.t4000_quality !== Quality.OK) return false;
      // CALIBRAR: 1.0 bar é conservador. Flavio confirma janela do Celta.
      return rpm > 1000 && p < 1.0;
    },
    NEEDS_CALIBRATION: 'Flavio: confirmar pressão mínima Celta 1.4 sob carga (default 1.0 bar)',
  },

  // ─── Temperatura motor extrema ──────────────────────────────
  {
    id: 'temp-motor-extrema',
    canal: 'engine.water_temp',
    descricao: 'Temperatura motor extrema',
    // Tendência sobe de ATENÇÃO → CRÍTICO → BOX_AGORA
    nivelDinamico: true,
    cooldownMs: 30_000,
    confianca: 'Alta',
    quem_age: 'piloto',
    urgencia: 'agora',
    causa_provavel: 'Falha de arrefecimento ou desligamento de ventoinha',
    acao_imediata: 'Reduzir ritmo, voltar ao box no fim desta volta',
    avaliar(snap) {
      const t = snap.engine?.water_temp;
      if (t == null) return null;
      if (snap.quality.t4000_quality !== Quality.OK) return null;
      // CALIBRAR: janela Celta. Defaults conservadores.
      if (t > 115) return AlertLevel.BOX_AGORA;
      if (t > 105) return AlertLevel.CRITICO;
      if (t > 100) return AlertLevel.ATENCAO;
      return null;
    },
    NEEDS_CALIBRATION: 'Flavio: janela de temp Celta — defaults 100/105/115°C',
  },

  // ─── Temperatura freio extrema ──────────────────────────────
  {
    id: 'temp-freio-extrema',
    canal: 'brakes.temp',
    descricao: 'Temperatura freio em zona crítica',
    nivel: AlertLevel.CRITICO,
    cooldownMs: 30_000,
    confianca: 'Alta',
    quem_age: 'piloto',
    urgencia: 'agora',
    causa_provavel: 'Frenagem prolongada sem resfriamento — risco de fade',
    acao_imediata: 'Reduzir frenagem nas próximas 2 voltas',
    avaliar(snap) {
      const t = snap.brakes?.temp_max;
      if (t == null) return false;
      // Sensor de freio ainda não existe — regra fica preparada.
      return t > 650;
    },
    NEEDS_CALIBRATION: 'Flavio: confirmar limite Celta + adicionar canal brakes.temp quando sensor entrar',
  },

  // ─── Lambda pobre prolongado ───────────────────────────────
  {
    id: 'lambda-pobre-prolongado',
    canal: 'engine.lambda',
    descricao: 'Mistura pobre sob carga — risco de detonação',
    nivelDinamico: true,
    cooldownMs: 5000,
    confianca: 'Alta',
    quem_age: 'piloto',
    urgencia: 'agora',
    causa_provavel: 'Mapa de combustível ou pressão caindo',
    acao_imediata: 'Aliviar pedal, voltar pro box',
    avaliar(snap, ctx) {
      const lam = snap.engine?.lambda;
      const tps = snap.engine?.tps;
      const map = snap.engine?.map;
      const rpm = snap.engine?.rpm;
      if (lam == null || tps == null || map == null || rpm == null) return null;
      if (snap.quality.t4000_quality !== Quality.OK) return null;
      const sobCarga = tps > 70 && map > 0.8 && rpm > 4000;
      if (!sobCarga) { ctx.poorStartedAt = null; return null; }
      if (lam <= 1.0) { ctx.poorStartedAt = null; return null; }
      if (ctx.poorStartedAt == null) ctx.poorStartedAt = snap.tMono;
      const dur = snap.tMono - ctx.poorStartedAt;
      if (dur > 5000) return AlertLevel.CRITICO;
      if (dur > 1000) return AlertLevel.ATENCAO;
      return null;
    },
    NEEDS_CALIBRATION: 'Flavio: confirmar λ alvo Celta NA sob carga (default 0.85-0.95)',
  },

  // ─── Bateria baixa ─────────────────────────────────────────
  {
    id: 'bateria-baixa',
    canal: 'engine.battery_voltage',
    descricao: 'Tensão bateria baixa',
    nivelDinamico: true,
    cooldownMs: 30_000,
    confianca: 'Alta',
    quem_age: 'piloto',
    urgencia: 'próximo trecho',
    causa_provavel: 'Alternador falhando ou correia',
    acao_imediata: 'Reduzir consumo (luzes/ventiladores), voltar pro box',
    avaliar(snap) {
      const v = snap.engine?.battery_voltage;
      const rpm = snap.engine?.rpm;
      if (v == null || rpm == null) return null;
      if (snap.quality.t4000_quality !== Quality.OK) return null;
      if (rpm < 1500) return null;
      if (v < 10.5) return AlertLevel.CRITICO;
      if (v < 11.5) return AlertLevel.ATENCAO;
      return null;
    },
    NEEDS_CALIBRATION: 'Flavio: confirmar tensão alvo Celta com motor sob carga',
  },

  // ─── Falha de canal de telemetria ──────────────────────────
  {
    id: 'falha-canal-telemetria',
    canal: 'sync_quality',
    descricao: 'Canal de telemetria sem dado',
    nivelDinamico: true,
    cooldownMs: 60_000,
    confianca: 'Alta',
    quem_age: 'engenheiro',
    urgencia: 'próxima volta',
    causa_provavel: 'Provider caiu — GPS sem fix, T4000 desconectado, ou BLE perdeu link',
    acao_imediata: 'Box: investigar fonte / ressuscitar conexão',
    avaliar(snap) {
      const q = snap.quality?.sync_quality;
      if (!q) return null;
      if (q === Quality.MISSING) return AlertLevel.ATENCAO;
      if (q === Quality.LATE) return AlertLevel.INFORMATIVO;
      return null;
    },
    NEEDS_CALIBRATION: null,
  },
]);

/** Eventos manuais (botão dedicado no Box). Não dependem de canal. */
export const MANUAL_RULES = Object.freeze([
  {
    id: 'bandeira-vermelha',
    descricao: 'Bandeira vermelha',
    nivel: AlertLevel.BOX_AGORA,
    confianca: 'Alta',
    causa_provavel: 'Acidente / interrupção do treino',
    acao_imediata: 'Voltar ao box imediatamente',
    quem_age: 'piloto',
    urgencia: 'agora',
  },
  {
    id: 'bandeira-amarela',
    descricao: 'Bandeira amarela',
    nivel: AlertLevel.ATENCAO,
    confianca: 'Alta',
    causa_provavel: 'Carro/objeto na pista',
    acao_imediata: 'Reduzir ritmo, sem ultrapassagens',
    quem_age: 'piloto',
    urgencia: 'agora',
  },
  {
    id: 'pista-molhada',
    descricao: 'Pista molhada',
    nivel: AlertLevel.ATENCAO,
    confianca: 'Alta',
    causa_provavel: 'Chuva ou óleo',
    acao_imediata: 'Reduzir ritmo, calibrar entrada',
    quem_age: 'piloto',
    urgencia: 'agora',
  },
]);

/**
 * Engine determinística — caller alimenta snapshots; engine emite alertas.
 *
 * Uso típico:
 *   const engine = new CriticalRulesEngine({ onAlert: a => box.alert(a) });
 *   timebase.onTick(10, snap => engine.consume(snap));
 *   // Botão manual:
 *   engine.fireManual('bandeira-vermelha');
 */
export class CriticalRulesEngine {
  constructor({ onAlert = null } = {}) {
    this.onAlert = onAlert;
    /** Última emissão por regra. */
    this.lastFiredAt = new Map();
    /** Contexto persistente por regra (state machine pra "X por Y segundos"). */
    this.context = new Map();
  }

  reset() {
    this.lastFiredAt.clear();
    this.context.clear();
  }

  consume(snap) {
    if (!snap || !snap.tMono) return;
    for (const rule of CRITICAL_RULES) {
      let nivel;
      const ctx = this.context.get(rule.id) || {};
      try {
        const result = rule.avaliar(snap, ctx);
        if (result == null || result === false) {
          this.context.set(rule.id, ctx);
          continue;
        }
        nivel = rule.nivelDinamico ? result : rule.nivel;
      } catch (e) {
        logger.error('[critical-rules] avaliar', { rule: rule.id, err: String(e) });
        continue;
      }
      this.context.set(rule.id, ctx);
      const last = this.lastFiredAt.get(rule.id);
      if (last != null && snap.tMono - last < rule.cooldownMs) continue;
      this.lastFiredAt.set(rule.id, snap.tMono);
      this._fire({
        id: rule.id,
        nivel,
        descricao: rule.descricao,
        causa_provavel: rule.causa_provavel,
        acao_imediata: rule.acao_imediata,
        quem_age: rule.quem_age,
        urgencia: rule.urgencia,
        confianca: rule.confianca,
        canais: [rule.canal],
        regra: rule.id,
        t: snap.t, tMono: snap.tMono,
      });
    }
  }

  /** Dispara alerta manual (botão do engenheiro no Box). */
  fireManual(id) {
    const rule = MANUAL_RULES.find(r => r.id === id);
    if (!rule) {
      logger.warn('[critical-rules] regra manual não encontrada', { id });
      return;
    }
    const t = Date.now();
    const tMono = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : t;
    this._fire({
      id: rule.id,
      nivel: rule.nivel,
      descricao: rule.descricao,
      causa_provavel: rule.causa_provavel,
      acao_imediata: rule.acao_imediata,
      quem_age: rule.quem_age,
      urgencia: rule.urgencia,
      confianca: rule.confianca,
      canais: ['manual'],
      regra: rule.id,
      t, tMono,
    });
  }

  _fire(alert) {
    // Validação dos 7 campos obrigatórios — ALERT_HIERARCHY §"Estrutura obrigatória".
    const obrig = ['nivel', 'descricao', 'causa_provavel', 'acao_imediata', 'quem_age', 'urgencia', 'confianca'];
    const faltando = obrig.filter(f => alert[f] == null || alert[f] === '');
    if (faltando.length) {
      logger.error('[critical-rules] alerta INVÁLIDO — sem campos', { id: alert.id, faltando });
      return;
    }
    // CRÍTICO/BOX_AGORA exigem confiança Alta — Reprovação automática
    if ((alert.nivel === AlertLevel.CRITICO || alert.nivel === AlertLevel.BOX_AGORA) && alert.confianca !== 'Alta') {
      logger.error('[critical-rules] alerta CRÍTICO sem confiança Alta — reprovado', { id: alert.id });
      return;
    }
    if (this.onAlert) {
      try { this.onAlert(alert); } catch (e) { logger.error('[critical-rules] onAlert', { err: String(e) }); }
    }
    logger.info('[critical-rules] FIRE', { id: alert.id, nivel: alert.nivel });
  }
}

/** Singleton padrão. */
export const criticalRulesEngine = new CriticalRulesEngine();
