// ═══════════════════════════════════════════════════════════
// Biblioteca de frases — SPEC_MENSAGENS §6
// ═══════════════════════════════════════════════════════════
// Listas fechadas. IA pode escolher entre elas, não inventar.
// Todas 2–3 palavras, linguagem de pista.

export const FrasesAcao = Object.freeze([
  'Freie mais tarde',
  'Freie antes',
  'Mantenha linha',
  'Saia forte',
  'Acelere antes',
  'Acelere depois',
  'Segure o miolo',
  'Solte melhor',
  'Menos entrada',
  'Mais saída',
]);

export const FrasesConfirmacao = Object.freeze([
  'Boa saída',
  'Boa frenagem',
  'Freou cedo',
  'Freou tarde',
  'Perdeu tração',
  'Boa curva',
  'Perdeu reta',
  'Entrou forte',
  'Entrou tímido',
  'Saiu forte',
]);

export const FrasesManutencao = Object.freeze([
  'Mantenha isso',
  'Boa linha',
  'Repita isso',
  'Segue igual',
]);

export const FrasesSistema = Object.freeze([
  'Sem sinal',
  'Telemetria falhou',
  'Bateria crítica',
  'Sessão inválida',
  'Verifique sistema',
  // T-011..T-013 — alertas determinísticos do CrossValidationEngine
  // (V-005 água, V-006 óleo, V-007 lambda). 2 palavras, sem números
  // variáveis (valor vai pro box, piloto recebe sinal binário).
  // Ver BOX_TO_PILOT_TRANSLATION_RULES.md.
  'Motor quente',
  'Pressão óleo',
  'Mistura pobre',
]);

export const FrasesBox = Object.freeze([
  'Box: resfriar',
  'Box: última forte',
  'Box: manter',
  'Box: volta lenta',
  'Box: foco T2',
  'Box: vir agora',
  'Box: manter ritmo',
  'Box: 3 voltas',
]);

/**
 * Eventos de pista / tráfego — alimentados pelo engenheiro (botão manual)
 * ou por Claude Vision em lote sobre vídeo da Insta360 (lote, não live).
 * Cada entrada tem uma frase canônica, permitida no cockpit.
 * D3 do PLANO_EXECUCAO.md — nascem DESATIVADAS (ver MensagensConfig).
 */
export const FrasesEvento = Object.freeze([
  'Bandeira amarela',
  'Safety car',
  'Bandeira azul',
  'Bloco atrás',
  'Bloco à frente',
  'Pista molhada',
  'Incidente curva',
  'Retomada livre',
]);

/**
 * Frases de ápice — canônicas em APEX_ANALYSIS_RULES.md §"Mensagens
 * corretas para piloto (catálogo apex)". Sempre 2-3 palavras.
 * Complementam FrasesAcao/Confirmação em trechos com foco ativo.
 *
 * Termo "ápice" = tradução PT-BR canônica de "apex" (decisão 2026-04-24).
 * Código interno continua usando "apex" como identificador técnico.
 */
export const FrasesApex = Object.freeze([
  'Ápice cedo',
  'Ápice tarde',
  'Mais interno',
  'Menos interno',
  'Priorize saída',
  'Boa curva',
]);

/**
 * Config de ativação por mensagem — regra do Flavio:
 * mensagens NASCEM desativadas, engenheiro liga no Painel quando pronto.
 *   ativo=false → broker ignora; ativo=true → segue pipeline normal.
 * Persiste em meta.key='mensagens:ativo' (objeto { frase → boolean }).
 */
export const MensagensConfig = {
  async get(db) {
    const row = await db.meta.get('mensagens:ativo');
    const out = row?.value || {};
    for (const f of FrasesEvento) if (!(f in out)) out[f] = false;
    return out;
  },
  async set(db, frase, ativo) {
    const cfg = await this.get(db);
    cfg[frase] = !!ativo;
    await db.meta.put({ key: 'mensagens:ativo', value: cfg });
    return cfg;
  },
  async isAtiva(db, frase) {
    const cfg = await this.get(db);
    return !!cfg[frase];
  },
};

/** Conjunto único com todas as frases permitidas. */
export const FrasesPermitidas = Object.freeze(new Set([
  ...FrasesAcao,
  ...FrasesConfirmacao,
  ...FrasesManutencao,
  ...FrasesSistema,
  ...FrasesBox,
  ...FrasesEvento,
  ...FrasesApex,
]));

/**
 * Valida se uma frase está na biblioteca.
 * Usa-se em tempo de dev/teste. A IA pode emitir frases livres, mas passa warning.
 */
export function isFrasePermitida(texto) {
  return FrasesPermitidas.has(String(texto).trim());
}
