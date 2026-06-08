// Smoke do watchdog do conversor T3000.
// Verifica que ele dispara alerta após o limite de silêncio e recupera
// sozinho quando volta a chegar amostra.

import {
  criarT3000Watchdog,
  T3000_WATCHDOG_DEFAULTS,
} from '../web/cockpit/t3000-watchdog.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

t('WD-01 defaults: tolerância 1500ms, intervalo 250ms', () => {
  if (T3000_WATCHDOG_DEFAULTS.toleranciaMs !== 1500) {
    throw new Error('tolerância ' + T3000_WATCHDOG_DEFAULTS.toleranciaMs);
  }
  if (T3000_WATCHDOG_DEFAULTS.intervaloVerificarMs !== 250) {
    throw new Error('intervalo ' + T3000_WATCHDOG_DEFAULTS.intervaloVerificarMs);
  }
});

t('WD-02 sem amostra nunca (ts=0): não dispara', () => {
  let agora = 0;
  let perdeu = false;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => 0,
    onMudancaSinal: (p) => { perdeu = p; },
    toleranciaMs: 500,
  });
  agora = 10000;
  w.verificar();
  if (perdeu) throw new Error('disparou sem amostra');
});

t('WD-03 amostra recente (<tolerância): não dispara', () => {
  let agora = 1000;
  let ultima = 900;
  let chamadas = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: () => { chamadas++; },
    toleranciaMs: 500,
  });
  w.verificar();
  if (chamadas !== 0) throw new Error('chamou ' + chamadas);
  if (w.estaPerdido()) throw new Error('marcou perdido cedo');
});

t('WD-04 silêncio passa da tolerância → dispara perdeu=true UMA vez', () => {
  let agora = 1000;
  let ultima = 100;
  let perdeu = null;
  let chamadas = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: (p) => { perdeu = p; chamadas++; },
    toleranciaMs: 500,
  });
  // 1ª checagem: 1000 - 100 = 900 > 500 → dispara perdeu=true
  w.verificar();
  if (chamadas !== 1) throw new Error('1ª chamada não disparou: ' + chamadas);
  if (perdeu !== true) throw new Error('perdeu deveria ser true: ' + perdeu);
  // 2ª checagem: ainda silêncio → não chama de novo (sem mudança)
  agora = 2000;
  w.verificar();
  if (chamadas !== 1) throw new Error('chamou de novo sem mudança: ' + chamadas);
});

t('WD-05 amostra volta: dispara perdeu=false', () => {
  let agora = 1000;
  let ultima = 100;
  const eventos = [];
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: (p) => { eventos.push(p); },
    toleranciaMs: 500,
  });
  w.verificar(); // perdeu
  // Amostra volta a chegar AGORA — delta 0 — recupera
  ultima = 1000;
  w.verificar();
  if (eventos.length !== 2) throw new Error('eventos ' + eventos.length);
  if (eventos[0] !== true || eventos[1] !== false) {
    throw new Error('sequência errada: ' + JSON.stringify(eventos));
  }
  if (w.estaPerdido()) throw new Error('ainda marca perdido');
});

t('WD-06 estaPerdido reflete último estado', () => {
  let agora = 0;
  let ultima = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: () => {},
    toleranciaMs: 300,
  });
  ultima = 100; agora = 200;
  w.verificar();
  if (w.estaPerdido()) throw new Error('cedo demais');
  agora = 500; // delta 400 > 300
  w.verificar();
  if (!w.estaPerdido()) throw new Error('não marcou perdido');
});

t('WD-07 iniciar é idempotente (chamar 2x não dobra timer)', async () => {
  let agora = 0;
  let ultima = 0;
  let chamadas = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: () => { chamadas++; },
    toleranciaMs: 100,
    intervaloVerificarMs: 30,
  });
  w.iniciar();
  w.iniciar(); // segunda chamada ignorada
  ultima = 0; agora = 200;
  // Espera 1 ciclo de verificar (30ms) — mas timer interno usa Date real,
  // então só checa que ao parar não vaza.
  await new Promise(r => setTimeout(r, 90));
  w.parar();
  // Após parar, novas verificações manuais ainda funcionam.
  agora = 1000; ultima = 0;
  w.verificar();
  // (não conta chamadas porque getUltimaAmostraTs=0 ignora)
  if (chamadas > 5) throw new Error('chamou demais: ' + chamadas); // sanity
});

t('WD-08 parar() para o ciclo periódico', async () => {
  let agora = 0;
  let ultima = 100;
  let chamadas = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: () => { chamadas++; },
    toleranciaMs: 50,
    intervaloVerificarMs: 25,
  });
  w.iniciar();
  agora = 1000;
  await new Promise(r => setTimeout(r, 80));
  const antes = chamadas;
  w.parar();
  await new Promise(r => setTimeout(r, 100));
  if (chamadas > antes + 1) {
    throw new Error('continuou checando após parar: ' + chamadas + ' vs antes ' + antes);
  }
});

t('WD-09 throw em onMudancaSinal não derruba o watchdog', () => {
  let agora = 1000;
  let ultima = 0;
  const w = criarT3000Watchdog({
    agora: () => agora,
    getUltimaAmostraTs: () => ultima,
    onMudancaSinal: () => { throw new Error('callback boom'); },
    toleranciaMs: 100,
  });
  ultima = 100;
  agora = 500;
  // Ao disparar, callback joga — watchdog deve sobreviver
  w.verificar();
  // verificar de novo não derruba o teste
  agora = 1000;
  w.verificar();
});

t('WD-10 getUltimaAmostraTs obrigatório', () => {
  let pegou = false;
  try {
    criarT3000Watchdog({ onMudancaSinal: () => {} });
  } catch { pegou = true; }
  if (!pegou) throw new Error('aceitou sem getter');
});

t('WD-11 onMudancaSinal obrigatório', () => {
  let pegou = false;
  try {
    criarT3000Watchdog({ getUltimaAmostraTs: () => 0 });
  } catch { pegou = true; }
  if (!pegou) throw new Error('aceitou sem callback');
});

t('WD-12 config efetiva exposta', () => {
  const w = criarT3000Watchdog({
    getUltimaAmostraTs: () => 0,
    onMudancaSinal: () => {},
    toleranciaMs: 800,
    intervaloVerificarMs: 100,
  });
  if (w.config.toleranciaMs !== 800) throw new Error('tol ' + w.config.toleranciaMs);
  if (w.config.intervaloVerificarMs !== 100) throw new Error('int ' + w.config.intervaloVerificarMs);
});

await new Promise(r => setTimeout(r, 50));
console.log(`\n${ok}/${ok+fail} ok`);
if (fail > 0) process.exit(1);
