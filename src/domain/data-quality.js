// ═══════════════════════════════════════════════════════════
// DataQuality — 11 categorias canônicas
// ═══════════════════════════════════════════════════════════
// docs/raceops/DATA_QUALITY_RULES.md (Engenheiro-Chefe 2026-04-26).
// Toda amostra (e cada canal de snapshot) carrega EXATAMENTE UMA dessas.
// UI, análise e alerta consultam essa categoria antes de usar o dado.
//
// Estado pré-2026-04-26: SignalQuality em provider.js tinha 4 categorias
// (good/degraded/bad/lost). Esta migração adiciona 7: INTERPOLATED,
// ESTIMATED, OUT_OF_ORDER, DUPLICATE, INVALID_CHECKSUM, LATE, OUT_OF_RANGE.
//
// SignalQuality continua existindo em provider.js como estado da fonte.
// Quality (este módulo) é por amostra/canal — granularidade fina.

export const Quality = Object.freeze({
  /** Dado medido, validado, dentro de range, sem latência anormal. Usar livre. */
  OK: 'OK',
  /** Possivelmente válido com sinal de problema (drift, jitter, divergência). Nunca CRÍTICO sem aviso. */
  SUSPECT: 'SUSPECT',
  /** Sem amostra dentro da janela de freshness. Análise opera em modo degradado. */
  MISSING: 'MISSING',
  /** Chegou depois da janela esperada mas dentro do tolerável. Marcar UI; reduzir confiança. */
  LATE: 'LATE',
  /** Timestamp anterior à última recebida da mesma fonte. Reordenar; log auditável. */
  OUT_OF_ORDER: 'OUT_OF_ORDER',
  /** Falha de checksum/CRC. Descartar. */
  INVALID_CHECKSUM: 'INVALID_CHECKSUM',
  /** Valor numérico fora do range esperado. Marcar; análise pode usar como hipótese de falha. */
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  /** Repetida (mesmo timestamp interno). Descartar segunda. */
  DUPLICATE: 'DUPLICATE',
  /** Calculado por interpolação. Aceitável pra visualização; não pra CRÍTICO. */
  INTERPOLATED: 'INTERPOLATED',
  /** Estimado por fusão de fontes ou modelo (ex: speed_fused). Aceitável; declarar confiança. */
  ESTIMATED: 'ESTIMATED',
  /** Válido mas com baixa confiança (poucos satélites, IMU sem calibrar). Marcar UI; nunca CRÍTICO sem aviso. */
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  /** LOST = MISSING crônico (compatibilidade com SignalQuality.LOST). Tratado como MISSING. */
  LOST: 'MISSING',
});

const QUALITY_VALUES = new Set(Object.values(Quality));

/** Severidade ordenada (do melhor pro pior — usado em worstOf). */
const QUALITY_SEVERITY = Object.freeze({
  [Quality.OK]:                0,
  [Quality.INTERPOLATED]:      1,
  [Quality.ESTIMATED]:         1,
  [Quality.LATE]:              2,
  [Quality.LOW_CONFIDENCE]:    2,
  [Quality.OUT_OF_ORDER]:      3,
  [Quality.DUPLICATE]:         4,   // descartado, mas raríssimo
  [Quality.SUSPECT]:           5,
  [Quality.OUT_OF_RANGE]:      6,
  [Quality.INVALID_CHECKSUM]:  7,
  [Quality.MISSING]:           8,
});

/** Compatibilidade legada — SignalQuality (4 categorias) → Quality (11). */
export function fromSignalQuality(sq) {
  if (sq == null) return Quality.MISSING;
  const norm = String(sq).toLowerCase();
  switch (norm) {
    case 'good':
    case 'ok':
      return Quality.OK;
    case 'degraded':
      return Quality.LOW_CONFIDENCE;
    case 'bad':
      return Quality.SUSPECT;
    case 'lost':
    case 'missing':
      return Quality.MISSING;
    default:
      // Já pode ser uma categoria nova
      if (QUALITY_VALUES.has(sq)) return sq;
      return Quality.OK;
  }
}

/** Determina Quality de um GPS pelo accuracy. DATA_QUALITY_RULES Regra 1. */
export function fromGpsAccuracy(accMeters, { numSatellites = null } = {}) {
  if (accMeters == null || !Number.isFinite(accMeters)) return Quality.MISSING;
  if (accMeters > 50) return Quality.MISSING;
  if (accMeters > 20) return Quality.SUSPECT;
  if (accMeters > 5)  return Quality.LOW_CONFIDENCE;
  // Alta accuracy mas com poucos satélites (visível em RaceBox) ainda derruba pra LOW_CONFIDENCE
  if (numSatellites != null && numSatellites < 6) return Quality.LOW_CONFIDENCE;
  return Quality.OK;
}

/** Determina Quality de um valor numérico pelo range esperado. DATA_QUALITY_RULES Regra 9. */
export function fromRangeCheck(value, { min, max }) {
  if (value == null || !Number.isFinite(value)) return Quality.MISSING;
  if ((min != null && value < min) || (max != null && value > max)) return Quality.OUT_OF_RANGE;
  return Quality.OK;
}

/** Pior categoria entre N — usado pra consolidar quality global. */
export function worstOf(qualities) {
  let worstSev = -1;
  let worst = Quality.OK;
  for (const q of qualities) {
    const sev = QUALITY_SEVERITY[q];
    if (sev != null && sev > worstSev) {
      worstSev = sev;
      worst = q;
    }
  }
  return worst;
}

/** Retorna true se a Quality permite uso livre (apenas OK). */
export function isOk(q) {
  return q === Quality.OK;
}

/** Retorna true se a Quality permite uso pra CRÍTICO/BOX_AGORA.
 *  ALERT_HIERARCHY Regra Crítica 4: "Crítico precisa OK". */
export function permitsCritical(q) {
  return q === Quality.OK;
}

/** Retorna true se a Quality permite uso visual mas com indicador. */
export function permitsVisual(q) {
  return q !== Quality.MISSING && q !== Quality.INVALID_CHECKSUM && q !== Quality.DUPLICATE;
}

/** Label humano para UI. */
export function qualityLabel(q) {
  switch (q) {
    case Quality.OK:                return 'ok';
    case Quality.SUSPECT:           return 'suspect';
    case Quality.MISSING:           return 'missing';
    case Quality.LATE:              return 'late';
    case Quality.OUT_OF_ORDER:      return 'out_of_order';
    case Quality.INVALID_CHECKSUM:  return 'invalid_checksum';
    case Quality.OUT_OF_RANGE:      return 'out_of_range';
    case Quality.DUPLICATE:         return 'duplicate';
    case Quality.INTERPOLATED:      return 'interpolated';
    case Quality.ESTIMATED:         return 'estimated';
    case Quality.LOW_CONFIDENCE:    return 'low_confidence';
    default:                        return 'ok';
  }
}

/**
 * Token CSS associado à Quality — UI usa pra colorir indicadores.
 * Mapeia para tokens já existentes em design-tokens.css.
 */
export function qualityToken(q) {
  switch (q) {
    case Quality.OK:                return '--bom';
    case Quality.INTERPOLATED:
    case Quality.ESTIMATED:         return '--sistema';
    case Quality.LATE:
    case Quality.LOW_CONFIDENCE:
    case Quality.SUSPECT:           return '--atencao';
    case Quality.OUT_OF_RANGE:
    case Quality.INVALID_CHECKSUM:
    case Quality.MISSING:           return '--erro';
    default:                        return '--muted';
  }
}
