// prova-cadeia-gravacao-nuvem.mjs — PROVA ponta a ponta de que a NUVEM GUARDA o ao vivo
// pra rever depois (decisão Flávio 25/06). Pela INFRA REAL de canais (Supabase Realtime),
// num CANAL DE TESTE (nunca produção). Não escreve no banco de produção.
//
// Os papéis (cada um num cliente separado, como na vida real):
//   1) CARRO    → publica 'gps' (a volta REAL gravada do Bubi) no canal de teste.
//   2) GRAVADOR → ouve o que passa e GUARDA numa prateleira durável (arquivo .jsonl local de teste).
//   3) ANÁLISE  → DEPOIS, lê de volta a prateleira e reconstrói a volta inteira (calcularPosicao).
// Prova: o que passou ao vivo ficou guardado, sem perda, e dá pra reler/rever a volta inteira depois.
//
// SEGURANÇA: canal fixo de teste 'cb-prova-gravacao' (NUNCA 'cockpit-bubi-live'). Arquivo em tmp.
// Rodar: node tools/prova-cadeia-gravacao-nuvem.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calcularPosicao } from './nuvem-posicao.mjs';
import { criarGravador, PrateleiraArquivo, lerPrateleiraArquivo } from './nuvem-gravador.mjs';

const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CANAL = 'cb-prova-gravacao';               // canal de TESTE fixo (nunca produção)
if (CANAL === 'cockpit-bubi-live') { console.error('canal de produção proibido'); process.exit(2); }

const ARQUIVO = join(tmpdir(), 'p1fast-prova-gravacao-nuvem.jsonl');
try { rmSync(ARQUIVO, { force: true }); } catch {}

function cliente() { return createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } }); }
function assina(c) { const ch = c.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  return new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(ch); })); }

const j = JSON.parse(readFileSync('web/command-box/fixtures/volta-real-gps-23-05.json', 'utf8'));
const amostras = (j.amostras || []).filter((_, i) => i % 12 === 0).slice(0, 60); // ~60 pontos espalhados

const chCarro    = await assina(cliente());
const chGravador = await assina(cliente());

// GRAVADOR: ouve 'gps' e guarda na prateleira durável (arquivo de teste).
const grav = criarGravador({ prateleira: PrateleiraArquivo(ARQUIVO), loteMax: 20 });
chGravador.on('broadcast', { event: 'gps' }, (msg) => { grav.registrar('gps', msg && msg.payload, Date.now()); });

// CARRO: publica a volta gravada como 'gps', ~6 Hz.
console.log(`[prova] CARRO publicando ${amostras.length} pontos de GPS da volta real no canal de teste "${CANAL}"...`);
for (const a of amostras) {
  chCarro.send({ type: 'broadcast', event: 'gps', payload: { lat: a[1], lng: a[2], fonte: 'prova-23-05', tWall: Date.now() } });
  await new Promise(r => setTimeout(r, 160));
}
await new Promise(r => setTimeout(r, 1500)); // deixa o gravador receber a última
grav.descarregar();                          // descarrega o que sobrou na prateleira
const estado = grav.estado();

// ANÁLISE (depois): lê de volta a prateleira e reconstrói a volta inteira.
const relido = lerPrateleiraArquivo(ARQUIVO);
const posicoes = relido.linhas.map((l) => calcularPosicao(l.payload)).filter(Boolean);
const fracs = posicoes.map((p) => p.frac);
const distintas = new Set(fracs.map((f) => f.toFixed(3))).size;
const todasNaPista = posicoes.length > 0 && posicoes.every((p) => p.frac >= 0 && p.frac <= 1);
const min = Math.min(...fracs), max = Math.max(...fracs);

console.log('');
console.log(`[prova] CARRO publicou ao vivo:     ${amostras.length} pontos`);
console.log(`[prova] GRAVADOR recebeu/guardou:   ${estado.recebidas} recebidas · ${estado.gravadas} guardadas · ${estado.pendentes} pendentes${estado.alarme ? ' · ALARME=' + estado.alarme : ''}`);
console.log(`[prova] RELEITURA da prateleira:    ${relido.total} amostras · sequência contígua: ${relido.contigua ? 'sim (sem buraco)' : 'NÃO'}`);
console.log(`[prova] reconstruiu a volta:        ${posicoes.length} posições · ${distintas} distintas · arco ${isFinite(min)?min.toFixed(3):'-'}..${isFinite(max)?max.toFixed(3):'-'} (0..1 = volta inteira)`);
console.log(`[prova] arquivo guardado em:        ${ARQUIVO}`);

const semPerda = estado.recebidas > 0 && estado.gravadas === estado.recebidas && estado.pendentes === 0 && !estado.alarme;
const releituraOk = relido.total === estado.gravadas && relido.contigua;
const voltaOk = posicoes.length > 0 && distintas >= 5 && todasNaPista;
const ok = semPerda && releituraOk && voltaOk;

console.log('');
console.log(ok
  ? 'VERDE — o que passou ao vivo foi GUARDADO sem perda, e DEPOIS deu pra reler e reconstruir a volta inteira na pista (infra real de canais, canal de teste).'
  : 'FALHOU — ver contadores acima.');
try { rmSync(ARQUIVO, { force: true }); } catch {}
process.exit(ok ? 0 : 1);
