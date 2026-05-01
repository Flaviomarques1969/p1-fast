// dyno-target-calculator — calcula `optimal_rpm` por marcha a partir da curva
// de dinamômetro + relações de transmissão. Função pura.
//
// Algoritmo (MVP, conforme plano):
//   1. Para cada RPM da marcha N, calcular potência efetiva.
//   2. Calcular o RPM resultante na marcha N+1 após a troca:
//        rpm_after = rpm × (gear_N+1 / gear_N)
//      (gear_ratio menor = marcha mais alta; rpm_after < rpm)
//   3. Comparar power(rpm, N) vs power(rpm_after, N+1).
//   4. Alvo = primeiro RPM (varrendo de baixo p/ cima) onde
//      power(rpm_after, N+1) > power(rpm, N).
//
// Sem `gear_ratios` → fallback: 90% do redline (ou 90% do maxRpm da curva).

function interpPower(curve, rpm) {
  if (!Array.isArray(curve) || curve.length === 0) return null;
  if (rpm <= curve[0].rpm) return curve[0].power_kw;
  const last = curve[curve.length - 1];
  if (rpm >= last.rpm) return last.power_kw;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].rpm >= rpm) {
      const a = curve[i - 1], b = curve[i];
      const t = (rpm - a.rpm) / (b.rpm - a.rpm);
      return a.power_kw + t * (b.power_kw - a.power_kw);
    }
  }
  return null;
}

function peakPowerRpm(curve) {
  let best = curve[0];
  for (const p of curve) if (p.power_kw > best.power_kw) best = p;
  return best.rpm;
}

export function computeOptimalRpmPerGear({ curve, gear_ratios, redline_rpm } = {}) {
  if (!Array.isArray(curve) || curve.length < 3) {
    throw new Error('curva inválida (mínimo 3 pontos)');
  }
  const sorted = curve.slice().sort((a, b) => a.rpm - b.rpm);
  const minRpm = sorted[0].rpm;
  const maxRpm = sorted[sorted.length - 1].rpm;
  const usableMax = Number.isFinite(redline_rpm) ? Math.min(redline_rpm, maxRpm) : maxRpm;

  if (!Array.isArray(gear_ratios) || gear_ratios.length < 2) {
    const ref = Number.isFinite(redline_rpm) ? redline_rpm : maxRpm;
    const fallbackRpm = Math.round(ref * 0.9);
    const ng = Array.isArray(gear_ratios) ? gear_ratios.length : 5;
    const result = {};
    for (let g = 1; g <= ng; g++) {
      result[g] = {
        optimal_rpm: fallbackRpm,
        source: 'fallback',
        reason: 'gear_ratios ausente ou insuficiente — usando 90% do redline/maxRpm'
      };
    }
    return result;
  }

  const result = {};
  for (let g = 0; g < gear_ratios.length - 1; g++) {
    const gN  = gear_ratios[g];
    const gN1 = gear_ratios[g + 1];
    if (!Number.isFinite(gN) || !Number.isFinite(gN1) || gN <= 0 || gN1 <= 0) {
      result[g + 1] = {
        optimal_rpm: Math.round(peakPowerRpm(sorted)),
        source: 'fallback',
        reason: `gear_ratio inválido na marcha ${g + 1}`
      };
      continue;
    }
    const ratioFactor = gN1 / gN; // < 1
    let optimal = null;
    const stepCount = 200;
    for (let i = 0; i <= stepCount; i++) {
      const rpm = minRpm + (usableMax - minRpm) * i / stepCount;
      const rpmAfter = rpm * ratioFactor;
      if (rpmAfter < minRpm) continue;
      const pCur = interpPower(sorted, rpm);
      const pNext = interpPower(sorted, rpmAfter);
      if (pCur == null || pNext == null) continue;
      if (pNext > pCur) {
        optimal = Math.round(rpm);
        break;
      }
    }
    if (optimal == null) {
      optimal = Math.round(peakPowerRpm(sorted));
      result[g + 1] = { optimal_rpm: optimal, source: 'dyno', reason: 'sem cruzamento — alvo no pico de potência' };
    } else {
      result[g + 1] = { optimal_rpm: optimal, source: 'dyno', reason: null };
    }
  }
  // Última marcha: sem próxima → alvo no pico (não há sentido em "trocar")
  result[gear_ratios.length] = {
    optimal_rpm: Math.round(peakPowerRpm(sorted)),
    source: 'dyno',
    reason: 'última marcha — alvo no pico de potência'
  };
  return result;
}
