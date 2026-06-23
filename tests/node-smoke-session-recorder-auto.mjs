// Teste automático da CAPTURA AUTOMÁTICA POR MOVIMENTO (sem botão).
// Prova, sem navegador, o que o Flávio pediu em 23/06: a gravação começa sozinha
// quando o carro ANDA (entrou na pista) e para sozinha quando fica PARADO (box),
// e volta a gravar quando o carro sai de novo. O motor em marcha lenta no box NÃO
// liga nem segura a gravação — só o movimento do GPS manda.
import { criarGravador, criarStoreMemoria } from '../web/teste-aparelhos/session-recorder.js';

let okN = 0, failN = 0;
const ok   = (m) => { okN++;  console.log('  ok   ' + m); };
const fail = (m) => { failN++; console.log('  FAIL ' + m); };
const eq   = (a, b, m) => (a === b ? ok(m + ` (=${a})`) : fail(m + ` esperado ${b}, veio ${a}`));

// relógio controlável (igual aos outros smokes)
function relogio() {
  const c = { mono: 0, wall: 1_700_000_000_000 };
  return { now: () => c.mono, wall: () => c.wall, av: (ms) => { c.mono += ms; c.wall += ms; } };
}
const AUTO = { vOn: 15, vOff: 6, paradoMs: 12000 };
function novo(store) {
  const r = relogio();
  let n = 0;
  const g = criarGravador({ store, now: r.now, wall: r.wall, gerarId: () => 'S' + (++n), auto: AUTO });
  return { g, r };
}
const gpsAndando = (g, kmh) => g.gps({ lat: -15.77, lng: -47.89, spd: kmh, fix: 3, numSV: 9 });

console.log('node-smoke-session-recorder-auto');

// 1) Carro PARADO no box não começa a gravar (nem com o motor em marcha lenta)
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  eq(g.estado().auto, true, '1.1 modo automático ligado');
  gpsAndando(g, 0);                 // GPS parado (box)
  eq(g.estado().gravando, false, '1.2 GPS parado NÃO inicia gravação');
  r.av(200); g.motor({ rpm: 1100, source: 'real' });   // motor em marcha lenta
  eq(g.estado().gravando, false, '1.3 motor em marcha lenta NÃO inicia gravação');
  eq(store._debug.amostras.length, 0, '1.4 nada foi persistido em espera (box)');
}

// 2) Carro ANDOU (entrou na pista) => começa a gravar sozinho
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  gpsAndando(g, 5);  r.av(200);                          // ainda devagar (< vOn)
  eq(g.estado().gravando, false, '2.1 abaixo do limiar ainda não grava');
  gpsAndando(g, 40);                                     // acelerou => entrou na pista
  eq(g.estado().gravando, true, '2.2 acima do limiar COMEÇA a gravar');
  // grava motor + GPS enquanto anda
  for (let i = 0; i < 10; i++) { r.av(200); gpsAndando(g, 60); g.motor({ rpm: 5000, source: 'real' }); }
  const e = g.estado();
  eq(e.gravando, true, '2.3 segue gravando enquanto anda');
  ok(`2.4 contadores subindo (gps=${e.nGps}, motor=${e.nMotor})`);
  eq(e.nGps >= 10 && e.nMotor >= 10, true, '2.5 gravou GPS e motor JUNTOS');
}

// 3) Carro PAROU no box por tempo suficiente => fecha a sessão sozinho
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  gpsAndando(g, 50);                                     // andando => grava
  for (let i = 0; i < 5; i++) { r.av(200); gpsAndando(g, 50); }
  eq(g.estado().gravando, true, '3.1 gravando na pista');
  // entra no box: parado, mas o GPS continua chegando (spd 0)
  let fechou = null;
  for (let i = 0; i < 70; i++) { r.av(200); const res = gpsAndando(g, 0); if (res && res.motivoFim) fechou = res; }
  eq(g.estado().gravando, false, '3.2 parado tempo suficiente => FECHOU sozinho (box)');
  eq(fechou && fechou.motivoFim, 'parado', '3.3 motivo do fim = parado (entrou no box)');
  // a sessão fechada ficou guardada (preservada)
  const sess = [...store._debug.sessoes.values()][0];
  eq(sess.status, 'encerrada', '3.4 sessão preservada e encerrada no armazenamento');
}

// 4) Carro SAIU de novo => abre uma NOVA sessão
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  gpsAndando(g, 50); for (let i=0;i<3;i++){ r.av(200); gpsAndando(g,50); }   // 1ª saída
  for (let i = 0; i < 70; i++) { r.av(200); gpsAndando(g, 0); }              // parou no box (fecha)
  eq(g.estado().gravando, false, '4.1 fechou a 1ª sessão');
  r.av(200); gpsAndando(g, 45);                                              // saiu de novo
  eq(g.estado().gravando, true, '4.2 voltou a andar => NOVA gravação');
  eq(store._debug.sessoes.size, 2, '4.3 duas sessões distintas (uma por saída)');
}

console.log(`\n${okN} ok / ${failN} fail`);
if (failN) process.exit(1);
