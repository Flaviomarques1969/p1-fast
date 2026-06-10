// padrao-acumulador.js — acumula o padrão de telemetria do carro em N voltas
// e dispara alertas preditivos a partir da 4ª volta quando há desvio.
//
// Spec / decisão de produto:
//   - project_p1fast_deteccao_por_padrao_historico (Flávio 27/05/2026):
//     3 voltas estabelecem o padrão; desvio de 20% acima ou abaixo dispara.
//     Por combinação (carro + autódromo + pneu). Persiste entre sessões.
//
// Mecanismo:
//   1. A cada amostra T4000 vinda do bridge, acumula MÁX da volta corrente
//      (motor, pneu, câmbio) + MÍN da pressão de pneu.
//   2. Quando a volta fecha (gatilho externo — TrechoDetector cruzando
//      saída do último segmento, ou marco de chegada), empurra o resumo
//      pro buffer de voltas.
//   3. Se já tem 3+ voltas no buffer, calcula a média (padrão).
//   4. Compara a volta recém-fechada contra o padrão via
//      avaliarPreditivoPorPadrao e dispara os ids correspondentes.
//   5. Chama onPersist com o payload da combinação pra gravar no Supabase
//      (tabela padroes_telemetria_por_volta).
//
// Uso:
//   import { PadraoAcumulador } from './padrao-acumulador.js';
//   const acu = new PadraoAcumulador({
//     carroId, trackId, tipoPneu,
//     onAlertasPreditivos: (ids) => alertasCriticos.aplicarPreditivos(ids),
//     onPersist: async (payload) => await persistirPadrao(payload),
//   });
//   bridge.onT4000 = (s) => acu.ingestT4000(s);
//   detector.onSaidaUltimoSegmento = () => acu.fecharVolta();

import { avaliarPreditivoPorPadrao } from './alertas-criticos.js';

const VOLTAS_MIN_PADRAO_DEFAULT = 3;
const VOLTAS_MAX_NO_BUFFER = 10;
const DESVIO_PCT_DEFAULT = 0.20;

/**
 * Resumo de uma volta — máximos relevantes pra detecção preditiva.
 */
function voltaVazia() {
  return {
    motorMaxC:       -Infinity,
    pneuMaxC:        -Infinity,
    pneuMinPressBar:  Infinity,
    cambioMaxC:      -Infinity,
    amostras:        0,
    t:               null,
  };
}

function voltaIsValida(v) {
  return (
    Number.isFinite(v.motorMaxC) ||
    Number.isFinite(v.pneuMaxC)  ||
    Number.isFinite(v.cambioMaxC)
  );
}

/**
 * Calcula a média de cada métrica entre as voltas do buffer.
 */
export function calcularMediaVoltas(voltas) {
  const acc = { motor: 0, motorN: 0, pneuT: 0, pneuTN: 0, pneuP: 0, pneuPN: 0, cambio: 0, cambioN: 0 };
  for (const v of voltas) {
    if (Number.isFinite(v.motorMaxC))      { acc.motor  += v.motorMaxC;       acc.motorN++; }
    if (Number.isFinite(v.pneuMaxC))       { acc.pneuT  += v.pneuMaxC;        acc.pneuTN++; }
    if (Number.isFinite(v.pneuMinPressBar)){ acc.pneuP  += v.pneuMinPressBar; acc.pneuPN++; }
    if (Number.isFinite(v.cambioMaxC))     { acc.cambio += v.cambioMaxC;      acc.cambioN++;}
  }
  return {
    motor: { media: acc.motorN  ? acc.motor  / acc.motorN  : null, n: acc.motorN },
    pneu:  {
      tempMedia:  acc.pneuTN ? acc.pneuT / acc.pneuTN : null,
      pressMedia: acc.pneuPN ? acc.pneuP / acc.pneuPN : null,
      n: acc.pneuTN,
    },
    cambio: { media: acc.cambioN ? acc.cambio / acc.cambioN : null, n: acc.cambioN },
  };
}

export class PadraoAcumulador {
  /**
   * @param {Object} opts
   * @param {string} opts.carroId
   * @param {string} opts.trackId
   * @param {string} opts.tipoPneu
   * @param {number} [opts.voltasMinPraPadrao=3]
   * @param {number} [opts.desvioPct=0.20]
   * @param {Object} [opts.padraoInicial]  padrão já persistido (se existir)
   * @param {Array}  [opts.voltasIniciais] últimas voltas conhecidas (do banco)
   * @param {Function} [opts.onAlertasPreditivos] callback (ids[])
   * @param {Function} [opts.onPersist]   callback async (payload)
   */
  constructor({
    carroId,
    trackId,
    tipoPneu,
    voltasMinPraPadrao = VOLTAS_MIN_PADRAO_DEFAULT,
    desvioPct          = DESVIO_PCT_DEFAULT,
    padraoInicial      = null,
    voltasIniciais     = [],
    onAlertasPreditivos = () => {},
    onPersist           = async () => {},
  } = {}) {
    if (!carroId || !trackId || !tipoPneu) {
      throw new Error('PadraoAcumulador: carroId, trackId e tipoPneu são obrigatórios');
    }
    this.carroId   = carroId;
    this.trackId   = trackId;
    this.tipoPneu  = tipoPneu;
    this._voltasMinPraPadrao = voltasMinPraPadrao;
    this._desvioPct = desvioPct;
    this._padrao   = padraoInicial;
    this._voltas   = Array.isArray(voltasIniciais) ? [...voltasIniciais].slice(-VOLTAS_MAX_NO_BUFFER) : [];
    this._voltaAtual = voltaVazia();
    this._onAlertas  = onAlertasPreditivos;
    this._onPersist  = onPersist;
  }

  /** Acumula MÁX/MÍN da volta atual com base na amostra T4000/T3000. */
  ingestT4000(sample) {
    if (!sample || sample.checksumOk === false) return;
    const v = this._voltaAtual;
    if (typeof sample.waterTempC === 'number') v.motorMaxC = Math.max(v.motorMaxC, sample.waterTempC);
    if (typeof sample.tireTempMaxC === 'number') v.pneuMaxC = Math.max(v.pneuMaxC, sample.tireTempMaxC);
    if (typeof sample.tirePressMinBar === 'number') v.pneuMinPressBar = Math.min(v.pneuMinPressBar, sample.tirePressMinBar);
    if (typeof sample.cambioTempC === 'number') v.cambioMaxC = Math.max(v.cambioMaxC, sample.cambioTempC);
    v.amostras++;
  }

  /**
   * Fecha a volta atual: empurra o resumo, recalcula padrão, dispara alertas
   * preditivos, persiste e reseta. Retorna o resumo da volta fechada.
   */
  fecharVolta() {
    if (!voltaIsValida(this._voltaAtual)) {
      // volta sem amostras válidas — descarta sem perturbar o padrão
      this._voltaAtual = voltaVazia();
      return null;
    }
    const volta = { ...this._voltaAtual, t: Date.now() };

    // Avalia ANTES de empurrar — a volta nova é comparada contra o padrão
    // das voltas anteriores (não contra a média que inclui ela mesma).
    // Avisa SEMPRE que avaliou, inclusive lista VAZIA: volta saudável LIMPA os
    // alertas preditivos da volta anterior (semântica aplicarPreditivos —
    // antes só avisava com alerta e o consumidor nunca tinha como limpar).
    if (this._padrao && this._voltas.length >= this._voltasMinPraPadrao) {
      const ids = avaliarPreditivoPorPadrao(volta, this._padrao, this._desvioPct);
      try { this._onAlertas(ids); }
      catch (e) { console.warn('[padrao-acumulador] onAlertas falhou:', e.message); }
    }

    this._voltas.push(volta);
    if (this._voltas.length > VOLTAS_MAX_NO_BUFFER) this._voltas.shift();

    // Recalcula padrão (inclusive a volta recém-empurrada) pra próximas voltas.
    if (this._voltas.length >= this._voltasMinPraPadrao) {
      this._padrao = calcularMediaVoltas(this._voltas);
    }

    // Persiste a combinação inteira (async, não bloqueia o reset).
    const payload = this.snapshot();
    Promise.resolve()
      .then(() => this._onPersist(payload))
      .catch(e => console.warn('[padrao-acumulador] onPersist falhou:', e.message));

    this._voltaAtual = voltaVazia();
    return volta;
  }

  /** Snapshot serializável pra persistir. */
  snapshot() {
    return {
      carroId: this.carroId,
      trackId: this.trackId,
      tipoPneu: this.tipoPneu,
      voltasAcumuladas: this._voltas.length,
      voltas: this._voltas,
      padrao: this._padrao,
      desvioPct: this._desvioPct,
    };
  }

  /** Status pra UI: aprendendo (< min) ou pronto. */
  getStatus() {
    return {
      aprendendo: this._voltas.length < this._voltasMinPraPadrao,
      voltasAcumuladas: this._voltas.length,
      voltasMinPraPadrao: this._voltasMinPraPadrao,
      padrao: this._padrao,
    };
  }
}
