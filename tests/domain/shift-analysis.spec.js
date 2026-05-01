// Smoke spec: shift-analysis (classifyEvent + buildLessonText + analyzeEvent)
// + shift-cards-view (HTML pure builders + renderShiftCards stub)

import { classifyEvent, buildLessonText, analyzeEvent } from '../../src/domain/shift-analysis.js';
import { buildShiftCardHTML, buildShiftCardsListHTML, renderShiftCards } from '../../src/ui/shift-cards-view.js';

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const car = Object.freeze({
  id: 'car-1', redline_rpm: 7000, safety_margin_rpm: 300, tolerance_rpm: 150
});

function makeEvent(overrides = {}) {
  return {
    piloto_id: 'p1', carro_id: 'car-1', sessao_id: 's1',
    volta_id: null, trecho_id: null,
    timestamp: 1000,
    rpm_before: 6500, rpm_at_shift: 6700, rpm_after: 4800,
    speed_kmh: 140, tps: 95,
    gear_before: 3, gear_after: 4,
    gear_confidence: 0.9,
    accel_long_before: 1.5, accel_long_during: 0.5, accel_long_after: 1.2,
    target_optimal_rpm: 6700, target_visual_rpm: 6700, delta_rpm: 0,
    status: 'green', mode_used: 'TELEMETRY_LEARNED',
    overrev_flag: false, data_inconsistent_flag: false,
    lesson_text: null,
    ...overrides
  };
}

// ─── classifyEvent ──────────────────────────────────────────────────────

t('classifyEvent: |delta| <= tolerance → correct', () => {
  assert(classifyEvent(makeEvent({ delta_rpm: 0 }), car) === 'correct');
  assert(classifyEvent(makeEvent({ delta_rpm: 150 }), car) === 'correct');
  assert(classifyEvent(makeEvent({ delta_rpm: -150 }), car) === 'correct');
});

t('classifyEvent: delta < -tolerance → early', () => {
  assert(classifyEvent(makeEvent({ delta_rpm: -300, rpm_at_shift: 6400, target_optimal_rpm: 6700 }), car) === 'early');
});

t('classifyEvent: delta > tolerance → late', () => {
  assert(classifyEvent(makeEvent({ delta_rpm: 300, rpm_at_shift: 7000, target_optimal_rpm: 6700 }), car) === 'late');
});

t('classifyEvent: gear_confidence < 0.7 → insufficient_data', () => {
  assert(classifyEvent(makeEvent({ gear_confidence: 0.5 }), car) === 'insufficient_data');
});

t('classifyEvent: data_inconsistent_flag true → insufficient_data', () => {
  assert(classifyEvent(makeEvent({ data_inconsistent_flag: true }), car) === 'insufficient_data');
});

t('classifyEvent: target_optimal_rpm null → insufficient_data', () => {
  assert(classifyEvent(makeEvent({ target_optimal_rpm: null, delta_rpm: null }), car) === 'insufficient_data');
});

t('classifyEvent: usa tolerance_rpm do carro (não default)', () => {
  const tightCar = { ...car, tolerance_rpm: 80 };
  assert(classifyEvent(makeEvent({ delta_rpm: 100 }), tightCar) === 'late', 'com tolerância 80, delta 100 deveria ser late');
  assert(classifyEvent(makeEvent({ delta_rpm: 100 }), car) === 'correct', 'com tolerância 150, delta 100 deveria ser correct');
});

// ─── buildLessonText ────────────────────────────────────────────────────

t('buildLessonText correct: frase fixa, sem trecho', () => {
  const text = buildLessonText(makeEvent(), 'correct', null);
  assert(text.includes('Boa troca'), 'frase correct esperada, foi: ' + text);
  assert(!text.includes('<TRECHO>'), 'placeholder não deveria sobrar');
});

t('buildLessonText early com trecho → frase contém nome do trecho', () => {
  const text = buildLessonText(makeEvent(), 'early', 'Saída curva 4');
  assert(text.includes('Saída curva 4'), 'frase deveria conter trecho: ' + text);
  assert(!text.includes('<TRECHO>'));
});

t('buildLessonText early sem trecho → frase coerente sem placeholder', () => {
  const text = buildLessonText(makeEvent(), 'early', null);
  assert(!text.includes('<TRECHO>'), 'placeholder não pode aparecer: ' + text);
  assert(text.includes('cedo'), 'palavra-chave esperada');
});

t('buildLessonText late com trecho → frase contém nome', () => {
  const text = buildLessonText(makeEvent(), 'late', 'Reta dos boxes');
  assert(text.includes('Reta dos boxes'));
});

t('buildLessonText insufficient_data → frase fixa', () => {
  const text = buildLessonText(makeEvent(), 'insufficient_data', null);
  assert(text.includes('pouca confiança'));
});

// ─── analyzeEvent ────────────────────────────────────────────────────────

t('analyzeEvent integra classify + lesson com lookup de trecho', () => {
  const ev = makeEvent({ delta_rpm: -300, rpm_at_shift: 6400, trecho_id: 't-saida-4' });
  const res = analyzeEvent(ev, car, (id) => id === 't-saida-4' ? 'Saída curva 4' : null);
  assert(res.classification === 'early');
  assert(res.lessonText.includes('Saída curva 4'));
});

t('analyzeEvent: lookup que lança → lessonText sem trecho', () => {
  const ev = makeEvent({ delta_rpm: -300, trecho_id: 't-x' });
  const res = analyzeEvent(ev, car, () => { throw new Error('boom'); });
  assert(res.classification === 'early');
  assert(!res.lessonText.includes('<TRECHO>'));
});

// ─── HTML view (puras) ───────────────────────────────────────────────────

t('buildShiftCardHTML: card correct verde, contém RPMs e frase', () => {
  const html = buildShiftCardHTML(makeEvent({ delta_rpm: 0 }), car);
  assert(html.includes('is-correct'), 'classe is-correct esperada');
  assert(html.includes('Verde'), 'label Verde esperado');
  assert(html.includes('6 700') || html.includes('6700'), 'RPM esperado');
  assert(html.includes('Boa troca'), 'lesson esperada');
});

t('buildShiftCardHTML: early com trecho destaca <strong>', () => {
  const ev = makeEvent({ delta_rpm: -300, trecho_id: 't-x' });
  const html = buildShiftCardHTML(ev, car, () => 'Saída curva 4');
  assert(html.includes('is-early'), 'classe is-early esperada');
  assert(html.includes('<strong>Saída curva 4</strong>'), 'trecho deveria estar em strong');
});

t('buildShiftCardHTML: insufficient_data → cinza, sem cor de delta', () => {
  const ev = makeEvent({ gear_confidence: 0.4, delta_rpm: 0 });
  const html = buildShiftCardHTML(ev, car);
  assert(html.includes('is-insufficient'), 'classe is-insufficient esperada');
  assert(html.includes('Sem dados'));
});

t('buildShiftCardHTML: overrev_flag true mostra "Overrev" no foot', () => {
  const ev = makeEvent({ delta_rpm: 350, rpm_at_shift: 7100, target_optimal_rpm: 6700, overrev_flag: true });
  const html = buildShiftCardHTML(ev, car);
  assert(html.includes('Overrev'), 'rótulo Overrev esperado');
});

t('buildShiftCardHTML escapa HTML em IDs/strings hostis', () => {
  const ev = makeEvent({ trecho_id: '<script>x</script>' });
  const html = buildShiftCardHTML(ev, car);
  assert(!html.includes('<script>'), 'HTML cru não deveria aparecer');
  assert(html.includes('&lt;script&gt;'), 'deveria estar escapado');
});

t('buildShiftCardsListHTML: N eventos → N cards', () => {
  const evs = [makeEvent(), makeEvent({ timestamp: 2000 }), makeEvent({ timestamp: 3000 })];
  const html = buildShiftCardsListHTML(evs, car);
  const matches = (html.match(/class="shift-card /g) || []).length;
  assert(matches === 3, 'esperava 3 cards, foi ' + matches);
});

t('buildShiftCardsListHTML: lista vazia → mensagem amigável', () => {
  const html = buildShiftCardsListHTML([], car);
  assert(html.includes('Nenhuma troca'));
});

// ─── renderShiftCards (DOM) ──────────────────────────────────────────────

t('renderShiftCards: session != finished → não renderiza', async () => {
  const fakeContainer = { innerHTML: 'preexisting' };
  const r = await renderShiftCards({
    session: { id: 's1', status: 'live' }, container: fakeContainer, car
  });
  assert(r.rendered === 0);
  assert(fakeContainer.innerHTML === '', 'container deveria ser limpo');
});

t('renderShiftCards: session=finished → injeta cards via eventsLoader', async () => {
  const fakeContainer = { innerHTML: '' };
  const evs = [makeEvent(), makeEvent({ timestamp: 2000, delta_rpm: -300 })];
  const r = await renderShiftCards({
    session: { id: 's1', status: 'finished' },
    container: fakeContainer,
    car,
    eventsLoader: async () => evs
  });
  assert(r.rendered === 2, 'rendered: ' + r.rendered);
  assert(fakeContainer.innerHTML.includes('shift-card'), 'HTML deveria ter cards');
});

t('renderShiftCards: container ausente → erro explícito', async () => {
  let threw = false;
  try {
    await renderShiftCards({ session: { id: 's', status: 'finished' }, container: null, car });
  } catch { threw = true; }
  assert(threw, 'deveria lançar');
});

// ─── Runner ──────────────────────────────────────────────────────────────

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-analysis.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
