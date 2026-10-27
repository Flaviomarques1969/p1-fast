// ============================================================================
// CÉREBRO — Alerta preditivo (Onda 5). Antecipa quando uma grandeza que SOBE
// volta a volta (ex.: temperatura do motor) vai estourar o limite crítico.
//
// Conta: pega a temperatura máxima de cada volta, mede o quanto sobe por volta
// (inclinação), o desvio da última volta vs a base (as primeiras voltas), e
// projeta em quantas voltas bate o limite. NÃO inventa dado: precisa da
// temperatura real volta a volta (vem AO VIVO). Sem isso, devolve null e o
// painel mantém "aguardando".
// ============================================================================

/** Inclinação (°C por volta) por mínimos quadrados sobre os pontos (x=volta, y=temp). */
function inclinacao(pontos) {
  const n = pontos.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  pontos.forEach((p, i) => { sx += i; sy += p; sxy += i * p; sxx += i * i; });
  const den = n * sxx - sx * sx;
  return den === 0 ? 0 : (n * sxy - sx * sy) / den;
}

/**
 * @param {Array<{volta:number, maxTempC:number, curva?:(number|string)}>} voltasTemp
 * @param {object} [opts]
 * @param {number} [opts.limiteC=120]      temperatura crítica
 * @param {number} [opts.baselineVoltas=3] voltas iniciais que formam a base
 * @param {number} [opts.minVoltas=4]      mínimo de voltas pra projetar
 * @returns {object|null} { eta, metricaStr, frase, detalhe, ... } ou null (sem risco/sem base)
 */
export function avaliarPreditivo(voltasTemp, opts = {}) {
  const limiteC = opts.limiteC != null ? opts.limiteC : 120;
  const baseN = opts.baselineVoltas != null ? opts.baselineVoltas : 3;
  const minV = opts.minVoltas != null ? opts.minVoltas : 4;
  const v = (voltasTemp || []).filter(x => x && typeof x.maxTempC === 'number');
  if (v.length < minV) return null;

  const temps = v.map(x => x.maxTempC);
  const base = temps.slice(0, baseN).reduce((a, b) => a + b, 0) / Math.min(baseN, temps.length);
  const ultima = temps[temps.length - 1];
  const taxa = inclinacao(temps);            // °C por volta
  const desvio = ultima - base;              // o "+8°C"
  if (taxa <= 0.05 || ultima >= limiteC) {
    // não está subindo de forma relevante, ou já estourou (vira alerta crítico, não preditivo)
    return null;
  }
  const voltasAteLimite = Math.max(0, Math.round((limiteC - ultima) / taxa));
  const curva = v[v.length - 1].curva != null ? v[v.length - 1].curva : null;

  return {
    eta: `crítico em ~${voltasAteLimite} voltas`,
    metricaStr: `+${Math.round(desvio)}°C`,
    frase: 'temp motor' + (curva != null ? ` · curva ${curva}` : ''),
    detalhe: `sobe ${taxa.toFixed(1).replace('.', ',')}°C por volta · estoura ${limiteC}°C em ~${voltasAteLimite} voltas`,
    _taxaPorVolta: Number(taxa.toFixed(2)),
    _desvioC: Number(desvio.toFixed(1)),
    _voltasAteLimite: voltasAteLimite,
  };
}

export default { avaliarPreditivo };
