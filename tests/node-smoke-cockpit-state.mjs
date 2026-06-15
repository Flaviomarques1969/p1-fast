// Smoke do CockpitState (MS-13.3) — modelo puro JS, zero DOM, zero browser API.
// Spec: PLANO_FASE_1.md §6 MS-13.3 (reescrito 2026-05-09 — ADR-023)

import {
  CockpitState,
  TrechoStatus,
  ShiftMode,
  ShiftFire,
  MsgTipo,
  Tone,
  ApexEstado,
  defaultCockpitState,
  classifyFreio,
  SHIFT_LEVEL_MIN,
  SHIFT_LEVEL_MAX,
  SHIFT_DOTS_TOTAL,
} from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ── Defaults ────────────────────────────────────────────

t('CST-01 defaultCockpitState retorna estado limpo', () => {
  const s = defaultCockpitState();
  if (s.trechoStatus !== TrechoStatus.NEUTRO) throw new Error('trechoStatus default');
  if (s.shift.mode !== ShiftMode.OFF) throw new Error('shift.mode default');
  if (s.shift.level !== 0) throw new Error('shift.level default');
  if (s.shift.fire !== ShiftFire.IDLE) throw new Error('shift.fire default');
  if (s.message !== null) throw new Error('message default deveria ser null');
  if (s.delta.tone !== Tone.NEUTRO) throw new Error('delta.tone default');
  if (s.acao.tone !== Tone.NEUTRO) throw new Error('acao.tone default');
  for (const papel of ['entrada', 'freio', 'apice', 'saida']) {
    if (!s.apex[papel]) throw new Error(`apex.${papel} faltando`);
  }
});

t('CST-02 CockpitState.get() retorna defaults se nada passado', () => {
  const c = new CockpitState();
  if (c.get().trechoStatus !== TrechoStatus.NEUTRO) throw new Error();
});

// ── Constantes da spec ───────────────────────────────────

t('CST-03 limites do shift level conferem com mockup', () => {
  if (SHIFT_LEVEL_MIN !== 0) throw new Error();
  if (SHIFT_LEVEL_MAX !== 6) throw new Error();
  if (SHIFT_DOTS_TOTAL !== 12) throw new Error();
});

t('CST-04 shiftDotsForLevel: 0→0, 6→12, monotônico no meio', () => {
  if (shiftDotsForLevel(0) !== 0) throw new Error('0→0');
  if (shiftDotsForLevel(6) !== 12) throw new Error('6→12');
  if (shiftDotsForLevel(3) !== 6) throw new Error('3→6');
  if (shiftDotsForLevel(-1) !== 0) throw new Error('clamp negativo');
  if (shiftDotsForLevel(99) !== 12) throw new Error('clamp acima');
});

// ── trechoStatus ─────────────────────────────────────────

t('CST-05 setTrechoStatus aceita os 4 valores canônicos', () => {
  const c = new CockpitState();
  for (const v of Object.values(TrechoStatus)) {
    c.setTrechoStatus(v);
    if (c.get().trechoStatus !== v) throw new Error(`não setou ${v}`);
  }
});

t('CST-06 setTrechoStatus rejeita valor fora do enum', () => {
  const c = new CockpitState();
  let threw = false;
  try { c.setTrechoStatus('invalido'); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar');
});

// ── shift ────────────────────────────────────────────────

t('CST-07 setShift aceita combinação parcial (só level, só mode, só fire)', () => {
  const c = new CockpitState();
  c.setShift({ level: 3 });
  if (c.get().shift.level !== 3) throw new Error();
  c.setShift({ mode: ShiftMode.LIT });
  if (c.get().shift.mode !== ShiftMode.LIT) throw new Error();
  c.setShift({ fire: ShiftFire.ACTIVE });
  if (c.get().shift.fire !== ShiftFire.ACTIVE) throw new Error();
});

t('CST-08 setShift rejeita level fora de 0..6', () => {
  const c = new CockpitState();
  for (const bad of [-1, 7, NaN, 'x', Infinity]) {
    let threw = false;
    try { c.setShift({ level: bad }); } catch { threw = true; }
    if (!threw) throw new Error(`deveria rejeitar level=${bad}`);
  }
});

t('CST-09 applyShift(LIT, 4) → mode=lit, level=4, fire=idle', () => {
  const c = new CockpitState();
  c.applyShift(ShiftMode.LIT, 4);
  const s = c.get().shift;
  if (s.mode !== ShiftMode.LIT) throw new Error();
  if (s.level !== 4) throw new Error();
  if (s.fire !== ShiftFire.IDLE) throw new Error();
});

t('CST-10 applyShift(FIRE) → mode=fire, fire=active, level=0', () => {
  const c = new CockpitState();
  c.applyShift(ShiftMode.LIT, 6);
  c.applyShift(ShiftMode.FIRE);
  const s = c.get().shift;
  if (s.mode !== ShiftMode.FIRE) throw new Error('mode');
  if (s.fire !== ShiftFire.ACTIVE) throw new Error('fire');
  if (s.level !== 0) throw new Error('level deveria zerar');
});

t('CST-11 applyShift(OVERREV) → mode=overrev, fire=idle, level=0', () => {
  const c = new CockpitState();
  c.applyShift(ShiftMode.OVERREV);
  const s = c.get().shift;
  if (s.mode !== ShiftMode.OVERREV) throw new Error();
  if (s.fire !== ShiftFire.IDLE) throw new Error();
  if (s.level !== 0) throw new Error();
});

// ── message ──────────────────────────────────────────────

t('CST-12 showMessage seta { tipo, texto }; hideMessage volta a null', () => {
  const c = new CockpitState();
  c.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'Pneu DD acima da janela' });
  if (!c.get().message) throw new Error('message não setou');
  if (c.get().message.tipo !== MsgTipo.COMUNICACAO) throw new Error();
  c.hideMessage();
  if (c.get().message !== null) throw new Error('hideMessage não limpou');
});

t('CST-13 showMessage rejeita tipo inválido e texto vazio', () => {
  const c = new CockpitState();
  let threwTipo = false;
  try { c.showMessage({ tipo: 'x', texto: 'oi' }); } catch { threwTipo = true; }
  if (!threwTipo) throw new Error('deveria rejeitar tipo');
  let threwTexto = false;
  try { c.showMessage({ tipo: MsgTipo.GRAVE, texto: '' }); } catch { threwTexto = true; }
  if (!threwTexto) throw new Error('deveria rejeitar texto vazio');
});

// ── delta + ação ────────────────────────────────────────

t('CST-14 setDelta valida tone enum', () => {
  const c = new CockpitState();
  c.setDelta({ value: '0.27', tone: Tone.BOM });
  if (c.get().delta.value !== '0.27') throw new Error();
  if (c.get().delta.tone !== Tone.BOM) throw new Error();
  let threw = false;
  try { c.setDelta({ value: '0.27', tone: 'wat' }); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar tone');
});

t('CST-15 setAcao valida tone e exige string em texto', () => {
  const c = new CockpitState();
  c.setAcao({ texto: 'ÁPICE TARDE', tone: Tone.NEUTRO });
  if (c.get().acao.texto !== 'ÁPICE TARDE') throw new Error();
  let threw = false;
  try { c.setAcao({ texto: 123, tone: Tone.BOM }); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar texto numérico');
});

// ── apex ─────────────────────────────────────────────────

t('CST-16 setApexPonto aceita papel canônico e ignora no-op', () => {
  const c = new CockpitState();
  c.setApexPonto('entrada', { estado: ApexEstado.OK_MELHOR, valorKmh: 95 });
  const e = c.get().apex.entrada;
  if (e.estado !== ApexEstado.OK_MELHOR) throw new Error();
  if (e.valorKmh !== 95) throw new Error();
});

t('CST-17 setApexPonto rejeita papel inválido', () => {
  const c = new CockpitState();
  let threw = false;
  try { c.setApexPonto('saida2', { valorKmh: 80 }); } catch { threw = true; }
  if (!threw) throw new Error();
});

t('CST-18 classifyFreio: ±10% da ref vira ok-melhor, fora vira ok-pior', () => {
  if (classifyFreio(15, 16) !== ApexEstado.OK_MELHOR) throw new Error('15 dentro de 16±1.6');
  if (classifyFreio(17, 16) !== ApexEstado.OK_MELHOR) throw new Error('17 dentro');
  if (classifyFreio(13, 16) !== ApexEstado.OK_PIOR) throw new Error('13 fora');
  if (classifyFreio(22, 16) !== ApexEstado.OK_PIOR) throw new Error('22 fora');
  if (classifyFreio('x', 16) !== ApexEstado.OK_PIOR) throw new Error('input inválido');
  if (classifyFreio(15, 0)  !== ApexEstado.OK_PIOR) throw new Error('ref zero');
});

// ── observer ─────────────────────────────────────────────

t('CST-19 onChange dispara só quando estado realmente mudou', () => {
  const c = new CockpitState();
  let calls = 0;
  c.onChange(() => calls++);
  c.setTrechoStatus(TrechoStatus.RECORDE_STINT);
  c.setTrechoStatus(TrechoStatus.RECORDE_STINT); // no-op
  if (calls !== 1) throw new Error(`esperado 1 call, recebeu ${calls}`);
});

t('CST-20 onChange recebe (newState, prevState, changedKeys)', () => {
  const c = new CockpitState();
  let observedKeys = null;
  let observedDeltaValPrev = null;
  c.onChange((cur, prev, keys) => { observedKeys = keys; observedDeltaValPrev = prev.delta.value; });
  c.setDelta({ value: '0.42', tone: Tone.ERRO });
  if (!observedKeys || !observedKeys.includes('delta')) throw new Error('keys');
  if (observedDeltaValPrev !== '0.00') throw new Error(`prev value esperado 0.00, recebeu ${observedDeltaValPrev}`);
});

t('CST-21 onChange unsubscribe não vaza listener', () => {
  const c = new CockpitState();
  let calls = 0;
  const unsub = c.onChange(() => calls++);
  c.setTrechoStatus(TrechoStatus.RECORDE_STINT);
  unsub();
  c.setTrechoStatus(TrechoStatus.PIOR_STINT);
  if (calls !== 1) throw new Error(`esperado 1 call após unsub, recebeu ${calls}`);
});

t('CST-22 listener que lança erro não derruba outros listeners', () => {
  const c = new CockpitState();
  let okCalled = false;
  const origError = console.error;
  console.error = () => {}; // silencia o aviso esperado
  try {
    c.onChange(() => { throw new Error('boom'); });
    c.onChange(() => { okCalled = true; });
    c.setTrechoStatus(TrechoStatus.RECORDE_STINT);
    if (!okCalled) throw new Error('listener saudável não foi chamado');
  } finally {
    console.error = origError;
  }
});

// ── applyHaloPreset (mapeia presets canônicos do mockup) ──

t('CST-23 applyHaloPreset(recorde-stint) bate com haloStates do canônico', () => {
  // preset extraído de cockpit.js linha ~100
  const preset = {
    halo: 'recorde-stint',
    deltaClass: 'bom',  deltaVal: '0.27',
    acaoText: 'ÁPICE TARDE', acaoClass: '',
    entradaEstado: 'ok-melhor', entradaVal: '95',
    freioAtual: 15,
  };
  const c = new CockpitState();
  c.applyHaloPreset(preset);
  const s = c.get();
  if (s.trechoStatus !== TrechoStatus.RECORDE_STINT) throw new Error('trechoStatus');
  if (s.delta.tone !== Tone.BOM) throw new Error('delta tone');
  if (s.delta.value !== '0.27') throw new Error('delta value');
  if (s.acao.texto !== 'ÁPICE TARDE') throw new Error('acao texto');
  if (s.acao.tone !== Tone.NEUTRO) throw new Error('acao tone neutro (acaoClass vazio)');
  if (s.apex.entrada.estado !== ApexEstado.OK_MELHOR) throw new Error('apex entrada estado');
  if (s.apex.entrada.valorKmh !== 95) throw new Error('apex entrada val');
  if (s.apex.freio.atualM !== 15) throw new Error('apex freio atualM');
});

t('CST-24 applyHaloPreset(pior-stint) leva a delta ERRO + entrada ok-pior', () => {
  const preset = {
    halo: 'pior-stint',
    deltaClass: 'erro', deltaVal: '0.42',
    acaoText: 'FREIE TARDE', acaoClass: 'erro',
    entradaEstado: 'ok-pior', entradaVal: '88',
    freioAtual: 22,
  };
  const c = new CockpitState();
  c.applyHaloPreset(preset);
  const s = c.get();
  if (s.trechoStatus !== TrechoStatus.PIOR_STINT) throw new Error();
  if (s.delta.tone !== Tone.ERRO) throw new Error();
  if (s.acao.tone !== Tone.ERRO) throw new Error();
  if (s.apex.entrada.estado !== ApexEstado.OK_PIOR) throw new Error();
});

console.log(`\nCockpitState: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
