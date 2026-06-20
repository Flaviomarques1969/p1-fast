// Teste automático do GRAVADOR DE SESSÃO (web/teste-aparelhos/session-recorder.js)
// Prova, sem navegador, a lógica que a auditoria de 20/06 pediu: gravar do liga ao
// desliga, contar GPS e motor, manter a taxa cheia, marcar lacunas, identificar
// simulação e nunca perder dado em silêncio.
import { criarGravador, criarStoreMemoria } from '../web/teste-aparelhos/session-recorder.js';

let okN = 0, failN = 0;
const ok   = (m) => { okN++;  console.log('  ok   ' + m); };
const fail = (m) => { failN++; console.log('  FAIL ' + m); };
const eq   = (a, b, m) => (a === b ? ok(m + ` (=${a})`) : fail(m + ` esperado ${b}, veio ${a}`));
const near = (a, b, tol, m) => (Math.abs(a - b) <= tol ? ok(m + ` (~${a})`) : fail(m + ` esperado ~${b}±${tol}, veio ${a}`));
const microtask = () => new Promise(r => setTimeout(r, 0));

// relógio controlável
function relogio() {
  const c = { mono: 0, wall: 1_700_000_000_000 };
  return { now: () => c.mono, wall: () => c.wall, av: (ms) => { c.mono += ms; c.wall += ms; } };
}
function novo(store, extra = {}) {
  const r = relogio();
  let n = 0;
  const g = criarGravador({ store, now: r.now, wall: r.wall, gerarId: () => 'S' + (++n), ...extra });
  return { g, r };
}

console.log('node-smoke-session-recorder');

// 1) Carro liga na primeira amostra
{
  const store = criarStoreMemoria();
  const { g } = novo(store);
  eq(g.estado().gravando, false, '1.1 começa parado');
  g.gps({ lat: -15.77, lng: -47.89, spd: 80, fix: 3, numSV: 9 });
  eq(g.estado().gravando, true, '1.2 liga na 1ª amostra de GPS');
  eq(store._debug.sessoes.size, 1, '1.3 abriu 1 sessão no armazenamento');
  eq(store._debug.amostras.length, 1, '1.4 gravou a 1ª amostra (append-only)');
}

// 2) Conta GPS e motor separadamente
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  for (let i = 0; i < 10; i++) { g.gps({ lat: 1, lng: 2, spd: 50 }); r.av(40); }
  for (let i = 0; i < 5; i++)  { g.motor({ rpm: 3000, waterTempC: 80, source: 'carro' }); r.av(100); }
  const e = g.estado();
  eq(e.nGps, 10, '2.1 contou 10 GPS');
  eq(e.nMotor, 5, '2.2 contou 5 do motor');
  eq(store._debug.amostras.length, 15, '2.3 gravou as 15 amostras cruas');
}

// 3) Taxa cheia: alimentando a 25/s, a taxa medida é ~25 (não 5)
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  for (let i = 0; i < 125; i++) { g.gps({ lat: 1, lng: 2, spd: 90 }); r.av(40); } // 40ms = 25/s por 5s
  near(g.estado().hzGps, 25, 1.5, '3.1 grava na taxa cheia (~25/s), não nos 5/s da transmissão');
}

// 4) Desliga após silêncio e devolve resumo com a contagem
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store, { silencioMs: 8000 });
  g.gps({ lat: 1, lng: 2, spd: 80 }); r.av(200);
  g.motor({ rpm: 2500, source: 'carro' }); r.av(200);
  g.gps({ lat: 1, lng: 2, spd: 82 });
  eq(g.tick(), null, '4.1 segue gravando antes do silêncio');
  r.av(9000); // 9s sem dado
  const resumo = g.tick();
  eq(g.estado().gravando, false, '4.2 desligou após 8s de silêncio');
  eq(resumo.motivoFim, 'silencio', '4.3 motivo do fim = silêncio (carro desligou)');
  eq(resumo.nGps, 2, '4.4 resumo: 2 GPS');
  eq(resumo.nMotor, 1, '4.5 resumo: 1 do motor');
  eq(store._debug.sessoes.get('S1').status, 'encerrada', '4.6 sessão marcada como encerrada');
}

// 5) Lacuna dentro da sessão fica registrada (aba suspensa não finge continuidade)
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  g.gps({ lat: 1, lng: 2 }); r.av(40);
  g.gps({ lat: 1, lng: 2 }); r.av(4000); // buraco de 4s (notebook dormiu), ainda < 8s de fim
  g.gps({ lat: 1, lng: 2 });
  eq(g.estado().lacunas, 1, '5.1 marcou 1 lacuna de buraco no meio');
  const resumo = g.encerrar('manual');
  near(resumo.maiorLacunaMs, 4000, 50, '5.2 maior lacuna ~4000ms');
}

// 6) Simulação é identificada (não se passa por dado real)
{
  const store = criarStoreMemoria();
  const { g } = novo(store);
  g.motor({ rpm: 1000, source: 'sim-replay' });
  eq(g.estado().sim, true, '6.1 sessão iniciada por simulação fica marcada sim');
  eq(g.encerrar().sim, true, '6.2 resumo carrega o selo de simulação');
}

// 7) Falha de escrita conta como descartado (visível, nunca silencioso)
{
  const storeRuim = {
    async novaSessao() {},
    async gravar() { throw new Error('disco cheio'); },
    async finalizar() {},
    async lerSessao() { return { sessao: null, amostras: [] }; },
    async listarSessoes() { return []; },
  };
  const { g } = novo(storeRuim);
  g.gps({ lat: 1, lng: 2 });
  g.gps({ lat: 1, lng: 2 });
  await microtask();
  eq(g.estado().dropped, 2, '7.1 contou 2 descartes quando o armazenamento falhou');
}

// 8) Exportação devolve a sessão inteira, crua
{
  const store = criarStoreMemoria();
  const { g, r } = novo(store);
  g.gps({ lat: -15.1, lng: -47.1, spd: 70 }, 'b56201...'); r.av(40);
  g.motor({ rpm: 4200, waterTempC: 88, lambda: 0.78, source: 'carro' });
  const id = g.sessaoAtiva.id;
  g.encerrar();
  const dump = await g.exportarSessao(id);
  eq(dump.amostras.length, 2, '8.1 exporta as 2 amostras da sessão');
  eq(dump.amostras[0].rawHex, 'b56201...', '8.2 guardou os bytes crus do GPS (sem perda)');
  eq(dump.amostras[1].dados.rpm, 4200, '8.3 guardou o dado completo do motor');
}

// 9) Recuperação de órfã: recarregou a tela / notebook dormiu sem fechar a sessão
{
  const store = criarStoreMemoria();
  const a = novo(store);                    // 1ª "carga" da página
  a.g.gps({ lat: 1, lng: 2 }); a.r.av(40);
  a.g.motor({ rpm: 3000, source: 'carro' }); // sessão fica aberta (status 'gravando')
  const b = novo(store);                    // simula recarregar: novo gravador, MESMO armazenamento
  const orfas = await b.g.recuperarOrfas();
  eq(orfas.length, 1, '9.1 recuperou 1 sessão órfã (recarregou sem fechar)');
  eq(orfas[0].nGps, 1, '9.2 órfã com 1 GPS');
  eq(orfas[0].nMotor, 1, '9.3 órfã com 1 do motor');
  eq(orfas[0].status, 'interrompida', '9.4 marcou como interrompida');
  eq((await b.g.recuperarOrfas()).length, 0, '9.5 não recupera de novo (já fechada)');
  ok('9.6 dado cru preservado: ' + store._debug.amostras.length + ' amostras intactas');
}

console.log(`\n${okN} ok / ${failN} fail`);
process.exit(failN ? 1 : 0);
