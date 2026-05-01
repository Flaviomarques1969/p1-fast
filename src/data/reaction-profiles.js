// reaction-profiles — Dexie store para perfis de reação aprendidos.
// Schema (v12): { id auto, key (único), reaction_time_ms, sample_count, last_updated }

import { db } from '../core/db.js';

export async function saveProfile(profile) {
  if (!profile || !profile.key) throw new Error('saveProfile: key obrigatória');
  const existing = await db.reaction_profiles.where('key').equals(profile.key).first();
  if (existing) {
    await db.reaction_profiles.update(existing.id, {
      reaction_time_ms: profile.reaction_time_ms,
      sample_count: profile.sample_count,
      last_updated: profile.last_updated ?? Date.now()
    });
    return existing.id;
  }
  return db.reaction_profiles.add({
    key: profile.key,
    reaction_time_ms: profile.reaction_time_ms,
    sample_count: profile.sample_count,
    last_updated: profile.last_updated ?? Date.now()
  });
}

export async function loadProfile(key) {
  if (!key) return null;
  return db.reaction_profiles.where('key').equals(key).first() || null;
}

// loadAllProfiles() → objeto { [key]: profile } pronto pra alimentar
// learnFromEvent / computeCompensation.
export async function loadAllProfiles() {
  const all = await db.reaction_profiles.toArray();
  const out = {};
  for (const p of all) out[p.key] = p;
  return out;
}

export async function clearProfiles() {
  return db.reaction_profiles.clear();
}
