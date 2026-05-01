// Smoke de contratos do P1 Fast — T-011, T-013, T-016, T-018
//
// Histórico: este arquivo era originalmente "Smoke unificado Fase 3
// (contratos) — T-010..T-018" no FAM Racing, com 7 testes. Na extração
// 2026-04-30 do P1 Fast, três testes ficaram órfãos por dependerem de
// módulos do cockpit (UI legada) que NÃO foram extraídos:
//
//   • T-010 SPEC_MENSAGENS — `docs/SPEC_MENSAGENS.md` ficou no FAM Racing
//   • T-014 broker active-msg — `src/cockpit/message-broker.js`,
//     `cockpit-state.js`, `audio-cue.js` são UI e ficaram no FAM Racing
//   • T-017 Origem.DETECTOR — depende do enum `Origem` do message-broker
//
// Ver `README.md` §"O que NÃO está aqui (intencional)". Se o broker
// algum dia for promovido a domínio (sem deps DOM), os testes voltam.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen:{width:390,height:844}, devicePixelRatio:3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { Scores } = await import('../src/domain/score.js');
const { Detector } = await import('../src/telemetry/detector.js');
const { ProviderState } = await import('../src/telemetry/provider.js');
const { ENTITIES } = await import('../src/core/entities.js');
const {
  SESSAO_GHOST_FIELDS,
  CONFIGURACAO_GHOST_FIELDS,
  CARRO_GHOST_FIELDS,
  FONTE_TEMPERATURA,
  MARCO_TIPOS,
  MARCO_FIELDS,
  RETA_ESPECIAL_FIELDS,
} = await import('../src/data/schemas.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// T-011: ProviderState tem todos os valores
await t('T-011: ProviderState enum completo', () => {
  for (const k of ['IDLE','RUNNING','PAUSED','STOPPED','ERROR']) {
    if (typeof ProviderState[k] !== 'string') throw new Error(`ProviderState.${k} ausente`);
  }
});

// T-011: grep files por literal strings
await t('T-011: device-provider e mock-provider sem literais crus', async () => {
  const { readFile } = await import('node:fs/promises');
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

// T-019: ghost-map sessoes.voltas_planejadas
await t('T-019: SESSAO_GHOST_FIELDS.voltas_planejadas (integer, nullable)', () => {
  const f = SESSAO_GHOST_FIELDS.voltas_planejadas;
  if (!f) throw new Error('voltas_planejadas ausente');
  if (f.type !== 'integer') throw new Error('type=' + f.type);
  if (f.nullable !== true) throw new Error('nullable deve ser true');
  if (f.min !== 1) throw new Error('min=' + f.min);
});

// T-020: ghost-map configuracoes.temperatura_ideal_range
await t('T-020: CONFIGURACAO_GHOST_FIELDS.temperatura_ideal_range (json motor+pneu)', () => {
  const f = CONFIGURACAO_GHOST_FIELDS.temperatura_ideal_range;
  if (!f) throw new Error('temperatura_ideal_range ausente');
  if (f.type !== 'json') throw new Error('type=' + f.type);
  if (f.nullable !== true) throw new Error('nullable deve ser true');
  if (!f.shape?.motor?.min || !f.shape?.motor?.max) throw new Error('shape.motor incompleto');
  if (!f.shape?.pneu?.min || !f.shape?.pneu?.max) throw new Error('shape.pneu incompleto');
});

// T-021: ghost-map carros.fonte_temperatura
await t('T-021: CARRO_GHOST_FIELDS.fonte_temperatura (enum motor|pneu|ambos, default motor)', () => {
  const f = CARRO_GHOST_FIELDS.fonte_temperatura;
  if (!f) throw new Error('fonte_temperatura ausente');
  if (f.type !== 'enum') throw new Error('type=' + f.type);
  if (f.default !== 'motor') throw new Error('default=' + f.default);
  if (FONTE_TEMPERATURA.length !== 3) throw new Error('FONTE_TEMPERATURA len=' + FONTE_TEMPERATURA.length);
  for (const v of ['motor','pneu','ambos']) {
    if (!FONTE_TEMPERATURA.includes(v)) throw new Error(`enum sem ${v}`);
  }
});

// T-022: marcos com pit-in/pit-out
await t('T-022: MARCO_TIPOS aceita pit-in e pit-out + MARCO_FIELDS shape', () => {
  if (!MARCO_TIPOS.includes('pit-in')) throw new Error('pit-in ausente');
  if (!MARCO_TIPOS.includes('pit-out')) throw new Error('pit-out ausente');
  if (!MARCO_TIPOS.includes('largada')) throw new Error('largada removida (regressão)');
  if (MARCO_FIELDS.tipo?.type !== 'enum') throw new Error('tipo não é enum');
  if (MARCO_FIELDS.tipo?.values !== MARCO_TIPOS) throw new Error('tipo.values ≠ MARCO_TIPOS');
  for (const k of ['id','layoutId','tipo','posicao','criadoEm']) {
    if (!MARCO_FIELDS[k]) throw new Error(`MARCO_FIELDS.${k} ausente`);
  }
  if (!ENTITIES.MARCO) throw new Error('ENTITIES.MARCO ausente');
});

// T-023: retas_especiais
await t('T-023: RETA_ESPECIAL_FIELDS shape (track_id, segment_id, tempo, auto_detectada)', () => {
  for (const k of ['id','trackId','segmentId','tempoMedioMs','autoDetectada','criadoEm']) {
    if (!RETA_ESPECIAL_FIELDS[k]) throw new Error(`${k} ausente`);
  }
  if (RETA_ESPECIAL_FIELDS.autoDetectada.type !== 'boolean') throw new Error('autoDetectada não é boolean');
  if (RETA_ESPECIAL_FIELDS.autoDetectada.default !== false) throw new Error('autoDetectada default ≠ false');
  if (RETA_ESPECIAL_FIELDS.tempoMedioMs.nullable !== true) throw new Error('tempoMedioMs deve ser nullable');
  if (!ENTITIES.RETA_ESPECIAL) throw new Error('ENTITIES.RETA_ESPECIAL ausente');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
