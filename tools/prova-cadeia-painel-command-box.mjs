// prova-cadeia-painel-command-box.mjs — PROVA ponta a ponta do PAINEL do Command Box,
// pela INFRA REAL de canais (Supabase Realtime), num CANAL DE TESTE (nunca produção).
//
// Complementa a prova-cadeia-command-box.mjs (que prova a POSIÇÃO/bolinha). Aqui o que trafega
// é o 'painel' (PainelPronto) — Voltas + Ritmo + Meta + Combustível já calculados.
// Simula os 3 papéis da operação, cada um num cliente separado (como na vida real):
//   1) CARRO   → publica 'sample' (cronômetro subindo) + 'evento' de volta da volta REAL gravada.
//   2) NUVEM   → o cérebro (criarProcessadorCerebro) ouve o fluxo e publica 'painel' (PainelPronto).
//   3) TELA    → ouve 'painel' (é o que a tela faz via cb.onPainel → window.__aplicarPainelStint).
// Prova: o dado sai do carro, o cérebro NA NUVEM processa uma vez, e o painel pronto chega na TELA
// (voltas contadas + ritmo do cronômetro + combustível = conta tanque − consumo×voltas).
//
// SEGURANÇA: canal fixo de teste 'cb-prova-painel' (NUNCA 'cockpit-bubi-live'). Não escreve em produção.
// Rodar: node tools/prova-cadeia-painel-command-box.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarProcessadorCerebro } from './nuvem-cerebro.mjs';

const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CANAL = 'cb-prova-painel';                 // canal de TESTE fixo (nunca produção)
if (CANAL === 'cockpit-bubi-live') { console.error('canal de produção proibido'); process.exit(2); }

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '..');
const fx = JSON.parse(readFileSync(resolve(raiz, 'web/cockpit/fixtures/stint-brasilia-3-laps.v1.json'), 'utf8'));
const entradas = fx.stintHistory.entries.filter(e => typeof e.timeSec === 'number');

function cliente() { return createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } }); }
function assina(c) { const ch = c.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  return new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(ch); })); }

const chCarro = await assina(cliente());
const chNuvem = await assina(cliente());
const chTela  = await assina(cliente());

// NUVEM: o cérebro hospedado ouve o fluxo do canal e publica 'painel' (PainelPronto) num timer fixo.
const proc = criarProcessadorCerebro({
  plano: { voltas: fx.stintHistory.totalLaps, duracaoS: 1680 },
  pbEverSec: fx.track.pbEverSec, stintNumero: 3, stintTotal: 5,
});
chNuvem.on('broadcast', { event: 'sample' }, (msg) => { try { proc.ingestSample(msg && msg.payload); } catch {} });
chNuvem.on('broadcast', { event: 'evento' }, (msg) => { try { proc.ingestEvento(msg && msg.payload); } catch {} });
chNuvem.on('broadcast', { event: 'gps'    }, (msg) => { try { proc.ingestGps(msg && msg.payload); } catch {} });
let publicados = 0;
const timer = setInterval(() => {
  try { chNuvem.send({ type: 'broadcast', event: 'painel', payload: { ...proc.snapshotPainel(), tWall: Date.now() } }); publicados++; } catch {}
}, 250);

// TELA: ouve 'painel' pronto (é o que cb.onPainel entrega pra tela exibir).
const recebidos = [];
chTela.on('broadcast', { event: 'painel' }, (msg) => { if (msg && msg.payload) recebidos.push(msg.payload); });

// CARRO: publica o stint gravado pelo canal — amostras com cronômetro subindo + evento de volta.
// IMPORTANTE: o tWall carimbado é o TEMPO REAL da volta (do stint gravado), não o relógio de parede.
// O cérebro usa esse tempo pra anti-duplicidade de volta (DEDUPE_VOLTA_MS=8s): voltas reais levam ~92s,
// então comprimir o tempo de PAREDE do envio (40ms) sem comprimir o tempo do DADO mantém a prova fiel.
console.log(`[prova] publicando o stint real (${entradas.length} voltas) no canal de teste "${CANAL}"...`);
let tSim = 1_000_000;   // relógio simulado em ms (base arbitrária); avança pelo tempo real de cada volta
for (const e of entradas) {
  for (let f = 1; f <= 5; f++) {
    tSim += (e.timeSec * 1000) / 5;   // avança o tempo do DADO dentro da volta (tempo real do stint)
    chCarro.send({ type: 'broadcast', event: 'sample', payload: { rpm: 6000, waterTempC: 88, cronometroParcialS: (e.timeSec * f) / 5, cronometroTotalS: 0, tWall: tSim } });
    await new Promise(r => setTimeout(r, 40));
  }
  chCarro.send({ type: 'broadcast', event: 'evento', payload: { tipo: 'volta', n: e.lapNumber, tWall: tSim } });
  await new Promise(r => setTimeout(r, 80));
}
await new Promise(r => setTimeout(r, 1200)); // deixa o último painel chegar
clearInterval(timer);

// VEREDITO
const ultimo = recebidos[recebidos.length - 1] || null;
const restanteEsperado = Math.max(0, 40 - 0.82 * entradas.length);   // tanque − consumo×voltas (Flávio 24/06)
const voltasOk     = !!(ultimo && ultimo.stint && ultimo.stint.voltaAtual === entradas.length);
const ritmoOk      = !!(ultimo && ultimo.ritmo && ultimo.ritmo.stintStr);
const combustOk    = !!(ultimo && ultimo.combustivel && ultimo.combustivel.disponivel === true
                        && Math.abs(ultimo.combustivel.restanteL - restanteEsperado) < 0.01);

console.log('');
console.log(`[prova] CARRO publicou:      ${entradas.length} voltas (sample + evento) no canal`);
console.log(`[prova] NUVEM publicou:      ${publicados} pacotes 'painel' (cérebro hospedado)`);
console.log(`[prova] TELA recebeu:        ${recebidos.length} pacotes 'painel'`);
if (ultimo) {
  console.log(`[prova] último painel → STINT  : ${JSON.stringify(ultimo.stint)}`);
  console.log(`[prova] último painel → RITMO  : ${JSON.stringify(ultimo.ritmo)}`);
  console.log(`[prova] último painel → COMBUST: ${JSON.stringify(ultimo.combustivel)}`);
}

const ok = recebidos.length > 0 && voltasOk && ritmoOk && combustOk;
console.log('');
console.log(ok
  ? 'VERDE — o dado saiu do carro, o cérebro NA NUVEM processou uma vez, e o PAINEL PRONTO chegou na TELA (voltas + ritmo + combustível) pela infra real de canais.'
  : 'FALHOU — ver contadores acima.');
process.exit(ok ? 0 : 1);
