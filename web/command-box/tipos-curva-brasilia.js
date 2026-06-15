// tipos-curva-brasilia.js — TIPO DEFINITIVO de cada uma das 8 curvas de Brasília.
//
// Fonte de verdade: decisão LITERAL do Flávio em 13/06/2026 (Command Box dos trechos),
// registrada em ~/.claude-decisoes/respostas/p1-fast/20260613-172700-p1fast-padrao-definitivo-curvas-brasilia.json
//   "sim essas são as mudanças definitivas, esse é o padrão de todas as curvas".
// Substitui a leitura automática de maio (o Flávio decidiu contra o dado em várias:
// ex. PLACAR era SF no dado 7/7, virou T2 por decisão dele).
//
// O TEXTO de cada tipo (rótulo + formato técnico) vem de classificador-trecho.js (TIPOS);
// o texto fácil, de tipos-curva-texto.js (TEXTO_FACIL). Aqui fica SÓ o mapa curva→tipo.
//
// Observação (memória 13/06): a persistência definitiva será uma TABELA NOVA no banco,
// ajustável no app do celular — ainda não criada ("MIGRAR PARA PRODUÇÃO" não autorizado).
// Até lá, esta é a fonte canônica no código para o Command Box.

export const TIPO_POR_CURVA = {
  'CURVA 01':            'T5', // raio crescente (era T0)
  'CURVA DA RETA OPOSTA':'T1', // lenta pós-reta
  'CURVA 2':             'T0', // média clássica (era T1)
  'CURVA DA JUNÇÃO':     'T2', // raio decrescente (era T1)
  'CURVA DA BRUXA':      'T0', // média clássica (era ND)
  'CURVA DO PLACAR':     'T2', // raio decrescente (era SF, decisão do Flávio contra o dado)
  'CURVA "S"':           'T4', // encadeada (era ND)
  'CURVA DA VITÓRIA':    'SF', // sem freada — pé embaixo (era ND)
};

// curvas SF não têm prescrição de freio (pé embaixo) — não desenham curva de freada.
export function semFreadaPorTipo(tipo) { return tipo === 'SF'; }
