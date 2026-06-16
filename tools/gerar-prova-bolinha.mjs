// gerar-prova-bolinha.mjs — prova visual da recalibração (item 1) + suavização (item 2).
// Desenho EXATO da pista do Command Box + volta REAL do Bubi projetada por cima
// + DUAS bolinhas: CRUA (pula de 1 em 1 segundo) e SUAVIZADA (desliza pela pista a 60 q/s).
// Não toca no mockup. Tela cheia, sem ícones.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = JSON.parse(readFileSync('/tmp/recal-cb/prova.json','utf8'));
const trackD = P.cb_track_d;
const vr = P.volta_real_bubi_projetada;
const polyline = P.volta_real_projetada_full.map(p=>p.join(',')).join(' ');

// --- pega o trecho contínuo mais longo SEM buraco de sinal (>1,5s) e usa ~95s dele ---
let s = P.suavizacao.slice().sort((a,b)=>a[0]-b[0]).filter((p,i,a)=> i===0 || p[0]!==a[i-1][0]);
let melhor=[], cur=[s[0]];
for(let i=1;i<s.length;i++){ if(s[i][0]-s[i-1][0] <= 1500){ cur.push(s[i]); } else { if(cur.length>melhor.length) melhor=cur; cur=[s[i]]; } }
if(cur.length>melhor.length) melhor=cur;
const JANELA_MS = 95000;
const t0 = melhor[0][0];
const trecho = melhor.filter(p => (p[0]-t0) <= JANELA_MS);
// [tRel_ms, sFrac] — sFrac em [0,1); a virada de volta é tratada na interpolação
const demo = trecho.map(p=>[ p[0]-t0, p[3] ]);
const durMs = demo[demo.length-1][0] + 1000;
const WALL_MS = 14000;  // toca o trecho acelerado: ~14s por loop, pra ver o contraste rápido

const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prova — bolinha do carro no Command Box (recalibração + suavização)</title>
<style>
  :root{ --bg:#06080c; --pista:#2a2f37; --linha:#39d0ff; --car:#ff3b3b; --raw:#7b8493; --txt:#e7eaef; --mut:#8b93a1; }
  *{box-sizing:border-box} html,body{margin:0;height:100%;background:var(--bg);color:var(--txt);
    font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{display:flex;flex-direction:column;height:100vh;width:100vw}
  header{padding:13px 22px;border-bottom:1px solid #1a2029;display:flex;gap:26px;align-items:baseline;flex-wrap:wrap}
  h1{font-size:18px;margin:0;font-weight:700}
  .stat{color:var(--mut)} .stat b{color:var(--txt)} .ok{color:#3fe08c}
  main{flex:1;min-height:0;display:flex}
  .palco{flex:1;min-height:0;position:relative}
  svg{width:100%;height:100%;display:block}
  .lado{width:320px;border-left:1px solid #1a2029;padding:18px 20px;overflow:auto}
  .lado h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin:18px 0 8px}
  .lado h2:first-child{margin-top:0}
  .lg{display:flex;align-items:center;gap:9px;margin:7px 0}
  .sw{width:26px;height:5px;border-radius:3px} .dotsw{width:13px;height:13px;border-radius:50%}
  ul{margin:8px 0 6px;padding-left:18px;color:var(--mut)} li{margin:5px 0}
  .big{font-size:28px;font-weight:800} .unidade{font-size:13px;color:var(--mut)}
  .ctrl{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
  button{background:#141a23;color:var(--txt);border:1px solid #2a3340;border-radius:8px;padding:8px 13px;font-weight:700;cursor:pointer}
  button:hover{border-color:#3a4654} button.off{opacity:.4}
</style></head>
<body><div class="wrap">
  <header>
    <h1>Bolinha do carro no Command Box — recalibração (item 1) + suavização (item 2)</h1>
    <span class="stat">Volta REAL do Bubi (23/05): <b>${vr.n_pontos}</b> leituras de GPS, ~1 por segundo</span>
    <span class="stat">Cai na pista a — mediana <b class="ok">${vr.mediana_em_larguras_de_pista}</b> largura</span>
  </header>
  <main>
    <div class="palco">
      <svg id="svg" viewBox="130 110 580 660" preserveAspectRatio="xMidYMid meet">
        <path id="track" d="${trackD}" fill="none" stroke="var(--pista)" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="${polyline}" fill="none" stroke="var(--linha)" stroke-width="1.5" opacity="0.55"/>
        <circle id="raw" r="8" fill="none" stroke="var(--raw)" stroke-width="2.5"/>
        <circle id="car" r="9" fill="var(--car)" stroke="#fff" stroke-width="2"/>
      </svg>
    </div>
    <aside class="lado">
      <h2>As duas bolinhas</h2>
      <div class="lg"><span class="dotsw" style="background:var(--car)"></span> SUAVIZADA — desliza pela pista (60 q/s)</div>
      <div class="lg"><span class="dotsw" style="border:2.5px solid var(--raw)"></span> CRUA — pula a cada leitura (1/seg)</div>
      <div class="lg"><span class="sw" style="background:var(--linha)"></span> Linha real do carro (GPS de 23/05)</div>
      <div class="lg"><span class="sw" style="background:var(--pista)"></span> Pista desenhada do Command Box</div>

      <h2>Por que suavizar</h2>
      <div class="big">~28 m<span class="unidade"> de salto por leitura (a 100 km/h)</span></div>
      <ul>
        <li>O GPS de hoje dá ~1 leitura por segundo (medido: 1000 ms).</li>
        <li>Sem suavizar, a bolinha teleporta de 28 em 28 metros (a cinza).</li>
        <li>Suavizada, ela desliza pela pista entre as leituras (a vermelha).</li>
      </ul>

      <h2>Honesto</h2>
      <ul>
        <li>A suavizada gruda no traço da pista entre leituras — fica lisa e sempre na pista.</li>
        <li>Quando o sinal cai (teve buraco de 9 s na volta), ela NÃO inventa trajeto: espera a próxima leitura.</li>
        <li>O desvio lateral real (carro abrir na curva) volta com o sensor rápido (25/seg) — item 3.</li>
      </ul>

      <div class="ctrl">
        <button id="bSuav">Suavizada: ligada</button>
        <button id="bRaw">Crua: ligada</button>
        <button id="bPausa">Pausar</button>
      </div>
    </aside>
  </main>
</div>
<script>
  const DEMO = ${JSON.stringify(demo)};        // [tRel_ms, sFrac]
  const DUR  = ${durMs};                        // duração real do trecho (ms)
  const WALL = ${WALL_MS};                       // duração na tela (acelerado)
  const track = document.getElementById('track');
  const L = track.getTotalLength();
  const car = document.getElementById('car'), raw = document.getElementById('raw');
  let playing=true, showSuav=true, showRaw=true, base=null;

  function sFracAt(tRel){
    // interpola a fração de arco entre as leituras que cercam tRel
    if(tRel<=DEMO[0][0]) return DEMO[0][1];
    for(let i=1;i<DEMO.length;i++){ if(tRel<=DEMO[i][0]){
      const a=DEMO[i-1], b=DEMO[i]; const f=(tRel-a[0])/((b[0]-a[0])||1);
      let s0=a[1], s1=b[1]; if(s1<s0) s1+=1;            // trata virada de volta
      let s=s0+(s1-s0)*f; return s%1;
    }}
    return DEMO[DEMO.length-1][1];
  }
  function rawIndexAt(tRel){ let idx=0; for(let i=0;i<DEMO.length;i++){ if(DEMO[i][0]<=tRel) idx=i; else break; } return idx; }
  function place(el,sFrac){ const p=track.getPointAtLength(sFrac*L); el.setAttribute('cx',p.x); el.setAttribute('cy',p.y); }

  function frame(ts){
    if(base===null) base=ts;
    if(playing){
      const tRel=((ts-base)%DUR);
      if(showSuav){ place(car, sFracAt(tRel)); car.style.opacity=1; } else car.style.opacity=0;
      if(showRaw){ place(raw, DEMO[rawIndexAt(tRel)][1]); raw.style.opacity=1; } else raw.style.opacity=0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.getElementById('bSuav').onclick=function(){ showSuav=!showSuav; this.textContent='Suavizada: '+(showSuav?'ligada':'desligada'); this.classList.toggle('off',!showSuav); };
  document.getElementById('bRaw').onclick =function(){ showRaw=!showRaw;  this.textContent='Crua: '+(showRaw?'ligada':'desligada'); this.classList.toggle('off',!showRaw); };
  document.getElementById('bPausa').onclick=function(){ playing=!playing; this.textContent=playing?'Pausar':'Continuar'; };
</script>
</body></html>`;
writeFileSync(ROOT+'relatorios/prova-bolinha-command-box.html', html);
console.log('Escrito: relatorios/prova-bolinha-command-box.html  | volta demo:', demo.length, 'leituras, dur', (durMs/1000).toFixed(1),'s');
