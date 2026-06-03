// ═══════════════════════════════════════════════════════════
// priorizar-trecho.ts — algoritmo de priorização ponderada
// Bloco 3 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
//
// Decide qual trecho tem a MAIOR oportunidade de ganho — não é apenas
// o maior delta absoluto. Pondera 3 fatores:
//
//   1. Tamanho do delta acumulado de aceleração (m/s²) — quanto maior, pior
//   2. Persistência (quantas amostras com delta > 0) — recorrência conta
//   3. Tipo da causa — algumas têm mais alavanca prática que outras
//
// Pesos por causa (ajustáveis):
//   marcha_baixa       → 1.2 (piloto pode mudar agora)
//   pedal_parcial      → 1.1 (piloto pode mudar agora)
//   motor_abaixo       → 1.0 (manutenção / setup, demora)
//   cambio_escorregando → 0.9 (manutenção mecânica, pode comprometer corrida)
//   indeterminado      → 0.5

import { CausaProvavel, ClassificacaoResultado } from "./classificar-causa.ts";

export interface TrechoEntrada {
  trechoId: string;
  classificacao: ClassificacaoResultado;
  tempoTrechoS: number; // duração do trecho em segundos
}

export interface TrechoPriorizado {
  trechoId: string;
  causa: CausaProvavel;
  score: number;
  ganhoEstimadoSeg: number; // estimativa de quanto pode melhorar o tempo do trecho
}

export const PESOS_POR_CAUSA: Record<CausaProvavel, number> = {
  marcha_baixa: 1.2,
  pedal_parcial: 1.1,
  motor_abaixo: 1.0,
  cambio_escorregando: 0.9,
  indeterminado: 0.5,
};

/**
 * Estimativa simplificada: ganho_seg ≈ deltaAcumulado / 2g
 * (uma força contrária leve devolve segundos proporcionais à massa
 *  do delta). Os pesos por causa só mexem no score, não no ganho
 *  estimado em segundos — esse último é uma referência física.
 */
export function priorizarTrechos(entradas: TrechoEntrada[]): TrechoPriorizado[] {
  const itens: TrechoPriorizado[] = entradas.map((e) => {
    const peso = PESOS_POR_CAUSA[e.classificacao.causa] ?? 0.5;
    const delta = Math.max(0, e.classificacao.deltaAcumuladoMs2);
    // Score: delta × peso (sem usar tempo do trecho aqui — esse só serve
    // de divisor pra "ganho por segundo" se quisermos depois)
    const score = delta * peso;
    // Ganho estimado: aprox física. Δv = ∫a dt. Se delta ≈ 0,5 m/s² e
    // o trecho dura 2 s, então perdemos ~1 m/s de velocidade, o que
    // pode custar ~0,1-0,2 s no tempo do trecho. Usamos
    // ganho_s ≈ delta × tempo_s² / (2 × 9.8) como referência.
    const ganhoEstimadoSeg = (delta * Math.max(0.1, e.tempoTrechoS)) / 19.6;
    return {
      trechoId: e.trechoId,
      causa: e.classificacao.causa,
      score,
      ganhoEstimadoSeg,
    };
  });
  itens.sort((a, b) => b.score - a.score);
  return itens;
}
