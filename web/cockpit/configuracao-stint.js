// configuracao-stint.js — lógica da tela de configuração do stint.
//
// Decisão Flávio 2026-05-29 + auditor recomendação 3:
//   - Chefe aprova ENVELOPE pré-stint (limites duros, não ponto-a-ponto).
//   - IA opera sozinha DENTRO do envelope durante o stint.
//   - Tudo persistido pra revisão pós-stint.

import { listarModos, janelaParaModo, ENVELOPE_DEFAULT_BUBI, ModoStint } from './shift-light-modos.js';

const SUPABASE_URL = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

let modoSelecionado = null;

// ── Plano do stint (ditado Flávio 10/06/2026) ─────────────────
// propósito: livre | testar (parte do carro) | treinar (trail braking ou um
// dos 6 pontos do trecho) · ghost liga/desliga · voltas · paradas (volta+motivo)
const plano = {
  proposito: null,   // 'livre' | 'testar' | 'treinar'
  foco: null,        // parte do carro OU disciplina do treino
  ghost: false,
  voltas: 10,
  paradas: [],       // [{ volta, motivo }]
};

// ── Render dos cartões ────────────────────────────────────────

function renderModos() {
  const container = document.getElementById('modosContainer');
  const modos = listarModos();
  container.innerHTML = '';
  for (const m of modos) {
    const slug = m.nome.toLowerCase();
    const card = document.createElement('div');
    card.className = 'modo';
    card.dataset.modo = slug;
    card.dataset.rpmMin = m.rpmMin;
    card.dataset.rpmMax = m.rpmMax;
    card.innerHTML = `
      <div class="modo__nome">${m.nome}</div>
      <div class="modo__faixa">${m.rpmMin}–${m.rpmMax} rpm</div>
      <div class="modo__desc">${m.descLonga}</div>
      <div class="modo__meta">
        <span>Ganho de volta<br><strong>${m.ganhoVoltaEstimadoS > 0 ? '+' : ''}${m.ganhoVoltaEstimadoS.toFixed(1)} s</strong></span>
        <span>Desgaste do motor<br><strong>${m.desgasteRelativo}</strong></span>
      </div>
    `;
    card.addEventListener('click', () => selecionarModo(slug));
    container.appendChild(card);
  }
}

function selecionarModo(slug) {
  modoSelecionado = slug;
  document.querySelectorAll('.modo').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.modo === slug);
  });
  renderEnvelope();
  atualizarBotoes();
}

// ── Envelope de segurança ─────────────────────────────────────

function renderEnvelope() {
  const envEl = document.getElementById('envelope');
  if (!modoSelecionado) {
    envEl.innerHTML = '<p style="color:#888;font-size:13px;">Selecione um modo acima pra ver o envelope.</p>';
    return;
  }
  const j = janelaParaModo(modoSelecionado);
  const e = ENVELOPE_DEFAULT_BUBI;
  // Cor do modo influencia a barra lateral dos itens
  envEl.style.setProperty('--cor-ativa-envelope', `var(--cor-${modoSelecionado})`);

  envEl.innerHTML = `
    <div class="envelope-item">
      <div class="envelope-item__label">Janela do shift light</div>
      <div class="envelope-item__valor">${j.rpmMin} – ${j.rpmMax} rpm</div>
      <div class="envelope-item__desc">IA escolhe o ponto exato em cada trecho dentro desta janela.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Teto duro do motor</div>
      <div class="envelope-item__valor">${e.rpm_max_absoluto} rpm</div>
      <div class="envelope-item__desc">Limite absoluto. IA nunca propõe troca acima disso.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Temperatura mínima da água</div>
      <div class="envelope-item__valor">${e.rpm_min_motor_celsius} °C</div>
      <div class="envelope-item__desc">Abaixo disso, modo agressivo rebaixa pra Normal automaticamente.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Força lateral máxima pra trocar</div>
      <div class="envelope-item__valor">${e.forca_lateral_max_g} g</div>
      <div class="envelope-item__desc">IA nunca propõe trocar marcha em curva com força lateral acima disso (proteção do eixo).</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Óleo máximo</div>
      <div class="envelope-item__valor">${e.oleo_max_celsius} °C</div>
      <div class="envelope-item__desc">Acima disso, alarme + rebaixamento automático pra Durabilidade.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Água máxima</div>
      <div class="envelope-item__valor">${e.agua_max_celsius} °C</div>
      <div class="envelope-item__desc">Acima disso, alarme + rebaixamento automático pra Durabilidade.</div>
    </div>
  `;
}

function atualizarBotoes() {
  const btn = document.getElementById('btnAprovar');
  btn.disabled = !modoSelecionado;
  btn.style.setProperty('--cor-ativa-envelope', `var(--cor-${modoSelecionado || 'normal'})`);
  if (modoSelecionado) {
    btn.style.background = `var(--cor-${modoSelecionado})`;
  }
}

// ── Gravar envelope no banco ──────────────────────────────────

async function aprovarEnvelope() {
  if (!modoSelecionado) return;
  const status = document.getElementById('status');
  status.className = 'status';
  status.textContent = 'Aprovando envelope…';

  const payload = {
    carro_id:           document.getElementById('selCarro').value,
    modo_stint:         modoSelecionado,
    tipo_pneu:          document.getElementById('selPneu').value,
    vida_pneu_faixa:    document.getElementById('selVida').value,
    config_cambio:      'padrao',
    rpm_max_absoluto:   ENVELOPE_DEFAULT_BUBI.rpm_max_absoluto,
    rpm_min_motor_celsius: ENVELOPE_DEFAULT_BUBI.rpm_min_motor_celsius,
    forca_lateral_max_g:   ENVELOPE_DEFAULT_BUBI.forca_lateral_max_g,
    observacoes:        `Envelope aprovado via tela de configuração (chefe). Janela ${janelaParaModo(modoSelecionado).rpmMin}-${janelaParaModo(modoSelecionado).rpmMax} rpm.`,
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/envelopes_seguranca_stint`, {
      method: 'POST',
      headers: {
        'apikey':         SUPABASE_ANON_KEY,
        'Authorization':  `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':   'application/json',
        'Prefer':         'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${err}`);
    }
    const data = await resp.json();
    const id = Array.isArray(data) && data[0] ? data[0].id : '?';
    status.className = 'status ok';
    status.textContent = `✓ Envelope aprovado (id ${id.substring(0, 8)}…). Modo: ${modoSelecionado.toUpperCase()}. Plano do stint registrado. Painel piloto pode iniciar.`;
    // Cache local — painel principal lê na próxima abertura.
    try { localStorage.setItem('p1fast-modo-stint-v1', modoSelecionado); } catch {}
    // Plano completo do stint (propósito/foco/ghost/voltas/paradas) — o painel
    // passa a consumir destas chaves nas próximas frentes (treino focado, ghost).
    try {
      localStorage.setItem('p1fast-plano-stint-v1', JSON.stringify({
        ...plano,
        carroId: document.getElementById('selCarro').value,
        piloto: document.getElementById('selPiloto').value,
        autodromo: document.getElementById('selAutodromo').value,
        tipoPneu: document.getElementById('selPneu').value,
        vidaPneuFaixa: document.getElementById('selVida').value,
        modo: modoSelecionado,
        aprovadoEm: new Date().toISOString(),
      }));
    } catch {}
  } catch (err) {
    status.className = 'status err';
    status.textContent = `✗ Falhou ao gravar: ${err.message}. (Pode ser política de acesso do banco bloqueando — o envelope está pronto na tela mas não persistiu.)`;
    console.error(err);
  }
}

// ── Propósito do stint ────────────────────────────────────────

function selecionarProposito(slug) {
  plano.proposito = slug;
  if (slug === 'livre') plano.foco = null;
  document.querySelectorAll('.proposito').forEach(el => {
    const sel = el.dataset.proposito === slug;
    el.classList.toggle('is-selected', sel);
    if (!sel) el.querySelectorAll('.chip').forEach(c => c.classList.remove('is-on'));
  });
  if (slug !== 'livre') {
    // foco anterior de outro propósito não vale mais
    const aberto = document.querySelector(`.proposito[data-proposito="${slug}"]`);
    const ligado = aberto && aberto.querySelector('.chip.is-on');
    plano.foco = ligado ? ligado.dataset.foco : null;
  }
  atualizarBotoes();
}

function ligarPropositos() {
  document.querySelectorAll('.proposito').forEach(el => {
    el.addEventListener('click', () => selecionarProposito(el.dataset.proposito));
  });
  document.querySelectorAll('.subescolha .chip').forEach(chip => {
    chip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const grupo = chip.closest('.subescolha');
      grupo.querySelectorAll('.chip').forEach(c => c.classList.remove('is-on'));
      chip.classList.add('is-on');
      plano.foco = chip.dataset.foco;
      atualizarBotoes();
    });
  });
  const tg = document.getElementById('toggleGhost');
  const alterna = () => {
    plano.ghost = !plano.ghost;
    tg.classList.toggle('is-on', plano.ghost);
    tg.setAttribute('aria-checked', String(plano.ghost));
  };
  tg.addEventListener('click', alterna);
  tg.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alterna(); } });
}

// ── Voltas e paradas ──────────────────────────────────────────

function renderParadas() {
  const lista = document.getElementById('paradasLista');
  lista.innerHTML = '';
  plano.paradas.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'parada';
    row.innerHTML = `
      <input type="number" min="1" max="${plano.voltas}" value="${p.volta}" aria-label="Volta da parada">
      <input type="text" placeholder="Motivo (ex.: calibrar pneus, combustível…)" value="${p.motivo.replace(/"/g, '&quot;')}" aria-label="Motivo da parada">
      <button type="button" class="parada__remover" title="Remover parada">×</button>
    `;
    const [inpVolta, inpMotivo] = row.querySelectorAll('input');
    inpVolta.addEventListener('change', () => {
      p.volta = Math.max(1, Math.min(plano.voltas, parseInt(inpVolta.value, 10) || 1));
      inpVolta.value = p.volta;
    });
    inpMotivo.addEventListener('input', () => { p.motivo = inpMotivo.value; });
    row.querySelector('.parada__remover').addEventListener('click', () => {
      plano.paradas.splice(i, 1);
      renderParadas();
    });
    lista.appendChild(row);
  });
}

function ligarVoltasParadas() {
  const inpVoltas = document.getElementById('inpVoltas');
  inpVoltas.addEventListener('change', () => {
    plano.voltas = Math.max(1, Math.min(99, parseInt(inpVoltas.value, 10) || 1));
    inpVoltas.value = plano.voltas;
    plano.paradas.forEach(p => { p.volta = Math.min(p.volta, plano.voltas); });
    renderParadas();
  });
  document.getElementById('btnAddParada').addEventListener('click', () => {
    const sugestao = plano.paradas.length
      ? Math.min(plano.voltas, plano.paradas[plano.paradas.length - 1].volta + 5)
      : Math.min(plano.voltas, Math.ceil(plano.voltas / 2));
    plano.paradas.push({ volta: sugestao, motivo: '' });
    renderParadas();
  });
}

// ── Vida útil do item selecionado (desde a última troca registrada) ──
// Deriva da nuvem: data da troca em `manutencoes` (item pneus) + sessões desde
// essa data. Voltas vêm da tabela `voltas` (hoje provisórias — a gravação real
// entra em frente própria). Quilômetros ainda não existem na telemetria.

async function rest(caminho) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function fmtHoras(ms) {
  const h = ms / 3600000;
  if (h >= 10) return `${Math.round(h)} h`;
  return `${h.toFixed(1).replace('.', ',')} h`;
}

async function carregarVidaUtil() {
  const nota = document.getElementById('vuNota');
  const elT = document.getElementById('vuTempo');
  const elV = document.getElementById('vuVoltas');
  const elK = document.getElementById('vuKm');
  const carroId = document.getElementById('selCarro').value;
  try {
    const trocas = await rest(`manutencoes?select=ocorrido_em&carro_id=eq.${carroId}&item_codigo=eq.pneus&order=ocorrido_em.desc&limit=1`);
    if (!trocas.length) {
      // vazio aqui pode ser "não existe" OU "o acesso do painel ainda não enxerga"
      // (card de acesso em decisão) — a mensagem não pode afirmar o que não vê.
      nota.textContent = 'Nenhuma troca visível pro painel — registre a instalação no app (Manutenção) ou conclua a liberação de acesso pra contagem aparecer.';
      return;
    }
    const desde = Number(trocas[0].ocorrido_em);
    const sessoes = await rest(`sessoes?select=id,data_inicio,data_fim&carro_id=eq.${carroId}&data_inicio=gte.${new Date(desde).toISOString()}`);
    let ms = 0;
    for (const s of sessoes) {
      const ini = Date.parse(s.data_inicio);
      const fim = s.data_fim ? Date.parse(s.data_fim) : ini;
      if (Number.isFinite(ini) && Number.isFinite(fim) && fim > ini) ms += fim - ini;
    }
    elT.textContent = ms > 0 ? fmtHoras(ms) : '0 h';
    let nVoltas = 0;
    if (sessoes.length) {
      const ids = sessoes.map(s => `"${s.id}"`).join(',');
      const voltas = await rest(`voltas?select=id&sessao_id=in.(${ids})`);
      nVoltas = voltas.length;
    }
    elV.textContent = String(nVoltas);
    // km = voltas × comprimento oficial do traçado (coluna entra com a
    // estrutura da contagem real; até lá a consulta falha de leve e mostra —)
    try {
      const lay = await rest('track_layouts?select=comprimento_m&comprimento_m=not.is.null&limit=1');
      const compM = lay.length ? Number(lay[0].comprimento_m) : null;
      elK.textContent = (compM && nVoltas) ? `${((nVoltas * compM) / 1000).toFixed(0)} km` : (compM ? '0 km' : '—');
    } catch { elK.textContent = '—'; }
    nota.textContent = `Troca registrada em ${new Date(desde).toLocaleDateString('pt-BR')}.`;
  } catch (e) {
    nota.textContent = 'Não consegui consultar os registros agora (' + e.message + ').';
  }
}

// ── Init ──────────────────────────────────────────────────────

renderModos();
selecionarModo('agressivo'); // sugestão default = Agressivo (decisão Flávio 2026-05-29)
ligarPropositos();
selecionarProposito('livre'); // padrão natural: rodar livre
ligarVoltasParadas();
renderParadas();
carregarVidaUtil();

document.getElementById('btnAprovar').addEventListener('click', aprovarEnvelope);
document.getElementById('btnCancelar').addEventListener('click', () => {
  modoSelecionado = null;
  document.querySelectorAll('.modo').forEach(el => el.classList.remove('is-selected'));
  renderEnvelope();
  atualizarBotoes();
  document.getElementById('status').textContent = 'Cancelado.';
});

console.log('[configuracao-stint] pronto');
