// configuracao-stint.js — lógica da tela de configuração do stint.
//
// Decisão Flávio 2026-05-29 + auditor recomendação 3:
//   - Chefe aprova ENVELOPE pré-stint (limites duros, não ponto-a-ponto).
//   - IA opera sozinha DENTRO do envelope durante o stint.
//   - Tudo persistido pra revisão pós-stint.

import { PERFIL_BUBI, ENVELOPE_DEFAULT_BUBI } from './shift-light-modos.js';
import { listarTreinos, treinoPorFoco } from './catalogo-treinos.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { normalizarTipoPneu } from './tipo-pneu-normalizer.js';

// Modos (Durabilidade/Normal/Agressivo) REVOGADOS por decisão do Flávio 14/06/2026:
// carro de corrida = um comportamento só (máximo desempenho, troca na potência
// máxima). A tela não oferece mais escolha. Mantém-se um valor compatível com o
// banco (a coluna modo_stint aceita os valores antigos) — 'agressivo' = "máximo
// ganho de volta", o mais próximo de "máximo desempenho".
const MODO_STINT_REGISTRO = 'agressivo';
let modoSelecionado = MODO_STINT_REGISTRO; // sempre selecionado (não há mais escolha)

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

// Brief do treino (decisão 11/06): o piloto precisa VER o brief da habilidade
// antes de aprovar — o "como fazer" se ensina parado; em movimento vai só o verbo.
let briefVisto = false;

// ── Render dos cartões ────────────────────────────────────────

// Antes: 3 cartões de modo clicáveis. Agora (14/06): um bloco único informativo —
// não há escolha de modo. A luz troca na potência máxima e afina pelo menor tempo
// de passagem conforme o piloto roda.
function renderModos() {
  const container = document.getElementById('modosContainer');
  if (!container) return;
  const alvo = PERFIL_BUBI.picoPotenciaRpm;
  const teto = PERFIL_BUBI.redlineRpm;
  container.innerHTML = `
    <div class="modo is-selected" data-modo="${MODO_STINT_REGISTRO}" style="cursor:default;">
      <div class="modo__nome">Máximo desempenho</div>
      <div class="modo__faixa">Troca na potência máxima · ~${alvo} rpm</div>
      <div class="modo__desc">Comportamento único do carro de corrida. A luz acende na potência máxima do motor (${alvo} rpm) e afina sozinha pelo MENOR TEMPO de passagem conforme você roda. Teto de segurança em ${teto} rpm. Os 3 modos antigos (Durabilidade / Normal / Agressivo) foram aposentados.</div>
    </div>
  `;
}

// Sem escolha de modo (revogados 14/06): mantém só o refresh do envelope/botões.
function selecionarModo() {
  renderEnvelope();
  atualizarBotoes();
}

// ── Envelope de segurança ─────────────────────────────────────

function renderEnvelope() {
  const envEl = document.getElementById('envelope');
  if (!envEl) return;
  const e = ENVELOPE_DEFAULT_BUBI;
  const alvo = PERFIL_BUBI.picoPotenciaRpm;
  envEl.style.setProperty('--cor-ativa-envelope', `var(--cor-agressivo)`);

  envEl.innerHTML = `
    <div class="envelope-item">
      <div class="envelope-item__label">Ponto de troca da luz</div>
      <div class="envelope-item__valor">${alvo} rpm (potência máxima)</div>
      <div class="envelope-item__desc">A luz acende na potência máxima do motor e afina sozinha pelo menor tempo de passagem, com a antecipação do seu tempo de reação.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Teto duro do motor</div>
      <div class="envelope-item__valor">${e.rpm_max_absoluto} rpm</div>
      <div class="envelope-item__desc">Limite absoluto. A luz nunca propõe troca acima disso (sirene de segurança).</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Temperatura mínima da água</div>
      <div class="envelope-item__valor">${e.rpm_min_motor_celsius} °C</div>
      <div class="envelope-item__desc">Abaixo disso, a luz recua pra proteger o motor frio.</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Força lateral máxima pra trocar</div>
      <div class="envelope-item__valor">${e.forca_lateral_max_g} g</div>
      <div class="envelope-item__desc">A luz nunca propõe trocar marcha em curva com força lateral acima disso (proteção do eixo).</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Óleo máximo</div>
      <div class="envelope-item__valor">${e.oleo_max_celsius} °C</div>
      <div class="envelope-item__desc">Acima disso, alarme + a luz recua automaticamente (proteção do motor).</div>
    </div>
    <div class="envelope-item">
      <div class="envelope-item__label">Água máxima</div>
      <div class="envelope-item__valor">${e.agua_max_celsius} °C</div>
      <div class="envelope-item__desc">Acima disso, alarme + a luz recua automaticamente (proteção do motor).</div>
    </div>
  `;
}

function atualizarBotoes() {
  const btn = document.getElementById('btnAprovar');
  if (!btn) return;
  // Treinar habilidade exige foco escolhido + brief visto (antes dava pra
  // aprovar treino sem foco — o painel ficava sem ter o que armar).
  // Não há mais "escolher modo": o único bloqueio é treino incompleto.
  const treinoIncompleto = plano.proposito === 'treinar' && (!plano.foco || !briefVisto);
  btn.disabled = treinoIncompleto;
  btn.style.setProperty('--cor-ativa-envelope', `var(--cor-agressivo)`);
  btn.style.background = `var(--cor-agressivo)`;
}

// ── Catálogo de treinos → chips + brief ───────────────────────

function renderChipsTreinar() {
  const grupo = document.getElementById('subTreinar');
  if (!grupo) return;
  grupo.innerHTML = '';
  const treinos = listarTreinos();
  const mkChip = (t) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (t.grupo === 'tecnica' ? ' chip--tecnica' : '');
    chip.dataset.foco = t.id;
    chip.innerHTML = `${t.rotulo}<span class="chip__etq">${t.etiqueta === 'proxy' ? 'PROXY' : 'PLENO'}</span>`;
    return chip;
  };
  for (const t of treinos.filter(t => t.grupo === 'tecnica')) grupo.appendChild(mkChip(t));
  const div = document.createElement('div');
  div.className = 'subescolha__divisor';
  div.textContent = '6 pontos do trecho';
  grupo.appendChild(div);
  for (const t of treinos.filter(t => t.grupo === 'ponto')) grupo.appendChild(mkChip(t));
}

function renderBriefTreino(foco) {
  const box = document.getElementById('briefTreino');
  if (!box) return;
  const t = treinoPorFoco(foco);
  if (!t) { box.style.display = 'none'; return; }
  briefVisto = false;
  box.innerHTML = `
    <div class="brief__titulo">${t.selo}
      <span class="brief__etq">${t.etiqueta === 'proxy' ? 'MEDIÇÃO POR APROXIMAÇÃO' : 'MEDIÇÃO PLENA'}</span>
      <span class="brief__etq">Manual: cap. ${t.capitulos.join(' + ')}</span>
    </div>
    <div class="brief__texto">${t.brief.oQueE}</div>
    <div class="brief__sub">O que a IA mede neste stint</div>
    <ul>${t.brief.oQueMede.map(m => `<li>${m}</li>`).join('')}</ul>
    <div class="brief__sub">Como aparece na tela</div>
    <div class="brief__texto">${t.brief.comoAparece}</div>
    <div class="brief__texto">Meta do stint: REPETIR, não cravar — aprendeu = 3 de 4 passagens dentro da janela. A IA cala no trecho que assentou e recua se você saturar.</div>
    ${t.brief.ressalva ? `<div class="brief__ressalva">${t.brief.ressalva}</div>` : ''}
    <button type="button" class="brief__ok" id="btnBriefOk">Entendi o treino — liberar aprovação</button>
  `;
  box.style.display = 'block';
  document.getElementById('btnBriefOk').addEventListener('click', (e) => {
    briefVisto = true;
    e.target.classList.add('is-ok');
    e.target.textContent = 'Treino entendido — aprovação liberada';
    atualizarBotoes();
  });
  atualizarBotoes();
}

function esconderBriefTreino() {
  const box = document.getElementById('briefTreino');
  if (box) box.style.display = 'none';
  briefVisto = false;
}

// ── Gravar envelope no banco ──────────────────────────────────

async function aprovarEnvelope() {
  if (!modoSelecionado) return;
  const status = document.getElementById('status');
  status.className = 'status';
  status.textContent = 'Aprovando envelope…';

  // Plano completo do stint — gravado no banco JUNTO do envelope (plano viaja
  // com o envelope, 11/06) e no localStorage (cache do navegador local).
  const planoCompleto = {
    ...plano,
    carroId: document.getElementById('selCarro').value,
    piloto: document.getElementById('selPiloto').value,
    autodromo: document.getElementById('selAutodromo').value,
    tipoPneu: document.getElementById('selPneu').value,
    vidaPneuFaixa: document.getElementById('selVida').value,
    modo: modoSelecionado,
    aprovadoEm: new Date().toISOString(),
  };

  const payload = {
    carro_id:           document.getElementById('selCarro').value,
    modo_stint:         modoSelecionado,
    tipo_pneu:          normalizarTipoPneu(document.getElementById('selPneu').value),
    vida_pneu_faixa:    document.getElementById('selVida').value,
    config_cambio:      'padrao',
    rpm_max_absoluto:   ENVELOPE_DEFAULT_BUBI.rpm_max_absoluto,
    rpm_min_motor_celsius: ENVELOPE_DEFAULT_BUBI.rpm_min_motor_celsius,
    forca_lateral_max_g:   ENVELOPE_DEFAULT_BUBI.forca_lateral_max_g,
    observacoes:        `Envelope aprovado via tela de configuração (chefe). Máximo desempenho — troca na potência máxima (${PERFIL_BUBI.picoPotenciaRpm} rpm), teto ${PERFIL_BUBI.redlineRpm}.`,
    plano_stint:        planoCompleto,
  };

  try {
    const postEnvelope = (body) => fetch(`${SUPABASE_URL}/rest/v1/envelopes_seguranca_stint`, {
      method: 'POST',
      headers: {
        'apikey':         SUPABASE_ANON_KEY,
        'Authorization':  `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':   'application/json',
        'Prefer':         'return=representation',
      },
      body: JSON.stringify(body),
    });

    let planoFicouSoLocal = false;
    let resp = await postEnvelope(payload);
    if (!resp.ok) {
      const err = await resp.text();
      // Banco ainda sem a coluna plano_stint (migration 0042 não aplicada —
      // erro PGRST204 citando a coluna): a aprovação do envelope NÃO pode
      // falhar por causa do plano — regrava sem ele, e a tela CONTA a verdade.
      if (resp.status === 400 && err.includes('PGRST204') && err.includes('plano_stint')) {
        const semPlano = { ...payload };
        delete semPlano.plano_stint;
        resp = await postEnvelope(semPlano);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        planoFicouSoLocal = true;
        console.warn('[configuracao-stint] banco sem a coluna plano_stint — envelope gravado sem o plano (aplique a migration 0042).');
      } else {
        throw new Error(`HTTP ${resp.status}: ${err}`);
      }
    }
    const data = await resp.json();
    const id = Array.isArray(data) && data[0] ? data[0].id : '?';
    status.className = 'status ok';
    status.textContent = planoFicouSoLocal
      ? `✓ Envelope aprovado (id ${id.substring(0, 8)}…). Máximo desempenho. ATENÇÃO: o plano do stint NÃO foi pro banco (banco ainda sem a atualização 0042) — o treino só arma neste navegador.`
      : `✓ Envelope aprovado (id ${id.substring(0, 8)}…). Máximo desempenho. Plano do stint registrado. Painel piloto pode iniciar.`;
    // Cache local — painel principal lê na próxima abertura.
    try { localStorage.setItem('p1fast-modo-stint-v1', modoSelecionado); } catch {}
    // Plano completo do stint (propósito/foco/ghost/voltas/paradas) — cache
    // local; em outra máquina o painel busca o mesmo plano no envelope (banco).
    try {
      localStorage.setItem('p1fast-plano-stint-v1', JSON.stringify(planoCompleto));
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
  // brief só existe no propósito treinar
  if (slug === 'treinar' && plano.foco) renderBriefTreino(plano.foco);
  else esconderBriefTreino();
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
      // Treino escolhido → brief obrigatório antes de liberar o Aprovar.
      if (grupo.id === 'subTreinar') renderBriefTreino(plano.foco);
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
      // só volta REAL (painel na pista) — as provisórias antigas do app inflavam
      // a contagem e contariam 2× quando a gravação real ligar (auditoria 10/06)
      const voltas = await rest(`voltas?select=id&sessao_id=in.(${ids})&origem=eq.painel-ao-vivo`);
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
renderChipsTreinar();        // chips nascem do catálogo canônico (11/06)
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
