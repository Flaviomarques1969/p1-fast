// classificador-vivo-bridge.js — liga o classificador VIVO ao fluxo de telemetria ao vivo.
// É o serviço que, a CADA passagem fechada na pista, classifica o trecho, alimenta o estado vivo
// (trecho-estado.js) e PROPÕE mudar o tipo da curva quando o piloto evolui de forma consistente.
//
// PONTO DE CONEXÃO REAL (não inventado): o LiveDataBridge (live-data-bridge.js) emite, a cada
// passagem concluída (evento 'saida-cruzou'), o callback:
//   onTrechoEvent({ type:'passagem-fechada', segmentId, pontos:[{lat,lng,kmh,t,fracao,sub}], vminKmh, vminFracao })
// Para ligar ao vivo, basta no boot do cockpit:
//   const vivo = criarClassificadorVivo({ segmentos, onProposta, store });
//   new LiveDataBridge({ onTrechoEvent: ev => { if (ev.type === 'passagem-fechada') vivo.aoFecharPassagem(ev); } });
//
// SEGURANÇA: este módulo NÃO fala com banco nem nuvem. A persistência é um `store` INJETADO
// (interface { salvar(snapshot) }). Sem store, ele só mantém o estado em memória. Assim, ligar ao
// vivo em produção (gravar tipo no banco, entregar no celular) é uma decisão separada — não mora aqui.

import { classificarTrecho } from './classificador-trecho.js';
import { criarEstado, observar, avaliarProposta, aplicarDecisao, tendencia } from './trecho-estado.js';

// segmentos: [{ id, nome, ordem, distProximaM, tipoAprovado, origem? }]
//   id = segmentId que chega no evento ao vivo; nome = nome da curva; tipoAprovado = padrão atual.
// onProposta(info) = callback chamado quando uma nova proposta nasce (pra acender no Command Box/celular).
// store = { salvar(snapshot) } opcional (persistência injetada; sem ele, só memória).
export function criarClassificadorVivo({ segmentos = [], onProposta = null, store = null } = {}) {
  const estados = new Map(); // segmentId -> estado vivo
  const meta = new Map();    // segmentId -> { nome, ordem, distProximaM }
  for (const s of segmentos) {
    if (!s || s.id == null) continue;
    estados.set(s.id, criarEstado({ trecho: s.nome, ordem: s.ordem ?? null, tipoAprovado: s.tipoAprovado, origem: s.origem || 'validado-flavio' }));
    meta.set(s.id, { nome: s.nome, ordem: s.ordem ?? null, distProximaM: s.distProximaM ?? null });
  }

  function snapshot() {
    return [...estados.entries()]
      .map(([segmentId, e]) => ({ segmentId, ...meta.get(segmentId), estado: e, tendencia: tendencia(e) }))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  // chamada a cada passagem fechada ao vivo (payload do evento 'passagem-fechada').
  function aoFecharPassagem({ segmentId, pontos, contexto = {}, vminKmh = null, vminFracao = null } = {}) {
    const m = meta.get(segmentId);
    if (!m || !estados.has(segmentId)) return null; // segmento fora do conjunto observado: ignora
    if (!Array.isArray(pontos) || pontos.length < 3) return null; // passagem curta demais
    const ctx = { ...contexto };
    if (vminKmh != null && ctx.vminKmh == null) ctx.vminKmh = vminKmh;
    const tinhaProposta = !!estados.get(segmentId).propostaPendente;
    const c = classificarTrecho({ geo: { nome: m.nome, id: segmentId }, pts: pontos, distProximaM: m.distProximaM });
    const est = avaliarProposta(observar(estados.get(segmentId), c, ctx));
    estados.set(segmentId, est);
    if (store && typeof store.salvar === 'function') store.salvar(snapshot());
    // só notifica quando uma proposta NASCE agora (não a cada passagem com proposta já aberta)
    if (est.propostaPendente && !tinhaProposta && typeof onProposta === 'function') {
      onProposta({ segmentId, trecho: m.nome, proposta: est.propostaPendente });
    }
    return {
      segmentId, trecho: m.nome,
      classificacao: { tipo: c.tipo, rotulo: c.rotulo, confianca: c.confianca, motivo: c.motivo },
      propostaPendente: est.propostaPendente,
    };
  }

  // aplica a decisão do Flávio (aprovar | ajustar | recusar) vinda do Command Box.
  function decidir(segmentId, decisao, opts = {}) {
    if (!estados.has(segmentId)) return null;
    const est = aplicarDecisao(estados.get(segmentId), decisao, opts);
    estados.set(segmentId, est);
    if (store && typeof store.salvar === 'function') store.salvar(snapshot());
    return est;
  }

  function estadoDe(segmentId) { return estados.get(segmentId) || null; }

  return { aoFecharPassagem, decidir, snapshot, estadoDe };
}
