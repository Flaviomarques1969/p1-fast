// vmin-curvas-reais.js — monta o GRÁFICO do bloco VMIN do Command Box a partir das
// passagens reais de GPS, SEPARADO POR CONFIGURAÇÃO DE PNEU. Espelha
// passagem-curvas-reais.js, mas em vez dos 3 números entrega a CURVA DE VELOCIDADE
// do trecho (série velocidade × distância-ao-Vmin) pra desenhar no gráfico aprovado.
//
// - "live"  = volta MOSTRADA (mediana de tempo) → a curva que o piloto fez.
// - "ghost" = MELHOR passagem daquela config (menor tempo) → a referência ("ideal").
//   É o Vmin da MELHOR passagem daquele trecho, daquele carro, naquela configuração
//   (regra Flávio; mesma chave de melhores_passagens_trecho — radial e semi-slick
//   são bases distintas).
//
// HONESTIDADE (~1 Hz): o número do Vmin só é confiável quando a mínima é um VALE
// (abaixo da entrada E da saída). Senão a freada caiu na borda do recorte → o bloco
// mostra a curva mas marca "sem leitura limpa" e não crava o número (entra com 25 Hz).
//
// Série: x = metros em relação ao ponto mais lento (Vmin em x=0), y = km/h. Função
// pura: não acessa rede nem DOM. Roda em Node e no navegador igual.

import { normalizarTipoPneu } from '../cockpit/tipo-pneu-normalizer.js';
import { _internos as _passagemInternos } from './passagem-real.js';

const metros = _passagemInternos.metros;
const R = (n) => Math.round(n);

const KMH_BOM = 1;   // |Δ| ≤ 1 km/h → no ponto
const KMH_ATEN = 3;  // |Δ| ≤ 3 km/h → atenção; acima → ruim
function toneKmh(abs) { return abs <= KMH_BOM ? 'good' : (abs <= KMH_ATEN ? 'warn' : 'bad'); }
function fmtKmh(d) { const v = R(d); return (v < 0 ? '−' : '+') + Math.abs(v); }

function idxMediana(n) { return Math.floor((n - 1) / 2); }

function configMaisFrequente(passagens) {
  const cont = {};
  for (const p of passagens) { const t = normalizarTipoPneu(p.tipo_pneu); cont[t] = (cont[t] || 0) + 1; }
  let melhor = null, n = -1;
  for (const [t, c] of Object.entries(cont)) if (c > n) { n = c; melhor = t; }
  return melhor;
}

// índice do ponto mais lento (Vmin) da passagem.
function idxVmin(pts) {
  let mi = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].kmh < pts[mi].kmh) mi = i;
  return mi;
}

// série [xRelVmin_m, kmh]: distância acumulada menos a distância no Vmin (Vmin em x=0).
function serie(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + metros(pts[i - 1], pts[i]);
  const dV = cum[idxVmin(pts)];
  return pts.map((p, i) => [Math.round((cum[i] - dV) * 10) / 10, R(p.kmh)]);
}

/**
 * Para cada curva (ordem canônica) devolve o gráfico do Vmin com dado REAL da config
 * escolhida. opts.tipoPneu (default = mais frequente na massa); opts.volta fixa a
 * volta mostrada (default = mediana).
 * Item: { curveIdx, curva, tipoPneu, live[[x,kmh]], ghost[[x,kmh]], vminKmh,
 *         vminConfiavel, label, tone, delta } | { ..., semDadoReal:true, motivo }
 */
export function construirVminRealPorCurva(fixture, opts = {}) {
  const ordem = (fixture && fixture._meta && fixture._meta.ordemCurvas) || [];
  const passagens = (fixture && fixture.passagens) || [];
  const tipoPneu = normalizarTipoPneu(opts.tipoPneu || configMaisFrequente(passagens) || 'desconhecido');

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
      return { ...base, semDadoReal: true, motivo: 'sem passagem real desta curva nesta config de pneu (' + tipoPneu + ')' };
    }
    const best = arr[0];
    const mostrada = (opts.volta != null && arr.find((p) => p.volta === opts.volta)) || arr[idxMediana(arr.length)];
    if (!Array.isArray(mostrada.pontos) || mostrada.pontos.length < 2) {
      return { ...base, semDadoReal: true, motivo: 'passagem mostrada sem pontos suficientes' };
    }

    const live = serie(mostrada.pontos);
    const ghost = Array.isArray(best.pontos) && best.pontos.length >= 2 ? serie(best.pontos) : live;

    const mp = mostrada.pontos;
    const iv = idxVmin(mp);
    // Confiável = VALE de verdade, comparando valores CRUS (sem arredondar) pra não
    // criar falso-positivo em empate (ex.: 86,4 vs 86,0). Mesma regra do passagem-real.
    const vminRaw = mp[iv].kmh, entradaRaw = mp[0].kmh, saidaRaw = mp[mp.length - 1].kmh;
    const vminConfiavel = vminRaw < entradaRaw && vminRaw < saidaRaw;
    const vminKmh = R(vminRaw);

    const bestVmin = Array.isArray(best.pontos) && best.pontos.length ? best.pontos[idxVmin(best.pontos)].kmh : vminRaw;
    const d = vminRaw - bestVmin;
    const label = Math.abs(d) <= KMH_BOM ? 'no ponto' : (d > 0 ? 'alto' : 'baixo');

    return {
      ...base,
      live, ghost,
      vminKmh, vminConfiavel,
      label, tone: toneKmh(Math.abs(d)), delta: fmtKmh(d),
      voltaMostrada: mostrada.volta, voltaRef: best.volta,
    };
  });
}

export const _internos = { serie, idxVmin, toneKmh, fmtKmh };
