// ═══════════════════════════════════════════════════════════
// aceleracao-teorica.ts — port TS de ios/p1fast-core/.../AceleracaoTeorica.swift
// Bloco 3 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
//
//   F_tração    = T(rpm) × relMarcha × relFinal / raioPneu
//   F_arrasto   = ½ × ρ × CdA × v²
//   F_rolamento = Crr × massa × g
//   F_líquida   = F_tração − F_arrasto − F_rolamento
//   a           = F_líquida / massa

import { DynoCurve, torqueAt } from "./dyno-curve.ts";

export const GRAVIDADE_MS2 = 9.80665;

export interface ResistenciaConfig {
  cda: number;                // m² (coeficiente de arrasto × área frontal)
  crr: number;                // adimensional
  densidadeArKgm3: number;    // kg/m³
}

/** Defaults pra Brasília (Flávio confirmou 2026-05-18). */
export const RESISTENCIA_BRASILIA_DEFAULT: ResistenciaConfig = {
  cda: 0.65,
  crr: 0.013,
  densidadeArKgm3: 1.10,
};

export interface AceleracaoTeoricaResultado {
  torqueMotorNm: number;
  forcaTracaoN: number;
  forcaArrastoN: number;
  forcaRolamentoN: number;
  forcaLiquidaN: number;
  aceleracaoMs2: number;
}

export interface AceleracaoTeoricaInput {
  rpm: number;
  relacaoMarcha: number;
  relacaoFinal: number;
  raioPneuM: number;
  massaKg: number;
  velocidadeKmh: number;
  curva: DynoCurve;
  resistencia?: ResistenciaConfig;
}

/**
 * Calcula a aceleração teórica do carro em pleno acelerador no instante
 * consultado. Retorna null se a configuração for inválida.
 */
export function aceleracaoTeorica(
  input: AceleracaoTeoricaInput
): AceleracaoTeoricaResultado | null {
  const {
    rpm,
    relacaoMarcha,
    relacaoFinal,
    raioPneuM,
    massaKg,
    velocidadeKmh,
    curva,
    resistencia = RESISTENCIA_BRASILIA_DEFAULT,
  } = input;

  if (relacaoMarcha <= 0 || relacaoFinal <= 0 || raioPneuM <= 0 || massaKg <= 0) {
    return null;
  }

  const torqueMotorNm = torqueAt(curva, rpm);
  const forcaTracaoN = (torqueMotorNm * relacaoMarcha * relacaoFinal) / raioPneuM;

  const velocidadeMs = Math.max(0, velocidadeKmh) / 3.6;
  const forcaArrastoN =
    0.5 * resistencia.densidadeArKgm3 * resistencia.cda * velocidadeMs * velocidadeMs;

  const forcaRolamentoN = resistencia.crr * massaKg * GRAVIDADE_MS2;

  const forcaLiquidaN = forcaTracaoN - forcaArrastoN - forcaRolamentoN;
  const aceleracaoMs2 = forcaLiquidaN / massaKg;

  return {
    torqueMotorNm,
    forcaTracaoN,
    forcaArrastoN,
    forcaRolamentoN,
    forcaLiquidaN,
    aceleracaoMs2,
  };
}
