// coreografia-volta.js — o QUANDO de cada tela durante a volta.
// Coreografia fechada pelo Flávio em 09/06 (docs/CONCEITOS_TRECHO_PRODUTO.md):
//
//   saída do trecho → METADE da reta : painel padrão (desempenho do trecho feito)
//   metade da reta → entrada próxima : tela de ORIENTAÇÃO do próximo trecho
//   dentro do trecho                 : painel padrão ao vivo
//   reta MAIS LONGA                  : painel → RESUMO DA VOLTA → orientação (último 1/3)
//   mensagens críticas               : atropelam tudo (responsabilidade do chamador)
//
// Motor puro e testável: recebe segmentos (com geometria GPS), eventos do
// detector (entrada-cruzou / saida-cruzou) e pontos de GPS; emite callbacks:
//   onOrientacao(segmentoSeguinte, progresso01)  — mostrar/atualizar a tela
//   onResumoVolta()                              — mostrar resumo (reta longa)
//   onPainel()                                   — voltar pro painel padrão

function distM(a, b) {
  const kLat = 110540;
  const kLng = 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lng - b.lng) * kLng, (a.lat - b.lat) * kLat);
}

function centroLinha(l) { return { lat: (l.a.lat + l.b.lat) / 2, lng: (l.a.lng + l.b.lng) / 2 }; }

export class CoreografiaVolta {
  /**
   * @param {Array} segments — na ordem da volta (cada um com entradaLine/saidaLine)
   * @param {Object} cb — { onOrientacao, onResumoVolta, onPainel }
   * @param {Object} opts — { fracaoMostrarOrientacao=0.5, fracaoResumoInicio=0.35, fracaoResumoFim=0.66 }
   */
  constructor(segments, cb = {}, opts = {}) {
    this._segs = Array.isArray(segments) ? segments.slice() : [];
    this._cb = cb;
    this._fOri = opts.fracaoMostrarOrientacao ?? 0.5;
    this._fResIni = opts.fracaoResumoInicio ?? 0.35;
    this._fResFim = opts.fracaoResumoFim ?? 0.66;

    // pré-calcula as "retas": da saída do seg i até a entrada do seg i+1
    this._retas = this._segs.map((seg, i) => {
      const prox = this._segs[(i + 1) % this._segs.length];
      const de = centroLinha(seg.saidaLine);
      const ate = centroLinha(prox.entradaLine);
      return { deSegId: seg.id, proxSeg: prox, de, ate, compM: distM(de, ate) };
    });
    this._idxRetaLonga = this._retas.reduce((bi, r, i, arr) => r.compM > arr[bi].compM ? i : bi, 0);

    this._estado = 'painel';       // painel | reta | trecho
    this._retaAtual = null;        // reta em curso (após saida-cruzou)
    this._fase = null;             // null | 'resumo' | 'orientacao'
  }

  retaMaisLonga() { return this._retas[this._idxRetaLonga]; }

  /** Eventos do detector de trechos. */
  evento(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'saida-cruzou') {
      const i = this._retas.findIndex(r => r.deSegId === ev.segmentId);
      this._retaAtual = i >= 0 ? this._retas[i] : null;
      this._ehRetaLonga = i === this._idxRetaLonga;
      this._estado = 'reta';
      this._fase = null;
      this._emit('onPainel'); // desempenho do trecho feito, no painel padrão
    }
    if (ev.type === 'entrada-cruzou') {
      this._estado = 'trecho';
      this._retaAtual = null;
      this._fase = null;
      this._emit('onPainel'); // dentro do trecho: painel ao vivo
    }
  }

  /** Ponto de GPS (lat/lng) — decide as viradas de fase ao longo da reta. */
  gps(p) {
    if (this._estado !== 'reta' || !this._retaAtual || !p) return;
    const r = this._retaAtual;
    // progresso na reta: 0 na saída do trecho anterior, 1 na entrada do próximo
    const dDe = distM(r.de, p);
    const prog = Math.max(0, Math.min(1, dDe / Math.max(1, r.compM)));

    if (this._ehRetaLonga) {
      if (prog >= this._fResIni && prog < this._fResFim && this._fase !== 'resumo') {
        this._fase = 'resumo';
        this._emit('onResumoVolta');
      }
      if (prog >= this._fResFim && this._fase !== 'orientacao') {
        this._fase = 'orientacao';
        this._emit('onOrientacao', r.proxSeg, 1);
      } else if (this._fase === 'orientacao') {
        this._emit('onOrientacao', r.proxSeg, 1 - (prog - this._fResFim) / Math.max(0.001, 1 - this._fResFim));
      }
      return;
    }

    if (prog >= this._fOri) {
      if (this._fase !== 'orientacao') {
        this._fase = 'orientacao';
        this._emit('onOrientacao', r.proxSeg, 1);
      } else {
        this._emit('onOrientacao', r.proxSeg, 1 - (prog - this._fOri) / Math.max(0.001, 1 - this._fOri));
      }
    }
  }

  _emit(nome, ...args) {
    const fn = this._cb[nome];
    if (typeof fn === 'function') { try { fn(...args); } catch {} }
  }
}
