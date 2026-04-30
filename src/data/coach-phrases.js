// ═══════════════════════════════════════════════════════════
// CoachPhrases — catálogo de mensagens da Biblioteca de Lições
// ═══════════════════════════════════════════════════════════
// Cada lição em src/data/lesson-library.js declara `preferredMessageCodes`
// (M### ). Este arquivo mapeia cada código para uma frase com
// 2 ou 3 palavras (regra dura — validada em runtime).
//
// IMPORTANTE: arquivo SEPARADO de src/pipeline/phrases.js. As frases
// canônicas de pista (FrasesAcao/Confirmação/...) ficam intactas. Aqui
// é só o catálogo do P1 Coach pedagógico.
//
// Convenção de família (M0XX = MVP, M1XX = Fase 2):
//   M001-009  Referência Fixa / Curva Cega
//   M010-019  V-Min
//   M020-029  Transição Freio-Acelerador
//   M030-039  Acelerador Progressivo
//   M040-049  Linha de Visão
//   M050-059  Subesterço
//   M060-069  Curva Cega (entrada)
//   M100-149  Fase 2

const RAW = Object.freeze({
  // L001 — Referência Fixa
  M001: 'Mesmo ponto',
  M002: 'Freie aqui',
  M003: 'Gire agora',

  // L002 — V-Min
  M010: 'Mais V-min',
  M011: 'Solta freio',
  M012: 'Não freia mais',

  // L003 — Transição freio-acelerador
  M020: 'Sem coast',
  M021: 'Acelera junto',
  M022: 'Liga o pé',

  // L004 — Acelerador progressivo
  M030: 'Mais suave',
  M031: 'Sem bate',
  M032: 'Cresce gás',

  // L005 — Linha de visão
  M040: 'Olha saída',
  M041: 'Vista longe',
  M042: 'Antecipa apex',

  // L006 — Controle subesterço
  M050: 'Alivia gira',
  M051: 'Abre linha',
  M052: 'Solta volante',

  // L007 — Curva cega
  M060: 'Compromete entrada',
  M061: 'Confia ponto',
  M062: 'Mesmo giro',

  // ─── Fase 2 ───
  // L101 — Volante contínuo
  M100: 'Volante único',
  M101: 'Sem corrigir',
  M102: 'Arco limpo',

  // L102 — Círculo de grip
  M110: 'Tira lateral',
  M111: 'Soma forças',
  M112: 'Fora envelope',

  // L103 — Pneu arrastando
  M120: 'Pneu trava',
  M121: 'Alivia freio',
  M122: 'Solta um pouco',

  // L104 — Controle sobresterço
  M130: 'Cuidado traseira',
  M131: 'Corrige cedo',
  M132: 'Tira gás',

  // L105 — Uso seguro de zebra
  M140: 'Sem zebra',
  M141: 'Pisa leve',
  M142: 'Zebra livre',
});

const MAX_WORDS = 3;
const MIN_WORDS = 2;

function wordCount(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

// Validação eager: 2..3 palavras, nada mais.
for (const [code, frase] of Object.entries(RAW)) {
  if (!/^M[0-9]{3}$/.test(code)) {
    throw new Error(`coach-phrases: código inválido ${code}`);
  }
  const n = wordCount(frase);
  if (n < MIN_WORDS || n > MAX_WORDS) {
    throw new Error(`coach-phrases: ${code} tem ${n} palavras ("${frase}") — deve ser ${MIN_WORDS}..${MAX_WORDS}`);
  }
}

export const CoachPhrases = RAW;

export function getPhrase(code) {
  return RAW[code] || null;
}

export function isCoachCode(code) {
  return Object.prototype.hasOwnProperty.call(RAW, code);
}

/**
 * Retorna o conjunto único de mensagens válidas — útil para cross-check
 * com FrasesPermitidas em testes que validam que nada vaza pelo cockpit.
 */
export const CoachPhrasesSet = Object.freeze(new Set(Object.values(RAW)));
