// Smoke do P1Coach — Biblioteca de Lições, gating de sinais,
// cooldown, foco de fase, blacklist (não pode aparecer Brake Bias etc).

import { LESSON_LIBRARY, LESSONS_MVP, LESSONS_PHASE_2, getLesson, activeLessons }
  from '../src/data/lesson-library.js';
import { CoachPhrases, CoachPhrasesSet, getPhrase } from '../src/data/coach-phrases.js';
import { P1Coach } from '../src/domain/p1-coach.js';
import { Phase, Confidence, validateLesson, canActivate, Signal }
  from '../src/domain/lesson-schema.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Helpers
const ALL_MVP_SIGNALS = new Set([
  Signal.KMH, Signal.LAT, Signal.LNG, Signal.COURSE, Signal.HEADING,
  Signal.ACC_LONG, Signal.ACC_LAT, Signal.GYRO_YAW,
  Signal.PHASE, Signal.V_ENTRADA, Signal.V_MIN, Signal.V_SAIDA,
  Signal.APEX_T, Signal.APEX_KMH, Signal.TRAJETORIA,
]);

const SLOW_CORNER = { id: 'seg-1', ehTrecho: true, cornerType: 'lenta' };
const FAST_CORNER = { id: 'seg-2', ehTrecho: true, cornerType: 'rapida' };
const STRAIGHT    = { id: 'seg-r', ehTrecho: false, cornerType: null };

// ─── Biblioteca / schema ─────────────────────────────────────
t('LESSON_LIBRARY tem 12 lições (7 MVP + 5 Fase 2)', () => {
  if (LESSON_LIBRARY.length !== 12) throw new Error(`esperava 12, veio ${LESSON_LIBRARY.length}`);
  if (LESSONS_MVP.length !== 7) throw new Error(`MVP esperava 7, veio ${LESSONS_MVP.length}`);
  if (LESSONS_PHASE_2.length !== 5) throw new Error(`Fase 2 esperava 5, veio ${LESSONS_PHASE_2.length}`);
});

t('Todas as 7 lições MVP estão active=true; Fase 2 inativas', () => {
  for (const l of LESSONS_MVP) if (!l.active) throw new Error(`${l.id} deveria estar ativa`);
  for (const l of LESSONS_PHASE_2) if (l.active) throw new Error(`${l.id} deveria estar inativa`);
});

t('Todas as lições passam validateLesson', () => {
  for (const l of LESSON_LIBRARY) validateLesson(l);
});

t('phaseWeights de cada lição soma 1.0', () => {
  for (const l of LESSON_LIBRARY) {
    const sum = Object.values(l.phaseWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.001) throw new Error(`${l.id} soma ${sum}`);
  }
});

// ─── BLACKLIST — temas proibidos não podem ter virado lição ──
t('Não há lição sobre temas excluídos (brake bias, FFB, slipstream, etc)', () => {
  const banned = [
    'brake bias', 'brake-bias', 'drag braking', 'engine braking',
    'ffb', 'diferencial', 'aerodinâmica', 'aerodinamica',
    'pressão psi', 'pressao psi', 'side draft', 'vortex',
    'defesa', 'manobra fake', 'slipstream', 'volta 1', 'sobrevivência',
  ];
  for (const l of LESSON_LIBRARY) {
    const hay = (l.title + ' ' + l.shortDescription + ' ' + l.objective).toLowerCase();
    for (const b of banned) {
      if (hay.includes(b)) throw new Error(`${l.id}: contém termo banido "${b}"`);
    }
  }
});

t('Lições MVP esperadas estão presentes pelos títulos', () => {
  const expected = [
    'Referência Fixa', 'V-Min', 'Transição Freio-Acelerador',
    'Acelerador Progressivo', 'Linha de Visão',
    'Controle de Subesterço', 'Curva Cega',
  ];
  for (const e of expected) {
    if (!LESSONS_MVP.find(l => l.title === e)) throw new Error(`falta lição MVP "${e}"`);
  }
});

t('Lições Fase 2 esperadas estão presentes', () => {
  const expected = [
    'Volante Contínuo', 'Círculo de Grip', 'Pneu Arrastando',
    'Controle de Sobresterço', 'Uso Seguro de Zebra',
  ];
  for (const e of expected) {
    if (!LESSONS_PHASE_2.find(l => l.title === e)) throw new Error(`falta lição Fase 2 "${e}"`);
  }
});

// ─── Coach phrases — todas com 2..3 palavras ────────────────
t('CoachPhrases: cada frase tem 2..3 palavras', () => {
  for (const [code, frase] of Object.entries(CoachPhrases)) {
    const n = String(frase).trim().split(/\s+/).filter(Boolean).length;
    if (n < 2 || n > 3) throw new Error(`${code} "${frase}" tem ${n} palavras`);
  }
});

t('Cada preferredMessageCode da biblioteca existe no catálogo', () => {
  for (const l of LESSON_LIBRARY) {
    for (const c of l.preferredMessageCodes) {
      if (!getPhrase(c)) throw new Error(`${l.id}: código ${c} sem frase`);
    }
  }
});

// ─── Gating por sinais ──────────────────────────────────────
t('canActivate: V-Min ativa só com [kmh, velMinima, phase]', () => {
  const l = getLesson('L002-v-min');
  if (canActivate(l, new Set(['kmh']))) throw new Error('ativou sem velMinima/phase');
  if (!canActivate(l, new Set(['kmh', 'velMinima', 'phase']))) {
    throw new Error('deveria ativar com sinais completos');
  }
});

t('Fase 2 (Volante Contínuo) NÃO pode ativar sem steering.angle', () => {
  const l = getLesson('L101-volante-continuo');
  if (canActivate(l, ALL_MVP_SIGNALS)) {
    throw new Error('ativou sem steering — bug de gating');
  }
  const withSteer = new Set([...ALL_MVP_SIGNALS, 'steering.angle']);
  if (!canActivate(l, withSteer)) throw new Error('não ativou mesmo com steering');
});

// ─── Engine: emissão, foco de fase, cooldown ────────────────
t('P1Coach emite mensagem quando piloto pede foco SAIDA em curva lenta', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusPhase: Phase.SAIDA });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({
    faseCurva: 'fim',
    snapshot: { t: 1000, tMono: 1000 },
    signals: ALL_MVP_SIGNALS,
  });
  if (out.length !== 1) throw new Error(`esperava 1 mensagem, veio ${out.length}`);
  const msg = out[0];
  if (msg.phase !== Phase.SAIDA) throw new Error('phase errada');
  if (!CoachPhrasesSet.has(msg.text)) throw new Error('texto fora do catálogo');
});

t('P1Coach NÃO emite em fase fora do foco do piloto', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusPhase: Phase.SAIDA });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({
    faseCurva: 'inicio',
    snapshot: { t: 1000, tMono: 1000 },
    signals: ALL_MVP_SIGNALS,
  });
  if (out.length !== 0) throw new Error(`esperava 0, veio ${out.length}`);
});

t('P1Coach respeita maxPerCorner=1', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0, maxPerCorner: 1 });
  c.startLearningSession({ focusPhase: Phase.SAIDA });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'fim', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  c.consume({ faseCurva: 'fim', snapshot: { t: 200, tMono: 200 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 1) throw new Error(`esperava 1, veio ${out.length}`);
});

t('P1Coach respeita cooldown entre cantos diferentes', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 5000 });
  c.startLearningSession({ focusPhase: Phase.SAIDA });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'fim', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  c.onSegmentExit();
  c.onSegmentEnter({ id: 'seg-1b', ehTrecho: true, cornerType: 'lenta' }, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'fim', snapshot: { t: 200, tMono: 200 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 1) throw new Error(`cooldown falhou: ${out.length}`);
});

t('P1Coach ignora retas (ehTrecho=false)', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({});
  c.onSegmentEnter(STRAIGHT, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'meio', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 0) throw new Error(`reta emitiu mensagem`);
});

t('P1Coach: pause() suspende emissão; resume() retoma', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusPhase: Phase.APEX });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.pause();
  c.consume({ faseCurva: 'meio', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 0) throw new Error('pause não funcionou');
  c.resume();
  c.consume({ faseCurva: 'meio', snapshot: { t: 200, tMono: 200 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 1) throw new Error('resume não funcionou');
});

t('P1Coach: focusLessonId trava na lição mesmo com outras elegíveis', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusLessonId: 'L002-v-min', focusPhase: Phase.APEX });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'meio', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 1) throw new Error(`não emitiu`);
  if (out[0].lessonId !== 'L002-v-min') throw new Error(`travamento falhou: ${out[0].lessonId}`);
});

t('P1Coach NÃO ativa se piloto não iniciou learningSession', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.onSegmentEnter(SLOW_CORNER, ALL_MVP_SIGNALS);
  c.consume({ faseCurva: 'meio', snapshot: { t: 100, tMono: 100 }, signals: ALL_MVP_SIGNALS });
  if (out.length !== 0) throw new Error('emitiu sem sessão de aprendizado');
});

t('P1Coach: lição BAIXA confidence só emite se piloto picked focus', () => {
  // L005 (Linha de Visão) é BAIXA. Sem userPicked, deve sumir do pool.
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({}); // sem foco
  // Constrói cenário onde L005 seria a única candidata: rápida + só sinais
  // de visão. Como temos todos os sinais, outras lições altas vencem.
  // Aqui só asseguramos que NÃO sai mensagem de L005 sem foco do piloto:
  c.onSegmentEnter(FAST_CORNER, new Set(['heading', 'gyroAlpha', 'phase']));
  c.consume({ faseCurva: 'inicio', snapshot: { t: 100, tMono: 100 }, signals: new Set(['heading', 'gyroAlpha', 'phase']) });
  // Pool ficou vazio (L005 BAIXA bloqueada sem userPick) — nenhuma mensagem.
  if (out.length !== 0) throw new Error('emitiu BAIXA sem userPick');
});

t('P1Coach: lição BAIXA emite quando piloto fixa focus', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusLessonId: 'L005-linha-de-visao', focusPhase: Phase.ENTRADA });
  c.onSegmentEnter(FAST_CORNER, new Set(['heading', 'gyroAlpha', 'phase']));
  c.consume({
    faseCurva: 'inicio',
    snapshot: { t: 100, tMono: 100 },
    signals: new Set(['heading', 'gyroAlpha', 'phase']),
  });
  if (out.length !== 1) throw new Error(`focusLessonId BAIXA não emitiu`);
  if (out[0].confidence !== Confidence.BAIXA) throw new Error('confidence errada');
});

// ─── signalsFromSnapshot ───────────────────────────────────
t('signalsFromSnapshot deriva sinais corretamente', () => {
  const set = P1Coach.signalsFromSnapshot(
    { kmh: 80, lat: 1, lng: 2, accLong: 0.3, gyroAlpha: 5 },
    { velMinima: 70, apexT: 1234 }
  );
  for (const need of ['kmh', 'lat', 'lng', 'accLong', 'gyroAlpha', 'phase', 'velMinima', 'apexT']) {
    if (!set.has(need)) throw new Error(`faltou ${need}`);
  }
});

// ─── AUDITORIA: requiredSignals devem ser produzíveis pelo pipeline ────
// Cada lição active=true tem que conseguir ativar com o snapshot real
// emitido por mobile-telemetry.js + faseStats de fase-curva.js.
const SNAPSHOT_REAL_IPHONE = {
  // Campos do mobile-telemetry.js _buildSample
  t: 1000, tMono: 1000, source: 'cockpit-mobile', signalQuality: 'GOOD',
  lat: -15.78, lng: -47.92, kmh: 90, course: 180, acc: 5,
  accX: 0.1, accY: -0.4, accZ: 9.8,
  accLong: -0.4, accLat: 0.1,                      // derivados que o caller calcula
  gyroAlpha: 12, gyroBeta: 0.5, gyroGamma: 0.3,
  heading: 178,
};
const FASE_STATS_REAL = {
  velEntrada: 110, velMinima: 65, velSaida: 95,
  apexT: 1234, apexKmh: 65, apexIdx: 42,
};

t('AUDIT: signalsFromSnapshot com snapshot real do iPhone produz sinais MVP', () => {
  const signals = P1Coach.signalsFromSnapshot(SNAPSHOT_REAL_IPHONE, FASE_STATS_REAL);
  const expected = [
    'kmh', 'lat', 'lng', 'course', 'heading',
    'accLong', 'accLat', 'gyroAlpha',
    'phase', 'velEntrada', 'velMinima', 'velSaida', 'apexT', 'apexKmh',
  ];
  for (const need of expected) {
    if (!signals.has(need)) throw new Error(`pipeline real não produz: ${need}`);
  }
});

t('AUDIT: TODAS as 7 lições MVP ativam com snapshot real iPhone (sem T4000)', () => {
  const signals = P1Coach.signalsFromSnapshot(SNAPSHOT_REAL_IPHONE, FASE_STATS_REAL);
  const naoAtiva = [];
  for (const lesson of LESSONS_MVP) {
    if (!canActivate(lesson, signals)) naoAtiva.push(lesson.id);
  }
  if (naoAtiva.length > 0) {
    throw new Error(`lições MVP que NÃO ativam com pipeline real: ${naoAtiva.join(', ')}`);
  }
});

t('AUDIT: lições Fase 2 que dependem de sensor único realmente ativam só com sensor', () => {
  // L101/L103/L104 declaram steering ou slip — esses não chegam no iPhone.
  // L102 (círculo de grip) e L105 (zebra) têm requiredSignals que o iPhone
  // produz; o bloqueio efetivo delas vem de `active: false` (roadmap), não
  // de gating de sinais. Esse teste documenta a separação.
  const signals = P1Coach.signalsFromSnapshot(SNAPSHOT_REAL_IPHONE, FASE_STATS_REAL);
  const sensorOnly = ['L101-volante-continuo', 'L103-pneu-arrastando', 'L104-controle-sobresterco'];
  for (const id of sensorOnly) {
    const l = LESSONS_PHASE_2.find(x => x.id === id);
    if (canActivate(l, signals)) throw new Error(`${id} ativou sem sensor extra`);
  }
});

t('AUDIT: activeLessons() não retorna nenhuma Fase 2 (gating duro de roadmap)', () => {
  // Mesmo que sinais bastem, Fase 2 fica fora do pool até `active: true`.
  const phase2Ids = new Set(LESSONS_PHASE_2.map(l => l.id));
  for (const l of activeLessons()) {
    if (phase2Ids.has(l.id)) throw new Error(`Fase 2 ${l.id} apareceu em activeLessons`);
  }
});

// ─── E2E: stint sintético com 3 voltas, foco saída em curva lenta ──
t('E2E: piloto roda 3 voltas em modo aprendizado e recebe ≤ 1 msg por curva', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusPhase: Phase.SAIDA });

  const SLOW = { id: 'curva-1', ehTrecho: true, cornerType: 'lenta' };
  const FAST = { id: 'curva-2', ehTrecho: true, cornerType: 'rapida' };
  const RETA = { id: 'reta-1', ehTrecho: false };

  for (let lap = 0; lap < 3; lap++) {
    const baseT = lap * 100000;
    const sigSlow = P1Coach.signalsFromSnapshot(SNAPSHOT_REAL_IPHONE, FASE_STATS_REAL);

    // curva 1 — lenta
    c.onSegmentEnter(SLOW, sigSlow);
    c.consume({ faseCurva: 'inicio', snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: baseT + 100 }, signals: sigSlow });
    c.consume({ faseCurva: 'meio',   snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: baseT + 500 }, signals: sigSlow });
    c.consume({ faseCurva: 'fim',    snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: baseT + 900 }, signals: sigSlow });
    c.onSegmentExit();

    // reta — não emite
    c.onSegmentEnter(RETA, sigSlow);
    c.consume({ faseCurva: 'meio', snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: baseT + 1500 }, signals: sigSlow });
    c.onSegmentExit();

    // curva 2 — rápida
    c.onSegmentEnter(FAST, sigSlow);
    c.consume({ faseCurva: 'fim', snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: baseT + 2500 }, signals: sigSlow });
    c.onSegmentExit();

    c.onLapEnd();
  }

  // 3 voltas × 2 curvas válidas × max 1 msg = ≤ 6 mensagens; foco SAIDA
  if (out.length === 0) throw new Error('coach silencioso em 3 voltas');
  if (out.length > 6) throw new Error(`${out.length} > 6 mensagens (passou maxPerCorner)`);
  for (const m of out) {
    if (m.phase !== Phase.SAIDA) throw new Error(`fase ${m.phase} fora do foco`);
    if (!CoachPhrasesSet.has(m.text)) throw new Error(`frase fora do catálogo: ${m.text}`);
  }
  if (c.learningSession.laps !== 3) throw new Error(`laps=${c.learningSession.laps}`);
});

t('E2E: focusLessonId="L002-v-min" durante 1 volta gera mensagens só de V-Min', () => {
  const out = [];
  const c = new P1Coach({ onMessage: m => out.push(m), cooldownMs: 0 });
  c.startLearningSession({ focusLessonId: 'L002-v-min', focusPhase: Phase.APEX });
  const sig = P1Coach.signalsFromSnapshot(SNAPSHOT_REAL_IPHONE, FASE_STATS_REAL);

  for (const corner of [{ id: 'c1', ehTrecho: true, cornerType: 'lenta' },
                        { id: 'c2', ehTrecho: true, cornerType: 'media' },
                        { id: 'c3', ehTrecho: true, cornerType: 'rapida' }]) {
    c.onSegmentEnter(corner, sig);
    c.consume({ faseCurva: 'meio', snapshot: { ...SNAPSHOT_REAL_IPHONE, tMono: out.length * 1000 }, signals: sig });
    c.onSegmentExit();
  }

  // V-Min só aplica a lenta+media — em rápida o coach deveria ignorar
  if (out.length !== 2) throw new Error(`esperava 2 (lenta+media), veio ${out.length}`);
  for (const m of out) {
    if (m.lessonId !== 'L002-v-min') throw new Error(`saiu ${m.lessonId} em vez de V-Min`);
  }
});

// ─── Resumo ─────────────────────────────────────────────────
console.log(`\n═══ TOTAL: ${ok} ok / ${fail} fail ═══`);
if (fail > 0) process.exit(1);
