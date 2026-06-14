// t3000-watchdog.js — vigia a chegada de amostras vindas do conversor T3000
// e dispara alerta visual "SEM SINAL" no painel quando o cabo cai.
//
// Decisão técnica 2026-05-29: limite de 1.500 ms sem amostra (≈ 15 ciclos
// perdidos a 10 Hz). Abaixo disso é só atraso normal de USB; acima, o piloto
// precisa saber que o que ele vê pode estar congelado.
//
// Recupera sozinho: assim que volta a chegar amostra, alerta some.

export const T3000_WATCHDOG_DEFAULTS = {
  toleranciaMs: 1500,
  intervaloVerificarMs: 250,
};

/**
 * Cria um watchdog do T3000.
 *
 * @param {Object} opts
 * @param {() => number} opts.agora — fonte de tempo monotônica (default performance.now)
 * @param {() => number} opts.getUltimaAmostraTs — devolve o timestamp da última amostra recebida
 * @param {(perdeu: boolean) => void} opts.onMudancaSinal — chamado QUANDO o estado muda (perdeu/voltou)
 * @param {number} [opts.toleranciaMs] — tempo sem amostra que dispara o alerta
 * @param {number} [opts.intervaloVerificarMs] — frequência da checagem interna
 */
export function criarT3000Watchdog({
  agora,
  getUltimaAmostraTs,
  onMudancaSinal,
  toleranciaMs = T3000_WATCHDOG_DEFAULTS.toleranciaMs,
  intervaloVerificarMs = T3000_WATCHDOG_DEFAULTS.intervaloVerificarMs,
} = {}) {
  if (typeof getUltimaAmostraTs !== 'function') {
    throw new Error('t3000-watchdog: getUltimaAmostraTs obrigatório');
  }
  if (typeof onMudancaSinal !== 'function') {
    throw new Error('t3000-watchdog: onMudancaSinal obrigatório');
  }
  const _agora = typeof agora === 'function'
    ? agora
    : (typeof performance !== 'undefined' && performance.now
        ? () => performance.now()
        : () => Date.now());

  let perdeuSinal = false;
  let timer = null;
  let parouEm = null;

  function verificar() {
    const ultima = getUltimaAmostraTs();
    // ultima === 0 significa "nunca recebeu amostra" — não dispara enquanto não vier nada
    if (!ultima || ultima <= 0) {
      if (perdeuSinal) {
        // Caso especial: alguém zerou. Mantém estado "perdeu" como estava.
      }
      return;
    }
    const delta = _agora() - ultima;
    const agoraPerdeu = delta > toleranciaMs;
    if (agoraPerdeu !== perdeuSinal) {
      perdeuSinal = agoraPerdeu;
      try { onMudancaSinal(perdeuSinal); } catch (e) {
        console.warn('[t3000-watchdog] onMudancaSinal lançou:', e?.message);
      }
    }
  }

  return {
    /** Liga a checagem periódica. Idempotente. */
    iniciar() {
      if (timer) return;
      timer = setInterval(verificar, intervaloVerificarMs);
    },
    /** Para a checagem. Não dispara onMudancaSinal. */
    parar() {
      if (timer) { clearInterval(timer); timer = null; }
      parouEm = _agora();
    },
    /** Estado atual: true = sem sinal. */
    estaPerdido() {
      return perdeuSinal;
    },
    /** Força uma checagem agora (útil em testes). */
    verificar,
    /** Configuração efetiva — útil pra inspeção. */
    config: { toleranciaMs, intervaloVerificarMs },
  };
}
