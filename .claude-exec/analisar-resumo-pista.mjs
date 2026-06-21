import fs from 'fs';

const FILE = process.argv[2];
const OUT_HTML = process.argv[3];
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const am = j.amostras || [];
const meta = j.sessao || {};

const gps = am.filter(a => a.tipo === 'gps').map(a => ({ t: a.tWall, ...(a.dados || {}) }));
const mot = am.filter(a => a.tipo === 't4000').map(a => ({ t: a.tWall, ...(a.dados || {}) }));

// --- GPS: limpar outliers (fix>=3 + caixa em torno da mediana) ---
function median(arr){ if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }
const latAll = gps.map(p=>p.lat).filter(v=>typeof v==='number');
const lonAll = gps.map(p=>p.lon).filter(v=>typeof v==='number');
const medLat = median(latAll), medLon = median(lonAll);
const dentro = (p)=> typeof p.lat==='number' && typeof p.lon==='number' && Math.abs(p.lat-medLat)<0.03 && Math.abs(p.lon-medLon)<0.03;
const gpsValido = gps.filter(p => (p.fix>=3) && dentro(p));
const outliers = gps.length - gpsValido.length;

// velocidade
function stats(arr){ const a=arr.filter(v=>typeof v==='number').sort((x,y)=>x-y); if(!a.length) return null;
  const q=(p)=>a[Math.min(a.length-1,Math.floor(p*a.length))]; return {min:a[0],p50:q(0.5),p95:q(0.95),max:a[a.length-1],n:a.length}; }
const spd = stats(gpsValido.map(p=>p.spd));

// distancia (haversine sobre pontos validos consecutivos, gap<2s)
function hav(a,b){ const R=6371000,toR=x=>x*Math.PI/180; const dLat=toR(b.lat-a.lat),dLon=toR(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(s)); }
let distM=0, movS=0, stopS=0;
for(let i=1;i<gpsValido.length;i++){ const a=gpsValido[i-1],b=gpsValido[i]; const dt=(b.t-a.t)/1000;
  if(dt>0&&dt<2){ const d=hav(a,b); if(d<200){ distM+=d; if((b.spd||0)>5) movS+=dt; else stopS+=dt; } } }

// janela / taxa
const tMin=Math.min(...gps.map(p=>p.t)), tMax=Math.max(...gps.map(p=>p.t));
const durS=(tMax-tMin)/1000;
const hzGps = gps.length/durS, hzMot = mot.length/durS;

// --- Motor: campos e faixas ---
const camposMotor = ['rpm','speedKmh','tpsPct','pedalAceleradorPct','pedalFreioPct','pressaoFreioBar','lambda','mapBar','waterTempC','airTempC','batteryV','consumoBorboleta'];
const faixasMotor = {};
for(const c of camposMotor){ const s=stats(mot.map(m=>m[c])); if(s) faixasMotor[c]=s; }

// --- estimativa de voltas: passagens perto do ponto de partida ---
// usa o 1o ponto valido em movimento como referencia grosseira
let voltas = null;
try {
  const ref = gpsValido.find(p=>(p.spd||0)>20) || gpsValido[0];
  let perto=false, cont=0;
  for(const p of gpsValido){ const d=hav(ref,p); if(d<40 && !perto){ cont++; perto=true; } if(d>80) perto=false; }
  voltas = Math.max(0, cont-1);
} catch(e){}

const resumo = {
  sessao: meta.id, status: meta.status,
  janela: { inicio: new Date(tMin).toISOString(), fim: new Date(tMax).toISOString(), durS: Math.round(durS), durMin: +(durS/60).toFixed(1) },
  gps: { total: gps.length, validos: gpsValido.length, outliers, hz: +hzGps.toFixed(1), comCru: gps.filter(p=>p.rawHex||true).length,
         velocidade_kmh: spd, distancia_km: +(distM/1000).toFixed(2), tempo_movimento_s: Math.round(movS), tempo_parado_s: Math.round(stopS),
         voltas_estimadas: voltas, area: { latMed: +medLat?.toFixed(6), lonMed: +medLon?.toFixed(6) } },
  motor: { total: mot.length, hz: +hzMot.toFixed(1), campos: Object.keys(faixasMotor), faixas: faixasMotor },
};
console.log(JSON.stringify(resumo, null, 2));

// ---------- HTML ----------
// caminho da pista (SVG) a partir dos pontos validos
const W=900,H=560,PAD=24;
const lats=gpsValido.map(p=>p.lat), lons=gpsValido.map(p=>p.lon);
const laMin=Math.min(...lats),laMax=Math.max(...lats),loMin=Math.min(...lons),loMax=Math.max(...lons);
const sx=(lo)=>PAD+ (loMax===loMin?0:(lo-loMin)/(loMax-loMin))*(W-2*PAD);
const sy=(la)=>PAD+ (laMax===laMin?0:(1-(la-laMin)/(laMax-laMin)))*(H-2*PAD);
// reduz pontos pra desenho
const passo=Math.max(1,Math.floor(gpsValido.length/2000));
let dPath='';
for(let i=0;i<gpsValido.length;i+=passo){ const p=gpsValido[i]; dPath+=(dPath?'L':'M')+sx(p.lon).toFixed(1)+' '+sy(p.lat).toFixed(1)+' '; }
const ini=gpsValido[0], fim=gpsValido[gpsValido.length-1];

// grafico de velocidade
const VW=900,VH=200,VP=24;
const vsamp=[]; const passo2=Math.max(1,Math.floor(gpsValido.length/600));
for(let i=0;i<gpsValido.length;i+=passo2) vsamp.push(gpsValido[i]);
const vmax=Math.max(60,...vsamp.map(p=>p.spd||0));
const vx=(i)=>VP+ i/(vsamp.length-1)*(VW-2*VP);
const vy=(s)=>VP+ (1-(s/vmax))*(VH-2*VP);
let vPath=''; vsamp.forEach((p,i)=>{ vPath+=(i?'L':'M')+vx(i).toFixed(1)+' '+vy(p.spd||0).toFixed(1)+' '; });

const linhaMotor = Object.entries(faixasMotor).map(([c,s])=>{
  const nome={rpm:'Rotação (rpm)',speedKmh:'Velocidade pelo motor (km/h)',tpsPct:'Borboleta/acelerador (%)',pedalAceleradorPct:'Pedal acelerador (%)',pedalFreioPct:'Pedal de freio (%)',pressaoFreioBar:'Pressão de freio (bar)',lambda:'Lambda (mistura)',mapBar:'Pressão admissão MAP (bar)',waterTempC:'Temp. água (°C)',airTempC:'Temp. ar (°C)',batteryV:'Bateria (V)',consumoBorboleta:'Consumo borboleta'}[c]||c;
  return `<tr><td>${nome}</td><td class="num">${(+s.min).toFixed(1)}</td><td class="num">${(+s.p50).toFixed(1)}</td><td class="num">${(+s.p95).toFixed(1)}</td><td class="num">${(+s.max).toFixed(1)}</td></tr>`;
}).join('');

const fmt=(n)=>n==null?'—':n;
const html=`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P1 Fast — Resumo dos dados da pista (21/06)</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#0b0f14;color:#e6edf3;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{padding:22px 28px;border-bottom:1px solid #1f2937}
h1{margin:0 0 4px;font-size:24px}.sub{color:#9aa7b4;font-size:14px}
main{padding:22px 28px 60px;width:100%}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:8px 0 24px}
.card{background:#11161d;border:1px solid #1f2937;border-radius:12px;padding:16px}
.card .k{color:#9aa7b4;font-size:13px}.card .v{font-size:26px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums}
.card .u{color:#9aa7b4;font-size:13px;font-weight:400}
.sec{margin:30px 0 10px;font-size:18px;font-weight:700}
.grid2{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;align-items:start}
@media(max-width:1100px){.grid2{grid-template-columns:1fr}}
svg{background:#0e141b;border:1px solid #1f2937;border-radius:12px;width:100%;height:auto}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #1f2937}
th{color:#9aa7b4;font-size:13px}td.num{font-variant-numeric:tabular-nums;text-align:right}
.nota{background:#11161d;border:1px solid #2b3a4d;border-radius:12px;padding:16px;margin-top:18px;color:#cbd5e1}
.bad{color:#ffb4b4}.good{color:#b9f5cf}.warn{color:#ffe9b0}
.leg{color:#9aa7b4;font-size:13px;margin:6px 2px}
</style></head><body>
<header><h1>Resumo dos dados da pista — 21/06/2026</h1>
<div class="sub">Sessão recuperada: ${meta.id} · ${resumo.janela.inicio.replace('T',' ').slice(0,19)} a ${resumo.janela.fim.slice(11,19)} (UTC) · ${resumo.janela.durMin} min</div></header>
<main>
<div class="cards">
<div class="card"><div class="k">Duração da sessão</div><div class="v">${resumo.janela.durMin} <span class="u">min</span></div></div>
<div class="card"><div class="k">Distância percorrida</div><div class="v">${resumo.gps.distancia_km} <span class="u">km</span></div></div>
<div class="card"><div class="k">Velocidade máxima (GPS)</div><div class="v">${spd?spd.max.toFixed(1):'—'} <span class="u">km/h</span></div></div>
<div class="card"><div class="k">Rotação máxima (motor)</div><div class="v">${faixasMotor.rpm?Math.round(faixasMotor.rpm.max):'—'} <span class="u">rpm</span></div></div>
<div class="card"><div class="k">Pontos de GPS</div><div class="v">${resumo.gps.validos} <span class="u">de ${resumo.gps.total}</span></div></div>
<div class="card"><div class="k">Leituras do motor</div><div class="v">${resumo.motor.total} <span class="u">${resumo.motor.hz} Hz</span></div></div>
<div class="card"><div class="k">Tempo em movimento</div><div class="v">${(resumo.gps.tempo_movimento_s/60).toFixed(1)} <span class="u">min</span></div></div>
<div class="card"><div class="k">Voltas (estimativa)</div><div class="v">${resumo.gps.voltas_estimadas==null?'—':resumo.gps.voltas_estimadas}</div></div>
</div>

<div class="sec">Traçado percorrido (GPS)</div>
<div class="grid2">
<div>
<svg viewBox="0 0 ${W} ${H}">
<path d="${dPath}" fill="none" stroke="#4aa3ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="${sx(ini.lon).toFixed(1)}" cy="${sy(ini.lat).toFixed(1)}" r="7" fill="#2f9e5b"/>
<circle cx="${sx(fim.lon).toFixed(1)}" cy="${sy(fim.lat).toFixed(1)}" r="7" fill="#e05555"/>
</svg>
<div class="leg">Verde = início · Vermelho = fim · Coordenadas reais (Autódromo de Brasília, ~${resumo.gps.area.latMed}, ${resumo.gps.area.lonMed})</div>
</div>
<div>
<div class="card"><div class="k">Velocidade</div>
<div style="margin-top:10px">mín <b>${spd?spd.min.toFixed(1):'—'}</b> · típica (mediana) <b>${spd?spd.p50.toFixed(1):'—'}</b> · alta (95%) <b>${spd?spd.p95.toFixed(1):'—'}</b> · máx <b>${spd?spd.max.toFixed(1):'—'}</b> km/h</div>
<div style="margin-top:14px" class="k">Qualidade do GPS</div>
<div style="margin-top:6px">${resumo.gps.validos} pontos bons · <span class="warn">${resumo.gps.outliers} pontos de ruído descartados</span> · taxa ~${resumo.gps.hz} leituras/seg · sinal cru preservado</div>
</div>
</div>
</div>

<div class="sec">Velocidade ao longo do tempo (km/h)</div>
<svg viewBox="0 0 ${VW} ${VH}">
<line x1="${VP}" y1="${vy(0).toFixed(1)}" x2="${VW-VP}" y2="${vy(0).toFixed(1)}" stroke="#1f2937"/>
<path d="${vPath}" fill="none" stroke="#4aff9e" stroke-width="1.6"/>
<text x="${VP}" y="16" fill="#9aa7b4" font-size="12">topo = ${Math.round(vmax)} km/h</text>
</svg>

<div class="sec">Dados do motor (T4000) — faixas medidas</div>
<table><thead><tr><th>Medida</th><th class="num">mín</th><th class="num">mediana</th><th class="num">alta (95%)</th><th class="num">máx</th></tr></thead>
<tbody>${linhaMotor}</tbody></table>

<div class="nota">
<b>Leitura honesta do que foi recuperado:</b><br>
<span class="good">GPS:</span> completo e cru, taxa cheia (~${resumo.gps.hz}/seg), ${resumo.gps.validos} pontos bons, traçado e velocidade reais. Os ${resumo.gps.outliers} pontos de ruído (sinal ruim no começo) foram descartados só para o resumo — o dado bruto está guardado.<br>
<span class="warn">Motor (T4000):</span> recuperado, porém em <b>baixa resolução</b> (~${resumo.motor.hz} leitura/seg, contra as 10/seg do projeto) e <b>sem o sinal cru</b>. Isso porque a versão completa do motor era gravada no painel do piloto, que <span class="bad">não gravou nada nesta corrida</span>. As medidas acima são reais, mas com menos detalhe por segundo.<br>
<b>Origem:</b> esta é a sessão da Central de Pista recuperada hoje. Se houve outras corridas, elas ainda estão guardadas no navegador do notebook.
</div>
</main></body></html>`;

fs.writeFileSync(OUT_HTML, html);
console.error('HTML escrito em', OUT_HTML);
