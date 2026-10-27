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
import { formaTrailTipo } from './forma-trail-tipo.js';
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
 * desenho aprovado, JÁ com o TIPO definitivo da curva (decisão Flávio 13/06).
 *
 * A linha IDEAL (tracejada + faixa) é o trail clássico PRESCRITO do TIPO (`ideal`):
 * porrada + escadinha p/ T0/T1/T5, residual p/ T2/T4 — a régua teórica que o Flávio
 * aprovou no cockpit de treino. NÃO é mais a melhor volta crua de GPS ~1 Hz (que ele
 * reprovou em 15/06). A volta real entra SOBREPOSTA (`live`) quando há dado; sem dado
 * real ainda, a curva mostra SÓ o ideal do tipo — nunca fica em branco.
 * - opts.volta: volta a mostrar (se existir); default = a melhor.
 * Cada item:
 *   { curveIdx, curva, tipo, rotuloTipo, formatoTipo, textoFacilTipo, ... }
 *   + (curva de freada) ideal[18]  — trail prescrito do tipo (sempre presente)
 *   + (com volta real) live, ref, minimaFreando, soltou, freioMin, fonteFreio, deltaM, voltaMostrada, voltasDisponiveis
 *   + (tipo de freada SEM volta real utilizável) semDadoReal:true, motivo  — mostra só o ideal
 *   + (SF, pé embaixo) semFreadaPorTipo:true  — sem trail por tipo
 */
export function construirFrenagemRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];

  const porNome = {};
  for (const p of passagens) (porNome[p.curva] = porNome[p.curva] || []).push(p);
  for (const n of Object.keys(porNome)) porNome[n].sort((a, b) => a.tempo_trecho_s - b.tempo_trecho_s);

  return ordem.map((nome, idx) => {
    const base = { curveIdx: idx, curva: nome, ...infoTipo(nome) };

    // SF = curva de pé embaixo: por TIPO não tem freada — não desenha trail.
    if (semFreadaPorTipo(base.tipo)) return { ...base, semFreadaPorTipo: true };

    // FORMA-IDEAL do tipo: o trail clássico PRESCRITO (régua), sempre presente — é a
    // linha tracejada + faixa. Independe de haver volta real medida.
    const ideal = formaTrailTipo(base.tipo);

    const arr = porNome[nome] || [];
    const best = arr[0];
    const display = (opts.volta != null && arr.find(p => p.volta === opts.volta)) || best;
    const frx = display ? frenagemFrxParaPassagem({ pontos: display.pontos, refPontos: best.pontos }) : null;
    if (frx) {
      // volta real medida: live sobreposto ao ideal do tipo (comparação ponto a ponto).
      return { ...base, ideal, voltaMostrada: display.volta, voltasDisponiveis: arr.map(p => p.volta), ...frx };
    }
    // tipo de freada mas SEM volta real utilizável: mostra só o ideal do tipo (não fica em branco).
    return {
      ...base, ideal, semDadoReal: true,
      motivo: arr.length
        ? 'sem freada nítida no GPS ~1 Hz — mostrando o trail do tipo (volta real entra com 25 Hz)'
        : 'sem passagem real — mostrando o trail do tipo',
    };
  });
}
