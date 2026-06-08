// pilot-reaction — Pilot Reaction Learning Agent.
// Aprende reaction_time_ms por tupla (piloto, carro, gear, trecho) e calcula
// a compensação em RPM a aplicar no alvo visual.
//
// Modelo (do plano):
//   shift_visual_rpm = shift_optimal_rpm - reaction_compensation
//   reaction_compensation = reaction_time_ms * rpm_rise_rate / 1000
//
// Ambas as funções são puras (operam sobre um objeto `profiles`); a
// persistência fica em src/data/reaction-profiles.js.

const ALPHA = 0.15;
const MIN_SAMPLES = 10;
const RT_MIN_MS = 50;
const RT_MAX_MS = 400;
const DEFAULT_RT_MS = 250;
const WINDOW_BEFORE_S = 0.2; // mesma janela usada no shift-event-detector

export const REACTION_CONSTANTS = Object.freeze({
  ALPHA, MIN_SAMPLES, RT_MIN_MS, RT_MAX_MS, DEFAULT_RT_MS
});

export function tupleKey(piloto_id, carro_id, gear, trecho_id) {
  return [
    piloto_id ?? 'x',
    carro_id ?? 'x',
    Number.isFinite(gear) ? gear : 'x',
    trecho_id ?? 'x'
  ].join(':');
}

// observedReactionMs(event) — tempo de reação observado neste evento.
// Retorna null se não dá pra inferir.
function observedReactionMs(event) {
  if (!event) return null;
  if (!Number.isFinite(event.rpm_at_shift) || !Number.isFinite(event.target_visual_rpm)) return null;
  const deltaRpm = event.rpm_at_shift - event.target_visual_rpm;
  if (deltaRpm < 0) return null; // trocou antes do sinal visual — não conta
  let rate = Number.isFinite(event.rpm_rise_rate) ? event.rpm_rise_rate : null;
  if (rate == null && Number.isFinite(event.rpm_at_shift) && Number.isFinite(event.rpm_before)) {
    rate = (event.rpm_at_shift - event.rpm_before) / WINDOW_BEFORE_S;
  }
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const ms = (deltaRpm / rate) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(RT_MAX_MS, Math.max(RT_MIN_MS, ms));
}

// learnFromEvent(event, profiles) → novo objeto profiles imutável.
// Aplica regras de aceitação:
//   - gear_confidence ≥ 0.8
//   - data_inconsistent_flag === false
//   - não aprende com eventos 'early' (delta_rpm < 0): trocou antes do sinal
//   - rt observado precisa ser válido
export function learnFromEvent(event, profiles = {}) {
  if (!event) return profiles;
  if (!Number.isFinite(event.gear_confidence) || event.gear_confidence < 0.8) return profiles;
  if (event.data_inconsistent_flag === true) return profiles;
  if (Number.isFinite(event.delta_rpm) && event.delta_rpm < 0) return profiles; // early
  const observed = observedReactionMs(event);
  if (observed == null) return profiles;

  const key = tupleKey(event.piloto_id, event.carro_id, event.gear_after, event.trecho_id);
  const cur = profiles[key];
  let nextRt;
  if (!cur || cur.sample_count === 0) {
    nextRt = observed;
  } else {
    nextRt = cur.reaction_time_ms * (1 - ALPHA) + observed * ALPHA;
  }
  nextRt = Math.min(RT_MAX_MS, Math.max(RT_MIN_MS, nextRt));
  const next = {
    key,
    reaction_time_ms: nextRt,
    sample_count: (cur ? cur.sample_count : 0) + 1,
    last_updated: Date.now()
  };
  return { ...profiles, [key]: next };
}

// computeCompensation({ piloto_id, carro_id, gear, trecho_id, rpmRiseRate, profiles, mode })
//   → { rt_ms, compensation_rpm, source }
// Fallback hierárquico:
//   1. (piloto, carro, gear, trecho) — exata
//   2. (piloto, carro, gear, *)
//   3. (piloto, carro, *, *)
//   4. default 250ms
// Aplica compensação só com sample_count ≥ MIN_SAMPLES; senão default.
// Em modo 'learning' → compensação 0 (sem antecipar).
export function computeCompensation({ piloto_id, carro_id, gear, trecho_id, rpmRiseRate, profiles = {}, mode = 'assisted' } = {}) {
  if (mode !== 'assisted') {
    return { rt_ms: 0, compensation_rpm: 0, source: 'learning_mode' };
  }
  if (!Number.isFinite(rpmRiseRate) || rpmRiseRate <= 0) {
    return { rt_ms: 0, compensation_rpm: 0, source: 'invalid_rate' };
  }
  const candidates = [
    { key: tupleKey(piloto_id, carro_id, gear, trecho_id),    source: 'exact' },
    { key: tupleKey(piloto_id, carro_id, gear, null),         source: 'piloto-carro-gear' },
    { key: tupleKey(piloto_id, carro_id, null, null),         source: 'piloto-carro' }
  ];
  let rt = DEFAULT_RT_MS;
  let source = 'default';
  for (const c of candidates) {
    const p = profiles[c.key];
    if (p && p.sample_count >= MIN_SAMPLES && Number.isFinite(p.reaction_time_ms)) {
      rt = p.reaction_time_ms;
      source = c.source;
      break;
    }
  }
  rt = Math.min(RT_MAX_MS, Math.max(RT_MIN_MS, rt));
  const compensation_rpm = rt * rpmRiseRate / 1000;
  return { rt_ms: rt, compensation_rpm, source };
}
