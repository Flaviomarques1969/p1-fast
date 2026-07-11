// prova-cadeia-command-box.mjs — PROVA ponta a ponta do caminho da nuvem do Command Box,
// pela INFRA REAL de canais (Supabase Realtime), num CANAL DE TESTE (nunca produção).
//
// Simula os 3 papéis da operação, cada um num cliente separado (como na vida real):
//   1) CARRO   → publica 'gps' (a volta REAL gravada do Bubi) no canal de teste.
//   2) NUVEM   → ouve 'gps', calcula a posição pela conta CANÔNICA (calcularPosicao) e publica 'posicao'.
//   3) TELA    → ouve 'posicao' (é o que a tela faz via cb.onPosicao → bolinha).
// Prova: o ponto sai do carro, passa pela conta canônica na nuvem, e chega pronto pra tela desenhar —
// em pontos DIFERENTES (a bolinha anda) e SEMPRE na pista.
//
// SEGURANÇA: canal fixo de teste 'cb-prova-cadeia' (NUNCA 'cockpit-bubi-live'). Não escreve em produção.
// Rodar: node tools/prova-cadeia-command-box.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { calcularPosicao } from './nuvem-posicao.mjs';

const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CANAL = 'cb-prova-cadeia';                 // canal de TESTE fixo (nunca produção)
if (CANAL === 'cockpit-bubi-live') { console.error('canal de produção proibido'); process.exit(2); }

function cliente() { return createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } }); }
function assina(c) { const ch = c.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  return new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(ch); })); }

const j = JSON.parse(readFileSync('web/command-box/fixtures/volta-real-gps-23-05.json', 'utf8'));
const amostras = (j.amostras || []).filter((_, i) => i % 12 === 0).slice(0, 60); // ~60 pontos espalhados

const chCarro = await assina(cliente());
const chNuvem = await assina(cliente());
const chTela  = await assina(cliente());

// NUVEM: ouve 'gps' do carro, calcula posição canônica, publica 'posicao'.
let calculadas = 0;
chNuvem.on('broadcast', { event: 'gps' }, (msg) => {
  const pos = calcularPosicao(msg && msg.payload);
  if (!pos) return;
  calculadas++;
  chNuvem.send({ type: 'broadcast', event: 'posicao', payload: { ...pos, tWall: Date.now() } });
});

// TELA: ouve 'posicao' pronta (é o que cb.onPosicao entrega pra bolinha).
const recebidas = [];
chTela.on('broadcast', { event: 'posicao' }, (msg) => { if (msg && msg.payload) recebidas.push(msg.payload); });

// CARRO: publica a volta gravada como 'gps', ~6 Hz.
console.log(`[prova] publicando ${amostras.length} pontos de GPS da volta real no canal de teste "${CANAL}"...`);
for (const a of amostras) {
  chCarro.send({ type: 'broadcast', event: 'gps', payload: { lat: a[1], lng: a[2], fonte: 'prova-23-05', tWall: Date.now() } });
  await new Promise(r => setTimeout(r, 160));
}
await new Promise(r => setTimeout(r, 1500)); // deixa a última posição chegar

// VEREDITO
const fracs = recebidas.map(p => p.frac);
const distintas = new Set(fracs.map(f => f.toFixed(3))).size;
const todasNaPista = recebidas.length > 0 && recebidas.every(p => typeof p.frac === 'number' && p.frac >= 0 && p.frac <= 1);
const min = Math.min(...fracs), max = Math.max(...fracs);

console.log('');
console.log(`[prova] CARRO publicou:      ${amostras.length} pontos de GPS`);
console.log(`[prova] NUVEM calculou:      ${calculadas} posições (conta canônica calcularPosicao)`);
console.log(`[prova] TELA recebeu pronto: ${recebidas.length} posições`);
console.log(`[prova] posições DISTINTAS:  ${distintas} (a bolinha anda)`);
console.log(`[prova] faixa de arco:       ${isFinite(min)?min.toFixed(3):'-'} .. ${isFinite(max)?max.toFixed(3):'-'} (0..1 = volta inteira)`);

const ok = recebidas.length > 0 && distintas >= 5 && todasNaPista;
console.log('');
console.log(ok
  ? 'VERDE — o ponto saiu do carro, passou pela conta canônica na NUVEM e chegou pronto pra TELA, em pontos diferentes da pista (pela infra real de canais).'
  : 'FALHOU — ver contadores acima.');
process.exit(ok ? 0 : 1);
