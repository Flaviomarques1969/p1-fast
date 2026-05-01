// trecho-resolver — adapter para o sistema de trecho do P1 Fast.
// Único ponto que conhece a API externa: se o sistema mudar, só este arquivo
// muda. Se o sistema não estiver disponível em runtime, retorna null em vez
// de falhar (evento de troca permanece sem trecho ancorado).

let lookupFn = null;

// setTrechoLookup(fn) — registra uma função `({lat, lon, timestamp}) → string|null`
// Permite injetar adapter do app principal (Detector existente, segments, etc).
export function setTrechoLookup(fn) {
  lookupFn = (typeof fn === 'function') ? fn : null;
}

export function clearTrechoLookup() {
  lookupFn = null;
}

// resolveTrechoId({lat, lon, timestamp}) → Promise<string | null>
// - Retorna null se não há lookup registrado.
// - Retorna null se lat/lon não são números válidos.
// - Retorna null se o lookup lançar ou devolver algo que não é string.
export async function resolveTrechoId({ lat, lon, timestamp } = {}) {
  if (typeof lookupFn !== 'function') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const res = await lookupFn({ lat, lon, timestamp });
    return typeof res === 'string' && res.length > 0 ? res : null;
  } catch {
    return null;
  }
}
