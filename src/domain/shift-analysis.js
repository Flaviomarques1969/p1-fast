// shift-analysis — classifica um shift_event e produz a frase pedagógica
// que vai pro card pós-sessão. Função pura.
//
// analyzeEvent(event, car) → { classification, lessonText }
//   classification: 'correct' | 'early' | 'late' | 'insufficient_data'
//   lessonText: frase em PT-BR adequada ao status

const CONFIDENCE_FLOOR = 0.7;

const PHRASES = Object.freeze({
  correct: 'Boa troca. Motor permaneceu na faixa útil e a retomada foi consistente.',
  early:   'Você trocou cedo demais. Motor caiu fora da faixa forte e a aceleração demorou a recuperar. Próxima sessão, segure mais a marcha em <TRECHO>.',
  late:    'Você passou do ponto ideal. Aceleração já estava perdendo eficiência antes da troca. Próxima sessão, antecipe a troca em <TRECHO>.',
  insufficient_data: 'Marcha estimada com pouca confiança. Sistema usou modo seguro. Mais voltas vão melhorar a precisão.'
});

export function classifyEvent(event, car) {
  if (!event) return 'insufficient_data';
  if (event.data_inconsistent_flag === true) return 'insufficient_data';
  if (!Number.isFinite(event.gear_confidence) || event.gear_confidence < CONFIDENCE_FLOOR) {
    return 'insufficient_data';
  }
  if (!Number.isFinite(event.delta_rpm) || !Number.isFinite(event.target_optimal_rpm)) {
    return 'insufficient_data';
  }
  const tolerance = (car && Number.isFinite(car.tolerance_rpm)) ? car.tolerance_rpm : 150;
  const d = event.delta_rpm;
  if (Math.abs(d) <= tolerance) return 'correct';
  if (d < -tolerance) return 'early';
  if (d > tolerance) return 'late';
  return 'insufficient_data';
}

export function buildLessonText(event, classification, trechoName) {
  const tpl = PHRASES[classification] || PHRASES.insufficient_data;
  const trecho = (typeof trechoName === 'string' && trechoName.trim().length > 0)
    ? trechoName.trim()
    : null;
  if (!tpl.includes('<TRECHO>')) return tpl;
  if (trecho) return tpl.replace('<TRECHO>', trecho);
  // Sem trecho: remove a fragment "em <TRECHO>." cleanly.
  return tpl
    .replace(' em <TRECHO>.', '.')
    .replace(' em <TRECHO>', '');
}

// analyzeEvent(event, car, trechoNameLookup) → { classification, lessonText }
//   trechoNameLookup: opcional, função (trecho_id) → string|null
export function analyzeEvent(event, car, trechoNameLookup = null) {
  const classification = classifyEvent(event, car);
  let trechoName = null;
  if (event && event.trecho_id && typeof trechoNameLookup === 'function') {
    try { trechoName = trechoNameLookup(event.trecho_id) || null; }
    catch { trechoName = null; }
  }
  const lessonText = buildLessonText(event, classification, trechoName);
  return { classification, lessonText };
}
