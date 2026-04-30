// ═══════════════════════════════════════════════════════════
// P1TrackLesson — schema canônico de lição pedagógica
// ═══════════════════════════════════════════════════════════
// Lição = unidade mínima de coaching no carro. NÃO é setup, NÃO é
// box, NÃO é racecraft agressivo, NÃO é ajuste mecânico. Só
// COMPORTAMENTO do piloto dentro do carro.
//
// P1 Coach só ativa uma lição se TODOS os requiredSignals estiverem
// disponíveis no snapshot atual. optionalSignals enriquecem mas não
// bloqueiam ativação.
//
// preferredMessageCodes referenciam src/data/coach-phrases.js
// (catálogo separado, todas com ≤ 3 palavras).
//
// Confidence:
//   ALTA  — sinal direto, threshold determinístico (ex: V-Min)
//   MEDIA — derivado de 1 inferência (ex: accLong derivando freio/acel)
//   BAIXA — derivado de 2+ inferências ou proxy (ex: linha de visão por heading)

export const LessonCategory = Object.freeze({
  REFERENCIA:   'referencia',     // pontos fixos (frear, virar, acelerar)
  VELOCIDADE:   'velocidade',     // V-min, gestão de velocidade
  TRANSICAO:    'transicao',      // freio↔acelerador, suavidade
  CONTROLE:     'controle',       // sub/sobresterço, recuperação
  VISAO:        'visao',          // olhar, antecipação
  SUPERFICIE:   'superficie',     // pista/zebra/grip
});

export const LessonLevel = Object.freeze({
  INTRO:    'intro',     // qualquer piloto que sabe pilotar
  PADRAO:   'padrao',    // já tem volta de referência
  AVANCADO: 'avancado',  // exige sensores extras ou recorrência alta
});

export const Confidence = Object.freeze({
  ALTA:  'alta',
  MEDIA: 'media',
  BAIXA: 'baixa',
});

export const Phase = Object.freeze({
  ENTRADA: 'entrada',   // mapeia para fase-curva.INICIO
  APEX:    'apex',      // mapeia para fase-curva.MEIO
  SAIDA:   'saida',     // mapeia para fase-curva.FIM
});

// Fonte: src/domain/track-segment.js CornerType
export const CornerType = Object.freeze({
  LENTA:  'lenta',
  MEDIA:  'media',
  RAPIDA: 'rapida',
});

/**
 * Catálogo de sinais que uma lição pode exigir. Tudo que está
 * marcado MVP_IPHONE já chega no snapshot canônico do
 * mobile-telemetry.js. Os demais entram em Fase 2 quando T4000/RaceBox
 * estiverem ligados (ver BLOCKERS.md E2/E4).
 */
export const Signal = Object.freeze({
  // ── MVP iPhone (mobile-telemetry.js) ──
  KMH:           'kmh',           // GPS speed × 3.6
  LAT:           'lat',
  LNG:           'lng',
  COURSE:        'course',        // heading GPS
  ACC_LONG:      'accLong',       // acel. longitudinal (g) — derivada de accY
  ACC_LAT:       'accLat',        // acel. lateral (g) — derivada de accX
  GYRO_YAW:      'gyroAlpha',     // taxa de yaw (deg/s)
  HEADING:       'heading',       // compass calibrado

  // ── Fase de curva (já calculada em fase-curva.js) ──
  PHASE:         'phase',          // INICIO|MEIO|FIM
  V_ENTRADA:     'velEntrada',
  V_MIN:         'velMinima',
  V_SAIDA:       'velSaida',
  APEX_T:        'apexT',
  APEX_KMH:      'apexKmh',

  // ── Cross-volta (path-mapper / projector) ──
  TRAJETORIA:    'trajetoria',     // amostra projetada vs referência

  // ── Fase 2: T4000 CAN (BLOCKERS E2) ──
  TPS:           'tps',
  RPM:           'rpm',
  MAP:           'map',
  LAMBDA:        'lambda',

  // ── Fase 2: sensores que ainda não existem ──
  STEERING:      'steering.angle',
  BRAKE_PRESS:   'brake.pressure',
  SLIP_RATIO:    'slip.ratio',
});

const VALID_LEVEL    = new Set(Object.values(LessonLevel));
const VALID_CATEGORY = new Set(Object.values(LessonCategory));
const VALID_CONFID   = new Set(Object.values(Confidence));
const VALID_PHASE    = new Set(Object.values(Phase));
const VALID_CORNER   = new Set(Object.values(CornerType));
const VALID_SIGNAL   = new Set(Object.values(Signal));

/**
 * Valida lição contra o schema. Lança Error com mensagem específica
 * — usado em testes e na inicialização da biblioteca.
 *
 * @param {object} l — lição candidata
 * @returns {true}
 */
export function validateLesson(l) {
  if (!l || typeof l !== 'object') throw new Error('lesson: objeto obrigatório');
  if (!l.id || typeof l.id !== 'string') throw new Error('lesson.id obrigatório (string)');
  if (!/^L[0-9]{3}-[a-z0-9-]+$/.test(l.id)) {
    throw new Error(`lesson.id formato inválido: ${l.id} (esperado L### e slug)`);
  }
  if (!l.title || typeof l.title !== 'string') throw new Error(`${l.id}: title obrigatório`);
  if (!VALID_CATEGORY.has(l.category)) throw new Error(`${l.id}: category inválida (${l.category})`);
  if (!VALID_LEVEL.has(l.level)) throw new Error(`${l.id}: level inválido (${l.level})`);

  if (!l.shortDescription || typeof l.shortDescription !== 'string') {
    throw new Error(`${l.id}: shortDescription obrigatória`);
  }
  if (!l.objective || typeof l.objective !== 'string') {
    throw new Error(`${l.id}: objective obrigatório`);
  }

  if (!l.phaseWeights || typeof l.phaseWeights !== 'object') {
    throw new Error(`${l.id}: phaseWeights obrigatório`);
  }
  let sum = 0;
  for (const k of Object.keys(l.phaseWeights)) {
    if (!VALID_PHASE.has(k)) throw new Error(`${l.id}: phaseWeights.${k} fase inválida`);
    const v = l.phaseWeights[k];
    if (typeof v !== 'number' || v < 0 || v > 1) {
      throw new Error(`${l.id}: phaseWeights.${k} deve ser 0..1`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.001) {
    throw new Error(`${l.id}: phaseWeights deve somar 1.0 (somou ${sum.toFixed(3)})`);
  }

  if (!Array.isArray(l.requiredSignals) || l.requiredSignals.length === 0) {
    throw new Error(`${l.id}: requiredSignals deve ter ao menos 1`);
  }
  for (const s of l.requiredSignals) {
    if (!VALID_SIGNAL.has(s)) throw new Error(`${l.id}: requiredSignal desconhecido: ${s}`);
  }
  if (l.optionalSignals != null) {
    if (!Array.isArray(l.optionalSignals)) {
      throw new Error(`${l.id}: optionalSignals deve ser array`);
    }
    for (const s of l.optionalSignals) {
      if (!VALID_SIGNAL.has(s)) throw new Error(`${l.id}: optionalSignal desconhecido: ${s}`);
    }
  }

  if (!Array.isArray(l.applicableCornerTypes) || l.applicableCornerTypes.length === 0) {
    throw new Error(`${l.id}: applicableCornerTypes deve ter ao menos 1`);
  }
  for (const t of l.applicableCornerTypes) {
    if (!VALID_CORNER.has(t)) throw new Error(`${l.id}: cornerType inválido: ${t}`);
  }

  if (!Array.isArray(l.preferredMessageCodes) || l.preferredMessageCodes.length === 0) {
    throw new Error(`${l.id}: preferredMessageCodes deve ter ao menos 1`);
  }
  for (const c of l.preferredMessageCodes) {
    if (typeof c !== 'string' || !/^M[0-9]{3}$/.test(c)) {
      throw new Error(`${l.id}: messageCode inválido: ${c} (esperado M###)`);
    }
  }

  if (!l.successCriteria || typeof l.successCriteria !== 'object') {
    throw new Error(`${l.id}: successCriteria obrigatório`);
  }
  if (!l.successCriteria.metric || typeof l.successCriteria.metric !== 'string') {
    throw new Error(`${l.id}: successCriteria.metric obrigatório`);
  }
  if (l.successCriteria.confidence != null && !VALID_CONFID.has(l.successCriteria.confidence)) {
    throw new Error(`${l.id}: successCriteria.confidence inválido`);
  }

  if (typeof l.active !== 'boolean') throw new Error(`${l.id}: active deve ser boolean`);
  return true;
}

/**
 * Verifica se a lição pode ativar dado um conjunto de sinais
 * disponíveis no snapshot atual. Retorna true se TODOS os
 * requiredSignals estão presentes.
 *
 * @param {object} lesson
 * @param {Set<string>|string[]} availableSignals
 * @returns {boolean}
 */
export function canActivate(lesson, availableSignals) {
  const set = availableSignals instanceof Set ? availableSignals : new Set(availableSignals);
  for (const s of lesson.requiredSignals) {
    if (!set.has(s)) return false;
  }
  return true;
}
