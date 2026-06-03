// ═══════════════════════════════════════════════════════════
// motor-decair.ts — detecção de motor caindo em 3 eventos seguidos
// Bloco 3 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
//
// Pega o histórico de aceleração de um carro num mesmo trecho ao longo
// de N voltas/stints e detecta se o delta acumulado vem CRESCENDO de
// maneira persistente — sinal de que o motor está se degradando (vela
// suja, óleo velho, bicos entupindo).
//
// Regra: 3 leituras seguidas com `deltaAcumuladoMs2` crescente E o
// último valor ≥ 30% maior que o primeiro da janela. Quando dispara,
// devolve sugestão de pendência de manutenção.

import { CausaProvavel } from "./classificar-causa.ts";

export interface LeituraHistorica {
  evento: string;                     // identificador do evento/stint
  data: string;                       // ISO
  trechoId: string;
  causa: CausaProvavel;
  deltaAcumuladoMs2: number;
}

export interface MotorDecaindo {
  decaindo: boolean;
  janelaAvaliada: LeituraHistorica[];
  fatorCrescimento: number;           // último / primeiro da janela
  sugestaoPendencia: string | null;
}

const TAMANHO_JANELA = 3;
const FATOR_MINIMO_CRESCIMENTO = 1.30;

/**
 * Avalia se as últimas 3 leituras de um trecho mostram motor caindo.
 * Considera só leituras com causa = "motor_abaixo" (ignora as outras
 * que são culpa do piloto / pista / câmbio).
 */
export function detectarMotorDecaindo(
  historico: LeituraHistorica[]
): MotorDecaindo {
  // Pega só motor_abaixo, mantém ordem cronológica (mais antigo → mais novo)
  const filtrado = [...historico]
    .filter((h) => h.causa === "motor_abaixo")
    .sort((a, b) => a.data.localeCompare(b.data));

  if (filtrado.length < TAMANHO_JANELA) {
    return {
      decaindo: false,
      janelaAvaliada: filtrado,
      fatorCrescimento: 1,
      sugestaoPendencia: null,
    };
  }

  const janela = filtrado.slice(-TAMANHO_JANELA);

  // Cada leitura tem que ser ≥ anterior
  let crescente = true;
  for (let i = 1; i < janela.length; i++) {
    if (janela[i].deltaAcumuladoMs2 < janela[i - 1].deltaAcumuladoMs2) {
      crescente = false;
      break;
    }
  }
  if (!crescente) {
    return {
      decaindo: false,
      janelaAvaliada: janela,
      fatorCrescimento: 1,
      sugestaoPendencia: null,
    };
  }

  const primeiro = janela[0].deltaAcumuladoMs2;
  const ultimo = janela[janela.length - 1].deltaAcumuladoMs2;
  if (primeiro <= 0) {
    return {
      decaindo: false,
      janelaAvaliada: janela,
      fatorCrescimento: 1,
      sugestaoPendencia: null,
    };
  }

  const fatorCrescimento = ultimo / primeiro;
  if (fatorCrescimento >= FATOR_MINIMO_CRESCIMENTO) {
    return {
      decaindo: true,
      janelaAvaliada: janela,
      fatorCrescimento,
      sugestaoPendencia:
        `Motor caindo no trecho ${janela[0].trechoId}: delta cresceu ${((fatorCrescimento - 1) * 100).toFixed(0)}% em 3 stints. Sugerir checar vela, filtro de ar e óleo.`,
    };
  }

  return {
    decaindo: false,
    janelaAvaliada: janela,
    fatorCrescimento,
    sugestaoPendencia: null,
  };
}
