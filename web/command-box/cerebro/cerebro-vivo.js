// ============================================================================
// CÉREBRO VIVO — transforma o fluxo AO VIVO do canal (cockpit-bubi-live) em
// PainelPronto. O carro transmite 'sample' (com cronômetro da volta) e 'evento'
// {tipo:'volta', n}; o tempo da volta NÃO vem pronto, então é tirado do
// cronômetro parcial da última amostra antes do fechamento da volta.
//
// Testável fora do ar: feedSample/feedVolta + snapshot (alimentado com as voltas
// reais no MESMO formato do canal). No browser, ligarNoCanal() escuta o canal
// real (só ouve — nunca publica) e troca pro ao vivo quando o carro entra.
// ============================================================================

import { criarCerebroPainel } from './cerebro-painel.js';

export function criarOrquestradorVivo(opts = {}) {
  const cerebro = criarCerebroPainel(opts);
  let lastParcialS = null;   // último cronômetro de volta visto nas amostras

  function feedSample(s) {
    if (!s) return;
    cerebro.onSample(s);
    if (typeof s.cronometroParcialS === 'number' && s.cronometroParcialS > 0) {
      lastParcialS = s.cronometroParcialS;
    }
  }
  function feedVolta(ev) {
    if (!ev) return;
    // tempo da volta: o que vier pronto; senão, o cronômetro parcial do fim da volta.
    const tempoSec = ev.tempoSec != null ? ev.tempoSec
      : (ev.tempoMs != null ? ev.tempoMs / 1000 : lastParcialS);
    if (tempoSec != null && tempoSec > 0) cerebro.onVolta({ n: ev.n, tempoSec });
    lastParcialS = null; // zera pro próximo
  }
  function snapshot() { return cerebro.snapshot(); }

  return { feedSample, feedVolta, snapshot, _cerebro: cerebro };
}

export default { criarOrquestradorVivo };
