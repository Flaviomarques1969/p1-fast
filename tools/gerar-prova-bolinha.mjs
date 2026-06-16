// gerar-prova-bolinha.mjs — monta a prova visual da recalibração:
// desenho EXATO da pista do Command Box + a volta REAL do Bubi projetada por cima
// + a bolinha andando com esse dado real. Não toca no mockup. Tela cheia, sem ícones.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = JSON.parse(readFileSync('/tmp/recal-cb/prova.json','utf8'));
const trackD = P.cb_track_d;
const lap = P.volta_real_projetada_full;
const vr = P.volta_real_bubi_projetada;
const cm = P.casamento_desenho_oficial_para_cb;
const polyline = lap.map(p=>p.join(',')).join(' ');

const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prova — bolinha do carro no Command Box (recalibração)</title>
<style>
  :root{ --bg:#06080c; --pista:#2a2f37; --linha:#39d0ff; --car:#ff3b3b; --txt:#e7eaef; --mut:#8b93a1; }
  *{box-sizing:border-box} html,body{margin:0;height:100%;background:var(--bg);color:var(--txt);
    font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{display:flex;flex-direction:column;height:100vh;width:100vw}
  header{padding:14px 22px;border-bottom:1px solid #1a2029;display:flex;gap:28px;align-items:baseline;flex-wrap:wrap}
  h1{font-size:18px;margin:0;font-weight:700;letter-spacing:.01em}
  .stat{color:var(--mut)} .stat b{color:var(--txt)}
  .ok{color:#3fe08c} .warn{color:#ffcc4d}
  main{flex:1;min-height:0;display:flex}
  .palco{flex:1;min-height:0;position:relative}
  svg{width:100%;height:100%;display:block}
  .lado{width:300px;border-left:1px solid #1a2029;padding:18px 20px;overflow:auto}
  .lado h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin:0 0 8px}
  .lg{display:flex;align-items:center;gap:9px;margin:7px 0}
  .sw{width:26px;height:5px;border-radius:3px} .dotsw{width:12px;height:12px;border-radius:50%}
  ul{margin:8px 0 18px;padding-left:18px;color:var(--mut)} li{margin:4px 0}
  .big{font-size:30px;font-weight:800;letter-spacing:-.01em} .unidade{font-size:13px;color:var(--mut)}
  .ctrl{margin-top:8px} button{background:#141a23;color:var(--txt);border:1px solid #2a3340;border-radius:8px;
    padding:8px 14px;font-weight:700;cursor:pointer} button:hover{border-color:#3a4654}
</style></head>
<body><div class="wrap">
  <header>
    <h1>Bolinha do carro no Command Box — prova da recalibração</h1>
    <span class="stat">Volta REAL do Bubi (23/05) projetada: <b>${vr.n_pontos}</b> pontos de GPS</span>
    <span class="stat">Cai na pista a — mediana <b class="ok">${vr.mediana_em_larguras_de_pista}</b> largura · 95% <b>${vr.p95_em_larguras_de_pista}</b> largura</span>
  </header>
  <main>
    <div class="palco">
      <svg viewBox="130 110 580 660" preserveAspectRatio="xMidYMid meet">
        <path d="${trackD}" fill="none" stroke="var(--pista)" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${trackD}" fill="none" stroke="#11161d" stroke-width="2" stroke-dasharray="3 9" opacity="0.6"/>
        <polyline points="${polyline}" fill="none" stroke="var(--linha)" stroke-width="2" opacity="0.85"/>
        <circle id="car" r="9" fill="var(--car)" stroke="#fff" stroke-width="2"/>
      </svg>
    </div>
    <aside class="lado">
      <h2>O que esta tela mostra</h2>
      <div class="lg"><span class="sw" style="background:var(--pista)"></span> Pista DESENHADA do Command Box (a mesma do painel)</div>
      <div class="lg"><span class="sw" style="background:var(--linha)"></span> Linha que o carro REALMENTE fez (GPS de 23/05)</div>
      <div class="lg"><span class="dotsw" style="background:var(--car)"></span> A bolinha do carro andando por esse dado real</div>

      <h2 style="margin-top:22px">Encaixe na pista</h2>
      <div class="big ok">${vr.mediana_em_larguras_de_pista}<span class="unidade"> largura de pista (mediana)</span></div>
      <ul>
        <li>Mediana: ${vr.mediana_px} px (~1/3 da largura)</li>
        <li>95% dos pontos: ${vr.p95_px} px (~1 largura)</li>
        <li>Pior ponto: ${vr.max_px} px (~${(vr.max_px/vr.largura_pista_px).toFixed(1)} larguras)</li>
        <li>Largura do asfalto desenhado: ${vr.largura_pista_px} px</li>
      </ul>

      <h2>Honesto</h2>
      <ul>
        <li>O resto do erro vem do desenho ser estilizado (à mão), não de conta errada.</li>
        <li>1–2 curvas o desenho "abre" do traçado real — é onde a bolinha mais desencosta.</li>
        <li>Dado de 23/05 é ~1 leitura/segundo (por isso a linha tem "degraus"). A suavização é o item 2.</li>
      </ul>

      <div class="ctrl"><button id="toggle">Pausar / continuar a bolinha</button></div>
    </aside>
  </main>
</div>
<script>
  const LAP = ${JSON.stringify(lap)};
  const car = document.getElementById('car');
  let i = 0, playing = true;
  function step(){ if(playing){ const p = LAP[i % LAP.length]; car.setAttribute('cx', p[0]); car.setAttribute('cy', p[1]); i++; } }
  setInterval(step, 60);
  document.getElementById('toggle').onclick = ()=>{ playing = !playing; };
</script>
</body></html>`;
writeFileSync(ROOT+'relatorios/prova-bolinha-command-box.html', html);
console.log('Escrito: relatorios/prova-bolinha-command-box.html');
