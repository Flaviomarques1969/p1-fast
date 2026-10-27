// ============================================================================
// CÉREBRO DA PÁGINA DA VOLTA — item 6 da ordem do GPS aprovada pelo Flávio em 27/10/2026
// (painel p1fast-gps-funcoes-0850): "Celular: página da volta dentro do app e comparação
// entre duas voltas".
//
// Casa ÚNICA destas contas (docs/CONTRATO_DADOS.md §2). Módulo PURO: as linhas da gravação
// entram (o .jsonl do notebook, como a nuvem guarda em sessao_dumps), o PacoteVolta sai.
// Não fala com a nuvem, não toca DOM — a página do celular só desenha o pacote.
//
// De onde vem cada coisa:
//  - volta, setores e perfil ponto a ponto: a MESMA peça da TV (cerebro-gps-tv.js, opção
//    guardarVoltas) — corte de volta e setor existem num lugar só;
//  - G do carro: chaves gLong/gLat/zeroOk que o notebook grava (item 6) — aqui NÃO se refaz G;
//  - comparação: as duas voltas alinhadas pela FRAÇÃO DO TRAÇADO (mesmo ponto físico da pista),
//    não pelo tempo; diferença = tempo da volta B menos o da volta A no mesmo ponto.
// ============================================================================

import { criarCerebroGpsTv } from './cerebro-gps-tv.js';

/** Pontos da comparação ao longo da volta (0 = chegada, 1 = chegada de novo). */
export const PASSOS_COMPARACAO = 500;
/** "Onde ganhou e onde perdeu": a volta dividida em trechos iguais. */
export const N_TRECHOS = 20;
/** Conferência da velocidade gravada: janelas de 1 s acima deste km/h (pela distância). */
export const KMH_MIN_CONFERIR = 15;
/** Razão km/h gravado ÷ km/h pela distância que denuncia o leitor antigo (m/s gravado como km/h ×3,6). */
export const RAZAO_LEITOR_ANTIGO = 3.6;

function r1(v) { return Math.round(v * 10) / 10; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function distM(a, b) {
  const kLat = 110540, kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * kLat, (b.lng - a.lng) * kLng);
}
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

/**
 * Linhas da gravação → pontos no formato do evento 'gps' do canal, em ordem, sem repetição.
 * Aceita: linha do .jsonl do notebook {Tipo:'gps', TWall, Dados:{lat, lon, kmh, fix, hacc, gLong, gLat, zeroOk}},
 * amostra do replay {tipo:'gps', tWall, lat, lon, kmh} e o próprio ponto do canal {lat, lng, kmh, tWall}.
 */
export function pontosDaGravacao(linhas) {
  const out = [];
  for (const l of linhas || []) {
    if (!l || typeof l !== 'object') continue;
    const tipo = l.Tipo ?? l.tipo;
    if (tipo != null && tipo !== 'gps') continue;
    const d = l.Dados && typeof l.Dados === 'object' ? l.Dados : l;
    const lat = num(d.lat), lng = num(d.lng ?? d.lon), t = num(l.TWall ?? l.tWall ?? d.tWall);
    if (lat == null || lng == null || t == null) continue;
    out.push({
      lat, lng, t,
      kmh: num(d.kmh), fix: num(d.fix), hacc: num(d.hacc ?? d.accM),
      gLong: num(d.gLong), gLat: num(d.gLat), zeroOk: d.zeroOk === true,
      source: typeof d.source === 'string' ? d.source : 'racebox',
    });
  }
  out.sort((a, b) => a.t - b.t);
  // linha repetida de verdade (bloco reenviado): mesmo instante, lugar e velocidade — mesmo que
  // outra linha do mesmo milissegundo tenha ficado no meio
  const vistos = new Set();
  return out.filter(p => {
    const k = p.t + '|' + p.lat + '|' + p.lng + '|' + p.kmh;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Confere o km/h gravado contra a distância andada (janelas de 1 s, sem sobreposição).
 * Devolve a razão mediana e o fator a aplicar; o fator só muda quando a razão denuncia o
 * leitor antigo (3,6×, medido em 27/10 na gravação de 21/06) — qualquer outra divergência só avisa.
 */
export function conferirKmh(pontos) {
  const razoes = [];
  let i = 0;
  while (i < pontos.length - 1) {
    let j = i, dist = 0, somaK = 0, nK = 0;
    while (j < pontos.length - 1 && pontos[j].t - pontos[i].t < 1000) {
      dist += distM(pontos[j], pontos[j + 1]);
      if (pontos[j].kmh != null) { somaK += pontos[j].kmh; nK++; }
      j++;
    }
    const dt = (pontos[j].t - pontos[i].t) / 1000;
    if (dt >= 0.8 && dt <= 1.5 && nK > 0) {
      const kmhDist = dist / dt * 3.6;
      if (kmhDist >= KMH_MIN_CONFERIR) razoes.push(somaK / nK / kmhDist);
    }
    i = j > i ? j : i + 1;
  }
  if (razoes.length < 10) return { razao: null, janelas: razoes.length, fator: 1, aviso: null };
  razoes.sort((a, b) => a - b);
  const razao = r3(razoes[Math.floor(razoes.length / 2)]);
  if (Math.abs(razao - RAZAO_LEITOR_ANTIGO) < 0.3) {
    return { razao, janelas: razoes.length, fator: 1 / RAZAO_LEITOR_ANTIGO,
      aviso: 'A velocidade desta gravação veio 3,6× maior (leitor antigo do RaceBox) — corrigida pela distância andada.' };
  }
  if (Math.abs(razao - 1) > 0.15) {
    return { razao, janelas: razoes.length, fator: 1,
      aviso: 'A velocidade gravada não bate com a distância andada (razão ' + String(razao).replace('.', ',') + ') — conferir o aparelho.' };
  }
  return { razao, janelas: razoes.length, fator: 1, aviso: null };
}

// Perfil da volta pronto para interpolar: fração "desenrolada" (o 1º ponto pode cair logo antes
// da linha, ~0,999) e só crescente (projeção que volta um passo não desfaz o caminho andado).
function prepararPerfil(v) {
  const P = [0], T = [0], K = [], D = [0], X = [], Y = [];
  let pMax = 0;
  for (const s of v.perfil || []) {
    let p = s.p;
    if (s.t < 10 && p > 0.9) p -= 1;                              // ainda antes da linha, no começo
    if (s.t > v.tempoS - 10 && p < 0.1) p += 1;                   // já passou da linha, no fim
    if (p <= pMax || p >= 1) continue;
    pMax = p;
    P.push(p); T.push(s.t); D.push(s.d); K.push(s.kmh); X.push(s.x); Y.push(s.y);
  }
  P.push(1); T.push(v.tempoS); D.push(v.distM ?? (D[D.length - 1] || 0));
  K.unshift(K.length ? K[0] : null); K.push(K.length ? K[K.length - 1] : null);
  X.unshift(X.length ? X[0] : null); X.push(X.length ? X[X.length - 1] : null);
  Y.unshift(Y.length ? Y[0] : null); Y.push(Y.length ? Y[Y.length - 1] : null);
  return { P, T, K, D, X, Y };
}
function interp(P, Y, q) {
  if (q <= P[0]) return Y[0];
  if (q >= P[P.length - 1]) return Y[Y.length - 1];
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m] <= q) lo = m; else hi = m; }
  const a = Y[lo], b = Y[hi];
  if (a == null || b == null) return a ?? b;
  return a + (b - a) * (q - P[lo]) / (P[hi] - P[lo]);
}

/**
 * Gravação inteira → PacoteVolta (sessão + voltas com perfil). opts vai para o cérebro da TV
 * (marcoChegada, setoresFrac, sentido, projetar).
 */
export function montarPaginaVolta(linhas, opts = {}) {
  const crus = pontosDaGravacao(linhas);
  const kmh = conferirKmh(crus);
  const pontos = kmh.fator === 1 ? crus : crus.map(p => (p.kmh == null ? p : { ...p, kmh: p.kmh * kmh.fator }));
  const cerebro = criarCerebroGpsTv({ ...opts, guardarVoltas: true });
  let aceitos = 0, kmhMax = null, temG = false;
  for (const p of pontos) {
    if (cerebro.feedGps({ ...p, tWall: p.t })) {
      aceitos++;
      if (p.kmh != null && (kmhMax == null || p.kmh > kmhMax)) kmhMax = p.kmh;
      if (p.zeroOk && p.gLong != null) temG = true;
    }
  }
  const snap = cerebro.snapshot(null);
  const voltas = snap.voltas.map(v => {
    let vMax = null, vMin = null;
    for (const s of v.perfil) {
      if (s.kmh == null) continue;
      if (vMax == null || s.kmh > vMax) vMax = s.kmh;
      if (vMin == null || s.kmh < vMin) vMin = s.kmh;
    }
    return { n: v.n, tempoS: v.tempoS, setoresS: v.setoresS, distM: v.distM,
      kmhMax: vMax != null ? r1(vMax) : null, kmhMin: vMin != null ? r1(vMin) : null,
      picosG: v.picosG ? { freioMax: v.picosG.freioMax, acelMax: v.picosG.acelMax,
        latMax: v.picosG.latMax, combinadoMax: v.picosG.combinadoMax != null ? r3(v.picosG.combinadoMax) : null } : null,
      melhor: snap.melhorVolta != null && snap.melhorVolta.n === v.n,
      deltaMelhorS: snap.melhorVolta ? r3(v.tempoS - snap.melhorVolta.tempoS) : null,
      rastro: v.rastro, perfil: v.perfil };
  });
  return {
    sessao: {
      inicioT: crus.length ? crus[0].t : null, fimT: crus.length ? crus[crus.length - 1].t : null,
      duracaoS: crus.length ? r1((crus[crus.length - 1].t - crus[0].t) / 1000) : 0,
      nPontos: crus.length, nAceitos: aceitos, kmhMax: kmhMax != null ? r1(kmhMax) : null,
      temG, kmhRazao: kmh.razao, kmhFator: kmh.fator === 1 ? 1 : r3(kmh.fator), avisoKmh: kmh.aviso,
    },
    nSetores: snap.nSetores,
    voltas,
    melhorVolta: snap.melhorVolta,
    melhoresSetores: snap.melhoresSetores,
    voltaIdealS: snap.voltaIdealS,
  };
}

/**
 * Compara a volta B com a volta A no mesmo ponto da pista.
 * deltaS > 0 = B chegou ali DEPOIS (mais lenta); < 0 = B na frente.
 */
export function compararVoltas(va, vb, passos = PASSOS_COMPARACAO) {
  if (!va || !vb || !va.perfil || !vb.perfil) return null;
  const A = prepararPerfil(va), B = prepararPerfil(vb);
  const distRef = va.distM || A.D[A.D.length - 1] || 0;
  const serie = [];
  for (let i = 0; i <= passos; i++) {
    const q = i / passos;
    const tA = interp(A.P, A.T, q), tB = interp(B.P, B.T, q);
    const kA = interp(A.P, A.K, q), kB = interp(B.P, B.K, q);
    serie.push({ q: r3(q), m: Math.round(q * distRef), deltaS: r3(tB - tA),
      kmhA: kA != null ? r1(kA) : null, kmhB: kB != null ? r1(kB) : null });
  }
  const deltaEm = q => interp(B.P, B.T, q) - interp(A.P, A.T, q);
  const trechos = [];
  for (let j = 0; j < N_TRECHOS; j++) {
    const q0 = j / N_TRECHOS, q1 = (j + 1) / N_TRECHOS, qm = (q0 + q1) / 2;
    trechos.push({ i: j + 1, de: r3(q0), ate: r3(q1), mDe: Math.round(q0 * distRef), mAte: Math.round(q1 * distRef),
      difS: r3(deltaEm(q1) - deltaEm(q0)),
      x: interp(A.P, A.X, qm) != null ? r1(interp(A.P, A.X, qm)) : null,
      y: interp(A.P, A.Y, qm) != null ? r1(interp(A.P, A.Y, qm)) : null });
  }
  const perdeu = trechos.filter(t => t.difS > 0).sort((a, b) => b.difS - a.difS).slice(0, 3);
  const ganhou = trechos.filter(t => t.difS < 0).sort((a, b) => a.difS - b.difS).slice(0, 3);
  let setores = null;
  if (va.setoresS && vb.setoresS && va.setoresS.length === vb.setoresS.length) {
    setores = va.setoresS.map((a, i) => ({ s: i + 1, a, b: vb.setoresS[i], difS: r3(vb.setoresS[i] - a) }));
  }
  return { a: va.n, b: vb.n, tempoA: va.tempoS, tempoB: vb.tempoS, deltaFinalS: r3(vb.tempoS - va.tempoS),
    distRefM: Math.round(distRef), serie, trechos, perdeu, ganhou, setores };
}

export default { pontosDaGravacao, conferirKmh, montarPaginaVolta, compararVoltas };
