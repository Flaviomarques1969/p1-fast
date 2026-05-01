// shift-light-cockpit — controla a barra .shift-light do cockpit em runtime.
//
// Contrato:
//   - O HTML do cockpit (mockup-cockpit-piloto.html) já tem a estrutura
//     visual: `.shift-light` com 12 `.shift-light__dot[data-tier="1..6"]`
//     simétricos e `data-state="off|fire|overrev"`.
//   - Este módulo NÃO muda o HTML. Só atualiza atributos.
//
// API:
//   const sl = createCockpitShiftLight(element, { mode: 'assisted' | 'learning' });
//   sl.update({ rpm, visualRpm, optimalRpm, redline });
//   sl.setMode('assisted' | 'learning');
//
// Comportamento:
//   - rpm < startRpm → state="off", todos os tiers apagados
//   - rpm crescendo até visualRpm → tiers acendem progressivamente (1..5)
//   - rpm >= visualRpm em modo 'assisted' → state="fire" (300ms; volta sozinho)
//   - rpm > redline → state="overrev" (pisca enquanto persistir)
//   - modo 'learning' nunca dispara fire — só mostra a subida tier 1..5

const FIRE_MS = 300;
const TIERS = 6;

export function createCockpitShiftLight(element, { mode = 'assisted' } = {}) {
  if (!element || typeof element.querySelectorAll !== 'function') {
    throw new Error('createCockpitShiftLight: element DOM obrigatório');
  }
  const dots = Array.from(element.querySelectorAll('.shift-light__dot'));
  let currentMode = mode;
  let fireTimer = null;
  let lastFireRpm = -Infinity;

  function setState(state) {
    element.setAttribute('data-state', state);
  }

  function tierForProgress(p) {
    // p ∈ [0, 1) ; map para 0..5 acumulando dots de menor tier primeiro
    if (p < 0.2) return 0;
    if (p < 0.4) return 1;
    if (p < 0.6) return 2;
    if (p < 0.8) return 3;
    if (p < 0.95) return 4;
    return 5; // tier 5 cheio = quase no fire
  }

  function paint(activeTier) {
    for (const d of dots) {
      const t = Number(d.getAttribute('data-tier'));
      if (Number.isFinite(t) && t <= activeTier && t < TIERS) d.classList.add('is-on');
      else if (t === TIERS) {
        // tier 6 só acende em fire
        d.classList.remove('is-on');
      } else d.classList.remove('is-on');
    }
  }

  function fire() {
    setState('fire');
    for (const d of dots) {
      const t = Number(d.getAttribute('data-tier'));
      if (t === TIERS) d.classList.add('is-on');
    }
    if (fireTimer) clearTimeout(fireTimer);
    fireTimer = setTimeout(() => {
      setState('off');
      for (const d of dots) d.classList.remove('is-on');
      fireTimer = null;
    }, FIRE_MS);
  }

  function update({ rpm, visualRpm, optimalRpm, redline } = {}) {
    if (!Number.isFinite(rpm)) return;
    if (Number.isFinite(redline) && rpm > redline) {
      setState('overrev');
      paint(5);
      return;
    }
    // Janela visual: começa em ~70% do alvo (não pinta nada antes disso)
    const visTarget = Number.isFinite(visualRpm) ? visualRpm : optimalRpm;
    if (!Number.isFinite(visTarget) || visTarget <= 0) return;
    const startRpm = visTarget * 0.7;
    if (rpm < startRpm) {
      setState('off');
      paint(0);
      return;
    }
    if (rpm >= visTarget) {
      // Reentrar em fire requer "dar uma respirada": evita re-fire em jitter
      if (currentMode === 'assisted' && rpm > lastFireRpm + 50) {
        lastFireRpm = rpm;
        fire();
        return;
      }
      // Em learning, mostra tier 5 cheio mas não dispara fire
      setState('off');
      paint(5);
      return;
    }
    lastFireRpm = -Infinity;
    const p = (rpm - startRpm) / (visTarget - startRpm);
    setState('off');
    paint(tierForProgress(p));
  }

  function setMode(m) {
    currentMode = (m === 'assisted' || m === 'learning') ? m : currentMode;
  }

  function reset() {
    if (fireTimer) { clearTimeout(fireTimer); fireTimer = null; }
    setState('off');
    paint(0);
    lastFireRpm = -Infinity;
  }

  return { update, setMode, reset, _state: () => element.getAttribute('data-state') };
}

// resolveCockpitMode(car, gearConfidence, requestedMode) — degradação
// automática (Card 3 das decisões): pediu assistido mas não tem alvo
// confiável → cai pra learning. Retorna { mode, downgraded, reason }.
export function resolveCockpitMode({ requestedMode = 'assisted', gearConfidence, hasReliableTarget } = {}) {
  if (requestedMode === 'learning') {
    return { mode: 'learning', downgraded: false, reason: null };
  }
  if (!Number.isFinite(gearConfidence) || gearConfidence < 0.7) {
    return { mode: 'learning', downgraded: true, reason: 'gear_confidence below floor' };
  }
  if (hasReliableTarget === false) {
    return { mode: 'learning', downgraded: true, reason: 'no reliable target (dyno or learned)' };
  }
  return { mode: 'assisted', downgraded: false, reason: null };
}
