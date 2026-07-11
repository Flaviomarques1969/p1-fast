// coach-card.js — CONSTRUTORA TELA · o CARTÃO do Coach de IA (Fase 1, referência web).
// Renderiza os 3 estados honestos do pacote coach (janela-4 §2): null / 'silencio' /
// 'oportunidade'. Desenha o gráfico com ZOOM do recorte (GraficoSpec — janela-3 §1.2/§4)
// e a mensagem (formas pré-computadas da J1 — janela-1 §2/§5). SÓ EXIBE: consome o
// pacote pronto, não decide nem calcula (contrato de dados "uma entrada, um cérebro").
//
// Régua cumprida: fundo preto · SÓ âmbar/verde no coach (vermelho NÃO existe — decisão 3;
// qualquer acento estranho é rebaixado para âmbar) · número sem sinal (magnitude só) ·
// sem emoji (só traço/formas) · tokens reais do painel (cockpit.css) · painel intocado
// (soma por cima). O timing/portão é da J1; aqui só consumimos coach.timing.nivel.

import { geoParaDesenho, PONTOS_DESENHO } from './pista-oficial-brasilia.js';

const NS = 'http://www.w3.org/2000/svg';
const SLOT_W = 394, SLOT_H = 238;                 // slot do gráfico (contrato §2.3)

// Vermelho não existe no coach: só âmbar/verde. Rebaixa qualquer outra coisa p/ âmbar.
function acentoSeguro(a) { return a === 'verde' ? 'verde' : 'ambar'; }
function corAcento(a) { return acentoSeguro(a) === 'verde' ? 'var(--bom)' : 'var(--foco)'; }

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function pathD(pts) {
  return pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ');
}

// Separa "verbo   ganho" na linha de ação. O ganho fica sozinho à direita (número sem
// sinal). Robusto ao separador: tabulação (andaime) OU 2+ espaços (pacote real) OU o
// ganho no fim ("... 1,0 s" / "... 2 m"). Se não achar ganho, tudo vira verbo.
function separarAcao(txt) {
  const s = String(txt).replace(/\s+$/, '');
  const porSep = s.split(/\t|\s{2,}/);
  if (porSep.length >= 2) return { verbo: porSep[0].trim(), ganho: porSep.slice(1).join(' ').trim() };
  const m = s.match(/^(.*\S)\s+([\d][\d.,]*\s*(?:s|m))$/);
  if (m) return { verbo: m[1].trim(), ganho: m[2].trim() };
  return { verbo: s.trim(), ganho: null };
}

// O recorte (viewBox) vem CRU do cérebro (bbox+margem, J3 §4.2). Encaixar no slot 394×238
// é trabalho da TELA (dona do slot): expando SIMETRICAMENTE a dimensão que falta até a
// proporção do slot — sem cortar nem distorcer (posições intactas), só respiro. Assim um
// "S" achatado (8:1) e uma Bruxa alta (0,3:1) enchem o slot igual e ficam reconhecíveis.
function ajustarViewBoxAoSlot(vb) {
  const alvo = SLOT_W / SLOT_H;
  let { x, y, w, h } = vb;
  const a = w / h;
  if (a > alvo) { const nh = w / alvo; y -= (nh - h) / 2; h = nh; }
  else { const nw = h * alvo; x -= (nw - w) / 2; w = nw; }
  return { x, y, w, h };
}

// ── desenha o gráfico do recorte no <svg> a partir da GraficoSpec + tracos ─────
function desenharGrafico(svg, pacote) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const g = pacote.grafico, op = pacote.oportunidade;
  const vb = ajustarViewBoxAoSlot(g.recorte.viewBox);
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const escala = vb.w / SLOT_W;                    // desenho-un por px de tela (p/ raios dos pontos)
  const acor = corAcento(g.acento);

  // 1) pista de contexto (faint) — fatia de PONTOS_DESENHO no mesmo espaço 823×799
  if (g.camadas.pistaContexto) {
    const ci = g.recorte.contextoIdx;
    const ctx = PONTOS_DESENHO.slice(ci.de, ci.ate + 1).map(p => ({ x: p[0], y: p[1] }));
    if (ctx.length > 1) {
      svg.appendChild(el('path', {
        d: pathD(ctx), fill: 'none', stroke: 'var(--faint)', 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'vector-effect': 'non-scaling-stroke', opacity: '0.55',
      }));
    }
  }

  const projeta = (arr) => arr.map(p => geoParaDesenho(p.lat, p.lng));

  // 2) linha da referência (fantasma fria, tracejada)
  if (g.camadas.linhaReferencia && op.tracos && op.tracos.referencia) {
    const ref = projeta(op.tracos.referencia);
    if (ref.length > 1) svg.appendChild(el('path', {
      d: pathD(ref), fill: 'none', stroke: 'var(--sistema)', 'stroke-width': '2.5',
      'stroke-dasharray': '4 5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke', opacity: '0.75',
    }));
  }

  // 3) linha do piloto (cor = acento; velocidade sutil na própria linha, §3.3)
  if (g.camadas.linhaPiloto && op.tracos && op.tracos.atual) {
    const meu = projeta(op.tracos.atual);
    const kmh = op.tracos.atual.map(p => p.kmh ?? 0);
    const kMin = Math.min(...kmh), kMax = Math.max(...kmh), span = Math.max(kMax - kMin, 1);
    // banda do sub em foco (destaqueSub) por baixo da linha. A fração pode vir no spec
    // (andaime) ou não (pacote real) → default no miolo do traço (0,3–0,7).
    if (g.camadas.destaqueSub && meu.length > 1) {
      const [a, b] = Array.isArray(g.camadas.destaqueSubFracao) ? g.camadas.destaqueSubFracao : [0.3, 0.7];
      const i0 = Math.max(0, Math.floor(a * (meu.length - 1)));
      const i1 = Math.min(meu.length - 1, Math.ceil(b * (meu.length - 1)));
      if (i1 > i0) svg.appendChild(el('path', {
        d: pathD(meu.slice(i0, i1 + 1)), fill: 'none', stroke: acor, 'stroke-width': '15',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'vector-effect': 'non-scaling-stroke', opacity: '0.18',
      }));
    }
    // a linha, segmento a segmento — cor sutilmente mais fria onde ele está mais lento.
    // Velocidade-na-linha é padrão da tela (o dado sempre tem kmh); só desliga se o spec disser false.
    if (g.camadas.velocidadeNaLinha !== false) {
      for (let i = 1; i < meu.length; i++) {
        const p = (((kmh[i - 1] + kmh[i]) / 2) - kMin) / span;   // 0=mais lento, 1=mais rápido
        const seg = el('path', {
          d: pathD([meu[i - 1], meu[i]]), fill: 'none', 'stroke-width': '5',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
        });
        seg.style.stroke = `color-mix(in oklch, ${acor} ${Math.round(62 + 38 * p)}%, var(--sistema))`;
        svg.appendChild(seg);
      }
    } else if (meu.length > 1) {
      svg.appendChild(el('path', {
        d: pathD(meu), fill: 'none', stroke: acor, 'stroke-width': '5',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
      }));
    }
    // brilho da linha do piloto (glow do painel)
    if (meu.length > 1) {
      const glow = el('path', {
        d: pathD(meu), fill: 'none', stroke: acor, 'stroke-width': '9',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
        opacity: '0.16',
      });
      svg.insertBefore(glow, svg.firstChild ? svg.lastChild : null);
    }
  }

  // 4) bolinha do ápice (só quando subTrecho==='apice' e há apiceDesenho) — §5 J3
  if (g.camadas.apice && g.apiceDesenho) {
    const rIdeal = 5.5 * escala, rMeu = 6.5 * escala;
    const [ix, iy] = g.apiceDesenho.ideal, [px, py] = g.apiceDesenho.piloto;
    svg.appendChild(el('circle', { cx: ix, cy: iy, r: rIdeal, fill: 'none', stroke: 'var(--sistema)', 'stroke-width': '2.5', 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke', opacity: '0.85' }));  // ○ ideal
    const meuApice = el('circle', { cx: px, cy: py, r: rMeu, fill: acor, opacity: '0.95' });  // ◉ piloto
    svg.appendChild(meuApice);
  }
}

// ── monta o DOM do cartão UMA vez (idempotente) dentro do .device ─────────────
export function montarCoachCard(device) {
  if (device.querySelector('.coach-card')) return device.querySelector('.coach-card');
  const card = document.createElement('div');
  card.className = 'coach-card';
  card.id = 'coachCard';
  card.setAttribute('data-tipo', 'vazio');
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `
    <div class="coach-card__grafico">
      <span class="coach-card__rotulo"></span>
      <span class="coach-card__badge"></span>
      <svg class="coach-card__svg" xmlns="${NS}"></svg>
    </div>
    <div class="coach-card__msg"></div>
    <div class="coach-card__silencio"></div>`;
  device.appendChild(card);
  return card;
}

// ── render principal: recebe o pacote (null | silencio | oportunidade) ────────
export function renderCoach(card, pacote) {
  const svg = card.querySelector('.coach-card__svg');
  const rotulo = card.querySelector('.coach-card__rotulo');
  const badge = card.querySelector('.coach-card__badge');
  const msg = card.querySelector('.coach-card__msg');
  const sil = card.querySelector('.coach-card__silencio');

  if (pacote == null) { card.setAttribute('data-tipo', 'vazio'); return; }

  if (pacote.tipo === 'silencio') {
    card.setAttribute('data-tipo', 'silencio');
    sil.textContent = pacote.linha?.texto ?? '';
    sil.setAttribute('data-cor', pacote.linha?.cor ?? 'neutra');
    return;
  }

  // 'oportunidade'
  card.setAttribute('data-tipo', 'oportunidade');
  const g = pacote.grafico;
  const ac = acentoSeguro(g.acento);
  card.setAttribute('data-acento', ac);
  rotulo.textContent = g.rotulo ?? '';
  if (g.recorrencia && g.recorrencia.nCurvas > 1) { badge.textContent = '× ' + g.recorrencia.nCurvas + ' curvas'; badge.hidden = false; }
  else { badge.textContent = ''; badge.hidden = true; }
  desenharGrafico(svg, pacote);

  // mensagem: nível vem do timing (reta→N1, fim-de-volta→N2). Ação sozinha na última linha.
  const nivel = pacote.timing?.nivel === 'N1' ? 'n1' : 'n2';
  const m = pacote.mensagem?.[nivel] ?? pacote.mensagem?.n2 ?? pacote.mensagem?.n1;
  msg.innerHTML = '';
  msg.setAttribute('data-acento', ac);
  const linhas = m?.linhas ?? [];
  if (nivel === 'n1') {
    const l = document.createElement('div'); l.className = 'coach-msg__n1'; l.textContent = linhas[0] ?? '';
    msg.appendChild(l);
  } else {
    linhas.forEach((txt, i) => {
      const ultima = i === linhas.length - 1;
      if (ultima) {
        const rule = document.createElement('div'); rule.className = 'coach-msg__rule'; msg.appendChild(rule);
        const acao = document.createElement('div'); acao.className = 'coach-msg__acao';
        const { verbo, ganho } = separarAcao(txt);
        const esq = document.createElement('span'); esq.className = 'coach-msg__verbo'; esq.textContent = verbo;
        acao.appendChild(esq);
        if (ganho) { const dir = document.createElement('span'); dir.className = 'coach-msg__ganho'; dir.textContent = ganho; acao.appendChild(dir); }
        msg.appendChild(acao);
      } else {
        const l = document.createElement('div');
        l.className = i === 0 ? 'coach-msg__titulo' : 'coach-msg__mecanismo';
        l.textContent = txt;
        msg.appendChild(l);
      }
    });
  }
}
