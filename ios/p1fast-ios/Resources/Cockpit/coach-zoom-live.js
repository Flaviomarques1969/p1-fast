// ═══════════════════════════════════════════════════════════════════════════
// ZOOM AO VIVO DO TRECHO — v3 (iterações do Flávio 2026-07-10)
// Cartão de vidro central, permanente:
//   · Câmera pela ROTA: tangente do traçado oficial (sentido deduzido dos trechos
//     já passados) — trilho suave; GPS cru só pro esterço do carrinho.
//   · Carro em silhueta premium que ESTERÇA nas curvas; deslizes com a duração
//     REAL entre leituras (anti-salto) e ponta do rastro REVELADA continuamente.
//   · GHOST v3 (abordagem do Flávio): SEM linha de pontinhos — UMA bolinha azul
//     esmaecida, CONTÍNUA a volta inteira, na posição da MELHOR VOLTA COMPLETA
//     real (fixture). Âncora espacial no início/reinício da volta.
//   · GAP ao vivo contínuo (sem sinal; verde na frente / âmbar atrás) e a cor do
//     carro/rastro acompanha o lado do gap.
//   · Zoom inteligente pela velocidade; pista como FAIXA; fatia única da pista.
// SÓ EXIBE — consome `coach:gps`/`coach:volta-fim` do painel + dado real.
// ═══════════════════════════════════════════════════════════════════════════
import { geoParaDesenho, PONTOS_DESENHO } from './pista-oficial-brasilia.js';

const NS = 'http://www.w3.org/2000/svg';
const FIXTURE_URL = '/web/command-box/fixtures/passagens-bubi-brasilia.v1.json';

const VW = 330, VH = 228;
const ANCORA = { x: VW / 2, y: VH * 0.64 };
const ZOOM_PERTO = 1.60, ZOOM_LONGE = 0.95;
const KMH_PERTO = 60, KMH_LONGE = 170;
const SUAVIZA_ZOOM = 0.12;
const TRAIL_MAX = 26, TRAIL_CABECA = 9;
const SUAVIZA_RUMO = 0.30;
const PX_POR_M = 0.59078;
const GATE_GHOST_PX = 55 * PX_POR_M;     // projeção do carro na volta-ghost (gap) até ~55 m
const PASSO_MAX_PX = 45;

const norm = s => String(s || '').toUpperCase().trim();
const PISTA = PONTOS_DESENHO.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);

function pathSuave(pts) {
  if (!pts || pts.length < 2) return '';
  const P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const COR = { verde: 'oklch(80% 0.22 145)', ambar: 'oklch(82% 0.19 70)', ghost: 'oklch(78% 0.16 225)', limao: 'oklch(88% 0.25 130)' };

export async function montarZoomLive(device) {
  const box = document.createElement('div');
  box.className = 'coach-zoom';
  box.innerHTML = `
    <svg xmlns="${NS}" viewBox="0 0 ${VW} ${VH}">
      <defs>
        <filter id="czGlow" filterUnits="userSpaceOnUse" x="-40" y="-40" width="410" height="310">
          <feGaussianBlur stdDeviation="2.2"/>
        </filter>
        <radialGradient id="czFade" cx="50%" cy="60%" r="62%">
          <stop offset="72%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="czMask"><rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#czFade)"/></mask>
      </defs>
      <g mask="url(#czMask)"><g class="cz-mundo" style="opacity:0; transition: transform 300ms linear, opacity 400ms ease;">
        <path class="cz-pista-borda"  fill="none" stroke="oklch(46% 0 0)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
        <path class="cz-pista"        fill="none" stroke="oklch(15% 0 0)" stroke-width="8.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="cz-trail-cauda" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-opacity=".32"/>
        <path class="cz-trail-halo" fill="none" stroke-width="6"   stroke-linecap="round" opacity=".16" filter="url(#czGlow)"/>
        <path class="cz-trail"      fill="none" stroke-width="2.6" stroke-linecap="round"/>
        <g class="cz-gdot-g" style="transition: transform 300ms linear;">
          <circle class="cz-gdot-halo" r="8" fill="${COR.ghost}" opacity="0" filter="url(#czGlow)"/>
          <circle class="cz-gdot"      r="4.2" fill="${COR.ghost}" opacity="0" stroke="oklch(0% 0 0 / .5)" stroke-width=".6"/>
        </g>
      </g></g>
      <g transform="translate(${ANCORA.x} ${ANCORA.y})">
        <!-- bolinha do CARRO em verde limão (Flávio 11/07): substitui o carrinho
             com esterço — símbolo fixo, sem rotação, sem problema de inclinação -->
        <circle r="10" class="cz-car-halo" fill="${COR.limao}" opacity=".22" filter="url(#czGlow)"/>
        <circle r="5" class="cz-car" fill="${COR.limao}" stroke="oklch(0% 0 0 / .55)" stroke-width=".7"/>
      </g>
    </svg>
    <span class="coach-zoom__rotulo"></span>
    <span class="coach-zoom__gap" data-lado=""></span>`;
  device.appendChild(box);
  const $ = sel => box.querySelector(sel);
  const mundo = $('.cz-mundo');
  const rotulo = $('.coach-zoom__rotulo');
  const el = {
    pista: $('.cz-pista'), pistaBorda: $('.cz-pista-borda'),
    trail: $('.cz-trail'), trailHalo: $('.cz-trail-halo'), trailCauda: $('.cz-trail-cauda'),
    gdot: $('.cz-gdot'), gdotHalo: $('.cz-gdot-halo'), gdotG: $('.cz-gdot-g'),
    car: $('.cz-car'), carHalo: $('.cz-car-halo'),
    gap: $('.coach-zoom__gap'),
  };

  // ── GHOST v3: a MELHOR VOLTA COMPLETA real do fixture (contínua, com tempos) ──
  let ghostLap = null;   // { pts:[{x,y,tRel}], durS }
  function carregarGhost() {
    // no app (cópia embutida) o caminho absoluto não existe → cai pro arquivo do pacote
    return fetch(FIXTURE_URL).then(r => { if (!r.ok) throw 0; return r.json(); })
      .catch(() => fetch('./passagens-bubi-brasilia.v1.json').then(r => r.json()))
      .then(j => {
      // agrupa por volta (dia+volta); só voltas com TODAS as curvas presentes
      const porVolta = new Map();
      for (const p of (j.passagens || [])) {
        const k = `${p.dia}|${p.volta}`;
        if (!porVolta.has(k)) porVolta.set(k, []);
        porVolta.get(k).push(p);
      }
      const nCurvas = new Set((j.passagens || []).map(p => norm(p.curva))).size;
      let melhor = null, melhorT = Infinity;
      for (const [k, segs] of porVolta) {
        if (segs.length < nCurvas) continue;
        const total = segs.reduce((s, p) => s + p.tempo_trecho_s, 0);
        if (total < melhorT) { melhorT = total; melhor = segs; }
      }
      if (!melhor) return;
      const pontos = melhor.flatMap(p => p.pontos).sort((a, b) => a.t - b.t);
      const t0 = pontos[0].t;
      ghostLap = {
        pts: pontos.map(pt => ({ ...geoParaDesenho(pt.lat, pt.lng), tRel: (pt.t - t0) / 1000 })),
        durS: (pontos[pontos.length - 1].t - t0) / 1000,
      };
    }).catch(() => { /* sem fixture: mapa sem ghost (honesto) */ });
  }
  function ghostLapMaisPerto(xy) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < ghostLap.pts.length; i++) {
      const q = ghostLap.pts[i];
      const d = (q.x - xy.x) ** 2 + (q.y - xy.y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return { i: bi, dist2: bd, tRel: ghostLap.pts[bi].tRel };
  }
  // âncora INTELIGENTE: só ancora num ponto do ghost PERTO do carro e no MESMO
  // sentido de marcha (tangente do ghost combinando com o rumo) — ancorar num vão
  // ou no sentido contrário era a fonte dos gaps absurdos.
  function ancorarGhost(xy, rumoGraus) {
    const rum = rumoGraus * Math.PI / 180;
    const ux = Math.cos(rum), uy = Math.sin(rum);
    let melhor = null;
    for (let i = 0; i < ghostLap.pts.length - 1; i++) {
      const q = ghostLap.pts[i];
      const d2 = (q.x - xy.x) ** 2 + (q.y - xy.y) ** 2;
      if (d2 > GATE_GHOST_PX * GATE_GHOST_PX) continue;
      const q2 = ghostLap.pts[i + 1];
      if ((q2.x - q.x) * ux + (q2.y - q.y) * uy <= 0) continue;   // sentido contrário
      if (!melhor || d2 < melhor.d2) melhor = { d2, tRel: q.tRel };
    }
    return melhor;   // null = ainda não dá pra ancorar com honestidade
  }
  function ghostLapPos(tS) {
    const pts = ghostLap.pts;
    let t = tS % Math.max(0.001, ghostLap.durS);      // o ghost também "dá voltas"
    if (t <= pts[0].tRel) return pts[0];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (t <= b.tRel) {
        const f = (t - a.tRel) / Math.max(0.001, b.tRel - a.tRel);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return pts[pts.length - 1];
  }

  // ── estado ──
  let rumoDeg = 0, temRumo = false;
  let rumoBrutoDeg = 0;
  let dirVotos = 0, dirPista = 0, ciPrev = -1;
  let wallPrev = null;
  let escala = ZOOM_PERTO;
  let gapSuave = null;
  let prevXY = null;
  let trail = [];
  let curvaNome = null;
  // relógio do ghost: ancora ESPACIALMENTE e corre sozinho; a PROJEÇÃO do carro na
  // volta do ghost é RASTREADA em janela (a pista se dobra sobre si mesma — pular
  // de dobra era a fonte dos gaps absurdos); perdeu a trava → re-ancora sozinho
  let ghostAncorado = false, ghostT0 = 0, ghostT0ms = 0;
  let gIdx = -1, gPerdido = 0;

  const lerpAng = (a, b, f) => {
    let d = (b - a) % 360;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    return a + d * f;
  };
  function aplicarCores() {
    const c = (gapSuave != null && gapSuave < 0) ? COR.ambar : COR.verde;
    el.trail.setAttribute('stroke', c); el.trailHalo.setAttribute('stroke', c); el.trailCauda.setAttribute('stroke', c);
  }

  const FATIA_R = 26;
  let pistaIdx = -1;
  function fatiaPista(ci) {
    const N = PISTA.length, pts = [];
    for (let k = -FATIA_R; k <= FATIA_R; k++) pts.push(PISTA[((ci + k) % N + N) % N]);
    return pts;
  }
  function idxPistaMaisPerto(c) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < PISTA.length; i++) {
      const p = PISTA[i];
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }

  function pintar(d) {
    const xy = geoParaDesenho(d.lat, d.lng);
    const xyAnterior = prevXY;
    // rejeição de salto de GPS
    if (prevXY) {
      const dx = xy.x - prevXY.x, dy = xy.y - prevXY.y;
      const passo2 = dx * dx + dy * dy;
      if (passo2 > PASSO_MAX_PX * PASSO_MAX_PX) { prevXY = xy; return; }
      if (passo2 > 0.4) {
        const alvo = Math.atan2(dy, dx) * 180 / Math.PI;
        rumoBrutoDeg = temRumo ? lerpAng(rumoBrutoDeg, alvo, 0.85) : alvo;
        if (!temRumo) { rumoDeg = alvo; temRumo = true; mundo.style.opacity = '1'; }
      }
    }
    prevXY = xy;

    // APONTAMENTO PELA ROTA: tangente do traçado; sentido dos trechos já passados
    const ciAqui = idxPistaMaisPerto(xy);
    if (ciPrev >= 0 && ciAqui !== ciPrev) {
      const N = PISTA.length;
      let dIdx = ((ciAqui - ciPrev) % N + N) % N;
      if (dIdx > N / 2) dIdx -= N;
      if (dIdx !== 0 && Math.abs(dIdx) <= 12) {
        dirVotos = Math.max(-6, Math.min(6, dirVotos + Math.sign(dIdx)));
        if (Math.abs(dirVotos) >= 2) dirPista = Math.sign(dirVotos);
      }
    }
    ciPrev = ciAqui;
    if (temRumo) {
      const pertoDaRota = (() => { const p = PISTA[ciAqui]; const dd = (p.x - xy.x) ** 2 + (p.y - xy.y) ** 2; return dd <= 26 * 26; })();
      if (dirPista !== 0 && pertoDaRota) {
        const N = PISTA.length, ADIANTE = 3;
        const a = PISTA[ciAqui], b = PISTA[(((ciAqui + ADIANTE * dirPista) % N) + N) % N];
        const alvoTang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        rumoDeg = lerpAng(rumoDeg, alvoTang, 0.5);
      } else {
        rumoDeg = lerpAng(rumoDeg, rumoBrutoDeg, SUAVIZA_RUMO);
      }
    }

    // ANTI-SALTO: animações duram o intervalo REAL entre leituras
    const agora = performance.now();
    let dtWall = 300;
    if (wallPrev != null) {
      dtWall = Math.min(1400, Math.max(80, agora - wallPrev));
      mundo.style.transitionDuration = `${Math.round(dtWall * 1.05)}ms, 400ms`;
    }
    wallPrev = agora;

    // ZOOM inteligente
    const kmh = Number(d.kmh) || 0;
    const f = Math.min(1, Math.max(0, (kmh - KMH_PERTO) / (KMH_LONGE - KMH_PERTO)));
    escala += ((ZOOM_PERTO + (ZOOM_LONGE - ZOOM_PERTO) * f) - escala) * SUAVIZA_ZOOM;

    // CÂMERA heading-up (funções explícitas)
    mundo.style.transform =
      `translate(${ANCORA.x}px, ${ANCORA.y}px) rotate(${(-90 - rumoDeg).toFixed(2)}deg) scale(${escala.toFixed(3)}) translate(${(-xy.x).toFixed(2)}px, ${(-xy.y).toFixed(2)}px)`;

    // fatia da pista (asfalto + borda)
    if (pistaIdx < 0 || Math.min(Math.abs(ciAqui - pistaIdx), PISTA.length - Math.abs(ciAqui - pistaIdx)) > 2) {
      pistaIdx = ciAqui;
      const dFatia = pathSuave(fatiaPista(ciAqui));
      el.pista.setAttribute('d', dFatia);
      el.pistaBorda.setAttribute('d', dFatia);
    }

    // rótulo = curva atual (só informação, sem linha de trecho)
    const nome = d.curva ? d.curva.nome : null;
    if (nome !== curvaNome) { curvaNome = nome; rotulo.textContent = nome || ''; }

    // ═══ GHOST v3: bolinha azul esmaecida, CONTÍNUA (melhor volta completa) ═══
    if (ghostLap && d.t != null) {
      const durS = Math.max(0.001, ghostLap.durS);
      // rastreia a projeção do carro na volta do ghost SEM pular de dobra:
      // busca só numa janela à frente/atrás do último encaixe
      let proj = null;
      if (gIdx >= 0) {
        const N = ghostLap.pts.length;
        let bd = Infinity, bi = -1;
        for (let k = -8; k <= 30; k++) {
          const i = ((gIdx + k) % N + N) % N;
          const q = ghostLap.pts[i];
          const d2 = (q.x - xy.x) ** 2 + (q.y - xy.y) ** 2;
          if (d2 < bd) { bd = d2; bi = i; }
        }
        if (bi >= 0 && Math.sqrt(bd) <= GATE_GHOST_PX) { gIdx = bi; gPerdido = 0; proj = ghostLap.pts[bi]; }
        else if (++gPerdido > 2) { ghostAncorado = false; gIdx = -1; gPerdido = 0; }
      }
      // (re)ancoragem: início, relógio rebobinado (auto-cura) ou trava perdida —
      // só ancora perto da linha do ghost e no MESMO sentido (dobras têm sentidos ≠)
      const dtSeg = ghostAncorado ? (d.t - ghostT0ms) / 1000 : null;
      if (!ghostAncorado || dtSeg < -1 || dtSeg > durS * 1.6) {
        const a = temRumo ? ancorarGhost(xy, rumoBrutoDeg) : null;
        if (a) {
          ghostT0 = a.tRel; ghostT0ms = d.t; ghostAncorado = true; gapSuave = null;
          gIdx = ghostLap.pts.findIndex(q => q.tRel === a.tRel); gPerdido = 0; proj = ghostLap.pts[gIdx];
        } else { ghostAncorado = false; gIdx = -1; }
      }
      if (ghostAncorado) {
        const relogio = ghostT0 + (d.t - ghostT0ms) / 1000;
        const gp = ghostLapPos(relogio);
        el.gdotG.style.transitionDuration = `${Math.round(dtWall * 1.05)}ms`;
        el.gdotG.style.transform = `translate(${gp.x.toFixed(1)}px, ${gp.y.toFixed(1)}px)`;
        el.gdot.setAttribute('opacity', '.55'); el.gdotHalo.setAttribute('opacity', '.22');
        if (proj) {
          // diferença CIRCULAR (a volta fecha em si)
          let gapBruto = (proj.tRel - (relogio % durS)) % durS;
          if (gapBruto > durS / 2) gapBruto -= durS; else if (gapBruto < -durS / 2) gapBruto += durS;
          gapSuave = (gapSuave == null) ? gapBruto : gapSuave + (gapBruto - gapSuave) * 0.35;
          el.gap.textContent = Math.abs(gapSuave).toFixed(1).replace('.', ',') + ' s';
          el.gap.dataset.lado = gapSuave >= 0 ? 'frente' : 'atras';
          aplicarCores();
        } else {
          el.gap.textContent = ''; el.gap.dataset.lado = '';
        }
      } else {
        el.gdot.setAttribute('opacity', '0'); el.gdotHalo.setAttribute('opacity', '0');
        el.gap.textContent = ''; el.gap.dataset.lado = '';
      }
    } else {
      el.gdot.setAttribute('opacity', '0'); el.gdotHalo.setAttribute('opacity', '0');
      el.gap.textContent = ''; el.gap.dataset.lado = '';
    }

    // rastro: cauda esmaecida + cabeça com PONTA REVELADA continuamente
    trail.push(xy); if (trail.length > TRAIL_MAX) trail.shift();
    const corte = Math.max(0, trail.length - TRAIL_CABECA);
    const cauda = trail.slice(0, corte + 1), cabeca = trail.slice(corte);
    el.trailCauda.setAttribute('d', pathSuave(cauda));
    const dCab = pathSuave(cabeca);
    el.trail.setAttribute('d', dCab); el.trailHalo.setAttribute('d', dCab);
    if (xyAnterior && cabeca.length > 1) {
      try {
        const L = el.trail.getTotalLength();
        const seg = Math.hypot(xy.x - xyAnterior.x, xy.y - xyAnterior.y);
        for (const p of [el.trail, el.trailHalo]) {
          p.style.transition = 'none';
          p.style.strokeDasharray = `${L.toFixed(1)}`;
          p.style.strokeDashoffset = `${Math.min(seg, L).toFixed(1)}`;
          void p.getBoundingClientRect();
          p.style.transition = `stroke-dashoffset ${Math.round(dtWall * 1.05)}ms linear`;
          p.style.strokeDashoffset = '0';
        }
      } catch (e) { /* sem getTotalLength: rastro segue sem revelação */ }
    }
  }

  aplicarCores();
  let ultimoEv = null;
  device.addEventListener('coach:gps', (ev) => { ultimoEv = ev.detail || {}; pintar(ultimoEv); });
  device.addEventListener('coach:volta-fim', () => {
    trail = []; gapSuave = null; ghostAncorado = false; gIdx = -1;   // re-ancora no reinício da volta
    el.trail.setAttribute('d', ''); el.trailHalo.setAttribute('d', ''); el.trailCauda.setAttribute('d', '');
    aplicarCores();
  });
  carregarGhost().then(() => { ghostAncorado = false; if (ultimoEv) pintar(ultimoEv); });

  return box;
}

export default { montarZoomLive };
