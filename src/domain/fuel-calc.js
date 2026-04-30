// ═══════════════════════════════════════════════════════════
// fuel-calc — Cálculo de combustível em voltas
// ═══════════════════════════════════════════════════════════
// Piloto precisa saber combustível em VOLTAS (não em litros) —
// decisão explícita do Flavio (2026-04-23).
//
// Entrada:
//   env: { tanqueLitros, combustivelInicialL, consumoMedioLVolta }
//   voltasAndadas: número de voltas válidas já rodadas no stint
//
// Fallback:
//   Se consumoMedioLVolta não foi informado, estima por histórico
//   do piloto+carro — TODO quando tiver dado; por ora retorna null.

export function calcularCombustivel(env, voltasAndadas = 0) {
  const inicial = env?.combustivelInicialL;
  const consumo = env?.consumoMedioLVolta;
  const tanque = env?.tanqueLitros;

  if (inicial == null) {
    return { disponivel: false, razao: 'sem-combustivel-inicial' };
  }
  if (consumo == null || !(consumo > 0)) {
    return {
      disponivel: 'parcial',
      combustivelInicialL: inicial,
      tanqueLitros: tanque,
      pctTanque: tanque ? Math.round((inicial / tanque) * 100) : null,
      razao: 'sem-consumo-medio',
    };
  }

  const consumidoL = consumo * voltasAndadas;
  const restanteL = Math.max(0, inicial - consumidoL);
  const voltasRestantes = consumo > 0 ? Math.floor(restanteL / consumo) : 0;
  const pctTanque = tanque ? Math.round((restanteL / tanque) * 100) : null;

  return {
    disponivel: true,
    combustivelInicialL: inicial,
    tanqueLitros: tanque,
    consumoMedioLVolta: consumo,
    consumidoL: +consumidoL.toFixed(2),
    restanteL: +restanteL.toFixed(2),
    voltasRestantes,
    pctTanque,
    label: `${voltasRestantes}v`,
  };
}

/**
 * Progresso do stint: voltas feitas vs alvo + ritmo.
 * @param {Array} laps — laps do stint (já com valida)
 * @param {Object} plan — StintPlan ativo (pode ser null)
 */
export function calcularProgressoStint(laps, plan) {
  const validas = laps.filter(l => l.valida && l.tempoMs != null);
  const voltasFeitas = laps.length;
  const voltasAlvo = plan?.nVoltasAlvo ?? null;
  const pctCompleto = voltasAlvo ? Math.min(100, Math.round((voltasFeitas / voltasAlvo) * 100)) : null;
  const voltasRestantes = voltasAlvo ? Math.max(0, voltasAlvo - voltasFeitas) : null;

  let ritmoMedioMs = null, melhorMs = null;
  if (validas.length) {
    const tempos = validas.map(l => l.tempoMs).sort((a, b) => a - b);
    ritmoMedioMs = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
    melhorMs = tempos[0];
  }
  const deltaStintMs = (ritmoMedioMs != null && melhorMs != null) ? ritmoMedioMs - melhorMs : null;

  return {
    voltasFeitas,
    voltasAlvo,
    voltasRestantes,
    pctCompleto,
    ritmoMedioMs,
    melhorMs,
    deltaStintMs,
    validas: validas.length,
  };
}
