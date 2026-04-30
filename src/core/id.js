// ═══════════════════════════════════════════════════════════
// id — geração de IDs únicos legíveis
// ═══════════════════════════════════════════════════════════
// Formato: <prefix>_<timestamp36><random>
// Exemplo: usr_lq7f3k2m8xz9a
// Prefixo semântico ajuda debug e inspeção do IndexedDB.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomChunk(len = 6) {
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function uid(prefix = '') {
  const t = Date.now().toString(36);
  const r = randomChunk(6);
  return prefix ? `${prefix}_${t}${r}` : `${t}${r}`;
}
