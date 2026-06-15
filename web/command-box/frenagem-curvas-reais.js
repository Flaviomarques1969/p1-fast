// frenagem-curvas-reais.js — monta a frenagem REAL por curva do Command Box a
// partir de passagens reais de GPS (já fatiadas por curva), usando o adaptador
// frenagem-real.js (que por sua vez roda o motor de produção freio-trecho.js).
//
// Fonte das passagens: web/command-box/fixtures/passagens-bubi-brasilia.v1.json
// (voltas reais do Bubi em Brasília, 23-24/05). Quando o canal ao vivo entregar
// a volta corrente, o mesmo adaptador atende — esta camada é a do dado gravado.
//
// NÃO acessa rede nem DOM: recebe o objeto da massa já lido. Roda em Node e no
// navegador igual.

import { frenagemFrxParaPassagem } from './frenagem-real.js';
import { TIPO_POR_CURVA, semFreadaPorTipo } from './tipos-curva-brasilia.js';
import { TIPOS } from '../cockpit/classificador-trecho.js';
import { TEXTO_FACIL } from '../cockpit/tipos-curva-texto.js';

// junta o tipo DEFINITIVO da curva (decisão Flávio) com o texto do trail daquele tipo.
function infoTipo(nome) {
  const tipo = TIPO_POR_CURVA[nome] || 'ND';
  const t = TIPOS[tipo] || TIPOS.ND;
  return { tipo, rotuloTipo: t.rotulo, formatoTipo: t.formato, textoFacilTipo: TEXTO_FACIL[tipo] || '' };
}

/**
 * Para cada curva (na ordem canônica da pista) devolve a frenagem no formato do
 * desenho aprovado, JÁ com o TIPO definitivo da curva (decisão Flávio 13/06) e o
 * trail próprio daquele tipo. O alvo de comparação é a MELHOR passagem real da
 * curva (régua canônica) — não um desenho genérico.
 * - opts.volta: volta a mostrar (se existir); default = a melhor.
 * Cada item:
 *   { curveIdx, curva, tipo, rotuloTipo, formatoTipo, textoFacilTipo, ... }
 *   + (curva de freada) live, ref, minimaFreando, soltou, freioMin, fonteFreio, deltaM, voltaMostrada, voltasDisponiveis
 *   + (SF, pé embaixo) semFreadaPorTipo:true
 *   + (tipo de freada mas dado insuficiente) semDado:true, motivo
 */
export function construirFrenagemRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];

  const porNome = {};
  for (const p of passagens) (porNome[p.curva] = porNome[p.curva] || []).push(p);
  for (const n of Object.keys(porNome)) porNome[n].sort((a, b) => a.tempo_trecho_s - b.tempo_trecho_s);

  return ordem.map((nome, idx) => {
    const base = { curveIdx: idx, curva: nome, ...infoTipo(nome) };

    // SF = curva de pé embaixo: por TIPO não tem freada — não é falta de dado.
    if (semFreadaPorTipo(base.tipo)) return { ...base, semFreadaPorTipo: true };

    const arr = porNome[nome] || [];
    if (!arr.length) return { ...base, semDado: true, motivo: 'sem passagem real' };
    const best = arr[0];
    const display = (opts.volta != null && arr.find(p => p.volta === opts.volta)) || best;
    const frx = frenagemFrxParaPassagem({ pontos: display.pontos, refPontos: best.pontos });
    if (!frx) return { ...base, semDado: true, motivo: 'dado ralo (GPS ~1 Hz) — aguardando volta ao vivo / 25 Hz' };
    return { ...base, voltaMostrada: display.volta, voltasDisponiveis: arr.map(p => p.volta), ...frx };
  });
}
