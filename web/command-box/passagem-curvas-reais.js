// passagem-curvas-reais.js — monta a PASSAGEM REAL por curva do Command Box a
// partir das passagens reais de GPS (já fatiadas por curva), usando o adaptador
// passagem-real.js. Espelha frenagem-curvas-reais.js.
//
// Fonte das passagens: web/command-box/fixtures/passagens-bubi-brasilia.v1.json
// (voltas reais do Bubi em Brasília, 23-24/05). Quando o canal ao vivo entregar a
// volta corrente, o mesmo adaptador atende — esta camada é a do dado gravado.
//
// REFERÊNCIA por curva = a MELHOR volta (menor tempo de trecho). MOSTRADA (default)
// = a volta TÍPICA (mediana de tempo) — assim o bloco mostra diferenças REAIS e
// não-zero vs a melhor (ao vivo, a "mostrada" é a volta que o piloto acabou de
// fazer). opts.volta fixa uma volta específica pra mostrar, se quiser.
//
// NÃO acessa rede nem DOM: recebe o objeto da massa já lido. Roda em Node e no
// navegador igual.

import { passagemRealParaCorner } from './passagem-real.js';

// índice da volta de tempo MEDIANO num array já ordenado por tempo crescente.
function idxMediana(n) {
  return Math.floor((n - 1) / 2);
}

/**
 * Para cada curva (na ordem canônica da pista, _meta.ordemCurvas) devolve os campos
 * do bloco Passagem no formato do desenho aprovado, com dado REAL.
 * - opts.volta: número da volta a MOSTRAR (se existir naquela curva); default = mediana.
 * Cada item:
 *   { curveIdx, curva, ...campos do corner (entradaKmh, apexKmh, ...), voltaMostrada,
 *     voltaRef, voltasDisponiveis }
 *   ou, sem passagem real utilizável: { curveIdx, curva, semDadoReal:true, motivo }
 */
export function construirPassagemRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];

  const porNome = {};
  for (const p of passagens) (porNome[p.curva] = porNome[p.curva] || []).push(p);
  for (const n of Object.keys(porNome)) porNome[n].sort((a, b) => a.tempo_trecho_s - b.tempo_trecho_s);

  return ordem.map((nome, idx) => {
    const base = { curveIdx: idx, curva: nome };
    const arr = porNome[nome] || [];
    if (!arr.length) {
      return { ...base, semDadoReal: true, motivo: 'sem passagem real desta curva no dado gravado' };
    }

    const best = arr[0]; // menor tempo = referência
    const mostrada =
      (opts.volta != null && arr.find((p) => p.volta === opts.volta)) || arr[idxMediana(arr.length)];

    const corner = passagemRealParaCorner(
      { pontos: mostrada.pontos, tempo_trecho_s: mostrada.tempo_trecho_s },
      { pontos: best.pontos, tempo_trecho_s: best.tempo_trecho_s },
    );
    if (!corner) {
      return { ...base, semDadoReal: true, motivo: 'passagem real sem pontos suficientes' };
    }

    return {
      ...base,
      ...corner,
      voltaMostrada: mostrada.volta,
      voltaRef: best.volta,
      voltasDisponiveis: arr.map((p) => p.volta),
    };
  });
}
