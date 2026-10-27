// ============================================================================
// CÉREBRO GPS DA TV — item 5 da ordem do GPS aprovada pelo Flávio em 27/10/2026
// (painel p1fast-gps-funcoes-0850): "TV do box: mapa ao vivo com velocidade e G,
// círculo de G e tempos de volta e setores".
//
// Casa ÚNICA destas contas (docs/CONTRATO_DADOS.md §2). Módulo PURO: ponto de GPS do
// canal entra (feedGps), PacoteTv sai (snapshot). Não fala com Supabase, não toca DOM —
// a TV só desenha o pacote. Roda igual no navegador (hoje) e na nuvem (definitivo).
//
// De onde vem cada coisa:
//  - posição, km/h e carimbo: evento 'gps' do RaceBox (fonte única, item 2);
//  - G do carro: chaves gLong/gLat/zeroOk que o NOTEBOOK publica (item 5), calculadas pela
//    peça AceleracaoCarro (zero do box + eixos provados) — aqui NÃO se recalcula G;
//  - volta: cruzamento da linha de chegada pela MESMA geometria do chegada-gps.js;
//  - setores: frações do traçado do Command Box a partir da chegada (geoParaCommandBox +
//    fracDe, as peças do nuvem-posicao.mjs). Padrão = 3 setores de 1/3 da volta cada
//    (ADR-006: "3 setores macro"); a posição exata das linhas é configurável (setoresFrac).
//  - pancadas (item 7): chave gVert que o notebook publica (gz − zero de gz da parada, mesma
//    peça AceleracaoCarro). Pancada = |gVert| passa de PANCADA_G (borda de subida); o grupo
//    acaba quando volta abaixo; vale o pico do grupo, no lugar e na volta do pico.
//  - consistência (item 7): só números das voltas fechadas (média, desvio, amplitude, desvio
//    por setor, volta mais longe da média). Sem regra de corte (nada de "107%"): quem julga é a equipe.
//  - troca de marcha (item 8): buraco curto no G longitudinal durante aceleração, pela casa
//    troca-marcha-g.js (só com o zero do box valendo). Tudo "provável" até a régua da pista; a troca
//    sai ~1 s depois (o critério olha à frente) e conta na volta onde o G caiu.
// ============================================================================

import { criarDetectorChegada } from './chegada-gps.js';
import { geoParaCommandBox } from '../../cockpit/pista-brasilia-commandbox.js';
import { fracDe } from '../pista-cb-polyline.js';
import { pontoGpsAceito } from '../../cockpit/gps-fonte-unica.js';
import { criarDetectorTrocaMarcha } from './troca-marcha-g.js';

/** Linha de chegada oficial de Brasília (tabela marcos, migração 0031 — a mesma da Vista Piloto). */
export const MARCO_CHEGADA_BRASILIA = {
  a_gps: { lat: -15.7728816, lng: -47.9000707 },
  b_gps: { lat: -15.7725493, lng: -47.9001926 },
};
/** Linhas de setor em fração da volta, contada da chegada ao longo do traçado (3 setores iguais). */
export const SETORES_FRAC_PADRAO = [1 / 3, 2 / 3];
/** Sentido do traçado na pista: a fração CRESCE andando (medido na sessão real 21/06: +2,39 em 2,4 voltas). */
export const SENTIDO_BRASILIA = +1;

/** Faixas de G longitudinal que colorem o rastro (mesmo −0,10 G do "freio firme" dos itens 3 e 4). */
export const G_FREIO = -0.10;
export const G_ACEL = +0.10;
/** Rastro do mapa: um ponto a cada 4 m (o RaceBox manda ~1 m entre leituras a 100 km/h). */
export const PASSO_RASTRO_M = 4;
/** Círculo de G: rastro curto ao vivo (s) e nuvem da volta (um ponto a cada 100 ms). */
export const RASTRO_G_S = 3;
export const PASSO_G_MS = 100;
/** Sem ponto novo há mais que isto (ms) = TV mostra "aguardando o carro". */
export const SEM_DADO_MS = 2500;
/** Pancada vertical (zebra, buraco): |gVert| acima disto. Mesmo 0,15 G da análise de 27/10 (capacidade.py: 19 na gravação). */
export const PANCADA_G = 0.15;
/** Duas pancadas de voltas diferentes a até esta fração da volta = mesmo lugar (±0,006 ≈ ±13 m em 2,1 km). */
export const LUGAR_FRAC = 0.006;

const PRECISAO_MAX_M = 50;     // mesmo gate do cerebro-vivo / filtro do notebook (hacc < 50)
const SALTO_FRAC_MAX = 0.05;   // passo maior que isto entre 2 pontos = projeção pulou: não vale como cruzamento
const TETO_PONTOS_VOLTA = 6000;
const TETO_PERFIL_VOLTA = 20000;   // perfil da volta (opção guardarVoltas): 25 Hz × 13 min

function emFaixaBrasilia(lat, lng) { return lat < -15.7 && lat > -15.8 && lng < -47.8 && lng > -48.0; }
function distM(a, b) {
  const kLat = 110540, kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * kLat, (b.lng - a.lng) * kLng);
}
function mod1(v) { return ((v % 1) + 1) % 1; }
function faseDe(gLong) {
  if (typeof gLong !== 'number') return null;
  return gLong <= G_FREIO ? 'freio' : (gLong >= G_ACEL ? 'acel' : 'embalo');
}
function r1(v) { return Math.round(v * 10) / 10; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function media(xs) { return xs.reduce((s, v) => s + v, 0) / xs.length; }
function desvio(xs) { const m = media(xs); return Math.sqrt(media(xs.map(v => (v - m) * (v - m)))); }

/** Lugares onde há pancada em 2+ voltas diferentes (fração da volta a até LUGAR_FRAC, com a volta da chegada). */
function lugaresRepetidos(pancadas) {
  const ps = pancadas.filter(p => p.n >= 1 && p.p != null).slice().sort((a, b) => a.p - b.p);
  const grupos = [];
  for (const p of ps) {
    const g = grupos.find(gr => Math.min(Math.abs(p.p - gr.p), 1 - Math.abs(p.p - gr.p)) <= LUGAR_FRAC);
    if (g) { g.itens.push(p); g.p = media(g.itens.map(i => i.p)); } else grupos.push({ p: p.p, itens: [p] });
  }
  return grupos
    .map(g => {
      const voltasN = [...new Set(g.itens.map(i => i.n))].sort((a, b) => a - b);
      const pico = g.itens.reduce((m, i) => (Math.abs(i.g) > Math.abs(m.g) ? i : m));
      return { frac: Math.round(g.p * 1e4) / 1e4, x: pico.x, y: pico.y, voltas: voltasN, n: g.itens.length, maxG: pico.g };
    })
    .filter(l => l.voltas.length >= 2)
    .sort((a, b) => b.voltas.length - a.voltas.length || a.frac - b.frac);
}

/** Consistência das voltas fechadas: só números, sem regra de corte. null com menos de 2 voltas. */
function consistenciaDe(voltas, nSetores) {
  if (voltas.length < 2) return null;
  const ts = voltas.map(v => v.tempoS);
  const m = media(ts);
  const fora = voltas.reduce((a, v) => (Math.abs(v.tempoS - m) > Math.abs(a.tempoS - m) ? v : a));
  const desvioSetoresS = [];
  for (let i = 0; i < nSetores; i++) {
    const xs = voltas.filter(v => v.setoresS).map(v => v.setoresS[i]);
    desvioSetoresS.push(xs.length >= 2 ? r3(desvio(xs)) : null);
  }
  return { nVoltas: voltas.length, mediaS: r3(m), desvioS: r3(desvio(ts)),
    amplitudeS: r3(Math.max(...ts) - Math.min(...ts)), desvioSetoresS,
    voltaMaisFora: { n: fora.n, difS: r3(fora.tempoS - m) } };
}

function novosPicos() { return { freioMax: null, acelMax: null, latMax: null, combinadoMax: null, n: 0 }; }
function somarPico(p, gl, gt) {
  p.n++;
  if (gl < 0 && (p.freioMax == null || gl < p.freioMax)) p.freioMax = gl;
  if (gl > 0 && (p.acelMax == null || gl > p.acelMax)) p.acelMax = gl;
  if (p.latMax == null || Math.abs(gt) > Math.abs(p.latMax)) p.latMax = gt;
  const c = Math.hypot(gl, gt);
  if (p.combinadoMax == null || c > p.combinadoMax) p.combinadoMax = c;
}

/**
 * @param {object} [opts]
 * @param {{a_gps,b_gps}} [opts.marcoChegada]  linha de chegada (padrão: Brasília)
 * @param {number[]} [opts.setoresFrac]         linhas de setor (fração da volta desde a chegada)
 * @param {number} [opts.sentido]               +1 se a fração do traçado cresce andando
 * @param {(lat:number,lng:number)=>{x:number,y:number,frac:number}|null} [opts.projetar]
 * @param {boolean} [opts.guardarVoltas]       item 6 (página da volta): cada volta fechada leva o
 *   perfil ponto a ponto {t s desde a chegada, p fração da volta, d m andados, kmh, x, y, gl, ga, z}
 *   e o rastro do mapa. Desligado na TV (pacote leve); a conta de volta/setor é a MESMA.
 */
export function criarCerebroGpsTv(opts = {}) {
  const marco = opts.marcoChegada || MARCO_CHEGADA_BRASILIA;
  const setoresFrac = (opts.setoresFrac || SETORES_FRAC_PADRAO).slice().sort((a, b) => a - b);
  const nSetores = setoresFrac.length + 1;
  const sentido = opts.sentido === -1 ? -1 : SENTIDO_BRASILIA;
  const guardarVoltas = opts.guardarVoltas === true;
  const projetar = opts.projetar || ((lat, lng) => {
    if (!emFaixaBrasilia(lat, lng)) return null;
    const p = geoParaCommandBox(lat, lng);
    return { x: p.x, y: p.y, frac: fracDe(p.x, p.y) };
  });
  const meio = { lat: (marco.a_gps.lat + marco.b_gps.lat) / 2, lng: (marco.a_gps.lng + marco.b_gps.lng) / 2 };
  const pChegada = projetar(meio.lat, meio.lng);
  const fracChegada = pChegada ? pChegada.frac : 0;

  // ── estado ──
  let agora = null;               // último ponto aceito
  let ultimoT = null;
  let voltaN = 0;                 // 0 = ainda não cruzou a chegada (volta de saída do box)
  let inicioVoltaT = null;
  let cruzSetorT = [];            // carimbos dos cruzamentos de setor da volta corrente
  let progAnterior = null;
  const voltas = [];              // voltas fechadas
  let rastroVolta = [];           // mapa: pontos da volta corrente
  let rastroUltima = [];          // mapa: pontos da última volta fechada
  let ultimoRastroGeo = null;
  let gRastro = [];               // círculo: últimos RASTRO_G_S segundos
  let gVolta = [];                // círculo: nuvem da volta corrente
  let gUltima = [];               // círculo: nuvem da última volta fechada
  let ultimoGT = null;
  let picosVolta = novosPicos();
  let picosUltima = null;
  let perfilVolta = [];           // opção guardarVoltas: pontos da volta corrente
  let distVolta = 0, ultimoGeoVolta = null;
  const pancadas = [];            // item 7: {n volta da borda de subida, p fração, x, y, g pico (com sinal), t}
  let grupoPancada = null;        // pancada em curso (|gVert| ainda acima do limite)
  const trocas = [];              // item 8: {n volta da queda, x, y, t, kmh, gAntes, buracoS, provavel}
  const detTroca = criarDetectorTrocaMarcha();

  function contarTrocas(v) {
    const da = trocas.filter(tr => tr.n === v.n);
    v.trocas = da.length;
    v.trocaBuracoMedioS = da.length ? r3(media(da.map(tr => tr.buracoS))) : null;
  }

  function fecharVolta(t) {
    const tempoS = (t - inicioVoltaT) / 1000;
    let setoresS = null;
    if (cruzSetorT.length === nSetores - 1) {
      setoresS = [];
      let antes = inicioVoltaT;
      for (const c of cruzSetorT) { setoresS.push((c - antes) / 1000); antes = c; }
      // último setor fecha na soma exata da volta (mesmo carimbo da chegada)
      setoresS.push(tempoS - setoresS.reduce((s, v) => s + v, 0));
      setoresS = setoresS.map(r3);
    }
    const daVolta = pancadas.filter(p => p.n === voltaN);
    const v = { n: voltaN, tempoS: r3(tempoS), setoresS, picosG: picosVolta.n ? picosVolta : null,
      pancadas: daVolta.length,
      pancadaMaxG: daVolta.length ? daVolta.reduce((m, p) => (Math.abs(p.g) > Math.abs(m) ? p.g : m), 0) : null };
    contarTrocas(v);
    if (guardarVoltas) { v.perfil = perfilVolta; v.rastro = rastroVolta; v.distM = Math.round(distVolta); }
    voltas.push(v);
    rastroUltima = rastroVolta; gUltima = gVolta; picosUltima = picosVolta.n ? picosVolta : null;
  }

  const detector = criarDetectorChegada(marco, ({ t }) => {
    if (t == null) return;
    if (inicioVoltaT != null) fecharVolta(t);
    voltaN++;
    inicioVoltaT = t;
    cruzSetorT = [];
    rastroVolta = []; gVolta = []; picosVolta = novosPicos();
    perfilVolta = []; distVolta = 0; ultimoGeoVolta = null;
  });

  /** Ponto do evento 'gps' do canal (RaceBox). Devolve true se entrou. */
  function feedGps(g) {
    if (!g || typeof g.lat !== 'number') return false;
    const lng = typeof g.lng === 'number' ? g.lng : g.lon;
    if (typeof lng !== 'number') return false;
    if (!pontoGpsAceito(g)) return false;   // fonte única = RaceBox (item 2)
    if (g.fix != null && g.fix < 3) return false;
    const prec = g.accM != null ? g.accM : g.hacc;
    if (prec != null && !(prec < PRECISAO_MAX_M)) return false;
    const t = typeof g.tWall === 'number' ? g.tWall : (typeof g.t === 'number' ? g.t : null);
    if (t == null) return false;
    if (ultimoT != null && t <= ultimoT) return false;   // fora de ordem/repetido (fila reenviada)
    ultimoT = t;

    // 1) chegada — pode fechar a volta e zerar o estado da volta ANTES de somar este ponto
    detector.ingestGps({ lat: g.lat, lng, t });

    const pos = projetar(g.lat, lng);
    const kmh = typeof g.kmh === 'number' ? g.kmh : null;
    const temG = typeof g.gLong === 'number' && typeof g.gLat === 'number';
    const gLong = temG ? g.gLong : null, gLat = temG ? g.gLat : null;
    const zeroOk = temG && g.zeroOk === true;

    const gVert = typeof g.gVert === 'number' && Number.isFinite(g.gVert) ? g.gVert : null;
    const progAqui = pos ? mod1(sentido * (pos.frac - fracChegada)) : null;

    // 2) setores — pela fração do traçado contada da chegada
    if (pos) {
      const prog = progAqui;
      if (inicioVoltaT != null && progAnterior != null && cruzSetorT.length < nSetores - 1) {
        const linha = setoresFrac[cruzSetorT.length];
        const passo = prog - progAnterior;
        if (progAnterior < linha && prog >= linha && passo > 0 && passo < SALTO_FRAC_MAX) cruzSetorT.push(t);
      }
      progAnterior = prog;
      if (guardarVoltas && inicioVoltaT != null && perfilVolta.length < TETO_PERFIL_VOLTA) {
        const aqui = { lat: g.lat, lng };
        if (ultimoGeoVolta) distVolta += distM(ultimoGeoVolta, aqui);
        ultimoGeoVolta = aqui;
        perfilVolta.push({ t: r3((t - inicioVoltaT) / 1000), p: Math.round(prog * 1e5) / 1e5, d: r1(distVolta),
          kmh: kmh != null ? r1(kmh) : null, x: r1(pos.x), y: r1(pos.y),
          gl: temG ? r3(gLong) : null, ga: temG ? r3(gLat) : null, z: zeroOk });
      }
    }

    // 2b) pancadas (item 7): borda de subida de |gVert| > PANCADA_G abre o grupo; vale o pico.
    // A volta do grupo é a da borda de subida (uma pancada nunca conta em duas voltas).
    if (gVert != null) {
      if (Math.abs(gVert) > PANCADA_G) {
        if (!grupoPancada) {
          grupoPancada = { n: voltaN, p: null, x: null, y: null, g: 0, t };
          pancadas.push(grupoPancada);
        }
        if (Math.abs(gVert) > Math.abs(grupoPancada.g)) {
          grupoPancada.g = r3(gVert); grupoPancada.t = t;
          grupoPancada.p = progAqui != null ? Math.round(progAqui * 1e5) / 1e5 : null;
          grupoPancada.x = pos ? r1(pos.x) : null; grupoPancada.y = pos ? r1(pos.y) : null;
        }
      } else grupoPancada = null;
    }

    // 2c) troca de marcha (item 8): só G com zero do box; sem ele o detector zera (não se inventa troca)
    const achadas = detTroca.ler(zeroOk
      ? { t, gLong, kmh: kmh != null ? kmh : 0, n: voltaN, x: pos ? r1(pos.x) : null, y: pos ? r1(pos.y) : null }
      : { t, gLong: null });
    for (const tr of achadas) {
      trocas.push(tr);
      const fechada = voltas.find(v => v.n === tr.n);   // chegou depois de a volta da queda fechar
      if (fechada) contarTrocas(fechada);
    }

    // 3) mapa: rastro da volta com velocidade e fase do G
    if (pos && (!ultimoRastroGeo || distM(ultimoRastroGeo, { lat: g.lat, lng }) >= PASSO_RASTRO_M)) {
      ultimoRastroGeo = { lat: g.lat, lng };
      if (rastroVolta.length < TETO_PONTOS_VOLTA) {
        rastroVolta.push({ x: r1(pos.x), y: r1(pos.y), kmh: kmh != null ? Math.round(kmh) : null,
          fase: zeroOk ? faseDe(gLong) : null });
      }
    }

    // 4) círculo de G (só com G que o notebook mandou; picos só com zero do box valendo)
    if (temG) {
      gRastro.push({ t, l: gLong, a: gLat });
      while (gRastro.length && t - gRastro[0].t > RASTRO_G_S * 1000) gRastro.shift();
      if (zeroOk) {
        somarPico(picosVolta, gLong, gLat);
        if ((ultimoGT == null || t - ultimoGT >= PASSO_G_MS) && gVolta.length < TETO_PONTOS_VOLTA) {
          gVolta.push({ l: r3(gLong), a: r3(gLat) });
          // cadência ancorada (10 Hz de verdade a 25 Hz de entrada, não "a cada 3 leituras")
          ultimoGT = ultimoGT == null || t - ultimoGT >= 2 * PASSO_G_MS ? t : ultimoGT + PASSO_G_MS;
        }
      }
    }

    agora = { t, lat: g.lat, lng, kmh, gLong, gLat, zeroOk, gVert,
      gTotal: temG ? r3(Math.hypot(gLong, gLat)) : null,
      x: pos ? r1(pos.x) : null, y: pos ? r1(pos.y) : null, frac: pos ? pos.frac : null };
    return true;
  }

  function melhor(lista, f) {
    let m = null;
    for (const v of lista) { const x = f(v); if (x != null && (m == null || x < m)) m = x; }
    return m;
  }

  /** PacoteTv pronto para a tela (só exibir). nowMs = relógio do mesmo tipo do tWall. */
  function snapshot(nowMs) {
    const fresco = agora != null && (nowMs == null || nowMs - agora.t <= SEM_DADO_MS);
    const melhorVolta = voltas.length
      ? voltas.reduce((m, v) => (m == null || v.tempoS < m.tempoS ? v : m), null) : null;
    const melhoresSetores = [];
    for (let i = 0; i < nSetores; i++) melhoresSetores.push(melhor(voltas, v => v.setoresS ? v.setoresS[i] : null));
    const ideal = melhoresSetores.every(s => s != null) ? r3(melhoresSetores.reduce((s, v) => s + v, 0)) : null;
    const ultima = voltas.length ? voltas[voltas.length - 1] : null;
    let atual = null;
    if (inicioVoltaT != null && agora) {
      const parciais = [];
      let antes = inicioVoltaT;
      for (const c of cruzSetorT) { parciais.push(r3((c - antes) / 1000)); antes = c; }
      atual = { n: voltaN, decorridoS: r3((agora.t - inicioVoltaT) / 1000), setoresS: parciais,
        setorAtual: parciais.length + 1 };
    }
    return {
      fresco,
      agora,
      nSetores,
      voltas: voltas.slice(),
      ultimaVolta: ultima,
      melhorVolta: melhorVolta ? { n: melhorVolta.n, tempoS: melhorVolta.tempoS } : null,
      deltaUltimaS: ultima && melhorVolta ? r3(ultima.tempoS - melhorVolta.tempoS) : null,
      melhoresSetores,
      voltaIdealS: ideal,
      voltaAtual: atual,
      mapa: { volta: rastroVolta, ultima: rastroUltima },
      circuloG: {
        vivo: agora && agora.gLong != null ? { l: agora.gLong, a: agora.gLat, zeroOk: agora.zeroOk } : null,
        rastro: gRastro.map(p => ({ l: p.l, a: p.a })),
        volta: gVolta, ultima: gUltima,
        picosVolta: picosVolta.n ? { ...picosVolta } : null, picosUltima,
      },
      pancadas: {
        total: pancadas.length,
        volta: pancadas.filter(p => p.n === voltaN && p.x != null).map(p => ({ x: p.x, y: p.y, g: p.g })),
        ultima: ultima ? pancadas.filter(p => p.n === ultima.n && p.x != null).map(p => ({ x: p.x, y: p.y, g: p.g })) : [],
        lugaresRepetidos: lugaresRepetidos(pancadas),
      },
      consistencia: consistenciaDe(voltas, nSetores),
      trocas: {
        provavel: true,
        total: trocas.length,
        volta: trocas.filter(tr => tr.n === voltaN && tr.x != null).map(tr => ({ x: tr.x, y: tr.y, kmh: tr.kmh, buracoS: tr.buracoS })),
        ultima: ultima ? trocas.filter(tr => tr.n === ultima.n && tr.x != null).map(tr => ({ x: tr.x, y: tr.y, kmh: tr.kmh, buracoS: tr.buracoS })) : [],
      },
    };
  }

  return { feedGps, snapshot, _fracChegada: fracChegada };
}

export default { criarCerebroGpsTv };
