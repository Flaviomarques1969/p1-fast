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
import { normalizarTipoPneu } from '../cockpit/tipo-pneu-normalizer.js';

// índice da volta de tempo MEDIANO num array já ordenado por tempo crescente.
function idxMediana(n) {
  return Math.floor((n - 1) / 2);
}

// configuração de pneu com mais passagens na massa (default exibido).
function configMaisFrequente(passagens) {
  const cont = {};
  for (const p of passagens) {
    const t = normalizarTipoPneu(p.tipo_pneu);
    cont[t] = (cont[t] || 0) + 1;
  }
  let melhor = null, n = -1;
  for (const [t, c] of Object.entries(cont)) if (c > n) { n = c; melhor = t; }
  return melhor;
}

// lista de configurações de pneu presentes na massa, com contagem.
export function configuracoesNaMassa(fixture) {
  const passagens = (fixture && fixture.passagens) || [];
  const cont = {};
  for (const p of passagens) {
    const t = normalizarTipoPneu(p.tipo_pneu);
    cont[t] = (cont[t] || 0) + 1;
  }
  return cont;
}

/**
 * Para cada curva (na ordem canônica da pista, _meta.ordemCurvas) devolve os campos
 * do bloco Passagem no formato do desenho aprovado, com dado REAL — SEPARADO POR
 * CONFIGURAÇÃO DE PNEU (a referência/melhor é da MESMA configuração; Celta 1.4
 * radial e semi-slick são históricos distintos).
 * - opts.tipoPneu: configuração a exibir (default = a mais frequente na massa).
 * - opts.volta: número da volta a MOSTRAR dessa config; default = mediana.
 * Cada item:
 *   { curveIdx, curva, tipoPneu, ...campos do corner (entradaKmh, apexKmh, vminKmh, ...),
 *     voltaMostrada, voltaRef, voltasDisponiveis }
 *   ou, sem passagem real daquela config: { curveIdx, curva, tipoPneu, semDadoReal:true, motivo }
 */
export function construirPassagemRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];

  const tipoPneu = normalizarTipoPneu(opts.tipoPneu || configMaisFrequente(passagens) || 'desconhecido');

  // agrupa SÓ as passagens da configuração de pneu escolhida, por curva.
  const porNome = {};
  for (const p of passagens) {
    if (normalizarTipoPneu(p.tipo_pneu) !== tipoPneu) continue;
    (porNome[p.curva] = porNome[p.curva] || []).push(p);
  }
  for (const n of Object.keys(porNome)) porNome[n].sort((a, b) => a.tempo_trecho_s - b.tempo_trecho_s);

  return ordem.map((nome, idx) => {
    const base = { curveIdx: idx, curva: nome, tipoPneu };
    const arr = porNome[nome] || [];
    if (!arr.length) {
      // sem dado NESSA configuração (ex.: semi-slick antes de rodar com ele) → bloco mostra "—".
      return { ...base, semDadoReal: true, motivo: 'sem passagem real desta curva nesta configuração de pneu (' + tipoPneu + ')' };
    }

    const best = arr[0]; // menor tempo da MESMA config = referência aprendida
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
