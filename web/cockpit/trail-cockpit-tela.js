// trail-cockpit-tela.js — camada VISUAL do cockpit em modo treino TRAIL BRAKING.
//
// Contrato visual = mockup VIVO (rodadas 8-17 do ditado, 11-12/06/2026):
// _design-reference/mockup-cockpit-treino-trail-braking-VIVO-2026-06-11.html
//
// Regras de convivência com o painel canônico:
//   - Esta camada SÓ é criada com treino trail armado (precedente da
//     tela-orientacao.js: DOM + CSS próprios injetados em runtime). Sem
//     treino, nenhum byte do painel muda.
//   - Componentes REAIS reutilizados via classes do cockpit.css (.shift-light,
//     .shift-light__dot, .apex) — NUNCA bolinha genérica (rodada 4).
//   - O clarão do zero usa um CLONE do .fire-overlay (mesmos 3 pulsos): o
//     renderizador ao vivo reescreve data-shift-fire a cada amostra de RPM e
//     mataria a animação do overlay canônico no meio.
//   - Enquanto o treino está armado: troca de marcha NÃO faz onda (clarão é
//     exclusivo do freio — ditado) e o fundo é SEMPRE preto (rodada 15).
//
// Quem decide o conteúdo é o trail-cockpit-motor.js; aqui só se desenha.

import { ShiftMode } from './cockpit-state.js';

// geometria do SVG do mockup VIVO (viewBox 860×320)
const X0 = 70, XB = 300, XA = 740, YG = 252, PLATO = 56, BAND = 16, DIST_APROX = 143;
const PXM_APROX = (XB - X0) / DIST_APROX;

const CSS = `
/* trilho vertical de trechos — FAIXA PRÓPRIA (rodada 10) */
.p1trail-trilho { position:absolute; top:36px; bottom:140px; left:64px; width:126px; z-index:40;
  display:flex; flex-direction:column; gap:5px; transition:opacity 420ms var(--ease-out); }
.p1trail-trilho .titulo { font:800 9px 'JetBrains Mono',monospace; color:#e7c463; letter-spacing:1px; }
.p1trail-trilho .tr { flex:1; display:flex; align-items:center; gap:5px; }
.p1trail-trilho .tr .nome { width:24px; font:800 11px 'JetBrains Mono',monospace; color:#8a99a8; }
.p1trail-trilho .tr.atual .nome { color:#fff; }
.p1trail-trilho .tr .passes { display:flex; gap:4px; flex:1; }
.p1trail-trilho .tr .p { width:18px; height:18px; border-radius:4px; background:#1a222c; }
.p1trail-trilho .tr .p.certo { background:oklch(80% 0.22 145); box-shadow:0 0 6px oklch(80% 0.22 145 / .5); }
.p1trail-trilho .tr .p.errado { background:oklch(68% 0.26 27); box-shadow:0 0 6px oklch(68% 0.26 27 / .5); }
.p1trail-trilho .tr .p.calib { background:#2a3645; }
.p1trail-trilho .tr .p.agora { outline:2px solid #fff; outline-offset:1px;
  animation:p1trailAgora 1.1s ease-in-out infinite; }
@keyframes p1trailAgora { 0%,100%{outline-color:#fff} 50%{outline-color:#5b6b7c} }
.p1trail-trilho .tr.atual { background:rgba(231,196,99,.07); border-radius:5px; }

/* SHIFT LIGHT DE FREIO — componente REAL na vertical, 2 colunas laterais (rodada 9):
   mesmo LED, mesmo gap de 18px, de cima pra baixo; fechou embaixo = FREIA */
.p1trail-freio-v { bottom:auto; left:auto; top:50%; transform:translateY(-50%);
  flex-direction:column; gap:18px; padding:26px 9px; z-index:46;
  transition:opacity 480ms var(--ease-out); }
.p1trail-freio-v.lado-esq { left:24px; }  /* tela 10,5 sem recorte: cola na borda */
.p1trail-freio-v.lado-dir { right:24px; }

/* palco do gráfico vivo — a faixa do trilho à esquerda é só dele (rodada 10);
   o gráfico só entra quando a reta começa (rodada 12) */
.p1trail-grafico { position:absolute; left:21%; top:8%; bottom:32%; width:70%; z-index:9;
  transition:opacity 420ms var(--ease-out); }
.p1trail-grafico svg { width:100%; height:100%; }

/* CONTAGEM REGRESSIVA — tipografia métrica gigante com brilho em camadas;
   rodada 14: sem nenhum texto pequeno perto do gráfico */
.p1trail-contagem { font:800 118px 'JetBrains Mono',monospace; letter-spacing:-5px;
  fill:oklch(85% 0.17 80); filter:drop-shadow(0 0 16px oklch(78% 0.18 65 / .5));
  transform-box:fill-box; transform-origin:50% 50%; }
.p1trail-contagem.puls { animation:p1trailCtPulse 240ms var(--ease-out); }
@keyframes p1trailCtPulse { 0%{transform:scale(1.16)} 100%{transform:scale(1)} }

/* PISCA DE ERRO — clarão VERMELHO do dispositivo inteiro, 3 pulsos a ~10 Hz +
   brasa enquanto a freada seguir fora da linha (rodada 8) */
.p1trail-flash-erro { position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:210;
  background:
    radial-gradient(ellipse 110% 70% at 50% 100%,
      oklch(62% 0.26 27 / .55) 0%, oklch(58% 0.25 27 / .25) 35%,
      oklch(50% 0.22 27 / .06) 65%, transparent 85%),
    linear-gradient(0deg, oklch(60% 0.25 27 / .35) 0%, transparent 22%);
  box-shadow: inset 0 0 0 2px oklch(66% 0.25 27 / .6), inset 0 0 70px oklch(58% 0.25 27 / .4);
  opacity:0; transition:opacity 300ms var(--ease-out); }
.p1trail-flash-erro.sustain { animation:p1trailErroPisca 600ms ease-in-out infinite alternate; }
.p1trail-flash-erro.fire { animation:p1trailFlashErro 300ms linear; }
@keyframes p1trailFlashErro {
  0%{opacity:0} 3%{opacity:1} 28%{opacity:1} 33%{opacity:0} 39%{opacity:0}
  43%{opacity:1} 65%{opacity:1} 71%{opacity:0} 76%{opacity:0} 80%{opacity:1}
  92%{opacity:.9} 100%{opacity:.32} }
@keyframes p1trailErroPisca { 0%{opacity:.5} 100%{opacity:.15} }

/* TELA VERDE PISCANDO — freada DENTRO da margem (rodada 19): o espelho
   positivo do pisca de erro, pulsando enquanto a freada seguir na banda */
.p1trail-flash-certo { position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:205;
  background:
    radial-gradient(ellipse 110% 70% at 50% 100%,
      oklch(72% 0.20 145 / .45) 0%, oklch(66% 0.19 145 / .20) 35%,
      oklch(58% 0.17 145 / .05) 65%, transparent 85%),
    linear-gradient(0deg, oklch(70% 0.20 145 / .28) 0%, transparent 22%);
  box-shadow: inset 0 0 0 2px oklch(76% 0.20 145 / .55), inset 0 0 70px oklch(66% 0.19 145 / .35);
  opacity:0; transition:opacity 300ms var(--ease-out); }
.p1trail-flash-certo.on { animation:p1trailCertoPisca 600ms ease-in-out infinite alternate; }
@keyframes p1trailCertoPisca { 0%{opacity:.45} 100%{opacity:.12} }

/* INDICADOR APERTA/SOLTA o freio (rodada 19) — lado direito, em cima dos
   dados de SAÍDA; máx 2 palavras, gigante, leitura periférica */
.p1trail-corrige { position:absolute; right:36px; bottom:138px; z-index:48;
  font:900 44px 'Inter',sans-serif; letter-spacing:2px; color:oklch(85% 0.17 80);
  text-shadow:0 0 24px oklch(78% 0.18 65 / .6), 0 2px 0 oklch(0% 0 0);
  opacity:0; transition:opacity 200ms var(--ease-out); }
.p1trail-corrige.on { opacity:1; }

/* CLARÃO DO ZERO — clone do .fire-overlay canônico (mesmos 3 pulsos branco-azul);
   overlay próprio porque o renderizador reescreve data-shift-fire a cada amostra */
.p1trail-fire { position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:200;
  background:
    radial-gradient(ellipse 110% 65% at 50% 0%,
      oklch(96% 0.10 235 / .55) 0%, oklch(88% 0.14 240 / .25) 35%,
      oklch(72% 0.16 245 / .06) 65%, transparent 85%),
    linear-gradient(180deg, oklch(94% 0.10 235 / .35) 0%, transparent 22%);
  box-shadow: inset 0 0 0 2px oklch(94% 0.08 230 / .55), inset 0 0 60px oklch(92% 0.10 235 / .35);
  opacity:0; }
.p1trail-fire.fire { animation:p1trailFire 300ms linear forwards; }
@keyframes p1trailFire {
  0%{opacity:0} 3%{opacity:1} 28%{opacity:1} 33%{opacity:0} 39%{opacity:0}
  43%{opacity:1} 65%{opacity:1} 71%{opacity:0} 76%{opacity:0} 80%{opacity:1}
  92%{opacity:.9} 100%{opacity:0} }

/* esconder elementos do painel padrão durante a janela de frenagem */
.p1trail-escondido { opacity:0 !important; pointer-events:none; }
.p1trail-suave { transition:opacity 480ms var(--ease-out); }
/* o bloco do delta tem transição canônica própria (deslize de 1200 ms) —
   o esmaecer do treino SOMA a ela, não a substitui */
.info-bloco.p1trail-suave { transition: transform 1200ms var(--ease-msg), opacity 480ms var(--ease-out); }

/* mensagem ativa (grave ou comunicação) é dona do palco no momento base:
   o trilho sai de cena pra não desenhar por cima do delta deslizado */
.device[data-msg-state="ativa"] .p1trail-trilho { opacity:0; pointer-events:none; }

/* o diagnóstico de telemetria (6 bolinhas) fica em cima da coluna direita do
   freio — sai de cena só enquanto as colunas estão na tela */
.device[data-p1trail-colunas="on"] .telemetria-chip { opacity:0; transition:opacity 480ms var(--ease-out); }

/* com o gráfico na tela, mensagem de COMUNICAÇÃO não cobre o desenho
   (rodada 10: veredito SEM letreiro; o gráfico é o resultado).
   Alerta GRAVE continua atropelando tudo — não é tocado. */
.device[data-p1trail-grafico="on"] .alert-bloco[data-tipo="comunicacao"] { opacity:0 !important; pointer-events:none; }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_MIOLO = `
<defs>
  <linearGradient id="p1tGAlvo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="oklch(86% 0.17 80)"/>
    <stop offset="1" stop-color="oklch(62% 0.14 65)"/>
  </linearGradient>
  <linearGradient id="p1tGBanda" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="oklch(78% 0.18 65)" stop-opacity=".22"/>
    <stop offset="1" stop-color="oklch(78% 0.18 65)" stop-opacity=".035"/>
  </linearGradient>
  <linearGradient id="p1tGPinta" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="oklch(74% 0.16 73)" stop-opacity=".25"/>
    <stop offset=".75" stop-color="oklch(85% 0.17 80)"/>
    <stop offset="1" stop-color="oklch(99% 0.02 90)"/>
  </linearGradient>
  <filter id="p1tGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<g stroke="oklch(22% 0 0)" stroke-width="1">
  <line x1="50" y1="64" x2="820" y2="64"/><line x1="50" y1="158" x2="820" y2="158"/>
</g>
<line x1="50" y1="252" x2="820" y2="252" stroke="oklch(30% 0 0)" stroke-width="1.5"/>
<g data-p1t="marcos"></g>
<path data-p1t="banda" d="" fill="url(#p1tGBanda)" stroke="oklch(78% 0.18 65 / .35)" stroke-width="1"/>
<path data-p1t="halo" d="" fill="none" stroke="oklch(78% 0.18 65 / .35)" stroke-width="12" filter="url(#p1tGlow)"/>
<path data-p1t="alvo" d="" fill="none" stroke="url(#p1tGAlvo)" stroke-width="4" stroke-linecap="round"/>
<line data-p1t="marcaPonto" x1="300" y1="36" x2="300" y2="252" stroke="oklch(78% 0.18 65 / .6)"
      stroke-width="1.6" stroke-dasharray="2 5"/>
<circle data-p1t="pontoBase" cx="300" cy="252" r="9" fill="oklch(99% 0.02 90)" opacity="0"
        style="filter:drop-shadow(0 0 16px oklch(95% 0.06 88)) drop-shadow(0 0 36px oklch(80% 0.17 75))"/>
<line data-p1t="linhaZero" x1="281" y1="44" x2="281" y2="252" stroke="oklch(82% 0.17 78 / .45)"
      stroke-width="1.2" stroke-dasharray="5 4"/>
<path data-p1t="pintaChao" d="" stroke="url(#p1tGPinta)" stroke-width="7" stroke-linecap="round" filter="url(#p1tGlow)"/>
<path data-p1t="tracoVerde" d="" fill="none" stroke="oklch(80% 0.22 145)" stroke-width="7"
      stroke-linecap="round" filter="url(#p1tGlow)"/>
<path data-p1t="tracoVermelho" d="" fill="none" stroke="oklch(68% 0.26 27)" stroke-width="7"
      stroke-linecap="round" filter="url(#p1tGlow)"/>
<circle data-p1t="cabeca" r="7.5" fill="oklch(99% 0.02 90)" opacity="0"
        style="filter:drop-shadow(0 0 12px oklch(90% 0.12 85)) drop-shadow(0 0 26px oklch(78% 0.18 65 / .7))"/>
<g data-p1t="gContagem" text-anchor="middle" opacity="0">
  <text data-p1t="contagemNum" x="182" y="170" class="p1trail-contagem">143</text>
</g>`;

function colunaFreio(doc, lado) {
  const el = doc.createElement('div');
  el.className = `shift-light p1trail-freio-v ${lado} p1trail-escondido`;
  el.dataset.state = 'off';
  for (let tier = 1; tier <= 6; tier++) {
    const dot = doc.createElement('span');
    dot.className = 'shift-light__dot';
    dot.dataset.tier = String(tier);
    el.appendChild(dot);
  }
  return el;
}

export function criarTrailCockpitTela({ device, cockpitState, doc } = {}) {
  const d = doc ?? document;
  const dev = device ?? d.getElementById('device');
  if (!dev) throw new Error('trail-cockpit-tela: #device não encontrado');
  let alvoResolver = null; // injetado pelo main (resolve alvo do motor por trecho)

  if (!d.getElementById('p1trail-css')) {
    const st = d.createElement('style');
    st.id = 'p1trail-css';
    st.textContent = CSS;
    d.head.appendChild(st);
  }

  // ── DOM próprio dentro do device ──
  const trilho = d.createElement('div');
  trilho.className = 'p1trail-trilho';
  const grafico = d.createElement('div');
  grafico.className = 'p1trail-grafico p1trail-escondido';
  const svg = d.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 860 320');
  // palco 10,5 é mais alto que o desenho: ancora o gráfico EMBAIXO (o chão da
  // frenagem fica rente à régua), respiro sobra em cima pra contagem
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.innerHTML = SVG_MIOLO;
  grafico.appendChild(svg);
  const colEsq = colunaFreio(d, 'lado-esq');
  const colDir = colunaFreio(d, 'lado-dir');
  const flashErro = d.createElement('div');
  flashErro.className = 'p1trail-flash-erro';
  const flashCerto = d.createElement('div');
  flashCerto.className = 'p1trail-flash-certo';
  const corrige = d.createElement('div');
  corrige.className = 'p1trail-corrige';
  const fireZero = d.createElement('div');
  fireZero.className = 'p1trail-fire';
  dev.append(trilho, grafico, colEsq, colDir, fireZero, flashCerto, flashErro, corrige);

  const sv = (k) => svg.querySelector(`[data-p1t="${k}"]`);
  const el = {
    banda: sv('banda'), halo: sv('halo'), alvo: sv('alvo'), marcos: sv('marcos'),
    marcaPonto: sv('marcaPonto'), pontoBase: sv('pontoBase'), linhaZero: sv('linhaZero'),
    pintaChao: sv('pintaChao'), tracoVerde: sv('tracoVerde'), tracoVermelho: sv('tracoVermelho'),
    cabeca: sv('cabeca'), gContagem: sv('gContagem'), contagemNum: sv('contagemNum'),
  };
  const apexPontos = Array.from(d.querySelectorAll('.apex__ponto')); // ordem: entrada, freio, ápice, saída
  const marchaLight = d.getElementById('shiftLight');
  const infoBloco = d.querySelector('.info-bloco');
  if (marchaLight) marchaLight.classList.add('p1trail-suave');
  if (infoBloco) infoBloco.classList.add('p1trail-suave');

  // ── Modo treino: marcha sem onda + fundo sempre preto (rodada 15) ──
  const applyShiftOriginal = cockpitState ? cockpitState.applyShift.bind(cockpitState) : null;
  const setTrechoOriginal = cockpitState ? cockpitState.setTrechoStatus.bind(cockpitState) : null;
  const setApexOriginal = cockpitState ? cockpitState.setApexPonto.bind(cockpitState) : null;
  if (cockpitState) {
    cockpitState.applyShift = (mode, level = 0) => {
      if (mode === ShiftMode.FIRE) return applyShiftOriginal(ShiftMode.LIT, 6);
      return applyShiftOriginal(mode, level);
    };
    cockpitState.setTrechoStatus = () => setTrechoOriginal('neutro');
    setTrechoOriginal('neutro');
    // a régua .apex tem UM escritor no modo treino (esta camada) — o caminho
    // canônico vira só-estado, sem desenhar por cima
    cockpitState.setApexPonto = () => {};
  }

  // ── desenho do alvo (curva real da melhor passagem DESTE trecho) ──
  let escalaFreio = (XA - XB) / 80; // px por metro na zona de freada (recalculada por alvo)
  let alvoAtual = null;
  function xDe(xM) {
    if (!alvoAtual) return XB;
    const rel = xM - alvoAtual.metricas.freadaM;
    return rel <= 0 ? XB + rel * PXM_APROX : Math.min(840, XB + rel * escalaFreio);
  }
  const yDe = (pct) => YG - (YG - PLATO) * (Math.max(0, Math.min(100, pct)) / 100);

  function aplicarAlvo(alvo, adiantoPrevM) {
    alvoAtual = alvo;
    limparPintura();
    if (!alvo) { el.alvo.setAttribute('d', ''); el.halo.setAttribute('d', ''); el.banda.setAttribute('d', ''); return; }
    const fimM = alvo.fimM ?? alvo.vminM;
    const compFreioM = Math.max(5, fimM - alvo.metricas.freadaM);
    escalaFreio = (XA - XB) / compFreioM;
    const pts = alvo.curva.filter(p => p.distM >= alvo.metricas.freadaM - 0.5 && p.distM <= fimM + 0.5);
    const curva = pts.map(p => [xDe(p.distM), yDe(p.freioPct)]);
    if (curva.length < 2) { el.alvo.setAttribute('d', ''); el.halo.setAttribute('d', ''); el.banda.setAttribute('d', ''); return; }
    const dCurva = curva.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    // curva-alvo = chão da aproximação + curva da freada
    el.alvo.setAttribute('d', `M${X0} ${YG} L${XB} ${YG} ` + dCurva.replace(/^M/, 'L'));
    el.halo.setAttribute('d', dCurva);
    // banda de aceite ±16 px (≈ ±8% de freio) em volta da curva
    const ida = curva.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${(p[1] - BAND).toFixed(1)}`).join(' ');
    const volta = curva.slice().reverse().map(p => `L${p[0].toFixed(1)} ${(p[1] + BAND).toFixed(1)}`).join(' ');
    el.banda.setAttribute('d', `${ida} ${volta} Z`);
    // linha do zero adiantado (previsão pela reação aprendida × velocidade da melhor)
    const xZero = XB - (Number.isFinite(adiantoPrevM) ? adiantoPrevM : 0) * PXM_APROX;
    el.linhaZero.setAttribute('x1', xZero.toFixed(1));
    el.linhaZero.setAttribute('x2', xZero.toFixed(1));
    // marcos de distância: só risquinhos, sem número (rodada 14)
    el.marcos.innerHTML = '';
    for (const m of [120, 90, 60, 30]) {
      const x = XB - m * PXM_APROX;
      const l = d.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', 252); l.setAttribute('y2', 244);
      l.setAttribute('stroke', 'oklch(28% 0 0)'); l.setAttribute('stroke-width', '1');
      el.marcos.appendChild(l);
    }
  }

  function limparPintura() {
    el.pintaChao.setAttribute('d', '');
    el.tracoVerde.setAttribute('d', '');
    el.tracoVermelho.setAttribute('d', '');
    el.cabeca.setAttribute('opacity', '0');
    el.pontoBase.setAttribute('opacity', '0');
    el.marcaPonto.setAttribute('stroke', 'oklch(78% 0.18 65 / .6)');
    el.marcaPonto.setAttribute('stroke-width', '1.6');
    el.marcaPonto.setAttribute('stroke-dasharray', '2 5');
    el.marcaPonto.removeAttribute('filter');
    el.gContagem.setAttribute('opacity', '0');
    encerraFlashErro();
  }

  // ── contagem (cores e pulso por dezena — mockup VIVO) ──
  let decadaAnterior = null;
  function corContagem(dist) {
    if (dist > 60) return ['oklch(85% 0.17 80)', 'drop-shadow(0 0 16px oklch(78% 0.18 65 / .5))'];
    if (dist > 25) return ['oklch(92% 0.12 85)', 'drop-shadow(0 0 20px oklch(82% 0.16 75 / .6))'];
    return ['oklch(99% 0.02 90)', 'drop-shadow(0 0 24px oklch(92% 0.10 85 / .8)) drop-shadow(0 0 50px oklch(80% 0.17 75 / .5))'];
  }
  function renderContagem(c) {
    if (!c) { el.gContagem.setAttribute('opacity', '0'); decadaAnterior = null; return; }
    el.gContagem.setAttribute('opacity', '1');
    el.contagemNum.textContent = String(c.n);
    if (c.modo === 'antes') {
      const dec = Math.floor(c.n / 10);
      if (decadaAnterior !== null && dec !== decadaAnterior) {
        el.contagemNum.classList.remove('puls');
        void el.contagemNum.getBoundingClientRect();
        el.contagemNum.classList.add('puls');
      }
      decadaAnterior = dec;
      const [fill, filtro] = corContagem(c.n);
      el.contagemNum.style.fill = fill;
      el.contagemNum.style.filter = filtro;
    } else if (c.modo === 'depois') {
      el.contagemNum.style.fill = 'oklch(99% 0.02 90)';
      el.contagemNum.style.filter = 'drop-shadow(0 0 24px oklch(92% 0.10 85 / .8))';
    } else { // passou do ponto real
      el.contagemNum.style.fill = 'oklch(70% 0.24 27)';
      el.contagemNum.style.filter = 'drop-shadow(0 0 22px oklch(68% 0.26 27 / .7))';
    }
  }

  // ── colunas de freio ──
  function setNivelColunas(n) {
    for (const col of [colEsq, colDir]) {
      const dots = col.querySelectorAll('.shift-light__dot');
      dots.forEach(dot => dot.classList.toggle('is-on', Number(dot.dataset.tier) <= n));
    }
  }
  function setEstadoColunas(s) { colEsq.dataset.state = s; colDir.dataset.state = s; }
  function setColunasVisiveis(v) {
    colEsq.classList.toggle('p1trail-escondido', !v);
    colDir.classList.toggle('p1trail-escondido', !v);
  }

  // ── traço da freada (verde na banda / vermelho fora) ──
  function renderTraco(traco) {
    if (!traco.length) return;
    let verde = '', vermelho = '', prev = null;
    for (const p of traco) {
      const x = xDe(p.xM).toFixed(1), y = yDe(p.pct).toFixed(1);
      if (p.ok) {
        verde += verde && prev?.ok ? ` L${x} ${y}` : ` M${prev ? `${xDe(prev.xM).toFixed(1)} ${yDe(prev.pct).toFixed(1)} L` : ''}${x} ${y}`;
      } else {
        vermelho += vermelho && prev && !prev.ok ? ` L${x} ${y}` : ` M${prev ? `${xDe(prev.xM).toFixed(1)} ${yDe(prev.pct).toFixed(1)} L` : ''}${x} ${y}`;
      }
      prev = p;
    }
    el.tracoVerde.setAttribute('d', verde.trim());
    el.tracoVermelho.setAttribute('d', vermelho.trim());
    const ult = traco[traco.length - 1];
    el.cabeca.setAttribute('opacity', '1');
    el.cabeca.setAttribute('cx', xDe(ult.xM).toFixed(1));
    el.cabeca.setAttribute('cy', yDe(ult.pct).toFixed(1));
    el.cabeca.style.filter = ult.ok
      ? 'drop-shadow(0 0 12px oklch(80% 0.22 145 / .8)) drop-shadow(0 0 26px oklch(80% 0.22 145 / .5))'
      : 'drop-shadow(0 0 12px oklch(70% 0.24 27 / .9)) drop-shadow(0 0 26px oklch(70% 0.24 27 / .6))';
  }

  function renderAproximacao(distAoPontoM) {
    if (!Number.isFinite(distAoPontoM)) return;
    const headX = Math.max(X0, XB - distAoPontoM * PXM_APROX);
    if (distAoPontoM <= DIST_APROX) {
      el.pintaChao.setAttribute('d', `M${X0} ${YG} L${headX.toFixed(1)} ${YG}`);
      el.cabeca.setAttribute('opacity', '1');
      el.cabeca.setAttribute('cx', headX.toFixed(1));
      el.cabeca.setAttribute('cy', String(YG));
    }
  }

  // ── trilho (DOM PERSISTENTE: reconstruir a cada amostra de GPS reiniciava
  //    a animação da célula 'agora' — ela nunca pulsava — e gerava ~1.000
  //    nós/s à toa; agora cada linha vive e só muda quando o estado muda) ──
  const trilhoLinhas = new Map(); // segId → { tr, nome, passes, chave }
  function montarTrilho(linhas) {
    trilho.innerHTML = '';
    trilhoLinhas.clear();
    const tit = d.createElement('div');
    tit.className = 'titulo';
    tit.textContent = 'TRAIL POR TRECHO';
    trilho.appendChild(tit);
    for (const linha of linhas) {
      const tr = d.createElement('div');
      tr.className = 'tr';
      const nome = d.createElement('span');
      nome.className = 'nome';
      nome.textContent = linha.rotulo;
      const passes = d.createElement('div');
      passes.className = 'passes';
      tr.append(nome, passes);
      trilho.appendChild(tr);
      trilhoLinhas.set(linha.segId, { tr, passes, chave: null });
    }
  }
  function renderTrilho(linhas) {
    if (trilhoLinhas.size !== linhas.length) montarTrilho(linhas);
    for (const linha of linhas) {
      const alvo = trilhoLinhas.get(linha.segId);
      if (!alvo) continue;
      const chave = `${linha.atual ? 1 : 0}|${linha.calibrando ? 1 : 0}|${linha.celulas.join(',')}`;
      if (chave === alvo.chave) continue; // nada mudou — animação segue viva
      alvo.chave = chave;
      alvo.tr.classList.toggle('atual', linha.atual);
      alvo.passes.innerHTML = '';
      // TRILHO POR VOLTA (rodada 19): célula 1 = resultado DESTA volta (vazia
      // se o trecho ainda não foi passado — à frente fica livre);
      // célula 2 = marcador de "agora" no trecho atual
      if (linha.calibrando) {
        for (let i = 0; i < 2; i++) { const c = d.createElement('i'); c.className = 'p calib'; alvo.passes.appendChild(c); }
      } else {
        const cel = linha.celulas[linha.celulas.length - 1] ?? null;
        const c1 = d.createElement('i');
        c1.className = 'p' + (cel ? ' ' + cel : '');
        alvo.passes.appendChild(c1);
        const c2 = d.createElement('i');
        c2.className = 'p' + (linha.atual ? ' agora' : '');
        alvo.passes.appendChild(c2);
      }
    }
  }

  // ── régua .apex real (rótulo em cima, dado embaixo, estados reais) ──
  function renderApex(apex) {
    const ordem = ['entrada', 'freio', 'apice', 'saida'];
    ordem.forEach((k, i) => {
      const ponto = apexPontos[i];
      if (!ponto) return;
      const valor = ponto.querySelector('.apex__valor');
      const v = apex[k];
      ponto.dataset.estado = v ? v.estado : 'pendente';
      if (valor) valor.textContent = v ? v.valor : '—';
    });
  }

  // ── pisca de erro ──
  function disparaFlashErro() {
    flashErro.classList.remove('fire');
    void flashErro.offsetWidth;
    flashErro.classList.add('fire', 'sustain');
  }
  function encerraFlashErro() { flashErro.classList.remove('fire', 'sustain'); }

  // ── visibilidade por fase ──
  function aplicarFase(fase) {
    const janelaFreio = fase === 'aproxima' || fase === 'freia' || fase === 'pos-freada';
    grafico.classList.toggle('p1trail-escondido', fase === 'fora');
    trilho.classList.toggle('p1trail-escondido', janelaFreio);
    setColunasVisiveis(fase === 'aproxima');
    if (fase === 'aproxima') setEstadoColunas('lit');
    // marcha SAI enquanto o freio está na tela (freando só se reduz); volta no pós-trecho
    if (marchaLight) marchaLight.classList.toggle('p1trail-escondido', janelaFreio);
    if (infoBloco) infoBloco.classList.toggle('p1trail-escondido', fase !== 'fora');
    // gatilhos das regras CSS: diagnóstico sai com as colunas; comunicação não cobre o gráfico
    dev.dataset.p1trailColunas = fase === 'aproxima' ? 'on' : 'off';
    dev.dataset.p1trailGrafico = fase === 'fora' ? 'off' : 'on';
  }

  // ── API consumida pelo main: render(snapshot) + efeito(ev) ──
  let tmrPosFire = null;
  let faseAnterior = null;
  // D2 (Flávio 14/06 — gráfico-alvo híbrido): o gráfico detalhado verde/vermelho
  // da freada só aparece quando há DESVIO. Por padrão o palco fica limpo —
  // contagem regressiva, colunas de luz e o verde-na-margem (tela toda) seguem
  // sempre. Uma vez que desviou na janela, o traço fica até o fim dela.
  let houveDesvioNaJanela = false;
  return {
    render(s) {
      if (!s) return;
      if (s.fase !== faseAnterior) { aplicarFase(s.fase); faseAnterior = s.fase; }
      renderContagem(s.contagem);
      if (s.fase === 'aproxima') {
        setNivelColunas(s.nivelLuz);
        renderAproximacao(s.distAoPontoM);
      }
      // D2: pinta o traço detalhado só depois de um desvio na janela atual
      if (s.foraDaBanda) houveDesvioNaJanela = true;
      if (houveDesvioNaJanela && s.traco?.length) {
        renderTraco(s.traco);
      } else {
        el.tracoVerde.setAttribute('d', '');
        el.tracoVermelho.setAttribute('d', '');
        el.cabeca.setAttribute('opacity', '0');
      }
      renderTrilho(s.trilho);
      renderApex(s.apex);
      // rodada 19: tela inteira responde à freada — verde piscando na margem
      // (o vermelho é do flashErro, disparado pelos efeitos com o estrobo)
      flashCerto.classList.toggle('on', s.bandaEstado === 'dentro');
      // indicador APERTA/SOLTA em cima dos dados de SAÍDA
      if (s.freioCorrecao) {
        corrige.textContent = s.freioCorrecao === 'aperta' ? 'APERTA' : 'SOLTA';
        corrige.classList.add('on');
      } else {
        corrige.classList.remove('on');
      }
    },
    efeito(e) {
      if (!e) return;
      if (e.tipo === 'aproximacao') {
        decadaAnterior = null;
        houveDesvioNaJanela = false; // D2: palco limpo a cada nova aproximação
        aplicarAlvo(alvoPorId(e.segmentId), e.adiantoPrevM);
      }
      if (e.tipo === 'zero') {
        // já pisou (freou cedo): as colunas já saíram — só o clarão e a marca
        // do ponto REAL aparecem (a referência pedagógica de onde era o certo)
        if (!e.jaPisou) {
          setNivelColunas(6);
          setEstadoColunas('fire');
          if (tmrPosFire) clearTimeout(tmrPosFire);
          tmrPosFire = setTimeout(() => setEstadoColunas('lit'), 380);
        }
        fireZero.classList.remove('fire');
        void fireZero.offsetWidth;
        fireZero.classList.add('fire');
        // a linha do ponto REAL vira COLUNA DE LUZ (rodada 10)
        el.marcaPonto.setAttribute('stroke', 'oklch(99% 0.02 90)');
        el.marcaPonto.setAttribute('stroke-width', '4');
        el.marcaPonto.removeAttribute('stroke-dasharray');
        el.marcaPonto.setAttribute('filter', 'url(#p1tGlow)');
        el.pontoBase.setAttribute('opacity', '1');
      }
      if (e.tipo === 'fora-da-banda') disparaFlashErro();
      if (e.tipo === 'voltou-pra-banda' || e.tipo === 'pos-trecho') encerraFlashErro();
    },
    // o main injeta a função de resolver alvo (vem do motor) antes do 1º efeito
    _setAlvoResolver(fn) { alvoResolver = fn; },
    destruir() {
      if (cockpitState) {
        cockpitState.applyShift = applyShiftOriginal;
        cockpitState.setTrechoStatus = setTrechoOriginal;
        cockpitState.setApexPonto = setApexOriginal;
      }
      if (marchaLight) marchaLight.classList.remove('p1trail-escondido', 'p1trail-suave');
      if (infoBloco) infoBloco.classList.remove('p1trail-escondido', 'p1trail-suave');
      delete dev.dataset.p1trailColunas;
      delete dev.dataset.p1trailGrafico;
      for (const n of [trilho, grafico, colEsq, colDir, fireZero, flashCerto, flashErro, corrige]) n.remove();
    },
  };

  function alvoPorId(segId) { return alvoResolver ? alvoResolver(segId) : null; }
}
