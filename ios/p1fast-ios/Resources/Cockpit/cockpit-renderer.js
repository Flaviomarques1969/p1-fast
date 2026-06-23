// CockpitRenderer — observa o CockpitState e aplica no DOM do mockup canônico.
//
// Spec: PLANO_FASE_1.md §6 MS-13 (cockpit web app no Windows 10,5")
// Mockup canônico de origem: _design-reference/mockup-cockpit-piloto.html
//
// REGRA DURA (Flávio 2026-05-09): este módulo só ESCREVE em data-attrs e
// propriedades já existentes no DOM canônico. Não adiciona elemento novo,
// não muda classe, não altera estrutura. Os data-attrs alvo são exatamente
// os 4 do mockup + os sub-campos derivados (delta, ação, apex, alert).
//
// Recebe `bindings` no construtor — referências diretas aos elementos do DOM.
// Em produção, `attachRendererToDocument(state, document)` resolve via
// getElementById/querySelector. Em teste, passamos objetos fake (sem jsdom).

import { ShiftMode, ShiftFire, MsgState, Tone, ApexEstado } from './cockpit-state.js';

/**
 * @typedef {Object} CockpitBindings
 * @property {Object} device          — div#device (carrega 3 data-attrs externos)
 * @property {Object} shiftLight      — div#shiftLight (data-state)
 * @property {Object[]} shiftDots     — array dos 12 .shift-light__dot
 * @property {Object} infoDelta       — .info__delta
 * @property {Object} infoAcao        — .info__acao
 * @property {Object} apexEntrada     — .apex__ponto[data-papel='entrada']
 * @property {Object} apexEntradaVal  — .apex__valor dentro do ponto entrada
 * @property {Object} apexFreio       — .apex__ponto[data-papel='freio']
 * @property {Object} apexFreioVal    — .apex__valor dentro do ponto freio
 * @property {Object} alertBloco      — #alertBloco
 * @property {Object} alertMsg        — #alertMsg
 */

const TONE_TO_CLASS = Object.freeze({
  [Tone.NEUTRO]: '',
  [Tone.BOM]:    'bom',
  [Tone.ERRO]:   'erro',
});

export class CockpitRenderer {
  /**
   * @param {Object} opts
   * @param {Object} opts.cockpitState
   * @param {CockpitBindings} opts.bindings
   * @param {boolean} [opts.applyImmediately=true] aplica estado atual ao plugar
   */
  constructor({ cockpitState, bindings, applyImmediately = true }) {
    if (!cockpitState) throw new Error('CockpitRenderer: cockpitState obrigatório');
    if (!bindings) throw new Error('CockpitRenderer: bindings obrigatório');
    this._cs = cockpitState;
    this._b = bindings;
    this._unsub = cockpitState.onChange((cur, prev, keys) => this._render(cur, keys));
    if (applyImmediately) this._render(cockpitState.get(), null);
  }

  detach() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }

  // ── render ────────────────────────────────────────────

  _render(state, changedKeys) {
    const all = changedKeys === null;
    if (all || changedKeys.includes('trechoStatus')) this._renderTrechoStatus(state);
    if (all || changedKeys.includes('shift'))        this._renderShift(state);
    if (all || changedKeys.includes('message'))      this._renderMessage(state);
    if (all || changedKeys.includes('delta'))        this._renderDelta(state);
    if (all || changedKeys.includes('acao'))         this._renderAcao(state);
    if (all || changedKeys.includes('apex'))         this._renderApex(state);
    if (all || changedKeys.includes('silencioso'))   this._renderSilencioso(state);
    if (all || changedKeys.includes('aprendizado'))  this._renderAprendizado(state);
    if (all || changedKeys.includes('flashIa'))      this._renderFlashIa(state);
  }

  // Pisca a tela verde quando a IA atinge 100% (calibrado).
  // Decisão Flávio 2026-05-29.
  _renderFlashIa(s) {
    if (!this._b.device) return;
    if (s.flashIa) {
      this._b.device.dataset.flashIa = 'on';
    } else {
      delete this._b.device.dataset.flashIa;
    }
  }

  // Barra de aprendizado do shift light contextual (canto esquerdo).
  // Aplica --pct CSS custom property + data-status + texto numérico + texto status.
  // Decisão Flávio 2026-05-29.
  _renderAprendizado(s) {
    const { aprendizadoBar, aprendizadoPct, aprendizadoStatusText } = this._b;
    if (!aprendizadoBar) return;
    const ap = s.aprendizado || { status: 'inativo', pct: 0 };
    aprendizadoBar.dataset.status = ap.status;
    if (aprendizadoBar.style && typeof aprendizadoBar.style.setProperty === 'function') {
      aprendizadoBar.style.setProperty('--pct', `${Math.round(ap.pct)}%`);
    }
    if (aprendizadoPct) {
      aprendizadoPct.textContent = `${Math.round(ap.pct)}%`;
    }
    if (aprendizadoStatusText) {
      aprendizadoStatusText.textContent = ap.status;
    }
  }

  _renderSilencioso(s) {
    if (!this._b.device) return;
    this._b.device.dataset.silencioso = s.silencioso ? 'sim' : 'nao';
  }

  _renderTrechoStatus(s) {
    if (!this._b.device) return;
    this._b.device.dataset.trechoStatus = s.trechoStatus;
  }

  _renderShift(s) {
    const { device, shiftLight, shiftDots } = this._b;
    if (!device || !shiftLight) return;

    const { mode, level, fire } = s.shift;

    // data-state do shift-light: off|lit|fire|overrev (igual mockup)
    if (mode === ShiftMode.OFF) {
      shiftLight.dataset.state = 'off';
    } else if (mode === ShiftMode.LIT) {
      shiftLight.dataset.state = 'lit';
    } else {
      shiftLight.dataset.state = mode; // 'fire' ou 'overrev'
    }

    // data-shift-fire no device — ativa flash quando FIRE
    device.dataset.shiftFire = fire === ShiftFire.ACTIVE ? 'active' : 'idle';

    // dots: liga `is-on` em tier ≤ level (par a par, das pontas pro centro),
    // apenas em LIT. A luz central (tier 9) nunca acende aqui — só no FIRE.
    if (Array.isArray(shiftDots)) {
      const dotsOn = mode === ShiftMode.LIT ? level : 0;
      for (const dot of shiftDots) {
        if (!dot || !dot.dataset || !dot.classList) continue;
        const tier = Number(dot.dataset.tier);
        const on = mode === ShiftMode.LIT && Number.isFinite(tier) && tier <= dotsOn;
        dot.classList.toggle('is-on', on);
      }
    }
  }

  _renderMessage(s) {
    const { device, alertBloco, alertMsg } = this._b;
    if (!device) return;
    if (s.message === null) {
      device.dataset.msgState = MsgState.OCULTA;
      return;
    }
    device.dataset.msgState = MsgState.ATIVA;
    if (alertBloco) alertBloco.dataset.tipo = s.message.tipo;
    if (alertMsg) alertMsg.textContent = s.message.texto;
  }

  _renderDelta(s) {
    const el = this._b.infoDelta;
    if (!el) return;
    const tone = TONE_TO_CLASS[s.delta.tone] ?? '';
    el.className = ('info__delta ' + tone).trim();
    el.textContent = s.delta.value;
  }

  _renderAcao(s) {
    const el = this._b.infoAcao;
    if (!el) return;
    const tone = TONE_TO_CLASS[s.acao.tone] ?? '';
    el.className = ('info__acao ' + tone).trim();
    el.textContent = s.acao.texto;
  }

  _renderApex(s) {
    this._renderApexEntrada(s);
    this._renderApexFreio(s);
    this._renderApexApice(s);
    this._renderApexSaida(s);
  }

  _renderApexEntrada(s) {
    const ponto = this._b.apexEntrada;
    const val = this._b.apexEntradaVal;
    if (!ponto) return;
    const e = s.apex.entrada;
    if (e.estado) ponto.dataset.estado = e.estado;
    if (val && typeof e.valorKmh === 'number') {
      val.innerHTML = e.valorKmh + '<small>km/h</small>';
    } else if (val && e.valorKmh === null) {
      val.innerHTML = '—';
    }
    // nomeCurva fica no state pra debug/log/comparação, mas NÃO desenha no painel —
    // piloto sabe em qual curva está, esse texto não agrega valor pra ele.
  }

  _renderApexFreio(s) {
    const ponto = this._b.apexFreio;
    const val = this._b.apexFreioVal;
    if (!ponto) return;
    const f = s.apex.freio;
    if (f.estado) ponto.dataset.estado = f.estado;
    if (val) {
      if (typeof f.deltaM === 'number') {
        // diferença em metros do ponto da melhor passagem (+ = mais tarde, - = antes)
        const sinal = f.deltaM > 0 ? '+' : '';
        val.innerHTML = sinal + f.deltaM + '<small>m</small>';
      } else if (typeof f.atualM === 'number' && typeof f.refM === 'number') {
        val.innerHTML = f.atualM + '<span class="apex__valor__sep">/</span>' + f.refM + '<small>m</small>';
      } else {
        val.innerHTML = '—';
      }
    }
  }

  _renderApexSaida(s) {
    const ponto = this._b.apexSaida;
    const val = this._b.apexSaidaVal;
    if (!ponto) return;
    const e = s.apex.saida;
    if (e.estado) ponto.dataset.estado = e.estado;
    if (val && typeof e.valorKmh === 'number') {
      val.innerHTML = e.valorKmh + '<small>km/h</small>';
    } else if (val && e.valorKmh === null) {
      val.innerHTML = '—';
    }
  }

  _renderApexApice(s) {
    // Decisão Flávio 27/05/2026: bolinha aponta pra ONDE ESTAVA o ápice
    // ideal em relação à posição do carro. Número central = distância ao
    // ponto ideal (m). Cor pelo estado (ok-melhor/ok-pior/pendente).
    const ponto = this._b.apexApice;
    const bola  = this._b.apexApiceBola;
    const num   = this._b.apexApiceNum;
    if (!ponto) return;
    const a = s.apex.apice;
    if (a.estado) ponto.dataset.estado = a.estado;
    if (bola) {
      if (typeof a.angleDeg === 'number' && Number.isFinite(a.angleDeg)) {
        if (typeof bola.style?.setProperty === 'function') {
          bola.style.setProperty('--erro-angulo', a.angleDeg + 'deg');
        }
      }
      // cor da bolinha segue estado: ok-melhor=verde, ok-pior=vermelho.
      if (a.estado === ApexEstado.OK_MELHOR) bola.dataset.erroCor = 'verde';
      else if (a.estado === ApexEstado.OK_PIOR) bola.dataset.erroCor = 'vermelho';
    }
    if (num && typeof a.distM === 'number' && Number.isFinite(a.distM)) {
      // formata em pt-BR com vírgula decimal (mantém paridade com mockup "1,2").
      const fixed = a.distM >= 10 ? a.distM.toFixed(0) : a.distM.toFixed(1);
      num.textContent = fixed.replace('.', ',');
    }
  }
}

// ── helper de produção (browser) ─────────────────────────────

export function attachRendererToDocument(cockpitState, document) {
  const shiftLight = document.getElementById('shiftLight');
  // Prefere selector explícito data-papel="entrada"; cai pra :first-child como fallback
  // pra compatibilidade com index-t3000.html (que ainda não tem o atributo).
  const apexEntrada = document.querySelector('.apex__ponto[data-papel="entrada"]')
                    || document.querySelector('.apex__ponto:first-child');
  const apexFreio = document.querySelector('.apex__ponto[data-papel="freio"]');
  const apexApice = document.querySelector('.apex__ponto[data-papel="apice"]');
  const apexSaida = document.querySelector('.apex__ponto[data-papel="saida"]');
  const bindings = {
    device:       document.getElementById('device'),
    shiftLight,
    shiftDots:    shiftLight ? Array.from(shiftLight.querySelectorAll('.shift-light__dot')) : [],
    infoDelta:    document.querySelector('.info__delta'),
    infoAcao:     document.querySelector('.info__acao'),
    apexEntrada,
    apexEntradaVal:   apexEntrada ? apexEntrada.querySelector('.apex__valor') : null,
    apexEntradaLabel: apexEntrada ? apexEntrada.querySelector('.apex__label') : null,
    apexFreio,
    apexFreioVal: apexFreio ? apexFreio.querySelector('.apex__valor') : null,
    apexApice,
    apexApiceBola: apexApice ? apexApice.querySelector('.apex__bola') : null,
    apexApiceNum:  apexApice ? apexApice.querySelector('.apex__bola__num') : null,
    apexSaida,
    apexSaidaVal: apexSaida ? apexSaida.querySelector('.apex__valor') : null,
    alertBloco:   document.getElementById('alertBloco'),
    alertMsg:     document.getElementById('alertMsg'),
    // Barra de aprendizado do shift light contextual (Flávio 2026-05-29)
    aprendizadoBar:        document.getElementById('aprendizadoBar'),
    aprendizadoPct:        document.getElementById('aprendizadoPct'),
    aprendizadoStatusText: document.getElementById('aprendizadoStatusText'),
  };
  return new CockpitRenderer({ cockpitState, bindings });
}
