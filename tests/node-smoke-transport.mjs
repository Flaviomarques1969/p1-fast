// Smoke do TransportSelector (MS-13.4) — failover cabo↔Realtime.
// Spec: PLANO_FASE_1.md §6 MS-13.4 + ADR-023 amendment 2 (Flávio 2026-05-09)
// Implementação: web/cockpit/transport.js

import {
  TransportSelector,
  MockTransport,
  TransportName,
  SelectorState,
  TransportHealth,
  DEFAULTS,
} from '../web/cockpit/transport.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Helper: cria uma sessão de teste com clock controlável e os 3 elementos plugados.
function makeRig() {
  let now = 0;
  const messages = [];
  const switches = [];
  const primary = new MockTransport('primary');
  const fallback = new MockTransport('fallback');
  const sel = new TransportSelector({
    primary,
    fallback,
    onMessage: (e) => messages.push(e),
    onSwitch: (stage, info) => switches.push({ stage, ...info }),
    now: () => now,
  });
  return {
    sel, primary, fallback, messages, switches,
    advance(ms) { now += ms; sel.tick(); },
    setNow(t) { now = t; sel.tick(); },
    getNow() { return now; },
  };
}

const HB = (now) => ({ tMono: now, source: 'heartbeat', payload: null });
const SAMPLE = (now, value) => ({ tMono: now, source: 'iphone-imu', payload: { v: value } });

// ── Defaults da spec ─────────────────────────────────────

t('TRP-01 defaults: silenceTimeoutMs=3000, recoveryDebounceMs=1000', () => {
  if (DEFAULTS.silenceTimeoutMs !== 3000) throw new Error();
  if (DEFAULTS.recoveryDebounceMs !== 1000) throw new Error();
  if (DEFAULTS.heartbeatExpectedMs !== 1000) throw new Error();
});

// ── Início no primary ───────────────────────────────────

t('TRP-02 começa em ON_PRIMARY', () => {
  const rig = makeRig();
  rig.sel.start();
  if (rig.sel.getStats().state !== SelectorState.ON_PRIMARY) throw new Error();
});

t('TRP-03 forwarda mensagem do primary quando saudável', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.primary.inject(SAMPLE(0, 'a'));
  if (rig.messages.length !== 1) throw new Error();
  if (rig.messages[0].payload.v !== 'a') throw new Error();
});

t('TRP-04 ignora mensagem do fallback enquanto está no primary', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.fallback.inject(SAMPLE(0, 'b'));
  if (rig.messages.length !== 0) throw new Error('não deveria forwardar fallback no primary');
  if (rig.sel.getStats().packetsDropped !== 1) throw new Error();
});

// ── Heartbeat e silêncio ────────────────────────────────

t('TRP-05 heartbeat do primary não é forwardado pro consumer', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.primary.inject(HB(0));
  if (rig.messages.length !== 0) throw new Error('heartbeat vazou pro consumer');
});

t('TRP-06 silêncio de 3s do primary → switch pro fallback', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.primary.inject(HB(0));
  rig.advance(2999); // ainda não passou o threshold
  if (rig.sel.getStats().state !== SelectorState.ON_PRIMARY) throw new Error('switchou cedo');
  rig.advance(2);    // total 3001 ms desde o heartbeat
  if (rig.sel.getStats().state !== SelectorState.ON_FALLBACK) throw new Error('não switchou');
  if (rig.sel.getStats().switchesToFallback !== 1) throw new Error();
  const sc = rig.switches.find(s => s.stage === 'state-change' && s.to === SelectorState.ON_FALLBACK);
  if (!sc) throw new Error('faltou onSwitch state-change');
  if (sc.reason !== 'silence') throw new Error('reason esperado silence');
});

// ── No fallback ────────────────────────────────────────

t('TRP-07 já no fallback, forwarda mensagem do fallback', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001); // força switch
  rig.fallback.inject(SAMPLE(rig.getNow(), 'c'));
  if (rig.messages.length !== 1) throw new Error();
  if (rig.messages[0].payload.v !== 'c') throw new Error();
});

t('TRP-08 já no fallback, ignora mensagem do primary (sem duplicar)', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001);
  rig.primary.inject(SAMPLE(rig.getNow(), 'd')); // primary chegou tarde, ignora
  if (rig.messages.length !== 0) throw new Error('não deveria duplicar');
  if (rig.sel.getStats().packetsDropped < 1) throw new Error();
});

// ── Recovery (primary volta) ────────────────────────────

t('TRP-09 primary volta a heartbeatar → entra em RECOVERING', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001); // switch pro fallback
  rig.primary.inject(HB(rig.getNow()));
  if (rig.sel.getStats().state !== SelectorState.RECOVERING) throw new Error();
});

t('TRP-10 RECOVERING + 1s de heartbeat estável → volta pro primary', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001);
  rig.primary.inject(HB(rig.getNow()));
  rig.advance(500);
  rig.primary.inject(HB(rig.getNow())); // heartbeat 2
  rig.advance(600); // total 1100ms desde início da recovery
  if (rig.sel.getStats().state !== SelectorState.ON_PRIMARY) throw new Error();
  if (rig.sel.getStats().switchesToPrimary !== 1) throw new Error();
});

t('TRP-11 RECOVERING aborta se primary silencia de novo', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001);
  rig.primary.inject(HB(rig.getNow())); // entra em RECOVERING
  rig.advance(3001); // primary não heartbeatou de novo → volta pro fallback
  if (rig.sel.getStats().state !== SelectorState.ON_FALLBACK) throw new Error();
  const aborted = rig.switches.find(s => s.reason === 'recovery-aborted');
  if (!aborted) throw new Error('faltou onSwitch recovery-aborted');
});

t('TRP-12 RECOVERING forwarda dados do primary mesmo antes do debounce', () => {
  // Decisão: minimiza latência — quando primary volta, dá pra usar sample dele
  // imediatamente. O debounce serve só pra confirmar saúde antes de PARAR de
  // assinar fallback (aqui está implícito que fallback continua ligado em paralelo).
  const rig = makeRig();
  rig.sel.start();
  rig.advance(3001);
  rig.primary.inject(HB(rig.getNow())); // RECOVERING
  rig.primary.inject(SAMPLE(rig.getNow(), 'recover-data'));
  if (rig.messages.length !== 1) throw new Error();
  if (rig.messages[0].payload.v !== 'recover-data') throw new Error();
});

// ── Edge cases ─────────────────────────────────────────

t('TRP-13 stop() impede novos forwards', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.sel.stop();
  rig.primary.inject(SAMPLE(0, 'after-stop'));
  if (rig.messages.length !== 0) throw new Error();
});

t('TRP-14 construtor exige primary, fallback e onMessage', () => {
  for (const opts of [
    {},
    { primary: new MockTransport('p') },
    { primary: new MockTransport('p'), fallback: new MockTransport('f') }, // sem onMessage
  ]) {
    let threw = false;
    try { new TransportSelector(opts); } catch { threw = true; }
    if (!threw) throw new Error(`deveria rejeitar opts=${JSON.stringify(opts)}`);
  }
});

t('TRP-15 stats exibe contadores e last heartbeat ago', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.primary.inject(HB(0));
  rig.advance(500);
  rig.primary.inject(SAMPLE(0, 'x'));
  rig.advance(500);
  const s = rig.sel.getStats();
  if (s.packetsForwarded !== 1) throw new Error('forward count');
  if (s.lastPrimaryHeartbeatAgoMs < 900 || s.lastPrimaryHeartbeatAgoMs > 1100) {
    throw new Error(`lastHeartbeatAgo fora de banda: ${s.lastPrimaryHeartbeatAgoMs}`);
  }
});

t('TRP-16 transport-error propaga via onSwitch sem derrubar selector', () => {
  const rig = makeRig();
  rig.sel.start();
  rig.primary.injectError(new Error('USB unplugged'));
  const ev = rig.switches.find(s => s.stage === 'transport-error' && s.which === 'primary');
  if (!ev) throw new Error('faltou propagar erro');
  if (!ev.err.includes('USB unplugged')) throw new Error('mensagem perdida');
  // ainda está em ON_PRIMARY (erro só notifica; switch real depende de silêncio)
  if (rig.sel.getStats().state !== SelectorState.ON_PRIMARY) throw new Error();
});

// ── Cenário composto: cabo derruba e volta ─────────────

t('TRP-17 cenário ponta-a-ponta: cabo derruba, fallback assume, cabo volta', () => {
  const rig = makeRig();
  rig.sel.start();

  // 1. funcionando no primary com heartbeat regular
  for (let i = 0; i < 5; i++) {
    rig.primary.inject(HB(rig.getNow()));
    rig.primary.inject(SAMPLE(rig.getNow(), `p${i}`));
    rig.advance(1000);
  }
  if (rig.messages.length !== 5) throw new Error('payloads do primary perdidos');

  // 2. cabo cai (sem heartbeat por 4s)
  rig.advance(4000);
  if (rig.sel.getStats().state !== SelectorState.ON_FALLBACK) throw new Error('não switchou');

  // 3. fallback Realtime entra com 3 samples
  for (let i = 0; i < 3; i++) {
    rig.fallback.inject(SAMPLE(rig.getNow(), `f${i}`));
    rig.advance(100);
  }
  if (rig.messages.length !== 8) throw new Error('payloads do fallback perdidos');

  // 4. cabo volta com heartbeat estável por 1.2s
  rig.primary.inject(HB(rig.getNow())); // RECOVERING
  rig.advance(500);
  rig.primary.inject(HB(rig.getNow()));
  rig.advance(800); // total 1.3s desde o início da recovery
  if (rig.sel.getStats().state !== SelectorState.ON_PRIMARY) throw new Error('não recuperou');

  // 5. consumer recebeu sequência consistente sem duplicar
  const stats = rig.sel.getStats();
  if (stats.switchesToFallback !== 1) throw new Error('switches fallback');
  if (stats.switchesToPrimary !== 1) throw new Error('switches primary');
});

console.log(`\nTransport: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
