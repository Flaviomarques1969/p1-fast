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
import { criarDetectorChegada } from './chegada-gps.js';

// Janela pra considerar dois fechamentos de volta como O MESMO (injeção + GPS na
// mesma passagem). Nenhuma volta real é tão curta, então é seguro pra anti-duplicidade.
const DEDUPE_VOLTA_MS = 8000;

export function criarOrquestradorVivo(opts = {}) {
  const cerebro = criarCerebroPainel(opts);
  let lastParcialS = null;   // último cronômetro de volta visto nas amostras
  let lastSampleT = null;    // último carimbo de tempo visto (tWall/t)
  let lastRegT = null;       // tempo da última volta REGISTRADA (anti-duplicidade)
  let lastCrossT = null;     // tempo do último cruzamento de chegada (pra medir a volta)
  let voltaSeq = 0;          // sequência de volta quando não vem número pronto

  // Funil único: injeção (feedVolta) e GPS (chegada) passam por aqui. Se duas
  // fontes fecharem a "mesma" volta dentro da janela, conta UMA vez.
  function registrarVolta(n, tempoSec, t) {
    if (tempoSec == null || !isFinite(tempoSec) || tempoSec <= 0) return false;
    if (t != null && lastRegT != null && (t - lastRegT) < DEDUPE_VOLTA_MS) return false;
    voltaSeq++;
    cerebro.onVolta({ n: n != null ? n : voltaSeq, tempoSec });
    if (t != null) lastRegT = t;
    return true;
  }

  // Detector de volta por GPS — só liga se um marco de chegada for passado.
  // Sem marco: comportamento idêntico ao anterior (só injeção).
  const detectorChegada = opts.marcoChegada
    ? criarDetectorChegada(opts.marcoChegada, ({ t }) => {
        // tempo da volta = intervalo entre cruzamentos consecutivos.
        if (lastCrossT != null && t != null) {
          registrarVolta(null, (t - lastCrossT) / 1000, t);
        }
        if (t != null) lastCrossT = t;
      })
    : null;

  function feedSample(s) {
    if (!s) return;
    cerebro.onSample(s);
    if (typeof s.tWall === 'number') lastSampleT = s.tWall;
    else if (typeof s.t === 'number') lastSampleT = s.t;
    if (typeof s.cronometroParcialS === 'number' && s.cronometroParcialS > 0) {
      lastParcialS = s.cronometroParcialS;
    }
    // GPS → detector de chegada (aceita lng ou lon; carimbo = tWall/t da amostra)
    if (detectorChegada) {
      const lat = s.lat;
      const lng = typeof s.lng === 'number' ? s.lng : s.lon;
      if (typeof lat === 'number' && typeof lng === 'number') {
        detectorChegada.ingestGps({ lat, lng, t: lastSampleT });
      }
    }
  }
  function feedVolta(ev) {
    if (!ev) return;
    // tempo da volta: o que vier pronto; senão, o cronômetro parcial do fim da volta.
    const tempoSec = ev.tempoSec != null ? ev.tempoSec
      : (ev.tempoMs != null ? ev.tempoMs / 1000 : lastParcialS);
    // injeção tem prioridade: registra (com anti-duplicidade vs GPS pelo carimbo atual).
    registrarVolta(ev.n, tempoSec, lastSampleT);
    lastParcialS = null; // zera pro próximo
  }
  function snapshot() { return cerebro.snapshot(); }

  return { feedSample, feedVolta, snapshot, _cerebro: cerebro,
    _detectorChegada: detectorChegada };
}

export default { criarOrquestradorVivo };
