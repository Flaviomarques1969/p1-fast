// Smoke do CockpitRenderer (MS-13.4 parte 3) — observador CockpitState→DOM.
// Spec: PLANO_FASE_1.md §6 MS-13 + ADR-023.
// Usa fakes de DOM minimalistas (sem jsdom — evita dep nova).

import { CockpitRenderer } from '../web/cockpit/cockpit-renderer.js';
import {
  CockpitState,
  TrechoStatus,
  ShiftMode,
  ShiftFire,
  MsgTipo,
  Tone,
  ApexEstado,
} from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ── DOM fake (mínimo viável pra o renderer) ────────────────

function makeEl({ tier } = {}) {
  const el = {
    dataset: tier !== undefined ? { tier: String(tier) } : {},
    textContent: '',
    innerHTML: '',
    className: '',
    _classes: new Set(),
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      toggle: (c, on) => {
        if (on === undefined) {
          if (el._classes.has(c)) el._classes.delete(c);
          else el._classes.add(c);
        } else if (on) el._classes.add(c);
        else el._classes.delete(c);
      },
      contains: (c) => el._classes.has(c),
    },
  };
  return el;
}

function makeBindings() {
  const dots = [];
  const TIERS = [1,2,3,4,5,6,7,8,9,8,7,6,5,4,3,2,1]; // 17 luzes espelhadas, central = 9
  for (const t of TIERS) dots.push(makeEl({ tier: t }));
  return {
    device:         makeEl(),
    shiftLight:     makeEl(),
    shiftDots:      dots,
    infoDelta:      makeEl(),
    infoAcao:       makeEl(),
    apexEntrada:    makeEl(),
    apexEntradaVal: makeEl(),
    apexFreio:      makeEl(),
    apexFreioVal:   makeEl(),
    alertBloco:     makeEl(),
    alertMsg:       makeEl(),
  };
}

// ── Boot inicial: renderer aplica estado default ──────────

t('CKR-01 ao plugar, renderer aplica estado inicial nos data-attrs', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  if (b.device.dataset.trechoStatus !== TrechoStatus.NEUTRO) throw new Error('trecho default');
  if (b.shiftLight.dataset.state !== 'off') throw new Error('shift default');
  if (b.device.dataset.shiftFire !== 'idle') throw new Error('shiftFire default');
  if (b.device.dataset.msgState !== 'oculta') throw new Error('msgState default');
});

// ── trechoStatus ──────────────────────────────────────────

t('CKR-02 setTrechoStatus(recorde-stint) → device.dataset.trechoStatus', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setTrechoStatus(TrechoStatus.RECORDE_STINT);
  if (b.device.dataset.trechoStatus !== 'recorde-stint') throw new Error();
});

// ── shift LEDs ───────────────────────────────────────────

t('CKR-03 applyShift(LIT, 8) → state="lit", 16 laterais on (tier 1-8), central (tier 9) off', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.applyShift(ShiftMode.LIT, 8);
  if (b.shiftLight.dataset.state !== 'lit') throw new Error('state');
  let on = 0;
  for (const d of b.shiftDots) {
    const tier = Number(d.dataset.tier);
    const lit = d._classes.has('is-on');
    if (tier <= 8 && !lit) throw new Error(`tier ${tier} deveria estar on`);
    if (tier === 9 && lit) throw new Error('central (tier 9) NÃO acende no LIT — só no FIRE');
    if (lit) on++;
  }
  if (on !== 16) throw new Error(`esperado 16 laterais, recebeu ${on}`);
});

t('CKR-04 applyShift(LIT, 4) → 8 dots acesos (tier ≤ 4, 4 verdes de cada lado)', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.applyShift(ShiftMode.LIT, 4); // tier ≤ 4 → 8 dots
  let on = 0;
  for (const d of b.shiftDots) if (d._classes.has('is-on')) on++;
  if (on !== 8) throw new Error(`esperado 8 dots, recebeu ${on}`);
});

t('CKR-05 applyShift(FIRE) → device.dataset.shiftFire=active, dots desligados', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.applyShift(ShiftMode.LIT, 6);
  cs.applyShift(ShiftMode.FIRE);
  if (b.shiftLight.dataset.state !== 'fire') throw new Error('state');
  if (b.device.dataset.shiftFire !== 'active') throw new Error('shiftFire');
  for (const d of b.shiftDots) {
    if (d._classes.has('is-on')) throw new Error('FIRE deveria desligar dots');
  }
});

t('CKR-06 applyShift(OVERREV) → state=overrev, fire=idle, dots desligados', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.applyShift(ShiftMode.OVERREV);
  if (b.shiftLight.dataset.state !== 'overrev') throw new Error();
  if (b.device.dataset.shiftFire !== 'idle') throw new Error();
});

// ── message ──────────────────────────────────────────────

t('CKR-07 showMessage(grave, "Pressão óleo crítica") → tudo conectado', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.showMessage({ tipo: MsgTipo.GRAVE, texto: 'Pressão óleo crítica' });
  if (b.device.dataset.msgState !== 'ativa') throw new Error('msgState');
  if (b.alertBloco.dataset.tipo !== 'grave') throw new Error('tipo');
  if (b.alertMsg.textContent !== 'Pressão óleo crítica') throw new Error('texto');
});

t('CKR-08 hideMessage volta msgState pra oculta', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'oi' });
  cs.hideMessage();
  if (b.device.dataset.msgState !== 'oculta') throw new Error();
});

// ── delta + ação ────────────────────────────────────────

t('CKR-09 setDelta aplica className "info__delta erro" + textContent', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setDelta({ value: '0.42', tone: Tone.ERRO });
  if (b.infoDelta.className !== 'info__delta erro') throw new Error(b.infoDelta.className);
  if (b.infoDelta.textContent !== '0.42') throw new Error();
});

t('CKR-10 setDelta com tone NEUTRO mantém só "info__delta" sem sufixo', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setDelta({ value: '0.00', tone: Tone.NEUTRO });
  if (b.infoDelta.className !== 'info__delta') throw new Error(b.infoDelta.className);
});

t('CKR-11 setAcao aplica className "info__acao bom" + textContent', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setAcao({ texto: 'ÁPICE TARDE', tone: Tone.BOM });
  if (b.infoAcao.className !== 'info__acao bom') throw new Error(b.infoAcao.className);
  if (b.infoAcao.textContent !== 'ÁPICE TARDE') throw new Error();
});

// ── apex entrada/freio ───────────────────────────────────

t('CKR-12 setApexPonto(entrada) → ponto.dataset.estado + valor.innerHTML com <small>', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setApexPonto('entrada', { estado: ApexEstado.OK_MELHOR, valorKmh: 95 });
  if (b.apexEntrada.dataset.estado !== 'ok-melhor') throw new Error('estado');
  if (b.apexEntradaVal.innerHTML !== '95<small>km/h</small>') throw new Error(b.apexEntradaVal.innerHTML);
});

t('CKR-13 setApexPonto(freio) com atualM+refM → "<atual>/<ref>m" markup canônico', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.setApexPonto('freio', { estado: ApexEstado.OK_PIOR, atualM: 22, refM: 16 });
  if (b.apexFreio.dataset.estado !== 'ok-pior') throw new Error();
  const expected = '22<span class="apex__valor__sep">/</span>16<small>m</small>';
  if (b.apexFreioVal.innerHTML !== expected) throw new Error(b.apexFreioVal.innerHTML);
});

// ── Resilência: bindings parciais ────────────────────────

t('CKR-14 renderer não falha se bindings vierem incompletos (campos null)', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  // Simula bindings parciais — alguns elementos não foram achados
  b.alertBloco = null;
  b.apexFreioVal = null;
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'sem alertBloco no DOM' });
  cs.setApexPonto('freio', { atualM: 18, refM: 16 });
  // não lançou — passou
});

t('CKR-15 detach() para de reagir a mudanças', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  const r = new CockpitRenderer({ cockpitState: cs, bindings: b });
  r.detach();
  cs.setTrechoStatus(TrechoStatus.PIOR_STINT);
  if (b.device.dataset.trechoStatus === 'pior-stint') throw new Error('detach falhou');
});

// ── Cenário composto ────────────────────────────────────

t('CKR-16 cenário: aplicar haloPreset(recorde-stint) → DOM espelha o mockup', () => {
  const cs = new CockpitState();
  const b = makeBindings();
  new CockpitRenderer({ cockpitState: cs, bindings: b });
  cs.applyHaloPreset({
    halo: 'recorde-stint',
    deltaClass: 'bom', deltaVal: '0.27',
    acaoText: 'ÁPICE TARDE', acaoClass: '',
    entradaEstado: 'ok-melhor', entradaVal: '95',
    freioAtual: 15, freioRef: 16,
  });
  if (b.device.dataset.trechoStatus !== 'recorde-stint') throw new Error('trecho');
  if (b.infoDelta.className !== 'info__delta bom') throw new Error('delta class');
  if (b.infoDelta.textContent !== '0.27') throw new Error('delta text');
  if (b.infoAcao.textContent !== 'ÁPICE TARDE') throw new Error('acao text');
  if (b.apexEntrada.dataset.estado !== 'ok-melhor') throw new Error('entrada');
  if (b.apexEntradaVal.innerHTML !== '95<small>km/h</small>') throw new Error('entrada val');
});

t('CKR-17 construtor exige cockpitState e bindings', () => {
  for (const opts of [{}, { cockpitState: new CockpitState() }, { bindings: makeBindings() }]) {
    let threw = false;
    try { new CockpitRenderer(opts); } catch { threw = true; }
    if (!threw) throw new Error(`deveria rejeitar ${JSON.stringify(Object.keys(opts))}`);
  }
});

console.log(`\nCockpitRenderer: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
