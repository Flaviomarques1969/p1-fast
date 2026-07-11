#!/usr/bin/env node
// auditor-sessao-dumps — lado NUVEM (iMac).
// Lê uma sessão crua de `sessao_dumps` no Supabase (parte 0 = meta; 1..N = amostras),
// remonta as amostras de GPS e calcula o Vmin (velocidade mínima) do dado cru.
// Só LEITURA. Não escreve nada no banco.
//
// Uso: node tools/auditor-sessao-dumps.mjs <sessao_id>

const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

const sessao = process.argv[2];
if (!sessao) { console.error('faltou o sessao_id'); process.exit(1); }

const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };

async function getJson(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${path}: ${await r.text()}`);
  return r.json();
}

(async () => {
  // 1) meta (parte 0)
  const meta0 = await getJson(`sessao_dumps?select=parte,total,sessao_meta&sessao_id=eq.${encodeURIComponent(sessao)}&parte=eq.0`);
  if (!meta0.length) throw new Error('sessão não encontrada (sem parte 0)');
  const total = meta0[0].total;
  const meta  = meta0[0].sessao_meta || {};

  // 2) todas as partes de amostras (1..N), em ordem
  const partes = await getJson(`sessao_dumps?select=parte,amostras&sessao_id=eq.${encodeURIComponent(sessao)}&parte=gt.0&order=parte`);
  let amostras = [];
  for (const p of partes) {
    let a = p.amostras;
    if (typeof a === 'string') a = JSON.parse(a);
    if (Array.isArray(a)) amostras = amostras.concat(a);
  }

  // 3) só GPS, com kmh válido
  const gps = amostras.filter(s => s && s.Tipo === 'gps' && s.Dados && typeof s.Dados.kmh === 'number');

  // 4) Vmin global do cru + estatísticas reproduzíveis
  let vmin = null, vmax = null, soma = 0;
  for (const s of gps) {
    const k = s.Dados.kmh;
    soma += k;
    if (vmin === null || k < vmin.Dados.kmh) vmin = s;
    if (vmax === null || k > vmax.Dados.kmh) vmax = s;
  }
  const media = gps.length ? soma / gps.length : 0;

  const fmt = n => (n === null || n === undefined) ? 'n/a' : Number(n);
  console.log('== AUDITOR sessao_dumps (lado nuvem/iMac) ==');
  console.log('sessao_id        :', sessao);
  console.log('partes (meta+dad):', `${partes.length + 1} (total declarado: ${total})`);
  console.log('UUIDs no meta    :', `carro=${meta.carro_id || '—'}  track=${meta.track_id || '—'}  time=${meta.time_id || '—'}`);
  console.log('n_amostras (meta):', meta.n_amostras, ' | n_gps (meta):', meta.n_gps);
  console.log('amostras remontad:', amostras.length, ' | GPS válidas:', gps.length);
  console.log('confere remontagem:', amostras.length === meta.n_amostras ? 'SIM ✅' : `NÃO ❌ (${amostras.length} vs ${meta.n_amostras})`);
  console.log('---');
  console.log('Vmin (km/h)      :', vmin ? fmt(vmin.Dados.kmh) : 'n/a',
              vmin ? `  @ lat=${vmin.Dados.lat} lon=${vmin.Dados.lon}  Seq=${vmin.Seq} TWall=${vmin.TWall}` : '');
  console.log('Vmax (km/h)      :', vmax ? fmt(vmax.Dados.kmh) : 'n/a');
  console.log('Vméd (km/h)      :', Number(media.toFixed(4)));
  console.log('janela (TWall)   :', gps.length ? `${gps[0].TWall} → ${gps[gps.length-1].TWall} (${((gps[gps.length-1].TWall-gps[0].TWall)/1000).toFixed(1)}s)` : 'n/a');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
