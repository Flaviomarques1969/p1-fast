// ═══════════════════════════════════════════════════════════
// P1 Track Learning — Biblioteca canônica de lições
// ═══════════════════════════════════════════════════════════
// 12 lições no total: 7 MVP (ativas) + 5 Fase 2 (inativas até sensores).
//
// FILTRO EXPLÍCITO (ajuste de base 2026-04-30):
// Fora da base — não entram nem como rascunho:
//   • Brake Bias Frontal/Traseiro       (ajuste mecânico)
//   • Drag Braking                       (racecraft agressivo)
//   • Engine Braking agressivo           (racecraft agressivo)
//   • Configuração FFB                   (setup)
//   • Ajuste de Diferencial              (ajuste mecânico)
//   • Aerodinâmica                       (setup)
//   • Pressão PSI no box                 (box, não cockpit)
//   • Side Drafting                      (racecraft agressivo)
//   • Vortex of Danger                   (racecraft agressivo)
//   • Defesa de Posição                  (racecraft agressivo)
//   • Manobra Fake                       (racecraft agressivo)
//   • Slipstream                          (racecraft agressivo)
//   • Sobrevivência na Volta 1           (racecraft agressivo)
//
// Apenas COMPORTAMENTO do piloto dentro do carro.
//
// Schema validado em src/domain/lesson-schema.js. Mensagens canônicas
// em src/data/coach-phrases.js (todas com ≤ 3 palavras).

import {
  LessonCategory,
  LessonLevel,
  Confidence,
  Phase,
  CornerType,
  Signal,
  validateLesson,
} from '../domain/lesson-schema.js';

// ─── MVP — 7 lições ativas ──────────────────────────────────
// Critério: requiredSignals viáveis com pipeline iPhone-only
// (mobile-telemetry.js + fase-curva.js + projector.js).

export const LESSONS_MVP = Object.freeze([

  {
    id: 'L001-referencia-fixa',
    title: 'Referência Fixa',
    category: LessonCategory.REFERENCIA,
    level: LessonLevel.INTRO,
    shortDescription: 'Frear, virar e acelerar sempre nos mesmos pontos.',
    objective: 'Reduzir variabilidade de pontos de freio, giro e tração entre voltas.',
    phaseWeights: { [Phase.ENTRADA]: 0.6, [Phase.APEX]: 0.2, [Phase.SAIDA]: 0.2 },
    requiredSignals: [Signal.LAT, Signal.LNG, Signal.KMH],
    optionalSignals: [Signal.ACC_LONG, Signal.TRAJETORIA],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M001', 'M002', 'M003'],
    successCriteria: {
      metric: 'desvio-ponto-freio < 8m em 3 de 4 voltas seguidas',
      confidence: Confidence.ALTA,
    },
    active: true,
  },

  {
    id: 'L002-v-min',
    title: 'V-Min',
    category: LessonCategory.VELOCIDADE,
    level: LessonLevel.INTRO,
    shortDescription: 'Manter velocidade mínima alta e consistente no apex.',
    objective: 'Elevar velMinima média e reduzir desvio entre voltas válidas.',
    phaseWeights: { [Phase.APEX]: 1.0 },
    requiredSignals: [Signal.KMH, Signal.V_MIN, Signal.PHASE],
    optionalSignals: [Signal.APEX_KMH],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA],
    preferredMessageCodes: ['M010', 'M011', 'M012'],
    successCriteria: {
      metric: 'velMinima média + desvio < 1.5km/h em 3 voltas',
      confidence: Confidence.ALTA,
    },
    active: true,
  },

  {
    id: 'L003-transicao-freio-acelerador',
    title: 'Transição Freio-Acelerador',
    category: LessonCategory.TRANSICAO,
    level: LessonLevel.PADRAO,
    shortDescription: 'Sem coast longo entre soltar freio e abrir acelerador.',
    objective: 'Minimizar janela de aceleração ≈ 0 entre apex e saída.',
    phaseWeights: { [Phase.ENTRADA]: 0.3, [Phase.APEX]: 0.4, [Phase.SAIDA]: 0.3 },
    requiredSignals: [Signal.ACC_LONG, Signal.KMH, Signal.PHASE],
    optionalSignals: [Signal.TPS],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M020', 'M021', 'M022'],
    successCriteria: {
      metric: 'janela coast (|accLong|<0.05g) < 250ms no MEIO',
      confidence: Confidence.MEDIA,
    },
    active: true,
  },

  {
    id: 'L004-acelerador-progressivo',
    title: 'Acelerador Progressivo',
    category: LessonCategory.TRANSICAO,
    level: LessonLevel.PADRAO,
    shortDescription: 'Abrir o gás suave, sem bate-bate na saída.',
    objective: 'Curva de accLong na saída crescente sem oscilação.',
    phaseWeights: { [Phase.SAIDA]: 1.0 },
    requiredSignals: [Signal.ACC_LONG, Signal.KMH, Signal.PHASE],
    optionalSignals: [Signal.TPS, Signal.RPM],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA],
    preferredMessageCodes: ['M030', 'M031', 'M032'],
    successCriteria: {
      metric: 'derivada de accLong na SAIDA com 0 reversões',
      confidence: Confidence.MEDIA,
    },
    active: true,
  },

  {
    id: 'L005-linha-de-visao',
    title: 'Linha de Visão',
    category: LessonCategory.VISAO,
    level: LessonLevel.INTRO,
    shortDescription: 'Olhar adiante, antecipar o apex e a saída.',
    objective: 'Reduzir correções tardias de heading dentro da curva.',
    phaseWeights: { [Phase.ENTRADA]: 0.7, [Phase.APEX]: 0.3 },
    requiredSignals: [Signal.HEADING, Signal.GYRO_YAW, Signal.PHASE],
    optionalSignals: [Signal.TRAJETORIA],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M040', 'M041', 'M042'],
    successCriteria: {
      metric: 'pico de gyroYaw após apex < 0.6× pico antes do apex',
      confidence: Confidence.BAIXA,
    },
    active: true,
  },

  {
    id: 'L006-controle-subesterco',
    title: 'Controle de Subesterço',
    category: LessonCategory.CONTROLE,
    level: LessonLevel.PADRAO,
    shortDescription: 'Carro empurra: aliviar e abrir, não insistir.',
    objective: 'Detectar entrada com aderência insuficiente e treinar a recuperação.',
    phaseWeights: { [Phase.APEX]: 0.5, [Phase.SAIDA]: 0.5 },
    requiredSignals: [Signal.ACC_LAT, Signal.KMH, Signal.GYRO_YAW, Signal.PHASE],
    optionalSignals: [Signal.STEERING],
    applicableCornerTypes: [CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M050', 'M051', 'M052'],
    successCriteria: {
      metric: 'accLat saturado + yaw abaixo do esperado para velocidade',
      confidence: Confidence.MEDIA,
    },
    active: true,
  },

  {
    id: 'L007-curva-cega',
    title: 'Curva Cega',
    category: LessonCategory.REFERENCIA,
    level: LessonLevel.PADRAO,
    shortDescription: 'Comprometer trajetória mesmo sem ver a saída.',
    objective: 'Manter ponto de freio e giro em curvas sem visibilidade total.',
    phaseWeights: { [Phase.ENTRADA]: 1.0 },
    requiredSignals: [Signal.LAT, Signal.LNG, Signal.KMH],
    optionalSignals: [Signal.HEADING, Signal.TRAJETORIA],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA],
    preferredMessageCodes: ['M060', 'M061', 'M062'],
    successCriteria: {
      metric: 'desvio entrada < 5m vs voltas-ref em curvas marcadas como cegas',
      confidence: Confidence.ALTA,
    },
    active: true,
  },
]);

// ─── Fase 2 — 5 lições inativas até sensores ────────────────
// Ativam quando os requiredSignals correspondentes começarem a chegar
// no snapshot canônico. Hoje ficam em `active: false`.

export const LESSONS_PHASE_2 = Object.freeze([

  {
    id: 'L101-volante-continuo',
    title: 'Volante Contínuo',
    category: LessonCategory.CONTROLE,
    level: LessonLevel.AVANCADO,
    shortDescription: 'Sem corrigir, sem rasgar — entrada em arco único.',
    objective: 'Reduzir reversões de ângulo de volante na entrada e apex.',
    phaseWeights: { [Phase.ENTRADA]: 0.5, [Phase.APEX]: 0.5 },
    requiredSignals: [Signal.STEERING, Signal.PHASE],
    optionalSignals: [Signal.GYRO_YAW],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M100', 'M101', 'M102'],
    successCriteria: {
      metric: 'reversões de sinal de dSteering/dt = 0 entre INICIO e MEIO',
      confidence: Confidence.ALTA,
    },
    active: false,
  },

  {
    id: 'L102-circulo-de-grip',
    title: 'Círculo de Grip',
    category: LessonCategory.CONTROLE,
    level: LessonLevel.AVANCADO,
    shortDescription: 'Somar lat e long sem perder o envelope.',
    objective: 'Treinar uso da reserva de aderência sem saturar lat ou long.',
    phaseWeights: { [Phase.ENTRADA]: 0.4, [Phase.APEX]: 0.3, [Phase.SAIDA]: 0.3 },
    requiredSignals: [Signal.ACC_LAT, Signal.ACC_LONG, Signal.PHASE],
    optionalSignals: [Signal.SLIP_RATIO],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M110', 'M111', 'M112'],
    successCriteria: {
      metric: 'sqrt(accLat² + accLong²) ≤ envelope sem saturar eixo isolado',
      confidence: Confidence.MEDIA,
    },
    active: false,
  },

  {
    id: 'L103-pneu-arrastando',
    title: 'Pneu Arrastando',
    category: LessonCategory.SUPERFICIE,
    level: LessonLevel.AVANCADO,
    shortDescription: 'Entrar travado/derrapando custa mais que parece.',
    objective: 'Detectar e reduzir slip de entrada sob frenagem.',
    phaseWeights: { [Phase.ENTRADA]: 1.0 },
    requiredSignals: [Signal.SLIP_RATIO, Signal.KMH, Signal.PHASE],
    optionalSignals: [Signal.BRAKE_PRESS],
    applicableCornerTypes: [CornerType.LENTA, CornerType.MEDIA],
    preferredMessageCodes: ['M120', 'M121', 'M122'],
    successCriteria: {
      metric: 'slip > limiar por menos de 200ms na frenagem',
      confidence: Confidence.BAIXA,
    },
    active: false,
  },

  {
    id: 'L104-controle-sobresterco',
    title: 'Controle de Sobresterço',
    category: LessonCategory.CONTROLE,
    level: LessonLevel.AVANCADO,
    shortDescription: 'Saída solta na traseira — antecipar a correção.',
    objective: 'Reduzir tempo entre início do escorregamento e correção do volante.',
    phaseWeights: { [Phase.APEX]: 0.3, [Phase.SAIDA]: 0.7 },
    requiredSignals: [Signal.GYRO_YAW, Signal.ACC_LAT, Signal.STEERING, Signal.PHASE],
    optionalSignals: [Signal.TPS],
    applicableCornerTypes: [CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M130', 'M131', 'M132'],
    successCriteria: {
      metric: 'latência yaw→correção volante < 250ms',
      confidence: Confidence.MEDIA,
    },
    active: false,
  },

  {
    id: 'L105-uso-seguro-zebra',
    title: 'Uso Seguro de Zebra',
    category: LessonCategory.SUPERFICIE,
    level: LessonLevel.AVANCADO,
    shortDescription: 'Pisar na zebra sem desestabilizar o carro.',
    objective: 'Identificar quando a zebra ajuda e quando rouba aderência.',
    phaseWeights: { [Phase.APEX]: 0.6, [Phase.SAIDA]: 0.4 },
    requiredSignals: [Signal.LAT, Signal.LNG, Signal.ACC_LAT, Signal.GYRO_YAW],
    optionalSignals: [Signal.KMH],
    applicableCornerTypes: [CornerType.MEDIA, CornerType.RAPIDA],
    preferredMessageCodes: ['M140', 'M141', 'M142'],
    successCriteria: {
      metric: 'pulso vertical sem perda lateral > 3% no MEIO/FIM',
      confidence: Confidence.MEDIA,
    },
    active: false,
  },
]);

/** União completa, validada na carga. */
export const LESSON_LIBRARY = Object.freeze([...LESSONS_MVP, ...LESSONS_PHASE_2]);

// Validação eager: qualquer lição malformada quebra na carga
// — preferimos falhar agora a deixar o engine ativar lição quebrada.
for (const l of LESSON_LIBRARY) validateLesson(l);

const BY_ID = new Map(LESSON_LIBRARY.map(l => [l.id, l]));

export function getLesson(id) { return BY_ID.get(id) || null; }
export function activeLessons() { return LESSON_LIBRARY.filter(l => l.active); }
export function lessonsByCategory(cat) { return LESSON_LIBRARY.filter(l => l.category === cat); }
export function lessonsForCornerType(ct) {
  return LESSON_LIBRARY.filter(l => l.applicableCornerTypes.includes(ct));
}
