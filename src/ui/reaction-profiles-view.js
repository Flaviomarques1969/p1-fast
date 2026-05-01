// reaction-profiles-view — render da tela "Reações aprendidas".
// Mesmas classes do mockup `_design-reference/mockup-reacoes-aprendidas.html`.

import { loadAllProfiles, deleteProfile } from '../data/reaction-profiles.js';

const REACTION_RATE_DEFAULT = 1500; // rpm/s — taxa típica em pista, só pra
                                     // ilustrar a "compensação" no card.

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseKey(key) {
  // tupleKey: 'piloto:carro:gear:trecho' (qualquer parte pode ser 'x')
  const [piloto, carro, gear, trecho] = String(key).split(':');
  return {
    piloto_id: piloto === 'x' ? null : piloto,
    carro_id: carro === 'x' ? null : carro,
    gear: gear === 'x' ? null : Number(gear),
    trecho_id: trecho === 'x' ? null : trecho
  };
}

function titleFor(parsed, trechoNameLookup) {
  if (parsed.gear == null && parsed.trecho_id == null) {
    return { title: 'Carro inteiro', subtitle: 'fallback' };
  }
  if (parsed.trecho_id == null) {
    return { title: `Marcha ${parsed.gear}`, subtitle: 'qualquer trecho' };
  }
  const trecho = (typeof trechoNameLookup === 'function')
    ? (trechoNameLookup(parsed.trecho_id) || parsed.trecho_id)
    : parsed.trecho_id;
  return { title: `Marcha ${parsed.gear}`, subtitle: trecho };
}

function formatWhen(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return 'sem registro';
  const ago = now - ts;
  if (ago < 0) return 'agora';
  const sec = ago / 1000;
  if (sec < 60) return 'há instantes';
  const min = sec / 60;
  if (min < 60) return `há ${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `há ${Math.round(h)}h`;
  const d = h / 24;
  return `há ${Math.round(d)} dias`;
}

export function buildReactionProfileCardHTML(profile, { trechoNameLookup, rpmRiseRate = REACTION_RATE_DEFAULT, now } = {}) {
  if (!profile || !profile.key) return '';
  const parsed = parseKey(profile.key);
  const { title, subtitle } = titleFor(parsed, trechoNameLookup);
  const rt = Number.isFinite(profile.reaction_time_ms) ? Math.round(profile.reaction_time_ms) : null;
  const samples = Number.isFinite(profile.sample_count) ? profile.sample_count : 0;
  const comp = (rt != null && Number.isFinite(rpmRiseRate))
    ? Math.round(rt * rpmRiseRate / 1000)
    : null;
  const when = formatWhen(profile.last_updated, now);

  return `<article class="profile" data-key="${escapeHtml(profile.key)}">
    <div class="profile__head">
      <div class="profile__title">${escapeHtml(title)} <small>· ${escapeHtml(subtitle)}</small></div>
    </div>
    <div class="profile__nums">
      <div class="profile__num">
        <span class="profile__num__lbl">Reação</span>
        <span class="profile__num__val">${rt != null ? rt : '—'}${rt != null ? '<small>ms</small>' : ''}</span>
      </div>
      <div class="profile__num">
        <span class="profile__num__lbl">Amostras</span>
        <span class="profile__num__val">${samples}</span>
      </div>
      <div class="profile__num">
        <span class="profile__num__lbl">Compensação</span>
        <span class="profile__num__val">${comp != null ? `~${comp}<small>rpm</small>` : '—'}</span>
      </div>
    </div>
    <div class="profile__foot">
      <span class="profile__foot__when">${escapeHtml(when)}</span>
      <button class="profile__reset" type="button" data-key="${escapeHtml(profile.key)}">Resetar</button>
    </div>
  </article>`;
}

export function buildReactionProfilesListHTML(profiles, opts = {}) {
  const arr = Array.isArray(profiles)
    ? profiles
    : (profiles && typeof profiles === 'object' ? Object.values(profiles) : []);
  if (arr.length === 0) {
    return '<div class="profile-empty">Sem reações aprendidas ainda. Mais voltas em modo assistido vão preencher esta tela.</div>';
  }
  // Mais recentes primeiro
  const sorted = arr.slice().sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
  const cards = sorted.map(p => buildReactionProfileCardHTML(p, opts)).join('');
  return `<div class="profile-list">${cards}</div>`;
}

// renderReactionProfiles({ container, trechoNameLookup, profilesLoader, onReset })
//   - profilesLoader: opcional, override de loadAllProfiles
//   - onReset(key) → Promise<void>: callback após delete; default usa deleteProfile e re-renderiza
export async function renderReactionProfiles({ container, trechoNameLookup = null, profilesLoader = null, onReset = null, rpmRiseRate, now } = {}) {
  if (!container || typeof container.innerHTML !== 'string') {
    throw new Error('renderReactionProfiles: container DOM obrigatório');
  }
  const loader = profilesLoader || loadAllProfiles;
  const profiles = await loader();
  container.innerHTML = buildReactionProfilesListHTML(profiles, { trechoNameLookup, rpmRiseRate, now });
  // Wire dos botões de reset, se o container suportar querySelectorAll
  if (typeof container.querySelectorAll === 'function') {
    const buttons = container.querySelectorAll('button.profile__reset');
    for (const btn of buttons) {
      btn.addEventListener?.('click', async () => {
        const key = btn.getAttribute?.('data-key');
        if (!key) return;
        if (onReset) await onReset(key);
        else await deleteProfile(key);
        await renderReactionProfiles({ container, trechoNameLookup, profilesLoader, onReset, rpmRiseRate, now });
      });
    }
  }
  const count = Array.isArray(profiles)
    ? profiles.length
    : (profiles && typeof profiles === 'object' ? Object.keys(profiles).length : 0);
  return { rendered: count };
}
