// trecho-estado.js — estado VIVO de classificação de um trecho/curva. Módulo PURO
// (sem DOM, sem rede, imutável: toda função devolve um estado NOVO, não muta o de entrada).
//
// VISÃO (Flávio 13/06/2026): a classificação de um trecho NÃO é fixa. Um agente observa cada
// passagem; quando o piloto evolui de forma CONSISTENTE (ex.: deixa de frear numa curva), o
// agente PROPÕE mudar o tipo do trecho — e o Flávio aprova/ajusta/recusa no celular (Command Box
// dos trechos). Este módulo é o coração desse ciclo: empilha observações numa janela rolante,
// decide quando a evolução virou tendência (não ruído), e aplica a decisão do Flávio.
//
// O TIPO de cada passagem vem do motor `classificador-trecho.js` (1 passagem -> tipo). Este
// módulo NÃO reclassifica nada — só acumula, compara e propõe. Nunca impõe: a mudança só vale
// depois do aval humano.
//
// HONESTIDADE: leitura de baixa confiança e ND (dado não permite afirmar) NÃO contam para propor.
// Nunca se propõe mudar PARA ND (ND é "perdi o dado", não uma evolução). Sem dado bom suficiente,
// o trecho fica como está, em observação.

import { TIPOS } from './classificador-trecho.js';

export const PARAMS = {
  janela: 5,          // últimas N passagens guardadas por trecho (janela rolante)
  minParaPropor: 3,   // nº de passagens recentes do MESMO tipo divergente para virar proposta
  confMinima: ['media', 'alta'], // confiança que "conta" para propor (baixa não conta)
};

const CONF_OK = new Set(PARAMS.confMinima);
const clone = e => JSON.parse(JSON.stringify(e));

// cria o estado inicial de um trecho. tipoAprovado = a 1ª fatia validada pelo Flávio.
export function criarEstado({ trecho, ordem = null, tipoAprovado, origem = 'validado-flavio' }) {
  if (!TIPOS[tipoAprovado]) throw new Error('tipoAprovado inválido: ' + tipoAprovado);
  return {
    trecho, ordem,
    tipoAprovado,
    rotuloAprovado: TIPOS[tipoAprovado].rotulo,
    origem,                 // de onde veio o tipo aprovado atual
    historico: [],          // janela rolante: {tipo, confianca, motivo, contexto}
    totalObservadas: 0,        // contador NÃO-rolante de TODAS as passagens vistas
    qualificadasObservadas: 0, // contador NÃO-rolante só das leituras confiáveis (conf média+, não-ND)
    propostaPendente: null, // null | {de, para, evidencia, suporte[], ...}
    recusas: [],            // [{para, naContagem}] — alvos recusados pelo Flávio
    log: [],                // histórico de decisões aplicadas
  };
}

// empilha uma passagem classificada na janela rolante. `classificacao` é a saída do
// classificador-trecho.js (tem tipo, confianca, motivo). `contexto` descreve a passagem
// (dia, volta, tempo_s, tipo_pneu...). NÃO muta o estado de entrada.
export function observar(estado, classificacao, contexto = {}) {
  const e = clone(estado);
  const tipo = classificacao?.tipo ?? 'ND';
  const confianca = classificacao?.confianca ?? 'baixa';
  e.historico.push({ tipo, confianca, motivo: classificacao?.motivo ?? '', contexto });
  if (e.historico.length > PARAMS.janela) e.historico = e.historico.slice(-PARAMS.janela);
  e.totalObservadas = (e.totalObservadas || 0) + 1;
  // só leitura confiável (conta para a carência de recusa = "evidência nova suficiente")
  if (CONF_OK.has(confianca) && tipo !== 'ND') e.qualificadasObservadas = (e.qualificadasObservadas || 0) + 1;
  return e;
}

// recalcula a proposta pendente do zero a partir da janela atual (idempotente e honesto:
// se a evidência sumiu, a proposta some). Regra: as últimas `minParaPropor` passagens com
// confiança média+ (ND e baixa não contam) precisam ser TODAS do mesmo tipo, e esse tipo
// precisa divergir do aprovado. 1 divergência isolada, mistura ou reversão = sem proposta.
export function avaliarProposta(estado) {
  const e = clone(estado);
  e.propostaPendente = null;

  const qualif = e.historico.filter(o => CONF_OK.has(o.confianca) && o.tipo !== 'ND');
  if (qualif.length < PARAMS.minParaPropor) return e;

  const ultimas = qualif.slice(-PARAMS.minParaPropor);
  const alvo = ultimas[0].tipo;
  const todasIguais = ultimas.every(o => o.tipo === alvo);
  if (!todasIguais || alvo === e.tipoAprovado) return e;

  // carência de recusa: se o Flávio já recusou esse mesmo alvo e ainda não chegou evidência
  // CONFIÁVEL nova suficiente desde então, não re-propõe (não fica insistindo). A carência é
  // medida em LEITURAS CONFIÁVEIS novas (não em passagens brutas: ND/baixa não fazem o tempo correr).
  const rec = (e.recusas || []).filter(r => r.para === alvo)
    .sort((a, b) => (b.naContagemQualif ?? 0) - (a.naContagemQualif ?? 0))[0];
  const qualifAgora = e.qualificadasObservadas || 0;
  const evidenciaNova = !rec || (qualifAgora - (rec.naContagemQualif ?? 0)) >= PARAMS.minParaPropor;
  if (!evidenciaNova) return e;

  e.propostaPendente = montarProposta(e, alvo, ultimas);
  return e;
}

function montarProposta(estado, para, ultimas) {
  const ctx = o => (o.contexto && o.contexto.dia != null && o.contexto.volta != null)
    ? `${o.contexto.dia} volta ${o.contexto.volta}` : 'passagem';
  const rotuloDe = TIPOS[estado.tipoAprovado]?.rotulo ?? estado.tipoAprovado;
  const rotuloPara = TIPOS[para]?.rotulo ?? para;
  return {
    de: estado.tipoAprovado,
    para,
    rotuloDe,
    rotuloPara,
    suporte: ultimas.map(o => ({ tipo: o.tipo, confianca: o.confianca, contexto: o.contexto })),
    motivoExemplo: ultimas[ultimas.length - 1].motivo || '',
    evidencia: `As últimas ${ultimas.length} passagens com leitura confiável apontam ${para} (${rotuloPara}), `
      + `mas o tipo aprovado é ${estado.tipoAprovado} (${rotuloDe}). Passagens: ${ultimas.map(ctx).join(', ')}.`,
    emContagem: estado.totalObservadas,
  };
}

// aplica a decisão do Flávio. decisao: 'aprovar' (assume a proposta), 'ajustar' (assume um
// tipo escolhido por ele em opts.tipoNovo), 'recusar' (mantém o aprovado e registra carência).
// Ao aprovar/ajustar, o tipoAprovado muda e vira a base nova — a observação continua dali.
export function aplicarDecisao(estado, decisao, opts = {}) {
  const e = clone(estado);
  const pend = e.propostaPendente;

  if (decisao === 'aprovar') {
    if (!pend) return e; // nada a aprovar
    e.log.push({ acao: 'aprovar', de: e.tipoAprovado, para: pend.para, contexto: opts.contexto ?? null });
    e.tipoAprovado = pend.para;
    e.rotuloAprovado = TIPOS[pend.para]?.rotulo ?? pend.para;
    e.origem = 'proposta-aprovada';
    e.recusas = (e.recusas || []).filter(r => r.para !== pend.para);
    e.propostaPendente = null;
    return e;
  }

  if (decisao === 'ajustar') {
    const novo = opts.tipoNovo;
    if (!novo || !TIPOS[novo]) throw new Error('ajustar exige opts.tipoNovo válido (um tipo conhecido)');
    e.log.push({ acao: 'ajustar', de: e.tipoAprovado, para: novo, propunha: pend?.para ?? null, contexto: opts.contexto ?? null });
    e.tipoAprovado = novo;
    e.rotuloAprovado = TIPOS[novo]?.rotulo ?? novo;
    e.origem = 'ajuste-flavio';
    e.recusas = (e.recusas || []).filter(r => r.para !== novo);
    e.propostaPendente = null;
    return e;
  }

  if (decisao === 'recusar') {
    if (pend) {
      e.recusas = e.recusas || [];
      e.recusas.push({ para: pend.para, naContagem: e.totalObservadas || 0, naContagemQualif: e.qualificadasObservadas || 0 });
      e.log.push({ acao: 'recusar', de: e.tipoAprovado, para: pend.para, contexto: opts.contexto ?? null });
      e.propostaPendente = null;
    }
    return e;
  }

  throw new Error('decisão inválida: ' + decisao + " (use 'aprovar' | 'ajustar' | 'recusar')");
}

// resumo da tendência observada na janela atual (para o painel): tipo dominante entre as
// passagens confiáveis, quantas ND, quantas de baixa confiança.
export function tendencia(estado) {
  const h = estado.historico;
  const qualif = h.filter(o => CONF_OK.has(o.confianca) && o.tipo !== 'ND');
  const cont = {};
  for (const o of qualif) cont[o.tipo] = (cont[o.tipo] || 0) + 1;
  // dominante = tipo mais frequente entre as confiáveis; empate no topo => sem dominante claro
  let max = 0;
  for (const n of Object.values(cont)) if (n > max) max = n;
  const topo = Object.keys(cont).filter(tp => cont[tp] === max && max > 0);
  const empate = topo.length > 1;
  const dominante = empate ? null : (topo[0] ?? null);
  // categorias mutuamente exclusivas (somam = janela): confiáveis + ND + baixa-não-ND
  const ndN = h.filter(o => o.tipo === 'ND').length;
  const baixaN = h.filter(o => o.tipo !== 'ND' && !CONF_OK.has(o.confianca)).length;
  return {
    dominante,
    dominanteN: max,
    rotuloDominante: dominante ? (TIPOS[dominante]?.rotulo ?? dominante) : null,
    empate,
    topoEmpatados: empate ? topo : [],
    totalQualif: qualif.length,
    ndN,        // passagens indeterminadas (ND)
    baixaN,     // passagens de baixa confiança que NÃO são ND (sem dupla contagem)
    janela: h.length,
    distribuicao: cont,
  };
}
