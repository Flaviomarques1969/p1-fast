// ═══════════════════════════════════════════════════════════
// escape — sanitização HTML (T-026 / ADR-016)
// ═══════════════════════════════════════════════════════════
// REGRA: toda interpolação em innerHTML DEVE passar por esc() ou usar
// DOM API (textContent, createElement). Sem esc, dado de usuário pode
// virar script injetado.
//
// Atributos: se o valor cai dentro de "..." do HTML, esc() é suficiente
// (escapa ' e "). Se cai dentro de `onclick="fn('${x}')"`, PREFERIR
// data-attribute + delegação de evento.

const MAP = Object.freeze({
  '&':  '&amp;',
  '<':  '&lt;',
  '>':  '&gt;',
  '"':  '&quot;',
  "'":  '&#39;',
});

/**
 * Escapa caracteres especiais de HTML. Seguro para inserir em innerHTML.
 * Usa String() pra lidar com null/undefined/number/boolean sem explodir.
 *
 * @param {*} s  valor qualquer; será coerced pra string
 * @returns {string}  escapado
 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
}

/**
 * Atalho para escapar + envolver em uma tag atômica (ex: <span>).
 */
export function escSpan(s, cls = '') {
  const c = cls ? ` class="${esc(cls)}"` : '';
  return `<span${c}>${esc(s)}</span>`;
}
