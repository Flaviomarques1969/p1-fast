// ═══════════════════════════════════════════════════════════
// Taxonomia expandida de erros de pilotagem
// ═══════════════════════════════════════════════════════════
// Complementa ErrorClassifier com rótulos de detalhe pedagógico.
// Não substitui — o classificador base dá UMA principal.
// Esta taxonomia é usada pelo BOX para enriquecer análise pós-volta.
//
// Regra SPEC_MENSAGENS: frases do cockpit vêm da biblioteca controlada.
// Esta taxonomia NÃO vira mensagem de cockpit — só relatório e análise.

import { ErroTipo, ErroLabel } from './error-classifier.js';

// Rótulos de detalhe (execução/linha/corda).
export const ErroTipoExtra = Object.freeze({
  ...ErroTipo,
  PEGOU_CORDA:         'pegou-corda',
  NAO_PEGOU_CORDA:     'nao-pegou-corda',
  USOU_PISTA_TODA:     'usou-pista-toda',
  FREADA_INSTAVEL:     'freada-instavel',
  ENTRADA_SUJA:        'entrada-suja',
  SAIDA_RASGADA:       'saida-rasgada',
  TRAIL_BRAKING_OK:    'trail-braking-ok',
  CORRIGIU_LINHA:      'corrigiu-linha',
  ABORTOU_CURVA:       'abortou-curva',
  EXPLORACAO_OK:       'exploracao-ok',
});

export const ErroLabelExtra = Object.freeze({
  ...ErroLabel,
  'pegou-corda':         'Pegou a corda',
  'nao-pegou-corda':     'Não pegou corda',
  'usou-pista-toda':     'Usou pista toda',
  'freada-instavel':     'Freada instável',
  'entrada-suja':        'Entrada suja',
  'saida-rasgada':       'Saída rasgada',
  'trail-braking-ok':    'Trail braking ok',
  'corrigiu-linha':      'Corrigiu linha',
  'abortou-curva':       'Abortou curva',
  'exploracao-ok':       'Exploração ok',
});

/** Categoria de cada rótulo — pro box agrupar. */
export const CategoriaErro = Object.freeze({
  'freou-cedo':          'frenagem',
  'freou-tarde-demais':  'frenagem',
  'boa-frenagem':        'frenagem',
  'freada-instavel':     'frenagem',
  'trail-braking-ok':    'frenagem',

  'entrou-forte-demais': 'entrada',
  'entrou-timido':       'entrada',
  'entrada-suja':        'entrada',

  'pegou-corda':         'linha',
  'nao-pegou-corda':     'linha',
  'manteve-linha':       'linha',
  'usou-pista-toda':     'linha',
  'corrigiu-linha':      'linha',
  'abortou-curva':       'linha',

  'perdeu-rotacao':      'saida',
  'matou-saida':         'saida',
  'perdeu-tracao':       'saida',
  'saiu-forte':          'saida',
  'saida-rasgada':       'saida',

  'exploracao-ok':       'geral',
});

/**
 * Classifica detalhes adicionais de UM trecho a partir de
 * telemetria bruta. Recebe execution enriquecido (linha, corda,
 * estabilidade) — inputs opcionais; ausência = sem rótulo.
 */
export function classifyDetails(exec = {}) {
  const out = [];
  if (exec.aderenciaCorda != null) {
    if (exec.aderenciaCorda >= 0.8)       out.push(ErroTipoExtra.PEGOU_CORDA);
    else if (exec.aderenciaCorda <= 0.35) out.push(ErroTipoExtra.NAO_PEGOU_CORDA);
  }
  if (exec.estabilidadeFrear != null) {
    if (exec.estabilidadeFrear <= 0.4) out.push(ErroTipoExtra.FREADA_INSTAVEL);
  }
  if (exec.aberturaLinha != null) {
    if (exec.aberturaLinha >= 0.85) out.push(ErroTipoExtra.USOU_PISTA_TODA);
    else if (exec.aberturaLinha <= 0.4) out.push(ErroTipoExtra.ENTRADA_SUJA);
  }
  if (exec.abortou) out.push(ErroTipoExtra.ABORTOU_CURVA);
  if (exec.corrigiu) out.push(ErroTipoExtra.CORRIGIU_LINHA);
  if (exec.trail)    out.push(ErroTipoExtra.TRAIL_BRAKING_OK);
  return out;
}

export function labelErro(key) {
  return ErroLabelExtra[key] || key;
}

export function categoriaErro(key) {
  return CategoriaErro[key] || 'geral';
}
