// passagem-real.js — adaptador: pega uma PASSAGEM REAL de GPS (a volta que se quer
// mostrar) + a passagem de REFERÊNCIA (a melhor volta daquela curva) e devolve os
// números do bloco PASSAGEM do Command Box no MESMO formato que o desenho aprovado
// já consome (a forma de _mc()/currentLap().corners). Assim o bloco troca o dado
// SIMULADO pelo REAL sem tocar no renderizador buildPassagemPanel.
//
// Espelha frenagem-real.js (decisão Flávio 18/06/2026: "ligar a Passagem no dado
// real, espelhando o que foi feito na Frenagem").
//
// HONESTIDADE (igual a Frenagem é honesta sobre o GPS ~1 Hz):
//   • Velocidades de entrada/ápice/saída (km/h) e o TEMPO do trecho (s) vêm
//     MEDIDOS — são reais e confiáveis mesmo a ~1 Hz.
//   • A barra "ápice · distância" (±1 m) NÃO é forjada: a ~1 Hz o GPS não resolve
//     1 metro (a 100 km/h cada leitura é ~28 m). Devolvemos apexOffsetM = null
//     (o bloco mostra "—") + apexDistConfiavel:false. Entra real quando houver
//     dado de maior taxa (25 Hz). Guardamos a estimativa grosseira em
//     apexOffsetMbruto só pra registro/depuração — NÃO pra exibir como ±1 m.
//
// Função pura: não acessa rede nem DOM. Roda em Node e no navegador igual.

// Tolerâncias de cor (km/h) por checkpoint — desvio vs a MELHOR volta naquele
// ponto. Quanto mais perto da melhor, mais verde. Sem julgar "mais é melhor":
// diferença pra melhor = otimização perdida (mesma filosofia do Vmin).
const KMH_BOM   = 1;   // |Δ| ≤ 1 km/h → no ponto (verde)
const KMH_ATEN  = 3;   // |Δ| ≤ 3 km/h → atenção (amarelo); acima → vermelho

// Tolerâncias do veredito total (s) vs a melhor volta.
const S_BOM   = 0.05;  // ≤ 0,05 s → no ritmo
const S_ATEN  = 0.20;  // ≤ 0,20 s → atenção; acima → perdeu

const R = (n) => Math.round(n);

function toneKmh(absDelta) {
  if (absDelta <= KMH_BOM) return 'good';
  if (absDelta <= KMH_ATEN) return 'warn';
  return 'bad';
}

// '+N' / '−N' / '+0' — inteiro de km/h, sinal unicode − (igual ao mockup simulado).
function fmtKmh(delta) {
  const v = R(delta);
  const s = v < 0 ? '−' : '+';
  return s + Math.abs(v);
}

// '+0.34s' / '−0.04s' — segundos com 2 casas, sinal unicode −.
function fmtSeg(delta) {
  const s = delta < 0 ? '−' : '+';
  return s + Math.abs(delta).toFixed(2) + 's';
}

// metros entre dois pontos (lat/lng) — equirretangular, suficiente nesta escala.
function metros(a, b) {
  const RAD = Math.PI / 180, Rt = 6371000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const latm = (a.lat + b.lat) / 2 * RAD;
  const x = dLng * Math.cos(latm);
  return Math.hypot(dLat, x) * Rt;
}

// distância acumulada ao longo da passagem até o índice idx (m).
function distAcumAte(pts, idx) {
  let d = 0;
  for (let i = 1; i <= idx && i < pts.length; i++) d += metros(pts[i - 1], pts[i]);
  return d;
}

// índice do ponto de menor velocidade (= ápice / Vmin da passagem).
function idxVmin(pts) {
  let mi = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].kmh < pts[mi].kmh) mi = i;
  return mi;
}

// extrai os 3 checkpoints de velocidade de uma passagem: entrada (1º ponto),
// ápice (menor kmh) e saída (último ponto), + posição/dist do ápice.
function checkpoints(pts) {
  const ap = idxVmin(pts);
  return {
    entradaKmh: pts[0].kmh,
    apexKmh: pts[ap].kmh,
    saidaKmh: pts[pts.length - 1].kmh,
    apexIdx: ap,
    apexDistM: distAcumAte(pts, ap),
    apexPonto: pts[ap],
  };
}

/**
 * Converte uma passagem REAL (mostrada) + a de referência (melhor) nos campos que o
 * bloco Passagem do Command Box consome. Devolve null se a passagem mostrada não
 * tiver pontos suficientes.
 *
 * @param {{pontos:Array, tempo_trecho_s:number}} passagem    — volta a mostrar
 * @param {{pontos:Array, tempo_trecho_s:number}} [refPassagem] — melhor volta (ref)
 * @returns objeto no formato corner: { entradaKmh, entradaDelta, entradaTone, apexKmh,
 *   apexDelta, apexTone, apexOffsetM(=null pendente), saidaKmh, saidaDelta, saidaTone,
 *   passagemVerdict, passagemTone, passagemDelta, ... + meta }
 */
export function passagemRealParaCorner(passagem, refPassagem) {
  const pts = passagem && passagem.pontos;
  if (!Array.isArray(pts) || pts.length < 2) return null;

  const cur = checkpoints(pts);
  const rpts = refPassagem && refPassagem.pontos;
  const ref = Array.isArray(rpts) && rpts.length >= 2 ? checkpoints(rpts) : null;

  // deltas de velocidade vs a melhor (0 se não há referência distinta)
  const dEnt = ref ? cur.entradaKmh - ref.entradaKmh : 0;
  const dApx = ref ? cur.apexKmh - ref.apexKmh : 0;
  const dSai = ref ? cur.saidaKmh - ref.saidaKmh : 0;

  // delta total de TEMPO do trecho (s) vs a melhor — medido, confiável a 1 Hz.
  const tCur = passagem && typeof passagem.tempo_trecho_s === 'number' ? passagem.tempo_trecho_s : null;
  const tRef = refPassagem && typeof refPassagem.tempo_trecho_s === 'number' ? refPassagem.tempo_trecho_s : null;
  const dTot = tCur != null && tRef != null ? tCur - tRef : 0;

  // veredito total + texto a partir do que mais pesou (honesto, derivado do dado).
  let passagemTone, passagemVerdict;
  if (Math.abs(dTot) <= S_BOM) {
    passagemTone = 'good';
    passagemVerdict = 'no ritmo';
  } else {
    passagemTone = Math.abs(dTot) <= S_ATEN ? 'warn' : 'bad';
    // pior deficit de velocidade aponta onde perdeu
    const perdas = [
      { onde: 'na entrada', v: Math.abs(dEnt) },
      { onde: 'no ápice', v: Math.abs(dApx) },
      { onde: 'na saída', v: Math.abs(dSai) },
    ].sort((a, b) => b.v - a.v);
    passagemVerdict = dTot > 0 ? 'perdeu ' + perdas[0].onde : 'ganhou ' + perdas[0].onde;
  }

  // estimativa grosseira do deslocamento do ápice (só registro; NÃO exibida como ±1 m).
  const apexOffsetMbruto = ref ? Math.round((cur.apexDistM - ref.apexDistM) * 10) / 10 : null;

  // VMIN (velocidade mínima da curva): é o mesmo ponto mais lento que define o ápice
  // a ~1 Hz (apex e Vmin coincidem com esse dado; separam de verdade com 25 Hz).
  // CONFIÁVEL só quando a mínima é um VALE de verdade — abaixo da entrada E da saída
  // (freada capturada dentro do recorte). Na borda, o número não vale (entra com 25 Hz).
  const vminConfiavel = cur.apexKmh < cur.entradaKmh && cur.apexKmh < cur.saidaKmh;
  const dVmin = ref ? cur.apexKmh - ref.apexKmh : 0;

  return {
    entradaKmh: R(cur.entradaKmh), entradaDelta: fmtKmh(dEnt), entradaTone: toneKmh(Math.abs(dEnt)),
    apexKmh: R(cur.apexKmh), apexDelta: fmtKmh(dApx), apexTone: toneKmh(Math.abs(dApx)),
    // barra ±1 m fica PENDENTE (1 Hz não resolve 1 m) — honesto, não forjado.
    apexOffsetM: null, apexDistConfiavel: false,
    apexDistMotivo: 'GPS ~1 Hz não resolve ±1 m — barra entra com 25 Hz',
    apexOffsetMbruto,
    saidaKmh: R(cur.saidaKmh), saidaDelta: fmtKmh(dSai), saidaTone: toneKmh(Math.abs(dSai)),
    // Vmin da volta mostrada + diferença pra melhor (referência aprendida por config).
    vminKmh: R(cur.apexKmh), vminDelta: fmtKmh(dVmin), vminTone: toneKmh(Math.abs(dVmin)), vminConfiavel,
    passagemVerdict, passagemTone, passagemDelta: fmtSeg(dTot),
    fonte: 'real',
  };
}

export const _internos = { toneKmh, fmtKmh, fmtSeg, checkpoints, idxVmin, metros };
