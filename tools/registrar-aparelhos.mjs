// registrar-aparelhos.mjs — REGISTRADOR de teste dos aparelhos (T4000, RaceBox/GPS, eventos).
//
// O que faz: assina o canal ao vivo `cockpit-bubi-live` (mesma nuvem do projeto), só LEITURA.
// Para cada fonte que chega (gps / sample do carro / evento de volta-trecho), ele:
//   1) grava o dado BRUTO num arquivo .jsonl (uma linha por amostra) — "registra os dados";
//   2) levanta o FORMATO: campos, tipo, faixa (mín/máx), taxa em Hz, maior buraco — "registra os formatos";
//   3) dispara ALERTA na hora quando um valor vem fora do esperado (faixa da spec) ou sumindo.
// Distingue dado REAL de SIMULAÇÃO (source==='sim-replay' ou sim===true) e NÃO conta sim como aparelho ok.
//
// Uso:  node tools/registrar-aparelhos.mjs [segundos]
//   sem argumento: roda até Ctrl+C. com número: roda esse tempo e fecha com o relatório de formato.
//
// NÃO publica nada no canal. NÃO altera as páginas publicadas. NÃO toca produção.

import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'fs';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CHANNEL = process.env.CANAL || 'cockpit-bubi-live';  // padrão = canal real; CANAL=... só pra auto-teste isolado

const segundos = process.argv[2] ? Number(process.argv[2]) : null;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG = `/tmp/registro-aparelhos-${stamp}.jsonl`;

// Faixas esperadas por canal (da spec: T4000_CAN_SPEC.md e RACEBOX_INTEGRATION_SPEC.md).
// [min, max] físico plausível. Fora disso = ALERTA (leitura suspeita).
const FAIXAS = {
  gps:    { lat:[-90,90], lng:[-180,180], kmh:[0,300], numSV:[0,40], fix:[0,4], accM:[0.05,80] },
  sample: { rpm:[0,8000], speedKmh:[0,280], waterTempC:[-10,130], batteryV:[0,16], lambda:[0.5,1.5],
            tpsPct:[0,100], pressaoFreioBar:[0,12], pedalAceleradorPct:[0,100], oilPressureBar:[0,12],
            oilTempC:[-10,160], mapBar:[-1,6], airTempC:[-30,110], egtC:[0,1500], fuelTempC:[-10,110], gear:[0,6] }
};

// Acumulador de formato por tipo de evento.
function novoTipo() {
  return { n:0, nSim:0, nReal:0, first:0, last:0, prev:0, maxGapMs:0, win:[], campos:new Map(), alertas:new Map() };
}
const tipos = { gps:novoTipo(), sample:novoTipo(), evento:novoTipo() };

function ehSim(p){ return p && (p.source === 'sim-replay' || p.sim === true); }

function registrarCampo(t, k, v){
  let c = t.campos.get(k);
  if (!c){ c = { tipo:new Set(), n:0, nNull:0, min:Infinity, max:-Infinity, exemplo:undefined }; t.campos.set(k, c); }
  c.n++;
  if (v === null || v === undefined){ c.nNull++; return; }
  c.tipo.add(typeof v);
  if (c.exemplo === undefined) c.exemplo = v;
  if (typeof v === 'number' && Number.isFinite(v)){ if (v < c.min) c.min = v; if (v > c.max) c.max = v; }
}

function checarFaixa(tipoNome, t, p){
  const regras = FAIXAS[tipoNome]; if (!regras) return;
  for (const [k, [lo, hi]] of Object.entries(regras)){
    const v = p[k];
    if (v === null || v === undefined){
      // GPS sem lat/lng, ou carro sem rpm: campo crítico ausente.
      if ((tipoNome==='gps' && (k==='lat'||k==='lng')) || (tipoNome==='sample' && k==='rpm'))
        bumpAlerta(t, `${k} ausente (null)`);
      continue;
    }
    if (typeof v === 'number' && (v < lo || v > hi)) bumpAlerta(t, `${k}=${v} fora de [${lo},${hi}]`);
  }
  if (tipoNome==='gps'){
    if (p.fix === 0) bumpAlerta(t, 'fix=0 (sem céu / sem trava)');
    else if (typeof p.numSV==='number' && p.numSV < 6) bumpAlerta(t, `numSV=${p.numSV} (sinal fraco <6)`);
  }
}
function bumpAlerta(t, msg){
  const n = (t.alertas.get(msg) || 0) + 1;
  t.alertas.set(msg, n);
  if (n === 1) console.log(`  ! ALERTA: ${msg}`);   // só na 1a vez, pra não floodar
}

function onEvento(tipoNome, payload){
  const t = tipos[tipoNome]; const now = Date.now();
  t.n++; if (ehSim(payload)) t.nSim++; else t.nReal++;
  if (!t.first) t.first = now;
  if (t.prev) t.maxGapMs = Math.max(t.maxGapMs, now - t.prev);
  t.prev = now; t.last = now;
  t.win.push(now); while (t.win.length && now - t.win[0] > 5000) t.win.shift();
  for (const [k, v] of Object.entries(payload || {})) registrarCampo(t, k, v);
  checarFaixa(tipoNome, t, payload || {});
  appendFileSync(LOG, JSON.stringify({ tipoEvento:tipoNome, tRec:now, ...payload }) + '\n');
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON, { realtime:{ params:{ eventsPerSecond:25 } } });
const ch = client.channel(CHANNEL, { config:{ broadcast:{ ack:false, self:false } } });
ch.on('broadcast', { event:'gps' },    m => onEvento('gps',    m.payload));
ch.on('broadcast', { event:'sample' },  m => onEvento('sample',  m.payload));
ch.on('broadcast', { event:'evento' },  m => onEvento('evento',  m.payload));
ch.subscribe((s) => {
  if (s === 'SUBSCRIBED') console.log(`Registrador LIGADO. Ouvindo "${CHANNEL}". Gravando em ${LOG}\nAguardando o notebook mandar dados...\n`);
  else console.log('canal:', s);
});

// Painel vivo a cada 2s: o que está chegando agora.
const painel = setInterval(() => {
  const now = Date.now();
  const linha = ['gps','sample','evento'].map(nome => {
    const t = tipos[nome]; if (!t.n) return `${nome}: —`;
    const hz = (t.win.length / 5).toFixed(1);
    const idade = ((now - t.last)/1000).toFixed(1);
    const orig = t.nSim && !t.nReal ? 'SIM' : (t.nReal && t.nSim ? 'real+sim' : (t.nReal ? 'REAL' : 'SIM'));
    return `${nome}: ${t.n} (${hz}/s, ${idade}s atrás, ${orig})`;
  }).join('   |   ');
  console.log(`[vivo] ${linha}`);
}, 2000);

function relatorioFormato(){
  console.log('\n================= FORMATO REGISTRADO POR FONTE =================');
  for (const nome of ['gps','sample','evento']){
    const t = tipos[nome];
    console.log(`\n--- ${nome.toUpperCase()} ---`);
    if (!t.n){ console.log('  (nenhuma amostra recebida)'); continue; }
    const durS = (t.last - t.first)/1000 || 0;
    const hz = durS > 0 ? (t.n/durS).toFixed(1) : 'n/d';
    console.log(`  amostras: ${t.n}  (real: ${t.nReal}, simulação: ${t.nSim})`);
    console.log(`  taxa média: ${hz}/s   maior buraco: ${(t.maxGapMs/1000).toFixed(1)}s   duração: ${durS.toFixed(0)}s`);
    console.log('  campos (formato):');
    for (const [k, c] of t.campos){
      const tipos_ = [...c.tipo].join('|') || 'null';
      const faixa = (Number.isFinite(c.min) && Number.isFinite(c.max)) ? `  faixa [${c.min} .. ${c.max}]` : '';
      const nulos = c.nNull ? `  nulos:${c.nNull}/${c.n}` : '';
      const ex = c.exemplo !== undefined ? `  ex:${JSON.stringify(c.exemplo)}` : '';
      console.log(`    ${k.padEnd(20)} ${tipos_.padEnd(14)}${faixa}${nulos}${ex}`);
    }
    if (t.alertas.size){
      console.log('  ALERTAS:');
      for (const [msg, n] of t.alertas) console.log(`    (${n}x) ${msg}`);
    } else console.log('  ALERTAS: nenhum (tudo dentro da faixa esperada)');
  }
  console.log(`\nDado bruto completo: ${LOG}`);
  console.log('===============================================================\n');
}

async function encerrar(){
  clearInterval(painel);
  relatorioFormato();
  try { await ch.unsubscribe(); } catch {}
  process.exit(0);
}
process.on('SIGINT', encerrar);
if (segundos) setTimeout(encerrar, segundos * 1000);
