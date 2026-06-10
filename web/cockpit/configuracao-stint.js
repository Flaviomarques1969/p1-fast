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
    status.textContent = `✓ Envelope aprovado em produção (id ${id.substring(0, 8)}…). Modo: ${modoSelecionado.toUpperCase()}. Painel piloto pode iniciar.`;
    // Cache local — painel principal lê na próxima abertura.
    try { localStorage.setItem('p1fast-modo-stint-v1', modoSelecionado); } catch {}
  } catch (err) {
    status.className = 'status err';
    status.textContent = `✗ Falhou ao gravar: ${err.message}. (Pode ser política de acesso do banco bloqueando — o envelope está pronto na tela mas não persistiu.)`;
    console.error(err);
  }
}

// ── Init ──────────────────────────────────────────────────────

renderModos();
selecionarModo('agressivo'); // sugestão default = Agressivo (decisão Flávio 2026-05-29)

document.getElementById('btnAprovar').addEventListener('click', aprovarEnvelope);
document.getElementById('btnCancelar').addEventListener('click', () => {
  modoSelecionado = null;
  document.querySelectorAll('.modo').forEach(el => el.classList.remove('is-selected'));
  renderEnvelope();
  atualizarBotoes();
  document.getElementById('status').textContent = 'Cancelado.';
});

console.log('[configuracao-stint] pronto');
