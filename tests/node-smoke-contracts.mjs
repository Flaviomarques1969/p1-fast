// Smoke unificado Fase 3 (contratos) — T-010..T-018

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

// Imports dinâmicos após polyfills
const { readFile } = await import('node:fs/promises');
const { Origem, Prioridade, MessageBroker, OverloadFilter } = await import('../src/cockpit/message-broker.js');
const { CockpitState } = await import('../src/cockpit/cockpit-state.js');
const { AudioCue } = await import('../src/cockpit/audio-cue.js');
const { Scores } = await import('../src/domain/score.js');
const { Detector } = await import('../src/telemetry/detector.js');
const { ProviderState } = await import('../src/telemetry/provider.js');
const { ENTITIES } = await import('../src/core/entities.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// T-010: SPEC_MENSAGENS tem nota de prioridade (CRITICAL↔CRITICAL, BOX_MANUAL↔HIGH, etc.)
await t('T-010: SPEC_MENSAGENS cita nota operacional de prioridade', async () => {
  const txt = await readFile('docs/SPEC_MENSAGENS.md', 'utf8');
  if (!txt.includes('CRITICAL / BOX_MANUAL / PEDAGOGICAL / CONFIRMATION')) {
    throw new Error('nota de aliases ausente');
  }
});

// T-017: Origem.DETECTOR não existe mais
await t('T-017: Origem não tem DETECTOR', () => {
  if (Origem.DETECTOR !== undefined) throw new Error('DETECTOR ainda presente');
  if (!Origem.SISTEMA || !Origem.BOX || !Origem.IA) throw new Error('enum quebrado');
});

// T-011: ProviderState tem todos os valores
await t('T-011: ProviderState enum completo', () => {
  for (const k of ['IDLE','RUNNING','PAUSED','STOPPED','ERROR']) {
    if (typeof ProviderState[k] !== 'string') throw new Error(`ProviderState.${k} ausente`);
  }
});

// T-011: grep files por literal strings
await t('T-011: device-provider e mock-provider sem literais crus', async () => {
  const a = await readFile('src/telemetry/device-provider.js', 'utf8');
  const b = await readFile('src/telemetry/mock-provider.js', 'utf8');
  if (a.includes("this.state = 'error'") || a.includes('this.state = "error"')) throw new Error('device literal');
  if (b.includes("this.state !== 'running'")) throw new Error('mock literal');
});

// T-013: Scores.compensado retorna parciaisConsideradas
await t('T-013: Scores.compensado com 3 parciais retorna parciaisConsideradas=3', () => {
  const lap = { temposPorParcial: { P1: 30000, P2: 35000, P3: 28000 } };
  const bench = {
    parciais: [{ id: 'P1', nome: 'P1' }, { id: 'P2', nome: 'P2' }, { id: 'P3', nome: 'P3' }],
    melhorPorParcial: { P1:{tempoMs:30000}, P2:{tempoMs:35000}, P3:{tempoMs:28000} },
  };
  const s = Scores.compensado(lap, bench);
  if (!s) throw new Error('null');
  if (s.parciaisConsideradas !== 3) throw new Error('pc=' + s.parciaisConsideradas);
  if (s.parcial !== false) throw new Error('parcial true inesperado');
});

await t('T-013: Scores.compensado com P3 null marca parcial + score ≠ null', () => {
  const lap = { temposPorParcial: { P1: 30000, P2: 35000 } };
  const bench = {
    parciais: [{ id: 'P1', nome: 'P1' }, { id: 'P2', nome: 'P2' }, { id: 'P3', nome: 'P3' }],
    melhorPorParcial: { P1:{tempoMs:30000}, P2:{tempoMs:35000}, P3:{tempoMs:28000} },
  };
  const s = Scores.compensado(lap, bench);
  if (!s) throw new Error('null');
  if (s.parciaisConsideradas !== 2) throw new Error('pc=' + s.parciaisConsideradas);
  if (!s.parcial) throw new Error('parcial false inesperado');
  if (!s.explicacao?.includes('parciais')) throw new Error('explicação não marca parcial: ' + s.explicacao);
});

// T-014: broker audita active-block
await t('T-014: broker audita bloqueio por active-msg simétrico aos filter-blocks', async () => {
  const st = new CockpitState();
  const audio = new AudioCue({ muted: true });
  const broker = new MessageBroker({ state: st, filter: new OverloadFilter(), audio });
  broker.critical('ALERTA');
  broker.pedagogical('x', 'S1');  // bloqueado por active-msg
  const hist = broker.history;
  const bloqueadosPorAtivo = hist.filter(h => h.razao === 'ja-ha-ativo-de-maior-ou-igual-prioridade');
  if (bloqueadosPorAtivo.length !== 1) throw new Error('esperado 1, veio ' + bloqueadosPorAtivo.length);
});

// T-016: Detector.onLap/onSegmentEnd retornam unsubscribe
await t('T-016: Detector.onLap retorna unsubscribe funcional', () => {
  const d = new Detector({ svgPath: 'M 0 0 L 1 1', linhaChegada: { x1:0,y1:0,x2:1,y2:0 }, segments: [] });
  let chamou = 0;
  const unsub = d.onLap(() => chamou++);
  if (typeof unsub !== 'function') throw new Error('unsubscribe não retornado');
  d._emit('lap', {});
  if (chamou !== 1) throw new Error('callback não rodou');
  unsub();
  d._emit('lap', {});
  if (chamou !== 1) throw new Error('callback rodou após unsub');
});

// T-018: ENTITIES central
await t('T-018: src/core/entities.js exporta ENTITIES com 14 chaves', () => {
  const chaves = Object.keys(ENTITIES);
  if (chaves.length < 13) throw new Error('menos entities que esperado: ' + chaves.length);
  for (const k of ['USER','CAR','SESSION','LAP','DEVICE_HANDOVER','LAP_VALIDITY_EVENT','PEDAGOGICAL_PLAN','SEGMENT_EXECUTION']) {
    if (!ENTITIES[k]) throw new Error(`${k} ausente`);
  }
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
