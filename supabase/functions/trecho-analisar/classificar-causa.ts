// ═══════════════════════════════════════════════════════════
// classificar-causa.ts — 5 regras pra explicar perda no trecho
// Bloco 3 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
//
// Olha pra janela de amostras do trecho e decide qual a causa mais
// provável da perda detectada na aceleração real vs aceleração teórica.
//
// As 5 categorias:
//   1. motor_abaixo  — Carro entregando menos do que deveria. Tração
//                      teórica - real > 0,5 m/s² com pedal ≥ 95% por 0,5s.
//   2. marcha_baixa  — Piloto saiu da curva em marcha curta demais. Até
//                      2s após Vmin (mínimo de velocidade local), pedal
//                      ≥ 90% e RPM < 80% do RPM do pico de torque.
//   3. pedal_parcial — Piloto não acelerou tudo. Pedal < 95% por ≥ 0,3s
//                      em reta com v > 60 km/h.
//   4. cambio_escorregando — RPM subiu ≥ 1500 em < 100 ms sem ganho de
//                      velocidade equivalente. Embreagem patinando ou
//                      câmbio gripado.
//   5. indeterminado — Default. Nada bate.
//
// Limiares iniciais — Flávio sabe que vão calibrar com pista. Estão
// agrupados no objeto `LIMIARES_DEFAULT` pra deixar fácil de tunar.

import { DynoCurve, peakTorque } from "./dyno-curve.ts";
import {
  aceleracaoTeorica,
  ResistenciaConfig,
  RESISTENCIA_BRASILIA_DEFAULT,
} from "./aceleracao-teorica.ts";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

/** Amostra mínima necessária pra classificação. Tudo opcional exceto t. */
export interface AmostraTrecho {
  t: number;                  // tempo monotônico em segundos
  velocidadeKmh: number;
  pedalPct: number;           // 0..100
  rpm: number;
  marcha: number;             // 1..6
  aceleracaoRealMs2: number;  // GPS+IMU, m/s²
}

export interface CarroConfig {
  relacoesMarcha: number[];   // index 0 = 1ª marcha
  relacaoFinal: number;
  raioPneuM: number;
  massaKg: number;
  curva: DynoCurve;
  resistencia?: ResistenciaConfig;
}

export type CausaProvavel =
  | "motor_abaixo"
  | "marcha_baixa"
  | "pedal_parcial"
  | "cambio_escorregando"
  | "indeterminado";

export interface ClassificacaoResultado {
  causa: CausaProvavel;
  deltaAcumuladoMs2: number;   // soma dos déficits (teórico - real)
  pedalMedioPct: number;
  rpmMedio: number;
  evidencia: string;
}

// ─────────────────────────────────────────────────────────────
// Limiares
// ─────────────────────────────────────────────────────────────

export interface Limiares {
  motorAbaixoPedalPct: number;
  motorAbaixoDuracaoS: number;
  motorAbaixoDeltaMs2: number;
  marchaBaixaPedalPct: number;
  marchaBaixaJanelaPosVminS: number;
  marchaBaixaFracaoRpmPicoTorque: number;
  pedalParcialPct: number;
  pedalParcialDuracaoS: number;
  pedalParcialVelocidadeKmh: number;
  cambioEscorregandoDeltaRpm: number;
  cambioEscorregandoJanelaS: number;
}

export const LIMIARES_DEFAULT: Limiares = {
  motorAbaixoPedalPct: 95,
  motorAbaixoDuracaoS: 0.5,
  motorAbaixoDeltaMs2: 0.5,
  marchaBaixaPedalPct: 90,
  marchaBaixaJanelaPosVminS: 2.0,
  marchaBaixaFracaoRpmPicoTorque: 0.80,
  pedalParcialPct: 95,
  pedalParcialDuracaoS: 0.3,
  pedalParcialVelocidadeKmh: 60,
  cambioEscorregandoDeltaRpm: 1500,
  cambioEscorregandoJanelaS: 0.10,
};

// ─────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────

/**
 * Classifica a causa mais provável da perda no trecho. Funciona melhor
 * com pelo menos 5 amostras. Devolve "indeterminado" se nada bater.
 */
export function classificarCausa(
  amostras: AmostraTrecho[],
  carro: CarroConfig,
  limiares: Limiares = LIMIARES_DEFAULT
): ClassificacaoResultado {
  if (amostras.length === 0) {
    return {
      causa: "indeterminado",
      deltaAcumuladoMs2: 0,
      pedalMedioPct: 0,
      rpmMedio: 0,
      evidencia: "sem amostras",
    };
  }

  // Helpers de estatística
  const pedalMedioPct =
    amostras.reduce((s, a) => s + a.pedalPct, 0) / amostras.length;
  const rpmMedio = amostras.reduce((s, a) => s + a.rpm, 0) / amostras.length;

  // Calcula δ teórico - real pra cada amostra
  let deltaAcumuladoMs2 = 0;
  const deltas: { t: number; delta: number; a: AmostraTrecho }[] = [];
  for (const a of amostras) {
    const relacaoMarcha = carro.relacoesMarcha[a.marcha - 1] ?? 0;
    if (relacaoMarcha <= 0) continue;
    const r = aceleracaoTeorica({
      rpm: a.rpm,
      relacaoMarcha,
      relacaoFinal: carro.relacaoFinal,
      raioPneuM: carro.raioPneuM,
      massaKg: carro.massaKg,
      velocidadeKmh: a.velocidadeKmh,
      curva: carro.curva,
      resistencia: carro.resistencia ?? RESISTENCIA_BRASILIA_DEFAULT,
    });
    if (!r) continue;
    const delta = r.aceleracaoMs2 - a.aceleracaoRealMs2; // positivo = perdendo
    deltas.push({ t: a.t, delta, a });
    if (delta > 0) deltaAcumuladoMs2 += delta;
  }

  // ── Regra 4: câmbio escorregando ────────────────────────
  // Salto de RPM grande sem velocidade equivalente.
  for (let i = 1; i < amostras.length; i++) {
    const a = amostras[i - 1];
    const b = amostras[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > limiares.cambioEscorregandoJanelaS) continue;
    const dRpm = b.rpm - a.rpm;
    const dVel = Math.abs(b.velocidadeKmh - a.velocidadeKmh);
    if (dRpm >= limiares.cambioEscorregandoDeltaRpm && dVel < 5) {
      return {
        causa: "cambio_escorregando",
        deltaAcumuladoMs2,
        pedalMedioPct,
        rpmMedio,
        evidencia: `ΔRPM=${dRpm.toFixed(0)} em ${(dt * 1000).toFixed(0)} ms sem ΔV equivalente`,
      };
    }
  }

  // ── Regra 1: motor abaixo ────────────────────────────────
  // Janela contínua com pedal ≥ pmin E delta ≥ dmin E RPM na faixa
  // de potência (acima de 80% do RPM do pico de torque). Se o RPM
  // estiver muito baixo, é problema de marcha, não de motor.
  const picoTorque = peakTorque(carro.curva);
  const rpmMinimoMotorAbaixo = picoTorque !== null
    ? picoTorque.rpm * limiares.marchaBaixaFracaoRpmPicoTorque
    : 0;
  {
    let inicio: number | null = null;
    let melhorDuracao = 0;
    let melhorDelta = 0;
    for (const d of deltas) {
      if (
        d.a.pedalPct >= limiares.motorAbaixoPedalPct &&
        d.delta >= limiares.motorAbaixoDeltaMs2 &&
        d.a.rpm >= rpmMinimoMotorAbaixo
      ) {
        if (inicio === null) inicio = d.t;
        const dur = d.t - inicio;
        if (dur > melhorDuracao) {
          melhorDuracao = dur;
          melhorDelta = d.delta;
        }
      } else {
        inicio = null;
      }
    }
    if (melhorDuracao >= limiares.motorAbaixoDuracaoS) {
      return {
        causa: "motor_abaixo",
        deltaAcumuladoMs2,
        pedalMedioPct,
        rpmMedio,
        evidencia: `pedal ≥ ${limiares.motorAbaixoPedalPct}% por ${melhorDuracao.toFixed(2)}s com Δ ≈ ${melhorDelta.toFixed(2)} m/s² em RPM ≥ ${rpmMinimoMotorAbaixo.toFixed(0)}`,
      };
    }
  }

  // ── Regra 2: marcha baixa ────────────────────────────────
  // Detecta Vmin local; depois olha a janela imediatamente posterior.
  const pico = peakTorque(carro.curva);
  if (pico !== null) {
    const rpmAlvo = pico.rpm * limiares.marchaBaixaFracaoRpmPicoTorque;
    let iVmin = 0;
    let vmin = amostras[0].velocidadeKmh;
    for (let i = 1; i < amostras.length; i++) {
      if (amostras[i].velocidadeKmh < vmin) {
        vmin = amostras[i].velocidadeKmh;
        iVmin = i;
      }
    }
    const tVmin = amostras[iVmin].t;
    const tLimite = tVmin + limiares.marchaBaixaJanelaPosVminS;
    let acertos = 0;
    let amostragem = 0;
    for (let i = iVmin; i < amostras.length; i++) {
      const a = amostras[i];
      if (a.t > tLimite) break;
      amostragem++;
      if (a.pedalPct >= limiares.marchaBaixaPedalPct && a.rpm < rpmAlvo) acertos++;
    }
    if (amostragem >= 3 && acertos / amostragem >= 0.6) {
      return {
        causa: "marcha_baixa",
        deltaAcumuladoMs2,
        pedalMedioPct,
        rpmMedio,
        evidencia: `${acertos}/${amostragem} amostras pós-Vmin com pedal ≥ ${limiares.marchaBaixaPedalPct}% e RPM < ${rpmAlvo.toFixed(0)} (80% do RPM do pico de torque)`,
      };
    }
  }

  // ── Regra 3: pedal parcial ───────────────────────────────
  // Janela em alta velocidade onde o pedal não passa do limiar.
  {
    let inicio: number | null = null;
    let melhorDuracao = 0;
    let pedalMin = 100;
    for (const a of amostras) {
      if (
        a.velocidadeKmh >= limiares.pedalParcialVelocidadeKmh &&
        a.pedalPct < limiares.pedalParcialPct
      ) {
        if (inicio === null) inicio = a.t;
        const dur = a.t - inicio;
        if (dur > melhorDuracao) {
          melhorDuracao = dur;
          if (a.pedalPct < pedalMin) pedalMin = a.pedalPct;
        }
      } else {
        inicio = null;
      }
    }
    if (melhorDuracao >= limiares.pedalParcialDuracaoS) {
      return {
        causa: "pedal_parcial",
        deltaAcumuladoMs2,
        pedalMedioPct,
        rpmMedio,
        evidencia: `pedal < ${limiares.pedalParcialPct}% por ${melhorDuracao.toFixed(2)}s em alta velocidade (mín ${pedalMin.toFixed(0)}%)`,
      };
    }
  }

  return {
    causa: "indeterminado",
    deltaAcumuladoMs2,
    pedalMedioPct,
    rpmMedio,
    evidencia: "nada bate as 4 regras conhecidas",
  };
}
