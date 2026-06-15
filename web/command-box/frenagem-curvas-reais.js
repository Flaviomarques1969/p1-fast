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

/**
 * Para cada curva (na ordem canônica da pista), escolhe a passagem a mostrar e a
 * melhor (referência) e devolve a frenagem no formato do desenho aprovado.
 * - fixture: { _meta:{ ordemCurvas:[...] }, passagens:[{ curva, volta, tempo_trecho_s, pontos:[{lat,lng,kmh,t}] }] }
 * - opts.volta: volta a mostrar (se existir na curva); default = a melhor.
 * Devolve um array de 8 itens (1 por curva):
 *   { curveIdx, curva, voltaMostrada, voltasDisponiveis, live, minimaFreando, soltou, freioMin, fonteFreio, deltaM }
 *   ou { curveIdx, curva, semDado:true, motivo } quando não há freada medível.
 */
export function construirFrenagemRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];

  const porNome = {};
  for (const p of passagens) (porNome[p.curva] = porNome[p.curva] || []).push(p);
  for (const n of Object.keys(porNome)) porNome[n].sort((a, b) => a.tempo_trecho_s - b.tempo_trecho_s);

  return ordem.map((nome, idx) => {
    const arr = porNome[nome] || [];
    if (!arr.length) return { curveIdx: idx, curva: nome, semDado: true, motivo: 'sem passagem real' };
    const best = arr[0];
    const display = (opts.volta != null && arr.find(p => p.volta === opts.volta)) || best;
    const frx = frenagemFrxParaPassagem({ pontos: display.pontos, refPontos: best.pontos });
    if (!frx) return { curveIdx: idx, curva: nome, semDado: true, motivo: 'sem freada medível (dado ralo / curva de pé embaixo)' };
    return {
      curveIdx: idx,
      curva: nome,
      voltaMostrada: display.volta,
      voltasDisponiveis: arr.map(p => p.volta),
      ...frx,
    };
  });
}
