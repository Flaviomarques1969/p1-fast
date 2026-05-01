// gear-shift-detector — detecta evento de troca de marcha em uma janela de
// histórico recente. Função pura.
//
// Heurística: durante uma troca, a velocidade muda pouco em ~250ms enquanto
// a RPM dá um salto (queda = upshift, subida = downshift).

const RPM_DROP_THRESHOLD = 800;
const RPM_RISE_THRESHOLD = 600;
const SPEED_DELTA_TOL_PCT = 0.05;
const SHIFT_WINDOW_MS = 250;

export function detectShiftEvent(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return { type: null, atIndex: -1 };
  }
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const cur = history[i];
    if (!prev || !cur) continue;
    if (!Number.isFinite(prev.rpm) || !Number.isFinite(cur.rpm)) continue;
    if (!Number.isFinite(prev.speed) || !Number.isFinite(cur.speed)) continue;
    if (!Number.isFinite(prev.timestamp) || !Number.isFinite(cur.timestamp)) continue;
    const dt = cur.timestamp - prev.timestamp;
    if (dt <= 0 || dt > SHIFT_WINDOW_MS) continue;
    const dRpm = cur.rpm - prev.rpm;
    const speedRel = Math.abs(cur.speed - prev.speed) / Math.max(prev.speed, 1);
    if (speedRel > SPEED_DELTA_TOL_PCT) continue;
    if (dRpm <= -RPM_DROP_THRESHOLD) return { type: 'up', atIndex: i };
    if (dRpm >= RPM_RISE_THRESHOLD) return { type: 'down', atIndex: i };
  }
  return { type: null, atIndex: -1 };
}
