// Smoke spec: reaction-profiles-view + deleteProfile

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { tupleKey } = await import('../../src/domain/pilot-reaction.js');
const {
  saveProfile, loadAllProfiles, deleteProfile, clearProfiles
} = await import('../../src/data/reaction-profiles.js');
const {
  buildReactionProfileCardHTML, buildReactionProfilesListHTML, renderReactionProfiles
} = await import('../../src/ui/reaction-profiles-view.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const NOW = 1750000000000;

t('buildReactionProfileCardHTML: tupla com gear e trecho', () => {
  const html = buildReactionProfileCardHTML(
    { key: tupleKey('p1', 'car-1', 3, 't-reta'), reaction_time_ms: 198, sample_count: 42, last_updated: NOW - 60_000 },
    { trechoNameLookup: () => 'Reta principal', rpmRiseRate: 2000, now: NOW }
  );
  assert(html.includes('Marcha 3'), 'título deveria ter "Marcha 3"');
  assert(html.includes('Reta principal'), 'subtitle deveria ter trecho');
  assert(html.includes('198<small>ms</small>'), 'rt esperado');
  assert(html.includes('42'), 'sample_count esperado');
  // 198 * 2000 / 1000 = 396 rpm
  assert(html.includes('~396'), 'compensação esperada');
  assert(html.includes('há 1 min') || html.includes('há instantes'), 'when esperado');
});

t('buildReactionProfileCardHTML: tupla sem trecho → "qualquer trecho"', () => {
  const html = buildReactionProfileCardHTML({
    key: tupleKey('p1', 'car-1', 5, null), reaction_time_ms: 240, sample_count: 11, last_updated: NOW
  }, { now: NOW });
  assert(html.includes('Marcha 5'));
  assert(html.includes('qualquer trecho'));
});

t('buildReactionProfileCardHTML: tupla sem gear nem trecho → "Carro inteiro · fallback"', () => {
  const html = buildReactionProfileCardHTML({
    key: tupleKey('p1', 'car-1', null, null), reaction_time_ms: 210, sample_count: 61, last_updated: NOW
  }, { now: NOW });
  assert(html.includes('Carro inteiro'));
  assert(html.includes('fallback'));
});

t('buildReactionProfilesListHTML: vazio → mensagem amigável', () => {
  const html = buildReactionProfilesListHTML([]);
  assert(html.includes('Sem reações aprendidas ainda'));
});

t('buildReactionProfilesListHTML: ordena por last_updated desc', () => {
  const profiles = [
    { key: tupleKey('p1','c1',2,'t-A'), reaction_time_ms: 200, sample_count: 10, last_updated: NOW - 86_400_000 },
    { key: tupleKey('p1','c1',3,'t-B'), reaction_time_ms: 200, sample_count: 10, last_updated: NOW },
    { key: tupleKey('p1','c1',4,'t-C'), reaction_time_ms: 200, sample_count: 10, last_updated: NOW - 3_600_000 }
  ];
  const html = buildReactionProfilesListHTML(profiles, { now: NOW });
  const idxB = html.indexOf('Marcha 3');
  const idxC = html.indexOf('Marcha 4');
  const idxA = html.indexOf('Marcha 2');
  assert(idxB < idxC && idxC < idxA, 'ordem esperada B < C < A');
});

t('buildReactionProfilesListHTML aceita objeto {key:profile} (loadAllProfiles)', () => {
  const profiles = {
    [tupleKey('p1','c1',3,null)]: { key: tupleKey('p1','c1',3,null), reaction_time_ms: 220, sample_count: 12, last_updated: NOW }
  };
  const html = buildReactionProfilesListHTML(profiles, { now: NOW });
  assert(html.includes('Marcha 3'));
  assert((html.match(/class="profile" data-key=/g) || []).length === 1);
});

t('escapa HTML em key hostil', () => {
  const html = buildReactionProfileCardHTML({
    key: '<x>:<y>:3:<z>', reaction_time_ms: 200, sample_count: 5, last_updated: NOW
  }, { now: NOW });
  assert(!html.includes('<x>'), 'tag crua não pode aparecer');
  assert(html.includes('&lt;'));
});

// ─── deleteProfile + persistência ───────────────────────────────────────

t('deleteProfile: apaga apenas a tupla específica', async () => {
  await clearProfiles();
  await saveProfile({ key: tupleKey('p1','c1',2,'t-A'), reaction_time_ms: 200, sample_count: 12 });
  await saveProfile({ key: tupleKey('p1','c1',3,'t-B'), reaction_time_ms: 220, sample_count: 14 });
  let all = await loadAllProfiles();
  assert(Object.keys(all).length === 2);
  await deleteProfile(tupleKey('p1','c1',2,'t-A'));
  all = await loadAllProfiles();
  assert(Object.keys(all).length === 1);
  assert(all[tupleKey('p1','c1',3,'t-B')]);
});

t('deleteProfile: key inexistente → 0', async () => {
  const r = await deleteProfile('inexistente');
  assert(r === 0);
});

// ─── renderReactionProfiles (DOM mock) ──────────────────────────────────

t('renderReactionProfiles: container ausente → erro', async () => {
  let threw = false;
  try { await renderReactionProfiles({ container: null }); } catch { threw = true; }
  assert(threw);
});

t('renderReactionProfiles: profilesLoader injetado popula container', async () => {
  const fakeContainer = { innerHTML: '' };
  const r = await renderReactionProfiles({
    container: fakeContainer,
    profilesLoader: async () => [{ key: tupleKey('p1','c1',4,'t-X'), reaction_time_ms: 200, sample_count: 10, last_updated: NOW }],
    now: NOW
  });
  assert(r.rendered === 1);
  assert(fakeContainer.innerHTML.includes('Marcha 4'));
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[reaction-profiles-view.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
