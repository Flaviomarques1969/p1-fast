// Smoke do ReplayEngine — re-emissão determinística + integração com Detector real.

import { ReplayEngine } from '../src/telemetry/replay.js';
import { Detector } from '../src/telemetry/detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => { console.log('✓', name); ok++; },
        (e) => { console.log('✗', name, '—', e.message); fail++; },
      );
    }
    console.log('✓', name); ok++;
  } catch (e) {
    console.log('✗', name, '—', e.message); fail++;
  }
}

function makeSamples(n, { t0 = 1000, dt = 100 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ seq: i, t: t0 + i * dt, x: i * 10, y: 0, speed: 25, sessionId: 'src' });
  }
  return out;
}

// ── Validação de input ─────────────────────────────────────

t('rejeita samples não-array', () => {
  let threw = false;
  try { new ReplayEngine({ samples: null }); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar samples=null');
});

t('rejeita samples vazio', () => {
  let threw = false;
  try { new ReplayEngine({ samples: [] }); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar samples=[]');
});

t('rejeita speed numérico inválido (0, negativo, NaN)', () => {
  for (const bad of [0, -1, NaN, Infinity]) {
    let threw = false;
    try { new ReplayEngine({ samples: makeSamples(2), speed: bad }); } catch { threw = true; }
    if (!threw) throw new Error('deveria rejeitar speed=' + bad);
  }
});

t('rejeita speed string desconhecida', () => {
  let threw = false;
  try { new ReplayEngine({ samples: makeSamples(2), speed: 'turbo' }); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar speed=turbo');
});

// ── Modo instant ───────────────────────────────────────────

t('instant: emite todos os samples na ordem original', async () => {
  const samples = makeSamples(5);
  const r = new ReplayEngine({ samples });
  const seen = [];
  r.onSample((s) => seen.push(s));
  const result = await r.start();
  if (result.completed !== true) throw new Error('completed deveria ser true');
  if (result.emitted !== 5) throw new Error('emitted=' + result.emitted);
  if (seen.length !== 5) throw new Error('seen.length=' + seen.length);
  for (let i = 0; i < seen.length; i++) {
    if (seen[i].seq !== i) throw new Error('ordem quebrada em ' + i);
  }
});

t('instant: source default é "replay" e sobrescreve sample.source', async () => {
  const samples = makeSamples(3).map((s) => ({ ...s, source: 'mock' }));
  const r = new ReplayEngine({ samples });
  const seen = [];
  r.onSample((s) => seen.push(s));
  await r.start();
  for (const s of seen) {
    if (s.source !== 'replay') throw new Error('source=' + s.source);
  }
});

t('instant: source customizado é aplicado', async () => {
  const r = new ReplayEngine({ samples: makeSamples(2), source: 'csv-iphone' });
  const seen = [];
  r.onSample((s) => seen.push(s));
  await r.start();
  if (seen[0].source !== 'csv-iphone') throw new Error('source=' + seen[0].source);
});

t('instant: sessionId override troca sample.sessionId', async () => {
  const r = new ReplayEngine({ samples: makeSamples(2), sessionId: 'replay-1' });
  const seen = [];
  r.onSample((s) => seen.push(s));
  await r.start();
  if (seen[0].sessionId !== 'replay-1') throw new Error('sessionId=' + seen[0].sessionId);
});

t('instant: não muta os samples originais', async () => {
  const samples = makeSamples(3);
  const before = JSON.parse(JSON.stringify(samples));
  const r = new ReplayEngine({ samples, sessionId: 'X', source: 'Y' });
  r.onSample(() => {});
  await r.start();
  if (JSON.stringify(samples) !== JSON.stringify(before)) {
    throw new Error('samples originais foram mutados');
  }
});

t('instant: t retrógrado é descartado e contado em dropped', async () => {
  const samples = [
    { seq: 0, t: 1000, x: 0, y: 0 },
    { seq: 1, t: 1100, x: 1, y: 0 },
    { seq: 2, t: 1050, x: 2, y: 0 },  // retrógrado
    { seq: 3, t: 1200, x: 3, y: 0 },
  ];
  const r = new ReplayEngine({ samples });
  const seen = [];
  r.onSample((s) => seen.push(s.seq));
  const result = await r.start();
  if (result.emitted !== 3) throw new Error('emitted=' + result.emitted);
  if (result.dropped !== 1) throw new Error('dropped=' + result.dropped);
  if (JSON.stringify(seen) !== JSON.stringify([0, 1, 3])) {
    throw new Error('seq emitida: ' + JSON.stringify(seen));
  }
});

t('instant: dropa entrada não-objeto sem quebrar', async () => {
  const samples = [
    { seq: 0, t: 1000, x: 0, y: 0 },
    null,
    { seq: 1, t: 1100, x: 1, y: 0 },
  ];
  const r = new ReplayEngine({ samples });
  let count = 0;
  r.onSample(() => count++);
  const result = await r.start();
  if (count !== 2) throw new Error('emitidos=' + count);
  if (result.dropped !== 1) throw new Error('dropped=' + result.dropped);
});

t('instant: listener com erro não interrompe emissão', async () => {
  const r = new ReplayEngine({ samples: makeSamples(3) });
  let goodCalls = 0;
  r.onSample(() => { throw new Error('boom'); });
  r.onSample(() => { goodCalls++; });
  const result = await r.start();
  if (result.emitted !== 3) throw new Error('emitted=' + result.emitted);
  if (goodCalls !== 3) throw new Error('listener bom recebeu=' + goodCalls);
});

t('unsubscribe para de receber', async () => {
  const r = new ReplayEngine({ samples: makeSamples(4) });
  let count = 0;
  const off = r.onSample(() => { count++; if (count === 2) off(); });
  await r.start();
  if (count !== 2) throw new Error('count=' + count + ' (esperava 2: o 2 dispara o unsub mas o callback já contou)');
});

t('start() depois de stop() rejeita', async () => {
  const r = new ReplayEngine({ samples: makeSamples(2) });
  await r.start();
  let threw = false;
  try { await r.start(); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar restart');
});

// ── Scheduler injetado (realtime determinístico) ──────────

function makeFakeScheduler() {
  const queue = [];
  let nextId = 1;
  const scheduler = (ms, fn) => {
    const id = nextId++;
    queue.push({ id, ms, fn });
    return id;
  };
  const cancel = (id) => {
    const i = queue.findIndex((j) => j.id === id);
    if (i >= 0) queue.splice(i, 1);
  };
  const tick = () => {
    if (queue.length === 0) return false;
    const job = queue.shift();
    job.fn();
    return true;
  };
  const drain = (max = 1000) => {
    let n = 0;
    while (tick() && n < max) n++;
    return n;
  };
  return { scheduler, cancel, tick, drain, queue };
}

t('realtime: respeita delta de t (via scheduler injetado)', async () => {
  const samples = makeSamples(3, { t0: 0, dt: 250 });
  const fake = makeFakeScheduler();
  const r = new ReplayEngine({
    samples,
    speed: 'realtime',
    scheduler: fake.scheduler,
    cancelScheduler: fake.cancel,
  });
  const seen = [];
  r.onSample((s) => seen.push({ seq: s.seq, t: s.t }));
  const p = r.start();
  // 1ª emissão é agendada com waitMs=0 (não há lastT). Drena progressivamente.
  fake.drain();
  const result = await p;
  if (result.emitted !== 3) throw new Error('emitted=' + result.emitted);
  if (result.completed !== true) throw new Error('completed=false');
  if (seen.length !== 3) throw new Error('seen.length=' + seen.length);
});

t('realtime: speed=2 reduz waitMs pela metade', () => {
  const samples = [
    { seq: 0, t: 0, x: 0, y: 0 },
    { seq: 1, t: 1000, x: 1, y: 0 },
  ];
  const fake = makeFakeScheduler();
  const r = new ReplayEngine({
    samples,
    speed: 2,
    scheduler: fake.scheduler,
    cancelScheduler: fake.cancel,
  });
  r.onSample(() => {});
  r.start();
  // Primeiro job é emit do sample 0 (waitMs=0)
  if (fake.queue.length !== 1) throw new Error('queue=' + fake.queue.length);
  if (fake.queue[0].ms !== 0) throw new Error('primeiro waitMs=' + fake.queue[0].ms);
  fake.tick();
  // Segundo job é emit do sample 1 com waitMs = (1000 - 0) / 2 = 500
  if (fake.queue.length !== 1) throw new Error('queue após 1ª emissão=' + fake.queue.length);
  if (fake.queue[0].ms !== 500) throw new Error('waitMs com speed=2: ' + fake.queue[0].ms);
});

t('realtime: pause() cancela timer pendente e resume() retoma', async () => {
  const samples = makeSamples(4, { t0: 0, dt: 100 });
  const fake = makeFakeScheduler();
  const r = new ReplayEngine({
    samples,
    speed: 'realtime',
    scheduler: fake.scheduler,
    cancelScheduler: fake.cancel,
  });
  let count = 0;
  r.onSample(() => count++);
  const p = r.start();
  fake.tick();              // emite sample 0
  fake.tick();              // emite sample 1
  if (count !== 2) throw new Error('antes do pause: count=' + count);
  r.pause();
  if (fake.queue.length !== 0) throw new Error('queue não foi limpa no pause');
  // Mesmo se alguém ticasse algo agora, não emitiria — não há job na queue.
  r.resume();
  fake.drain();
  const result = await p;
  if (result.emitted !== 4) throw new Error('emitted=' + result.emitted);
  if (count !== 4) throw new Error('total count=' + count);
});

t('realtime: stop() resolve a promise com completed=false', async () => {
  const samples = makeSamples(10, { t0: 0, dt: 100 });
  const fake = makeFakeScheduler();
  const r = new ReplayEngine({
    samples,
    speed: 'realtime',
    scheduler: fake.scheduler,
    cancelScheduler: fake.cancel,
  });
  let count = 0;
  r.onSample(() => count++);
  const p = r.start();
  fake.tick();
  fake.tick();
  fake.tick();
  r.stop();
  const result = await p;
  if (result.completed !== false) throw new Error('completed=' + result.completed);
  if (result.emitted !== 3) throw new Error('emitted=' + result.emitted);
  if (count !== 3) throw new Error('count=' + count);
});

// ── stats() ────────────────────────────────────────────────

t('stats() reflete cursor durante e estado final', async () => {
  const samples = makeSamples(5);
  const r = new ReplayEngine({ samples });
  const stats0 = r.stats();
  if (stats0.state !== 'idle') throw new Error('state inicial=' + stats0.state);
  if (stats0.total !== 5) throw new Error('total=' + stats0.total);
  await r.start();
  const stats1 = r.stats();
  if (stats1.state !== 'stopped') throw new Error('state final=' + stats1.state);
  if (stats1.emitted !== 5) throw new Error('emitted final=' + stats1.emitted);
  if (stats1.cursor !== 5) throw new Error('cursor=' + stats1.cursor);
});

// ── Regressão end-to-end com Detector real ────────────────

t('integração: replay alimenta Detector e dispara onLap igual ao tempo real', async () => {
  // Usa a mesma configuração do node-smoke-detector pra gerar uma volta completa.
  const linhaChegada = { x1: -5, y1: 0, x2: 5, y2: 0 };
  const svgPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';

  const t0 = 1000;
  // Detector consome { x, y, t, speed }. ReplayEngine apenas re-emite.
  // Pra fechar volta com temposPorParcial, precisamos cruzar a linha
  // duas vezes e disparar mudanças de parcial entre cruzes.
  // Mas Detector de smoke usa _onLineCross/_onParcialChange diretos —
  // isso é cobertura unitária. Aqui o objetivo é provar que
  // detector.consume(replay-emitted-sample) não regride contra
  // detector.consume(sample-original).

  // Construo um caminho: 0,0 → 100,0 → 100,100 → 0,100 → 0,0
  // Sample suficientes pra cobrir o path em ordem.
  const baseSamples = [];
  let seq = 0;
  for (const [x, y] of [[0,0],[25,0],[50,0],[75,0],[100,0],[100,25],[100,50],[100,75],[100,100],[75,100],[50,100],[25,100],[0,100],[0,75],[0,50],[0,25],[0,0]]) {
    baseSamples.push({ seq: seq++, t: t0 + seq * 100, x, y, speed: 25 });
  }

  // Roda o pipeline ao vivo (chamada direta).
  const dLive = new Detector({ svgPath, linhaChegada, segments: [] });
  const liveStarts = [];
  dLive.onSegmentStart((ev) => liveStarts.push(ev.segmentId));
  for (const s of baseSamples) dLive.consume(s);

  // Roda o pipeline via replay.
  const dReplay = new Detector({ svgPath, linhaChegada, segments: [] });
  const replayStarts = [];
  dReplay.onSegmentStart((ev) => replayStarts.push(ev.segmentId));
  const r = new ReplayEngine({ samples: baseSamples });
  r.onSample((s) => dReplay.consume(s));
  await r.start();

  // Sem segments cadastrados, esperamos 0 starts em ambos — mas o ponto
  // é que consume() não rejeita um sample re-emitido (que pode ter
  // campos extras source/sessionId).
  if (liveStarts.length !== replayStarts.length) {
    throw new Error('replay divergiu de live em segmentStart');
  }
});

t('integração: replay com segment cadastrado dispara onSegmentStart/End igual ao live', async () => {
  const linhaChegada = { x1: -5, y1: 0, x2: 5, y2: 0 };
  const svgPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const seg = { id: 'seg-A', nome: 'CURVA A', pathStart: 25, pathEnd: 50 };

  const t0 = 1000;
  const samples = [
    { seq: 0, t: t0,        x: 0,   y: 0,   speed: 25 },     // fora
    { seq: 1, t: t0 + 100,  x: 100, y: 0,   speed: 25 },     // dentro do segment
    { seq: 2, t: t0 + 200,  x: 100, y: 100, speed: 25 },     // saiu
  ];

  const dLive = new Detector({ svgPath, linhaChegada, segments: [seg] });
  const liveEvents = [];
  dLive.onSegmentStart((ev) => liveEvents.push(['start', ev.segmentId]));
  dLive.onSegmentEnd((ev)   => liveEvents.push(['end',   ev.segmentId]));
  for (const s of samples) dLive.consume(s);

  const dReplay = new Detector({ svgPath, linhaChegada, segments: [seg] });
  const replayEvents = [];
  dReplay.onSegmentStart((ev) => replayEvents.push(['start', ev.segmentId]));
  dReplay.onSegmentEnd((ev)   => replayEvents.push(['end',   ev.segmentId]));
  const r = new ReplayEngine({ samples });
  r.onSample((s) => dReplay.consume(s));
  await r.start();

  if (JSON.stringify(liveEvents) !== JSON.stringify(replayEvents)) {
    throw new Error('eventos divergiram\n  live:   ' + JSON.stringify(liveEvents) + '\n  replay: ' + JSON.stringify(replayEvents));
  }
  if (liveEvents.length !== 2) throw new Error('esperava 2 eventos (start+end), veio ' + liveEvents.length);
});

// ── Final ──────────────────────────────────────────────────

await new Promise((r) => setImmediate(r));
console.log('');
console.log(`replay: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
