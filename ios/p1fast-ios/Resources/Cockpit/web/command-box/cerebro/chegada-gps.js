// ============================================================================
// CHEGADA-GPS — detector PURO de cruzamento da linha de chegada (volta por GPS).
//
// Peça de cálculo do cérebro da NUVEM. Não fala com Supabase, não importa nada
// do cockpit — só geometria. O marco { a_gps, b_gps } chega pronto por quem usa.
//
// A geometria é ESPELHADA (idêntica de propósito) do detector provado em campo
// web/cockpit/chegada-detector.js (decisão Flávio 2026-05-28). Aqui sem a parte
// de Supabase (loadMarcoChegada), porque o cérebro recebe o marco de fora.
// >>> Se a regra de cruzamento mudar num, mudar no outro. <<<
// ============================================================================

const DEBOUNCE_MS = 5000;

function sideOfLine(p, a, b) {
  return (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng);
}

/** O caminho p0→p1 cruza a LINHA DE VERDADE a–b? (interseção de segmentos em
 *  projeção local; folga de 50% em cada ponta pela largura real da linha). */
function caminhoCruzaLinha(p0, p1, a, b) {
  const kLat = 110540;
  const kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const X = q => (q.lng - a.lng) * kLng;
  const Y = q => (q.lat - a.lat) * kLat;
  const r = { x: X(p1) - X(p0), y: Y(p1) - Y(p0) };
  const d = { x: X(b), y: Y(b) };
  const den = r.x * d.y - r.y * d.x;
  if (Math.abs(den) < 1e-9) return false; // paralelos
  const qp = { x: -X(p0), y: -Y(p0) };
  const v = (qp.x * d.y - qp.y * d.x) / den;  // posição ao longo do caminho
  const u = (qp.x * r.y - qp.y * r.x) / den;  // posição ao longo da linha
  return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
}

/**
 * Cria um detector de chegada por GPS.
 * @param {{a_gps:{lat,lng}, b_gps:{lat,lng}}} marco  linha de chegada
 * @param {(info:{t:number, voltaN:number}) => void} onChegada  chamado a cada cruzamento
 * @returns {{ ingestGps:(s:{lat:number,lng:number,t?:number})=>void, getVoltas:()=>number }}
 */
export function criarDetectorChegada(marco, onChegada = () => {}) {
  if (!marco || !marco.a_gps || !marco.b_gps) {
    throw new Error('criarDetectorChegada: marco { a_gps, b_gps } obrigatório');
  }
  const a = marco.a_gps, b = marco.b_gps;
  let lastSide = null, lastPos = null, lastCrossT = -Infinity, voltas = 0;

  function ingestGps(sample) {
    if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') return;
    const t = typeof sample.t === 'number' ? sample.t : null;
    const side = sideOfLine(sample, a, b);
    if (lastSide != null
        && Math.sign(side) !== Math.sign(lastSide)
        && lastPos
        && caminhoCruzaLinha(lastPos, sample, a, b)
        && (t == null || t - lastCrossT > DEBOUNCE_MS)) {
      if (t != null) lastCrossT = t;
      voltas++;
      try { onChegada({ t, voltaN: voltas }); }
      catch (e) { /* não derruba o fluxo do painel por erro de callback */ }
    }
    lastSide = side;
    lastPos = { lat: sample.lat, lng: sample.lng };
  }

  return { ingestGps, getVoltas: () => voltas };
}

export default { criarDetectorChegada };
