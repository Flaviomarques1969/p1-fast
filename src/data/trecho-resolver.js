// trecho-resolver — adapter para o sistema de trecho do P1 Fast.
// Único ponto que conhece a API externa: se o sistema mudar, só este arquivo
// muda. Se o sistema não estiver disponível em runtime, retorna null em vez
// de falhar (evento de troca permanece sem trecho ancorado).
//
// Duas faces complementares:
//   - LIVE (síncrona): durante a sessão, ler o segmento corrente do Detector
//     pra que cada shift_event saia já com trecho_id ancorado.
//     `setTrechoSource(detector)` + `getCurrentTrechoIdSync()`.
//   - LOOKUP (assíncrona): resolver trecho a partir de GPS arbitrário
//     (ex.: replay/pós-processamento). `setTrechoLookup(fn)` + `resolveTrechoId`.

let lookupFn = null;
let liveSource = null;

// setTrechoSource(detectorLike) — fonte de verdade ao vivo do trecho atual.
// detectorLike precisa expor `getCurrentSegmentId()` síncrono devolvendo
// `string | null`. Aceita qualquer adaptador com a mesma forma (não cria
// dependência circular com src/telemetry/detector.js).
export function setTrechoSource(detectorLike) {
  liveSource = (detectorLike && typeof detectorLike.getCurrentSegmentId === 'function')
    ? detectorLike
    : null;
}

export function clearTrechoSource() {
  liveSource = null;
}

// getCurrentTrechoIdSync() → string | null
// Lido pelo shift-event-detector durante a construção do evento.
export function getCurrentTrechoIdSync() {
  if (!liveSource) return null;
  try {
    const id = liveSource.getCurrentSegmentId();
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

// setTrechoLookup(fn) — registra uma função `({lat, lon, timestamp}) → string|null`
// para resolução assíncrona (ex.: replay).
export function setTrechoLookup(fn) {
  lookupFn = (typeof fn === 'function') ? fn : null;
}

export function clearTrechoLookup() {
  lookupFn = null;
}

// resolveTrechoId({lat, lon, timestamp}) → Promise<string | null>
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
