// Quadro de curvas da TV do box — componente.
// Por curva, DUAS linhas: MELHOR (a passagem da melhor volta, a referência) e ÚLTIMA (a passagem mais recente, como já era),
// com a diferença ÚLTIMA − MELHOR ao lado. Monta o esqueleto uma vez e depois só troca texto e classe (sem piscar na TV).
//
//   const q = criarQuadroCurvas(elemento);
//   q.atualizar({ volta:{n,tempo,delta,kmh}, ultimaVolta, melhorVolta, referencia, somaDelta, idealTrechos,
//                 curvas:[{ id, nome, estado:'agora'|'feita'|'aguardando', sub, progresso, trilha, ehRef, melhor:{…}|null, ultima:{…}|null }] });
// trilha (curva em andamento): [{ de, freio }] — de = fração da curva onde o pé mudou; a linha fica VERMELHA no trecho de freada
// e AMARELA no resto, e cada pedaço guarda a cor que teve.
//
// Campos de cada passagem: kE (entrada km/h), freio (m da freada até a vmin), vmin (km/h), vminAp (m da vmin ao ápice),
// apD (m de distância ao ápice), kS (saída km/h), tempo (s do trecho).

const COLUNAS = [
  { k:'kE',     rot:'Entrada',      un:'km/h',      c:0, bom: 1 },
  { k:'freio',  rot:'Frenagem',     un:'m até a vmin', c:0, bom: 0 },
  { k:'vmin',   rot:'Vmin',         un:'km/h',      c:0, bom: 1 },
  { k:'vminAp', rot:'Vmin → ápice', un:'m',         c:0, bom: 0 },
  { k:'apD',    rot:'Passagem',     un:'no ápice · m', c:1, bom: 0 },
  { k:'kS',     rot:'Saída',        un:'km/h',      c:0, bom: 1 },
  { k:'tempo',  rot:'Tempo',        un:'s',         c:2, bom:-1 },
];

const CSS = `
.qc{--qc-texto:#eef1f5;--qc-apagado:#7d8491;--qc-fraco:#454b56;--qc-fio:rgba(255,255,255,.065);--qc-fio2:rgba(255,255,255,.11);
  --qc-verde:#34d27f;--qc-melhor:#86c9a2;--qc-vermelho:#ff5a52;--qc-ambar:#f2b33d;
  position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;color:var(--qc-texto);
  background:radial-gradient(120% 60% at 0% 0%,rgba(52,210,127,.035),transparent 60%),linear-gradient(180deg,#0f1217 0%,#0a0c10 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 24px 60px rgba(0,0,0,.45);
  font-family:-apple-system,"SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
.qc *{box-sizing:border-box}
.qc-rot{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--qc-apagado);font-weight:600;white-space:nowrap}
.qc-topo{flex:0 0 96px;display:flex;align-items:flex-end;gap:38px;padding:0 26px 14px;border-bottom:1px solid var(--qc-fio2)}
.qc-topo > div{display:flex;flex-direction:column;gap:4px}
.qc-topo .qc-v{font-size:30px;font-weight:650;line-height:1}
.qc-topo .qc-g{font-size:46px;font-weight:300;line-height:.9;letter-spacing:-.01em}
.qc-topo .qc-ref{margin-left:auto;text-align:right;align-items:flex-end}
.qc-topo .qc-ref .qc-v{font-size:17px;font-weight:600;color:var(--qc-apagado);line-height:1.2}
.qc-grade{display:grid;grid-template-columns:212px 74px repeat(7,minmax(0,1fr));align-items:center;column-gap:0}
.qc-cab{flex:0 0 46px;padding:0 18px;border-bottom:1px solid var(--qc-fio2)}
.qc-cab > div{text-align:right;padding-right:62px;line-height:1.25;white-space:nowrap}
.qc-cab > div:first-child{text-align:left;padding-left:8px;padding-right:0}
.qc-cab .qc-un{display:block;font-size:11px;letter-spacing:.12em;color:var(--qc-fraco);text-transform:none;font-weight:600}
.qc-corpo{flex:1 1 auto;display:grid;grid-auto-rows:1fr;padding:0 18px;min-height:0}
.qc-lin{position:relative;height:100%;border-bottom:1px solid var(--qc-fio);transition:background .4s}
.qc-lin:last-child{border-bottom:0}
.qc-lin > div{height:100%;display:flex;flex-direction:column;justify-content:center;gap:5px;padding-right:10px}
.qc-nome{padding-left:8px!important;padding-right:6px!important}
.qc-nome b{font-size:16.5px;font-weight:700;letter-spacing:.05em;line-height:1.12;text-transform:uppercase}
.qc-nome span{font-size:12.5px;color:var(--qc-apagado);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qc-tag{align-items:flex-start;padding-right:0!important}
.qc-tag i{font-style:normal;font-size:11px;letter-spacing:.18em;font-weight:700;line-height:26px;height:26px;text-transform:uppercase}
.qc-tag i:first-child{color:var(--qc-melhor);opacity:.8}
.qc-tag i:last-child{color:#a7adb8}
.qc-par{align-items:stretch}
.qc-l{display:flex;justify-content:flex-end;align-items:baseline;height:26px;line-height:26px}
.qc-l .qc-n{white-space:nowrap}
.qc-l .qc-d{flex:0 0 52px;text-align:right;font-size:14px;font-weight:700;white-space:nowrap}
.qc-l.qc-m .qc-n{font-size:17px;font-weight:500;color:var(--qc-melhor)}
.qc-l.qc-u .qc-n{font-size:22px;font-weight:650;color:var(--qc-texto)}
.qc-vazio{color:var(--qc-fraco)!important;font-weight:400!important}
.qc-ganhou{color:var(--qc-verde)} .qc-perdeu{color:var(--qc-vermelho)} .qc-neutro{color:var(--qc-apagado)}
.qc-chip{font-size:10.5px!important;letter-spacing:.14em;color:var(--qc-verde)}
.qc-lin.qc-agora{background:linear-gradient(90deg,rgba(242,179,61,.11) 0%,rgba(242,179,61,.035) 45%,rgba(242,179,61,0) 80%)}
.qc-lin.qc-agora::before{content:"";position:absolute;left:-18px;top:10px;bottom:10px;width:3px;border-radius:2px;background:var(--qc-ambar);
  box-shadow:0 0 12px rgba(242,179,61,.55)}
.qc-lin.qc-agora .qc-nome span{color:var(--qc-ambar)}
.qc-lin > .qc-prog{position:absolute;left:0;bottom:-1px;top:auto;height:2px;width:0;background:var(--qc-ambar);
  border-radius:2px;opacity:0;padding:0!important}   /* sem animação de largura: o degradê ficava sobre a largura do meio da animação e a fronteira das cores balançava */
.qc-lin.qc-agora > .qc-prog{opacity:1}
.qc-lin.qc-aguardando .qc-nome b{color:#aab0bb}
.qc-lin.qc-novo{animation:qc-novo 1.6s ease-out}
@keyframes qc-novo{0%{background:rgba(255,255,255,.09)}100%{background:transparent}}
.qc-pe{flex:0 0 40px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;border-top:1px solid var(--qc-fio2);
  font-size:12.5px;color:var(--qc-apagado);letter-spacing:.03em}
.qc-pe b{font-weight:700;color:var(--qc-texto)}
.qc-pe .qc-soma b{font-size:15px}
`;

const fmt = (n, c = 0) => n == null || !isFinite(n) ? '—'
  : n.toLocaleString('pt-BR', { minimumFractionDigits:c, maximumFractionDigits:c }).replace('-', '−');
const comSinal = (n, c = 0) => { if (n == null || !isFinite(n)) return ''; const a = fmt(Math.abs(n), c);
  return (/^[0,]+$/.test(a) ? '±' : n > 0 ? '+' : '−') + a; };
const relogio = s => s == null || !isFinite(s) ? '—' : Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0').replace('.', ',');

// pedaços da trilha → degradê de cortes secos (posições relativas à largura atual da linha)
function faixas(trilha, p) {
  const cor = f => f ? 'var(--qc-vermelho)' : 'var(--qc-ambar)';
  const st = trilha.map((s, i) => { const a = Math.min(100, s.de / p * 100), b = i + 1 < trilha.length ? Math.min(100, trilha[i + 1].de / p * 100) : 100;
    return `${cor(s.freio)} ${a.toFixed(2)}% ${b.toFixed(2)}%`; });
  return `linear-gradient(90deg, ${st.join(', ')})`;
}

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function texto(e, t, cls) { if (e.textContent !== t) e.textContent = t; if (cls != null && e.className !== cls) e.className = cls; }

export function criarQuadroCurvas(alvo) {
  if (!document.getElementById('qc-css')) { const s = el('style'); s.id = 'qc-css'; s.textContent = CSS; document.head.appendChild(s); }
  const raiz = el('div', 'qc');
  const topo = el('div', 'qc-topo', `
    <div><span class="qc-rot">Volta</span><span class="qc-v" data-r="n">—</span></div>
    <div><span class="qc-rot">Tempo</span><span class="qc-g" data-r="tempo">—</span></div>
    <div><span class="qc-rot">Δ vs melhor (aqui)</span><span class="qc-g" data-r="delta">—</span></div>
    <div><span class="qc-rot">Velocidade</span><span class="qc-v" data-r="kmh">—</span></div>
    <div><span class="qc-rot">Última</span><span class="qc-v" data-r="ult">—</span></div>
    <div><span class="qc-rot">Melhor</span><span class="qc-v qc-ganhou" data-r="mel">—</span></div>
    <div class="qc-ref"><span class="qc-rot">Referência</span><span class="qc-v" data-r="ref">—</span></div>`);
  const cab = el('div', 'qc-grade qc-cab');
  cab.appendChild(el('div', 'qc-rot', 'Curva'));
  cab.appendChild(el('div'));
  for (const c of COLUNAS) cab.appendChild(el('div', 'qc-rot', `${c.rot}<span class="qc-un">${c.un}</span>`));
  const corpo = el('div', 'qc-corpo');
  const pe = el('div', 'qc-pe', `<span data-r="leg"></span><span class="qc-soma" data-r="soma"></span>`);
  raiz.append(topo, cab, corpo, pe); alvo.appendChild(raiz);
  const R = k => raiz.querySelector(`[data-r="${k}"]`);
  const linhas = new Map();

  function linha(id) {
    if (linhas.has(id)) return linhas.get(id);
    const L = el('div', 'qc-grade qc-lin');
    const nome = el('div', 'qc-nome', '<b></b><span></span>');
    const tag = el('div', 'qc-tag', '<i>Melhor</i><i>Última</i>');
    L.append(nome, tag);
    const cel = COLUNAS.map(() => {
      const d = el('div', 'qc-par', `<div class="qc-l qc-m"><span class="qc-n"></span><span class="qc-d"></span></div>
        <div class="qc-l qc-u"><span class="qc-n"></span><span class="qc-d"></span></div>`);
      L.appendChild(d);
      const [m, u] = d.querySelectorAll('.qc-l');
      return { mN: m.children[0], uN: u.children[0], uD: u.children[1] };
    });
    const prog = el('div', 'qc-prog'); L.appendChild(prog);
    const o = { L, b: nome.children[0], sub: nome.children[1], cel, prog, chave: null };
    linhas.set(id, o); return o;
  }

  function atualizar(e) {
    const v = e.volta || {};
    texto(R('n'), v.n == null ? '—' : String(v.n));
    texto(R('tempo'), relogio(v.tempo));
    texto(R('delta'), v.delta == null ? '—' : comSinal(v.delta, 2), 'qc-g ' + (v.delta == null ? 'qc-neutro' : v.delta < 0 ? 'qc-ganhou' : 'qc-perdeu'));
    texto(R('kmh'), v.kmh == null ? '—' : fmt(v.kmh) + ' km/h');
    texto(R('ult'), relogio(e.ultimaVolta));
    texto(R('mel'), relogio(e.melhorVolta));
    texto(R('ref'), e.referencia || '—');

    // ordem do corpo = ordem recebida (posição na pista)
    e.curvas.forEach((c, i) => { const o = linha(c.id); if (corpo.children[i] !== o.L) corpo.insertBefore(o.L, corpo.children[i] || null); pintar(o, c); });

    R('leg').innerHTML = e.melhorVolta == null
      ? 'A linha <b>MELHOR</b> aparece depois da 1ª volta completa'
      : `<b style="color:var(--qc-melhor)">MELHOR</b> = passagem da volta nº ${e.melhorNumero} &nbsp;·&nbsp; <b>ÚLTIMA</b> = passagem mais recente &nbsp;·&nbsp; diferença = última − melhor`;
    // idealTrechos = conta do cérebro da TV (melhor de cada trecho entre as voltas que valem); aqui só se mostra
    const s = e.somaDelta, id = e.idealTrechos;
    R('soma').innerHTML = (s == null ? '' : `Soma dos trechos · última − melhor &nbsp;<b class="${Math.abs(s) < 0.05 ? 'qc-neutro' : s < 0 ? 'qc-ganhou' : 'qc-perdeu'}">${comSinal(s, 2)} s</b>`)
      + (id == null ? '' : `${s == null ? '' : ' &nbsp;·&nbsp; '}Ideal pelos trechos &nbsp;<b>${relogio(id)}</b>`);
  }

  function pintar(o, c) {
    o.L.className = 'qc-grade qc-lin' + (c.estado === 'agora' ? ' qc-agora' : c.estado === 'aguardando' ? ' qc-aguardando' : '');
    texto(o.b, c.nome); texto(o.sub, c.sub || '');
    const p = c.estado === 'agora' && c.progresso != null ? Math.max(0, Math.min(1, c.progresso)) : 0;
    o.prog.style.width = (p * 100).toFixed(1) + '%';
    o.prog.style.background = p > 0 && c.trilha && c.trilha.length ? faixas(c.trilha, p) : '';
    // passagem nova chegou (o carro saiu da curva): realce curto na linha
    const chave = c.ultima ? c.ultima.n + ':' + c.ultima.tempo : null;
    if (o.chave != null && chave != null && chave !== o.chave) { o.L.classList.remove('qc-novo'); void o.L.offsetWidth; o.L.classList.add('qc-novo'); }
    o.chave = chave;
    COLUNAS.forEach((col, i) => {
      const x = o.cel[i], m = c.melhor ? c.melhor[col.k] : null, u = c.ultima ? c.ultima[col.k] : null;
      texto(x.mN, fmt(m, col.c), 'qc-n' + (m == null ? ' qc-vazio' : ''));
      texto(x.uN, fmt(u, col.c), 'qc-n' + (u == null ? ' qc-vazio' : ''));
      if (c.ehRef && u != null) { texto(x.uD, i === COLUNAS.length - 1 ? 'REF' : '', 'qc-d qc-chip'); return; }
      const dl = u == null || m == null ? null : u - m;
      const cls = dl == null || col.bom === 0 || Math.abs(dl) < (col.c ? 0.05 : 0.5) ? 'qc-neutro' : dl * col.bom > 0 ? 'qc-ganhou' : 'qc-perdeu';
      texto(x.uD, dl == null ? '' : comSinal(dl, col.c), 'qc-d ' + cls);
    });
  }

  return { atualizar, raiz };
}
