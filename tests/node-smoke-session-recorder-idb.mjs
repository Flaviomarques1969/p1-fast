// Teste de INTEGRAÇÃO do gravador com IndexedDB REAL (via fake-indexeddb) e DADOS REAIS
// (gravação do motor 26/05 + GPS de Brasília). Prova que o que o navegador vai gravar
// persiste mesmo e que o arquivo exportado sai completo e cru.
import 'fake-indexeddb/auto';
import fs from 'fs';
import { criarGravador, criarStoreIndexedDB } from '../web/teste-aparelhos/session-recorder.js';

let okN = 0, failN = 0;
const ok   = (m) => { okN++;  console.log('  ok   ' + m); };
const fail = (m) => { failN++; console.log('  FAIL ' + m); };
const eq   = (a, b, m) => (a === b ? ok(m + ` (=${a})`) : fail(m + ` esperado ${b}, veio ${a}`));
const ge   = (a, b, m) => (a >= b ? ok(m + ` (=${a})`) : fail(m + ` esperado >=${b}, veio ${a}`));

const motor = JSON.parse(fs.readFileSync(new URL('../web/teste-aparelhos/sim-amostras.json', import.meta.url)));
const gpsPts = JSON.parse(fs.readFileSync(new URL('../web/teste-aparelhos/sim-gps.json', import.meta.url)));

console.log('node-smoke-session-recorder-idb (IndexedDB real + dados reais)');

const c = { mono: 0, wall: 1_700_000_000_000 };
const Rec = criarGravador({
  store: criarStoreIndexedDB('p1fast-teste-' + c.wall),
  now: () => c.mono, wall: () => c.wall, gerarId: () => 'SESSAO-TESTE',
});

const N_GPS = 250, N_MOTOR = 250;
// Sessão contínua: a cada passo, 1 ponto de GPS + 1 amostra de motor, sem buraco
// que feche a sessão. Prova captura simultânea dos dois canais.
for (let i = 0; i < N_GPS; i++) {
  const p = gpsPts[i % gpsPts.length];
  const raw = new Uint8Array([0xB5, 0x62, i & 0xff, (i >> 8) & 0xff]);
  Rec.gps({ fix: 3, numSV: 9, hacc: 2, spd: (p.v || 0), lat: p.lat, lon: p.lng }, hexOf(raw), false);
  Rec.motor({ ...motor[i % motor.length], source: 'carro' });
  c.mono += 40; c.wall += 40;
}
const resumo = Rec.encerrar('manual');
function hexOf(u8){ return Array.from(u8, b => b.toString(16).padStart(2,'0')).join(''); }

// Espera o IndexedDB (fire-and-forget) drenar e confere lendo de volta.
const dump = await aguardarExport(Rec, 'SESSAO-TESTE', N_GPS + N_MOTOR, 4000);

eq(resumo.nGps, N_GPS, '1 resumo contou todo o GPS');
eq(resumo.nMotor, N_MOTOR, '2 resumo contou todo o motor');
ge(resumo.hzGpsMedia, 20, '3 taxa de GPS gravada perto da cheia (>=20/s)');
ge(dump.amostras.length, N_GPS + N_MOTOR, '4 IndexedDB persistiu TODAS as amostras (sem perder)');

const gpsRec = dump.amostras.filter(a => a.tipo === 'gps');
const motRec = dump.amostras.filter(a => a.tipo === 't4000');
eq(gpsRec.length, N_GPS, '5 persistiu todos os pontos de GPS');
eq(motRec.length, N_MOTOR, '6 persistiu todas as amostras de motor');
ok('7 amostra de GPS tem bytes crus: ' + (gpsRec[0].rawHex ? 'sim' : 'NÃO'));
if (!gpsRec[0].rawHex) failN++;
ge(motRec[0].dados.rpm, 1, '8 amostra de motor tem dado real (rpm=' + motRec[0].dados.rpm + ')');
eq(dump.sessao.status, 'encerrada', '9 sessão fechada e marcada no IndexedDB');
eq(dump.sessao.id, 'SESSAO-TESTE', '10 leu a sessão certa de volta');

const lista = await Rec.listarSessoes();
ge(lista.length, 1, '11 lista de sessões salvas tem a sessão');

console.log(`\n${okN} ok / ${failN} fail`);
process.exit(failN ? 1 : 0);

async function aguardarExport(rec, id, alvo, timeoutMs){
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs){
    const d = await rec.exportarSessao(id);
    if (d && d.amostras && d.amostras.length >= alvo) return d;
    await new Promise(r => setTimeout(r, 50));
  }
  return await rec.exportarSessao(id);
}
