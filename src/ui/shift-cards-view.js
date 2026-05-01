// shift-cards-view — renderiza os cards pós-sessão de troca de marcha.
// Usa o mesmo HTML do mockup `_design-reference/mockup-shift-cards.html`.
//
// Convenção:
//   - Cards aparecem APENAS quando session.status === 'finished'.
//   - Função pura `buildShiftCardHTML(event, car, ...)` para testes sem DOM.
//   - `renderShiftCards(deps)` injeta no DOM (uso real).

import { analyzeEvent } from '../domain/shift-analysis.js';
import { listEventsBySession } from '../data/shift-events.js';

const STATUS_LABEL = {
  correct: 'Verde',
  early: 'Cedo',
  late: 'Tarde',
  insufficient_data: 'Sem dados'
};

const MODE_LABEL = {
  DYNO_CALIBRATED: 'Dyno-Calibrated',
  TELEMETRY_LEARNED: 'Telemetry-Learned',
  SAFE_MODE: 'Safe-Mode'
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRpm(v) {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('pt-BR').replace(/\./g, ' ');
}

function formatDelta(v) {
  if (!Number.isFinite(v)) return '—';
  const r = Math.round(v);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r);
}

function gearTitle(event) {
  const g1 = event.gear_before;
  const g2 = event.gear_after;
  if (Number.isFinite(g1) && Number.isFinite(g2)) return `Troca ${g1}→${g2}`;
  return 'Troca ?→?';
}

function highlightTrecho(text, trechoName) {
  if (!trechoName) return escapeHtml(text);
  const safe = escapeHtml(text);
  const safeTrecho = escapeHtml(trechoName);
  return safe.replace(safeTrecho, `<strong>${safeTrecho}</strong>`);
}

// buildShiftCardHTML(event, car, trechoNameLookup) → string HTML de um card
export function buildShiftCardHTML(event, car, trechoNameLookup = null) {
  const { classification, lessonText } = analyzeEvent(event, car, trechoNameLookup);
  const trechoName = (event.trecho_id && typeof trechoNameLookup === 'function')
    ? (trechoNameLookup(event.trecho_id) || null)
    : null;

  const cardClass =
    classification === 'correct' ? 'is-correct'
    : classification === 'early' ? 'is-early'
    : classification === 'late' ? 'is-late'
    : 'is-insufficient';

  const deltaClass =
    classification === 'correct' ? 'is-ok'
    : classification === 'insufficient_data' ? 'is-neutral'
    : 'is-bad';

  const subtitle = trechoName
    ? `· ${escapeHtml(trechoName)}`
    : (event.trecho_id ? `· trecho ${escapeHtml(event.trecho_id)}` : '· trecho não identificado');

  const conf = Number.isFinite(event.gear_confidence)
    ? Math.round(event.gear_confidence * 100) + '%'
    : '—';

  const modeLabel = MODE_LABEL[event.mode_used] || 'Safe-Mode';

  const overrev = event.overrev_flag === true
    ? `<span class="shift-card__foot__warn">Overrev</span>`
    : `<span>${modeLabel}</span>`;

  return `<article class="shift-card ${cardClass}">
    <div class="shift-card__head">
      <div class="shift-card__title">${escapeHtml(gearTitle(event))} <small>${subtitle}</small></div>
      <div class="shift-card__status ${cardClass}">${STATUS_LABEL[classification]}</div>
    </div>
    <div class="shift-card__nums">
      <div class="shift-card__num">
        <span class="shift-card__num__lbl">Ideal</span>
        <span class="shift-card__num__val${classification === 'insufficient_data' ? ' is-neutral' : ''}">${formatRpm(event.target_optimal_rpm)}</span>
      </div>
      <div class="shift-card__num">
        <span class="shift-card__num__lbl">Real</span>
        <span class="shift-card__num__val${classification === 'insufficient_data' ? ' is-neutral' : ''}">${formatRpm(event.rpm_at_shift)}</span>
      </div>
      <div class="shift-card__num">
        <span class="shift-card__num__lbl">Δ</span>
        <span class="shift-card__num__val ${deltaClass}">${formatDelta(event.delta_rpm)}</span>
      </div>
    </div>
    <p class="shift-card__lesson">${highlightTrecho(lessonText, trechoName)}</p>
    <div class="shift-card__foot">
      <span>Confiança ${conf}</span>
      ${overrev}
    </div>
  </article>`;
}

// buildShiftCardsListHTML — wrapper para múltiplos eventos
export function buildShiftCardsListHTML(events, car, trechoNameLookup = null) {
  if (!Array.isArray(events) || events.length === 0) {
    return '<div class="shift-cards-empty">Nenhuma troca registrada nesta sessão.</div>';
  }
  const cards = events.map(ev => buildShiftCardHTML(ev, car, trechoNameLookup)).join('');
  return `<div class="shift-cards">${cards}</div>`;
}

// renderShiftCards({ session, container, car, trechoNameLookup, eventsLoader })
// - Cards aparecem APENAS se session.status === 'finished'.
// - eventsLoader: opcional, override de listEventsBySession (testes/UI).
export async function renderShiftCards({ session, container, car, trechoNameLookup = null, eventsLoader = null } = {}) {
  if (!container || typeof container.innerHTML !== 'string') {
    throw new Error('renderShiftCards: container DOM obrigatório');
  }
  if (!session || session.status !== 'finished') {
    container.innerHTML = '';
    return { rendered: 0, reason: 'session not finished' };
  }
  const loader = eventsLoader || listEventsBySession;
  const events = await loader(session.id);
  container.innerHTML = buildShiftCardsListHTML(events, car, trechoNameLookup);
  return { rendered: Array.isArray(events) ? events.length : 0 };
}
